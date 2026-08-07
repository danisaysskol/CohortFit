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

    db.con.execute("CREATE OR REPLACE TEMP TABLE adm_eval AS SELECT * FROM admissions")
    id_list = ", ".join("'" + v.replace("'", "''") + "'" for v in victims)
    # Swap the two timestamps for the victims so admittime becomes >= dischtime.
    db.con.execute(
        "UPDATE adm_eval SET admittime = dischtime, dischtime = admittime "
        f"WHERE CAST(hadm_id AS VARCHAR) IN ({id_list})"
    )

    flagged = {
        r["hadm_id"]
        for r in db.query(
            "SELECT CAST(hadm_id AS VARCHAR) AS hadm_id FROM adm_eval WHERE admittime >= dischtime"
        )
    }
    db.con.execute("DROP TABLE IF EXISTS adm_eval")

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
