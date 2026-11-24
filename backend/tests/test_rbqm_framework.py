import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.rbqm.service import Store, reset_store
from src.rbqm.synthetic import DISCLAIMER, screen_batch, site_comparison

client = TestClient(app)

HAPPY_STEPS = [
    ("Under_RCA", {"rootCause": "合成根因：签署顺序与筛选检查颠倒。"}),
    ("Action_In_Progress", {
        "assignee": "合成CRA-甲",
        "dueDate": "2026-12-15",
        "actionSummary": "合成中心复训签署顺序。",
    }),
    ("Effectiveness_Check", {}),
    ("Closed", {"effectivenessNote": "合成复核：随后两周未再超限。"}),
]


@pytest.fixture(autouse=True)
def _fresh_store():
    reset_store()
    yield
    reset_store()


def _walk(risk_id: str = "RSK-KRI-101") -> None:
    for status, fields in HAPPY_STEPS:
        response = client.post(f"/api/rbqm/risks/{risk_id}/transitions", json={
            "toStatus": status,
            "operator": "中央监查员-合成",
            "operatorRole": "central_monitor",
            **fields,
        })
        assert response.status_code == 200, response.text


def test_detected_signal_is_reproducible():
    first = Store().snapshot()
    second = Store().snapshot()
    assert first == second
    risk = next(item for item in first["risks"] if item["id"] == "RSK-KRI-101")
    assert risk["status"] == "Detected"
    assert risk["metricValue"] == 3.5
    assert risk["configVersion"] == "v1"
    assert risk["scope"] == "site_kri"
    study = next(item for item in first["risks"] if item["id"] == "RSK-QTL-001")
    assert study["scope"] == "study_qtl"
    assert first["inputBatchHash"] == second["inputBatchHash"]
    left = site_comparison()
    right = site_comparison()
    assert left == right


def test_happy_path_keeps_an_audit_chain():
    _walk()
    body = client.get("/api/rbqm/risks/RSK-KRI-101").json()
    assert body["isSynthetic"] is True
    assert body["dataSourceMode"] == "synthetic"
    assert body["disclaimer"] == DISCLAIMER
    assert body["configVersion"] == "v1"
    assert body["inputBatchHash"]
    assert body["fallbackActive"] is False
    detail = body["data"]
    assert detail["risk"]["status"] == "Closed"
    audits = detail["audits"]
    transitions = [item for item in audits if item["type"] == "TRANSITION" and item["fromStatus"]]
    assert [item["toStatus"] for item in transitions] == [
        "Under_RCA",
        "Action_In_Progress",
        "Effectiveness_Check",
        "Closed",
    ]
    for item in transitions:
        assert item["configVersion"] == "v1"
        assert item["actorName"] == "中央监查员-合成"
        assert item["at"]
        assert item["inputBatchHash"] == body["inputBatchHash"]
        assert item["before"]["status"] != item["after"]["status"]
    assert transitions[-1]["taskId"] == "TASK-RSK-KRI-101"
    assert transitions[-1]["capaId"] == "CAPA-RSK-KRI-101"
    again = Store().snapshot()
    original = next(item for item in again["risks"] if item["id"] == "RSK-KRI-101")
    assert original["status"] == "Detected"


def test_skip_close_is_rejected_and_status_stays():
    before = client.get("/api/rbqm/risks/RSK-KRI-101").json()["data"]
    response = client.post("/api/rbqm/risks/RSK-KRI-101/transitions", json={
        "toStatus": "Closed",
        "operator": "中央监查员-合成",
    })
    assert response.status_code == 422
    body = response.json()
    assert body["ok"] is False
    assert body["code"] == "CLOSE_GUARD"
    assert body["status"] == "Detected"
    assert set(body["missing"]) == {"rootCause", "assignee", "effectivenessNote"}
    assert "状态保持 Detected" in body["message"]
    after = client.get("/api/rbqm/risks/RSK-KRI-101").json()["data"]
    assert after["risk"]["status"] == "Detected"
    assert after["audits"] == before["audits"]

    _walk_until_check()
    rejected = client.post("/api/rbqm/risks/RSK-KRI-101/transitions", json={
        "toStatus": "Closed",
        "operator": "中央监查员-合成",
        "effectivenessNote": "   ",
    })
    assert rejected.status_code == 422
    assert rejected.json()["missing"] == ["effectivenessNote"]
    stayed = client.get("/api/rbqm/risks/RSK-KRI-101").json()["data"]["risk"]
    assert stayed["status"] == "Effectiveness_Check"


def test_invalid_threshold_does_not_change_version():
    response = client.post("/api/rbqm/thresholds", json={
        "operator": "合成质量员甲",
        "rules": [{
            "scope": "site_kri",
            "ctqId": "CTQ-ICF",
            "metric": "informed_consent_sd",
            "dimension": "INFORMED CONSENT",
            "unit": "SD",
            "warningThreshold": 4,
            "actionThreshold": 3,
            "weight": -1,
            "rationale": "合成反例",
        }],
    })
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "THRESHOLD_INVALID"
    assert body["configVersion"] == "v1"
    codes = {item["code"] for item in body["fieldErrors"]}
    assert codes == {"THRESHOLD_ORDER", "NEGATIVE_WEIGHT"}
    current = client.get("/api/rbqm/thresholds").json()
    assert current["configVersion"] == "v1"
    assert len(current["data"]["versions"]) == 1


def test_contract_marks_synthetic_and_comparison_is_stable():
    study = client.get("/api/rbqm/study").json()
    assert study["isSynthetic"] is True
    assert study["disclaimer"] == DISCLAIMER
    assert study["fallbackActive"] is False
    assert study["data"]["study"]["studyId"] == "SYN-STUDY-001"
    scopes = {rule["scope"] for rule in study["data"]["rules"]}
    assert scopes == {"site_kri", "study_qtl"}
    comparison = client.get("/api/rbqm/sites/comparison").json()
    assert comparison["isSynthetic"] is True
    assert comparison["data"]["seed"] == 42
    assert comparison["data"]["points"][0]["siteId"].startswith("SYN-SITE-")
    assert comparison["data"] == client.get("/api/rbqm/sites/comparison").json()["data"]
    with pytest.raises(ValueError, match="BLINDING_BLOCKED"):
        screen_batch([{"blindingSensitive": True}])


def _walk_until_check() -> None:
    for status, fields in HAPPY_STEPS[:-1]:
        response = client.post("/api/rbqm/risks/RSK-KRI-101/transitions", json={
            "toStatus": status,
            "operator": "中央监查员-合成",
            "operatorRole": "central_monitor",
            **fields,
        })
        assert response.status_code == 200, response.text
