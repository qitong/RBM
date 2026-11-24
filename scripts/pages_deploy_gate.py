#!/usr/bin/env python3
"""Decide whether the synthetic GitHub Pages demo may be published.

The deploy workflow calls this script. Publishing is allowed only when the CI
workflow's push run for the exact current main commit completed with every job
successful. A failed, cancelled, skipped, empty, or stale result is refused.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.request
from dataclasses import dataclass

REQUIRED_JOBS = ("backend", "frontend")
CI_WORKFLOW = "CI"
SHA_RE = re.compile(r"^[0-9a-fA-F]{40}$")
REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


@dataclass(frozen=True)
class JobFact:
    name: str
    status: str
    conclusion: str


@dataclass(frozen=True)
class RunFact:
    name: str
    event: str
    head_branch: str
    head_sha: str
    status: str
    conclusion: str
    created_at: str
    run_number: int
    jobs: tuple[JobFact, ...]


def is_sha(value: str) -> bool:
    return bool(SHA_RE.fullmatch(value or ""))


def same_sha(expected: str, remote: str) -> bool:
    if not is_sha(expected) or not is_sha(remote):
        return False
    return expected.lower() == remote.lower()


def decide(*, trigger: str, ref: str, main_sha: str, run: RunFact | None) -> tuple[bool, str]:
    """Return whether this trigger may publish, and a stable reason code."""
    if trigger not in {"workflow_run", "workflow_dispatch"}:
        return False, "unexpected_trigger"
    if ref != "refs/heads/main":
        return False, "not_main_ref"
    if not is_sha(main_sha):
        return False, "main_sha_missing"
    if run is None:
        return False, "ci_run_missing"
    if run.name != CI_WORKFLOW:
        return False, "not_ci_workflow"
    if run.event != "push":
        return False, "not_push_event"
    if run.head_branch != "main":
        return False, "not_main_branch"
    if not same_sha(run.head_sha, main_sha):
        return False, "stale_sha"
    if run.status != "completed":
        return False, "ci_not_completed"
    if run.conclusion != "success":
        return False, f"ci_{run.conclusion or 'missing'}"
    if not run.jobs:
        return False, "ci_jobs_missing"
    for job in run.jobs:
        if job.status != "completed" or job.conclusion != "success":
            return False, f"job_{job.name or 'unnamed'}_{job.conclusion or job.status or 'missing'}"
    names = {job.name for job in run.jobs}
    missing = [name for name in REQUIRED_JOBS if name not in names]
    if missing:
        return False, "required_job_missing"
    return True, "ci_success_on_current_main"


def newest_push_run(runs: list[RunFact]) -> RunFact | None:
    """Pick the newest main push of CI. An older success does not override it."""
    pushes = [
        run for run in runs
        if run.name == CI_WORKFLOW and run.event == "push" and run.head_branch == "main"
    ]
    if not pushes:
        return None
    return max(pushes, key=lambda run: (run.created_at, run.run_number))


def parse_ls_remote(text: str) -> str:
    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) != 1:
        raise SystemExit("main ref missing")
    sha, ref = lines[0].split()
    if ref != "refs/heads/main" or not is_sha(sha):
        raise SystemExit("main ref unreadable")
    return sha


def remote_main_sha(repository: str) -> str:
    if not REPO_RE.fullmatch(repository or ""):
        raise SystemExit("repository name refused")
    output = subprocess.check_output(
        ["git", "ls-remote", f"https://github.com/{repository}.git", "refs/heads/main"],
        text=True,
    )
    return parse_ls_remote(output)


def _request_json(url: str, token: str):
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "rbm-pages-gate",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
        return payload, response.headers.get("Link", "")


def _next_link(link_header: str) -> str | None:
    for part in link_header.split(","):
        if 'rel="next"' in part:
            return part.split(";")[0].strip().strip("<>")
    return None


def _get_all(url: str, token: str, key: str) -> list[dict]:
    items: list[dict] = []
    while url:
        payload, link = _request_json(url, token)
        batch = payload.get(key, [])
        if not isinstance(batch, list):
            raise SystemExit(f"{key} unreadable")
        items.extend(batch)
        url = _next_link(link)
    return items


def _job_fact(raw: dict) -> JobFact:
    return JobFact(
        name=str(raw.get("name") or ""),
        status=str(raw.get("status") or ""),
        conclusion=str(raw.get("conclusion") or ""),
    )


def _run_fact(raw: dict, jobs: tuple[JobFact, ...]) -> RunFact:
    return RunFact(
        name=str(raw.get("name") or ""),
        event=str(raw.get("event") or ""),
        head_branch=str(raw.get("head_branch") or ""),
        head_sha=str(raw.get("head_sha") or ""),
        status=str(raw.get("status") or ""),
        conclusion=str(raw.get("conclusion") or ""),
        created_at=str(raw.get("created_at") or ""),
        run_number=int(raw.get("run_number") or 0),
        jobs=jobs,
    )


def load_run(repository: str, run_id: str, token: str) -> RunFact:
    raw, _ = _request_json(
        f"https://api.github.com/repos/{repository}/actions/runs/{run_id}",
        token,
    )
    jobs = tuple(
        _job_fact(item)
        for item in _get_all(
            f"https://api.github.com/repos/{repository}/actions/runs/{run_id}/jobs?per_page=100",
            token,
            "jobs",
        )
    )
    return _run_fact(raw, jobs)


def load_push_runs(repository: str, sha: str, token: str) -> list[RunFact]:
    raw_runs = _get_all(
        "https://api.github.com/repos/"
        f"{repository}/actions/workflows/ci.yml/runs?head_sha={sha}&branch=main&event=push&per_page=20",
        token,
        "workflow_runs",
    )
    loaded: list[RunFact] = []
    for raw in raw_runs:
        jobs: tuple[JobFact, ...] = ()
        if raw.get("status") == "completed":
            jobs = tuple(
                _job_fact(item)
                for item in _get_all(
                    f"https://api.github.com/repos/{repository}/actions/runs/{raw['id']}/jobs?per_page=100",
                    token,
                    "jobs",
                )
            )
        loaded.append(_run_fact(raw, jobs))
    return loaded


def write_sha_output(sha: str) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(f"sha={sha.lower()}\n")


def decide_live() -> int:
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    token = os.environ.get("GH_TOKEN", "")
    trigger = os.environ.get("EVENT_NAME", "")
    ref = os.environ.get("THIS_REF", "")
    if not token or not REPO_RE.fullmatch(repository or ""):
        print("repository or token missing", file=sys.stderr)
        return 1
    main_sha = remote_main_sha(repository)
    if trigger == "workflow_run":
        run_id = os.environ.get("WORKFLOW_RUN_ID", "")
        if not run_id.isdigit():
            print("ci_run_missing", file=sys.stderr)
            return 1
        run = load_run(repository, run_id, token)
    elif trigger == "workflow_dispatch":
        run = newest_push_run(load_push_runs(repository, main_sha, token))
    else:
        print("unexpected_trigger", file=sys.stderr)
        return 1
    allowed, reason = decide(trigger=trigger, ref=ref, main_sha=main_sha, run=run)
    print(reason)
    if not allowed:
        return 1
    write_sha_output(main_sha)
    return 0


def assert_main() -> int:
    expected = os.environ.get("EXPECTED_SHA", "")
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    remote = remote_main_sha(repository)
    if not same_sha(expected, remote):
        print("stale_sha", file=sys.stderr)
        return 1
    print("main_unchanged")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] not in {"decide-live", "assert-main"}:
        print("usage: pages_deploy_gate.py decide-live|assert-main", file=sys.stderr)
        return 2
    if argv[1] == "decide-live":
        return decide_live()
    return assert_main()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
