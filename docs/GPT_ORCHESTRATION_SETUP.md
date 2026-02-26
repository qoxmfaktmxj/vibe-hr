# GPT Orchestration Setup (VIBE-HR)

## Why this exists

`AGENTS.md` and `WORKFLOW.md` define rules and process, but they do not automatically create sub-agents.

To run sub-agent style execution with GPT, you need:

1. A planner role
2. Specialized worker roles
3. A reviewer role
4. An orchestrator that routes context and collects outputs

This repository scaffold is in `orchestration/`.

## What "sub-agent split" means here

- Planner generates role-specific execution scope.
- Frontend/Backend/QA workers run as separate jobs (parallel fan-out).
- Reviewer validates merge gates and readiness.
- Final summary is produced after collecting all job outputs.

## Claude Code comparison

- Claude Code may feel more "built-in" for iterative coding workflows.
- In both ecosystems, reliable multi-role delivery still needs explicit policies:
  - role prompts
  - task routing
  - validation gates
  - merge criteria

So the difference is mostly tooling UX, not whether orchestration logic is needed.

## Run guide

```bash
python orchestration/run_orchestrator.py \
  --task-file orchestration/tasks/tim-phase3-sample.json \
  --mode mock
```

Optional OpenAI mode:

```bash
pip install openai
set OPENAI_API_KEY=...
python orchestration/run_orchestrator.py \
  --task-file orchestration/tasks/tim-phase3-sample.json \
  --mode openai \
  --model gpt-5-mini
```

## Output location

`orchestration/runs/<task_id>_<timestamp>/`

