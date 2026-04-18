from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_capa_list_returns_records():
    r = client.get("/api/capa")
    assert r.status_code == 200
    body = r.json()
    assert len(body) >= 10
    assert {"id", "siteId", "category", "openDate", "status"} <= set(body[0].keys())


def test_capa_efficiency_returns_metrics():
    r = client.get("/api/capa/efficiency")
    assert r.status_code == 200
    body = r.json()
    assert "avgCycleTimeDays" in body
    assert "medianCycleTimeDays" in body
    assert "closureRate" in body
    assert "bySite" in body
    assert "byCategory" in body
    assert isinstance(body["avgCycleTimeDays"], (int, float))
    assert 0 <= body["closureRate"] <= 1


def test_capa_efficiency_by_site_shape():
    r = client.get("/api/capa/efficiency")
    body = r.json()
    for entry in body["bySite"]:
        assert {"siteId", "avgCycleTimeDays", "count", "closureRate"} <= set(entry.keys())


def test_capa_efficiency_by_category_shape():
    r = client.get("/api/capa/efficiency")
    body = r.json()
    for entry in body["byCategory"]:
        assert {"category", "avgCycleTimeDays", "count"} <= set(entry.keys())
