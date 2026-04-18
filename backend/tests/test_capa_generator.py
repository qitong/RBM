from src.edc.generator import generate_capa_records


def test_generate_capa_records_returns_list():
    records = generate_capa_records(seed=42)
    assert len(records) >= 10
    r = records[0]
    assert {"id", "siteId", "category", "openDate", "closeDate", "status"} <= set(r.keys())


def test_generate_capa_records_is_deterministic():
    a = generate_capa_records(seed=42)
    b = generate_capa_records(seed=42)
    assert a == b


def test_capa_dates_are_valid():
    records = generate_capa_records(seed=42)
    for r in records:
        assert r["openDate"] < r["closeDate"] or r["status"] == "open"


def test_capa_cycle_time_field():
    records = generate_capa_records(seed=42)
    closed = [r for r in records if r["status"] == "closed"]
    assert len(closed) > 0
    for r in closed:
        assert "cycleTimeDays" in r
        assert isinstance(r["cycleTimeDays"], int)
        assert r["cycleTimeDays"] > 0
