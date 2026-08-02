# GPT Orchestration Setup (Vibe-HR)

Status: Active
Canonical: `orchestration/README.md`

`AGENTS.md` and `WORKFLOW.md` define the process. The Node orchestrator in `orchestration/` executes an explicit planner, frontend worker, Spring backend worker, QA worker, and reviewer workflow.

## Run Guide

```powershell
node orchestration/run_orchestrator.js `
  --task-file orchestration/tasks/tim-phase3-sample.json `
  --mode mock
```

OpenAI mode requires only an API key:

```powershell
$env:OPENAI_API_KEY = "..."
node orchestration/run_orchestrator.js `
  --task-file orchestration/tasks/tim-phase3-sample.json `
  --mode openai `
  --model gpt-5-mini
```

Internal-auth mode defaults to the Spring service at port 8080:

```powershell
node orchestration/run_orchestrator.js `
  --task-file orchestration/tasks/tim-phase3-sample.json `
  --mode internal-auth `
  --base-url http://127.0.0.1:8080 `
  --auth-path /api/v1/auth/login `
  --llm-path /api/v1/llm/chat `
  --login-id admin-local `
  --password admin
```

`targets.backend` must contain only `backend-spring/**` paths. `run_orchestrator.js` rejects a retired `backend/**` target before it creates a run directory.

Confirm Spring authentication behavior in `backend-spring/src/main/java/com/vibehr/auth/**` and `backend-spring/src/main/java/com/vibehr/platform/security/**`. Orchestration outputs are written under `orchestration/runs/<task_id>_<timestamp>/`.
