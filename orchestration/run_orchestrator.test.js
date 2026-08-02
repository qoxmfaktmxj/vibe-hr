"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { extractText, joinBaseAndPath, mockResponse, orchestrate, parseArgs, validateTask } = require("./run_orchestrator");

const task = { task_id: "T-1", title: "Test", goal: "Goal", context: "Context", constraints: [], targets: [], definition_of_done: [] };

test("validates task and uses the Spring 8080 default", () => {
  validateTask(task);
  assert.throws(() => validateTask({}), /task_id/);
  assert.throws(() => validateTask({ ...task, targets: { backend: ["backend/app/api/auth.py"] } }), /retired backend targets/);
  assert.equal(parseArgs(["--task-file", "task.json"], {}).baseUrl, "http://127.0.0.1:8080");
});

test("extracts Responses and chat text and preserves URL joining", () => {
  assert.equal(extractText({ output_text: "answer" }, "missing"), "answer");
  assert.equal(extractText({ choices: [{ message: { content: "chat answer" } }] }, "choices.0.message.content"), "chat answer");
  assert.equal(joinBaseAndPath("http://localhost:8080/", "/api/v1/auth/login"), "http://localhost:8080/api/v1/auth/login");
  assert.match(mockResponse("planner", task), /Backend plan/);
});

test("mock orchestration writes planner, parallel workers, reviewer, and summary", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibehr-orchestrator-"));
  const taskFile = path.join(root, "task.json");
  fs.writeFileSync(taskFile, JSON.stringify(task));
  const result = await orchestrate({ ...parseArgs(["--task-file", taskFile]), runsDir: root });
  assert.equal(result.hasError, false);
  for (const file of ["00_planner.md", "10_frontend.md", "11_backend.md", "12_qa.md", "90_reviewer.md", "summary.json"]) {
    assert.equal(fs.existsSync(path.join(result.runDir, file)), true, `${file} must be written`);
  }
});
