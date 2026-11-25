"""One pending study-level candidate from repeated synthetic site exceedances.

The candidate is not a study QTL signal. It is stored on the RBQM seed, not in
the CtQ plan file. A person must confirm it before it joins the study-level
list. Confirmation still does not create a QTL risk.
"""

from __future__ import annotations

import math
import re
from typing import Any

from src.rbqm.service import RbqmError
from src.rbqm.synthetic import SITE_IDS, STUDY_ID, screen_batch

_METRIC = re.compile(r"^[a-z][a-z0-9_]{0,40}$")
_DATE = re.compile(r"^2026-\d{2}-\d{2}$")


def _key(site_id: str, metric: str) -> str:
    return f"{site_id}|{metric}"


def candidate_id(site_id: str, metric: str) -> str:
    return f"CAND-{site_id}-{metric}"


def site_rule(rules: list[dict[str, Any]], metric: str) -> dict[str, Any]:
    matched = [
        rule
        for rule in rules
        if rule.get("scope") == "site_kri" and rule.get("metric") == metric
    ]
    if not matched:
        raise RbqmError(422, "SITE_RULE_MISSING", "这条指标没有中心级界限，未生成候选。")
    if len(matched) != 1:
        raise RbqmError(422, "AMBIGUOUS_SITE_RULE", "中心级界限不唯一，未生成候选。")
    return matched[0]


def exceeds_action(value: float, rule: dict[str, Any]) -> bool:
    action = float(rule["actionThreshold"])
    if rule.get("unit") == "SD":
        return abs(value) >= action
    return value >= action


def validate_observations(rules: list[dict[str, Any]], observations: list[dict[str, Any]]) -> None:
    if not observations:
        raise RbqmError(422, "EMPTY_OBSERVATIONS", "没有合成观察值，未生成候选。")
    screen_batch(observations)
    field_errors: list[dict[str, str]] = []
    metrics: list[str] = []
    for index, row in enumerate(observations):
        prefix = f"observations[{index}]"
        if row.get("studyId") != STUDY_ID:
            field_errors.append({"field": f"{prefix}.studyId", "code": "STUDY"})
        if row.get("siteId") not in SITE_IDS:
            field_errors.append({"field": f"{prefix}.siteId", "code": "SITE"})
        metric = row.get("metric")
        if not isinstance(metric, str) or not _METRIC.fullmatch(metric):
            field_errors.append({"field": f"{prefix}.metric", "code": "METRIC"})
        else:
            metrics.append(metric)
        value = row.get("value")
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
            field_errors.append({"field": f"{prefix}.value", "code": "VALUE"})
        observed_at = row.get("observedAt")
        if not isinstance(observed_at, str) or not _DATE.fullmatch(observed_at):
            field_errors.append({"field": f"{prefix}.observedAt", "code": "DATE"})
    if field_errors:
        raise RbqmError(
            422,
            "OBSERVATION_INVALID",
            "合成观察值不合格，未生成候选。",
            field_errors=field_errors,
        )
    for metric in metrics:
        site_rule(rules, metric)


def observation_identity(row: dict[str, Any]) -> str:
    """One synthetic reading. Replaying the same fields does not count again."""
    value = format(float(row["value"]), ".12g")
    return "|".join((
        str(row.get("studyId")),
        str(row.get("siteId")),
        str(row.get("metric")),
        value,
        str(row.get("observedAt")),
    ))


def fold_exceedances(
    candidates: list[dict[str, Any]],
    counts: dict[str, int],
    rules: list[dict[str, Any]],
    observations: list[dict[str, Any]],
    seen: set[str],
) -> list[str]:
    """Count action-bound crossings. Open at most one pending candidate per site and metric."""
    created: list[str] = []
    for row in observations:
        identity = observation_identity(row)
        if identity in seen:
            continue
        seen.add(identity)
        rule = site_rule(rules, str(row["metric"]))
        if not exceeds_action(float(row["value"]), rule):
            continue
        key = _key(str(row["siteId"]), str(row["metric"]))
        counts[key] = counts.get(key, 0) + 1
        existing = next((item for item in candidates if item["id"] == candidate_id(str(row["siteId"]), str(row["metric"]))), None)
        if existing is not None:
            existing["exceedanceCount"] = counts[key]
            continue
        if counts[key] < 2:
            continue
        item = {
            "id": candidate_id(str(row["siteId"]), str(row["metric"])),
            "status": "pending_confirmation",
            "studyId": STUDY_ID,
            "siteId": str(row["siteId"]),
            "metric": str(row["metric"]),
            "unit": rule.get("unit"),
            "actionThreshold": float(rule["actionThreshold"]),
            "configVersion": rule.get("configVersion"),
            "exceedanceCount": counts[key],
            "scope": "study_candidate",
            "riskId": None,
        }
        candidates.append(item)
        created.append(item["id"])
    return created


def public_view(candidates: list[dict[str, Any]], risks: list[dict[str, Any]]) -> dict[str, Any]:
    pending = [dict(item) for item in candidates if item.get("status") == "pending_confirmation"]
    study_level = [dict(item) for item in candidates if item.get("status") == "confirmed"]
    study_qtl_ids = [risk["id"] for risk in risks if risk.get("scope") == "study_qtl"]
    return {
        "pending": pending,
        "studyLevel": study_level,
        "studyQtlIds": study_qtl_ids,
    }
