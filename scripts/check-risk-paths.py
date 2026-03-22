#!/usr/bin/env python3
"""Classify changed files into governance-sensitive buckets.

This script is a lightweight projection of:
- docs/GOVERNANCE.md
- docs/ARCHITECTURE.md
- docs/TEST_STRATEGY.md

It is intentionally warning-oriented by default. It does not replace
canonical policy documents.
"""

from __future__ import annotations

import argparse
import fnmatch
import os
import subprocess
import sys
from dataclasses import dataclass
from typing import Iterable


DOCS = {
    "governance": "docs/GOVERNANCE.md",
    "architecture": "docs/ARCHITECTURE.md",
    "test": "docs/TEST_STRATEGY.md",
    "grid": "docs/GRID_SCREEN_STANDARD.md",
    "permission": "docs/MENU_ACTION_PERMISSION_PLAN.md",
    "ledger": "docs/TASK_LEDGER.md",
}


@dataclass(frozen=True)
class Rule:
    key: str
    title: str
    patterns: tuple[str, ...]
    risk: str
    why: str
    how_to_fix: str
    docs: tuple[str, ...]


RULES: tuple[Rule, ...] = (
    Rule(
        key="grid_changed",
        title="Shared Grid / registry change",
        patterns=(
            "frontend/src/components/grid/**",
            "frontend/src/lib/grid/**",
            "config/grid-screens.json",
        ),
        risk="R2",
        why="Shared Grid contracts and screen registry changes can affect multiple screens.",
        how_to_fix=(
            "Run frontend grid validation and record regression evidence. "
            "Recommended: cd frontend && npm run validate:grid && npm run lint && npm run build"
        ),
        docs=(DOCS["grid"], DOCS["test"], DOCS["governance"]),
    ),
    Rule(
        key="permission_changed",
        title="Menu / permission path change",
        patterns=(
            "backend/app/api/menu.py",
            "backend/app/services/menu_service.py",
            "backend/app/schemas/menu.py",
        ),
        risk="R2",
        why="Permission-related changes must be checked on both UI and server sides.",
        how_to_fix=(
            "Confirm approval if scope is broader than local behavior, then verify both UI behavior "
            "and server-side enforcement."
        ),
        docs=(DOCS["permission"], DOCS["governance"], DOCS["test"]),
    ),
    Rule(
        key="auth_changed",
        title="Authentication / authorization change",
        patterns=(
            "backend/app/api/auth.py",
            "backend/app/core/auth.py",
            "backend/app/schemas/auth.py",
            "backend/app/services/auth_service.py",
        ),
        risk="R3",
        why="Authentication and authorization are high-risk protected areas.",
        how_to_fix=(
            "Require explicit approval, run auth/permission regression checks, and attach evidence "
            "before merging."
        ),
        docs=(DOCS["governance"], DOCS["test"], DOCS["ledger"]),
    ),
    Rule(
        key="payroll_changed",
        title="Payroll semantic path change",
        patterns=(
            "backend/app/api/payroll_phase2.py",
            "backend/app/services/payroll_phase2_service.py",
            "backend/app/schemas/payroll_phase2.py",
        ),
        risk="R3",
        why="Payroll-related changes can affect financial meaning and require stronger review.",
        how_to_fix=(
            "Require explicit approval, verify representative seed cases, and document rollback or stop conditions."
        ),
        docs=(DOCS["governance"], DOCS["test"], DOCS["ledger"]),
    ),
    Rule(
        key="deploy_changed",
        title="Deploy / infra path change",
        patterns=(
            ".github/workflows/deploy.yml",
            "docker-compose.deploy.yml",
            "backend/Dockerfile",
            "frontend/Dockerfile",
        ),
        risk="R3",
        why="Deploy and infra changes directly affect the current main-based operating flow.",
        how_to_fix=(
            "Require explicit approval, describe main impact, and prepare a health-check or rollback note."
        ),
        docs=(DOCS["governance"], DOCS["ledger"]),
    ),
)


def normalize(path: str) -> str:
    return path.replace("\\", "/")


