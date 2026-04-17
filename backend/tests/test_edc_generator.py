from src.edc.generator import generate_sites


def test_generate_sites_returns_10_sites_with_seed():
    sites = generate_sites(seed=42)
    assert len(sites) == 10
    assert all("id" in s and "name" in s for s in sites)


def test_generate_sites_is_deterministic():
    a = generate_sites(seed=42)
    b = generate_sites(seed=42)
    assert a == b


def test_generate_sites_fields():
    sites = generate_sites(seed=42)
    s = sites[0]
    assert isinstance(s["id"], str)
    assert isinstance(s["name"], str)
    assert isinstance(s["enrolled"], int) and s["enrolled"] >= 0
    assert isinstance(s["target"], int) and s["target"] >= s["enrolled"]
    assert s["region"] in {"华东", "华北", "华南", "华西"}


def test_generate_site_metrics_shape():
    from src.edc.generator import generate_site_metrics
    m = generate_site_metrics(site_id="101", seed=42, months=12)
    assert len(m["timeline"]) == 12
    for key in ("pd", "ae", "enrollment", "query"):
        assert key in m
        assert len(m[key]) == 12
        assert all(isinstance(v, (int, float)) for v in m[key])


def test_generate_site_metrics_unknown_site_raises():
    from src.edc.generator import generate_site_metrics
    import pytest as _pt
    with _pt.raises(ValueError):
        generate_site_metrics(site_id="999", seed=42)
