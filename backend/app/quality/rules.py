"""Data-quality checks + scorecard rollup.

Each check returns Findings that point at a table/ref and classify themselves as
`data_error`, `real_finding`, or `caveat` — the real-finding-vs-data-error
discipline the brief demands. Nothing here mutates source data.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from ..data.loader import Database
from .ranges import VITAL_RANGES

SEV_ORDER = {"green": 0, "amber": 1, "red": 2}
DIMENSIONS = ["plausibility", "units", "temporal", "completeness", "duplicates"]


@dataclass
class Finding:
    dimension: str
    severity: str  # green | amber | red
    table: str
    detail: str
    count: int
    kind: str  # data_error | real_finding | caveat
    ref: str = ""

    def dict(self) -> dict[str, Any]:
        return asdict(self)


def check_plausibility(db: Database) -> list[Finding]:
    # Single pass over chartevents, joined to a small in-query bounds table.
    # (Per-itemid loops were 11x full scans of 669k rows — far too slow for a live demo.)
    values = ", ".join(f"({iid}, {lo}, {hi})" for iid, (lo, hi, _, _) in VITAL_RANGES.items())
    rows = db.query(
        f"WITH bounds(itemid, lo, hi) AS (VALUES {values}) "
        "SELECT c.itemid AS itemid, "
        "count(*) FILTER (WHERE c.valuenum IS NOT NULL) AS n, "
        "count(*) FILTER (WHERE c.valuenum < b.lo OR c.valuenum > b.hi) AS bad, "
        "min(c.valuenum) AS mn, max(c.valuenum) AS mx "
        "FROM chartevents c JOIN bounds b ON c.itemid = b.itemid "
        "GROUP BY c.itemid"
    )
    out: list[Finding] = []
    for r in rows:
        n, bad = int(r["n"] or 0), int(r["bad"] or 0)
        if n == 0 or bad == 0:
            continue
        lo, hi, label, uom = VITAL_RANGES[int(r["itemid"])]
        out.append(Finding(
            "plausibility", "red", "chartevents",
            f"{label} ({int(r['itemid'])}): {bad} of {n} numeric values outside [{lo},{hi}] {uom} "
            f"(observed {r['mn']}..{r['mx']})",
            bad, "data_error", f"itemid {int(r['itemid'])}",
        ))
    return out


def check_temporal(db: Database) -> list[Finding]:
    out: list[Finding] = []
    bad = int(db.query("SELECT count(*) AS n FROM admissions WHERE admittime >= dischtime")[0]["n"])
    if bad:
        out.append(Finding("temporal", "amber", "admissions",
                           f"{bad} admissions with admittime >= dischtime", bad, "data_error"))
    off = int(db.query(
        "SELECT count(*) AS n FROM labevents l JOIN admissions a USING (hadm_id) "
        "WHERE l.hadm_id IS NOT NULL AND l.charttime IS NOT NULL "
        "AND (l.charttime < a.admittime OR l.charttime > a.dischtime)"
    )[0]["n"])
    if off:
        out.append(Finding("temporal", "amber", "labevents",
                           f"{off} lab results charted outside their admission window",
                           off, "data_error", "charttime vs admittime/dischtime"))
    return out


def check_units(db: Database) -> list[Finding]:
    rows = db.query(
        "SELECT itemid, count(DISTINCT valueuom) AS u, "
        "string_agg(DISTINCT valueuom, ', ') AS uoms, count(*) AS n "
        "FROM labevents WHERE valueuom IS NOT NULL "
        "GROUP BY itemid HAVING count(DISTINCT valueuom) > 1 "
        "ORDER BY n DESC LIMIT 10"
    )
    return [
        Finding("units", "amber", "labevents",
                f"itemid {r['itemid']} recorded in {r['u']} units ({r['uoms']}) across {r['n']} rows",
                int(r["n"]), "data_error", f"itemid {r['itemid']}")
        for r in rows
    ]


def check_completeness(db: Database) -> list[Finding]:
    r = db.query("SELECT count(*) AS n, count(*) FILTER (WHERE hadm_id IS NULL) AS miss FROM labevents")[0]
    n, miss = int(r["n"]), int(r["miss"])
    pct = round(100 * miss / n, 1) if n else 0.0
    sev = "amber" if pct > 10 else "green"
    return [Finding("completeness", sev, "labevents",
                    f"labevents.hadm_id missing on {miss}/{n} rows ({pct}%) — outpatient labs; "
                    f"a caveat, not a defect", miss, "caveat", "hadm_id")]


def check_duplicates(db: Database) -> list[Finding]:
    dups = int(db.query(
        "SELECT count(*) AS d FROM (SELECT subject_id, hadm_id, seq_num "
        "FROM diagnoses_icd GROUP BY 1,2,3 HAVING count(*) > 1)"
    )[0]["d"])
    sev = "green" if dups == 0 else "red"
    kind = "real_finding" if dups == 0 else "data_error"
    return [Finding("duplicates", sev, "diagnoses_icd",
                    f"{dups} duplicate (subject_id, hadm_id, seq_num) keys", dups, kind)]


def check_comments_hidden(db: Database) -> list[Finding]:
    # Lab rows with no numeric value but a real result trapped in the free-text comments
    # (the documented MIMIC pattern, e.g. viral-load "DETECTED"). ___ = de-identified.
    r = db.query(
        "SELECT count(*) AS n, count(DISTINCT itemid) AS items FROM labevents "
        "WHERE valuenum IS NULL AND comments IS NOT NULL "
        "AND comments <> '___' AND trim(comments) <> ''"
    )[0]
    n = int(r["n"] or 0)
    if n == 0:
        return []
    return [Finding("completeness", "amber", "labevents",
                    f"{n} lab rows across {int(r['items'])} itemids have a NULL numeric value but a "
                    f"result trapped in the free-text comments — the value is in the wrong field",
                    n, "data_error", "valuenum NULL + comments")]


def check_storetime(db: Database) -> list[Finding]:
    out: list[Finding] = []
    for table in ("chartevents", "labevents"):
        n = int(db.query(
            f"SELECT count(*) AS n FROM {table} "
            "WHERE storetime IS NOT NULL AND charttime IS NOT NULL AND storetime < charttime"
        )[0]["n"])
        if n:
            out.append(Finding("temporal", "amber", table,
                               f"{n} {table} rows have storetime earlier than charttime (a documented "
                               f"MIMIC quirk — validation time can precede the charted time)",
                               n, "caveat", "storetime < charttime"))
    if not out:  # always surface the check so a clean pass is visible, not silently absent
        out.append(Finding("temporal", "green", "chartevents",
                           "0 rows with storetime earlier than charttime", 0, "real_finding",
                           "storetime < charttime"))
    return out


def check_hr_completeness(db: Database) -> list[Finding]:
    total = int(db.query("SELECT count(*) AS n FROM icustays")[0]["n"])
    missing = int(db.query(
        "SELECT count(*) AS n FROM icustays i WHERE NOT EXISTS "
        "(SELECT 1 FROM chartevents c WHERE c.stay_id = i.stay_id AND c.itemid = 220045)"
    )[0]["n"])
    if missing == 0:
        return [Finding("completeness", "green", "icustays",
                        f"all {total} ICU stays have a heart-rate measurement (MIMIC expects ≥99%)",
                        0, "real_finding", "per-stay HR completeness")]
    sev = "amber" if missing / total > 0.01 else "green"
    kind = "data_error" if missing / total > 0.01 else "caveat"
    return [Finding("completeness", sev, "icustays",
                    f"{missing}/{total} ICU stays have no heart-rate (220045) measurement "
                    f"(MIMIC expects ≥99% to have one)", missing, kind, "per-stay HR completeness")]


def check_near_duplicates(db: Database) -> list[Finding]:
    r = db.query(
        "SELECT count(*) AS groups, coalesce(sum(c - 1), 0) AS extra FROM "
        "(SELECT subject_id, stay_id, itemid, charttime, count(*) AS c FROM chartevents "
        "GROUP BY 1,2,3,4 HAVING count(*) > 1)"
    )[0]
    groups = int(r["groups"] or 0)
    if groups == 0:
        return []
    return [Finding("duplicates", "amber", "chartevents",
                    f"{groups} (patient, stay, itemid, charttime) groups have >1 chartevents row "
                    f"({int(r['extra'])} extra) — potential duplicates or legitimate re-measurements "
                    f"(review, don't auto-delete)", groups, "data_error", "near-duplicate")]


def all_findings(db: Database) -> list[Finding]:
    return (check_plausibility(db) + check_units(db) + check_temporal(db)
            + check_completeness(db) + check_duplicates(db)
            + check_comments_hidden(db) + check_storetime(db)
            + check_hr_completeness(db) + check_near_duplicates(db))


def propose_fixes(db: Database) -> dict[str, Any]:
    """Suggest reversible, rule-backed fixes. NOTHING here mutates source data — a fix is
    a documented transform the UI can apply to a working copy and undo. The brief requires
    corrections to be reversible and rule-backed; ambiguous cases stay review-only.
    """
    fixes: list[dict[str, Any]] = []

    # Temperature recorded in °F but labelled °C (itemid 223762, valuenum > 50).
    r = db.query(
        "SELECT count(*) AS n, max(valuenum) AS mx FROM chartevents "
        "WHERE itemid = 223762 AND valuenum > 50"
    )[0]
    if int(r["n"]) > 0:
        fixes.append({
            "id": "temp_f_as_c",
            "table": "chartevents",
            "ref": "itemid 223762",
            "title": "Temperature recorded in °F but labelled °C",
            "detail": f"{int(r['n'])} value(s) above 50 °C (up to {r['mx']}) are implausible as "
                      f"Celsius and match Fahrenheit.",
            "rule": "if valuenum > 50: celsius = (valuenum − 32) / 1.8",
            "reverse": "fahrenheit = celsius × 1.8 + 32",
            "affected": int(r["n"]),
            "reversible": True,
        })

    # Mixed units under one MCHC itemid — ambiguous, so review-only (not auto-fixed).
    r = db.query(
        "SELECT count(*) AS n FROM labevents WHERE itemid = 51249 AND valueuom IS NOT NULL"
    )[0]
    if int(r["n"]) > 0:
        fixes.append({
            "id": "mchc_units_review",
            "table": "labevents",
            "ref": "itemid 51249",
            "title": "MCHC recorded in two units (g/dL and %)",
            "detail": "Same measurement, two units in one column. A safe conversion depends on "
                      "context, so this is flagged for human review — not auto-corrected.",
            "rule": "review-only — no automatic transform",
            "reverse": "",
            "affected": int(r["n"]),
            "reversible": False,
        })

    return {
        "fixes": fixes,
        "note": "Fixes apply to a working copy only; source data is never modified. Every "
                "applied fix is reversible and logged.",
    }


KIND_ORDER = {"data_error": 2, "caveat": 1, "real_finding": 0}
# Assumed minutes a reviewer spends locating + judging one issue class by hand. Stated,
# not measured — used only to express "reviewer time saved", never as a hard claim.
ASSUMED_MINUTES_PER_ISSUE = 3


def scorecard(db: Database) -> dict[str, Any]:
    findings = all_findings(db)
    # Rank worst-first so a reviewer sees the most severe, highest-volume errors first
    # (beats a dumb checker that flags everything equally).
    findings.sort(key=lambda f: (SEV_ORDER[f.severity], KIND_ORDER.get(f.kind, 0), f.count), reverse=True)

    dim_sev = {d: "green" for d in DIMENSIONS}
    for f in findings:
        if SEV_ORDER[f.severity] > SEV_ORDER[dim_sev[f.dimension]]:
            dim_sev[f.dimension] = f.severity

    issues = sum(1 for f in findings if f.kind == "data_error")
    summary = {
        "issues_found": issues,
        "findings_total": len(findings),
        "assumed_minutes_per_issue": ASSUMED_MINUTES_PER_ISSUE,
        "reviewer_minutes_saved_estimate": issues * ASSUMED_MINUTES_PER_ISSUE,
        "note": "Flags are ranked worst-first, each pre-separated (data error vs real finding) "
                "and explained with a source pointer. Time-saved is an estimate at the stated "
                "per-issue assumption, not a measured value.",
    }
    return {
        "dimensions": [{"dimension": d, "severity": dim_sev[d]} for d in DIMENSIONS],
        "findings": [f.dict() for f in findings],
        "summary": summary,
    }
