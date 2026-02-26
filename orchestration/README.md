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
  run_orchestrator.py
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
python orchestration/run_orchestrator.py \
  --task-file orchestration/tasks/tim-phase3-sample.json \
  --mode mock
```

This generates outputs under `orchestration/runs/<task_id>_<timestamp>/`.

## OpenAI mode (optional)

1. Install SDK
```bash
pip install openai
```

2. Set API key
```bash
set OPENAI_API_KEY=...
```

3. Run
```bash
python orchestration/run_orchestrator.py \
  --task-file orchestration/tasks/tim-phase3-sample.json \
  --mode openai \
  --model gpt-5-mini
```

## Internal auth mode (API key 없이)

사내 게이트웨이/프록시를 쓰는 경우 `internal-auth` 모드를 사용할 수 있습니다.

```bash
python orchestration/run_orchestrator.py \
  --task-file orchestration/tasks/tim-phase3-sample.json \
  --mode internal-auth \
  --base-url http://127.0.0.1:8000 \
  --auth-path /api/v1/auth/login \
  --llm-path /api/v1/llm/chat \
  --login-id admin-local \
  --password admin \
  --token-field access_token \
  --response-text-path choices.0.message.content
```

- 인증은 `POST {base-url}{auth-path}`로 토큰 발급 후 Bearer로 LLM 호출
- 요청 바디 기본 포맷: `{ model, messages[] }`
- 응답 텍스트 경로는 `--response-text-path`로 조정

## Output files

- `00_planner.md`
- `10_frontend.md`
- `11_backend.md`
- `12_qa.md`
- `90_reviewer.md`
- `summary.json`

## How this maps to sub-agents

- The script treats each role as an independent "sub-agent job" with its own system prompt.
- Worker jobs run in parallel (`ThreadPoolExecutor`) to model sub-agent fan-out.
- Reviewer receives all worker outputs and performs gate checks before final summary.
- Replace prompt files to tune behavior without changing orchestrator code.

