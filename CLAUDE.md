# patient-care-track-2 — CohortFit

## ⚙️ Claude Code model requirement (read first)

**Use `claude-opus-4-8` for all work on this project.** The latest model is Opus 5, but this project is standardized on **Opus 4.8** for consistency across sessions and collaborators. At the start of every session run:

```
/model claude-opus-4-8
```

Do not build or modify this project on a different model unless the user explicitly says otherwise.

## What this project is

**CohortFit** — our entry for the **Sofstica AI Hackathon 2026**, challenge "AI for Smarter Patient Care", **Track 2 — Cohort & Data Quality Explorer**.

> One-liner: **CohortFit turns a plain-English cohort description into a transparent, showable query (who's in / who's out and why), then scores whether the data are fit to trust — separating real clinical findings from data errors, and only ever suggesting reversible, explained fixes.** The pitch is *honesty as a feature*.

**Product contract (must hold in all code + UI):**
- **DOES:** visible cohort queries (inclusion + exclusion); red/amber/green data-fitness scorecard with drill-down to source rows; distinguishes a real clinical finding from a data error; reversible, rule-backed fixes only; provenance for every patient-level claim; **abstains** when unsupported.
- **NEVER:** silently edits/deletes source data; gives medical/diagnostic/triage advice; claims clinical validity; hides AI-generated content; infers calendar dates (data are date-shifted); dumps patient-level data to external services — per the licence we **minimize** what's sent (schema + aggregates by default; only the minimal rows a task genuinely needs), disclose it, and never upload to a service whose terms disallow it.
- **On every screen:** *Research and educational prototype only. Not for clinical use. Do not use for diagnosis, treatment, triage, or emergency decisions.*

**Locked decisions:** Stack = **FastAPI + Next.js** (deploy to Vercel) · LLM = **OpenAI only** (strict Structured Outputs, column enums; GPT-5.6 Terra primary / Luna fallback / Sol escalate) · **NL → validated JSON IR → DuckDB SQL** (the LLM never writes executable SQL) · Ace card = **demo-verifiable only** (every flag traces to a real 100-patient row).

**Process:** we work **scrum-style** — build one small feature, test it, verify against requirements + rubric (`docs/TRACK2_REQUIREMENTS.md`), update, then move on. Frontend is built **from the start**, not bolted on at the end.

