from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_benchmark_returns_one_row_per_site():
    r = client.get("/api/benchmark")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 10
    row = body[0]
    assert {"siteId", "name", "progressPct", "pdTotal", "pdZScore", "queryTotal"} <= set(row.keys())
