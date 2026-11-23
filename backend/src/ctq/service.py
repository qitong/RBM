"""In-memory drafts and approved monitoring-plan versions.

Candidates stay unapproved until a separate human approve call records the
operator, time, and source hash. Rollback moves the active pointer and keeps
every prior version.
"""

from __future__ import annotations

from datetime import datetime, timezone

from src.ctq.extractor import DISCLAIMER

MONITORING_METHODS = ("SDV", "SDR", "CENTRAL_REVIEW", "SYSTEM_CHECK")

RISK_FIELD_MAP = [
    {
        "rbmField": "CategoryConfig.warningThreshold",
        "joinsOn": "rbmCategoryId",
        "source": "legacyThresholdMap.warningThreshold",
    },
    {
        "rbmField": "CategoryConfig.actionThreshold",
        "joinsOn": "rbmCategoryId",
        "source": "legacyThresholdMap.actionThreshold",
    },
    {
        "rbmField": "benchmark.pdZScore",
        "note": "既有中心 PD 的 z 分数仍由演示接口计算；本计划只提供可对照的阈值，不改写该分数。",
    },
    {
        "rbmField": "CategoryConfig.weight",
        "note": "权重仍留在预警阈值页的本地默认值，本批准不覆盖。",
    },
]


class PlanError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


class _Store:
    def __init__(self) -> None:
        self.drafts: dict[str, dict] = {}
        self.versions: dict[str, dict] = {}
        self.version_order: list[str] = []
        self.events: list[dict] = []
        self._seq = {"DR": 0, "MP": 0, "EV": 0}

    def _next(self, prefix: str) -> str:
        self._seq[prefix] += 1
        return f"{prefix}-{self._seq[prefix]:04d}"


_STORE = _Store()


def reset_store() -> None:
    global _STORE
    _STORE = _Store()


def create_draft(parsed: dict) -> dict:
    draft_id = _STORE._next("DR")
    draft = {
        "draftId": draft_id,
        "approvalStatus": "unapproved",
        "studyCode": parsed["studyCode"],
        "studyTitle": parsed["studyTitle"],
        "sourceHash": parsed["sourceHash"],
        "candidates": [dict(item) for item in parsed["candidates"]],
        "unlinkedCriticalData": list(parsed["unlinkedCriticalData"]),
        "decided": False,
    }
    _STORE.drafts[draft_id] = draft
    _event("extract", None, {"draftId": draft_id, "sourceHash": draft["sourceHash"], "studyCode": draft["studyCode"]})
    return _public_draft(draft)


def approve_draft(draft_id: str, operator: str, decisions: list[dict]) -> dict:
    draft = _require_open_draft(draft_id)
    actor = _operator(operator)
    by_id = {item["id"]: item for item in draft["candidates"]}
    seen: set[str] = set()
    accepted_rules: list[dict] = []
    categories: set[str] = set()

    for decision in decisions:
        candidate_id = decision.get("candidateId")
        if candidate_id in seen:
            raise PlanError(422, "DUPLICATE_DECISION", "同一候选不能重复决定")
        seen.add(candidate_id)
        candidate = by_id.get(candidate_id)
        if candidate is None:
            raise PlanError(422, "UNKNOWN_CANDIDATE", "决定引用了草稿中不存在的候选")
        if not decision.get("accept"):
            continue
        accepted_rules.append(_accepted_rule(candidate, decision, categories))

    if not any(rule["kind"] in ("kri", "qtl") for rule in accepted_rules):
        raise PlanError(422, "NO_MONITORING_RULE", "至少批准一条 KRI 或 QTL，候选本身不会生效")

    previous_id = _active_id(draft["studyCode"])
    version_id = _STORE._next("MP")
    now = _now()
    version = {
        "versionId": version_id,
        "status": "approved",
        "approvalStatus": "approved",
        "studyCode": draft["studyCode"],
        "studyTitle": draft["studyTitle"],
        "sourceHash": draft["sourceHash"],
        "sourceDraftId": draft_id,
        "approvedBy": actor,
        "approvedAt": now,
        "previousVersionId": previous_id,
        "rules": accepted_rules,
        "legacyThresholdMap": [
            {
                "rbmCategoryId": rule["rbmCategoryId"],
                "warningThreshold": rule["warningThreshold"],
                "actionThreshold": rule["actionThreshold"],
                "monitoringMethod": rule["monitoringMethod"],
                "candidateId": rule["candidateId"],
                "source": "approved_kri",
            }
            for rule in accepted_rules
            if rule["kind"] == "kri" and rule["rbmCategoryId"]
        ],
        "studyQtls": [rule for rule in accepted_rules if rule["kind"] == "qtl"],
    }
    if previous_id:
        _STORE.versions[previous_id]["status"] = "superseded"
    _STORE.versions[version_id] = version
    _STORE.version_order.append(version_id)
    draft["decided"] = True
    draft["approvalStatus"] = "approved"
    draft["approvedVersionId"] = version_id
    _event("approve", actor, {
        "draftId": draft_id,
        "versionId": version_id,
        "sourceHash": draft["sourceHash"],
        "studyCode": draft["studyCode"],
        "previousVersionId": previous_id,
    })
    return {
        "ok": True,
        "dataSourceMode": "synthetic",
        "disclaimer": DISCLAIMER,
        "version": _public_version(version),
        "activeVersionId": version_id,
    }


