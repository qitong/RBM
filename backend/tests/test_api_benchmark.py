from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_benchmark_returns_one_row_per_site():
    r = client.get("/api/benchmark")
    assert r.status_code == 200
    body = r.json()
    assert "points" in body
    assert "trend" in body
    assert len(body["points"]) == 10
    row = body["points"][0]
    assert {"siteId", "name", "progressPct", "pdTotal", "pdZScore", "queryTotal"} <= set(row.keys())


def test_benchmark_includes_trend_analysis():
    r = client.get("/api/benchmark")
    assert r.status_code == 200
    body = r.json()
    trend = body["trend"]
    assert "trendLine" in trend
    assert "upperBand" in trend
    assert "lowerBand" in trend
    assert "slope" in trend
    assert "intercept" in trend
    assert "r_squared" in trend
    assert isinstance(trend["trendLine"], list)
    assert isinstance(trend["upperBand"], list)
    assert isinstance(trend["lowerBand"], list)
    # Should have same number of points in all trend arrays
    assert len(trend["trendLine"]) == len(trend["upperBand"]) == len(trend["lowerBand"])
