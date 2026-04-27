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


def compute_trend_with_confidence(x: list[float], y: list[float],
                                 confidence: float = 1.96) -> dict:
    """Compute trend line and confidence interval for regression.

    Args:
        x: List of x values (e.g., progress percentages)
        y: List of y values (e.g., PD z-scores)
        confidence: Confidence multiplier (1.96 for 95% CI)

    Returns:
        Dict containing trend line points and confidence bands
    """
    xa, ya = np.array(x, dtype=float), np.array(y, dtype=float)
    n = len(xa)

    if n < 2:
        return {
            "trendLine": [],
            "upperBand": [],
            "lowerBand": [],
            "slope": 0.0,
            "intercept": 0.0,
            "r_squared": 0.0,
        }

    # Linear regression
    slope, intercept = np.polyfit(xa, ya, 1)

    # Create smooth x range for trend line
    x_min, x_max = float(xa.min()), float(xa.max())
    x_trend = np.linspace(x_min, x_max, 50)
    y_trend = slope * x_trend + intercept

    # Calculate residuals and standard error
    y_hat = slope * xa + intercept
    residuals = ya - y_hat
    mse = np.sum(residuals ** 2) / max(n - 2, 1)
    se = np.sqrt(mse)

    # Calculate standard error of prediction for each point
    x_mean = np.mean(xa)
    ss_x = np.sum((xa - x_mean) ** 2)

    # Prediction interval (wider than confidence interval)
    se_pred = se * np.sqrt(1 + 1/n + (x_trend - x_mean)**2 / ss_x)

    # Confidence bands
    upper_band = y_trend + confidence * se_pred
    lower_band = y_trend - confidence * se_pred

    # R-squared
    ss_res = np.sum(residuals ** 2)
    ss_tot = np.sum((ya - np.mean(ya)) ** 2)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    return {
        "trendLine": [{"x": float(x), "y": float(y)} for x, y in zip(x_trend, y_trend)],
        "upperBand": [{"x": float(x), "y": float(y)} for x, y in zip(x_trend, upper_band)],
        "lowerBand": [{"x": float(x), "y": float(y)} for x, y in zip(x_trend, lower_band)],
        "slope": round(float(slope), 4),
        "intercept": round(float(intercept), 4),
        "r_squared": round(float(r_squared), 4),
    }
