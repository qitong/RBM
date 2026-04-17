# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clinical Risk-Based Monitoring (RBM) system — a single-page dashboard for tracking Protocol Deviations (PD) in clinical trials. The UI is in Chinese (Simplified). It uses mock/demo data; there is no backend or API.

Three main views controlled by tab state in `App.tsx`:
1. **全局风险大屏 (Global Risk Dashboard)** — trend lines, threshold zones, site-level PD analysis with resizable split layout
2. **预警跟踪与闭环 (Alert Tracking)** — kanban/list for threshold breach action items with root-cause hypotheses and CAPA workflow
3. **预警阈值配置 (Threshold Config)** — per-category and global warning/action thresholds (persisted to localStorage)

## Commands

```bash
cd frontend
npm run dev      # Start Vite dev server with HMR
npm run build    # TypeScript check + Vite production build
npm run lint     # ESLint
npm run preview  # Preview production build locally
```

All commands must be run from the `frontend/` directory.

### Python (backend/)

```bash
cd backend
pytest                    # Run all tests
pytest tests/test_foo.py  # Run a single test file
pytest --cov=src          # Run with coverage
```

Python tests live in `backend/tests/`, source in `backend/src/`. Uses `pyproject.toml` for configuration (requires Python ≥3.10, pytest ≥8.0 via Anaconda).

## Architecture

- **Framework**: React 19 + TypeScript + Vite 8, styled with Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Charts**: Recharts — used for LineChart, AreaChart, BarChart across dashboard and analysis views
- **Icons**: lucide-react
- **State**: React Context (`ThresholdContext`) for threshold configuration; component-local `useState` for everything else

### Key Files

- `frontend/src/utils/thresholdUtils.ts` — pure `checkOutlier(value, thresholds)` function (extracted for testability); used by `ThresholdContext`
- `frontend/src/context/ThresholdContext.tsx` — threshold state (warning/action levels per PD category, weights, `checkOutlier` helper). Categories: Informed Consent, Inclusion/Exclusion, Investigational Product, Safety Reporting, Procedures/Tests, Visit Schedule, CCMeds, Other
- `frontend/src/data.json` — static mock data consumed by dashboard and alert components (`progressMatrix`, `visitTrends`, `alerts`)
- `frontend/src/components/GlobalDashboard.tsx` — main dashboard with trend charts, threshold reference lines, and embedded `SitePDAnalysis`
- `frontend/src/components/SitePDAnalysis.tsx` — site-level PD comparison and per-site visit matrix (uses random data, not data.json)
- `frontend/src/components/AlertTracking.tsx` — alert list with status workflow, AI-generated hypotheses templates, root cause/CAPA documentation
- `frontend/src/components/ResizableLayout.tsx` — generic draggable split-pane layout
- `frontend/src/index.css` — Tailwind imports + custom theme tokens (`primary-*`, `success-500`, `warning-500`, `danger-500`)

### Data Flow

Mock data in `data.json` is imported directly as static JSON. Thresholds from `ThresholdContext` drive color-coding (green/yellow/red) via the `checkOutlier(value, categoryId?)` function which compares `|value|` against SD-based thresholds. Root-level `rbm_mock_data.json` and `rbm_mock_data.js` are standalone reference/generation files not consumed by the frontend.

### Tests

- Frontend: `frontend/src/test/` — Vitest + React Testing Library. Setup in `src/test/setup.ts`.
- Python: `backend/tests/` — pytest. Config in `backend/pyproject.toml`.

TDD workflow: write failing test first, verify it fails for the right reason, then implement minimal code to pass.

## Design Reference

`docs/plans/2026-03-30-RBM-system-design.md` contains the full system design document including clinical scenario narratives (A–D) that the mock data is based on. `reference/` contains screenshot references for chart layouts.
