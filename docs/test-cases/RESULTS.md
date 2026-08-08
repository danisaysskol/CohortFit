# CohortFit — Test Results

**Run date:** 2026-08-08 · **Backend:** http://localhost:8000 · **Cases:** 46 (21 pass / 13 partial / 12 fail)

> ⚠️ **These results reflect the KEYWORD-FALLBACK path — no OpenAI key is configured.**
> Every `/cohort/build` response carried `method: "keyword-fallback"`. The keyword parser is a thin regex layer,
> not the LLM. Many "fail"/"partial" verdicts below are therefore *expected gaps of the fallback*, not code defects —
> **except** the number-grabbing mis-parses (CF-15, CF-16) and silent constraint drops, which are genuine bugs that
> would mislead a user regardless of the LLM.
> All cohort counts were verified against the raw CSVs in `mimic-iv-clinical-database-demo-2.2/`.
> Machine-readable cache: `results.json` (reuse it — do not re-call the API).

---

## Summary by verdict × type

| Type | Pass | Partial | Fail | Total |
|---|---|---|---|---|
| positive (cohort) | 8 | 1 | 9 | 18 |
| negative (ambiguous/abstain/refuse/security) | 3 | 9 | 2 | 14 |
| data_quality | 8 | 3 | 1 | 12 |
| **Total** | **21** | **13** | **12** | **46** |

## Summary by "supported" level (current capability)

| supported | Pass | Partial | Fail | Total |
|---|---|---|---|---|
| yes (works today) | 21 | 0 | 0 | 21 |
| partial (some logic, silently incomplete) | 0 | 5 | 2 | 7 |
| gap (capability absent) | 0 | 8 | 10 | 18 |

---

## What works (confirmed, grounded)

- **Single-criterion cohorts**: age `over N`, `ICU`, `died/mortality`, and the recognized drug names all return
  counts that exactly match the CSVs — insulin 66, furosemide 54, norepinephrine 26, heparin 92, died 15, over-70 30, over-65 44.
- **AND composition**: "warfarin and vancomycin" correctly intersects to 14; "over 65 + ICU" to 44.
- **SQL/prompt injection is safe**: `DROP TABLE` / `DELETE FROM` are never executed; parameterized subqueries only.
  `/eval/run` still reports population 275 after injection attempts → source data untouched.
- **Input validation**: missing `text` → HTTP 422; empty string → graceful abstain; no crashes observed.
- **Data-quality scorecard is real and well-classified**: 11 findings across 5 dimensions, each tagged with
  `severity` (red/amber/green) and `kind` (`data_error` / `caveat` / `real_finding`) — it correctly separates a
  Fahrenheit-mislabeled-as-Celsius error from an outpatient-labs completeness *caveat*. `/quality/fixes` proposes
  only reversible, working-copy fixes. `/eval/run` scores its one seeded temporal check at precision=recall=f1=1.0.

## Bugs observed (would mislead a user even with an LLM upstream)

| # | Case | Symptom | Root cause |
|---|---|---|---|
| BUG-1 | **CF-15** potassium **over 5.5** | returns **all 100** patients | the age regex grabs the bare number → `age >= 5`; lab thresholds unsupported |
| BUG-2 | **CF-16** heart rate **above 120** | returns **0** (misleading empty) | same number-grab → `age >= 120`; vitals unsupported |
| BUG-3 | **CF-13 / CF-17 / CF-18 / CF-14** | unrecognized constraint silently dropped, returns the **over-inclusive** remainder (100) | parser keeps recognized keywords, discards the rest with no warning |
| BUG-4 | **CF-01 / CF-10** gender | gender clause silently dropped (female-over-70 → 30 instead of 13) | no gender support in keyword path |
| BUG-5 | **CF-27** cross-hospital mortality | returns a 15-patient death cohort instead of abstaining | "mortality" keyword fires; the impossible cross-hospital intent is ignored |
| BUG-6 | **CF-12** contradiction (under 12 AND over 65) | returns 44 instead of flagging the impossibility | "under 12" unparsed, contradiction undetected |
| BUG-7 | **CF-19** aggregation (avg LOS) | returns a cohort (n=16), not an average | aggregation unsupported; silently reinterpreted as a filter |

