#!/usr/bin/env python3
"""Fail-closed UI gate for a clean, exact deployment SHA. No browser runs here."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

REPO = "qoxmfaktmxj/vibe-hr"
WORKFLOW = ".github/workflows/ui-validation.yml"
ROOT = Path(__file__).resolve().parents[2]


def api(path):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "vibehr-ui-gate",
               "X-GitHub-Api-Version": "2022-11-28"}
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request("https://api.github.com/repos/" + REPO + path, headers=headers)
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def select_run(runs, sha):
    candidates = [r for r in runs if r.get("head_sha") == sha
                  and r.get("head_branch") == "main"
                  and r.get("event") in ("push", "workflow_dispatch")
                  and r.get("path") == WORKFLOW
                  and (r.get("head_repository") or {}).get("full_name") == REPO]
    return max(candidates, key=lambda r: (r["id"], r.get("run_attempt", 1)), default=None)


def local_revision(sha):
    def git(*args):
        return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()
    if git("rev-parse", "HEAD") != sha:
        raise RuntimeError("checkout changed or does not match requested deployment SHA")
    if git("status", "--porcelain", "--untracked-files=normal"):
        raise RuntimeError("working tree is dirty; CI does not certify local modifications")


def wait_for_ui(sha, wait_seconds):
    deadline = time.monotonic() + wait_seconds
    while True:
        local_revision(sha)
        query = urllib.parse.urlencode({"head_sha": sha, "branch": "main", "per_page": 100})
        try:
            data = api("/actions/workflows/ui-validation.yml/runs?" + query)
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise RuntimeError(f"GitHub API HTTP {error.code}; credentials/rate limit/Actions access must be checked") from None
            data = {"workflow_runs": []}
        run = select_run(data["workflow_runs"], sha)
        if run and run["status"] == "completed":
            if run.get("conclusion") != "success":
                raise RuntimeError(f"UI CI {run.get('conclusion')}: {run['html_url']}")
            jobs = api(f"/actions/runs/{run['id']}/attempts/{run.get('run_attempt', 1)}/jobs?per_page=100")["jobs"]
            if not any(j.get("name") == "ui-regression" and j.get("conclusion") == "success" for j in jobs):
                raise RuntimeError("required ui-regression job did not succeed")
            local_revision(sha)
            print(json.dumps({"sha": sha, "run_id": run["id"], "attempt": run.get("run_attempt", 1),
                              "conclusion": "success", "url": run["html_url"]}), flush=True)
            return
        if time.monotonic() >= deadline:
            raise RuntimeError("same-SHA UI CI missing/pending; deployment blocked (no local browser fallback)")
        print(f"Waiting for UI CI sha={sha} status={run['status'] if run else 'missing'}", file=sys.stderr, flush=True)
        time.sleep(min(30, max(0, deadline - time.monotonic())))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--wait-seconds", type=int, default=1200)
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.sha) or not 0 <= args.wait_seconds <= 3600:
        parser.error("full lowercase SHA and wait-seconds 0..3600 required")
    try:
        wait_for_ui(args.sha, args.wait_seconds)
    except (RuntimeError, OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"UI GATE BLOCKED: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
