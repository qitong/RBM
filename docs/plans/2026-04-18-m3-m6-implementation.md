# M3-M6 Implementation Plan

> **Goal:** Add PD×Query correlation, investigator profiles, risk forecasting, and CAPA efficiency analysis.

## Task Summary (21 tasks, 21 commits)

| Milestone | Tasks | Description |
|-----------|-------|-------------|
| M3 | M3.1-M3.5 | PD × Query Correlation Scatter |
| M4 | M4.1-M4.6 | Investigator Profile |
| M5 | M5.1-M5.5 | Risk Forecasting |
| M6 | M6.1-M6.5 | CAPA Efficiency Analysis |

## Conventions

- TDD: write failing test → verify red → implement → verify green → commit
- Commit prefixes: `feat(backend):`, `feat(frontend):`
- Chinese text: Unicode escapes `\uXXXX`
- TS constraint: `erasableSyntaxOnly: true`

---

## M3: PD × Query Correlation

### M3.1 Backend correlation utility
### M3.2 Backend /api/correlation endpoint
### M3.3 Frontend useCorrelation hook
### M3.4 Frontend CorrelationScatter component
### M3.5 Frontend /correlation route + nav

## M4: Investigator Profile

### M4.1 Backend investigator data generator
### M4.2 Backend /api/investigators endpoints
### M4.3 Frontend investigator hooks
### M4.4 Frontend InvestigatorList component
### M4.5 Frontend InvestigatorProfile component
### M4.6 Frontend /investigators routes + nav

## M5: Risk Forecasting

### M5.1 Backend forecast utility
### M5.2 Backend /api/sites/{id}/forecast endpoint
### M5.3 Frontend useForecast hook
### M5.4 Frontend ForecastChart component
### M5.5 Frontend /forecast route + SiteDeepDive link

## M6: CAPA Efficiency

### M6.1 Backend CAPA data generator
### M6.2 Backend /api/capa endpoints
### M6.3 Frontend CAPA hooks
### M6.4 Frontend CapaEfficiency component
### M6.5 Frontend /capa route + nav
