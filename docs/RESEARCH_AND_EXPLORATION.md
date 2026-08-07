# Research & Exploration — CohortFit (Track 2)

> This is our documented R&D: the measured data map, the data-quality opportunity catalogue (with **real observed values**), the documented-bug citations, and the model/method decisions with sources. It doubles as the seed for the required **Evaluation Report** and **Technical Summary**.
>
> **Provenance discipline:** every quantitative claim below is either (a) **measured** directly from `mimic-iv-clinical-database-demo-2.2/` on 2026-08-08, or (b) **cited** to a file path / URL. No invented numbers.

---

## 0. Start here — the whole thing explained from scratch

*If you have never seen this project or this data before, read this section first. It assumes zero background.*

### 0.1 What is MIMIC-IV, and what do we actually have?
**MIMIC-IV** is a large, real, **de-identified** database of hospital records released by MIT for research. "De-identified" means names, exact dates, and other identifying details are removed or shifted so patients can't be recognized. We are using the **Demo v2.2** subset: a small, freely available slice covering **100 patients** from one Boston hospital.

The data is a set of **CSV files** (spreadsheet-like tables) split into two folders:
- **`hosp/`** — hospital-wide records: who the patients are, their admissions, diagnoses, lab tests, medications.
- **`icu/`** — intensive-care-unit records: bedside monitor readings (heart rate, blood pressure), fluids in/out, procedures.

The tables connect through shared **ID columns** (think of them as spreadsheet keys that let you match rows across files):
- **`subject_id`** = one patient.
- **`hadm_id`** = one hospital admission (a patient can have several).
- **`stay_id`** = one ICU stay (inside an admission).
- **`itemid`** = one *type* of measurement (e.g. "Heart Rate" is itemid 220045).

So the shape of the world is: **a patient → has admissions → some admissions include an ICU stay → which produces many timestamped measurements.**

There are also **dictionary tables** (names starting with `d_`, like `d_items`, `d_labitems`, `d_icd_diagnoses`). These are lookup tables: a measurement row only stores a code like `itemid=220045`, and the dictionary tells you that code means "Heart Rate". You **join** to a dictionary to turn codes into human labels.

### 0.2 What is a "cohort"?
A **cohort** is simply **a group of patients that match some criteria** — for example, *"patients over 65 who stayed in the ICU more than 3 days"*. Researchers define a cohort before they study it. Building one by hand means writing database queries (SQL) and carefully deciding who is **included** and who is **excluded**. Getting the inclusion/exclusion logic right is fiddly and error-prone.

### 0.3 What is "data quality", and why does it matter here?
Hospital data is recorded for **clinical care, not research**, so it contains mistakes: missing values, duplicated rows, impossible numbers (a heart rate of 900, a blood pressure of −23), and events with **timestamps in the wrong order** (a lab drawn "after" the patient was discharged). Before trusting an analysis, a researcher must check whether the data is **fit** for their question.

The hard, important part: **telling a real medical finding apart from a data error.** A genuinely sick patient can have an extreme-but-real lab value; that is *not* the same as a typo. A good tool must not confuse the two — and must **never silently "fix" the data** (any suggested fix has to be reversible and explained).

### 0.4 What we are building (Track 2) — CohortFit
Our hackathon track asks for a **Cohort & Data Quality Explorer**. **CohortFit** does two jobs:
1. **Cohort builder:** the researcher types a group description in **plain English**; CohortFit turns it into a database query and **shows the query** — including exactly who was included and who was excluded, and why.
2. **Data-quality checker:** CohortFit scans the data for problems (missing / duplicate / impossible / mis-timed / inconsistent-unit values), scores overall **fitness** as red/amber/green, and for each flag explains whether it's a **real finding or a data error** — suggesting only **reversible, rule-backed** fixes.

The thing that makes it stand out is **honesty**: CohortFit will **abstain** — clearly say "I can't answer that" — when the data doesn't support the request, instead of inventing an answer.

### 0.5 How CohortFit works, in one picture
```
Researcher types plain English
        │
        ▼
  OpenAI model  ──►  a strict JSON "recipe" (Intermediate Representation, IR)
  (never writes SQL) │  describing inclusion/exclusion criteria
        │            │  (the model can only use column names we allow)
        ▼            ▼
  Our code validates the IR against the real schema
        │
        ▼
  Compile IR ──► SQL  ──►  run on DuckDB over the CSVs
        │                          │
        ▼                          ▼
  Show the IR + SQL          Cohort result (who's in / out)
        │
        ▼
  Data-quality rules score fitness (red/amber/green), each flag links to the real row
```
Key safety property: by default the AI sees the **schema (column names) and aggregate summaries**, and only the minimal patient-level detail a task genuinely needs — the brief's *"minimize data sent to external services"* met deliberately (not an over-constraint), which respects the data licence and keeps things reproducible.

