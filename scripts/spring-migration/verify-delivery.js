#!/usr/bin/env node
"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const repositoryRoot = path.resolve(__dirname, "..", "..");

function verifyCutoverRunbook(runbook) {
  const failures = [];
  for (const required of [
    "The adoption command stops at the exact V1/V2 ownership transfer.",
    "The separate `flyway-cutover` stage applies V3, V4, and V5 on startup after adoption succeeds.",
    "Post-adoption: run the exact V1/V2 integrity check immediately after the adoption command completes.",
    "After starting `flyway-cutover`: confirm the exact current V1-V5 chain/checksums, then confirm the 106-table live schema check through the migration gate and smoke.",
    "canonical application operations",
  ]) {
    if (!runbook.includes(required)) failures.push(`cutover runbook is missing ${required}`);
  }
  for (const forbidden of [
    "SHARED_DATABASE_MODE=true",
    "AUTO_SEED_ON_START=false",
    "Temporary FastAPI coexistence",
    "FastAPI coexistence mode",
    "FastAPI application operations",
  ]) {
    if (runbook.includes(forbidden)) failures.push(`cutover runbook still includes ${forbidden}`);
  }
  return failures;
}

function verifyKoreanPdfFontWorkflow(workflowName, workflow) {
  const testCommand = /\.\/gradlew[^\r\n]*\b(?:test|integrationTest|migrationIntegrationTest)\b/;
  const testMatch = testCommand.exec(workflow);
  if (!testMatch) return [];

  const failures = [];
  const fontStepStart = workflow.indexOf("- name: Install Korean PDF fonts");
  if (fontStepStart < 0 || fontStepStart > testMatch.index) {
    return [`${workflowName} runs backend Gradle tests without an earlier Korean PDF font setup step`];
  }

  const nextStepStart = workflow.indexOf("\n      - ", fontStepStart + 1);
  const fontStep = workflow.slice(fontStepStart, nextStepStart < 0 ? workflow.length : nextStepStart);
  for (const required of [
    "set -euo pipefail",
    "sudo apt-get update",
    "sudo apt-get install --yes --no-install-recommends fontconfig fonts-nanum",
    "fc-match NanumGothic | grep -qi nanum",
  ]) {
    if (!fontStep.includes(required)) failures.push(`${workflowName} Korean PDF font setup is missing ${required}`);
  }
  return failures;
}

