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
