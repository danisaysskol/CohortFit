# CohortFit

> **Research and educational prototype only. Not for clinical use. Do not use for diagnosis, treatment, triage, or emergency decisions.**

**CohortFit turns a plain-English cohort description into a transparent, showable query — who's in, who's out, and why — then scores whether the data are actually fit to trust, telling real clinical findings apart from data errors, and only ever suggesting fixes that are reversible and explained.** Built for the **Sofstica AI Hackathon 2026**, "AI for Smarter Patient Care", **Track 2 — Cohort & Data Quality Explorer**, on the MIT-LCP **MIMIC-IV Demo v2.2** dataset.

The pitch in one line: **honesty as a feature** — CohortFit's most valuable job is telling a researcher *when their analysis isn't possible*, before they waste weeks on unfit data.

## 🔗 Live demo

**App:** https://cohortfit.vercel.app

The hosted demo runs the full **OpenAI (GPT‑5.6)** natural‑language path — no key needed to try it. (Running locally, the app works offline via a disclosed keyword fallback unless you set your own `OPENAI_API_KEY`; see [Quick start](#-quick-start).)

Next.js frontend on Vercel; FastAPI + DuckDB backend on Heroku (container). Deidentified MIMIC-IV **Demo** data only.

---

## ✨ Highlights

- **Honest, quantified evaluation.** Labeled errors are injected into a *copy* of the data, and the engine's **precision / recall / false-positive rate** are reported per dimension with uncertainty (mean ± std across seeds), not a single headline number.
- **Real-finding vs. data-error separation.** The plausibility check is gated on `d_items.param_type` and MIT reference ranges, so an extreme-but-genuine value is reported as a finding rather than a typo — the exact distinction Track 2 requires.
- **Abstention as a first-class behavior.** When the data can't support a request, CohortFit declines and explains why instead of inventing an answer.
- **Provenance to the exact row.** Every flag and every cohort member links back to its source table, column, id, and time.
- **Reproducibility by construction.** The IR→SQL compiler is deterministic; each build returns a `query_hash` (a digest of the compiled SQL + IR) and the cohort exports as a re-runnable "recipe" JSON. Nothing is persisted server-side; the store is read-only.
- **Licence-aware data minimization.** Following the PhysioNet licence, the model receives only a schema-describing prompt (a schema description + an itemid reference list) plus the user's text — no patient rows, no summary statistics, no DDL.
- **Robust at the edges.** Missing, ambiguous, duplicate, mis-timed, and out-of-scope inputs are all handled and shown explicitly.

---

## 🚀 Quick start

The whole stack runs in Docker — one command:

```bash
docker compose up --build
# frontend → http://localhost:3000   ·   backend API → http://localhost:8000
```

`OPENAI_API_KEY` is **optional**: without it, the cohort builder uses a disclosed keyword fallback so everything works offline. To enable the OpenAI path, copy `.env.example` → `.env` and set your key.

Run the backend tests (35, in Docker):

```bash
docker compose run --rm backend pytest
```

## 🧭 How it works

```
Plain English ──▶ OpenAI (or keyword fallback) ──▶ validated JSON IR ──▶ compiler ──▶ DuckDB SQL
   (browser)        (schema + text only)            (never raw SQL)      (deterministic)   │
                                                                                           ▼
  Next.js UI ◀────────── FastAPI ◀───────────────── provenance funnel + subject_ids + query_hash
  (Lab Ledger)          (:8000)                      quality scorecard · reversible fixes · eval
```

- **Frontend:** Next.js 14 (App Router), the *Lab Ledger* design system (`docs/DESIGN_SYSTEM.md`), self-hosted fonts.
- **Backend:** FastAPI + DuckDB over the frozen demo CSVs (read-only). The LLM emits a validated **IR**, never executable SQL; a deterministic compiler runs it.
- **Reproducible:** the IR→SQL compiler is deterministic; each build returns a `query_hash` and the cohort exports as a re-runnable recipe JSON; the eval harness is seeded. (Nothing is persisted server-side — the store is read-only.)

## 🖥️ The app

| Cohorts — builder + Provenance Ledger | Quality — scorecard + findings |
|---|---|
| ![Cohorts](docs/ui-screenshots/app-cohorts.jpg) | ![Quality](docs/ui-screenshots/app-quality.jpg) |
| **Schema explorer** | **Evaluation — injected-error metrics** |
| ![Schema](docs/ui-screenshots/app-schema.jpg) | ![Evaluation](docs/ui-screenshots/app-evaluation.jpg) |

Pages: **Schema** (tables, keys, sample) · **Cohorts** (NL → Provenance Ledger, e.g. 100→41→9 + IR/SQL) · **Quality** (R/A/G scorecard, data-error-vs-finding, proposed reversible fixes) · **Evaluation** (precision/recall from self-injected errors) · **About/Safety**.

## 📝 Project description (submission pitch)

> CohortFit turns a plain-English patient-group description into a transparent, reproducible query and a verdict on whether the data can be trusted, on the MIMIC-IV demo of 100 de-identified ICU patients. The language model never writes SQL but emits a validated query plan that a deterministic compiler runs, and every result carries a reproducibility hash. The app shows the inclusion and exclusion steps behind a cohort, grades the data across five quality dimensions, separates a genuine clinical finding from a recording error, and traces each flag to the real rows. Any fix it proposes is reversible and rule-backed, and it never changes the source data. When it cannot answer honestly, it explains why instead of inventing an answer. This matters because researchers often spend weeks preparing an analysis before finding the data cannot support it. With more time we would broaden language coverage, test more quality dimensions with injected errors, and add patient-grouped cross-validation.

## 📚 Documentation

- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — the hackathon brief, extracted.
- [`docs/RESEARCH.md`](docs/RESEARCH.md) — data map, evidence, model/method R&D (from-scratch explainer + real samples).
- [`docs/EVALUATION_REPORT.md`](docs/EVALUATION_REPORT.md) · [`docs/SAFETY_STATEMENT.md`](docs/SAFETY_STATEMENT.md) — required deliverables.
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — the design system.

---

## 🛠️ Build, run & evaluate

Everything needed is in this repo — **no extra downloads required.** `docker compose up --build` (see [Quick start](#-quick-start)) brings up the full stack against the **committed** MIMIC-IV Demo dataset. Configuration is optional: copy `.env.example` → `.env` to enable the OpenAI path, otherwise the app runs offline with a disclosed keyword fallback. Evaluate with the test suite (`docker compose run --rm backend pytest`) and the in-app **Evaluation** page, or just use the [live demo](#-live-demo).

The hosted API is **rate-limited per IP** (configurable; default 30 requests/minute and 200/hour) and CORS-restricted, so the public demo can't be scripted to drain the OpenAI budget — see [`docs/SAFETY_STATEMENT.md`](docs/SAFETY_STATEMENT.md).

**Optional reference:** the plausibility bounds are cited to MIT's [`mimic-code`](https://github.com/MIT-LCP/mimic-code) (`concepts/measurement/vitalsign.sql`). Those bounds are already encoded in `backend/app/quality/ranges.py`, so you do **not** need to download `mimic-code` to build, run, or evaluate — it's a citation, not a dependency.

## Data & repo layout

This project uses the MIT-LCP MIMIC-IV demo dataset together with the official MIMIC code repository.

### `mimic-iv-clinical-database-demo-2.2/`
The **extracted** contents of `mimic-iv-clinical-database-demo-2.2.zip` (the MIMIC-IV Clinical Database Demo v2.2). The original zip shipped every table as a `.csv.gz`; those have all been decompressed to plain `.csv` in place, preserving the archive's folder structure. This folder **is** the dataset — it is committed to the repo.

### `mimic-code-main/`
The downloaded source of the official MIMIC code repository: **https://github.com/MIT-LCP/mimic-code**.

- This folder is **gitignored** (see `.gitignore`) — it is a large upstream repo and is not tracked here.
- **Not required to build, run, or evaluate the app** — the plausibility bounds it informs are already encoded in `backend/app/quality/ranges.py`. It is a cited reference; download it from the URL above only if you want to inspect the upstream SQL.

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