**Frontend shape (multi-page, so judges can mark progressively):** each capability gets its own page so results are easy to see and grade — e.g. **Schema Explorer** (schema + ER diagram + relevant data with filters & search), **Cohort Builder** (NL → IR + SQL + who's in/out), **Data-Fitness Scorecard** (red/amber/green + clickable flag rows), **Evaluation** (error-injection metrics), and an **About/Safety** page. This layout is tentative and evolves.

**Design:** Apple clarity blended with Google **Material** tactility (focus on the user, material as metaphor, motion with purpose), **user-centric, warm light mode only (no dark mode)**. The design system is documented in **`TENTATIVE_FRONTEND_DESIGN_SYSTEM.md`** (the single source of truth for tokens, type, elevation, motion, components) — tentative and evolving. Build UI to match that file.

**Demo-safety engineering (so we never get doomed live):** near-perfect **session management + local store** (a cohort/flag session persists and reloads exactly), and **deterministic, sandboxed execution** of every query/code path (compiled SQL over the fixed DuckDB store; store IR + SQL + data-hash; no surprise network calls in the hot path).

**Deploy target:** everything runs in **Docker** (a collaborator will also run it) — one `docker compose up` brings up backend + frontend. Keep it reproducible.

## Operational practices for this repo

- **UI screenshots:** whenever the UI changes, test it in **claude-in-chrome** and save the latest screenshot(s) to `docs/ui-screenshots/` (overwrite the "latest" set) so the repo always shows the current UI.
- **Dead code:** remove unused code, utilities, config keys, and copy as you go — keep the tree clean.
- **Docs follow the 7 Cs** (clear, concise, concrete, correct, coherent, complete, courteous) and must be understandable by someone with zero prior context.
- **Project source tree (below) must be kept current** — update the "Project source tree" section in this file after **every** file/folder create, rename, or delete. It excludes the already-documented subtrees (`mimic-iv-clinical-database-demo-2.2/`, `mimic-iv-docs/`), the gitignored `mimic-code-main/`, `.zip` archives, and build artifacts (`node_modules/`, `.next/`, `__pycache__/`).

## Project source tree

_Excludes the extracted dataset, `mimic-iv-docs/`, `mimic-code-main/`, `.zip` files, and build artifacts (see trees for those elsewhere in this file). Keep this updated on every file/folder change._

```
patient-care-track-2/
├── backend/                          # FastAPI + DuckDB
│   ├── app/
│   │   ├── api/__init__.py
│   │   ├── cohort/                   # NL → IR → SQL
│   │   │   ├── __init__.py
│   │   │   ├── compiler.py           # IR → DuckDB SQL (+ joins/temporal/negation/LOS)
│   │   │   ├── ir.py                 # CohortIR pydantic models
│   │   │   └── nl.py                 # OpenAI structured output + keyword fallback
│   │   ├── data/
│   │   │   ├── __init__.py
│   │   │   ├── loader.py             # DuckDB view per CSV
│   │   │   ├── schema.py             # introspection + /explore
│   │   │   └── timeline.py           # patient event journey (/patient/{id}/timeline)
│   │   ├── eval/
│   │   │   ├── __init__.py
│   │   │   ├── inject.py             # error-injection harness (baseline + multiseed)
│   │   │   └── metrics.py
│   │   ├── quality/
│   │   │   ├── __init__.py
│   │   │   ├── ranges.py             # plausibility bounds (MIT vitalsign.sql)
│   │   │   └── rules.py              # checks + scorecard + fixes
│   │   ├── __init__.py
│   │   ├── config.py                 # pydantic-settings (models, paths)
│   │   └── main.py                   # FastAPI app + endpoints
│   ├── tests/                        # pytest (conftest forces keyword path)
│   │   ├── __init__.py · conftest.py · test_api.py
│   │   ├── test_cohort_and_eval.py · test_data_and_quality.py
│   ├── Dockerfile · README.md · pytest.ini · requirements.txt
├── docs/
│   ├── test-cases/                   # test suite + reusable result logs
│   │   ├── RESULTS.md · results.json · cohortfit-test-suite.json · sample-test-cases.json
│   ├── ui-screenshots/               # latest UI screenshots (refresh on UI change)
│   ├── EVALUATION_REPORT.md · SAFETY_STATEMENT.md · TRACK2_REQUIREMENTS.md · UX_CRITIQUE.md
│   ├── RESEARCH_AND_EXPLORATION.md · design-direction.md · design-explorer.html
├── frontend/                         # Next.js 14 (Lab Ledger design system)
│   ├── app/
│   │   ├── about/page.tsx · cohorts/{page.tsx, StepTrace.tsx, Timeline.tsx} · evaluation/page.tsx
│   │   ├── quality/{page.tsx, FixLedger.tsx} · schema/{page.tsx, Erd.tsx}
│   │   ├── components/               # reusable: Icon, DataTable, FilterBar, Nav, useTableExplorer, charts, Explain
│   │   ├── lib/api.ts · globals.css · layout.tsx · page.tsx
│   ├── public/fonts/                 # self-hosted Hanken Grotesk + IBM Plex Mono
│   ├── Dockerfile · package.json · tsconfig.json · next.config.mjs · .dockerignore · .gitignore
├── hackathon-instructions/           # the two source PDFs
├── .env.example · .gitattributes · .gitignore
├── CLAUDE.md · README.md · PROGRESS.md · TENTATIVE_AGILE_PLAN.md · TENTATIVE_FRONTEND_DESIGN_SYSTEM.md
└── docker-compose.yml
```

## Key project docs (read these before building)

- **`PROGRESS.md`** — living status tracker (Past / Current / Pending). **Update it as work happens; check it first each session.**
- `TENTATIVE_AGILE_PLAN.md` — product plan: use cases, Does/Never, rubric mapping, eval harness, demo arc, build order + MVP cut line.
- `docs/TRACK2_REQUIREMENTS.md` — faithful extract of both hackathon PDFs (rubric weights, metrics, safety text, submission rules).
- `docs/RESEARCH_AND_EXPLORATION.md` — the measured data map, DQ opportunity catalogue (real values), documented-bug citations, and model/method decisions with sources.

## Conventions

- **Secrets:** real `.env` is gitignored; use `.env.example` as the template (`OPENAI_API_KEY`, model IDs). Never commit keys.
- **Config over hardcoding:** model IDs, temperature, data paths, and plausibility-rule tables live in config, not inline.
- **Data-quality correctness gate:** only ~782 of 4,014 ICU items are numeric — gate every plausibility/missingness rule on `d_items.param_type` (a null `valuenum` on a text/checkbox item is NOT a defect).

## Commit policy

**Never add co-author trailers to commits.** Do not append `Co-Authored-By: Claude ...` (or any Claude/AI co-author line) to commit messages. Commits must be authored solely by the user.

## Data & repo layout

This project uses the MIT-LCP MIMIC-IV demo dataset together with the official MIMIC code repository.

### `mimic-iv-clinical-database-demo-2.2/`
The **extracted** contents of `mimic-iv-clinical-database-demo-2.2.zip` (the MIMIC-IV Clinical Database Demo v2.2). The original zip shipped every table as a `.csv.gz`; those have all been decompressed to plain `.csv` in place, preserving the archive's folder structure. This folder **is** the dataset — it is committed to the repo.

### `mimic-code-main/`
The downloaded source of the official MIMIC code repository: **https://github.com/MIT-LCP/mimic-code**.

- This folder is **gitignored** (see `.gitignore`) — it is a large upstream repo and is not tracked here.
- It **must** be present on disk to work with this project. Download/clone it from the URL above and place it here **in folder format** (extracted, not as a `.zip`). The directory name must be `mimic-code-main/`.

### `mimic-iv-docs/`
The official MIMIC-IV **prose documentation**, copied into the project root so the docs are available without opening the source zip/site again.

- Source: the `docs/iv/` folder inside `mimic.mit.edu-main.zip` — the downloaded repo of the MIMIC documentation website **https://github.com/MIT-LCP/mimic.mit.edu** (published at https://mimic.mit.edu/docs/iv/). This is the Jekyll source for the docs site.
- Contents (66 markdown files): `about/` (changelog, concepts, schema-overview, whatsnew), `modules/` with per-table docs for `hosp/`, `icu/`, `ed/`, `cxr/`, `ecg/`, `note/`, and `tutorials/`. The `modules/hosp/*.md` and `modules/icu/*.md` files document every table present in `mimic-iv-clinical-database-demo-2.2/`.
- This is a static copy of `docs/iv/`; re-copy it from a fresh `mimic.mit.edu-main.zip` if the docs are updated.

## Full tree of `mimic-iv-clinical-database-demo-2.2/`

```
mimic-iv-clinical-database-demo-2.2/
├── LICENSE.txt
├── README.txt
├── SHA256SUMS.txt
├── demo_subject_id.csv
├── hosp/
│   ├── admissions.csv
│   ├── d_hcpcs.csv
│   ├── d_icd_diagnoses.csv
│   ├── d_icd_procedures.csv
│   ├── d_labitems.csv
│   ├── diagnoses_icd.csv
│   ├── drgcodes.csv
│   ├── emar.csv
│   ├── emar_detail.csv
│   ├── hcpcsevents.csv
│   ├── labevents.csv
│   ├── microbiologyevents.csv
│   ├── omr.csv
│   ├── patients.csv
│   ├── pharmacy.csv
│   ├── poe.csv
│   ├── poe_detail.csv
│   ├── prescriptions.csv
│   ├── procedures_icd.csv
│   ├── provider.csv
│   ├── services.csv
│   └── transfers.csv
└── icu/
    ├── caregiver.csv
    ├── chartevents.csv
    ├── d_items.csv
    ├── datetimeevents.csv
    ├── icustays.csv
    ├── ingredientevents.csv
    ├── inputevents.csv
    ├── outputevents.csv
    └── procedureevents.csv
```

## Tree of `mimic-iv-docs/` (from `docs/iv/`)

```
mimic-iv-docs/
├── index.md
├── about/
│   ├── changelog.md
│   ├── concepts.md
│   ├── index.md
│   ├── schema-overview.md
│   └── whatsnew.md
├── modules/
│   ├── index.md
│   ├── cxr/
│   │   ├── index.md
│   │   └── record_list.md
│   ├── ecg/
│   │   ├── index.md
│   │   ├── machine_measurements.md
│   │   ├── record_list.md
│   │   └── waveform_note_links.md
│   ├── ed/
│   │   ├── diagnosis.md
│   │   ├── edstays.md
│   │   ├── index.md
│   │   ├── medrecon.md
│   │   ├── pyxis.md
│   │   ├── triage.md
│   │   └── vitalsign.md
│   ├── hosp/
│   │   ├── admissions.md
│   │   ├── d_hcpcs.md
│   │   ├── d_icd_diagnoses.md
│   │   ├── d_icd_procedures.md
│   │   ├── d_labitems.md
│   │   ├── diagnoses_icd.md
│   │   ├── drgcodes.md
│   │   ├── emar.md
│   │   ├── emar_detail.md
│   │   ├── hcpcsevents.md
│   │   ├── index.md
│   │   ├── labevents.md
│   │   ├── microbiologyevents.md
│   │   ├── omr.md
│   │   ├── patients.md
│   │   ├── pharmacy.md
│   │   ├── poe.md
│   │   ├── poe_detail.md
│   │   ├── prescriptions.md
│   │   ├── procedures_icd.md
│   │   ├── provider.md
│   │   ├── services.md
│   │   └── transfers.md
│   ├── icu/
│   │   ├── caregiver.md
│   │   ├── chartevents.md
│   │   ├── d_items.md
│   │   ├── datetimesevents.md
│   │   ├── icustays.md
│   │   ├── index.md
│   │   ├── ingredientevents.md
│   │   ├── inputevents.md
│   │   ├── outputevents.md
│   │   └── procedureevents.md
│   └── note/
│       ├── discharge.md
│       ├── discharge_detail.md
│       ├── index.md
│       ├── radiology.md
│       └── radiology_detail.md
└── tutorials/
    ├── bigquery.md
    ├── first-query.md
    ├── index.md
    ├── video.md
    ├── cxr/
    │   ├── index.md
    │   └── study.md
    └── waveform/
        ├── ieee_workshop.md
        └── index.md
```
