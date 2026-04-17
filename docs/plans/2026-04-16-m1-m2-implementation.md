# M1 + M2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up FastAPI backend + EDC mock generator, wire frontend through React Query with mock/api toggle, then deliver Site Deep Dive and Cross-Site Benchmarking views.

**Architecture:** Backend = FastAPI exposing `/api/sites`, `/api/sites/:id`, `/api/sites/:id/metrics`, `/api/benchmark`; data is generated deterministically by `edc_generator.py` (seeded numpy RNG). Frontend = React Query hooks reading via `apiClient.ts`; `DataSourceContext` toggles between `data.json` and API based on `VITE_DATA_SOURCE`. Routing migrates from `useState` tabs to `react-router-dom` so `/sites/:id` and `/benchmark` are addressable.

**Tech Stack:**
- Backend: FastAPI, uvicorn, pydantic, numpy, pytest
- Frontend: React 19 + Vite 8, @tanstack/react-query, react-router-dom, msw, recharts, vitest + RTL

---

## Conventions

- TDD strictly: every task = write failing test → run (verify red) → implement → run (verify green) → commit.
- One logical change per commit. Commit messages: `feat(backend):`, `feat(frontend):`, `test:`, `chore:`.
- Backend tests: `cd backend && pytest <path>`. Frontend tests: `cd frontend && npm test -- <path>`.
- Never commit secrets. Never `git add -A`.

---

## Phase M1.A — Backend Foundation

### Task 1: Backend dependencies

**Files:**
- Modify: `backend/pyproject.toml`

**Step 1:** Edit `backend/pyproject.toml`, replace the `dependencies = []` line and the `dev` extra with:

```toml
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "pydantic>=2.9",
    "numpy>=1.26",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-cov>=5.0",
    "httpx>=0.27",
]
```

**Step 2:** Verify pytest still runs. Run: `cd backend && pytest --collect-only`. Expected: collects nothing (no tests yet) without import errors.

**Step 3:** Commit.

```bash
cd /Users/qitonghu/Desktop/RBM2
git add backend/pyproject.toml
git commit -m "chore(backend): add FastAPI + numpy + httpx deps"
```

---

### Task 2: EDC site generator (pure)

**Files:**
- Create: `backend/src/edc/__init__.py` (empty)
- Create: `backend/src/edc/generator.py`
- Create: `backend/tests/test_edc_generator.py`

**Step 1:** Write the failing test in `backend/tests/test_edc_generator.py`:

```python
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
```

**Step 2:** Run: `cd backend && pytest tests/test_edc_generator.py -v`. Expected: ImportError on `src.edc.generator`.

**Step 3:** Create `backend/src/edc/generator.py`:

```python
from __future__ import annotations

import numpy as np

SITE_IDS = ["101", "102", "105", "201", "203", "302", "305", "401", "402", "501"]
REGIONS = ["华东", "华北", "华南", "华西"]


def generate_sites(seed: int = 42) -> list[dict]:
    rng = np.random.default_rng(seed)
    sites = []
    for sid in SITE_IDS:
        target = int(rng.integers(40, 80))
        enrolled = int(rng.integers(0, target + 1))
        sites.append({
            "id": sid,
            "name": f"中心 {sid}",
            "region": REGIONS[int(rng.integers(0, len(REGIONS)))],
            "enrolled": enrolled,
            "target": target,
            "pi": f"研究者 {sid}",
        })
    return sites
```

**Step 4:** Run: `cd backend && pytest tests/test_edc_generator.py -v`. Expected: 3 passed.

**Step 5:** Commit.

```bash
git add backend/src/edc/__init__.py backend/src/edc/generator.py backend/tests/test_edc_generator.py
git commit -m "feat(backend): seeded EDC site generator"
```

---

### Task 3: EDC site metrics generator

**Files:**
- Modify: `backend/src/edc/generator.py`
- Modify: `backend/tests/test_edc_generator.py`

**Step 1:** Append a failing test to `backend/tests/test_edc_generator.py`:

```python
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
```

**Step 2:** Run: `cd backend && pytest tests/test_edc_generator.py -v`. Expected: 2 fail with ImportError on `generate_site_metrics`.

**Step 3:** Append to `backend/src/edc/generator.py`:

```python
def generate_site_metrics(site_id: str, seed: int = 42, months: int = 12) -> dict:
    if site_id not in SITE_IDS:
        raise ValueError(f"unknown site_id: {site_id}")
    rng = np.random.default_rng(seed + int(site_id))
    timeline = [f"2025-{m:02d}" for m in range(1, months + 1)]
    return {
        "siteId": site_id,
        "timeline": timeline,
        "pd": [int(rng.integers(0, 8)) for _ in range(months)],
        "ae": [int(rng.integers(0, 5)) for _ in range(months)],
        "enrollment": list(np.cumsum(rng.integers(1, 6, size=months)).astype(int).tolist()),
        "query": [int(rng.integers(0, 12)) for _ in range(months)],
    }
```

**Step 4:** Run: `cd backend && pytest tests/test_edc_generator.py -v`. Expected: 5 passed.

**Step 5:** Commit.

```bash
git add backend/src/edc/generator.py backend/tests/test_edc_generator.py
git commit -m "feat(backend): EDC site metrics generator"
```

---

### Task 4: FastAPI app + health endpoint

**Files:**
- Create: `backend/src/api/__init__.py` (empty)
- Create: `backend/src/api/main.py`
- Create: `backend/tests/test_api_health.py`

**Step 1:** Write the failing test in `backend/tests/test_api_health.py`:

