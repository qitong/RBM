import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.rbqm.service import CLOSE_FIELDS, RbqmError, reset_store
from src.rbqm.study_candidate import exceeds_action, fold_exceedances, observation_identity, site_rule
from src.rbqm.synthetic import STUDY_ID

client = TestClient(app)

CANDIDATE = "CAND-SYN-SITE-101-informed_consent_sd"


@pytest.fixture(autouse=True)
def _fresh_store():
    reset_store()
    yield
    reset_store()


def _obs(site: str = "SYN-SITE-101", value: float = 3.5, metric: str = "informed_consent_sd", **extra):
    row = {
        "studyId": STUDY_ID,
        "siteId": site,
        "metric": metric,
        "value": value,
        "observedAt": "2026-11-02",
    }
    row.update(extra)
    return row


def _post(*rows: dict):
    return client.post("/api/rbqm/site-exceedances", json={
        "operator": "中央监查员-合成",
        "observations": list(rows),
    })


def _qtl_ids() -> list[str]:
    risks = client.get("/api/rbqm/risks").json()["data"]
    return [item["id"] for item in risks if item["scope"] == "study_qtl"]


def _view() -> dict:
    return client.get("/api/rbqm/study-candidates").json()["data"]


def test_module_counts_only_repeated_action_crossings():
    rule = {
        "scope": "site_kri",
        "metric": "informed_consent_sd",
        "unit": "SD",
        "actionThreshold": 3,
        "configVersion": "v1",
    }
    assert exceeds_action(3, rule) is True
    assert exceeds_action(-3, rule) is True
    assert exceeds_action(2.5, rule) is False
    proportion = {**rule, "metric": "synthetic_rate", "unit": "proportion", "actionThreshold": 0.125}
    assert exceeds_action(0.125, proportion) is True
    assert exceeds_action(-1, proportion) is False
    candidates: list[dict] = []
    counts: dict[str, int] = {}
    seen: set[str] = set()
    rules = [rule, proportion]
    assert fold_exceedances(candidates, counts, rules, [_obs(value=2.5), _obs(value=2.9)], seen) == []
    assert candidates == []
    same = _obs(value=3.5)
    assert fold_exceedances(candidates, counts, rules, [same, same], seen) == []
    assert fold_exceedances(candidates, counts, rules, [same], seen) == []
    assert candidates == []
    created = fold_exceedances(candidates, counts, rules, [_obs(value=-3.2), _obs(value=4)], seen)
    assert created == [CANDIDATE]
    assert len(candidates) == 1
    assert candidates[0]["status"] == "pending_confirmation"
    assert candidates[0]["exceedanceCount"] == 3
    assert candidates[0]["riskId"] is None
    assert fold_exceedances(candidates, counts, rules, [_obs(value=8)], seen) == []
    assert len(candidates) == 1
    other = fold_exceedances(candidates, counts, rules, [_obs(site="SYN-SITE-102", value=3.1), _obs(site="SYN-SITE-102", value=3.4)], seen)
    assert other == ["CAND-SYN-SITE-102-informed_consent_sd"]
    assert len(candidates) == 2
    with pytest.raises(RbqmError) as ambiguous:
        site_rule([rule, {**rule}], "informed_consent_sd")
    assert ambiguous.value.code == "AMBIGUOUS_SITE_RULE"


def test_single_crossing_does_not_open_a_candidate_or_a_qtl():
    before = client.get("/api/rbqm/risks").json()["data"]
    response = _post(_obs())
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["isSynthetic"] is True
    assert body["data"]["createdCandidateIds"] == []
    assert body["data"]["pending"] == []
    assert body["data"]["studyLevel"] == []
    assert body["data"]["studyQtlIds"] == ["RSK-QTL-001"]
    assert client.get("/api/rbqm/risks").json()["data"] == before


def test_replaying_one_observation_does_not_open_a_candidate():
    row = _obs(value=3.5)
    before = client.get("/api/rbqm/risks").json()["data"]
    first = _post(row)
    second = _post(row)
    duplicated = _post(row, row)
    assert first.status_code == second.status_code == duplicated.status_code == 200
    for response in (first, second, duplicated):
        assert response.json()["data"]["createdCandidateIds"] == []
        assert response.json()["data"]["pending"] == []
        assert response.json()["data"]["studyLevel"] == []
        assert response.json()["data"]["studyQtlIds"] == ["RSK-QTL-001"]
    assert client.get("/api/rbqm/risks").json()["data"] == before
    distinct = _post(_obs(value=3.5, observedAt="2026-11-18"))
    assert distinct.json()["data"]["createdCandidateIds"] == [CANDIDATE]
    assert distinct.json()["data"]["pending"][0]["exceedanceCount"] == 2
    assert distinct.json()["data"]["studyLevel"] == []
    assert _qtl_ids() == ["RSK-QTL-001"]


def test_nearby_floats_above_the_bound_are_not_one_replay():
    low = _obs(value=3.000000000001)
    high = _obs(value=3.000000000002)
    assert observation_identity(low) != observation_identity(high)
    assert format(3.000000000001, ".12g") == format(3.000000000002, ".12g")
    before = client.get("/api/rbqm/risks").json()["data"]
    opened = _post(low, high)
    assert opened.status_code == 200, opened.text
    data = opened.json()["data"]
    assert data["createdCandidateIds"] == [CANDIDATE]
    assert data["pending"][0]["exceedanceCount"] == 2
    assert data["pending"][0]["status"] == "pending_confirmation"
    assert data["studyLevel"] == []
    assert data["studyQtlIds"] == ["RSK-QTL-001"]
    assert client.get("/api/rbqm/risks").json()["data"] == before
    replay = _post(low, high)
    assert replay.json()["data"]["createdCandidateIds"] == []
    assert [item["id"] for item in replay.json()["data"]["pending"]] == [CANDIDATE]
    assert replay.json()["data"]["pending"][0]["exceedanceCount"] == 2
    assert replay.json()["data"]["studyLevel"] == []
    assert _qtl_ids() == ["RSK-QTL-001"]