def reject_draft(draft_id: str, operator: str, reason: str) -> dict:
    draft = _require_open_draft(draft_id)
    actor = _operator(operator)
    why = _reason(reason)
    draft["decided"] = True
    draft["approvalStatus"] = "rejected"
    draft["rejectedBy"] = actor
    draft["rejectedAt"] = _now()
    draft["rejectReason"] = why
    active = _active_version(draft["studyCode"])
    _event("reject", actor, {
        "draftId": draft_id,
        "reason": why,
        "studyCode": draft["studyCode"],
        "activeVersionId": None if active is None else active["versionId"],
        "sourceHash": draft["sourceHash"],
    })
    return {
        "ok": True,
        "dataSourceMode": "synthetic",
        "disclaimer": DISCLAIMER,
        "draftId": draft_id,
        "approvalStatus": "rejected",
        "activeVersionId": None if active is None else active["versionId"],
    }


def rollback_active(operator: str, reason: str, study_code: str | None) -> dict:
    actor = _operator(operator)
    why = _reason(reason)
    current = _resolve_active(study_code)
    if current is None:
        raise PlanError(409, "NO_APPROVED_PLAN", "没有已批准版本可回滚")
    previous_id = current["previousVersionId"]
    if not previous_id or previous_id not in _STORE.versions:
        raise PlanError(409, "NO_PREVIOUS_APPROVED_VERSION", "没有上一已批准版本，生效指针保持不变")
    previous = _STORE.versions[previous_id]
    current["status"] = "rolled_back"
    previous["status"] = "approved"
    _event("rollback", actor, {
        "fromVersionId": current["versionId"],
        "toVersionId": previous["versionId"],
        "reason": why,
        "studyCode": current["studyCode"],
        "sourceHash": previous["sourceHash"],
    })
    return {
        "ok": True,
        "dataSourceMode": "synthetic",
        "disclaimer": DISCLAIMER,
        "rolledBackVersionId": current["versionId"],
        "activeVersionId": previous["versionId"],
        "active": _public_version(previous),
    }


def get_active(study_code: str | None) -> dict:
    version = _resolve_active(study_code)
    return {
        "ok": True,
        "dataSourceMode": "synthetic",
        "disclaimer": DISCLAIMER,
        "riskFieldMap": RISK_FIELD_MAP,
        "readEntry": {
            "appliesTo": ["CategoryConfig.warningThreshold", "CategoryConfig.actionThreshold"],
            "doesNotOverwrite": ["localStorage.rbm_threshold_configs", "benchmark.pdZScore"],
        },
        "active": None if version is None else _public_version(version),
    }


def list_versions(study_code: str | None) -> dict:
    versions = [
        _public_version(_STORE.versions[version_id])
        for version_id in _STORE.version_order
        if study_code is None or _STORE.versions[version_id]["studyCode"] == study_code
    ]
    events = [
        event for event in _STORE.events
        if study_code is None or event.get("studyCode") == study_code
    ]
    return {
        "ok": True,
        "dataSourceMode": "synthetic",
        "disclaimer": DISCLAIMER,
        "versions": versions,
        "events": events,
    }


