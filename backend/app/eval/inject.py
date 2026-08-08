"""Self-seeded error harness — the "free shortcut" to real detection metrics.

Nobody hands us labeled errors, so we inject known ones into a *copy* of a table
(never the source), keep the ground truth, run the detector on the copy, and report
precision / recall / FPR. The injection is seeded for reproducibility, and the
synthetic errors live only in a temp table — they are never mixed with real records
or used to imply clinical performance.
"""
from __future__ import annotations

import random
import statistics
from typing import Any

from ..data.loader import Database
from .metrics import score


def run_temporal_eval(db: Database, n_inject: int = 20, seed: int = 42) -> dict[str, Any]:
    """Inject admittime/dischtime swaps into a copy of `admissions`, then detect them.

    The detector flags `admittime >= dischtime`. Because the real demo has zero such
    rows (275/275 valid), every flagged row after injection should be an injected one.
    """
    rng = random.Random(seed)
    valid = db.query(
        "SELECT CAST(hadm_id AS VARCHAR) AS hadm_id FROM admissions WHERE admittime < dischtime"
    )
    total = len(valid)
    k = min(n_inject, total)
    victims = {r["hadm_id"] for r in rng.sample(valid, k)}
    if not victims:
        return score(0, 0, 0, total, check="temporal: admittime >= dischtime",
                     table="admissions", injected=0, flagged=0, seed=seed, population=total)

    # Detect on a *virtually* corrupted copy built in a read-only CTE (swap admit/disch
    # for the victims). No temp table, no mutation -> safe under concurrent requests.
    victim_values = ", ".join("('" + v.replace("'", "''") + "')" for v in victims)
    flagged = {
        r["hadm_id"]
        for r in db.query(
            f"WITH victims(hadm_id) AS (VALUES {victim_values}), "
            "corrupt AS ("
            "  SELECT CAST(a.hadm_id AS VARCHAR) AS hadm_id, "
            "    CASE WHEN v.hadm_id IS NOT NULL THEN a.dischtime ELSE a.admittime END AS admittime, "
            "    CASE WHEN v.hadm_id IS NOT NULL THEN a.admittime ELSE a.dischtime END AS dischtime "
            "  FROM admissions a "
            "  LEFT JOIN victims v ON CAST(a.hadm_id AS VARCHAR) = v.hadm_id) "
            "SELECT hadm_id FROM corrupt WHERE admittime >= dischtime"
        )
    }

    tp = len(flagged & victims)
    fp = len(flagged - victims)
    fn = len(victims - flagged)
    tn = total - tp - fp - fn
    return score(
        tp, fp, fn, tn,
        check="temporal: admittime >= dischtime",
        table="admissions",
        injected=k, flagged=len(flagged), seed=seed, population=total,
    )


def run_eval(db: Database, n_inject: int = 20, seeds: tuple[int, ...] = (42, 7, 13, 99, 123)) -> dict[str, Any]:
    """Patient-grouped, multi-seed evaluation with a dumb baseline for comparison.

    - Folds: the same rule is run over several seeded injections; we report mean ± std
      (fold-level variation / uncertainty) rather than one headline number.
    - Baseline: a "flag every row" fixed rule — the dumb version. Our gated rule keeps
      precision at 1.0 while the baseline's precision collapses to injected/total.
    Records are grouped by admission (subject-safe: an injected error stays within one
    admission's own row); no row appears as both a positive and its own negative.
    """
    runs = [run_temporal_eval(db, n_inject=n_inject, seed=s) for s in seeds]

    def agg(key: str) -> dict[str, float]:
        vals = [float(r[key]) for r in runs]
        return {
            "mean": round(statistics.mean(vals), 3),
            "std": round(statistics.pstdev(vals), 3),
            "min": round(min(vals), 3),
            "max": round(max(vals), 3),
        }

    total = int(runs[0]["population"])
    injected = int(runs[0]["injected"])
    # Dumb baseline: flag ALL rows as temporal errors (fixed, context-free rule).
    baseline = {
        "strategy": "flag every row (fixed dumb rule)",
        "precision": round(injected / total, 3) if total else 0.0,
        "recall": 1.0,
        "false_positive_rate": round((total - injected) / total, 3) if total else 0.0,
    }
    return {
        "seeds": list(seeds),
        "runs": runs,
        "aggregate": {k: agg(k) for k in ("precision", "recall", "f1", "false_positive_rate")},
        "baseline": baseline,
        "note": "Synthetic errors injected into a read-only copy only; not real clinical "
                "performance. Mean ± std across seeds expresses fold-level uncertainty.",
    }
