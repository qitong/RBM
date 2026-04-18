from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_forecast_returns_pd_and_ae_forecasts():
    r = client.get("/api/sites/101/forecast")
    assert r.status_code == 200
    body = r.json()
    assert body["siteId"] == "101"
    assert "pd" in body
    assert "ae" in body
    for key in ("pd", "ae"):
        assert "forecast" in body[key]
        assert "lower" in body[key]
        assert "upper" in body[key]
        assert len(body[key]["forecast"]) == 3


def test_forecast_with_custom_horizon():
    r = client.get("/api/sites/101/forecast?horizon=6")
    assert r.status_code == 200
    body = r.json()
    assert len(body["pd"]["forecast"]) == 6


def test_forecast_unknown_site_returns_404():
    r = client.get("/api/sites/999/forecast")
    assert r.status_code == 404


def test_forecast_includes_historical():
    r = client.get("/api/sites/101/forecast")
    body = r.json()
    assert "historical" in body
    assert "timeline" in body["historical"]
    assert "pd" in body["historical"]
    assert "ae" in body["historical"]
