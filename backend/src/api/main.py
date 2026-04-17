from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.edc.generator import generate_sites, generate_site_metrics

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
