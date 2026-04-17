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
