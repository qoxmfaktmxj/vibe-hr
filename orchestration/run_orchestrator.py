from __future__ import annotations

import argparse
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import request as urlrequest
from urllib.error import HTTPError


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


def _get_path(data: Any, dotted: str) -> Any:
    current = data
    for part in dotted.split("."):
        if isinstance(current, list):
            current = current[int(part)]
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


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


def call_internal_auth(
    *,
    base_url: str,
    auth_path: str,
    llm_path: str,
    login_id: str,
    password: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    token_field: str,
    response_text_path: str,
) -> str:
    auth_url = f"{base_url.rstrip('/')}{auth_path}"
    llm_url = f"{base_url.rstrip('/')}{llm_path}"

    auth_payload = json.dumps({"login_id": login_id, "password": password}).encode("utf-8")
    auth_req = urlrequest.Request(
        auth_url,
        data=auth_payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlrequest.urlopen(auth_req, timeout=20) as resp:  # noqa: S310
            auth_json = json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:  # noqa: PERF203
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"auth request failed: {exc.code} {body}") from exc

    access_token = _get_path(auth_json, token_field)
    if not access_token:
        raise RuntimeError(f"token field not found: {token_field}")

    llm_payload = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
    ).encode("utf-8")
    llm_req = urlrequest.Request(
        llm_url,
        data=llm_payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        },
        method="POST",
    )
    try:
        with urlrequest.urlopen(llm_req, timeout=60) as resp:  # noqa: S310
            llm_json = json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"llm request failed: {exc.code} {body}") from exc

    text = _get_path(llm_json, response_text_path)
    if not text:
        # fallback paths
        text = _get_path(llm_json, "choices.0.message.content") or llm_json.get("output_text")
    if not text:
        raise RuntimeError(f"response text not found: {response_text_path}")
    return text


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
    internal_config: dict[str, str] | None = None,
) -> AgentResult:
    started_at = now_iso()
    try:
        if mode == "openai":
            output = call_openai(system_prompt, user_prompt, model, temperature)
        elif mode == "internal-auth":
            if not internal_config:
                raise RuntimeError("internal-auth config is missing")
            output = call_internal_auth(
                base_url=internal_config["base_url"],
                auth_path=internal_config["auth_path"],
                llm_path=internal_config["llm_path"],
                login_id=internal_config["login_id"],
                password=internal_config["password"],
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                token_field=internal_config["token_field"],
                response_text_path=internal_config["response_text_path"],
            )
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
    parser.add_argument("--mode", choices=["mock", "openai", "internal-auth"], default="mock")
    parser.add_argument("--model", default="gpt-5-mini")
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--max-workers", type=int, default=3)
    parser.add_argument("--base-url", default=os.environ.get("VIBE_BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--auth-path", default=os.environ.get("VIBE_AUTH_PATH", "/api/v1/auth/login"))
    parser.add_argument("--llm-path", default=os.environ.get("VIBE_LLM_PATH", "/api/v1/llm/chat"))
    parser.add_argument("--login-id", default=os.environ.get("VIBE_LOGIN_ID", "admin-local"))
    parser.add_argument("--password", default=os.environ.get("VIBE_PASSWORD", "admin"))
    parser.add_argument("--token-field", default=os.environ.get("VIBE_TOKEN_FIELD", "access_token"))
    parser.add_argument("--response-text-path", default=os.environ.get("VIBE_RESPONSE_TEXT_PATH", "choices.0.message.content"))
    args = parser.parse_args()

    task_path = Path(args.task_file).resolve()
    task = read_json(task_path)
    validate_task(task)

    internal_config = {
        "base_url": args.base_url,
        "auth_path": args.auth_path,
        "llm_path": args.llm_path,
        "login_id": args.login_id,
        "password": args.password,
        "token_field": args.token_field,
        "response_text_path": args.response_text_path,
    }

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
        internal_config=internal_config,
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
                internal_config=internal_config,
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
        internal_config=internal_config,
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
