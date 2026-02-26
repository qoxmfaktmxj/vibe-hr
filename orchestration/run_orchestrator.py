from __future__ import annotations

import argparse
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parent
PROMPTS_DIR = ROOT_DIR / "prompts"
RUNS_DIR = ROOT_DIR / "runs"


@dataclass
class AgentResult:
    agent: str
    mode: str
    started_at: str
    ended_at: str
    output: str
    error: str | None = None


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def validate_task(task: dict[str, Any]) -> None:
    required = ["task_id", "title", "goal", "context", "constraints", "targets", "definition_of_done"]
    missing = [key for key in required if key not in task]
    if missing:
        raise ValueError(f"Task file is missing required keys: {', '.join(missing)}")


def to_json_block(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)


def call_openai(system_prompt: str, user_prompt: str, model: str, temperature: float) -> str:
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError("openai package is not installed. Run: pip install openai") from exc

    if not os.environ.get("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is not set.")

    client = OpenAI()
    response = client.responses.create(
        model=model,
        instructions=system_prompt,
        input=user_prompt,
        temperature=temperature,
    )
    return response.output_text


def mock_response(agent: str, task: dict[str, Any], planner_output: str | None = None) -> str:
    lines = [
        f"# {agent} output (mock)",
        "",
        f"- task_id: {task['task_id']}",
        f"- title: {task['title']}",
    ]

    if agent == "planner":
        lines.extend(
            [
                "",
                "## Frontend plan",
                "- Define page/component changes and AG Grid impact check.",
                "## Backend plan",
                "- Define API/schema/service changes and transaction order checks.",
                "## QA plan",
                "- Build scenario list from workflow gates and regression scope.",
                "## Merge gates",
                "- validate:grid (if AG Grid in scope), lint, build, and test scenarios.",
            ]
        )
    elif agent in {"frontend", "backend"}:
        lines.extend(
            [
                "",
                "## Inputs",
                "- Planner output received.",
                "",
                "## Proposed execution",
                "- Break work into 2-3 small commits.",
                "- Add validation steps before merge.",
            ]
        )
    else:
        lines.extend(
            [
                "",
                "## Findings",
                "- No blocking issue in mock mode.",
                "",
                "## Go/No-Go",
                "- GO with required validation gates.",
            ]
        )

    if planner_output and agent != "planner":
        lines.extend(["", "## Planner context excerpt", planner_output[:900]])

    return "\n".join(lines)


def run_agent(
    *,
    agent: str,
    mode: str,
    system_prompt: str,
    user_prompt: str,
    model: str,
    temperature: float,
    task: dict[str, Any],
    planner_output: str | None = None,
) -> AgentResult:
    started_at = now_iso()
    try:
        if mode == "openai":
            output = call_openai(system_prompt, user_prompt, model, temperature)
        else:
            output = mock_response(agent, task, planner_output)
        return AgentResult(agent=agent, mode=mode, started_at=started_at, ended_at=now_iso(), output=output)
    except Exception as exc:  # noqa: BLE001
        return AgentResult(
            agent=agent,
            mode=mode,
            started_at=started_at,
            ended_at=now_iso(),
            output="",
            error=str(exc),
        )


def render_user_prompt(task: dict[str, Any], planner_output: str | None = None) -> str:
    chunks = [
        "Task JSON:",
        to_json_block(task),
    ]
    if planner_output:
        chunks.extend(["", "Planner output:", planner_output])
    return "\n".join(chunks)


def write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="VIBE-HR multi-agent orchestration scaffold.")
    parser.add_argument("--task-file", required=True, help="Path to task JSON file.")
    parser.add_argument("--mode", choices=["mock", "openai"], default="mock")
    parser.add_argument("--model", default="gpt-5-mini")
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--max-workers", type=int, default=3)
    args = parser.parse_args()

    task_path = Path(args.task_file).resolve()
    task = read_json(task_path)
    validate_task(task)

    run_id = f"{task['task_id']}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    planner_system = read_text(PROMPTS_DIR / "planner.system.md")
    planner_result = run_agent(
        agent="planner",
        mode=args.mode,
        system_prompt=planner_system,
        user_prompt=render_user_prompt(task),
        model=args.model,
        temperature=args.temperature,
        task=task,
    )
    write_file(run_dir / "00_planner.md", planner_result.output or f"ERROR: {planner_result.error}")

    worker_map = {
        "frontend": PROMPTS_DIR / "frontend.worker.system.md",
        "backend": PROMPTS_DIR / "backend.worker.system.md",
        "qa": PROMPTS_DIR / "qa.reviewer.system.md",
    }

    worker_results: dict[str, AgentResult] = {}
    with ThreadPoolExecutor(max_workers=args.max_workers) as executor:
        future_map = {}
        for agent, prompt_path in worker_map.items():
            system_prompt = read_text(prompt_path)
            future = executor.submit(
                run_agent,
                agent=agent,
                mode=args.mode,
                system_prompt=system_prompt,
                user_prompt=render_user_prompt(task, planner_result.output),
                model=args.model,
                temperature=args.temperature,
                task=task,
                planner_output=planner_result.output,
            )
            future_map[future] = agent

        for future in as_completed(future_map):
            result = future.result()
            worker_results[result.agent] = result

    order = [("frontend", "10_frontend.md"), ("backend", "11_backend.md"), ("qa", "12_qa.md")]
    for agent, filename in order:
        result = worker_results.get(agent)
        if result is None:
            write_file(run_dir / filename, "ERROR: missing result")
            continue
        write_file(run_dir / filename, result.output or f"ERROR: {result.error}")

    reviewer_system = read_text(PROMPTS_DIR / "qa.reviewer.system.md")
    reviewer_input = {
        "task": task,
        "planner": planner_result.output,
        "frontend": worker_results.get("frontend").output if worker_results.get("frontend") else "",
        "backend": worker_results.get("backend").output if worker_results.get("backend") else "",
        "qa": worker_results.get("qa").output if worker_results.get("qa") else "",
    }
    reviewer_result = run_agent(
        agent="reviewer",
        mode=args.mode,
        system_prompt=reviewer_system,
        user_prompt=to_json_block(reviewer_input),
        model=args.model,
        temperature=args.temperature,
        task=task,
    )
    write_file(run_dir / "90_reviewer.md", reviewer_result.output or f"ERROR: {reviewer_result.error}")

    summary = {
        "run_id": run_id,
        "task_file": str(task_path),
        "mode": args.mode,
        "model": args.model,
        "results": {
            "planner": asdict(planner_result),
            "frontend": asdict(worker_results.get("frontend")) if worker_results.get("frontend") else None,
            "backend": asdict(worker_results.get("backend")) if worker_results.get("backend") else None,
            "qa": asdict(worker_results.get("qa")) if worker_results.get("qa") else None,
            "reviewer": asdict(reviewer_result),
        },
    }
    write_file(run_dir / "summary.json", json.dumps(summary, ensure_ascii=False, indent=2))

    print(f"Run completed: {run_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
