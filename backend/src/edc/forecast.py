from __future__ import annotations

import numpy as np


def linear_forecast(historical: list[float], horizon: int = 3,
                    confidence: float = 1.96) -> dict:
    y = np.array(historical, dtype=float)
    n = len(y)
    x = np.arange(n, dtype=float)
    slope, intercept = np.polyfit(x, y, 1)
    y_hat = slope * x + intercept
    residuals = y - y_hat
    se = float(np.sqrt(np.sum(residuals ** 2) / max(n - 2, 1)))
    x_future = np.arange(n, n + horizon, dtype=float)
    forecast = (slope * x_future + intercept).tolist()
    lower = [(v - confidence * se) for v in forecast]
    upper = [(v + confidence * se) for v in forecast]
    return {
        "forecast": [round(v, 2) for v in forecast],
        "lower": [round(v, 2) for v in lower],
        "upper": [round(v, 2) for v in upper],
        "slope": round(float(slope), 4),
        "intercept": round(float(intercept), 4),
    }