No crashes, hangs, or 500s were seen. The dangerous class is **silent** wrong answers (BUG-1..3, BUG-5), where the API
returns `answerable:true` with a confident count that is quietly incorrect.

---

## GAPS to build next (prioritized)

**P0 — silent wrong answers (fix first; these lie confidently):**
1. **Stop the age regex from swallowing non-age numbers** (CF-15, CF-16). A number after "over/above" that follows a
   lab/vital noun must NOT become `anchor_age`. This is the single highest-impact bug.
2. **Refuse to partially-parse.** When part of a query is unrecognized (CF-13, CF-14, CF-17, CF-18), abstain or warn
   instead of silently dropping the constraint and returning the over-inclusive remainder.
3. **Gender criterion** (CF-01, CF-10, CF-11) — trivial to add, currently dropped everywhere.
4. **"under / younger than N" age parsing** (CF-12, CF-13) — its absence causes both the empty-set and contradiction failures.
5. **Contradiction detection** (CF-12) once "under N" exists — flag empty-by-construction filters.

**P1 — missing cohort capabilities (abstain safely today, so lower risk):**
6. **Diagnosis parsing** (CF-23) — map disease words to ICD `long_title LIKE` (diabetes grounds to 35 patients).
7. **Lab-threshold criterion** by itemid (CF-15) — the intended feature behind BUG-1.
8. **ICU vitals threshold** via chartevents itemid (CF-16, e.g. HR 220045).
9. **LOS filter** (CF-17), **negation/anti-join** (CF-14), **readmission self-join** (CF-24),
   **temporal-ordering joins** (CF-18), **aggregation** (CF-19).
10. **Cross-hospital / seasonality / calendar-year abstention with a *specific reason*** (CF-25, CF-26, CF-27) —
    and CF-27 must stop firing the mortality keyword.

**P1/P2 — richer negative handling (safe but generic today):**
11. **Clarification dialog** for ambiguous terms (CF-20 "sick", CF-21 "recent", CF-22 "high BP") instead of a
    one-size-fits-all "no criteria recognized" abstain.
12. **Explicit typed refusals** for prediction / medical-advice / re-identification (CF-28, CF-29, CF-30) — currently
    safe-but-generic; a purpose-built refusal message would be clearer and demo-stronger.

**Data-quality gaps (scorecard is a fixed report; add these checks):**
13. **Hidden-value-in-comments** (QC-09) — null `valuenum` with a meaningful `comments` (HIV viral load itemid 51652).
    This is the documented MIMIC "ace" finding and is currently absent.
14. **storetime < charttime** temporal rule (QC-10) — distinct from the existing charttime-vs-admission-window check.
15. **Per-ICU-stay heart-rate completeness** (QC-11) — MIMIC's own ≥99%-of-stays-have-HR heuristic.
16. **Near-duplicate detection on measurement tables + reversible de-dup proposal** (QC-12) — today only exact-key
    dup checking on `diagnoses_icd` exists.

---

## Notes on the sample suite (`sample-test-cases.json`)

The sample is written for the **LLM-backed ideal**, so several of its `expected_behavior` clauses do not match the
running app on the keyword path:
- TC-01 assumes gender is applied — it is silently dropped.
- TC-02 (diabetes), TC-08 (readmission), TC-09 (temporal), TC-10 (negation), TC-11 (aggregation) assume joins/logic
  the keyword parser does not implement — the app abstains (safe) rather than returning those cohorts.
- TC-16/TC-30 assume "under N" parsing and contradiction/empty-set handling — the app instead returns the
  over-inclusive remainder (44 and 100), which is *worse* than the sample anticipated.
- TC-24/26/27/28 data-quality expectations partly exceed the current scorecard (see QC-09/10/11/12).
- Its safety-banner-on-every-screen claim holds at the API layer: every response carries the `safety` string.
