from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.edc.generator import generate_sites, generate_site_metrics
from src.edc.correlation import compute_correlation

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