def match_any(path: str, patterns: Iterable[str]) -> bool:
    path = normalize(path)
    return any(fnmatch.fnmatch(path, pattern) for pattern in patterns)


def git(*args: str) -> str:
    result = subprocess.run(["git", *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git command failed")
    return result.stdout.strip()


def resolve_base_head(base: str | None, head: str | None) -> tuple[str, str]:
    resolved_head = head or git("rev-parse", "HEAD")
    resolved_base = base
    if not resolved_base:
        try:
            resolved_base = git("merge-base", "HEAD", "origin/main")
        except Exception:
            resolved_base = git("rev-parse", f"{resolved_head}~1")
    return resolved_base, resolved_head


def changed_files(base: str, head: str) -> list[str]:
    output = git("diff", "--name-only", base, head)
    if not output:
        return []
    return [normalize(line) for line in output.splitlines() if line.strip()]


def write_output(path: str | None, key: str, value: str) -> None:
    if not path:
        return
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"{key}={value}\n")


def gha_warning(message: str) -> None:
    if os.environ.get("GITHUB_ACTIONS") == "true":
        print(f"::warning::{message}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Classify changed files by governance-sensitive paths")
    parser.add_argument("--base", help="Base git ref/sha", default=None)
    parser.add_argument("--head", help="Head git ref/sha", default=None)
    parser.add_argument("--github-output", help="Path to GitHub Actions output file", default=None)
    parser.add_argument(
        "--fail-on-r3",
        action="store_true",
        help="Exit non-zero when any R3 path is changed. Default is warning-only.",
    )
    args = parser.parse_args()

    try:
        base, head = resolve_base_head(args.base, args.head)
        files = changed_files(base, head)
    except Exception as exc:
        print(f"[error] failed to classify changed files: {exc}", file=sys.stderr)
        return 2

    backend_changed = any(match_any(path, ("backend/**",)) for path in files)

    hits: dict[str, list[str]] = {rule.key: [] for rule in RULES}
    for path in files:
        for rule in RULES:
            if match_any(path, rule.patterns):
                hits[rule.key].append(path)

    r3_changed = bool(hits["auth_changed"] or hits["payroll_changed"] or hits["deploy_changed"])

    print("# Risk Path Classification")
    print(f"- Base: {base}")
    print(f"- Head: {head}")
    print(f"- Changed file count: {len(files)}")
    print()

    if files:
        print("## Changed Files")
        for path in files:
            print(f"- {path}")
        print()
    else:
        print("## Changed Files")
        print("- none")
        print()

    print("## Rule Summary")
    for rule in RULES:
        matched = hits[rule.key]
        status = "true" if matched else "false"
        print(f"- {rule.key}: {status}")
        if matched:
            print(f"  - title: {rule.title}")
            print(f"  - risk: {rule.risk}")
            print(f"  - matched paths: {', '.join(matched)}")
            print(f"  - why: {rule.why}")
            print(f"  - how to fix: {rule.how_to_fix}")
            print(f"  - docs: {', '.join(rule.docs)}")
            gha_warning(
                f"{rule.title} detected ({rule.risk}). Why: {rule.why} How to fix: {rule.how_to_fix} Docs: {', '.join(rule.docs)}"
            )
    print(f"- backend_changed: {'true' if backend_changed else 'false'}")
    print(f"- r3_changed: {'true' if r3_changed else 'false'}")

    write_output(args.github_output, "grid_changed", str(bool(hits["grid_changed"])).lower())
    write_output(args.github_output, "permission_changed", str(bool(hits["permission_changed"])).lower())
    write_output(args.github_output, "auth_changed", str(bool(hits["auth_changed"])).lower())
    write_output(args.github_output, "payroll_changed", str(bool(hits["payroll_changed"])).lower())
    write_output(args.github_output, "deploy_changed", str(bool(hits["deploy_changed"])).lower())
    write_output(args.github_output, "backend_changed", str(bool(backend_changed)).lower())
    write_output(args.github_output, "r3_changed", str(bool(r3_changed)).lower())

    if args.fail_on_r3 and r3_changed:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
