import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "pages_deploy_gate", ROOT / "scripts" / "pages_deploy_gate.py"
)
gate = importlib.util.module_from_spec(SPEC)
sys.modules["pages_deploy_gate"] = gate
SPEC.loader.exec_module(gate)

MAIN = "a" * 40
OTHER = "b" * 40


def run_fact(**overrides):
    jobs = overrides.pop(
        "jobs",
        (
            gate.JobFact("backend", "completed", "success"),
            gate.JobFact("frontend", "completed", "success"),
        ),
    )
    payload = {
        "name": "CI",
        "event": "push",
        "head_branch": "main",
        "head_sha": MAIN,
        "status": "completed",
        "conclusion": "success",
        "created_at": "2026-11-24T14:00:00Z",
        "run_number": 10,
        "jobs": jobs,
    }
    payload.update(overrides)
    return gate.RunFact(**payload)


def test_current_main_push_with_both_jobs_may_publish():
    for trigger in ("workflow_run", "workflow_dispatch"):
        allowed, reason = gate.decide(
            trigger=trigger,
            ref="refs/heads/main",
            main_sha=MAIN.upper(),
            run=run_fact(),
        )
        assert allowed, reason
        assert reason == "ci_success_on_current_main"


def test_refused_conclusions_and_incomplete_runs():
    cases = []
    for conclusion in ("failure", "cancelled", "skipped", "timed_out", "neutral", "stale", "action_required", ""):
        cases.append(run_fact(conclusion=conclusion))
    cases.append(run_fact(status="in_progress", conclusion=""))
    cases.append(run_fact(status="queued", conclusion=""))
    for run in cases:
        allowed, reason = gate.decide(
            trigger="workflow_run", ref="refs/heads/main", main_sha=MAIN, run=run
        )
        assert not allowed
        assert reason != "ci_success_on_current_main"


def test_refused_when_any_job_is_not_success():
    for conclusion in ("failure", "cancelled", "skipped", "timed_out", ""):
        allowed, reason = gate.decide(
            trigger="workflow_dispatch",
            ref="refs/heads/main",
            main_sha=MAIN,
            run=run_fact(jobs=(
                gate.JobFact("backend", "completed", "success"),
                gate.JobFact("frontend", "completed", conclusion),
            )),
        )
        assert not allowed
        assert reason.startswith("job_frontend_")


def test_refused_when_required_job_is_absent_or_jobs_are_empty():
    for jobs in ((), (gate.JobFact("backend", "completed", "success"),)):
        allowed, reason = gate.decide(
            trigger="workflow_run", ref="refs/heads/main", main_sha=MAIN, run=run_fact(jobs=jobs)
        )
        assert not allowed
        assert reason in {"ci_jobs_missing", "required_job_missing"}


def test_refused_for_stale_wrong_event_or_missing_run():
    refusals = [
        gate.decide(trigger="push", ref="refs/heads/main", main_sha=MAIN, run=run_fact()),
        gate.decide(trigger="workflow_run", ref="refs/heads/feature", main_sha=MAIN, run=run_fact()),
        gate.decide(trigger="workflow_run", ref="refs/heads/main", main_sha="", run=run_fact()),
        gate.decide(trigger="workflow_run", ref="refs/heads/main", main_sha=MAIN, run=None),
        gate.decide(trigger="workflow_dispatch", ref="refs/heads/main", main_sha=MAIN, run=run_fact(name="Deploy Frontend to GitHub Pages")),
        gate.decide(trigger="workflow_run", ref="refs/heads/main", main_sha=MAIN, run=run_fact(event="pull_request")),
        gate.decide(trigger="workflow_run", ref="refs/heads/main", main_sha=MAIN, run=run_fact(head_branch="qitong/rbm-pages-gate")),
        gate.decide(trigger="workflow_run", ref="refs/heads/main", main_sha=MAIN, run=run_fact(head_sha=OTHER)),
    ]
    assert all(not allowed for allowed, _reason in refusals)
    assert [reason for _allowed, reason in refusals] == [
        "unexpected_trigger",
        "not_main_ref",
        "main_sha_missing",
        "ci_run_missing",
        "not_ci_workflow",
        "not_push_event",
        "not_main_branch",
        "stale_sha",
    ]


def test_newer_failed_push_hides_an_older_success():
    older = run_fact(created_at="2026-11-24T14:00:00Z", run_number=10)
    newer = run_fact(created_at="2026-11-24T15:00:00Z", run_number=11, conclusion="failure")
    pull = run_fact(event="pull_request", created_at="2026-11-24T16:00:00Z", run_number=12)
    chosen = gate.newest_push_run([older, pull, newer])
    assert chosen is newer
    allowed, reason = gate.decide(
        trigger="workflow_dispatch", ref="refs/heads/main", main_sha=MAIN, run=chosen
    )
    assert not allowed
    assert reason == "ci_failure"
    assert gate.newest_push_run([pull]) is None


def test_sha_comparison_rejects_blank_and_short_values():
    assert gate.same_sha(MAIN, MAIN.upper())
    assert not gate.same_sha(MAIN, OTHER)
    assert not gate.same_sha(MAIN, "")
    assert not gate.same_sha("a" * 39, "a" * 39)
    assert gate.parse_ls_remote(f"{MAIN}\trefs/heads/main\n") == MAIN


def test_workflows_keep_the_gate_contract():
    ci = (ROOT / ".github/workflows/ci.yml").read_text()
    deploy = (ROOT / ".github/workflows/deploy.yml").read_text()
    assert ci.startswith("name: CI\n")
    assert "\n  backend:\n" in ci
    assert "\n  frontend:\n" in ci
    on_block, _, _rest = deploy.partition("permissions:")
    assert "workflow_run:" in on_block
    assert 'workflows: ["CI"]' in on_block
    assert "types: [completed]" in on_block
    assert "branches: [main]" in on_block
    assert "workflow_dispatch:" in on_block
    assert "\n  push:" not in on_block
    assert "pages_deploy_gate.py decide-live" in deploy
    assert deploy.count("pages_deploy_gate.py assert-main") == 3
    assert "ref: ${{ needs.gate.outputs.sha }}" in deploy
    assert "actions/deploy-pages@v4" in deploy