```python
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_health_returns_ok():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
```

**Step 2:** Run: `cd backend && pytest tests/test_api_health.py -v`. Expected: ImportError on `src.api.main`.

**Step 3:** Create `backend/src/api/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
```

**Step 4:** Run: `cd backend && pytest tests/test_api_health.py -v`. Expected: 1 passed.

**Step 5:** Commit.

```bash
git add backend/src/api/__init__.py backend/src/api/main.py backend/tests/test_api_health.py
git commit -m "feat(backend): FastAPI app skeleton + health endpoint + CORS"
```

---

### Task 5: GET /api/sites + GET /api/sites/{id}

**Files:**
- Modify: `backend/src/api/main.py`
- Create: `backend/tests/test_api_sites.py`

**Step 1:** Write the failing test in `backend/tests/test_api_sites.py`:

```python
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
```

**Step 2:** Run: `cd backend && pytest tests/test_api_sites.py -v`. Expected: 3 fail (404 on `/api/sites`).

**Step 3:** Append to `backend/src/api/main.py`:

```python
from fastapi import HTTPException
from src.edc.generator import generate_sites, generate_site_metrics


@app.get("/api/sites")
def list_sites():
    return generate_sites(seed=42)


@app.get("/api/sites/{site_id}")
def get_site(site_id: str):
    sites = {s["id"]: s for s in generate_sites(seed=42)}
    if site_id not in sites:
        raise HTTPException(status_code=404, detail="site not found")
    return sites[site_id]
```

**Step 4:** Run: `cd backend && pytest tests/test_api_sites.py -v`. Expected: 3 passed.

**Step 5:** Commit.

```bash
git add backend/src/api/main.py backend/tests/test_api_sites.py
git commit -m "feat(backend): GET /api/sites and /api/sites/:id"
```

---

### Task 6: GET /api/sites/{id}/metrics

**Files:**
- Modify: `backend/src/api/main.py`
- Modify: `backend/tests/test_api_sites.py`

**Step 1:** Append to `backend/tests/test_api_sites.py`:

```python
def test_get_site_metrics():
    r = client.get("/api/sites/101/metrics")
    assert r.status_code == 200
    body = r.json()
    assert body["siteId"] == "101"
    assert len(body["timeline"]) == 12
    assert len(body["pd"]) == 12


def test_get_site_metrics_unknown_site_returns_404():
    r = client.get("/api/sites/999/metrics")
    assert r.status_code == 404
```

**Step 2:** Run: `cd backend && pytest tests/test_api_sites.py -v`. Expected: 2 new tests fail.

**Step 3:** Append to `backend/src/api/main.py`:

```python
@app.get("/api/sites/{site_id}/metrics")
def get_site_metrics(site_id: str):
    try:
        return generate_site_metrics(site_id=site_id, seed=42)
    except ValueError:
        raise HTTPException(status_code=404, detail="site not found")
```

**Step 4:** Run: `cd backend && pytest tests/test_api_sites.py -v`. Expected: 5 passed.

**Step 5:** Commit.

```bash
git add backend/src/api/main.py backend/tests/test_api_sites.py
git commit -m "feat(backend): GET /api/sites/:id/metrics"
```

---

### Task 7: Manual smoke test of dev server

**Step 1:** Start the server in a background terminal: `cd backend && uvicorn src.api.main:app --reload --port 8000`

**Step 2:** In another shell, hit each endpoint:

```bash
curl -s http://localhost:8000/api/health
curl -s http://localhost:8000/api/sites | head -c 200
curl -s http://localhost:8000/api/sites/101/metrics | head -c 200
```

Expected: JSON responses for each. Stop the server when done.

**Step 3:** No commit (smoke test only).

---

## Phase M1.B — Frontend Pipeline

### Task 8: Frontend dependencies

**Files:**
- Modify: `frontend/package.json` (via `npm install`)

**Step 1:** Run:

```bash
cd frontend
npm install --save @tanstack/react-query react-router-dom
npm install --save-dev msw @tanstack/react-query-devtools
```

**Step 2:** Verify install. Run: `cd frontend && npm test -- --run`. Expected: existing 16 tests still green.

**Step 3:** Commit.

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): add react-query, react-router-dom, msw"
```

---

### Task 9: API client

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/test/apiClient.test.ts`

**Step 1:** Write the failing test in `frontend/src/test/apiClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiGet, ApiError } from '../api/client'

describe('apiGet', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns parsed JSON on 200', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }))
    const data = await apiGet<{ ok: number }>('/api/x')
    expect(data).toEqual({ ok: 1 })
  })

  it('throws ApiError on non-2xx', async () => {
    (fetch as any).mockResolvedValue(new Response('boom', { status: 500 }))
    await expect(apiGet('/api/x')).rejects.toBeInstanceOf(ApiError)
  })

  it('uses VITE_API_BASE_URL when set', async () => {
    (fetch as any).mockResolvedValue(new Response('{}', { status: 200 }))
    import.meta.env.VITE_API_BASE_URL = 'http://api.test'
    await apiGet('/api/x')
    expect((fetch as any).mock.calls[0][0]).toBe('http://api.test/api/x')
  })
})
```

**Step 2:** Run: `cd frontend && npm test -- src/test/apiClient.test.ts`. Expected: 3 fail with module-not-found.

**Step 3:** Create `frontend/src/api/client.ts`:

