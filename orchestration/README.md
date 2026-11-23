# GPT Orchestration Scaffold

This folder is a runnable scaffold for a multi-agent workflow aligned to `WORKFLOW.md`:

- Planner
- Frontend worker
- Backend worker
- QA reviewer

It is not an automatic "sub-agent engine" by itself. It is an explicit orchestrator that splits one task into role-based prompts and then merges results.

## Folder layout

```text
orchestration/
  run_orchestrator.js
  prompts/
    planner.system.md
    frontend.worker.system.md
    backend.worker.system.md
    qa.reviewer.system.md
  tasks/
    task-template.json
    tim-phase3-sample.json
  runs/
    .gitkeep
```

## Quick start (mock mode)

```bash
node orchestration/run_orchestrator.js \
  --task-file orchestration/tasks/tim-phase3-sample.json \
  --mode mock
```

This generates outputs under `orchestration/runs/<task_id>_<timestamp>/`.

실행 백엔드 작업은 `targets.backend`에 `backend-rust/**` 경로를 적는다. 오케스트레이터는 이전 `backend/**` 경로를 거부한다.

## OpenAI mode (optional)

1. Set API key
```bash
set OPENAI_API_KEY=...
```

2. Run
```bash
node orchestration/run_orchestrator.js \
  --task-file orchestration/tasks/tim-phase3-sample.json \
  --mode openai \
  --model gpt-5-mini
```

## Internal auth mode (no API key)

Use this mode when your team has an auth-protected LLM gateway.

Rust HR 서버의 `/api/v1/auth/login`은 BFF 서명을 요구하며 이 서버에는 LLM 채팅 라우트가 없다. 별도 게이트웨이에서 발급한 토큰과 URL을 같은 터미널에 설정한 후 저장소 루트에서 실행한다.

```powershell
$env:VIBE_LLM_URL = "https://your-gateway.example.com/api/v1/llm/chat"
# VIBE_ACCESS_TOKEN은 게이트웨이에서 발급한 값을 세션 환경에 설정한다.
node orchestration/run_orchestrator.js --task-file orchestration/tasks/tim-phase3-sample.json --mode internal-auth
```

게이트웨이가 자체 로그인 API를 제공하면 `--auth-url`로 지정할 수 있다.

Notes:
- `--auth-url` and `--llm-url` override base/path composition.
- `--llm-body-style` supports `chat` and `responses`.
- The run exits with non-zero code when any agent call fails.

## Output files

- `00_planner.md`
- `10_frontend.md`
- `11_backend.md`
- `12_qa.md`
- `90_reviewer.md`
- `summary.json`

## How this maps to sub-agents

- The script treats each role as an independent "sub-agent job" with its own system prompt.
- Worker jobs run in parallel with a bounded Node promise pool (`--max-workers`) to model sub-agent fan-out.
- Reviewer receives all worker outputs and performs gate checks before final summary.
- Replace prompt files to tune behavior without changing orchestrator code.
