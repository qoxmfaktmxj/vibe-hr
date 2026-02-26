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

## Internal auth mode (no API key)

Use this mode when your team has an auth-protected LLM gateway.

Option A: login/password -> token -> LLM
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

Option B: use existing token directly
```bash
python orchestration/run_orchestrator.py \
  --task-file orchestration/tasks/tim-phase3-sample.json \
  --mode internal-auth \
  --llm-url https://your-gateway.example.com/api/v1/llm/chat \
  --access-token "<your_token>" \
  --response-text-path choices.0.message.content
```

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
- Worker jobs run in parallel (`ThreadPoolExecutor`) to model sub-agent fan-out.
- Reviewer receives all worker outputs and performs gate checks before final summary.
- Replace prompt files to tune behavior without changing orchestrator code.