```typescript
export class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`API ${status}: ${body}`)
  }
}

const baseUrl = () => (import.meta.env.VITE_API_BASE_URL ?? '').toString()

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`)
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return (await res.json()) as T
}
```

**Step 4:** Run: `cd frontend && npm test -- src/test/apiClient.test.ts`. Expected: 3 passed.

**Step 5:** Commit.

```bash
git add frontend/src/api/client.ts frontend/src/test/apiClient.test.ts
git commit -m "feat(frontend): typed apiGet client + ApiError"
```

---

### Task 10: DataSourceContext

**Files:**
- Create: `frontend/src/context/DataSourceContext.tsx`
- Create: `frontend/src/test/DataSourceContext.test.tsx`

**Step 1:** Write the failing test in `frontend/src/test/DataSourceContext.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { DataSourceProvider, useDataSource } from '../context/DataSourceContext'

describe('useDataSource', () => {
  it('defaults to "mock" when env unset', () => {
    delete (import.meta.env as any).VITE_DATA_SOURCE
    const { result } = renderHook(() => useDataSource(), { wrapper: DataSourceProvider })
    expect(result.current.source).toBe('mock')
  })

  it('reads "api" from env', () => {
    (import.meta.env as any).VITE_DATA_SOURCE = 'api'
    const { result } = renderHook(() => useDataSource(), { wrapper: DataSourceProvider })
    expect(result.current.source).toBe('api')
  })
})
```

**Step 2:** Run: `cd frontend && npm test -- src/test/DataSourceContext.test.tsx`. Expected: fail with module-not-found.

**Step 3:** Create `frontend/src/context/DataSourceContext.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react'

export type DataSource = 'mock' | 'api'

interface Ctx { source: DataSource }

const DataSourceContext = createContext<Ctx | undefined>(undefined)

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const env = (import.meta.env.VITE_DATA_SOURCE ?? 'mock') as DataSource
  const source: DataSource = env === 'api' ? 'api' : 'mock'
  return <DataSourceContext.Provider value={{ source }}>{children}</DataSourceContext.Provider>
}

export function useDataSource() {
  const ctx = useContext(DataSourceContext)
  if (!ctx) throw new Error('useDataSource must be used within DataSourceProvider')
  return ctx
}
```

**Step 4:** Run: `cd frontend && npm test -- src/test/DataSourceContext.test.tsx`. Expected: 2 passed.

**Step 5:** Commit.

```bash
git add frontend/src/context/DataSourceContext.tsx frontend/src/test/DataSourceContext.test.tsx
git commit -m "feat(frontend): DataSourceContext (mock|api toggle via env)"
```

---

### Task 11: useSites hook (React Query)

**Files:**
- Create: `frontend/src/api/hooks.ts`
- Create: `frontend/src/test/useSites.test.tsx`
- Modify: `frontend/src/test/setup.ts`

**Step 1:** Update `frontend/src/test/setup.ts` to silence React Query retry noise:

```typescript
import '@testing-library/jest-dom'
```

(no change yet — keep this step as a placeholder; nothing to commit until the test asks for it)

**Step 2:** Write the failing test in `frontend/src/test/useSites.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSites } from '../api/hooks'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useSites', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('returns sites on success', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify([{ id: '101' }]), { status: 200 }))
    const { result } = renderHook(() => useSites(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: '101' }])
  })
})
```

**Step 3:** Run: `cd frontend && npm test -- src/test/useSites.test.tsx`. Expected: fail with module-not-found.

**Step 4:** Create `frontend/src/api/hooks.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { apiGet } from './client'

export interface Site {
  id: string
  name: string
  region: string
  enrolled: number
  target: number
  pi: string
}

export interface SiteMetrics {
  siteId: string
  timeline: string[]
  pd: number[]
  ae: number[]
  enrollment: number[]
  query: number[]
}

export function useSites() {
  return useQuery({ queryKey: ['sites'], queryFn: () => apiGet<Site[]>('/api/sites') })
}

export function useSite(id: string) {
  return useQuery({ queryKey: ['site', id], queryFn: () => apiGet<Site>(`/api/sites/${id}`), enabled: !!id })
}

export function useSiteMetrics(id: string) {
  return useQuery({ queryKey: ['site-metrics', id], queryFn: () => apiGet<SiteMetrics>(`/api/sites/${id}/metrics`), enabled: !!id })
}
```

**Step 5:** Run: `cd frontend && npm test -- src/test/useSites.test.tsx`. Expected: 1 passed.

**Step 6:** Commit.

```bash
git add frontend/src/api/hooks.ts frontend/src/test/useSites.test.tsx
git commit -m "feat(frontend): React Query hooks for sites"
```

---

### Task 12: Wire QueryClientProvider + DataSourceProvider in main.tsx

**Files:**
- Modify: `frontend/src/main.tsx`
- Create: `frontend/src/vite-env.d.ts` (if missing — usually exists; verify and extend)

**Step 1:** Open `frontend/src/main.tsx` and replace its content:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DataSourceProvider } from './context/DataSourceContext'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider>
        <App />
      </DataSourceProvider>
    </QueryClientProvider>
  </StrictMode>,
)
```

**Step 2:** Open `frontend/src/vite-env.d.ts`. If env types are missing for our two vars, append:

```typescript
interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'mock' | 'api'
  readonly VITE_API_BASE_URL?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
```

**Step 3:** Run: `cd frontend && npm run build`. Expected: build succeeds.

**Step 4:** Commit.

```bash
git add frontend/src/main.tsx frontend/src/vite-env.d.ts
git commit -m "feat(frontend): wire QueryClientProvider + DataSourceProvider"
```

---

### Task 13: M1 acceptance — manual mock↔api smoke

