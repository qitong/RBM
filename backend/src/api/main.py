from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.edc.generator import (generate_sites, generate_site_metrics,
                                generate_investigators, generate_investigator_metrics,
                                generate_capa_records)
from src.edc.correlation import compute_correlation
from src.edc.forecast import linear_forecast

app = FastAPI(title="RBM API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/sites")
def list_sites():
    return generate_sites(seed=42)


@app.get("/api/sites/{site_id}")
def get_site(site_id: str):
    sites = {s["id"]: s for s in generate_sites(seed=42)}
    if site_id not in sites:
        raise HTTPException(status_code=404, detail="site not found")
    return sites[site_id]


@app.get("/api/sites/{site_id}/metrics")
def get_site_metrics(site_id: str):
    try:
        return generate_site_metrics(site_id=site_id, seed=42)
    except ValueError:
        raise HTTPException(status_code=404, detail="site not found")


@app.get("/api/sites/{site_id}/forecast")
def get_site_forecast(site_id: str, horizon: int = 3):
    try:
        m = generate_site_metrics(site_id=site_id, seed=42)
    except ValueError:
        raise HTTPException(status_code=404, detail="site not found")
    pd_fc = linear_forecast(m["pd"], horizon=horizon)
    ae_fc = linear_forecast(m["ae"], horizon=horizon)
    last_month = int(m["timeline"][-1].split("-")[1])
    last_year = int(m["timeline"][-1].split("-")[0])
    future_timeline = []
    for i in range(1, horizon + 1):
        nm = last_month + i
        ny = last_year + (nm - 1) // 12
        nm = ((nm - 1) % 12) + 1
        future_timeline.append(f"{ny}-{nm:02d}")
    return {
        "siteId": site_id,
        "historical": {
            "timeline": m["timeline"],
            "pd": m["pd"],
            "ae": m["ae"],
        },
        "forecastTimeline": future_timeline,
        "pd": pd_fc,
        "ae": ae_fc,
    }


@app.get("/api/benchmark")
def benchmark():
    import statistics
    sites = generate_sites(seed=42)
    enriched = []
    for s in sites:
        m = generate_site_metrics(site_id=s["id"], seed=42)
        enriched.append({
            **s,
            "pdTotal": sum(m["pd"]),
            "queryTotal": sum(m["query"]),
            "progressPct": round(s["enrolled"] / s["target"] * 100, 1) if s["target"] else 0,
        })
    pd_totals = [e["pdTotal"] for e in enriched]
    mean_pd = statistics.mean(pd_totals)
    sd_pd = statistics.pstdev(pd_totals) or 1
    return [
        {
            "siteId": e["id"],
            "name": e["name"],
            "progressPct": e["progressPct"],
            "pdTotal": e["pdTotal"],
            "pdZScore": round((e["pdTotal"] - mean_pd) / sd_pd, 3),
            "queryTotal": e["queryTotal"],
        }
        for e in enriched
    ]


@app.get("/api/correlation")
def correlation():
    sites = generate_sites(seed=42)
    points = []
    pd_totals = []
    query_totals = []
    for s in sites:
        m = generate_site_metrics(site_id=s["id"], seed=42)
        pd_t = sum(m["pd"])
        q_t = sum(m["query"])
        pd_totals.append(pd_t)
        query_totals.append(q_t)
        points.append({
            "siteId": s["id"],
            "name": s["name"],
            "pdTotal": pd_t,
            "queryTotal": q_t,
        })
    corr = compute_correlation(pd_totals, query_totals)
    return {"points": points, **corr}


@app.get("/api/investigators")
def list_investigators():
    return generate_investigators(seed=42)


@app.get("/api/investigators/{inv_id}")
def get_investigator(inv_id: str):
    investigators = {i["id"]: i for i in generate_investigators(seed=42)}
    if inv_id not in investigators:
        raise HTTPException(status_code=404, detail="investigator not found")
    return investigators[inv_id]


@app.get("/api/investigators/{inv_id}/metrics")
def get_investigator_metrics(inv_id: str):
    try:
        return generate_investigator_metrics(investigator_id=inv_id, seed=42)
    except ValueError:
        raise HTTPException(status_code=404, detail="investigator not found")


@app.get("/api/capa/efficiency")
def capa_efficiency():
    import statistics
    from collections import defaultdict
    records = generate_capa_records(seed=42)
    closed = [r for r in records if r["status"] == "closed"]
    cycles = [r["cycleTimeDays"] for r in closed]
    avg_cycle = round(statistics.mean(cycles), 1) if cycles else 0
    median_cycle = round(statistics.median(cycles), 1) if cycles else 0
    closure_rate = round(len(closed) / len(records), 3) if records else 0
    site_map: dict[str, list[int]] = defaultdict(list)
    site_total: dict[str, int] = defaultdict(int)
    for r in records:
        site_total[r["siteId"]] += 1
        if r["status"] == "closed":
            site_map[r["siteId"]].append(r["cycleTimeDays"])
    by_site = []
    for sid in sorted(site_total.keys()):
        sc = site_map[sid]
        by_site.append({
            "siteId": sid,
            "avgCycleTimeDays": round(statistics.mean(sc), 1) if sc else 0,
            "count": site_total[sid],
            "closureRate": round(len(sc) / site_total[sid], 3) if site_total[sid] else 0,
        })
    cat_map: dict[str, list[int]] = defaultdict(list)
    cat_total: dict[str, int] = defaultdict(int)
    for r in records:
        cat_total[r["category"]] += 1
        if r["status"] == "closed":
            cat_map[r["category"]].append(r["cycleTimeDays"])
    by_category = []
    for cat in sorted(cat_total.keys()):
        cc = cat_map[cat]
        by_category.append({
            "category": cat,
            "avgCycleTimeDays": round(statistics.mean(cc), 1) if cc else 0,
            "count": cat_total[cat],
        })
    return {
        "avgCycleTimeDays": avg_cycle,
        "medianCycleTimeDays": median_cycle,
        "closureRate": closure_rate,
        "bySite": by_site,
        "byCategory": by_category,
    }


@app.get("/api/capa")
def list_capa():
    return generate_capa_records(seed=42)
