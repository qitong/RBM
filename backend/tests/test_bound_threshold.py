"""Bound historical threshold version: module lookup and public risk API."""

from fastapi.testclient import TestClient

from src.api.main import app
from src.rbqm.bound_threshold import resolve_bound_threshold
from src.rbqm.service import reset_store

client = TestClient(app)

HISTORICAL = {
    "configVersion": "v1",
    "studyId": "SYN-STUDY-001",
    "rules": [
        {
            "thresholdId": "THR-KRI-ICF-V1",
            "configVersion": "v1",
            "scope": "site_kri",
            "metric": "informed_consent_sd",
            "unit": "SD",
            "warningThreshold": 2.0,
            "actionThreshold": 3.0,
        }
    ],
}
CURRENT = {
    "configVersion": "v2",
    "studyId": "SYN-STUDY-001",
    "rules": [
        {
            "thresholdId": "THR-KRI-ICF-V2",
            "configVersion": "v2",
            "scope": "site_kri",
            "metric": "informed_consent_sd",
            "unit": "SD",
            "warningThreshold": 1.25,
            "actionThreshold": 4.5,
        }
    ],
}
OTHER_STUDY = {
    "configVersion": "v1",
    "studyId": "SYN-STUDY-009",
    "rules": [
        {
            "thresholdId": "THR-KRI-ICF-OTHER",
            "configVersion": "v1",
            "scope": "site_kri",
            "metric": "informed_consent_sd",
            "unit": "SD",
            "warningThreshold": 8.0,
            "actionThreshold": 9.0,
        }
    ],
}
RISK = {
    "id": "RSK-KRI-101",
    "studyId": "SYN-STUDY-001",
    "scope": "site_kri",
    "metric": "informed_consent_sd",
    "configVersion": "v1",
}


def setup_function():
    reset_store()


def teardown_function():
    reset_store()


def test_module_returns_the_bound_historical_rule_not_the_latest():
    bound = resolve_bound_threshold(RISK, [CURRENT, OTHER_STUDY, HISTORICAL])
    assert bound == {
        "traceable": True,
        "configVersion": "v1",
        "studyId": "SYN-STUDY-001",
        "unit": "SD",
        "warningThreshold": 2.0,
        "actionThreshold": 3.0,
        "thresholdId": "THR-KRI-ICF-V1",
    }


def test_module_missing_version_is_untraceable():
    bound = resolve_bound_threshold({**RISK, "configVersion": "v0"}, [CURRENT, HISTORICAL, OTHER_STUDY])
    assert bound == {"traceable": False, "label": "无法溯源"}


def test_module_wrong_study_does_not_use_another_approved_version():
    bound = resolve_bound_threshold({**RISK, "studyId": "SYN-STUDY-002"}, [OTHER_STUDY, HISTORICAL, CURRENT])
    assert bound == {"traceable": False, "label": "无法溯源"}
    assert "8.0" not in str(bound)
    assert "9.0" not in str(bound)


def test_module_ambiguous_or_missing_rule_is_untraceable():
    duplicate = {**HISTORICAL, "rules": HISTORICAL["rules"] + HISTORICAL["rules"]}
    assert resolve_bound_threshold(RISK, [HISTORICAL, HISTORICAL])["label"] == "无法溯源"
    assert resolve_bound_threshold(RISK, [duplicate])["label"] == "无法溯源"
    empty = {**HISTORICAL, "rules": []}
    assert resolve_bound_threshold(RISK, [empty])["label"] == "无法溯源"


def _version_rule(body: dict, version: str, study_id: str, metric: str) -> dict:
    found = next(
        item
        for item in body["data"]["versions"]
        if item["configVersion"] == version and item["studyId"] == study_id
    )
    return next(rule for rule in found["rules"] if rule["metric"] == metric)


def test_risk_api_matches_the_bound_version_record():
    detail = client.get("/api/rbqm/risks/RSK-KRI-101").json()
    listed = client.get("/api/rbqm/thresholds").json()
    rule = _version_rule(listed, "v1", "SYN-STUDY-001", "informed_consent_sd")
    bound = detail["data"]["boundThreshold"]
    assert bound["traceable"] is True
    assert bound["configVersion"] == "v1"
    assert bound["unit"] == rule["unit"]
    assert bound["warningThreshold"] == rule["warningThreshold"]
    assert bound["actionThreshold"] == rule["actionThreshold"]
    assert bound["thresholdId"] == rule["thresholdId"]
    qtl = client.get("/api/rbqm/risks/RSK-QTL-001").json()["data"]["boundThreshold"]
    qtl_rule = _version_rule(listed, "v1", "SYN-STUDY-001", "important_pd_proportion")
    assert qtl["unit"] == qtl_rule["unit"] == "proportion"
    assert qtl["warningThreshold"] == qtl_rule["warningThreshold"]
    assert qtl["actionThreshold"] == qtl_rule["actionThreshold"]


def test_risk_api_keeps_the_historical_binding_after_a_new_version():
    saved = client.post("/api/rbqm/thresholds", json={
        "operator": "合成质量员甲",
        "rules": [{
            "scope": "site_kri",
            "ctqId": "CTQ-ICF",
            "metric": "informed_consent_sd",
            "dimension": "INFORMED CONSENT",
            "unit": "SD",
            "warningThreshold": 1.25,
            "actionThreshold": 4.5,
            "weight": 0.25,
            "rationale": "合成新版本，不应覆盖已绑定的历史界限。",
        }],
    })
    assert saved.status_code == 200, saved.text
    detail = client.get("/api/rbqm/risks/RSK-KRI-101").json()
    assert detail["configVersion"] == "v2"
    bound = detail["data"]["boundThreshold"]
    assert bound["configVersion"] == "v1"
    assert bound["warningThreshold"] == 2.0
    assert bound["actionThreshold"] == 3.0
    assert detail["data"]["risk"]["configVersion"] == "v1"
    assert detail["data"]["risk"]["status"] == "Detected"


def test_risk_api_untraceable_cases_do_not_borrow_another_version():
    missing = client.get("/api/rbqm/risks/RSK-KRI-MISSING").json()["data"]["boundThreshold"]
    wrong = client.get("/api/rbqm/risks/RSK-KRI-WRONG-STUDY").json()["data"]["boundThreshold"]
    assert missing == {"traceable": False, "label": "无法溯源"}
    assert wrong == {"traceable": False, "label": "无法溯源"}
    listed = client.get("/api/rbqm/risks").json()["data"]
    by_id = {item["id"]: item["boundThreshold"] for item in listed}
    assert by_id["RSK-KRI-MISSING"] == missing
    assert by_id["RSK-KRI-WRONG-STUDY"] == wrong
    assert by_id["RSK-KRI-101"]["traceable"] is True
