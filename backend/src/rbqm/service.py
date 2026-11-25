"""In-memory RBQM state machine over the fixed synthetic seed."""

from __future__ import annotations

from typing import Any

from src.rbqm.synthetic import DISCLAIMER, SEED, initial_state

NEXT: dict[str, set[str]] = {
    "Detected": {"Triaged", "Under_RCA"},
    "Triaged": {"Under_RCA", "Action_In_Progress", "Escalated"},
    "Under_RCA": {"Action_In_Progress", "Escalated"},
    "Action_In_Progress": {"Effectiveness_Check", "Escalated"},
    "Escalated": {"Action_In_Progress"},
    "Effectiveness_Check": {"Closed"},
    "Closed": set(),
}

CLOSE_FIELDS = ("rootCause", "assignee", "effectivenessNote")


class RbqmError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        *,
        missing: list[str] | None = None,
        current_status: str | None = None,
        field_errors: list[dict[str, str]] | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.missing = missing or []
        self.current_status = current_status
        self.field_errors = field_errors or []


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


class Store:
    def __init__(self) -> None:
        self._state = initial_state()
        self._tick = 0

    def clock(self) -> str:
        self._tick += 1
        return f"2026-11-24T08:00:{self._tick:02d}Z"

    @property
    def config_version(self) -> str:
        return self._state["configVersion"]

    @property
    def input_batch_hash(self) -> str:
        return self._state["inputBatchHash"]

    def snapshot(self) -> dict[str, Any]:
        return {
            "configVersion": self.config_version,
            "inputBatchHash": self.input_batch_hash,
            "seed": self._state["seed"],
            "risks": [dict(risk) for risk in self._state["risks"]],
            "events": [dict(event) for event in self._state["events"]],
        }

    def study_view(self) -> dict[str, Any]:
        return {
            "study": self._state["study"],
            "ctqs": self._state["ctqs"],
            "assessments": self._state["assessments"],
            "configVersion": self.config_version,
            "rules": self._state["rules"],
            "seed": SEED,
        }

    def risks(self) -> list[dict[str, Any]]:
        return [self._present_risk(risk) for risk in self._state["risks"]]

    def risk_detail(self, risk_id: str) -> dict[str, Any]:
        risk = self._find_risk(risk_id)
        audits = [dict(event) for event in self._state["events"] if event.get("riskId") == risk_id]
        return {"risk": self._present_risk(risk), "audits": audits}

    def tasks(self) -> list[dict[str, Any]]:
        return [dict(task) for task in self._state["tasks"]]

    def actions(self) -> list[dict[str, Any]]:
        return [dict(action) for action in self._state["actions"]]

    def efficiency(self) -> dict[str, Any]:
        actions = self._state["actions"]
        closed = [item for item in actions if item["status"] == "closed" and item["cycleTimeDays"] is not None]
        cycles = sorted(item["cycleTimeDays"] for item in closed)
        avg = round(sum(cycles) / len(cycles), 1) if cycles else 0
        mid = cycles[len(cycles) // 2] if cycles else 0
        if cycles and len(cycles) % 2 == 0:
            mid = round((cycles[len(cycles) // 2 - 1] + cycles[len(cycles) // 2]) / 2, 1)
        by_site: dict[str, list[dict[str, Any]]] = {}
        by_cat: dict[str, list[dict[str, Any]]] = {}
        for item in actions:
            by_site.setdefault(item["siteId"], []).append(item)
            by_cat.setdefault(item["category"], []).append(item)

        def pack(groups: dict[str, list[dict[str, Any]]], key: str) -> list[dict[str, Any]]:
            rows = []
            for name, items in sorted(groups.items()):
                done = [row for row in items if row["status"] == "closed" and row["cycleTimeDays"] is not None]
                days = [row["cycleTimeDays"] for row in done]
                rows.append({
                    key: name,
                    "avgCycleTimeDays": round(sum(days) / len(days), 1) if days else 0,
                    "count": len(items),
                    "closureRate": round(len(done) / len(items), 3) if items else 0,
                })
            return rows

        site_rows = pack(by_site, "siteId")
        cat_rows = [
            {
                "category": row["category"],
                "avgCycleTimeDays": row["avgCycleTimeDays"],
                "count": row["count"],
            }
            for row in pack(by_cat, "category")
        ]
        return {
            "avgCycleTimeDays": avg,
            "medianCycleTimeDays": mid,
            "closureRate": round(len(closed) / len(actions), 3) if actions else 0,
            "bySite": site_rows,
            "byCategory": cat_rows,
        }

    def audits(self) -> dict[str, Any]:
        events = [dict(event) for event in self._state["events"]]
        return {"events": events, "logs": [self._to_log(event) for event in events]}

    def comparison(self) -> dict[str, Any]:
        return self._state["comparison"]

    def thresholds(self) -> dict[str, Any]:
        return {
            "configVersion": self.config_version,
            "versions": self._state["versions"],
            "rules": self._state["rules"],
        }

    def save_thresholds(self, operator: str, operator_role: str, rules: list[dict[str, Any]]) -> dict[str, Any]:
        field_errors: list[dict[str, str]] = []
        if not _text(operator):
            field_errors.append({"field": "operator", "code": "REQUIRED"})
        for index, rule in enumerate(rules):
            warning = float(rule["warningThreshold"])
            action = float(rule["actionThreshold"])
            weight = float(rule["weight"])
            if warning >= action:
                field_errors.append({
                    "field": f"rules[{index}].warningThreshold",
                    "code": "THRESHOLD_ORDER",
                })
            if weight < 0:
                field_errors.append({"field": f"rules[{index}].weight", "code": "NEGATIVE_WEIGHT"})
        if field_errors:
            raise RbqmError(
                422,
                "THRESHOLD_INVALID",
                "阈值版本未保存，当前版本保持不变。",
                current_status=self.config_version,
                field_errors=field_errors,
            )
        previous = self.config_version
        number = int(previous.lstrip("v")) + 1
        version = f"v{number}"
        stored = []
        for rule in rules:
            stored.append({
                **rule,
                "thresholdId": f"THR-{version}-{rule['metric']}",
                "configVersion": version,
            })
        self._state["configVersion"] = version
        self._state["rules"] = stored
        self._state["versions"].append({
            "configVersion": version,
            "studyId": self._state["study"]["studyId"],
            "rules": stored,
            "operator": operator,
        })
        self._append_event(
            event_type="THRESHOLD_SET",
            actor_role=operator_role,
            actor_name=operator,
            from_status=None,
            to_status=None,
            risk_id=None,
            note=f"阈值版本从 {previous} 更新为 {version}。",
            before={"configVersion": previous},
            after={"configVersion": version},
        )
        return self.thresholds()

    def transition(self, risk_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        risk = self._find_risk(risk_id)
        target = str(payload.get("toStatus") or "")
        operator = _text(payload.get("operator"))
        if not operator:
            raise RbqmError(422, "OPERATOR_REQUIRED", "缺少操作者。状态保持不变。", current_status=risk["status"])
        current = risk["status"]
        if target == "Closed" or target not in NEXT[current]:
            missing = self._missing_close_fields(risk, payload) if target == "Closed" else []
            if target not in NEXT[current]:
                message = f"不能从 {current} 进入 {target or '空状态'}。"
                if missing:
                    message += "缺少 " + "、".join(missing) + "。"
                message += f"状态保持 {current}。"
                raise RbqmError(
                    422,
                    "CLOSE_GUARD" if target == "Closed" and missing else "ILLEGAL_TRANSITION",
                    message,
                    missing=missing,
                    current_status=current,
                )
        if target == "Closed":
            missing = self._missing_close_fields(risk, payload)
            if missing:
                raise RbqmError(
                    422,
                    "CLOSE_GUARD",
                    f"不能关闭：缺少 {'、'.join(missing)}。状态保持 {current}。",
                    missing=missing,
                    current_status=current,
                )
        if target == "Action_In_Progress":
            missing = []
            if not (_text(payload.get("rootCause")) or _text(risk.get("rootCause"))):
                missing.append("rootCause")
            if not (_text(payload.get("assignee")) or _text(risk.get("assignee"))):
                missing.append("assignee")
            if missing:
                raise RbqmError(
                    422,
                    "ACTION_GUARD",
                    f"不能进入行动：缺少 {'、'.join(missing)}。状态保持 {current}。",
                    missing=missing,
                    current_status=current,
                )
        before = {"status": current}
        self._apply_fields(risk, payload)
        risk["status"] = target
        task_id = risk.get("taskId")
        capa_id = risk.get("capaId")
        if target == "Action_In_Progress" and not task_id:
            task_id = f"TASK-{risk_id}"
            capa_id = f"CAPA-{risk_id}"
            risk["taskId"] = task_id
            risk["capaId"] = capa_id
            self._state["tasks"].append({
                "taskId": task_id,
                "title": risk.get("actionSummary") or risk["title"],
                "relatedAlertId": risk_id,
                "siteId": risk.get("siteId") or STUDY_SITE_FALLBACK(risk),
                "siteName": risk.get("siteId") or "SYN-STUDY-001",
                "assignee": risk.get("assignee") or "",
                "category": risk["title"],
                "status": "In Progress",
                "priority": "High",
                "createdAt": self.clock(),
                "dueDate": (risk.get("dueDate") or "2026-12-31") + "T00:00:00Z",
            })
            self._state["actions"].append({
                "id": capa_id,
                "riskId": risk_id,
                "siteId": risk.get("siteId") or "SYN-STUDY-001",
                "category": risk["title"],
                "openDate": "2026-11-24",
                "closeDate": None,
                "status": "open",
                "cycleTimeDays": None,
                "assignee": risk.get("assignee") or "",
                "summary": risk.get("actionSummary") or "",
            })
        if target == "Closed":
            self._close_linked(risk)
        self._append_event(
            event_type="TRANSITION",
            actor_role=_text(payload.get("operatorRole")) or "central_monitor",
            actor_name=operator,
            from_status=current,
            to_status=target,
            risk_id=risk_id,
            task_id=risk.get("taskId"),
            capa_id=risk.get("capaId"),
            note=_text(payload.get("rootCause")) or _text(payload.get("effectivenessNote")) or f"{current} → {target}",
            before=before,
            after={"status": target, "configVersion": risk["configVersion"]},
            config_version=risk["configVersion"],
        )
        return self.risk_detail(risk_id)

    def _close_linked(self, risk: dict[str, Any]) -> None:
        for task in self._state["tasks"]:
            if task["taskId"] == risk.get("taskId"):
                task["status"] = "Resolved"
        for action in self._state["actions"]:
            if action["id"] == risk.get("capaId") and action["status"] != "closed":
                action["status"] = "closed"
                action["closeDate"] = "2026-11-24"
                action["cycleTimeDays"] = 1

    def _apply_fields(self, risk: dict[str, Any], payload: dict[str, Any]) -> None:
        for key in ("rootCause", "assignee", "dueDate", "actionSummary", "effectivenessNote"):
            incoming = _text(payload.get(key))
            if incoming:
                risk[key] = incoming

    def _missing_close_fields(self, risk: dict[str, Any], payload: dict[str, Any]) -> list[str]:
        missing = []
        for key in CLOSE_FIELDS:
            if not (_text(payload.get(key)) or _text(risk.get(key))):
                missing.append(key)
        return missing

    def _present_risk(self, risk: dict[str, Any]) -> dict[str, Any]:
        shown = dict(risk)
        shown["boundThreshold"] = self._bound_threshold(risk)
        return shown

    def _bound_threshold(self, risk: dict[str, Any]) -> dict[str, Any]:
        """Read the approved version this signal names. Never substitute another version."""
        version_id = risk.get("configVersion")
        study_id = risk.get("studyId")
        matches = [
            version
            for version in self._state["versions"]
            if version.get("configVersion") == version_id and version.get("studyId") == study_id
        ]
        if len(matches) != 1:
            return {"traceable": False, "traceLabel": "无法溯源"}
        rules = [
            rule
            for rule in matches[0].get("rules", [])
            if rule.get("metric") == risk.get("metric")
        ]
        if len(rules) != 1:
            return {"traceable": False, "traceLabel": "无法溯源"}
        rule = rules[0]
        return {
            "traceable": True,
            "configVersion": matches[0]["configVersion"],
            "studyId": matches[0]["studyId"],
            "unit": rule["unit"],
            "warningThreshold": rule["warningThreshold"],
            "actionThreshold": rule["actionThreshold"],
        }

    def _find_risk(self, risk_id: str) -> dict[str, Any]:
        for risk in self._state["risks"]:
            if risk["id"] == risk_id:
                return risk
        raise RbqmError(404, "RISK_NOT_FOUND", "没有这条合成风险。")

    def _append_event(self, **kwargs: Any) -> None:
        number = len(self._state["events"]) + 1
        event = {
            "eventId": f"AUD-{number:04d}",
            "type": kwargs["event_type"],
            "at": self.clock(),
            "actorRole": kwargs["actor_role"],
            "actorName": kwargs["actor_name"],
            "fromStatus": kwargs["from_status"],
            "toStatus": kwargs["to_status"],
            "configVersion": kwargs.get("config_version") or self.config_version,
            "riskId": kwargs["risk_id"],
            "taskId": kwargs.get("task_id"),
            "capaId": kwargs.get("capa_id"),
            "inputBatchHash": self.input_batch_hash,
            "note": kwargs["note"],
            "before": kwargs.get("before") or {},
            "after": kwargs.get("after") or {},
        }
        self._state["events"].append(event)

    def _to_log(self, event: dict[str, Any]) -> dict[str, Any]:
        to_status = event.get("toStatus")
        event_type = event.get("type")
        if event_type == "THRESHOLD_SET":
            action = "UPDATE_THRESHOLD"
        elif to_status == "Closed":
            action = "CLOSE_ALERT"
        elif event_type == "TRANSITION" and to_status == "Action_In_Progress":
            action = "CREATE_TASK"
        elif to_status == "Effectiveness_Check":
            action = "RESOLVE_TASK"
        else:
            action = "STATE_TRANSITION"
        return {
            "logId": event["eventId"],
            "timestamp": event["at"],
            "userId": event["actorRole"],
            "userName": event["actorName"],
            "actionType": action,
            "description": event["note"],
            "details": {
                "riskId": event.get("riskId"),
                "fromStatus": event.get("fromStatus"),
                "toStatus": event.get("toStatus"),
                "configVersion": event.get("configVersion"),
                "inputBatchHash": event.get("inputBatchHash"),
                "taskId": event.get("taskId"),
                "capaId": event.get("capaId"),
            },
        }


def STUDY_SITE_FALLBACK(risk: dict[str, Any]) -> str:
    return risk.get("siteId") or "SYN-STUDY-001"


_store: Store | None = None


def get_store() -> Store:
    global _store
    if _store is None:
        _store = Store()
    return _store


def reset_store() -> Store:
    global _store
    _store = Store()
    return _store


def envelope(data: Any, store: Store | None = None) -> dict[str, Any]:
    current = store or get_store()
    return {
        "ok": True,
        "dataSourceMode": "synthetic",
        "isSynthetic": True,
        "disclaimer": DISCLAIMER,
        "configVersion": current.config_version,
        "inputBatchHash": current.input_batch_hash,
        "fallbackActive": False,
        "data": data,
    }
