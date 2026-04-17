from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_list_sites_returns_10():
    r = client.get("/api/sites")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 10
    assert {"id", "name", "enrolled", "target", "region", "pi"} <= set(body[0].keys())


def test_get_site_by_id():
    r = client.get("/api/sites/101")
    assert r.status_code == 200
    assert r.json()["id"] == "101"


def test_get_unknown_site_returns_404():
    r = client.get("/api/sites/999")
    assert r.status_code == 404
