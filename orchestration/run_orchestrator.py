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
from urllib.error import HTTPError, URLError


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
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return None
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


def _post_json(
    *,
    url: str,
    payload: dict[str, Any],
    headers: dict[str, str],
    timeout_sec: int,
) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = urlrequest.Request(url, data=data, headers=headers, method="POST")
    try:
        with urlrequest.urlopen(req, timeout=timeout_sec) as resp:  # noqa: S310
            body = resp.read().decode("utf-8")
    except HTTPError as exc:  # noqa: PERF203
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"{url} failed: HTTP {exc.code} {body}") from exc
    except URLError as exc:
        raise RuntimeError(f"{url} failed: {exc}") from exc

    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{url} returned non-JSON response: {body[:500]}") from exc


def _extract_text_from_llm_json(llm_json: dict[str, Any], response_text_path: str) -> str:
    text = _get_path(llm_json, response_text_path)
    if isinstance(text, str) and text.strip():
        return text

    fallback_candidates = [
        _get_path(llm_json, "output_text"),
        _get_path(llm_json, "choices.0.message.content"),
        _get_path(llm_json, "result.text"),
        _get_path(llm_json, "message.content"),
    ]
    for candidate in fallback_candidates:
        if isinstance(candidate, str) and candidate.strip():
            return candidate

    if isinstance(_get_path(llm_json, "choices.0.message.content"), list):
        parts = _get_path(llm_json, "choices.0.message.content")
        joined = " ".join(item.get("text", "") for item in parts if isinstance(item, dict))
        if joined.strip():
            return joined

    raise RuntimeError(f"response text not found: {response_text_path}")


def build_internal_auth_token(
    *,
    auth_url: str,
    login_id: str,
    password: str,
    token_field: str,
    timeout_sec: int,
) -> str:
    auth_json = _post_json(
        url=auth_url,
        payload={"login_id": login_id, "password": password},
        headers={"Content-Type": "application/json"},
        timeout_sec=timeout_sec,
    )
    access_token = _get_path(auth_json, token_field)
    if not access_token:
        raise RuntimeError(f"token field not found: {token_field}")
    if not isinstance(access_token, str):
        raise RuntimeError(f"token field is not string: {token_field}")
    return access_token


def call_internal_auth(
    *,
    llm_url: str,
    access_token: str,
    model: str,
    temperature: float,
    system_prompt: str,
    user_prompt: str,
    response_text_path: str,
    llm_body_style: str,
    timeout_sec: int,
) -> str:
    if llm_body_style == "responses":
        payload = {
            "model": model,
            "instructions": system_prompt,
            "input": user_prompt,
            "temperature": temperature,
        }
    else:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
        }

    llm_json = _post_json(
        url=llm_url,
        payload=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        },
        timeout_sec=timeout_sec,
    )
    return _extract_text_from_llm_json(llm_json, response_text_path)


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
                llm_url=internal_config["llm_url"],
                access_token=internal_config["access_token"],
                model=model,
                temperature=temperature,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_text_path=internal_config["response_text_path"],
                llm_body_style=internal_config["llm_body_style"],
                timeout_sec=int(internal_config["llm_timeout_sec"]),
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


def _join_base_and_path(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def main() -> int:
    parser = argparse.ArgumentParser(description="VIBE-HR multi-agent orchestration scaffold.")
    parser.add_argument("--task-file", required=True, help="Path to task JSON file.")
    parser.add_argument("--mode", choices=["mock", "openai", "internal-auth"], default="mock")
    parser.add_argument("--model", default="gpt-5-mini")
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--max-workers", type=int, default=3)
    parser.add_argument("--base-url", default=os.environ.get("VIBE_BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--auth-url", default=os.environ.get("VIBE_AUTH_URL", ""))
    parser.add_argument("--auth-path", default=os.environ.get("VIBE_AUTH_PATH", "/api/v1/auth/login"))
    parser.add_argument("--llm-url", default=os.environ.get("VIBE_LLM_URL", ""))
    parser.add_argument("--llm-path", default=os.environ.get("VIBE_LLM_PATH", "/api/v1/llm/chat"))
    parser.add_argument("--login-id", default=os.environ.get("VIBE_LOGIN_ID", ""))
    parser.add_argument("--password", default=os.environ.get("VIBE_PASSWORD", ""))
    parser.add_argument("--access-token", default=os.environ.get("VIBE_ACCESS_TOKEN", ""))
    parser.add_argument("--token-field", default=os.environ.get("VIBE_TOKEN_FIELD", "access_token"))
    parser.add_argument("--response-text-path", default=os.environ.get("VIBE_RESPONSE_TEXT_PATH", "choices.0.message.content"))
    parser.add_argument("--auth-timeout-sec", type=int, default=int(os.environ.get("VIBE_AUTH_TIMEOUT_SEC", "20")))
    parser.add_argument("--llm-timeout-sec", type=int, default=int(os.environ.get("VIBE_LLM_TIMEOUT_SEC", "60")))
    parser.add_argument("--llm-body-style", choices=["chat", "responses"], default=os.environ.get("VIBE_LLM_BODY_STYLE", "chat"))
    args = parser.parse_args()

    task_path = Path(args.task_file).resolve()
    task = read_json(task_path)
    validate_task(task)

    internal_config: dict[str, str] | None = None
    try:
        if args.mode == "internal-auth":
            auth_url = args.auth_url.strip() or _join_base_and_path(args.base_url, args.auth_path)
            llm_url = args.llm_url.strip() or _join_base_and_path(args.base_url, args.llm_path)

            access_token = args.access_token.strip()
            if not access_token:
                if not args.login_id.strip() or not args.password:
                    raise ValueError(
                        "internal-auth mode requires either --access-token (or VIBE_ACCESS_TOKEN) "
                        "or both --login-id/--password."
                    )
                access_token = build_internal_auth_token(
                    auth_url=auth_url,
                    login_id=args.login_id.strip(),
                    password=args.password,
                    token_field=args.token_field,
                    timeout_sec=args.auth_timeout_sec,
                )

            internal_config = {
                "llm_url": llm_url,
                "access_token": access_token,
                "response_text_path": args.response_text_path,
                "llm_body_style": args.llm_body_style,
                "llm_timeout_sec": str(args.llm_timeout_sec),
            }
    except Exception as exc:  # noqa: BLE001
        print(f"Startup failed: {exc}")
        return 2

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

    all_results = [planner_result, *worker_results.values(), reviewer_result]
    has_error = any(result.error for result in all_results)
    if has_error:
        print(f"Run completed with errors: {run_dir}")
        return 2

    print(f"Run completed: {run_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
