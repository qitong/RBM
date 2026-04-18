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


def test_generate_investigators_returns_list():
    from src.edc.generator import generate_investigators
    investigators = generate_investigators(seed=42)
    assert len(investigators) >= 5
    inv = investigators[0]
    assert {"id", "name", "experience", "siteIds"} <= set(inv.keys())
    assert isinstance(inv["siteIds"], list)
    assert len(inv["siteIds"]) >= 1


def test_generate_investigators_is_deterministic():
    from src.edc.generator import generate_investigators
    a = generate_investigators(seed=42)
    b = generate_investigators(seed=42)
    assert a == b


def test_generate_investigator_metrics_shape():
    from src.edc.generator import generate_investigator_metrics
    m = generate_investigator_metrics(investigator_id="INV-001", seed=42, months=12)
    assert m["investigatorId"] == "INV-001"
    assert len(m["timeline"]) == 12
    for key in ("pdByCategory", "pdTotal", "aeCounts"):
        assert key in m


def test_generate_investigator_metrics_unknown_raises():
    from src.edc.generator import generate_investigator_metrics
    import pytest as _pt
    with _pt.raises(ValueError):
        generate_investigator_metrics(investigator_id="INV-999", seed=42)