**Step 1:** Run backend: `cd backend && uvicorn src.api.main:app --reload --port 8000` (background).

**Step 2:** Run frontend in api mode: `cd frontend && VITE_DATA_SOURCE=api VITE_API_BASE_URL=http://localhost:8000 npm run dev`

**Step 3:** Open http://localhost:5173 in browser. Expected: existing dashboard renders without console errors. (No new UI yet — this only verifies the providers don't break the app.)

**Step 4:** Stop both processes. No commit.

---

## Phase M2.A — Routing

### Task 14: Convert tabs to routes

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/test/App.routes.test.tsx`

**Step 1:** Write the failing test in `frontend/src/test/App.routes.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DataSourceProvider } from '../context/DataSourceContext'
import App from '../App'

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DataSourceProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </DataSourceProvider>
    </QueryClientProvider>,
  )
}

describe('App routes', () => {
  it('renders dashboard at /dashboard', () => {
    renderAt('/dashboard')
    expect(screen.getByText('全局风险大屏')).toBeInTheDocument()
  })

  it('renders alerts at /alerts', () => {
    renderAt('/alerts')
    expect(screen.getByText('预警跟踪与闭环')).toBeInTheDocument()
  })

  it('renders thresholds at /thresholds', () => {
    renderAt('/thresholds')
    expect(screen.getByText('预警阈值配置')).toBeInTheDocument()
  })
})
```

**Step 2:** Run: `cd frontend && npm test -- src/test/App.routes.test.tsx`. Expected: fail (no routes wired).

**Step 3:** Update `frontend/src/main.tsx` — wrap `<App/>` with `<BrowserRouter>`:

```tsx
import { BrowserRouter } from 'react-router-dom'
// ...
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DataSourceProvider>
    </QueryClientProvider>
  </StrictMode>,
)
```

**Step 4:** Rewrite `frontend/src/App.tsx` to use routes (keep the layout shell — sidebar + header — but render routes inside main panel):

```tsx
import { Activity, LayoutDashboard, Settings, Filter, AlertTriangle, BarChart3 } from 'lucide-react'
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { ThresholdProvider } from './context/ThresholdContext'
import GlobalDashboard from './components/GlobalDashboard'
import AlertTracking from './components/AlertTracking'
import ThresholdConfig from './components/ThresholdConfig'

const TAB_TITLES: Record<string, string> = {
  '/dashboard': '全局风险大屏',
  '/alerts': '预警跟踪与闭环',
  '/thresholds': '预警阈值配置',
  '/benchmark': '中心间横向对比',
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200 ${
          isActive ? 'bg-primary-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </NavLink>
  )
}

function App() {
  const location = useLocation()
  const title = TAB_TITLES[location.pathname] ?? location.pathname.startsWith('/sites/') ? '中心深度分析' : 'RBM'

  return (
    <ThresholdProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
        <nav className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20">
          <div className="h-16 flex items-center px-6 font-bold text-xl text-white border-b border-slate-800 tracking-tight">
            <Activity className="mr-3 text-primary-500" />
            RBM 风险监控系统
          </div>
          <div className="flex-1 py-8 flex flex-col gap-2 px-4">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">功能模块</p>
            <NavItem to="/dashboard" icon={LayoutDashboard} label="全局风险大屏" />
            <NavItem to="/alerts" icon={AlertTriangle} label="预警跟踪与闭环" />
            <NavItem to="/benchmark" icon={BarChart3} label="中心间横向对比" />
            <div className="mt-8">
              <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">系统设置</p>
              <NavItem to="/thresholds" icon={Settings} label="预警阈值配置" />
            </div>
          </div>
        </nav>

        <main className="flex-1 flex flex-col h-full bg-[#f4f7f9] overflow-hidden relative">
          <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 sticky top-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-800 capitalize flex items-center gap-2">{title}</h1>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-lg text-sm font-semibold shadow-sm transition-all focus:ring-2 focus:ring-primary-500/20">
                <Filter size={16} />
                全局筛选
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-8 relative">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<GlobalDashboard />} />
              <Route path="/alerts" element={<AlertTracking />} />
              <Route path="/thresholds" element={<ThresholdConfig />} />
            </Routes>
          </div>
        </main>
      </div>
    </ThresholdProvider>
  )
}

export default App
```

Note: the test asserts on the `TAB_TITLES` text shown in the header. Since `<h1>` text comes from `TAB_TITLES[pathname]`, all three route tests should now find the expected text in the document.

**Step 5:** Run: `cd frontend && npm test -- src/test/App.routes.test.tsx`. Expected: 3 passed.

**Step 6:** Run full suite: `cd frontend && npm test`. Expected: all green.

**Step 7:** Commit.

```bash
git add frontend/src/main.tsx frontend/src/App.tsx frontend/src/test/App.routes.test.tsx
git commit -m "feat(frontend): migrate tabs to react-router routes"
```

---

## Phase M2.B — Site Deep Dive

### Task 15: SiteDeepDive page skeleton + route

**Files:**
- Create: `frontend/src/components/SiteDeepDive.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/test/SiteDeepDive.test.tsx`

**Step 1:** Write the failing test in `frontend/src/test/SiteDeepDive.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SiteDeepDive from '../components/SiteDeepDive'

