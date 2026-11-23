# GPT Orchestration Setup (Vibe-HR)

Status: Active
Canonical: `orchestration/README.md`

`AGENTS.md` and `WORKFLOW.md` define the process. The Node orchestrator in `orchestration/` executes an explicit planner, frontend worker, Rust backend worker, QA worker, and reviewer workflow.

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

`internal-auth`는 팀의 인증된 LLM 게이트웨이가 있을 때 사용한다. Rust HR API는 `/api/v1/llm/chat`을 제공하지 않는다. 게이트웨이 URL과 인증 설정은 [실행 가이드](../orchestration/README.md)를 따른다.

실행 백엔드 작업 범위는 `targets.backend`에 `backend-rust/**`로 지정한다. `run_orchestrator.js` rejects a retired `backend/**` target before it creates a run directory.

Rust 인증 계약은 `backend-rust/src/security/`와 BFF 호출 경로에서 확인한다. Orchestration outputs are written under `orchestration/runs/<task_id>_<timestamp>/`.
