# CohortFit backend (FastAPI + DuckDB)

Decoupled API for the Track-2 tool. DuckDB reads the frozen demo CSVs directly (no
import step); the cohort layer compiles a validated IR to SQL; the quality engine
scores data fitness; the eval harness measures detection on self-injected errors.

## Layout
```
app/
  config.py            # pydantic-settings (paths, model ids, temperature)
  data/loader.py       # DuckDB session, one view per CSV
  data/schema.py       # introspection (tables, columns, keys, timestamps, samples)
  quality/ranges.py    # plausibility bounds (mirror MIT vitalsign.sql)
  quality/rules.py     # plausibility/units/temporal/completeness/duplicates + scorecard
  cohort/ir.py         # CohortIR (pydantic) — the intermediate representation
  cohort/nl.py         # plain-English -> IR (OpenAI if key, else keyword fallback)
  cohort/compiler.py   # IR -> DuckDB SQL + provenance funnel + query_hash
  eval/inject.py       # inject labeled errors into a copy; measure precision/recall/FPR
  main.py              # FastAPI app
tests/                 # data/quality/cohort/eval/api tests
```

## Run (Docker — recommended)
From the repo root:
```
docker compose up --build          # API on http://localhost:8000
```
`OPENAI_API_KEY` is optional; without it, cohort building uses the disclosed keyword
fallback so everything still works offline.

## Test (Docker)
```
docker compose run --rm backend pytest
```

## Endpoints
- `GET  /health` — status, table count, safety notice
- `GET  /schema` — every table with columns, keys, timestamps, row counts
- `GET  /schema/{table}?limit=` — sample rows (local UI only)
- `POST /cohort/build {text}` — IR + SQL + provenance funnel + subject_ids (or abstain)
- `GET  /quality/scorecard` — R/A/G dimensions + findings (data_error vs real_finding vs caveat)
- `GET  /eval/run?n_inject=&seed=` — injected-error detection metrics

## Notes
- Local Python 3.14 has no duckdb wheel yet — use the Docker image (python:3.12-slim).
- No endpoint mutates source data; the data volume is mounted read-only.