def _accepted_rule(candidate: dict, decision: dict, categories: set[str]) -> dict:
    method = decision.get("monitoringMethod")
    if method not in MONITORING_METHODS:
        raise PlanError(422, "INVALID_MONITORING_METHOD", "接受候选时必须单独指定监测方式")
    warning = decision.get("warningThreshold")
    action = decision.get("actionThreshold")
    if candidate["kind"] in ("kri", "qtl"):
        if not isinstance(warning, (int, float)) or not isinstance(action, (int, float)):
            raise PlanError(422, "INVALID_THRESHOLD", "KRI 与 QTL 的预警阈值和行动阈值都要由审阅人给出")
        if isinstance(warning, bool) or isinstance(action, bool) or warning < 0 or action < 0 or warning >= action:
            raise PlanError(422, "INVALID_THRESHOLD", "预警阈值须大于等于 0 且小于行动阈值")
        if candidate["kind"] == "kri" and candidate["rbmCategoryId"]:
            if candidate["rbmCategoryId"] in categories:
                raise PlanError(422, "DUPLICATE_CATEGORY", "同一现有阈值类别不能批准两条 KRI")
            categories.add(candidate["rbmCategoryId"])
    elif warning is not None or action is not None:
        raise PlanError(422, "INVALID_THRESHOLD", "关键数据和 CtQ 的批准不写入数值阈值")
    return {
        "candidateId": candidate["id"],
        "kind": candidate["kind"],
        "title": candidate["title"],
        "rbmCategoryId": candidate["rbmCategoryId"],
        "warningThreshold": warning,
        "actionThreshold": action,
        "monitoringMethod": method,
        "quote": candidate["quote"],
        "line": candidate["line"],
    }


def _require_open_draft(draft_id: str) -> dict:
    draft = _STORE.drafts.get(draft_id)
    if draft is None:
        raise PlanError(404, "DRAFT_NOT_FOUND", "草稿不存在")
    if draft["decided"]:
        raise PlanError(409, "ALREADY_DECIDED", "该草稿已经批准或驳回，不能再次决定")
    return draft


def _operator(operator: str) -> str:
    actor = (operator or "").strip()
    if not actor or len(actor) > 80:
        raise PlanError(422, "EMPTY_OPERATOR", "批准、驳回和回滚必须记下操作者")
    return actor


def _reason(reason: str) -> str:
    why = (reason or "").strip()
    if not why or len(why) > 200:
        raise PlanError(422, "EMPTY_REASON", "驳回和回滚必须写下原因")
    return why


def _active_id(study_code: str) -> str | None:
    version = _active_version(study_code)
    return None if version is None else version["versionId"]


def _active_version(study_code: str) -> dict | None:
    for version_id in reversed(_STORE.version_order):
        version = _STORE.versions[version_id]
        if version["studyCode"] == study_code and version["status"] == "approved":
            return version
    return None


def _resolve_active(study_code: str | None) -> dict | None:
    if study_code:
        return _active_version(study_code)
    approved = []
    seen: set[str] = set()
    for version_id in reversed(_STORE.version_order):
        version = _STORE.versions[version_id]
        if version["status"] != "approved" or version["studyCode"] in seen:
            continue
        seen.add(version["studyCode"])
        approved.append(version)
    if len(approved) > 1:
        raise PlanError(409, "AMBIGUOUS_ACTIVE_STUDY", "有多份生效计划，读取时必须带研究编号")
    return approved[0] if approved else None


def _public_draft(draft: dict) -> dict:
    return {
        "ok": True,
        "dataSourceMode": "synthetic",
        "disclaimer": DISCLAIMER,
        "draftId": draft["draftId"],
        "approvalStatus": "unapproved",
        "studyCode": draft["studyCode"],
        "studyTitle": draft["studyTitle"],
        "sourceHash": draft["sourceHash"],
        "unlinkedCriticalData": draft["unlinkedCriticalData"],
        "candidates": [_public_candidate(item) for item in draft["candidates"]],
    }


def _public_candidate(item: dict) -> dict:
    return {
        "id": item["id"],
        "kind": item["kind"],
        "approvalStatus": "candidate",
        "title": item["title"],
        "quote": item["quote"],
        "line": item["line"],
        "rbmCategoryId": item["rbmCategoryId"],
        "linkedProcess": item["linkedProcess"],
        "suggestedWarning": item["suggestedWarning"],
        "suggestedAction": item["suggestedAction"],
        "unit": item["unit"],
    }


def _public_version(version: dict) -> dict:
    hidden = {"studyCode", "studyTitle"}
    return {key: value for key, value in version.items() if key not in hidden} | {
        "studyCode": version["studyCode"],
        "studyTitle": version["studyTitle"],
    }


def _event(event_type: str, operator: str | None, detail: dict) -> None:
    event = {
        "eventId": _STORE._next("EV"),
        "type": event_type,
        "at": _now(),
        "operator": operator,
        **detail,
    }
    _STORE.events.append(event)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
