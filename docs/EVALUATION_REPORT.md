# Evaluation Report — CohortFit (Track 2)

> Required deliverable. Every number here is reproducible from the running system (`docker compose up`, then the `/eval/run`, `/cohort/build`, `/quality/scorecard` endpoints) or from the test suite (`docker compose run --rm backend pytest`, 36 tests). Dataset: MIMIC-IV Clinical Database Demo v2.2 (100 patients). Because there are only 100 patients, results are **illustrative**, not evidence of clinical performance.

## 1. Target user & tables used
Clinical-data researchers/educators defining cohorts and judging data fitness. Tables used: `patients`, `admissions`, `icustays`, `diagnoses_icd` + `d_icd_diagnoses`, `prescriptions`, `labevents`, `chartevents`, `d_items`.

## 2. Cohort-definition correctness
**Protocol.** Gold cohorts with a known answer (hand-verified SQL) vs. the tool's compiled query; exact-set match.

| Query | Gold answer | Tool result | Match |
|---|---|---|---|
| "ICU patients over 65 who died in hospital" | 9 patients (subject_ids 10003400, 10005817, 10007818, 10010471, 10015931, 10017492, 10025463, 10026255, 10037861) | 9, identical set | ✅ exact |
| "age ≥ 65" (inclusive) · "age > 65" (strict) | 44 · 41 | 44 · 41 | ✅ |
| Provenance funnel, live OpenAI path ("over" = strict `> 65`) | 100 → 41 → 9 | 100 → 41 → 9 | ✅ |
| Provenance funnel, deterministic keyword path ("over 65" = `≥ 65`) | 100 → 44 → 44 → 9 | 100 → 44 → 44 → 9 | ✅ (pytest gold) |

> Both paths return the **same 9 patients**; they differ only on the age boundary. The live app and README use the OpenAI path, which reads "over 65" as strict `> 65` (41 before the mortality filter); the automated test forces the deterministic keyword path, which reads it as `≥ 65` (44). Both counts are CSV-verified.

**Multi-table joins & temporal logic** (rubric §8 "joins and temporal logic are sound") — verified live via the OpenAI path (`method=openai`):

| Query | Capability | Result |
|---|---|---|
| "patients with a diabetes diagnosis" | ICD long_title join (both ICD-9/10) | 35 |
| "female patients older than 70" | gender + age | 13 |
| "patients with potassium over 5.5" | lab threshold by itemid | 32 |
| "ICU stays longer than 7 days" | `icustays.los` | 18 |
| "patients who had a lab drawn before ICU admission" | labevents ⋈ icustays (temporal) | 61 |
| "patients readmitted within 30 days of discharge" | admissions self-join | 26 |
| "ICU patients who did NOT receive antibiotics" | anti-join (`exclude`) | 24 |

**Abstention / clarification / refusal.** Out-of-scope requests are handled honestly, not fabricated: "admitted in winter" → **abstain** (dates shifted); "under 12 AND over 65" → **clarify** (contradiction); "most likely to die next" → **refuse** (prediction). Verified by tests + live.

## 3. Data-quality detection — injected-error harness
**Baseline to beat:** manual review / fixed hard rules. **Protocol:** inject N labeled errors into a *copy* built in a read-only CTE (seeded, reproducible; never the source), run the detector, score against ground truth. Synthetic errors are never mixed with real records and are never used to imply clinical performance. Two dimensions currently have a clean, injectable ground truth and are scored here; results are the mean across 5 seeds (42, 7, 13, 99, 123).

| Dimension | Check | Injected | TP | FP | FN | Precision | Recall | FPR |
|---|---|---|---|---|---|---|---|---|
| Temporal | `admittime ≥ dischtime`, `admissions` | 20 | 20 | 0 | 0 | 1.00 | 1.00 | 0.00 |
| Units | off-modal unit on a single-unit lab itemid (itemid 50971), `labevents` | 20 | 20 | 0 | 0 | 1.00 | 1.00 | 0.00 |

**Honest caveat.** These are *strong but clean* cases. The real demo has 0 pre-existing temporal violations (275/275 valid), and the chosen lab itemid is recorded in exactly one unit, so a swapped-timestamp or wrong-unit injection is cleanly separable — that is why detection is perfect. We report these as working, reproducible harnesses, **not** a claim that every dimension is this easy. The other three dimensions (plausibility, completeness, duplicates) are not injected; they are evidenced by real, clickable findings on the Data-fitness page (§4). Injected errors stay within one record (an admission, or one lab row keyed by `labevent_id`), so no injected label leaks into the score.

## 3b. Beating the "dumb version" (baseline contrast)

