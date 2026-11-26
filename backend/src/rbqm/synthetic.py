"""Fixed synthetic RBQM seed. Same inputs always rebuild the same snapshot."""

from __future__ import annotations

import hashlib
import json
from typing import Any

DISCLAIMER = "合成研究验证数据，非真实临床试验监查证据"
STUDY_ID = "SYN-STUDY-001"
CONFIG_VERSION = "v1"
SEED = 42

CATEGORIES: list[tuple[str, str]] = [
    ("INFORMED CONSENT", "知情同意"),
    ("INCLUSION EXCLUSION", "入排标准"),
    ("INVESTIGATIONAL PRODUCT", "试验用药"),
    ("SAFETY REPORTING", "安全性报告"),
    ("PROCEDURES TESTS", "访视与检查"),
    ("VISIT SCHEDULE", "访视计划"),
    ("CCMEDS", "合并用药"),
    ("OTHER", "其他"),
]

SITE_IDS = [
    "SYN-SITE-101",
    "SYN-SITE-102",
    "SYN-SITE-105",
    "SYN-SITE-201",
    "SYN-SITE-203",
    "SYN-SITE-302",
    "SYN-SITE-305",
    "SYN-SITE-401",
    "SYN-SITE-402",
    "SYN-SITE-501",
]


def batch_hash(payload: object) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def screen_batch(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Reject unblinding fields before they enter the central-monitor view."""
    for row in rows:
        if row.get("blindingSensitive"):
            raise ValueError("BLINDING_BLOCKED")
    return rows


def metric_batch() -> list[dict[str, Any]]:
    """Hand-fixed batch. seed=42 is recorded so callers can see which batch this is."""
    rows = [
        {
            "studyId": STUDY_ID,
            "siteId": "SYN-SITE-101",
            "scope": "site_kri",
            "ctqId": "CTQ-ICF",
            "dimension": "INFORMED CONSENT",
            "metric": "informed_consent_sd",
            "metricValue": 3.5,
            "unit": "SD",
            "blindingSensitive": False,
        },
        {
            "studyId": STUDY_ID,
            "siteId": "SYN-SITE-105",
            "scope": "site_kri",
            "ctqId": "CTQ-ICF",
            "dimension": "INFORMED CONSENT",
            "metric": "informed_consent_sd",
            "metricValue": -3.5,
            "unit": "SD",
            "blindingSensitive": False,
        },
        {
            "studyId": STUDY_ID,
            "siteId": None,
            "scope": "study_qtl",
            "ctqId": "CTQ-PD",
            "dimension": "IMPORTANT_PD_PROPORTION",
            "metric": "important_pd_proportion",
            "metricValue": 0.125,
            "unit": "proportion",
            "blindingSensitive": False,
        },
    ]
    return screen_batch(rows)


def _lcg(seed: int):
    state = seed & 0xFFFFFFFF

    def nxt() -> int:
        nonlocal state
        state = (1664525 * state + 1013904223) & 0xFFFFFFFF
        return state

    return nxt


def site_comparison(seed: int = SEED) -> dict[str, Any]:
    """Deterministic site comparison. Does not use an unseeded RNG."""
    nxt = _lcg(seed)
    points = []
    visits: dict[str, list[dict[str, Any]]] = {}
    for site_id in SITE_IDS:
        counts = {label: 1 + (nxt() % 12) for _cat_id, label in CATEGORIES}
        points.append({"siteId": site_id, "siteLabel": site_id, "counts": counts})
        site_visits = []
        for visit in range(1, 21):
            row: dict[str, Any] = {"visit": f"Visit {visit}"}
            for cat_id, _label in CATEGORIES:
                row[cat_id] = round(((nxt() % 500) - 250) / 100, 2)
            site_visits.append(row)
        visits[site_id] = site_visits
    return {"seed": seed, "points": points, "visits": visits}


def _event(
    event_id: str,
    at: str,
    event_type: str,
    *,
    actor_role: str,
    actor_name: str,
    from_status: str | None,
    to_status: str | None,
    risk_id: str | None,
    task_id: str | None = None,
    capa_id: str | None = None,
    note: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    input_hash: str,
) -> dict[str, Any]:
    return {
        "eventId": event_id,
        "type": event_type,
        "at": at,
        "actorRole": actor_role,
        "actorName": actor_name,
        "fromStatus": from_status,
        "toStatus": to_status,
        "configVersion": CONFIG_VERSION,
        "riskId": risk_id,
        "taskId": task_id,
        "capaId": capa_id,
        "inputBatchHash": input_hash,
        "note": note,
        "before": before or {},
        "after": after or {},
    }


def initial_state() -> dict[str, Any]:
    batch = metric_batch()
    digest = batch_hash({"seed": SEED, "batch": batch})
    comparison = site_comparison(SEED)
    study = {
        "studyId": STUDY_ID,
        "title": "合成研究：虚构紫雾片剂",
        "phase": "III",
        "blindingSensitive": False,
    }
    ctqs = [
        {
            "ctqId": "CTQ-ICF",
            "studyId": STUDY_ID,
            "name": "知情同意签署合规性",
            "description": "合成例子：签署顺序和版本是否一致。",
        },
        {
            "ctqId": "CTQ-PD",
            "studyId": STUDY_ID,
            "name": "重要方案偏离比例",
            "description": "合成例子：全研究重要方案偏离占已入组受试者的比例。",
        },
    ]
    assessments = [
        {
            "assessmentId": "RA-ICF-V1",
            "ctqId": "CTQ-ICF",
            "likelihood": 3,
            "detectability": 2,
            "impact": 4,
            "weight": 0.25,
            "rationale": "合成评估，只用于验证闭环，不代表真实试验。",
        },
        {
            "assessmentId": "RA-PD-V1",
            "ctqId": "CTQ-PD",
            "likelihood": 2,
            "detectability": 3,
            "impact": 4,
            "weight": 0.4,
            "rationale": "合成评估：研究级偏离比例一旦越过容忍限，需要人工决定是否升级。",
        },
    ]
    rules = [
        {
            "thresholdId": "THR-KRI-ICF-V1",
            "configVersion": CONFIG_VERSION,
            "scope": "site_kri",
            "ctqId": "CTQ-ICF",
            "metric": "informed_consent_sd",
            "dimension": "INFORMED CONSENT",
            "unit": "SD",
            "warningThreshold": 2.0,
            "actionThreshold": 3.0,
            "weight": 0.25,
            "rationale": "合成中心级 KRI。行动阈为 3.0 SD。",
        },
        {
            "thresholdId": "THR-QTL-PD-V1",
            "configVersion": CONFIG_VERSION,
            "scope": "study_qtl",
            "ctqId": "CTQ-PD",
            "metric": "important_pd_proportion",
            "dimension": "IMPORTANT_PD_PROPORTION",
            "unit": "proportion",
            "warningThreshold": 0.0625,
            "actionThreshold": 0.125,
            "weight": 0.4,
            "rationale": "合成研究级 QTL。重要方案偏离比例行动阈为 0.125。",
        },
    ]
    risks = [
        {
            "id": "RSK-KRI-101",
            "studyId": STUDY_ID,
            "siteId": "SYN-SITE-101",
            "scope": "site_kri",
            "ctqId": "CTQ-ICF",
            "dimension": "INFORMED CONSENT",
            "title": "知情同意签署合规性",
            "metric": "informed_consent_sd",
            "metricValue": 3.5,
            "unit": "SD",
            "level": "action",
            "status": "Detected",
            "configVersion": CONFIG_VERSION,
            "rootCause": None,
            "assignee": None,
            "dueDate": None,
            "actionSummary": None,
            "effectivenessNote": None,
            "taskId": None,
            "capaId": None,
        },
        {
            "id": "RSK-KRI-105",
            "studyId": STUDY_ID,
            "siteId": "SYN-SITE-105",
            "scope": "site_kri",
            "ctqId": "CTQ-ICF",
            "dimension": "INFORMED CONSENT",
            "title": "知情同意低报信号",
            "metric": "informed_consent_sd",
            "metricValue": -3.5,
            "unit": "SD",
            "level": "action",
            "status": "Detected",
            "configVersion": CONFIG_VERSION,
            "rootCause": None,
            "assignee": None,
            "dueDate": None,
            "actionSummary": None,
            "effectivenessNote": None,
            "taskId": None,
            "capaId": None,
        },
        {
            "id": "RSK-QTL-001",
            "studyId": STUDY_ID,
            "siteId": None,
            "scope": "study_qtl",
            "ctqId": "CTQ-PD",
            "dimension": "IMPORTANT_PD_PROPORTION",
            "title": "重要方案偏离比例",
            "metric": "important_pd_proportion",
            "metricValue": 0.125,
            "unit": "proportion",
            "level": "action",
            "status": "Detected",
            "configVersion": CONFIG_VERSION,
            "rootCause": None,
            "assignee": None,
            "dueDate": None,
            "actionSummary": None,
            "effectivenessNote": None,
            "taskId": None,
            "capaId": None,
        },
        {
            "id": "RSK-KRI-HIST",
            "studyId": STUDY_ID,
            "siteId": "SYN-SITE-201",
            "scope": "site_kri",
            "ctqId": "CTQ-ICF",
            "dimension": "INFORMED CONSENT",
            "title": "历史合成闭环",
            "metric": "informed_consent_sd",
            "metricValue": 3.5,
            "unit": "SD",
            "level": "action",
            "status": "Closed",
            "configVersion": CONFIG_VERSION,
            "rootCause": "合成根因：旧版知情同意书仍在使用。",
            "assignee": "合成CRA-甲",
            "dueDate": "2026-10-20",
            "actionSummary": "合成中心更换现行版本并复训。",
            "effectivenessNote": "合成复核：随后两次访视未再使用旧版。",
            "taskId": "TASK-SYN-003",
            "capaId": "CAPA-SYN-003",
        },
        {
            "id": "RSK-KRI-MISSING",
            "studyId": STUDY_ID,
            "siteId": "SYN-SITE-401",
            "scope": "site_kri",
            "ctqId": "CTQ-ICF",
            "dimension": "INFORMED CONSENT",
            "title": "版本缺失的合成信号",
            "metric": "informed_consent_sd",
            "metricValue": 3.5,
            "unit": "SD",
            "level": "action",
            "status": "Detected",
            "configVersion": "v0",
            "rootCause": None,
            "assignee": None,
            "dueDate": None,
            "actionSummary": None,
            "effectivenessNote": None,
            "taskId": None,
            "capaId": None,
        },
        {
            "id": "RSK-KRI-WRONG-STUDY",
            "studyId": "SYN-STUDY-002",
            "siteId": "SYN-SITE-402",
            "scope": "site_kri",
            "ctqId": "CTQ-ICF",
            "dimension": "INFORMED CONSENT",
            "title": "研究号不符的合成信号",
            "metric": "informed_consent_sd",
            "metricValue": 3.5,
            "unit": "SD",
            "level": "action",
            "status": "Detected",
            "configVersion": CONFIG_VERSION,
            "rootCause": None,
            "assignee": None,
            "dueDate": None,
            "actionSummary": None,
            "effectivenessNote": None,
            "taskId": None,
            "capaId": None,
        },
    ]
    actions = [
        {
            "id": "CAPA-SYN-001",
            "riskId": None,
            "siteId": "SYN-SITE-203",
            "category": "知情同意",
            "openDate": "2026-11-02",
            "closeDate": None,
            "status": "open",
            "cycleTimeDays": None,
            "assignee": "合成CRA-乙",
            "summary": "合成中心正在复核签署顺序。",
        },
        {
            "id": "CAPA-SYN-002",
            "riskId": None,
            "siteId": "SYN-SITE-302",
            "category": "访视计划",
            "openDate": "2026-10-01",
            "closeDate": "2026-10-11",
            "status": "closed",
            "cycleTimeDays": 10,
            "assignee": "合成CRA-甲",
            "summary": "合成例子：访视窗已补记。",
        },
        {
            "id": "CAPA-SYN-003",
            "riskId": "RSK-KRI-HIST",
            "siteId": "SYN-SITE-201",
            "category": "知情同意",
            "openDate": "2026-10-05",
            "closeDate": "2026-10-20",
            "status": "closed",
            "cycleTimeDays": 15,
            "assignee": "合成CRA-甲",
            "summary": "合成例子：旧版知情同意书已回收。",
        },
    ]
    tasks = [
        {
            "taskId": "TASK-SYN-001",
            "title": "合成中心签署顺序复核",
            "relatedAlertId": None,
            "siteId": "SYN-SITE-203",
            "siteName": "SYN-SITE-203",
            "assignee": "合成CRA-乙",
            "category": "知情同意",
            "status": "To Do",
            "priority": "High",
            "createdAt": "2026-11-02T00:00:00Z",
            "dueDate": "2026-12-20T00:00:00Z",
        },
        {
            "taskId": "TASK-SYN-002",
            "title": "合成中心访视窗补记",
            "relatedAlertId": None,
            "siteId": "SYN-SITE-302",
            "siteName": "SYN-SITE-302",
            "assignee": "合成CRA-甲",
            "category": "访视计划",
            "status": "In Progress",
            "priority": "Medium",
            "createdAt": "2026-10-01T00:00:00Z",
            "dueDate": "2026-11-01T00:00:00Z",
        },
        {
            "taskId": "TASK-SYN-003",
            "title": "合成中心旧版知情同意书回收",
            "relatedAlertId": "RSK-KRI-HIST",
            "siteId": "SYN-SITE-201",
            "siteName": "SYN-SITE-201",
            "assignee": "合成CRA-甲",
            "category": "知情同意",
            "status": "Resolved",
            "priority": "Critical",
            "createdAt": "2026-10-05T00:00:00Z",
            "dueDate": "2026-10-20T00:00:00Z",
        },
    ]
    events = [
        _event(
            "AUD-0001",
            "2026-11-01T00:00:00Z",
            "THRESHOLD_SET",
            actor_role="rbqm_lead",
            actor_name="合成质量员甲",
            from_status=None,
            to_status=None,
            risk_id=None,
            note="批准合成阈值版本 v1，含中心级 KRI 与研究级 QTL。",
            before={},
            after={"configVersion": CONFIG_VERSION},
            input_hash=digest,
        ),
        _event(
            "AUD-0002",
            "2026-11-01T00:00:01Z",
            "RISK_DETECTED",
            actor_role="system",
            actor_name="合成规则引擎",
            from_status=None,
            to_status="Detected",
            risk_id="RSK-KRI-101",
            note="SYN-SITE-101 知情同意 SD 3.5 超过行动阈 3.0。",
            before={},
            after={"status": "Detected", "metricValue": 3.5},
            input_hash=digest,
        ),
        _event(
            "AUD-0003",
            "2026-11-01T00:00:02Z",
            "RISK_DETECTED",
            actor_role="system",
            actor_name="合成规则引擎",
            from_status=None,
            to_status="Detected",
            risk_id="RSK-QTL-001",
            note="研究级重要方案偏离比例 0.125 达到 QTL 行动阈。",
            before={},
            after={"status": "Detected", "metricValue": 0.125},
            input_hash=digest,
        ),
        _event(
            "AUD-0004",
            "2026-10-20T00:00:00Z",
            "TRANSITION",
            actor_role="rbqm_lead",
            actor_name="合成质量员甲",
            from_status="Effectiveness_Check",
            to_status="Closed",
            risk_id="RSK-KRI-HIST",
            task_id="TASK-SYN-003",
            capa_id="CAPA-SYN-003",
            note="历史合成例子已关闭。",
            before={"status": "Effectiveness_Check"},
            after={"status": "Closed"},
            input_hash=digest,
        ),
    ]
    return {
        "study": study,
        "ctqs": ctqs,
        "assessments": assessments,
        "configVersion": CONFIG_VERSION,
        "versions": [
            {
                "configVersion": CONFIG_VERSION,
                "studyId": STUDY_ID,
                "rules": rules,
                "operator": "合成质量员甲",
            },
            {
                "configVersion": CONFIG_VERSION,
                "studyId": "SYN-STUDY-009",
                "rules": [
                    {
                        "thresholdId": "THR-KRI-ICF-OTHER",
                        "configVersion": CONFIG_VERSION,
                        "scope": "site_kri",
                        "ctqId": "CTQ-ICF",
                        "metric": "informed_consent_sd",
                        "dimension": "INFORMED CONSENT",
                        "unit": "SD",
                        "warningThreshold": 8.0,
                        "actionThreshold": 9.0,
                        "weight": 0.25,
                        "rationale": "另一条合成研究的已批准界限。不能用来补研究号对不上的风险。",
                    }
                ],
                "operator": "合成质量员乙",
            },
        ],
        "rules": rules,
        "risks": risks,
        "actions": actions,
        "tasks": tasks,
        "events": events,
        "inputBatchHash": digest,
        "seed": SEED,
        "comparison": comparison,
        "metricBatch": batch,
        "studyCandidates": [],
        "exceedanceCounts": {},
        "seenObservations": set(),
    }
