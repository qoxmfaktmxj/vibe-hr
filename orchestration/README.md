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

