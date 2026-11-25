"""Read-only lookup of the approved RBQM threshold a synthetic risk is bound to.

This reads the RBQM threshold version list only. It does not consult the CtQ
plan store, and it does not re-judge the risk.
"""

from __future__ import annotations

from typing import Any

UNTRACEABLE = "无法溯源"


def _number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def resolve_bound_threshold(risk: dict[str, Any], versions: list[dict[str, Any]]) -> dict[str, Any]:
    """Return the bound approved limits, or an untraceable marker.

    The match is exact on the risk's own configVersion and studyId, then on
    that version's rule for the same metric and scope. A missing version, a
    different study, or a missing rule does not fall back to the current
    version, the latest version, or another study's approved version.
    """
    failure = {"traceable": False, "label": UNTRACEABLE}
    version_id = risk.get("configVersion")
    study_id = risk.get("studyId")
    if not isinstance(version_id, str) or not version_id or not isinstance(study_id, str) or not study_id:
        return failure
    matched = [
        version
        for version in versions
        if version.get("configVersion") == version_id and version.get("studyId") == study_id
    ]
    if len(matched) != 1:
        return failure
    rules = [
        rule
        for rule in matched[0].get("rules") or []
        if rule.get("metric") == risk.get("metric")
        and rule.get("scope") == risk.get("scope")
        and rule.get("configVersion", version_id) == version_id
    ]
    if len(rules) != 1:
        return failure
    rule = rules[0]
    warning = _number(rule.get("warningThreshold"))
    action = _number(rule.get("actionThreshold"))
    unit = rule.get("unit")
    if warning is None or action is None or not isinstance(unit, str) or not unit:
        return failure
    payload: dict[str, Any] = {
        "traceable": True,
        "configVersion": version_id,
        "studyId": study_id,
        "unit": unit,
        "warningThreshold": warning,
        "actionThreshold": action,
    }
    threshold_id = rule.get("thresholdId")
    if isinstance(threshold_id, str) and threshold_id:
        payload["thresholdId"] = threshold_id
    return payload