def test_repeated_crossing_opens_one_pending_candidate_until_a_person_confirms():
    before = _qtl_ids()
    opened = _post(_obs(value=3.5), _obs(value=3.8, observedAt="2026-11-09"))
    assert opened.status_code == 200, opened.text
    data = opened.json()["data"]
    assert data["createdCandidateIds"] == [CANDIDATE]
    assert [item["id"] for item in data["pending"]] == [CANDIDATE]
    assert data["pending"][0]["exceedanceCount"] == 2
    assert data["pending"][0]["scope"] == "study_candidate"
    assert data["studyLevel"] == []
    assert data["studyQtlIds"] == before

    again = _post(_obs(value=-3.4, observedAt="2026-11-16"))
    assert again.json()["data"]["createdCandidateIds"] == []
    assert [item["id"] for item in again.json()["data"]["pending"]] == [CANDIDATE]
    assert again.json()["data"]["pending"][0]["exceedanceCount"] == 3
    assert again.json()["data"]["studyLevel"] == []
    assert _qtl_ids() == before
    risks = client.get("/api/rbqm/risks").json()["data"]
    assert all(item["scope"] != "study_candidate" for item in risks)
    assert CANDIDATE not in {item["id"] for item in risks}

    second_site = _post(_obs(site="SYN-SITE-105", value=3.2), _obs(site="SYN-SITE-105", value=3.6, observedAt="2026-11-20"))
    assert [item["id"] for item in second_site.json()["data"]["pending"]] == [
        CANDIDATE,
        "CAND-SYN-SITE-105-informed_consent_sd",
    ]
    assert second_site.json()["data"]["studyLevel"] == []
    assert _qtl_ids() == before


def test_confirmation_moves_the_candidate_and_still_does_not_create_a_qtl():
    _post(_obs(value=3.1), _obs(value=3.2, observedAt="2026-11-03"))
    before_risks = client.get("/api/rbqm/risks").json()["data"]
    confirmed = client.post(f"/api/rbqm/study-candidates/{CANDIDATE}/confirm", json={
        "operator": "合成质量负责人",
    })
    assert confirmed.status_code == 200, confirmed.text
    data = confirmed.json()["data"]
    assert data["pending"] == []
    assert [item["id"] for item in data["studyLevel"]] == [CANDIDATE]
    assert data["studyLevel"][0]["status"] == "confirmed"
    assert data["studyLevel"][0]["riskId"] is None
    assert data["studyQtlIds"] == ["RSK-QTL-001"]
    assert client.get("/api/rbqm/risks").json()["data"] == before_risks
    repeat = client.post(f"/api/rbqm/study-candidates/{CANDIDATE}/confirm", json={
        "operator": "合成质量负责人",
    })
    assert [item["id"] for item in repeat.json()["data"]["studyLevel"]] == [CANDIDATE]
    assert client.get("/api/rbqm/risks").json()["data"] == before_risks


def test_close_guard_is_unchanged_after_a_candidate_exists():
    assert CLOSE_FIELDS == ("rootCause", "assignee", "effectivenessNote")
    _post(_obs(value=4), _obs(value=4, observedAt="2026-11-04"))
    response = client.post("/api/rbqm/risks/RSK-QTL-001/transitions", json={
        "toStatus": "Closed",
        "operator": "中央监查员-合成",
    })
    assert response.status_code == 422
    assert response.json()["code"] == "CLOSE_GUARD"
    assert set(response.json()["missing"]) == {"rootCause", "assignee", "effectivenessNote"}
    assert client.get("/api/rbqm/risks/RSK-QTL-001").json()["data"]["risk"]["status"] == "Detected"
    assert _view()["pending"][0]["status"] == "pending_confirmation"
    assert _view()["studyLevel"] == []


def test_rejections_leave_the_candidate_list_empty(tmp_path, monkeypatch):
    plan = tmp_path / "plan.json"
    plan.write_text('{"keep":"ctq"}', encoding="utf-8")
    monkeypatch.setenv("RBM_CTQ_STORE", str(plan))

    def boom(*_args, **_kwargs):
        raise AssertionError("ctq store consulted")

    monkeypatch.setattr("src.ctq.service.get_active", boom)
    warning = _post(_obs(value=2.0), _obs(value=2.4, observedAt="2026-11-05"))
    assert warning.json()["data"]["pending"] == []
    blinded = _post(_obs(value=3.5), _obs(value=3.6, blindingSensitive=True))
    assert blinded.status_code == 422
    assert blinded.json()["code"] == "BLINDING_BLOCKED"
    missing = _post(_obs(metric="important_pd_proportion", value=0.2))
    assert missing.status_code == 422
    assert missing.json()["code"] == "SITE_RULE_MISSING"
    mixed = _post(_obs(value=9), _obs(site="SYN-SITE-999", value=9))
    assert mixed.status_code == 422
    assert mixed.json()["code"] == "OBSERVATION_INVALID"
    assert _view()["pending"] == []
    assert _view()["studyLevel"] == []
    assert _qtl_ids() == ["RSK-QTL-001"]
    assert plan.read_text(encoding="utf-8") == '{"keep":"ctq"}'
