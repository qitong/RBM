"""Map an approved monitoring plan onto the existing RBM threshold read model.

Only a version that is already approved produces rows. Candidates and rejected
drafts produce an empty list, so they cannot appear as effective rules.
"""

from __future__ import annotations

PENDING_CAPABILITIES = [
    {
        "id": "critical-data-extractor",
        "status": "pending_decision",
        "reason": "技能包没有 LICENSE，桌面路径会经 Claude 把方案送出本机。此项未迁入，也不调用外部模型。",
    }
]


def effective_thresholds(active: dict | None) -> list[dict]:
    if not active:
        return []
    if active.get("approvalStatus") != "approved" or active.get("status") != "approved":
        return []
    rows = []
    for item in active.get("legacyThresholdMap") or []:
        if item.get("source") != "approved_kri":
            continue
        category_id = item.get("rbmCategoryId")
        warning = item.get("warningThreshold")
        action = item.get("actionThreshold")
        if not category_id or warning is None or action is None:
            continue
        unit = item.get("unit")
        rows.append({
            "id": category_id,
            "labelKey": category_id,
            "warningThreshold": warning,
            "actionThreshold": action,
            "unit": unit,
            "appliesToSdPreset": unit == "SD",
            "monitoringMethod": item.get("monitoringMethod"),
            "candidateId": item.get("candidateId"),
            "versionId": active.get("versionId"),
            "approvedBy": active.get("approvedBy"),
            "readEntry": "ThresholdConfig",
            "effective": True,
        })
    return rows
