from __future__ import annotations

import numpy as np


def compute_correlation(x: list[float], y: list[float]) -> dict:
    xa, ya = np.array(x, dtype=float), np.array(y, dtype=float)
    n = len(xa)
    pearson = float(np.corrcoef(xa, ya)[0, 1]) if n > 1 else 0.0
    rank_x = xa.argsort().argsort().astype(float) + 1
    rank_y = ya.argsort().argsort().astype(float) + 1
    spearman = float(np.corrcoef(rank_x, rank_y)[0, 1]) if n > 1 else 0.0
    slope, intercept = np.polyfit(xa, ya, 1) if n > 1 else (0.0, 0.0)
    return {
        "pearson": round(pearson, 4),
        "spearman": round(spearman, 4),
        "slope": round(float(slope), 4),
        "intercept": round(float(intercept), 4),
    }
