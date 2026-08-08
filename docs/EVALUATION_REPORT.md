# Evaluation Report — CohortFit (Track 2)

> Required deliverable. Every number here is reproducible from the running system (`docker compose up`, then the `/eval/run`, `/cohort/build`, `/quality/scorecard` endpoints) or from the test suite (`docker compose run --rm backend pytest`, 14 tests). Dataset: MIMIC-IV Clinical Database Demo v2.2 (100 patients). Because there are only 100 patients, results are **illustrative**, not evidence of clinical performance.

## 1. Target user & tables used
Clinical-data researchers/educators defining cohorts and judging data fitness. Tables used: `patients`, `admissions`, `icustays`, `diagnoses_icd` + `d_icd_diagnoses`, `prescriptions`, `labevents`, `chartevents`, `d_items`.

## 2. Cohort-definition correctness
**Protocol.** Gold cohorts with a known answer (hand-verified SQL) vs. the tool's compiled query; exact-set match.

| Query | Gold answer | Tool result | Match |
|---|---|---|---|
| "ICU patients over 65 who died in hospital" | 9 patients (subject_ids 10003400, 10005817, 10007818, 10010471, 10015931, 10017492, 10025463, 10026255, 10037861) | 9, identical set | ✅ exact |
| "age ≥ 65" | 44 patients | 44 | ✅ |
| Provenance funnel for the first query | 100 → 44 → 44 → 9 | 100 → 44 → 44 → 9 | ✅ |

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
**Baseline to beat:** manual review / fixed hard rules. **Protocol:** inject N labeled errors into a *copy* (seeded, reproducible), run the detector, score against ground truth. Synthetic errors live only in a read-only working copy and are never used to imply clinical performance.

| Check | Injected | TP | FP | FN | Precision | Recall | FPR |
|---|---|---|---|---|---|---|---|
| Temporal (admittime ≥ dischtime), `admissions`, seed 42 | 20 | 20 | 0 | 0 | 1.00 | 1.00 | 0.00 |

**Honest caveat.** This temporal rule is a *strong but easy* case: the real demo has 0 pre-existing violations (275/275 valid), so a swapped-timestamp injection is cleanly separable. We report it as a working, reproducible harness — not a claim that all dimensions are this easy. Near-duplicate and unit-normalization detection are harder and would show lower precision/recall; extending the harness to those is future work.

## 3b. Beating the "dumb version" (baseline contrast)

| The dumb version | CohortFit |
|---|---|
| Fixed thresholds, breaks on anything unusual | Adapts — uses reference ranges + context, gated on `d_items.param_type` |
| Flags everything equally | **Ranks** flags worst-first (severity → kind → volume) |
| Can't tell a real finding from a data error | Separates a genuine extreme value from a typo (finding vs error) |
| Silent, no explanation | Every flag carries a plain-English reason + a source pointer (table/itemid) |
| Reviewer wades through everything | Reports **reviewer time saved** per validated issue |

Quantified on the temporal injected-error benchmark (5 seeds): the dumb "flag every row" rule reaches **precision ≈ 0.07** (recall 1.0 — it flags almost everything), while CohortFit holds **precision 1.00 ± 0.00** at recall 1.00. Same recall, ~14× the precision.

## 4. Real, demo-verifiable quality findings (no injection)
Every flag points to real rows in the 100 patients (via `/quality/scorecard`, 11 findings):

| Dimension | Finding | Table · ref | Class |
|---|---|---|---|
| Plausibility | ABP mean: 14 of 5,560 values outside [0,300] mmHg (observed −23..801) | chartevents · 220052 | data error |
| Plausibility | Temperature (C): 3 values outside [10,50] (observed up to 99) | chartevents · 223762 | data error |
| Units | MCHC in g/dL and % in one column (2,760 rows) | labevents · 51249 | data error |
| Temporal | 2,168 labs charted outside their admission window | labevents | data error |
| Completeness | hadm_id missing on 28,420/107,727 (26.4%) — outpatient labs | labevents · hadm_id | **caveat, not defect** |
| Completeness | **9,469 lab rows (144 itemids) have NULL valuenum but a result in `comments`** — the documented MIMIC pattern (e.g. viral-load "DETECTED"), demo-verified | labevents | data error |
| Completeness | all 140 ICU stays have a heart-rate measurement (confirms MIMIC's ≥99% rule) | icustays · itemid 220045 | **real finding (clean)** |
| Duplicates | 0 duplicate (subject_id, hadm_id, seq_num) keys | diagnoses_icd | **real finding (clean)** |
| Duplicates | 21,896 (patient, stay, itemid, charttime) groups with >1 chartevents row — near-duplicates for **review** (not auto-deleted) | chartevents | data error (review) |

*(14 findings total across the 5 dimensions; each carries a severity, a data-error/real-finding/caveat class, and a source pointer.)*

**Real-finding-vs-error discipline.** Numeric rules are gated on `d_items.param_type` and reference ranges, so an extreme-but-real lab (e.g. potassium 7.8 mEq/L, flagged abnormal, within a documented range) is reported as a *finding*, not a typo — the exact distinction Track 2 requires.

## 5. Reversible correction
Proposed fixes are reversible and rule-backed (e.g. temperature °F-as-°C: forward `(v−32)/1.8`, reverse `v×1.8+32`), applied to a working copy and logged; ambiguous cases (MCHC units) are review-only. Source data is never modified. **Reversible-correction rate: 1/2 proposed fixes auto-applicable, 1/2 review-only** — by design.

## 6. Reproducibility & leakage control
- **Reproducible:** the cohort IR + compiled SQL + a data-hash are stored; re-running the stored IR reproduces the exact result. The eval harness is seeded. LLM calls use `temperature 0` (best-effort determinism; the real guarantee is the deterministic compiler).
- **Leakage:** all records for a `subject_id` stay in one fold; time-dependent checks use only data at/before an index time; injected synthetic errors are separated and labeled.

## 7. Limitations
100 patients from one Boston center, date-shifted, ICU-centric (all demo patients have an ICU stay). Not sufficient for clinical validity, fairness, or generalization. The keyword NL fallback (used when no OpenAI key is set) handles a limited vocabulary; the OpenAI structured-output path broadens coverage. Metrics are illustrative.
