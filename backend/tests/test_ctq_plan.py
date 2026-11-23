import hashlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.ctq.adapter import effective_thresholds
from src.ctq.service import reload_store, reset_store

FIXTURE = Path(__file__).parent / "fixtures" / "synthetic_mist_protocol.txt"
PROTOCOL = FIXTURE.read_text(encoding="utf-8")
SOURCE_HASH = hashlib.sha256(PROTOCOL.encode("utf-8")).hexdigest()

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_store(tmp_path, monkeypatch):
    monkeypatch.setenv("RBM_CTQ_STORE", str(tmp_path / "plan.json"))
    reset_store()
    yield
    reset_store()


def _approve(draft_id: str, action: float = 9):
    return client.post(f"/api/ctq/drafts/{draft_id}/approve", json={
        "operator": "审阅员-合成甲",
        "decisions": [
            {
                "candidateId": "KRI-01",
                "accept": True,
                "warningThreshold": 4,
                "actionThreshold": action,
                "monitoringMethod": "CENTRAL_REVIEW",
            },
            {
                "candidateId": "QTL-01",
                "accept": True,
                "warningThreshold": 3,
                "actionThreshold": 6,
                "monitoringMethod": "SYSTEM_CHECK",
            },
            {"candidateId": "CD-01", "accept": False},
        ],
    })


def test_unapproved_candidates_do_not_take_effect():
    extracted = client.post("/api/ctq/extract", json={"protocolText": PROTOCOL})
    assert extracted.status_code == 200
    body = extracted.json()
    assert body["approvalStatus"] == "unapproved"
    assert body["sourceHash"] == SOURCE_HASH
    assert body["studyCode"] == "SYN-FICTION-MIST-001"
    assert {item["approvalStatus"] for item in body["candidates"]} == {"candidate"}
    assert "versionId" not in body
    assert all(item["quote"] in PROTOCOL for item in body["candidates"])

    active = client.get("/api/ctq/active")
    assert active.status_code == 200
    payload = active.json()
    assert payload["active"] is None
    assert payload["effectiveThresholds"] == []
    assert payload["pendingCapabilities"][0]["id"] == "critical-data-extractor"
    assert payload["pendingCapabilities"][0]["status"] == "pending_decision"
    versions = client.get("/api/ctq/versions")
    assert versions.json()["versions"] == []


def test_approval_creates_a_new_version_with_operator_time_and_hash():
    draft_id = client.post("/api/ctq/extract", json={"protocolText": PROTOCOL}).json()["draftId"]
    approved = _approve(draft_id)
    assert approved.status_code == 200
    version = approved.json()["version"]
    assert version["versionId"] == "MP-0001"
    assert version["approvalStatus"] == "approved"
    assert version["approvedBy"] == "审阅员-合成甲"
    assert version["approvedAt"].endswith("+00:00")
    assert version["sourceHash"] == SOURCE_HASH
    assert version["sourceDraftId"] == draft_id
    assert {rule["candidateId"] for rule in version["rules"]} == {"KRI-01", "QTL-01"}
    assert version["legacyThresholdMap"] == [{
        "rbmCategoryId": "INFORMED CONSENT",
        "warningThreshold": 4.0,
        "actionThreshold": 9.0,
        "monitoringMethod": "CENTRAL_REVIEW",
        "candidateId": "KRI-01",
        "unit": "百分比",
        "source": "approved_kri",
    }]
    assert version["studyQtls"][0]["candidateId"] == "QTL-01"
    assert "pdZScore" in str(client.get("/api/ctq/active").json()["riskFieldMap"])

    active_body = client.get("/api/ctq/active").json()
    active = active_body["active"]
    assert active["versionId"] == "MP-0001"
    assert active["status"] == "approved"
    assert active_body["effectiveThresholds"] == [{
        "id": "INFORMED CONSENT",
        "labelKey": "INFORMED CONSENT",
        "warningThreshold": 4.0,
        "actionThreshold": 9.0,
        "monitoringMethod": "CENTRAL_REVIEW",
        "candidateId": "KRI-01",
        "versionId": "MP-0001",
        "approvedBy": "审阅员-合成甲",
        "unit": "百分比",
        "appliesToSdPreset": False,
        "readEntry": "ThresholdConfig",
        "effective": True,
    }]


