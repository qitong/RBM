from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_correlation_returns_scatter_data_and_coefficients():
    r = client.get("/api/correlation")
    assert r.status_code == 200
    body = r.json()
    assert "points" in body
    assert "pearson" in body
    assert "spearman" in body
    assert "slope" in body
    assert "intercept" in body
    assert len(body["points"]) == 10


def test_correlation_point_shape():
    r = client.get("/api/correlation")
    body = r.json()
    pt = body["points"][0]
    assert {"siteId", "name", "pdTotal", "queryTotal"} <= set(pt.keys())
