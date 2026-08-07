"""Self-seeded error harness — the "free shortcut" to real detection metrics.

Nobody hands us labeled errors, so we inject known ones into a *copy* of a table
(never the source), keep the ground truth, run the detector on the copy, and report
precision / recall / FPR. The injection is seeded for reproducibility, and the
synthetic errors live only in a temp table — they are never mixed with real records
or used to imply clinical performance.
"""
from __future__ import annotations

import random
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