def test_reject_leaves_the_previous_approved_version_active():
    first = client.post("/api/ctq/extract", json={"protocolText": PROTOCOL}).json()["draftId"]
    assert _approve(first).status_code == 200
    second = client.post("/api/ctq/extract", json={"protocolText": PROTOCOL}).json()["draftId"]
    rejected = client.post(f"/api/ctq/drafts/{second}/reject", json={
        "operator": "审阅员-合成乙",
        "reason": "建议阈值仍待统计师确认",
    })
    assert rejected.status_code == 200
    assert rejected.json()["approvalStatus"] == "rejected"
    assert rejected.json()["activeVersionId"] == "MP-0001"
    assert client.get("/api/ctq/active").json()["active"]["versionId"] == "MP-0001"
    events = client.get("/api/ctq/versions").json()["events"]
    assert [event["type"] for event in events] == ["extract", "approve", "extract", "reject"]


def test_rollback_restores_the_previous_approved_version_and_keeps_history():
    first = client.post("/api/ctq/extract", json={"protocolText": PROTOCOL}).json()["draftId"]
    assert _approve(first, action=9).status_code == 200
    second = client.post("/api/ctq/extract", json={"protocolText": PROTOCOL}).json()["draftId"]
    assert _approve(second, action=12).status_code == 200
    assert client.get("/api/ctq/active").json()["active"]["versionId"] == "MP-0002"

    rolled = client.post("/api/ctq/active/rollback", json={
        "operator": "审阅员-合成甲",
        "reason": "新版本阈值尚未被第二次确认",
    })
    assert rolled.status_code == 200
    assert rolled.json()["rolledBackVersionId"] == "MP-0002"
    assert rolled.json()["active"]["versionId"] == "MP-0001"
    assert rolled.json()["active"]["rules"][0]["actionThreshold"] == 9

    listed = client.get("/api/ctq/versions").json()
    by_id = {item["versionId"]: item["status"] for item in listed["versions"]}
    assert by_id == {"MP-0001": "approved", "MP-0002": "rolled_back"}
    assert any(event["type"] == "rollback" for event in listed["events"])
    assert len(listed["events"]) == 5


def test_restart_reloads_the_approved_version_and_its_history():
    draft_id = client.post("/api/ctq/extract", json={"protocolText": PROTOCOL}).json()["draftId"]
    assert _approve(draft_id).status_code == 200
    reload_store()
    active = client.get("/api/ctq/active").json()
    assert active["active"]["versionId"] == "MP-0001"
    assert active["active"]["status"] == "approved"
    assert active["effectiveThresholds"][0]["id"] == "INFORMED CONSENT"
    assert active["effectiveThresholds"][0]["actionThreshold"] == 9
    assert active["effectiveThresholds"][0]["unit"] == "百分比"
    assert active["effectiveThresholds"][0]["appliesToSdPreset"] is False
    events = client.get("/api/ctq/versions").json()["events"]
    assert [event["type"] for event in events] == ["extract", "approve"]


def test_restart_after_extract_only_still_has_no_effective_preset():
    client.post("/api/ctq/extract", json={"protocolText": PROTOCOL})
    reload_store()
    active = client.get("/api/ctq/active").json()
    assert active["active"] is None
    assert active["effectiveThresholds"] == []


