# CohortFit — 3-minute pitch script

> Speaker notes for `CohortFit_pitch_deck.pptx` (also embedded in each slide's Notes pane). Total ~3:00. Timings are guides — trim slides 5/6 first if you run long.

## Slide 1 — Title

[~15s] This is CohortFit, our Track 2 entry. In one line: it turns a plain-English cohort description into a transparent, reproducible query, then tells you whether that cohort's data are actually fit to trust. Our pitch is honesty as a feature.

## Slide 2 — The problem

[~25s] Hospital data are rich but hard to use — one admission spans dozens of linked tables. Before you can trust an analysis you face two hurdles at once: define the cohort correctly across many joins, and judge whether the data support it. Is a blood pressure of 801 a real extreme or a data error? Get that wrong and every downstream result is poisoned.

## Slide 3 — What it does

[~25s] CohortFit puts all of that in one workspace. Describe the cohort in plain English, then work with it through four lenses on the same patients: the matched patients and their event timelines, the query behind them, a data-fitness scorecard, and the cohort's measurements — coverage, units, coding. Edit and rebuild any time without leaving.

## Slide 4 — How it works — AI where it's necessary

[~30s] The AI is used only where it's necessary. Your words become a validated JSON query with strict structured outputs, and a deterministic DuckDB compiler validates every field against the schema before running it — so the model never writes executable SQL, and a hallucinated column becomes a clarification, not a bad query. Every claim traces back to a source row, and when the data can't support an answer it abstains. The provenance funnel shows 100 patients down to the 9 that match — every step visible.

## Slide 5 — Data quality you can trust

[~30s] Data quality is the heart of it: a five-dimension scorecard, and every flag drills to the real offending rows. These are genuine bugs in the demo — an arterial BP of 801 mmHg, MCHC recorded in two units in one column, 2,168 labs charted outside their admission window. Each is classified — data error versus a verified clinical finding — and any fix is reversible and rule-backed. We never edit the source.

## Slide 6 — Evaluation & evidence

[~30s] And we measure it honestly. Cohort correctness is an exact set match against a hand-verified gold query. On the temporal check, precision and recall are 1.00 across five seeds — but we're explicit that this is one dimension, the easy one; the other four are evidenced by real clickable findings, not injection. Against a naive flag-everything baseline we hold about 14x the precision at the same recall. And every cohort exports as a re-runnable recipe.

## Slide 7 — Safety, honesty & an honest failure

[~25s] Safety is built in — research-only banner on every screen, provenance and uncertainty on every output, AI content marked, and we minimize what's sent to the model. Most importantly it's failure-tested: it knows when to say no. Ask for patients admitted in winter and it abstains, because the dates are shifted and seasonality is unknowable. Contradictions it clarifies; predictions it refuses.

## Slide 8 — Limitations, next steps & close

[~20s] We're honest about the limits — 100 patients is illustrative, not clinical evidence — and about what's next: harder-dimension evaluation, leakage guards, a larger dataset. But it runs today with one command. The differentiator is simple: CohortFit tells you when the data can't support the answer. Honesty is the feature. Thank you.

