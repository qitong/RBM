"""Read-only binding between one synthetic risk and its approved threshold version."""

from fastapi.testclient import TestClient

from src.api.main import app
from src.rbqm.service import reset_store

client = TestClient(app)


def setup_function() -> None:
    reset_store()


def teardown_function() -> None:
    reset_store()


def _versions() -> list[dict]:
    return client.get("/api/rbqm/thresholds").json()["data"]["versions"]


def _version_rule(config_version: str, study_id: str, metric: str) -> dict:
    version = next(
        item for item in _versions()
        if item["configVersion"] == config_version and item["studyId"] == study_id
    )
    return next(rule for rule in version["rules"] if rule["metric"] == metric)


def _risk(risk_id: str) -> dict:
    listed = client.get("/api/rbqm/risks").json()["data"]
    detail = client.get(f"/api/rbqm/risks/{risk_id}").json()["data"]["risk"]
    from_list = next(item for item in listed if item["id"] == risk_id)
    assert from_list["boundThreshold"] == detail["boundThreshold"]
    return detail


def test_bound_limits_match_the_historical_version_record():
    icf = _version_rule("v1", "SYN-STUDY-001", "informed_consent_sd")
    risk = _risk("RSK-KRI-101")
    assert risk["boundThreshold"] == {
        "traceable": True,
        "configVersion": "v1",
        "studyId": "SYN-STUDY-001",
        "unit": icf["unit"],
        "warningThreshold": icf["warningThreshold"],
        "actionThreshold": icf["actionThreshold"],
    }
    assert risk["boundThreshold"]["unit"] == "SD"
    assert risk["boundThreshold"]["warningThreshold"] == 2.0
    assert risk["boundThreshold"]["actionThreshold"] == 3.0

    proportion = _version_rule("v1", "SYN-STUDY-001", "important_pd_proportion")
    study_risk = _risk("RSK-QTL-001")
    assert study_risk["boundThreshold"]["unit"] == proportion["unit"] == "proportion"
    assert study_risk["boundThreshold"]["warningThreshold"] == proportion["warningThreshold"] == 0.0625
    assert study_risk["boundThreshold"]["actionThreshold"] == proportion["actionThreshold"] == 0.125


def test_a_newer_current_version_does_not_replace_the_binding():
    saved = client.post("/api/rbqm/thresholds", json={
        "operator": "合成质量员甲",
        "rules": [{
            "scope": "site_kri",
            "ctqId": "CTQ-ICF",
            "metric": "informed_consent_sd",
            "dimension": "INFORMED CONSENT",
            "unit": "fold",
            "warningThreshold": 1.25,
            "actionThreshold": 6.5,
            "weight": 0.25,
            "rationale": "合成的当前版本，不能回写已经绑定的信号。",
        }],
    })
    assert saved.status_code == 200
    body = saved.json()
    assert body["configVersion"] == "v2"
    assert body["data"]["rules"][0]["unit"] == "fold"
    historical = _version_rule("v1", "SYN-STUDY-001", "informed_consent_sd")
    risk = _risk("RSK-KRI-101")
    assert risk["configVersion"] == "v1"
    assert risk["boundThreshold"]["configVersion"] == historical["configVersion"] == "v1"
    assert risk["boundThreshold"]["unit"] == historical["unit"] == "SD"
    assert risk["boundThreshold"]["warningThreshold"] == historical["warningThreshold"] == 2.0
    assert risk["boundThreshold"]["actionThreshold"] == historical["actionThreshold"] == 3.0
    assert risk["boundThreshold"]["unit"] != "fold"
    assert risk["status"] == "Detected"


def test_missing_version_is_untraceable_and_does_not_use_the_current_one():
    assert all(item["configVersion"] != "v-absent" for item in _versions())
    risk = _risk("RSK-KRI-20261125-404")
    current = _version_rule("v1", "SYN-STUDY-001", "informed_consent_sd")
    assert risk["boundThreshold"] == {"traceable": False, "traceLabel": "无法溯源"}
    assert risk["boundThreshold"].get("warningThreshold") != current["warningThreshold"]
    assert "unit" not in risk["boundThreshold"]
    assert "configVersion" not in risk["boundThreshold"]


def test_another_studys_approved_version_is_not_used():
    foreign = _version_rule("v-foreign", "SYN-STUDY-009", "informed_consent_sd")
    assert foreign["warningThreshold"] == 8.5
    assert foreign["actionThreshold"] == 9.5
    risk = _risk("RSK-KRI-20261125-409")
    assert risk["studyId"] == "SYN-STUDY-001"
    assert risk["configVersion"] == "v-foreign"
    assert risk["boundThreshold"] == {"traceable": False, "traceLabel": "无法溯源"}
    assert risk["boundThreshold"].get("actionThreshold") != foreign["actionThreshold"]
    assert "warningThreshold" not in risk["boundThreshold"]