---

## A. Data map (measured from the 100-patient demo)

Root: `mimic-iv-clinical-database-demo-2.2/`. Cohort = **100 patients → 275 admissions → 140 ICU stays.**
Grain / join keys: `subject_id` (patient) → `hadm_id` (admission) → `stay_id` (ICU stay) → `itemid` (measurement type).

### Row counts & keys (selected)

| Table | Rows | Join keys | Key timestamps |
|---|---|---|---|
| hosp/patients | 100 | subject_id | dod (date) |
| hosp/admissions | 275 | subject_id, hadm_id | admittime, dischtime, deathtime, edregtime, edouttime |
| hosp/transfers | 1,190 | subject_id, hadm_id, transfer_id | intime, outtime |
| hosp/diagnoses_icd | 4,506 | subject_id, hadm_id | — (seq_num, icd_code, icd_version) |
| hosp/labevents | 107,727 | subject_id, hadm_id, specimen_id | charttime, storetime |
| hosp/microbiologyevents | 2,899 | subject_id, hadm_id | chartdate/time, storedate/time |
| hosp/prescriptions | 18,087 | subject_id, hadm_id, pharmacy_id, poe_id | starttime, stoptime |
| hosp/emar | 35,835 | subject_id, hadm_id, emar_id, poe_id | charttime, scheduletime, storetime |
| icu/icustays | 140 | subject_id, hadm_id, stay_id | intime, outtime (los = float days) |
| icu/chartevents | 668,862 | subject_id, hadm_id, stay_id, caregiver_id | charttime, storetime |
| icu/outputevents | 9,362 | subject_id, hadm_id, stay_id | charttime, storetime |
| icu/inputevents | 20,404 | subject_id, hadm_id, stay_id | starttime, endtime, storetime |

