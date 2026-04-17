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