function verifyDelivery(argv = process.argv) {
  const compose = fs.readFileSync(path.join(repositoryRoot, "docker-compose.deploy.yml"), "utf8");
  const dockerfile = fs.readFileSync(path.join(repositoryRoot, "backend-spring", "Dockerfile"), "utf8");
  const frontendDockerfile = fs.readFileSync(path.join(repositoryRoot, "frontend", "Dockerfile"), "utf8");
  const smokeCompose = fs.readFileSync(path.join(repositoryRoot, "docker-compose.spring-smoke.yml"), "utf8");
  const smokeScript = fs.readFileSync(path.join(repositoryRoot, "scripts", "spring-migration", "smoke-spring-compose.ps1"), "utf8");
  const workflowDirectory = path.join(repositoryRoot, ".github", "workflows");
  const workflows = fs.readdirSync(workflowDirectory)
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => [file, fs.readFileSync(path.join(workflowDirectory, file), "utf8")]);
  const deployWorkflow = fs.readFileSync(path.join(workflowDirectory, "deploy.yml"), "utf8");
  const docsController = fs.readFileSync(path.join(repositoryRoot, "backend-spring", "src", "main", "java", "com", "vibehr", "platform", "openapi", "DocumentationController.java"), "utf8");
  const rootLayout = fs.readFileSync(path.join(repositoryRoot, "frontend", "src", "app", "layout.tsx"), "utf8");
  const deployEnvironment = fs.readFileSync(path.join(repositoryRoot, ".env.deploy"), "utf8");
  const dotenvLoader = fs.readFileSync(path.join(repositoryRoot, "scripts", "spring-migration", "load-deploy-env.sh"), "utf8");
  const cutoverRunbook = fs.readFileSync(path.join(repositoryRoot, "docs", "spring-migration", "CUTOVER_RUNBOOK.md"), "utf8");
  const failures = [];

  failures.push(...verifyCutoverRunbook(cutoverRunbook));
  for (const [workflowName, workflow] of workflows) {
    failures.push(...verifyKoreanPdfFontWorkflow(workflowName, workflow));
  }

  const legacyRollbackArtifact = path.join(repositoryRoot, `docker-compose.rollback-${"python"}.yml`);
  if (fs.existsSync(legacyRollbackArtifact)) failures.push("legacy non-Spring rollback compose remains in the candidate");

  for (const required of ["context: ./backend-spring", "VIBEHR_BFF_BACKEND_URL: ${VIBEHR_BFF_BACKEND_URL:?VIBEHR_BFF_BACKEND_URL is required}", "VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER: ${VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER:?VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER is required}", "host.docker.internal:host-gateway", "/actuator/health/readiness", "SPRING_PROFILES_ACTIVE"]) {
    if (!compose.includes(required)) failures.push(`deploy compose is missing ${required}`);
  }
  if (compose.includes("context: ./backend\n")) failures.push("default deploy compose still builds the Python backend");
  for (const required of ["USER spring", "HEALTHCHECK", "curl", "fontconfig", "fonts-nanum", "application.jar:lib/*", "com.vibehr.VibeHrApplication"]) {
    if (!dockerfile.includes(required)) failures.push(`Spring Dockerfile is missing ${required}`);
  }
  for (const required of [
    "COPY --from=builder --chown=node:node /app/frontend/.next ./.next",
    "COPY --from=builder --chown=node:node /app/frontend/public ./public",
    "USER node",
  ]) {
    if (!frontendDockerfile.includes(required)) failures.push(`frontend Dockerfile is missing non-root runtime contract ${required}`);
  }
  for (const required of [
    "AUTH_TOKEN_SECRET: ${AUTH_TOKEN_SECRET:?AUTH_TOKEN_SECRET is required}",
    "VIBEHR_BFF_ASSERTION_SECRET: ${VIBEHR_BFF_ASSERTION_SECRET:?VIBEHR_BFF_ASSERTION_SECRET is required}",
  ]) {
    if (!smokeCompose.includes(required)) failures.push(`smoke compose is missing generated secret contract ${required}`);
  }
  if (/\b(?:AUTH_TOKEN_SECRET|VIBEHR_BFF_ASSERTION_SECRET):\s*[0-9a-f]{64}\b/i.test(smokeCompose)) {
    failures.push("smoke compose contains a committed HMAC secret literal");
  }
  for (const required of [
    "function New-SmokeSecret",
    "RandomNumberGenerator",
    "$env:AUTH_TOKEN_SECRET = $authSecret",
    "$env:VIBEHR_BFF_ASSERTION_SECRET = $bffAssertionSecret",
    "while ($bffAssertionSecret -eq $authSecret)",
    "Remove-Item Env:AUTH_TOKEN_SECRET",
    "Remove-Item Env:VIBEHR_BFF_ASSERTION_SECRET",
  ]) {
    if (!smokeScript.includes(required)) failures.push(`smoke script is missing generated secret contract ${required}`);
  }
  if (rootLayout.includes("FastAPI") || rootLayout.includes("SQLModel") || !rootLayout.includes("Next.js + Spring Boot + JPA")) {
    failures.push("root layout does not declare the current Next.js, Spring Boot, and JPA stack");
  }
  for (const required of [
    "DEPLOY_KNOWN_HOSTS",
    "StrictHostKeyChecking=yes",
    "UserKnownHostsFile",
    "SPRING_DATASOURCE_URL",
    "SPRING_DATASOURCE_USERNAME",
    "SPRING_DATASOURCE_PASSWORD",
    "AUTH_TOKEN_SECRET",
    "VIBEHR_BFF_ASSERTION_SECRET",
    "VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER",
    "require_canonical_app_origin",
    "candidate readiness check failed",
    "candidate OpenAPI check failed",
    "--add-host host.docker.internal:host-gateway",
    "no running Spring backend release is available",
    "a non-Spring release is not a rollback target",
    "127.0.0.1:3000/login",
    "restore_operator_config",
    "on_exit",
    "rollback_release",
    "rollback compose failed",
    "rollback readiness check failed",
    "rollback OpenAPI check failed",
    "rollback frontend check failed",
    "--no-build --remove-orphans --force-recreate",
  ]) {
    if (!deployWorkflow.includes(required)) failures.push(`deploy workflow is missing hardened delivery control ${required}`);
  }
  if (!deployWorkflow.includes("is_valid_deploy_secret")) {
    failures.push("deploy workflow does not invoke the production secret validator");
  }
  if (!deployWorkflow.includes("migrationIntegrationTest")) {
    failures.push("deploy workflow does not run Flyway migration integration tests before deployment");
  }
  const deploySecretCheck = process.platform === "win32"
    ? childProcess.spawnSync("docker", [
      "run",
      "--rm",
      "--mount",
      `type=bind,source=${repositoryRoot},target=/repo,readonly`,
      "--workdir",
      "/repo",
      "bash:5.2",
      "bash",
      "scripts/spring-migration/deploy-security.sh",
    ], { cwd: repositoryRoot, encoding: "utf8" })
    : childProcess.spawnSync(
      "bash",
      [path.join(repositoryRoot, "scripts", "spring-migration", "deploy-security.sh")],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
  if (deploySecretCheck.status !== 0) {
    failures.push(`production deploy secret validator failed: ${deploySecretCheck.stderr || deploySecretCheck.stdout}`);
  }
  if (!deployWorkflow.includes("bash -c ': >\"/dev/tcp/$1/$2\"' bash \"${DEPLOY_HOST}\" \"${DEPLOY_PORT}\"")) {
    failures.push("deploy workflow does not pass TCP preflight host and port as positional bash arguments");
  }
  if (deployWorkflow.includes("StrictHostKeyChecking=no")) failures.push("deploy workflow disables SSH host key verification");
  if (deployWorkflow.includes("creating empty secret file")) failures.push("deploy workflow permits an empty secret file");
  if (deployWorkflow.includes("up -d --no-build --remove-orphans --force-recreate || true")) failures.push("deploy workflow suppresses rollback compose failures");
  if (deployWorkflow.includes("source ./.env.deploy")) failures.push("deploy workflow evaluates a dotenv file as shell code");
  for (const required of ["load_deploy_env", "IFS= read -r", "printf -v", "prohibited_substitution"]) {
    if (!dotenvLoader.includes(required)) failures.push(`deployment dotenv loader is missing ${required}`);
  }
  for (const required of ["SPRING_PROFILES_ACTIVE=flyway-cutover", "VIBEHR_SCHEMA_OWNER=flyway", "VIBEHR_BFF_BACKEND_URL=http://backend:8080", "VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER=x-vibehr-client-ip"]) {
    if (!deployEnvironment.includes(required)) failures.push(`tracked deploy environment is missing ${required}`);
  }
  for (const required of ["/webjars/redoc/2.5.1/redoc.standalone.js", "Content-Security-Policy", "REDOC_CSP", "script-src 'self'"]) {
    if (!docsController.includes(required)) failures.push(`documentation controller is missing local documentation hardening ${required}`);
  }
  if (docsController.includes("cdn.jsdelivr.net")) failures.push("documentation controller still loads ReDoc from an external CDN");
  if (!docsController.includes("REDOC_CSP = CSP_BASE + \"script-src 'self';")) failures.push("ReDoc CSP permits unnecessary inline scripts");

  const imageFlag = argv.indexOf("--image");
  if (imageFlag >= 0) {
    const image = argv[imageFlag + 1];
    if (!image) failures.push("--image requires an image name");
    else {
      const inspect = childProcess.spawnSync("docker", ["image", "inspect", "--format", "{{.Config.User}}", image], { encoding: "utf8" });
      if (inspect.status !== 0 || !inspect.stdout.trim() || inspect.stdout.trim() === "root") failures.push(`${image} does not run as a non-root user`);
      const noPython = childProcess.spawnSync("docker", ["run", "--rm", "--entrypoint", "sh", image, "-c", "! command -v python && ! command -v python3"], { encoding: "utf8" });
      if (noPython.status !== 0) failures.push(`${image} contains a Python runtime`);
      const koreanFont = childProcess.spawnSync("docker", ["run", "--rm", "--entrypoint", "sh", image, "-c", "fc-match 'NanumGothic' | grep -qi nanum"], { encoding: "utf8" });
      if (koreanFont.status !== 0) failures.push(`${image} does not expose the NanumGothic Korean font for PDF generation`);
      const layeredClasspath = childProcess.spawnSync("docker", ["run", "--rm", "--entrypoint", "sh", image, "-c", "test -f /application/application.jar && test -d /application/lib"], { encoding: "utf8" });
      if (layeredClasspath.status !== 0) failures.push(`${image} is missing the layered application JAR or dependency directory`);
    }
  }

  return failures;
}

if (require.main === module) {
  const failures = verifyDelivery(process.argv);
  if (failures.length) {
    process.stderr.write(`Delivery verification failed:\n- ${failures.join("\n- ")}\n`);
    process.exit(1);
  }
  process.stdout.write("Delivery verification: Spring-only rollback, staged cutover runbook, safe dotenv loading, layered non-root image contract, no-Python image check, and Nanum Korean PDF font check passed.\n");
}

module.exports = { verifyCutoverRunbook, verifyDelivery, verifyKoreanPdfFontWorkflow };
