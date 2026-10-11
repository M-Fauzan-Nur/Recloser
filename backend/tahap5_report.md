# Tahap 5 Validation Report
- Date (UTC): 9/23/2026 6:47:47 PM
- Backend: uvicorn app.main:app @ http://127.0.0.1:8000
- Python venv: D:\Penelitian\program pengujian\Pengujian_penelitian\rec\Scripts\python.exe

## 1. Smoke regression (30 calls)

| # | Method | URL | Expected | Actual | Ok | Latency (ms) |
|---|--------|-----|----------|--------|----|--------------|
| 1 | GET | `/` | 200 | 200 | True | 24 |
| 2 | GET | `/api/dashboard` | 200 | 200 | True | 16 |
| 3 | GET | `/api/scenarios` | 200 | 200 | True | 17 |
| 4 | GET | `/api/scenarios/a` | 200 | 200 | True | 18 |
| 5 | GET | `/api/scenarios/a/prediction` | 200 | 200 | True | 17 |
| 6 | GET | `/api/scenarios/a/dataset` | 200 | 200 | True | 26 |
| 7 | GET | `/api/scenarios/a/latest` | 200 | 200 | True | 17 |
| 8 | POST | `/api/scenarios/a/lstm/predict` | 200 | 200 | True | 36 |
| 9 | GET | `/api/scenarios/b` | 200 | 200 | True | 14 |
| 10 | GET | `/api/scenarios/b/prediction` | 200 | 200 | True | 15 |
| 11 | GET | `/api/scenarios/b/dataset` | 200 | 200 | True | 28 |
| 12 | GET | `/api/scenarios/b/latest` | 200 | 200 | True | 21 |
| 13 | POST | `/api/scenarios/b/lstm/predict` | 200 | 200 | True | 37 |
| 14 | GET | `/api/scenarios/c` | 200 | 200 | True | 18 |
| 15 | GET | `/api/scenarios/c/prediction` | 200 | 200 | True | 17 |
| 16 | GET | `/api/scenarios/c/dataset` | 200 | 200 | True | 28 |
| 17 | GET | `/api/scenarios/c/latest` | 200 | 200 | True | 20 |
| 18 | POST | `/api/scenarios/c/lstm/predict` | 200 | 200 | True | 37 |
| 19 | GET | `/api/scenarios/d` | 200 | 200 | True | 17 |
| 20 | GET | `/api/scenarios/d/prediction` | 200 | 200 | True | 15 |
| 21 | GET | `/api/scenarios/d/dataset` | 200 | 200 | True | 26 |
| 22 | GET | `/api/scenarios/d/latest` | 200 | 200 | True | 19 |
| 23 | POST | `/api/scenarios/d/lstm/predict` | 200 | 200 | True | 35 |
| 24 | GET | `/api/scenarios/e` | 200 | 200 | True | 15 |
| 25 | GET | `/api/scenarios/e/prediction` | 200 | 200 | True | 18 |
| 26 | GET | `/api/scenarios/e/dataset` | 200 | 200 | True | 30 |
| 27 | GET | `/api/scenarios/e/latest` | 200 | 200 | True | 20 |
| 28 | POST | `/api/scenarios/e/lstm/predict` | 200 | 200 | True | 35 |
| 29 | POST | `/api/scenarios/z/abc/optimize` | 404 | 404 | True | 71 |
| 30 | POST | `/api/scenarios/z/lstm/predict` | 404 | 404 | True | 2 |

**Smoke pass: 30/30**

## 2. ABC reproducibility vs Tahap 4 saved JSONs

| Scenario | Leaves matched | Isolation | Positions ok | Fitness ref | Fitness new | Fitness ok | Runtime (s) | Pass |
|----------|----------------|-----------|--------------|-------------|-------------|------------|-------------|------|
| a | 30/30 | True | True | 0.176407308415356 | 0.176407308415356 | True | 9.807 | True |
| b | 30/30 | True | True | 0.156039830174535 | 0.156039830174535 | True | 9.838 | True |
| c | 30/30 | True | True | 0.155679793699797 | 0.155679793699797 | True | 9.878 | True |
| d | 30/30 | True | True | 0.233097688772081 | 0.233097688772081 | True | 9.896 | True |
| e | 30/30 | True | True | 0.218291168192839 | 0.218291168192839 | True | 9.943 | True |

### Per-scenario detail

#### Scenario a

- Baseline SAIDI: 2,040.1802
- Optimal SAIDI:  539.8920
- Baseline SAIFI: 135.5197
- Optimal SAIFI:  43.7973
- Positions: `line_27,line_52,line_35,line_9`
- Runtime (server): 9.807s

#### Scenario b

- Baseline SAIDI: 1,726.2614
- Optimal SAIDI:  386.7628
- Baseline SAIFI: 130.7795
- Optimal SAIFI:  38.6923
- Positions: `line_27,line_52,line_35,line_9`
- Runtime (server): 9.838s

#### Scenario c

- Baseline SAIDI: 2,019.9756
- Optimal SAIDI:  472.4125
- Baseline SAIFI: 138.0505
- Optimal SAIFI:  39.3240
- Positions: `line_27,line_52,line_35,line_9`
- Runtime (server): 9.878s

#### Scenario d

- Baseline SAIDI: 1,574.9251
- Optimal SAIDI:  637.5533
- Baseline SAIFI: 127.7563
- Optimal SAIFI:  47.5198
- Positions: `line_27,line_52,line_35,line_9`
- Runtime (server): 9.896s

#### Scenario e

- Baseline SAIDI: 145.4817
- Optimal SAIDI:  53.1418
- Baseline SAIFI: 68.4782
- Optimal SAIFI:  24.7984
- Positions: `line_27,line_52,line_35,line_9`
- Runtime (server): 9.943s

## 3. Research file integrity (SHA256)

- Files snapshotted: 27
- Mismatched before vs after: 0
- Result: **PASS**

All research `.py` and `.csv` files (27 across 5 scenario folders) are byte-identical before/after Tahap 5.

## 4. Architecture constraints

- DB / auth / deployment / OPEX / investment added: **NO**
- New dependencies: **NO**
- New endpoints: **NO**
- Backend changed: **NO**
- Frontend changed: `frontend/src/components/ScenarioView.jsx` (display-only: scenarioName in block headings + scenario_id pill, reusing `.metric-pill`)
- Node.js installed: **NO** (frontend cannot be built/run without it; no workaround added)

## 5. Stop point

Tahap 5 complete. Per user instruction, development stops here.