| The dumb version | CohortFit |
|---|---|
| Fixed thresholds, breaks on anything unusual | Adapts — uses reference ranges + context, gated on `d_items.param_type` |
| Flags everything equally | **Ranks** flags worst-first (severity → kind → volume) |
| Can't tell a real finding from a data error | Separates a genuine extreme value from a typo (finding vs error) |
| Silent, no explanation | Every flag carries a plain-English reason + a source pointer (table/itemid) |
| Reviewer wades through everything | Reports **reviewer time saved** per validated issue |

Quantified on the injected-error benchmarks (5 seeds): the dumb "flag every row" rule reaches **precision ≈ 0.073** on the temporal check and **≈ 0.007** on the units check (recall 1.0 — it flags almost everything), while CohortFit holds **precision 1.00 ± 0.00** at recall 1.00 on both. Same recall, ~14× the precision on temporal and ~140× on units.

## 4. Real, demo-verifiable quality findings (no injection)
Every flag points to real rows in the 100 patients (via `/quality/scorecard`, which returns **15 findings, of which 11 are data errors**; the rest are caveats or verified/clean findings):

| Dimension | Finding | Table · ref | Class |
|---|---|---|---|
| Plausibility | ABP mean: 14 of 5,560 values outside [0,300] mmHg (observed −23..801) | chartevents · 220052 | data error |
| Plausibility | Temperature (C): 3 values outside [10,50] (observed up to 99) | chartevents · 223762 | data error |
| Units | MCHC in g/dL and % in one column (2,760 rows) | labevents · 51249 | data error |
| Temporal | 2,168 labs charted outside their admission window | labevents | data error |
| Temporal | ~54,144 rows with `storetime` earlier than `charttime` (a documented MIMIC recording pattern) | chartevents/labevents | **caveat, not defect** |
| Completeness | hadm_id missing on 28,420/107,727 (26.4%) — outpatient labs | labevents · hadm_id | **caveat, not defect** |
| Completeness | **9,469 lab rows (144 itemids) have NULL valuenum but a result in `comments`** — the documented MIMIC pattern (e.g. viral-load "DETECTED"), demo-verified | labevents | data error |
| Completeness | all 140 ICU stays have a heart-rate measurement (confirms MIMIC's ≥99% rule) | icustays · itemid 220045 | **real finding (clean)** |
| Duplicates | 0 duplicate (subject_id, hadm_id, seq_num) keys | diagnoses_icd | **real finding (clean)** |
| Duplicates | 21,896 (patient, stay, itemid, charttime) groups with >1 chartevents row — near-duplicates for **review** (not auto-deleted) | chartevents | data error (review) |

*(15 findings total across the 5 dimensions — 11 classed as data errors, the rest caveats or verified/clean findings; each carries a severity, a data-error/real-finding/caveat class, and a source pointer.)*

**Real-finding-vs-error discipline.** The plausibility rule is gated on `d_items.param_type` and reference ranges, so an extreme-but-real lab (e.g. potassium 7.8 mEq/L, flagged abnormal, within a documented range) is reported as a *finding*, not a typo — the exact distinction Track 2 requires.

## 5. Reversible correction (proposed only)
Fixes are **proposed, never applied** — CohortFit never modifies source data and keeps no server-side fix log; the store is read-only. **2 fixes proposed:** one with an automatic reversible transform (temperature °F-as-°C: forward `(v−32)/1.8`, reverse `v×1.8+32`) and one review-only (MCHC units, ambiguous). Each proposal is rule-backed and reversible by construction. In the UI, a user can add a proposal to a local, browser-side "review plan" (localStorage); nothing is committed anywhere.

## 6. Reproducibility & leakage control
- **Reproducible:** the IR→SQL compiler is deterministic; each `/cohort/build` returns a `query_hash` (a digest of the compiled SQL + IR — not a hash of the data, and not persisted server-side), and the cohort exports as a re-runnable "recipe" JSON (IR + SQL + subject_ids). Re-running the recipe reproduces the exact result. The eval harness is seeded (5 fixed seeds). No `temperature` is sent to the model — reproducibility comes from the deterministic compiler, not model sampling.
- **Leakage:** this is a **deterministic rule over seeded injections**, not a trained model — there is no train/test split, so "patient-grouped folds" and "index-time / label-leakage control" (the rubric's terms for predictive models) do not literally apply here. What we *do* guarantee: each injected error stays within a single record (an admission, or one lab row keyed by `labevent_id`), so no injected label ever leaks into the score, and the same rule is re-run across fixed seeds to report mean ± std rather than one number.

## 7. Limitations
100 patients from one Boston center, date-shifted, ICU-centric (all demo patients have an ICU stay). Not sufficient for clinical validity, fairness, or generalization. The keyword NL fallback (used when no OpenAI key is set) handles a limited vocabulary; the OpenAI structured-output path broadens coverage. Metrics are illustrative.
