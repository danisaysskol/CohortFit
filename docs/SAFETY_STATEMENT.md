# Safety & Data Statement — CohortFit (Track 2)

> Required deliverable. Displayed in-product on every page: **Research and educational prototype only. Not for clinical use. Do not use for diagnosis, treatment, triage, or emergency decisions.**

## Intended use
A research/education tool for clinical-data researchers, educators, and data teams to (a) define patient cohorts from plain English with visible inclusion/exclusion logic, and (b) assess whether the data are fit for a stated analysis. Outputs are for exploration and methodology, not patient care.

## Prohibited use
- No diagnosis, treatment, triage, or emergency guidance.
- No patient-specific recommendations, treatment rankings, or claims of improved outcomes.
- No claims of clinical validity, safety, subgroup fairness, or generalization — 100 patients cannot support these.
- No reidentification attempts; no inferring calendar dates, seasonality, or cross-patient chronology (dates are shifted).

## Data lineage
- Source: MIMIC-IV Clinical Database Demo v2.2 (PhysioNet), 100 de-identified patients. Cite the dataset version and PhysioNet licence.
- The frozen CSVs are read via DuckDB **views** — the app never writes to them. The data volume is mounted **read-only** in Docker.
- Derived artifacts (cohort IR, compiled SQL, `query_hash`, quality findings, injected-error copies) are computed at request time and are clearly derived, never presented as source.

## Privacy handling (licence-aware minimization)
- The brief requires *minimizing data sent to external services*. In the cohort-build path the LLM receives only the **user's text + a schema-describing system prompt** (a schema description + an itemid reference list) — no patient rows, no summary statistics, and no DDL (verified in `backend/app/cohort/nl.py`). The dataset is never dumped to any service.
- Without an `OPENAI_API_KEY`, the tool runs fully offline via a disclosed keyword fallback — no data leaves the machine at all.
- Sample rows shown in the Schema Explorer are served to the **local UI only**.

## AI transparency
- AI-generated content (cohort recipe/IR, flag explanations) is visually marked (an "AI" block, distinct from source data).
- The LLM never writes executable SQL; it emits a validated IR that our deterministic compiler turns into SQL. The IR and SQL are both shown.
- The tool **abstains** — explicitly, with a reason — when the structured record cannot support a request. Hallucination/out-of-scope behavior is tested.

## Failure modes (and behavior)
| Situation | Behavior |
|---|---|
| Request needs data not in the tables (e.g. COVID PCR) | Abstain with a stated reason; no query invented. |
| Calendar-time / seasonality request | Abstain (dates are shifted). |
| Ambiguous data-quality case (e.g. mixed units) | Flag for **human review**, do not auto-correct. |
| Extreme-but-real clinical value | Reported as a **finding**, not an error (gated on `param_type` + reference ranges). |
| Backend unavailable | UI shows a clear error with recovery hint; no silent wrong answer. |

## Human-review boundary
CohortFit assists; it does not act. A human must review cohort definitions before any downstream use, must decide on any data correction (fixes are **proposed only** — reversible by construction, never applied by CohortFit, and never committed to source; the store is read-only and there is no server-side fix log), and must not use outputs for clinical decisions. No automated clinical action is possible.

## Licence & attribution
Use of MIMIC-IV Demo v2.2 follows the PhysioNet licence and attribution terms. External code/reference (e.g. MIT `mimic-code` plausibility ranges) is cited in `docs/RESEARCH.md`.