function setup(initialPath: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/sites/:siteId" element={<SiteDeepDive />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SiteDeepDive', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('renders site name from API', async () => {
    (fetch as any)
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: '101', name: '中心 101', region: '华东', enrolled: 22, target: 50, pi: '研究者 101' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ siteId: '101', timeline: ['2025-01'], pd: [1], ae: [0], enrollment: [1], query: [0] }), { status: 200 }))
    setup('/sites/101')
    await waitFor(() => expect(screen.getByText('中心 101')).toBeInTheDocument())
  })

  it('shows loading state', () => {
    (fetch as any).mockReturnValue(new Promise(() => {}))
    setup('/sites/101')
    expect(screen.getByText(/加载中/)).toBeInTheDocument()
  })
})
```

**Step 2:** Run: `cd frontend && npm test -- src/test/SiteDeepDive.test.tsx`. Expected: fail with module-not-found.

**Step 3:** Create `frontend/src/components/SiteDeepDive.tsx`:

```tsx
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useSite, useSiteMetrics } from '../api/hooks'

export default function SiteDeepDive() {
  const { siteId = '' } = useParams()
  const site = useSite(siteId)
  const metrics = useSiteMetrics(siteId)

  if (site.isLoading || metrics.isLoading) {
    return <div className="text-slate-500">加载中…</div>
  }
  if (site.isError || !site.data) {
    return <div className="text-red-600">无法加载中心信息</div>
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft size={16} /> 返回大屏
      </Link>
      <h2 className="text-2xl font-bold">{site.data.name}</h2>
      <p className="text-slate-500 text-sm">PI: {site.data.pi} · 区域: {site.data.region}</p>
      {/* KPI cards + trend panels added in subsequent tasks */}
    </div>
  )
}
```

**Step 4:** Add the route to `frontend/src/App.tsx` `<Routes>`:

```tsx
import SiteDeepDive from './components/SiteDeepDive'
// inside <Routes>:
<Route path="/sites/:siteId" element={<SiteDeepDive />} />
```

**Step 5:** Run: `cd frontend && npm test -- src/test/SiteDeepDive.test.tsx`. Expected: 2 passed.

**Step 6:** Commit.

```bash
git add frontend/src/components/SiteDeepDive.tsx frontend/src/App.tsx frontend/src/test/SiteDeepDive.test.tsx
git commit -m "feat(frontend): SiteDeepDive page skeleton + route"
```

---

### Task 16: SiteKpiCards

**Files:**
- Create: `frontend/src/components/site-deep-dive/SiteKpiCards.tsx`
- Modify: `frontend/src/components/SiteDeepDive.tsx`
- Create: `frontend/src/test/SiteKpiCards.test.tsx`

**Step 1:** Write the failing test in `frontend/src/test/SiteKpiCards.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SiteKpiCards from '../components/site-deep-dive/SiteKpiCards'

