#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT_DIR = __dirname;
const PROMPTS_DIR = path.join(ROOT_DIR, "prompts");
const RUNS_DIR = path.join(ROOT_DIR, "runs");
const REQUIRED_TASK_FIELDS = ["task_id", "title", "goal", "context", "constraints", "targets", "definition_of_done"];

function nowIso() { return new Date().toISOString().replace(/\.\d{3}Z$/, "Z"); }
function readText(file) { return fs.readFileSync(file, "utf8"); }
function readJson(file) { return JSON.parse(readText(file)); }
function writeFile(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value, "utf8"); }
function validateTask(task) {
  const missing = REQUIRED_TASK_FIELDS.filter((key) => !(key in task));
  if (missing.length) throw new Error(`Task file is missing required keys: ${missing.join(", ")}`);
  const legacyBackendTargets = Array.isArray(task.targets?.backend)
    ? task.targets.backend.filter((target) => typeof target === "string" && /^backend(?:[\\/]|$)/.test(target))
    : [];
  if (legacyBackendTargets.length) throw new Error(`Task file uses retired backend targets: ${legacyBackendTargets.join(", ")}`);
}
function json(data) { return JSON.stringify(data, null, 2); }
function getPath(data, dotted) {
  return dotted.split(".").reduce((current, part) => {
    if (Array.isArray(current)) return /^\d+$/.test(part) ? current[Number(part)] : undefined;
    return current && typeof current === "object" ? current[part] : undefined;
  }, data);
}
function extractText(data, responseTextPath) {
  const candidates = [getPath(data, responseTextPath), getPath(data, "output_text"), getPath(data, "choices.0.message.content"), getPath(data, "result.text"), getPath(data, "message.content")];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value)) {
      const joined = value.map((item) => item && typeof item === "object" ? item.text || "" : "").join(" ").trim();
      if (joined) return joined;
    }
  }
  throw new Error(`response text not found: ${responseTextPath}`);
}
async function postJson(url, payload, headers, timeoutSeconds, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    const response = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal });
    const body = await response.text();
    if (!response.ok) throw new Error(`${url} failed: HTTP ${response.status} ${body}`);
    try { return JSON.parse(body); } catch { throw new Error(`${url} returned non-JSON response: ${body.slice(0, 500)}`); }
  } finally { clearTimeout(timeout); }
}
async function callOpenAi(systemPrompt, userPrompt, model, temperature, options) {
  if (!options.apiKey) throw new Error("OPENAI_API_KEY is not set.");
  const response = await postJson("https://api.openai.com/v1/responses", { model, instructions: systemPrompt, input: userPrompt, temperature }, { "Content-Type": "application/json", Authorization: `Bearer ${options.apiKey}` }, options.llmTimeoutSec, options.fetchImpl);
  return extractText(response, "output_text");
}
async function buildInternalToken(options) {
  const response = await postJson(options.authUrl, { login_id: options.loginId, password: options.password }, { "Content-Type": "application/json" }, options.authTimeoutSec, options.fetchImpl);
  const token = getPath(response, options.tokenField);
  if (typeof token !== "string" || !token) throw new Error(`token field not found: ${options.tokenField}`);
  return token;
}
async function callInternalAuth(systemPrompt, userPrompt, model, temperature, options) {
  const payload = options.llmBodyStyle === "responses" ? { model, instructions: systemPrompt, input: userPrompt, temperature } : { model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], temperature };
  const response = await postJson(options.llmUrl, payload, { "Content-Type": "application/json", Authorization: `Bearer ${options.accessToken}` }, options.llmTimeoutSec, options.fetchImpl);
  return extractText(response, options.responseTextPath);
}
function mockResponse(agent, task, plannerOutput) {
  const sections = [`# ${agent} output (mock)`, "", `- task_id: ${task.task_id}`, `- title: ${task.title}`, ""];
  if (agent === "planner") sections.push("## Frontend plan", "- Define page/component changes and AG Grid impact check.", "## Backend plan", "- Define Spring API/schema/service changes and transaction order checks.", "## QA plan", "- Build scenario list from workflow gates and regression scope.", "## Merge gates", "- validate:grid (if AG Grid in scope), Gradle tests, lint, build, and test scenarios.");
  else if (["frontend", "backend"].includes(agent)) sections.push("## Inputs", "- Planner output received.", "", "## Proposed execution", "- Break work into 2-3 small commits.", "- Add validation steps before merge.");
  else sections.push("## Findings", "- No blocking issue in mock mode.", "", "## Go/No-Go", "- GO with required validation gates.");
  if (plannerOutput && agent !== "planner") sections.push("", "## Planner context excerpt", plannerOutput.slice(0, 900));
  return sections.join("\n");
}
function userPrompt(task, plannerOutput) { return ["Task JSON:", json(task), ...(plannerOutput ? ["", "Planner output:", plannerOutput] : [])].join("\n"); }
async function runAgent(agent, mode, systemPrompt, prompt, options, plannerOutput) {
  const started_at = nowIso();
  try {
    const output = mode === "openai" ? await callOpenAi(systemPrompt, prompt, options.model, options.temperature, options)
      : mode === "internal-auth" ? await callInternalAuth(systemPrompt, prompt, options.model, options.temperature, options)
        : mockResponse(agent, options.task, plannerOutput);
    return { agent, mode, started_at, ended_at: nowIso(), output, error: null };
  } catch (error) { return { agent, mode, started_at, ended_at: nowIso(), output: "", error: error.message }; }
}
function joinBaseAndPath(baseUrl, endpointPath) { return `${baseUrl.replace(/\/+$/, "")}/${endpointPath.replace(/^\/+/, "")}`; }
function parseArgs(argumentsList, env = process.env) {
  const options = { taskFile: "", mode: "mock", model: "gpt-5-mini", temperature: 0.2, maxWorkers: 3, baseUrl: env.VIBE_BASE_URL || "http://127.0.0.1:8080", authUrl: env.VIBE_AUTH_URL || "", authPath: env.VIBE_AUTH_PATH || "/api/v1/auth/login", llmUrl: env.VIBE_LLM_URL || "", llmPath: env.VIBE_LLM_PATH || "/api/v1/llm/chat", loginId: env.VIBE_LOGIN_ID || "", password: env.VIBE_PASSWORD || "", accessToken: env.VIBE_ACCESS_TOKEN || "", tokenField: env.VIBE_TOKEN_FIELD || "access_token", responseTextPath: env.VIBE_RESPONSE_TEXT_PATH || "choices.0.message.content", authTimeoutSec: Number(env.VIBE_AUTH_TIMEOUT_SEC || 20), llmTimeoutSec: Number(env.VIBE_LLM_TIMEOUT_SEC || 60), llmBodyStyle: env.VIBE_LLM_BODY_STYLE || "chat", apiKey: env.OPENAI_API_KEY || "", fetchImpl: fetch };
  const fields = { "--task-file": "taskFile", "--mode": "mode", "--model": "model", "--temperature": "temperature", "--max-workers": "maxWorkers", "--base-url": "baseUrl", "--auth-url": "authUrl", "--auth-path": "authPath", "--llm-url": "llmUrl", "--llm-path": "llmPath", "--login-id": "loginId", "--password": "password", "--access-token": "accessToken", "--token-field": "tokenField", "--response-text-path": "responseTextPath", "--auth-timeout-sec": "authTimeoutSec", "--llm-timeout-sec": "llmTimeoutSec", "--llm-body-style": "llmBodyStyle" };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]; const field = fields[argument];
    if (!field || !argumentsList[index + 1]) throw new Error(`Unknown or incomplete argument: ${argument}`);
    options[field] = argumentsList[++index];
  }
  options.temperature = Number(options.temperature); options.maxWorkers = Number(options.maxWorkers); options.authTimeoutSec = Number(options.authTimeoutSec); options.llmTimeoutSec = Number(options.llmTimeoutSec);
  if (!options.taskFile || !["mock", "openai", "internal-auth"].includes(options.mode) || !["chat", "responses"].includes(options.llmBodyStyle) || !Number.isInteger(options.maxWorkers) || options.maxWorkers < 1) throw new Error("Invalid required options.");
  return options;
}
async function runWorkers(workers, options, plannerOutput) {
  const results = [];
  const queue = [...workers];
  const workerCount = Math.min(options.maxWorkers, queue.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (queue.length) {
      const [agent, promptFile] = queue.shift();
      results.push(await runAgent(agent, options.mode, readText(path.join(PROMPTS_DIR, promptFile)), userPrompt(options.task, plannerOutput), options, plannerOutput));
    }
  }));
  return results;
}
async function orchestrate(options) {
  const taskFile = path.resolve(options.taskFile); const task = readJson(taskFile); validateTask(task); options.task = task;
  if (options.mode === "internal-auth") {
    options.authUrl = options.authUrl.trim() || joinBaseAndPath(options.baseUrl, options.authPath);
    options.llmUrl = options.llmUrl.trim() || joinBaseAndPath(options.baseUrl, options.llmPath);
    if (!options.accessToken.trim()) {
      if (!options.loginId.trim() || !options.password) throw new Error("internal-auth mode requires either --access-token or both --login-id/--password.");
      options.accessToken = await buildInternalToken(options);
    }
  }
  const runId = `${task.task_id}_${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "")}`; const runDir = path.join(options.runsDir || RUNS_DIR, runId); fs.mkdirSync(runDir, { recursive: true });
  const planner = await runAgent("planner", options.mode, readText(path.join(PROMPTS_DIR, "planner.system.md")), userPrompt(task), options); writeFile(path.join(runDir, "00_planner.md"), planner.output || `ERROR: ${planner.error}`);
  const workers = [["frontend", "frontend.worker.system.md", "10_frontend.md"], ["backend", "backend.worker.system.md", "11_backend.md"], ["qa", "qa.reviewer.system.md", "12_qa.md"]];
  const workerResults = await runWorkers(workers, options, planner.output);
  const byAgent = Object.fromEntries(workerResults.map((result) => [result.agent, result]));
  for (const [agent, , outputFile] of workers) { const result = byAgent[agent]; writeFile(path.join(runDir, outputFile), result?.output || `ERROR: ${result?.error || "missing result"}`); }
  const reviewerInput = { task, planner: planner.output, frontend: byAgent.frontend?.output || "", backend: byAgent.backend?.output || "", qa: byAgent.qa?.output || "" };
  const reviewer = await runAgent("reviewer", options.mode, readText(path.join(PROMPTS_DIR, "qa.reviewer.system.md")), json(reviewerInput), options); writeFile(path.join(runDir, "90_reviewer.md"), reviewer.output || `ERROR: ${reviewer.error}`);
  const summary = { run_id: runId, task_file: taskFile, mode: options.mode, model: options.model, results: { planner, frontend: byAgent.frontend || null, backend: byAgent.backend || null, qa: byAgent.qa || null, reviewer } };
  writeFile(path.join(runDir, "summary.json"), json(summary));
  return { runDir, hasError: [planner, ...workerResults, reviewer].some((result) => result.error), summary };
}
async function main() { try { const result = await orchestrate(parseArgs(process.argv.slice(2))); console.log(result.hasError ? `Run completed with errors: ${result.runDir}` : `Run completed: ${result.runDir}`); process.exitCode = result.hasError ? 2 : 0; } catch (error) { console.error(`Startup failed: ${error.message}`); process.exitCode = 2; } }
if (require.main === module) main();
module.exports = { extractText, getPath, joinBaseAndPath, mockResponse, orchestrate, parseArgs, postJson, runWorkers, validateTask };
