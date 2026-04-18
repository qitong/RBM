from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_list_investigators():
    r = client.get("/api/investigators")
    assert r.status_code == 200
    body = r.json()
    assert len(body) >= 5
    inv = body[0]
    assert {"id", "name", "experience", "siteIds"} <= set(inv.keys())


def test_get_investigator_by_id():
    r = client.get("/api/investigators/INV-001")
    assert r.status_code == 200
    assert r.json()["id"] == "INV-001"


def test_get_unknown_investigator_returns_404():
    r = client.get("/api/investigators/INV-999")
    assert r.status_code == 404


def test_get_investigator_metrics():
    r = client.get("/api/investigators/INV-001/metrics")
    assert r.status_code == 200
    body = r.json()
    assert body["investigatorId"] == "INV-001"
    assert len(body["timeline"]) == 12
    assert "pdByCategory" in body
    assert "pdTotal" in body


def test_get_investigator_metrics_unknown_returns_404():
    r = client.get("/api/investigators/INV-999/metrics")
    assert r.status_code == 404