**Dictionary (join-to, don't aggregate) tables:** `d_labitems` (1,622), `d_items` (4,014 — use `linksto` to know which fact table an itemid lives in), `d_icd_diagnoses` (109,775), `d_icd_procedures` (85,257), `d_hcpcs` (89,200), plus ID dims `provider`, `caregiver`.

### What the data actually looks like (real sample rows)

*Real rows copied straight from the CSVs (long text truncated), so a newcomer can see the shape of each table. Note the empty cells — that missingness is exactly what the quality checker reasons about.*

**`hosp/patients.csv`** — one row per patient. `anchor_age` is age at `anchor_year`; `dod` = date of death (blank = alive / no recorded death).
| subject_id | gender | anchor_age | anchor_year | anchor_year_group | dod |
|---|---|---|---|---|---|
| 10014729 | F | 21 | 2125 | 2011 - 2013 | |
| 10003400 | F | 72 | 2134 | 2011 - 2013 | 2137-09-02 |
| 10002428 | F | 80 | 2155 | 2011 - 2013 | |

**`hosp/admissions.csv`** — one row per hospital admission. `hospital_expire_flag=1` means the patient died during that admission.
| subject_id | hadm_id | admittime | dischtime | admission_type | hospital_expire_flag |
|---|---|---|---|---|---|
| 10004235 | 24181354 | 2196-02-24 14:38:00 | 2196-03-04 14:02:00 | URGENT | 0 |
| 10009628 | 25926192 | 2153-09-17 17:08:00 | 2153-09-25 13:20:00 | URGENT | 0 |
| 10018081 | 23983182 | 2134-08-18 02:02:00 | 2134-08-23 19:35:00 | URGENT | 0 |

**`icu/icustays.csv`** — one row per ICU stay. `los` = length of stay in days (a float).
| subject_id | hadm_id | stay_id | first_careunit | intime | outtime | los |
|---|---|---|---|---|---|---|
| 10018328 | 23786647 | 31269608 | Neuro Stepdown | 2154-04-24 23:03:44 | 2154-05-02 15:55:21 | 7.70 |
| 10020187 | 24104168 | 37509585 | Neuro Surgical Inten… | 2169-01-15 04:56:00 | 2169-01-20 15:47:50 | 5.45 |
| 10020187 | 26842957 | 32554129 | Neuro Intermediate | 2170-02-24 18:18:46 | 2170-02-25 15:15:26 | 0.87 |

**`hosp/labevents.csv`** — one row per lab result. Note the built-in `ref_range_lower/upper` and `flag` (a real, human-recorded abnormal marker we use to tell *finding* from *error*).
| labevent_id | subject_id | hadm_id | itemid | charttime | value | valuenum | valueuom | ref_lo | ref_hi | flag |
|---|---|---|---|---|---|---|---|---|---|---|
| 172061 | 10014354 | 29600294 | 51277 | 2148-08-16 00:00:00 | 15.4 | 15.4 | % | 10.5 | 15.5 | |
| 172062 | 10014354 | 29600294 | 51279 | 2148-08-16 00:00:00 | 3.35 | 3.35 | m/uL | 4.6 | 6.1 | abnormal |
| 172068 | 10014354 | 29600294 | 52172 | 2148-08-16 00:00:00 | 49.7 | 49.7 | fL | 35.1 | 46.3 | abnormal |

**`icu/chartevents.csv`** — one row per bedside measurement. Notice the first & third rows have a *text* `value` ("On", "Atrial demand") and an **empty `valuenum`** — because those `itemid`s are not numeric. **This is why we gate numeric rules on `param_type` (§ correctness gate) — a blank `valuenum` here is normal, not a defect.**
| subject_id | stay_id | charttime | itemid | value | valuenum | valueuom | warning |
|---|---|---|---|---|---|---|---|
| 10005817 | 32604416 | 2132-12-16 00:00:00 | 225054 | On | | | 0 |
| 10005817 | 32604416 | 2132-12-16 00:00:00 | 223769 | 100 | 100 | % | 0 |
| 10005817 | 32604416 | 2132-12-16 00:00:00 | 223956 | Atrial demand | | | 0 |

**`icu/d_items.csv`** (dictionary) — decodes ICU `itemid`s. `linksto` says which fact table the item lives in; `param_type` says whether values are Numeric/Text/etc.
| itemid | label | abbreviation | linksto | category | param_type |
|---|---|---|---|---|---|
| 226228 | Gender | Gender | chartevents | ADT | Text |
| 226545 | Race | Race | chartevents | ADT | Text |
| 229877 | Suction events (CH) | Suction events (CH) | chartevents | ECMO | Text |

**`hosp/diagnoses_icd.csv`** — coded diagnoses per admission; join to `d_icd_diagnoses` on (`icd_code`,`icd_version`) for the English title. Both ICD-9 and ICD-10 appear (`icd_version`).
| subject_id | hadm_id | seq_num | icd_code | icd_version |
|---|---|---|---|---|
| 10035185 | 22580999 | 1 | 41401 | 9 |
| 10035185 | 22580999 | 3 | 4139 | 9 |
| 10035185 | 22580999 | 10 | V707 | 9 |

**`hosp/emar.csv`** — the electronic Medication Administration Record. `event_txt` distinguishes *given* vs *ordered* (e.g. "Administered" / "Not Given") — a real nuance our cohort builder can expose.
| subject_id | hadm_id | charttime | medication | event_txt |
|---|---|---|---|---|
| 10005909 | 20199380 | 2144-10-31 05:56:00 | Magnesium Sulfate | |
| 10005909 | 20199380 | 2144-10-31 08:00:00 | Magnesium Sulfate | |
| 10008287 | 22168393 | 2145-09-28 20:15:00 | Potassium Chloride Rep… | |

### Linking structure
```
patients (subject_id, 100)
  └─ admissions (hadm_id, 275)
       ├─ transfers / services / diagnoses_icd / procedures_icd / drgcodes / hcpcsevents
       ├─ labevents / microbiologyevents            [charttime]
       ├─ poe→poe_detail ; pharmacy ; prescriptions ; emar→emar_detail   [meds/orders]
       └─ icustays (stay_id, 140)
            └─ chartevents, datetimeevents, inputevents, ingredientevents,
               outputevents, procedureevents          [keyed by stay_id]
```
Linkage verified clean: `icustays.subject_id ⊆ admissions.subject_id ⊆ patients.subject_id`.

### Correctness gate (critical for "real finding vs. data error")
`d_items.param_type` = Text 1,877 / Numeric 782 / Checkbox 356 / Solution 474. **Only ~782 of 4,014 ICU items are numeric.** Therefore **null `valuenum` on a text/checkbox item is NOT a defect** — every plausibility/missingness rule must gate on `d_items.param_type` (or `d_labitems`). This distinction is the heart of Track 2's strict rule.

---

## B. Data-quality opportunity catalogue (fires on REAL demo rows)

### B1. Cohort-building targets (fast + rich)
- `patients.anchor_age >= 65` → **44 patients**; gender F=43 / M=57.
- In-hospital deaths `admissions.hospital_expire_flag = 1` → **15**.
- ICU `icustays.los` range 0.024–20.53 days (none missing).
- Diagnoses via `diagnoses_icd` + `d_icd_diagnoses.long_title` LIKE (ICD-9 = 2,193 rows, ICD-10 = 2,313 — dual-version join subtlety to showcase).
- Medications: `prescriptions` (631 distinct drugs; top: Insulin, 0.9% NaCl, KCl, Furosemide) and `emar.event_txt` (Administered 23,105 / Not Given 2,486 / Flushed 2,848) → **administered-vs-ordered** nuance.
- Labs: `labevents` with built-in `ref_range_lower/upper` and `flag='abnormal'` (40,275 abnormal rows).

### B2. Implausible physiological values (clickable rows)
| itemid | label | plausible range | observed min..max | note |
|---|---|---|---|---|
| 220045 | Heart Rate | 20–220 bpm | 0..200 | 0 = floor/implausible |
| 220277 | SpO2 | 50–100 % | **29**..100 | 29% hard-implausible |
| 220052 | Arterial BP mean | 40–150 mmHg | **−23..801** | negative & 801 impossible — **best demo** |
| 223762 | Temperature Celsius | 32–42 °C | 31.1..**99.0** | 99 °C = °F mislabeled as °C |
| 223872 | Inspired Gas Temp | ~20–40 °C | 3.0..**3715.0** | grossly implausible |

### B3. Unit inconsistency (same measurement, mixed units)
- **labevents MCHC (itemid 51249): g/dL ×1,555 vs % ×1,205** — same column, two units. Prime demo.
- Temperature split across **itemids 223761 (°F) / 223762 (°C)** — cross-item unit inconsistency to normalize.
- Other mixed-unit labs: Bilirubin 51464, D-Dimer 50915, Protein/Creatinine 51099.

### B4. Missingness (measured)
- `labevents.hadm_id` null = **28,420 / 107,727 (26.4%)** (outpatient labs — a *caveat*, matched by docs' "98% carry hadm_id" note); `valueuom` null 13.0%; `ref_range_*` null 17.4%; `valuenum` null 11.6% (text labs).
- `admissions.deathtime` null = 260 (only 15 in-hospital deaths → **consistency pair** with `hospital_expire_flag`).

### B5. Temporal ordering
- `admittime < dischtime`: **275/275 valid (0 violations)** — clean "passing" baseline / injection target.
- ICU `intime < outtime`: **140/140 valid**.
- **`labevents.charttime` outside [admittime, dischtime]: 2,168 of 79,307 checkable rows** — a real, findable temporal-consistency finding.
- Other orderable pairs to check: `edregtime < edouttime < admittime`; `storetime >= charttime` (but see doc caveat: storetime can precede charttime); `prescriptions.starttime < stoptime`.

### B6. Duplicates
- `diagnoses_icd` PK (subject_id, hadm_id, seq_num): **0 dup keys**. `chartevents` exact dup: **0**. → Duplicate detection is best demonstrated via the **error-injection harness** (inject synthetic dupes into a copy) plus a "near-duplicate" scan (same itemid+charttime, conflicting valuenum).

---

## C. Documented bugs & official caveats (citations)

> We cite these as **provenance for our rules** and for the limitations narrative. Per our **demo-verifiable-only** decision, we do **not** claim to have "re-discovered" a bug we can't point at in the 100 patients.

### C1. Official doc caveats (in `mimic-iv-docs/`)
- **Date shifting** — dates shifted into the future, internally consistent per patient, not comparable across patients. `about/concepts.md`.
- **Age capping** — `anchor_age` > 89 set to **91**. `modules/hosp/patients.md`.
- **charttime vs storetime** — charttime rounded to the hour; storetime can precede charttime. `about/concepts.md`.
- **labevents `hadm_id` ~98% present** (recover rest via time join). `modules/hosp/labevents.md`. *(Demo shows 73.6% present — the outpatient portion.)*
- **microbiologyevents `hadm_id` ~96%.** `modules/hosp/microbiologyevents.md`.
- **Results in `comments`** — some labs/micro store the result in the free-text `comments`; `___` = deidentified, NULL = no comment. `modules/hosp/labevents.md`, `modules/hosp/microbiologyevents.md`.
- **"Recorded for clinical care, not research"** — implausible values expected; docs recommend range checks. `about/schema-overview.md`.

### C2. Reusable plausibility ranges (MIT-authored, in `mimic-code-main/`)
- `mimic-iv/concepts/measurement/vitalsign.sql` — HR `0<v<300`, SBP `0<v<400`, DBP/MBP `0<v<300`, RR `0<v<70`, SpO2 `0<v<=100`, Temp°C `10<v<50`, Temp°F converted within `70<v<120`.
- `chemistry.sql` — albumin ≤10, creatinine ≤150, sodium ≤200, etc.
- `bg.sql` — FiO2 fraction↔percent normalization.
- `demographics/weight_durations.sql` — weight `0<v<1500`.
> We **reuse these exact bounds** so our rules are citeable and non-arbitrary.

### C3. Test-pattern analog
- `mimic-iv/tests/test_measurement.py` + `tests/README.md`: *"most patients in the ICU should have a heart rate measurement"* — the **completeness-check** pattern we emulate for coverage scoring.

### C4. Documented-bug gallery (cite in evaluation/limitations, not "found in demo")
GitHub issues on MIT-LCP/mimic-code: **#941** (lab results trapped in comments; canonical itemid **51652** HIV-1 Viral Load — rare, likely absent in 100 patients), #766 (eGFR as text), #938 (bad loinc_code), #1247 (missing edreg/edout), #67 (ICU stay mis-assignment), #84 (hadm_id mismatch), #71 (dod in-hospital only), duplicate DRG removed in v1.0.
- MIMIC-IV Nature *Scientific Data* (Johnson et al. 2023): https://www.nature.com/articles/s41597-022-01899-x
- Change log: https://mimic.mit.edu/docs/iv/about/changelog.html

---

## D. Model & method decisions (OpenAI-only) — with sources

### D1. Architecture: NL → validated JSON cohort-IR → compiler → DuckDB SQL
The LLM **never** writes executable SQL. It emits a constrained **intermediate representation (IR)** JSON; our code validates it against the real schema and **compiles** it to parameterized DuckDB SQL. The IR *is* the inclusion/exclusion logic we render in the UI ("show the query"). We store **IR + compiled SQL + data-hash** so results reproduce exactly even if the model drifts.
- Rationale (2025–26 text-to-SQL literature converging on IR + execution-aware validation): survey arXiv:2208.10099; ACL 2025 (aclanthology.org/2025.acl-long.748); DecoSearch arXiv:2606.17821; EzSQL arXiv:2411.18923.

### D2. OpenAI Structured Outputs (`strict:true`)
- Set `response_format` to `json_schema` with `strict:true`; output is guaranteed to conform. Requirements: `additionalProperties:false` on every object, every property in `required` (emulate optional via nullable unions), root must be an object. Safety refusals surface in a dedicated `refusal` field.
- **Highest-leverage trick:** put **allowed table/column names as JSON-Schema `enum`s** → the model literally cannot emit a non-existent column.
- Add required **`answerable` / `abstain_reason` / `confidence`** fields → explicit abstention instead of a fabricated query.
- Docs: https://developers.openai.com/api/docs/guides/structured-outputs

### D3. Model tiers (confirm snapshot IDs/prices on OpenAI's own page at build time)
| Role | Model | Input/Output per 1M | Use |
|---|---|---|---|
| Primary | GPT-5.6 **Terra** | $2 / $12 | NL→IR (nested, conditional schema) |
| Fallback | GPT-5.6 **Luna** | $0.20 / $1.20 | short flag explanations, easy queries |
| Escalation | GPT-5.6 **Sol** | $5 / $30 | only after repeated IR-validation failure |
> Tier names came from 2026 pricing aggregators (aipricing.guru, cloudzero, morphllm) — **verify against OpenAI's official pricing/models page before locking in.** Model IDs live in `config` + `.env`.

### D4. Reproducibility, privacy, cost
- `temperature:0` + fixed `seed` + pinned snapshot; log `system_fingerprint`. Seed is **best-effort** — the real guarantee is the stored IR + deterministic compiler.
- **Minimize external data (licence requirement, not zero-rows dogma).** Default payload = NL + schema/DDL + few-shot IR examples + **aggregate DQ summaries** (counts/ranges); send minimal patient-level rows only when a task genuinely needs them, and disclose it. This satisfies the brief's "minimize data sent to external services" without over-constraining what the tool can do. Constant schema prefix → automatic prompt caching (~10% of input rate).
- Optional PII guardrail (OpenAI Guardrails, MIT-licensed) as a leakage backstop.

### D5. Engine: DuckDB + pandas
DuckDB is embedded, columnar, SQL-native, and deterministic — the natural compile target for the IR, and the query is showable to researchers. Ingest CSVs → a local DuckDB/Parquet store once, then query. pandas for last-mile shaping.
- Sources: codecut.ai (pandas vs polars vs duckdb), digitalocean DuckDB+pandas.

### D6. Cost-effective config — caching, reasoning effort, Batch (confirmed pricing)
User-confirmed GPT-5.6 pricing per 1M tokens: **sol** $5 in / $0.50 cached / $6.25 cache-write / $30 out · **terra** $2 / $0.20 / $2.50 / $12 · **luna** $0.20 / $0.02 / $0.25 / $1.20.

**Prompt caching (automatic/implicit).** Cache-eligible at **≥1,024 tokens**; matched on a **hash of the leading prefix**; **30-min TTL** for GPT-5.6. New this generation: the **first** caching of a prefix bills those tokens as a **cache-write at 1.25× input** (the $6.25/$2.50/$0.25 line); every later call in the window reads at the cheap cached rate. → **Order every prompt [system + schema/DDL + few-shots]** (byte-identical, constant) **then [aggregate summaries + NL text]** (variable, last). Route with a stable `prompt_cache_key` (e.g. `cohortfit:nl2ir:v1`). Verify via `usage.prompt_tokens_details.cached_tokens` / `cache_write_tokens`.

**Reasoning effort.** GPT-5.6 exposes `reasoning.effort` (none/minimal/low/medium/high/xhigh/max) and a separate `text.verbosity`. Reasoning tokens bill at the **output** rate and count against `max_output_tokens`. **Gotcha:** effort too low on a rich schema yields *schema-valid-but-semantically-wrong* IR — so use **`low`** for NL→IR, not `none`.

**Recommended per-task config** (steady-state cache hit; verify effort floors on our injected-error eval set before locking):

| Task | Model | reasoning effort | temp | max out tok | Est. $/call |
|---|---|---|---|---|---|
| NL → strict-JSON IR (online) | `gpt-5.6-terra` | `low` | 0 | ~700–1000 | ~$0.006–0.010 |
| Flag-explanation blurb (online) | `gpt-5.6-luna` | `minimal` + `verbosity:low` | 0.3 | ~150–200 | ~$0.0003 |
| Eval harness (offline, bulk) | `gpt-5.6-luna` via **Batch API** (50% off, ≤24h) | `minimal` | 0.3 | ~150–200 | ~$0.00015 |
| Hard NL→IR fallback (rare) | `gpt-5.6-sol` | `medium` | 0 | ~1000 | ~$0.03–0.05 |

**Structured outputs discipline:** strict `json_schema` (`strict:true`, `additionalProperties:false`, all props `required`); handle the `refusal` branch and `incomplete` (truncated-JSON) status; size `max_output_tokens` to cover reasoning + the largest real IR.
**Verify before locking:** exact callable model IDs (`gpt-5.6-terra` vs bare `gpt-5.6`+tier), the 1.25× cache-write multiplier, the 30-min-only TTL (add a keep-warm ping if idle gaps > 30m), and the effort floors.
- Sources: OpenAI docs — prompt-caching, reasoning, structured-outputs, deployment-checklist, batch; Simon Willison GPT-5.6 (2026-07-09). Full write-up available from the R&D research pass.

---

## E. What this means for the build (summary)
1. **Error-injection + scoring harness first** — inject known errors into a *copy*, measure precision/recall/FPR (the "free shortcut" for labels). Clean baselines (admittime<dischtime, ICU times) are ideal injection targets.
2. **Rule library** reusing MIT bounds, gated on `param_type` (real-vs-error discipline).
3. **Cohort IR layer** (OpenAI strict schema + enum columns + abstain fields) → DuckDB compiler.
4. **Scorecard UI** (red/amber/green) + clickable flag rows + IR/SQL viewer + reversible-fix ledger + safety banner.
5. **Docs** — this file feeds the Evaluation Report and Technical Summary.
