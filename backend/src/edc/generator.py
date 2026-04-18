from __future__ import annotations

import numpy as np

SITE_IDS = ["101", "102", "105", "201", "203", "302", "305", "401", "402", "501"]
REGIONS = ["华东", "华北", "华南", "华西"]


def generate_sites(seed: int = 42) -> list[dict]:
    rng = np.random.default_rng(seed)
    sites = []
    for sid in SITE_IDS:
        target = int(rng.integers(40, 80))
        enrolled = int(rng.integers(0, target + 1))
        sites.append({
            "id": sid,
            "name": f"中心 {sid}",
            "region": REGIONS[int(rng.integers(0, len(REGIONS)))],
            "enrolled": enrolled,
            "target": target,
            "pi": f"研究者 {sid}",
        })
    return sites


INVESTIGATOR_IDS = ["INV-001", "INV-002", "INV-003", "INV-004", "INV-005",
                    "INV-006", "INV-007", "INV-008"]

PD_CATEGORIES = ["\u77E5\u60C5\u540C\u610F", "\u5165\u6392\u6807\u51C6", "\u8BD5\u9A8C\u7528\u836F",
                 "\u5B89\u5168\u6027\u62A5\u544A", "\u8BBF\u89C6\u4E0E\u68C0\u67E5"]


def generate_site_metrics(site_id: str, seed: int = 42, months: int = 12) -> dict:
    if site_id not in SITE_IDS:
        raise ValueError(f"unknown site_id: {site_id}")
    rng = np.random.default_rng(seed + int(site_id))
    timeline = [f"2025-{m:02d}" for m in range(1, months + 1)]
    return {
        "siteId": site_id,
        "timeline": timeline,
        "pd": [int(rng.integers(0, 8)) for _ in range(months)],
        "ae": [int(rng.integers(0, 5)) for _ in range(months)],
        "enrollment": list(np.cumsum(rng.integers(1, 6, size=months)).astype(int).tolist()),
        "query": [int(rng.integers(0, 12)) for _ in range(months)],
    }


def generate_investigators(seed: int = 42) -> list[dict]:
    rng = np.random.default_rng(seed + 1000)
    investigators = []
    for iid in INVESTIGATOR_IDS:
        exp = str(rng.choice(["senior", "mid", "junior"]))
        n_sites = int(rng.integers(1, 4))
        assigned = rng.choice(SITE_IDS, size=min(n_sites, len(SITE_IDS)), replace=False)
        investigators.append({
            "id": iid,
            "name": f"\u7814\u7A76\u8005 {iid[-3:]}",
            "experience": exp,
            "siteIds": sorted(assigned.tolist()),
        })
    for inv in investigators:
        if inv["id"] == "INV-003":
            inv["experience"] = "junior"
    return investigators


def generate_investigator_metrics(investigator_id: str, seed: int = 42,
                                  months: int = 12) -> dict:
    if investigator_id not in INVESTIGATOR_IDS:
        raise ValueError(f"unknown investigator_id: {investigator_id}")
    rng = np.random.default_rng(seed + hash(investigator_id) % 10000)
    timeline = [f"2025-{m:02d}" for m in range(1, months + 1)]
    is_junior = investigator_id == "INV-003"
    pd_by_category: dict[str, list[int]] = {}
    for cat in PD_CATEGORIES:
        base_max = 10 if (is_junior and cat == "\u8BBF\u89C6\u4E0E\u68C0\u67E5") else 4
        pd_by_category[cat] = [int(rng.integers(0, base_max)) for _ in range(months)]
    pd_total = [sum(pd_by_category[c][i] for c in PD_CATEGORIES) for i in range(months)]
    ae_counts = [int(rng.integers(0, 5)) for _ in range(months)]
    return {
        "investigatorId": investigator_id,
        "timeline": timeline,
        "pdByCategory": pd_by_category,
        "pdTotal": pd_total,
        "aeCounts": ae_counts,
    }


def generate_capa_records(seed: int = 42, count: int = 30) -> list[dict]:
    rng = np.random.default_rng(seed + 2000)
    records = []
    for i in range(count):
        site_id = str(rng.choice(SITE_IDS))
        category = str(rng.choice(PD_CATEGORIES))
        open_day = int(rng.integers(1, 300))
        status = str(rng.choice(["open", "closed", "closed", "closed"]))
        cycle = int(rng.integers(3, 45)) if status == "closed" else 0
        close_day = open_day + cycle
        open_date = f"2025-{((open_day - 1) // 30 + 1):02d}-{((open_day - 1) % 30 + 1):02d}"
        close_date = f"2025-{((close_day - 1) // 30 + 1):02d}-{((close_day - 1) % 30 + 1):02d}" if status == "closed" else ""
        record: dict = {
            "id": f"CAPA-{i + 1:03d}",
            "siteId": site_id,
            "category": category,
            "openDate": open_date,
            "closeDate": close_date,
            "status": status,
        }
        if status == "closed":
            record["cycleTimeDays"] = cycle
        records.append(record)
    return records