describe('SiteKpiCards', () => {
  it('shows enrollment progress percentage', () => {
    render(<SiteKpiCards enrolled={22} target={50} pdTotal={9} aeTotal={4} openQueries={3} />)
    expect(screen.getByText('44%')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('handles zero target without dividing by zero', () => {
    render(<SiteKpiCards enrolled={0} target={0} pdTotal={0} aeTotal={0} openQueries={0} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
```

**Step 2:** Run: `cd frontend && npm test -- src/test/SiteKpiCards.test.tsx`. Expected: fail (module-not-found).

**Step 3:** Create `frontend/src/components/site-deep-dive/SiteKpiCards.tsx`:

```tsx
interface Props {
  enrolled: number
  target: number
  pdTotal: number
  aeTotal: number
  openQueries: number
}

function Card({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'warn' | 'danger' }) {
  const toneCls = tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-900'
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${toneCls}`}>{value}</p>
    </div>
  )
}

export default function SiteKpiCards({ enrolled, target, pdTotal, aeTotal, openQueries }: Props) {
  const pct = target > 0 ? Math.round((enrolled / target) * 100) : 0
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card label="入组进度" value={`${pct}%`} />
      <Card label="PD 总数" value={pdTotal} tone={pdTotal > 5 ? 'warn' : 'default'} />
      <Card label="AE 累计" value={aeTotal} />
      <Card label="未关闭 Query" value={openQueries} tone={openQueries > 5 ? 'danger' : 'default'} />
    </div>
  )
}
```

**Step 4:** Run: `cd frontend && npm test -- src/test/SiteKpiCards.test.tsx`. Expected: 2 passed.

**Step 5:** Wire into `SiteDeepDive.tsx` after the header:

```tsx
import SiteKpiCards from './site-deep-dive/SiteKpiCards'
// inside the rendered tree, below the <p>PI:...</p>:
<SiteKpiCards
  enrolled={site.data.enrolled}
  target={site.data.target}
  pdTotal={metrics.data?.pd.reduce((a, b) => a + b, 0) ?? 0}
  aeTotal={metrics.data?.ae.reduce((a, b) => a + b, 0) ?? 0}
  openQueries={metrics.data?.query.at(-1) ?? 0}
/>
```

**Step 6:** Run all frontend tests: `cd frontend && npm test`. Expected: all green.

**Step 7:** Commit.

```bash
git add frontend/src/components/site-deep-dive/ frontend/src/components/SiteDeepDive.tsx frontend/src/test/SiteKpiCards.test.tsx
git commit -m "feat(frontend): site-deep-dive KPI cards"
```

---

### Task 17: SiteTrendPanel (4 mini line charts)

**Files:**
- Create: `frontend/src/components/site-deep-dive/SiteTrendPanel.tsx`
- Modify: `frontend/src/components/SiteDeepDive.tsx`
- Create: `frontend/src/test/SiteTrendPanel.test.tsx`

**Step 1:** Write the failing test:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SiteTrendPanel from '../components/site-deep-dive/SiteTrendPanel'

const metrics = {
  siteId: '101',
  timeline: ['2025-01', '2025-02', '2025-03'],
  pd: [1, 2, 3],
  ae: [0, 1, 1],
  enrollment: [2, 5, 9],
  query: [3, 2, 4],
}

describe('SiteTrendPanel', () => {
  it('renders all 4 trend titles', () => {
    render(<SiteTrendPanel metrics={metrics as any} />)
    expect(screen.getByText('PD 月度趋势')).toBeInTheDocument()
    expect(screen.getByText('AE 累计')).toBeInTheDocument()
    expect(screen.getByText('入组曲线')).toBeInTheDocument()
    expect(screen.getByText('Query 响应')).toBeInTheDocument()
  })
})
```

**Step 2:** Run: `cd frontend && npm test -- src/test/SiteTrendPanel.test.tsx`. Expected: fail.

**Step 3:** Create `frontend/src/components/site-deep-dive/SiteTrendPanel.tsx`:

```tsx
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { SiteMetrics } from '../../api/hooks'

const PANELS: { key: keyof Pick<SiteMetrics, 'pd' | 'ae' | 'enrollment' | 'query'>; title: string; color: string }[] = [
  { key: 'pd', title: 'PD 月度趋势', color: '#ef4444' },
  { key: 'ae', title: 'AE 累计', color: '#f59e0b' },
  { key: 'enrollment', title: '入组曲线', color: '#10b981' },
  { key: 'query', title: 'Query 响应', color: '#3b82f6' },
]

export default function SiteTrendPanel({ metrics }: { metrics: SiteMetrics }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {PANELS.map(p => {
        const data = metrics.timeline.map((t, i) => ({ t, v: metrics[p.key][i] }))
        return (
          <div key={p.key} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-700 mb-3">{p.title}</p>
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <LineChart data={data}>
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="v" stroke={p.color} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 4:** Run: `cd frontend && npm test -- src/test/SiteTrendPanel.test.tsx`. Expected: 1 passed.

**Step 5:** Wire into `SiteDeepDive.tsx`:

```tsx
import SiteTrendPanel from './site-deep-dive/SiteTrendPanel'
// after KPI cards, before closing div:
{metrics.data && <SiteTrendPanel metrics={metrics.data} />}
```

**Step 6:** Run all: `cd frontend && npm test`. Expected: green.

**Step 7:** Commit.

```bash
git add frontend/src/components/site-deep-dive/SiteTrendPanel.tsx frontend/src/components/SiteDeepDive.tsx frontend/src/test/SiteTrendPanel.test.tsx
git commit -m "feat(frontend): site-deep-dive 4-panel trend charts"
```

---

### Task 18: SubjectVisitHeatmap (placeholder mock-based)

**Files:**
- Create: `frontend/src/components/site-deep-dive/SubjectVisitHeatmap.tsx`
- Modify: `frontend/src/components/SiteDeepDive.tsx`
- Create: `frontend/src/test/SubjectVisitHeatmap.test.tsx`

Note: real subject-level data is out of scope for M2; we generate a deterministic per-site grid client-side from the `siteId` (a stable hash). Real EDC subject data lands in M3 or later.

**Step 1:** Write the failing test:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import SubjectVisitHeatmap from '../components/site-deep-dive/SubjectVisitHeatmap'

describe('SubjectVisitHeatmap', () => {
  it('renders a grid of subjects × visits', () => {
    const { container } = render(<SubjectVisitHeatmap siteId="101" subjects={5} visits={6} />)
    expect(container.querySelectorAll('[data-cell]').length).toBe(5 * 6)
  })

  it('is deterministic for the same siteId', () => {
    const a = render(<SubjectVisitHeatmap siteId="101" subjects={3} visits={3} />).container.innerHTML
    const b = render(<SubjectVisitHeatmap siteId="101" subjects={3} visits={3} />).container.innerHTML
    expect(a).toBe(b)
  })
})
```

**Step 2:** Run: `cd frontend && npm test -- src/test/SubjectVisitHeatmap.test.tsx`. Expected: fail.

**Step 3:** Create `frontend/src/components/site-deep-dive/SubjectVisitHeatmap.tsx`:

```tsx
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619 >>> 0
  return h >>> 0
}

function pickColor(seed: number): string {
  const r = seed % 100
  if (r < 70) return 'bg-emerald-200'
  if (r < 90) return 'bg-amber-300'
  return 'bg-red-400'
}

export default function SubjectVisitHeatmap({ siteId, subjects = 12, visits = 10 }: { siteId: string; subjects?: number; visits?: number }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <p className="text-sm font-semibold text-slate-700 mb-3">受试者 × 访视</p>
      <div className="overflow-x-auto">
        <div className="grid gap-1" style={{ gridTemplateColumns: `60px repeat(${visits}, minmax(28px, 1fr))` }}>
          <div></div>
          {Array.from({ length: visits }).map((_, v) => (
            <div key={v} className="text-[10px] text-slate-500 text-center">V{v + 1}</div>
          ))}
          {Array.from({ length: subjects }).map((_, s) => (
            <>
              <div key={`label-${s}`} className="text-[10px] text-slate-500">S{s + 1}</div>
              {Array.from({ length: visits }).map((_, v) => {
                const seed = hash(`${siteId}-${s}-${v}`)
                return <div key={`${s}-${v}`} data-cell className={`h-6 rounded ${pickColor(seed)}`} title={`S${s + 1} V${v + 1}`} />
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 4:** Run: `cd frontend && npm test -- src/test/SubjectVisitHeatmap.test.tsx`. Expected: 2 passed.

**Step 5:** Wire into `SiteDeepDive.tsx`:

```tsx
import SubjectVisitHeatmap from './site-deep-dive/SubjectVisitHeatmap'
// at the bottom:
<SubjectVisitHeatmap siteId={siteId} />
```

**Step 6:** Run all tests + build. Run: `cd frontend && npm test && npm run build`. Expected: green + build passes.

**Step 7:** Commit.

```bash
git add frontend/src/components/site-deep-dive/SubjectVisitHeatmap.tsx frontend/src/components/SiteDeepDive.tsx frontend/src/test/SubjectVisitHeatmap.test.tsx
git commit -m "feat(frontend): subject × visit heatmap (deterministic mock)"
```

---

### Task 19: Link from GlobalDashboard's site list to /sites/:id

**Files:**
- Modify: `frontend/src/components/SitePDAnalysis.tsx`

**Step 1:** Open `SitePDAnalysis.tsx`. Locate the bar-click handler `handleBarClick` (around line 49). Currently it calls `setSelectedSite(payload.rawSite)`. Wrap that with a navigation to `/sites/:id`:

```tsx
import { useNavigate } from 'react-router-dom'
// inside the component:
const navigate = useNavigate()
// modify handleBarClick: after setSelectedSite, also call:
navigate(`/sites/${payload.rawSite}`)
```

**Step 2:** Run all frontend tests: `cd frontend && npm test`. Expected: green (no test for this — we'll verify in browser smoke).

**Step 3:** Manual smoke. Run `cd frontend && npm run dev`, visit `/dashboard`, click a site bar, expect to land on `/sites/:id` rendering KPI cards + trends + heatmap.

**Step 4:** Commit.

```bash
git add frontend/src/components/SitePDAnalysis.tsx
git commit -m "feat(frontend): drill-down from site bar to SiteDeepDive"
```

---

## Phase M2.C — Cross-Site Benchmarking

### Task 20: benchmarkUtils — z-score + percentile

**Files:**
- Create: `frontend/src/utils/benchmarkUtils.ts`
- Create: `frontend/src/test/benchmarkUtils.test.ts`

**Step 1:** Write the failing test:

```typescript
import { describe, it, expect } from 'vitest'
import { mean, stddev, zScore, percentile } from '../utils/benchmarkUtils'

describe('benchmarkUtils', () => {
  it('mean of [1,2,3] is 2', () => expect(mean([1, 2, 3])).toBe(2))
  it('mean of [] is 0', () => expect(mean([])).toBe(0))

  it('stddev of [2,2,2] is 0', () => expect(stddev([2, 2, 2])).toBe(0))
  it('stddev of [1,2,3] is ~0.816 (population)', () => expect(stddev([1, 2, 3])).toBeCloseTo(0.8165, 3))

  it('zScore is 0 when value equals mean', () => expect(zScore(5, [3, 5, 7])).toBe(0))
  it('zScore returns 0 when stddev is 0', () => expect(zScore(5, [5, 5, 5])).toBe(0))

  it('percentile finds median', () => expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3))
  it('percentile clamps to bounds', () => {
    expect(percentile([1, 2, 3], 0)).toBe(1)
    expect(percentile([1, 2, 3], 100)).toBe(3)
  })
})
```

**Step 2:** Run: `cd frontend && npm test -- src/test/benchmarkUtils.test.ts`. Expected: fail (module-not-found).

**Step 3:** Create `frontend/src/utils/benchmarkUtils.ts`:

```typescript
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function stddev(xs: number[]): number {
  if (xs.length === 0) return 0
  const m = mean(xs)
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length
  return Math.sqrt(variance)
}

export function zScore(value: number, population: number[]): number {
  const sd = stddev(population)
  if (sd === 0) return 0
  return (value - mean(population)) / sd
}

export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[idx]
}
```

**Step 4:** Run: `cd frontend && npm test -- src/test/benchmarkUtils.test.ts`. Expected: 8 passed.

**Step 5:** Commit.

```bash
git add frontend/src/utils/benchmarkUtils.ts frontend/src/test/benchmarkUtils.test.ts
git commit -m "feat(frontend): benchmark stats utils (mean/stddev/zScore/percentile)"
```

---

### Task 21: Backend /api/benchmark endpoint

**Files:**
- Modify: `backend/src/api/main.py`
- Create: `backend/tests/test_api_benchmark.py`

**Step 1:** Write the failing test:

```python
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
```

**Step 2:** Run: `cd backend && pytest tests/test_api_benchmark.py -v`. Expected: 404.

**Step 3:** Append to `backend/src/api/main.py`:

```python
import statistics


@app.get("/api/benchmark")
def benchmark():
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
```

**Step 4:** Run: `cd backend && pytest tests/test_api_benchmark.py -v`. Expected: 1 passed.

**Step 5:** Commit.

```bash
git add backend/src/api/main.py backend/tests/test_api_benchmark.py
git commit -m "feat(backend): GET /api/benchmark with z-score + progress"
```

---

### Task 22: useBenchmark hook

**Files:**
- Modify: `frontend/src/api/hooks.ts`
- Create: `frontend/src/test/useBenchmark.test.tsx`

**Step 1:** Write the failing test:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useBenchmark } from '../api/hooks'

function wrapper({ children }: { children: ReactNode }) {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={c}>{children}</QueryClientProvider>
}

describe('useBenchmark', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('returns rows on success', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify([{ siteId: '101', name: '中心 101', progressPct: 50, pdTotal: 12, pdZScore: 1.2, queryTotal: 30 }]), { status: 200 }))
    const { result } = renderHook(() => useBenchmark(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].siteId).toBe('101')
  })
})
```

**Step 2:** Run: `cd frontend && npm test -- src/test/useBenchmark.test.tsx`. Expected: fail.

**Step 3:** Append to `frontend/src/api/hooks.ts`:

```typescript
export interface BenchmarkRow {
  siteId: string
  name: string
  progressPct: number
  pdTotal: number
  pdZScore: number
  queryTotal: number
}

export function useBenchmark() {
  return useQuery({ queryKey: ['benchmark'], queryFn: () => apiGet<BenchmarkRow[]>('/api/benchmark') })
}
```

**Step 4:** Run: `cd frontend && npm test -- src/test/useBenchmark.test.tsx`. Expected: 1 passed.

**Step 5:** Commit.

```bash
git add frontend/src/api/hooks.ts frontend/src/test/useBenchmark.test.tsx
git commit -m "feat(frontend): useBenchmark hook"
```

---

### Task 23: Benchmark page skeleton + scatter

**Files:**
- Create: `frontend/src/components/Benchmark.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/test/Benchmark.test.tsx`

**Step 1:** Write the failing test:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Benchmark from '../components/Benchmark'

function setup() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter>
        <Benchmark />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Benchmark', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('renders ranking table rows from API', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify([
      { siteId: '101', name: '中心 101', progressPct: 50, pdTotal: 12, pdZScore: 1.2, queryTotal: 30 },
      { siteId: '102', name: '中心 102', progressPct: 70, pdTotal: 4, pdZScore: -0.8, queryTotal: 10 },
    ]), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('中心 101')).toBeInTheDocument())
    expect(screen.getByText('中心 102')).toBeInTheDocument()
  })
})
```

**Step 2:** Run: `cd frontend && npm test -- src/test/Benchmark.test.tsx`. Expected: fail.

**Step 3:** Create `frontend/src/components/Benchmark.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts'
import { useBenchmark } from '../api/hooks'

export default function Benchmark() {
  const q = useBenchmark()

  if (q.isLoading) return <div className="text-slate-500">加载中…</div>
  if (q.isError || !q.data) return <div className="text-red-600">无法加载基准数据</div>

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-3">入组进度 vs PD z-score</p>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <ScatterChart>
              <CartesianGrid />
              <XAxis dataKey="progressPct" name="进度 %" tick={{ fontSize: 11 }} />
              <YAxis dataKey="pdZScore" name="PD z-score" tick={{ fontSize: 11 }} />
              <ZAxis dataKey="pdTotal" range={[60, 400]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={q.data} fill="#3b82f6" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-3">中心排名</p>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left py-2">中心</th>
              <th className="text-right">进度 %</th>
              <th className="text-right">PD 总数</th>
              <th className="text-right">PD z-score</th>
              <th className="text-right">Query 总数</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...q.data].sort((a, b) => b.pdZScore - a.pdZScore).map(r => (
              <tr key={r.siteId} className="border-t border-slate-100">
                <td className="py-2 font-medium">{r.name}</td>
                <td className="text-right">{r.progressPct}</td>
                <td className="text-right">{r.pdTotal}</td>
                <td className={`text-right ${r.pdZScore >= 2 ? 'text-red-600 font-semibold' : r.pdZScore >= 1 ? 'text-amber-600' : ''}`}>{r.pdZScore.toFixed(2)}</td>
                <td className="text-right">{r.queryTotal}</td>
                <td className="text-right"><Link to={`/sites/${r.siteId}`} className="text-primary-600 hover:underline">详情</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 4:** Add the route in `App.tsx`:

```tsx
import Benchmark from './components/Benchmark'
// inside <Routes>:
<Route path="/benchmark" element={<Benchmark />} />
```

**Step 5:** Run: `cd frontend && npm test -- src/test/Benchmark.test.tsx`. Expected: 1 passed.

**Step 6:** Run all + build: `cd frontend && npm test && npm run build`. Expected: green + build passes.

**Step 7:** Commit.

```bash
git add frontend/src/components/Benchmark.tsx frontend/src/App.tsx frontend/src/test/Benchmark.test.tsx
git commit -m "feat(frontend): Cross-Site Benchmarking page (scatter + ranking table)"
```

---

### Task 24: M2 acceptance — end-to-end smoke

**Step 1:** Start backend: `cd backend && uvicorn src.api.main:app --reload --port 8000` (background).

**Step 2:** Start frontend in api mode: `cd frontend && VITE_DATA_SOURCE=api VITE_API_BASE_URL=http://localhost:8000 npm run dev`

**Step 3:** Manual checks in browser:
- `/dashboard` renders, click a site bar → lands on `/sites/:id` showing KPI cards + 4 trends + heatmap
- `/benchmark` renders scatter + ranking table; click "详情" → drills to `/sites/:id`
- `/alerts` and `/thresholds` still work
- DevTools network tab shows real `/api/*` calls

**Step 4:** Run full test suites one more time:

```bash
cd backend && pytest -v
cd frontend && npm test
```

Expected: all green.

**Step 5:** No commit (smoke only). M1 + M2 done.

---

## Done criteria

- All backend tests pass: `cd backend && pytest -v`
- All frontend tests pass: `cd frontend && npm test`
- `cd frontend && npm run build` succeeds
- App runs in both `mock` and `api` modes without console errors
- New routes reachable: `/sites/:id`, `/benchmark`
- Drill-down works from dashboard site bars and from benchmark ranking table