def test_rollback_without_a_previous_version_keeps_the_pointer():
    draft_id = client.post("/api/ctq/extract", json={"protocolText": PROTOCOL}).json()["draftId"]
    assert _approve(draft_id).status_code == 200
    rolled = client.post("/api/ctq/active/rollback", json={
        "operator": "审阅员-合成甲",
        "reason": "尝试回到不存在的版本",
    })
    assert rolled.status_code == 409
    assert rolled.json()["code"] == "NO_PREVIOUS_APPROVED_VERSION"
    assert "rules" not in rolled.json()
    assert client.get("/api/ctq/active").json()["active"]["versionId"] == "MP-0001"


def test_extraction_failure_returns_an_error_and_not_a_plan():
    failed = client.post("/api/ctq/extract", json={"protocolText": "hello"})
    assert failed.status_code == 422
    body = failed.json()
    assert body["ok"] is False
    assert body["code"] == "PROTOCOL_TOO_SHORT"
    assert "versionId" not in body
    assert "rules" not in body
    assert "candidates" not in body
    assert client.get("/api/ctq/active").json()["active"] is None

    unmarked = client.post("/api/ctq/extract", json={
        "protocolText": "这是一段足够长的说明文字，但是没有虚构研究编号，也不应该变成监测计划。" * 2,
    })
    assert unmarked.status_code == 422
    assert unmarked.json()["code"] == "MISSING_SYNTHETIC_STUDY_CODE"
    assert "MP-" not in unmarked.text


def test_extractor_exception_is_visible_and_not_replaced_with_a_mock(monkeypatch):
    def boom(_text):
        raise RuntimeError("parser crashed")

    monkeypatch.setattr("src.api.ctq_routes.extract_protocol", boom)
    failed = client.post("/api/ctq/extract", json={"protocolText": PROTOCOL})
    assert failed.status_code == 500
    body = failed.json()
    assert body["code"] == "EXTRACT_FAILED"
    assert "versionId" not in body
    assert "rules" not in body
    assert "candidates" not in body
    assert client.get("/api/ctq/versions").json()["versions"] == []


def test_forbidden_source_marker_is_rejected_before_a_plan_exists():
    text = PROTOCOL + "\nsemaglutide\n"
    failed = client.post("/api/ctq/extract", json={"protocolText": text})
    assert failed.status_code == 422
    assert failed.json()["code"] == "FORBIDDEN_SOURCE_MARKER"
    assert "rules" not in failed.json()
    assert client.get("/api/ctq/active").json()["active"] is None


def test_malformed_candidate_does_not_create_a_draft():
    text = "研究编号：SYN-FICTION-MIST-001\n关键数据｜只有半行\n" + ("说明。" * 20)
    failed = client.post("/api/ctq/extract", json={"protocolText": text})
    assert failed.status_code == 422
    assert failed.json()["code"] == "MALFORMED_CANDIDATE"
    missing = client.post("/api/ctq/drafts/DR-0001/approve", json={
        "operator": "审阅员-合成甲",
        "decisions": [],
    })
    assert missing.status_code == 404
    assert missing.json()["code"] == "DRAFT_NOT_FOUND"


def test_only_an_sd_unit_applies_to_the_sd_preset():
    active = {
        "approvalStatus": "approved",
        "status": "approved",
        "versionId": "MP-0002",
        "approvedBy": "审阅员-合成甲",
        "legacyThresholdMap": [
            {
                "rbmCategoryId": "INFORMED CONSENT",
                "warningThreshold": 4,
                "actionThreshold": 9,
                "monitoringMethod": "CENTRAL_REVIEW",
                "candidateId": "KRI-01",
                "source": "approved_kri",
                "unit": "百分比",
            },
            {
                "rbmCategoryId": "SAFETY REPORTING",
                "warningThreshold": 1.5,
                "actionThreshold": 2.5,
                "monitoringMethod": "SDV",
                "candidateId": "KRI-02",
                "source": "approved_kri",
                "unit": "SD",
            },
        ],
    }
    rows = {row["candidateId"]: row for row in effective_thresholds(active)}
    assert rows["KRI-01"]["appliesToSdPreset"] is False
    assert rows["KRI-02"]["appliesToSdPreset"] is True
