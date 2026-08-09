"""Data-quality checks + scorecard rollup.

Each check returns Findings that point at a table/ref and classify themselves as
`data_error`, `real_finding`, or `caveat` — the real-finding-vs-data-error
discipline the brief demands. Nothing here mutates source data.

Every check optionally accepts a cohort's `subject_ids`: passing them restricts the
same rule to that cohort (so a judge sees the fitness of *their* cohort, not just the
whole demo). Omitting them assesses the entire dataset, exactly as before.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from ..data.loader import Database
from .ranges import VITAL_RANGES

SEV_ORDER = {"green": 0, "amber": 1, "red": 2}
DIMENSIONS = ["plausibility", "units", "temporal", "completeness", "duplicates"]

# Only ~782 of 4,014 ICU items are numeric. We gate the plausibility check on
# d_items.param_type so a null/absent number on a text or checkbox item is never
# mistaken for an out-of-range value (the Track-2 strict rule).
NUMERIC_PARAM_TYPES = ("Numeric", "Numeric with tag")


def _scope(subject_ids: list[int] | None, col: str = "subject_id") -> str:
    """Return an AND-clause restricting to a cohort's patients, or '' for the whole dataset.

    Ids come from our own compiler (validated ints), so inlining them is safe here.
    """
    if not subject_ids:
        return ""
    return f" AND {col} IN ({','.join(str(int(s)) for s in subject_ids)})"


@dataclass
class Finding:
    dimension: str
    severity: str  # green | amber | red
    table: str
    detail: str
    count: int
    kind: str  # data_error | real_finding | caveat
    ref: str = ""
    id: str = ""          # stable slug for drill-in
    sample_sql: str = ""  # SELECT that returns the actual offending rows (empty = nothing to show)

    def dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["drillable"] = bool(self.sample_sql)  # tell the UI whether a drill-in exists
        d.pop("sample_sql")                     # keep the raw SQL out of the list payload
        return d


def check_plausibility(db: Database, subject_ids: list[int] | None = None) -> list[Finding]:
    # Single pass over chartevents, joined to a small in-query bounds table.
    # (Per-itemid loops were 11x full scans of 669k rows — far too slow for a live demo.)
    # The join to d_items with a param_type filter enforces the numeric-only gate:
    # a text/checkbox item can never enter the plausibility count, even if it were in bounds.
    values = ", ".join(f"({iid}, {lo}, {hi})" for iid, (lo, hi, _, _) in VITAL_RANGES.items())
    param_types = ", ".join(f"'{p}'" for p in NUMERIC_PARAM_TYPES)
    scope = _scope(subject_ids, "c.subject_id")
    where = f"WHERE 1=1{scope} " if scope else ""
    rows = db.query(
        f"WITH bounds(itemid, lo, hi) AS (VALUES {values}) "
        "SELECT c.itemid AS itemid, "
        "count(*) FILTER (WHERE c.valuenum IS NOT NULL) AS n, "
        "count(*) FILTER (WHERE c.valuenum < b.lo OR c.valuenum > b.hi) AS bad, "
        "min(c.valuenum) AS mn, max(c.valuenum) AS mx "
        "FROM chartevents c JOIN bounds b ON c.itemid = b.itemid "
        f"JOIN d_items di ON c.itemid = di.itemid AND di.param_type IN ({param_types}) {where}"
        "GROUP BY c.itemid"
    )
    out: list[Finding] = []
    for r in rows:
        n, bad = int(r["n"] or 0), int(r["bad"] or 0)
        if n == 0 or bad == 0:
            continue
        iid = int(r["itemid"])
        lo, hi, label, uom = VITAL_RANGES[iid]
        out.append(Finding(
            "plausibility", "red", "chartevents",
            f"{label} ({iid}): {bad} of {n} numeric values outside [{lo},{hi}] {uom} "
            f"(observed {r['mn']}..{r['mx']})",
            bad, "data_error", f"itemid {iid}", f"plausibility:{iid}",
            "SELECT subject_id, stay_id, charttime, valuenum, valueuom "
            f"FROM chartevents WHERE itemid = {iid} AND valuenum IS NOT NULL "
            f"AND (valuenum < {lo} OR valuenum > {hi}){_scope(subject_ids)} ORDER BY abs(valuenum) DESC",
        ))
    return out


def check_temporal(db: Database, subject_ids: list[int] | None = None) -> list[Finding]:
    out: list[Finding] = []
    bad = int(db.query(
        f"SELECT count(*) AS n FROM admissions WHERE admittime >= dischtime{_scope(subject_ids)}"
    )[0]["n"])
    if bad:
        out.append(Finding("temporal", "amber", "admissions",
                           f"{bad} admissions with admittime >= dischtime", bad, "data_error",
                           "admittime vs dischtime", "temporal:admit-order",
                           "SELECT subject_id, hadm_id, admittime, dischtime, admission_type "
                           f"FROM admissions WHERE admittime >= dischtime{_scope(subject_ids)} ORDER BY subject_id"))
    off = int(db.query(
        "SELECT count(*) AS n FROM labevents l JOIN admissions a USING (hadm_id) "
        "WHERE l.hadm_id IS NOT NULL AND l.charttime IS NOT NULL "
        f"AND (l.charttime < a.admittime OR l.charttime > a.dischtime){_scope(subject_ids, 'l.subject_id')}"
    )[0]["n"])
    if off:
        out.append(Finding("temporal", "amber", "labevents",
                           f"{off} lab results charted outside their admission window",
                           off, "data_error", "charttime vs admittime/dischtime",
                           "temporal:lab-window",
                           "SELECT l.subject_id, l.hadm_id, l.itemid, l.charttime, "
                           "a.admittime, a.dischtime FROM labevents l JOIN admissions a USING (hadm_id) "
                           "WHERE l.hadm_id IS NOT NULL AND l.charttime IS NOT NULL "
                           f"AND (l.charttime < a.admittime OR l.charttime > a.dischtime){_scope(subject_ids, 'l.subject_id')} "
                           "ORDER BY l.subject_id"))
    return out


def check_units(db: Database, subject_ids: list[int] | None = None) -> list[Finding]:
    rows = db.query(
        "SELECT itemid, count(DISTINCT valueuom) AS u, "
        "string_agg(DISTINCT valueuom, ', ') AS uoms, count(*) AS n "
        f"FROM labevents WHERE valueuom IS NOT NULL{_scope(subject_ids)} "
        "GROUP BY itemid HAVING count(DISTINCT valueuom) > 1 "
        "ORDER BY n DESC LIMIT 10"
    )
    return [
        Finding("units", "amber", "labevents",
                f"itemid {r['itemid']} recorded in {r['u']} units ({r['uoms']}) across {r['n']} rows",
                int(r["n"]), "data_error", f"itemid {r['itemid']}", f"units:{int(r['itemid'])}",
                "SELECT subject_id, hadm_id, charttime, valuenum, valueuom FROM labevents "
                f"WHERE itemid = {int(r['itemid'])} AND valueuom IS NOT NULL{_scope(subject_ids)} "
                "ORDER BY valueuom, charttime")
        for r in rows
    ]


def check_completeness(db: Database, subject_ids: list[int] | None = None) -> list[Finding]:
    r = db.query(
        "SELECT count(*) AS n, count(*) FILTER (WHERE hadm_id IS NULL) AS miss "
        f"FROM labevents WHERE 1=1{_scope(subject_ids)}"
    )[0]
    n, miss = int(r["n"]), int(r["miss"])
    if n == 0:
        return [Finding("completeness", "green", "labevents",
                        "no lab events for this cohort", 0, "caveat", "hadm_id")]
    pct = round(100 * miss / n, 1)
    sev = "amber" if pct > 10 else "green"
    return [Finding("completeness", sev, "labevents",
                    f"labevents.hadm_id missing on {miss}/{n} rows ({pct}%) — outpatient labs; "
                    f"a caveat, not a defect", miss, "caveat", "hadm_id", "completeness:hadm-null",
                    "SELECT subject_id, itemid, charttime, valuenum, valueuom FROM labevents "
                    f"WHERE hadm_id IS NULL{_scope(subject_ids)} ORDER BY subject_id")]


def check_duplicates(db: Database, subject_ids: list[int] | None = None) -> list[Finding]:
    scope = _scope(subject_ids)
    where = f"WHERE 1=1{scope} " if scope else ""
    dups = int(db.query(
        "SELECT count(*) AS d FROM (SELECT subject_id, hadm_id, seq_num "
        f"FROM diagnoses_icd {where}GROUP BY 1,2,3 HAVING count(*) > 1)"
    )[0]["d"])
    sev = "green" if dups == 0 else "red"
    kind = "real_finding" if dups == 0 else "data_error"
    sql = ("" if dups == 0 else
           "SELECT subject_id, hadm_id, seq_num, count(*) AS rows FROM diagnoses_icd "
           f"{where}GROUP BY 1,2,3 HAVING count(*) > 1 ORDER BY count(*) DESC")
    return [Finding("duplicates", sev, "diagnoses_icd",
                    f"{dups} duplicate (subject_id, hadm_id, seq_num) keys", dups, kind,
                    "primary key", "duplicates:dx", sql)]


def check_comments_hidden(db: Database, subject_ids: list[int] | None = None) -> list[Finding]:
    # Lab rows with no numeric value but a real result trapped in the free-text comments
    # (the documented MIMIC pattern, e.g. viral-load "DETECTED"). ___ = de-identified.
    r = db.query(
        "SELECT count(*) AS n, count(DISTINCT itemid) AS items FROM labevents "
        "WHERE valuenum IS NULL AND comments IS NOT NULL "
        f"AND comments <> '___' AND trim(comments) <> ''{_scope(subject_ids)}"
    )[0]
    n = int(r["n"] or 0)
    if n == 0:
        return []
    return [Finding("completeness", "amber", "labevents",
                    f"{n} lab rows across {int(r['items'])} itemids have a NULL numeric value but a "
                    f"result trapped in the free-text comments — the value is in the wrong field",
                    n, "data_error", "valuenum NULL + comments", "completeness:comments",
                    "SELECT subject_id, hadm_id, itemid, charttime, comments FROM labevents "
                    "WHERE valuenum IS NULL AND comments IS NOT NULL AND comments <> '___' "
                    f"AND trim(comments) <> ''{_scope(subject_ids)} ORDER BY itemid")]


def check_storetime(db: Database, subject_ids: list[int] | None = None) -> list[Finding]:
    out: list[Finding] = []
    for table in ("chartevents", "labevents"):
        n = int(db.query(
            f"SELECT count(*) AS n FROM {table} "
            f"WHERE storetime IS NOT NULL AND charttime IS NOT NULL AND storetime < charttime{_scope(subject_ids)}"
        )[0]["n"])
        if n:
            out.append(Finding("temporal", "amber", table,
                               f"{n} {table} rows have storetime earlier than charttime (a documented "
                               f"MIMIC quirk — validation time can precede the charted time)",
                               n, "caveat", "storetime < charttime", f"temporal:storetime-{table}",
                               f"SELECT subject_id, itemid, charttime, storetime FROM {table} "
                               "WHERE storetime IS NOT NULL AND charttime IS NOT NULL "
                               f"AND storetime < charttime{_scope(subject_ids)} ORDER BY subject_id"))
    if not out:  # always surface the check so a clean pass is visible, not silently absent
        out.append(Finding("temporal", "green", "chartevents",
                           "0 rows with storetime earlier than charttime", 0, "real_finding",
                           "storetime < charttime"))
    return out


def check_hr_completeness(db: Database, subject_ids: list[int] | None = None) -> list[Finding]:
    total = int(db.query(
        f"SELECT count(*) AS n FROM icustays i WHERE 1=1{_scope(subject_ids, 'i.subject_id')}"
    )[0]["n"])
    if total == 0:
        return [Finding("completeness", "green", "icustays",
                        "no ICU stays for this cohort", 0, "caveat", "per-stay HR completeness")]
    # Anti-join (NOT IN a one-pass subquery) instead of a correlated NOT EXISTS — the
    # correlated form was O(stays x chartevents) and dominated the cohort-scoped latency.
    have_hr = "SELECT stay_id FROM chartevents WHERE itemid = 220045 AND stay_id IS NOT NULL"
    missing = int(db.query(
        f"SELECT count(*) AS n FROM icustays i WHERE i.stay_id NOT IN ({have_hr})"
        f"{_scope(subject_ids, 'i.subject_id')}"
    )[0]["n"])
    if missing == 0:
        return [Finding("completeness", "green", "icustays",
                        f"all {total} ICU stays have a heart-rate measurement (MIMIC expects ≥99%)",
                        0, "real_finding", "per-stay HR completeness")]
    sev = "amber" if missing / total > 0.01 else "green"
    kind = "data_error" if missing / total > 0.01 else "caveat"
    return [Finding("completeness", sev, "icustays",
                    f"{missing}/{total} ICU stays have no heart-rate (220045) measurement "
                    f"(MIMIC expects ≥99% to have one)", missing, kind, "per-stay HR completeness",
                    "completeness:hr",
                    "SELECT i.subject_id, i.stay_id, i.first_careunit, i.intime, i.outtime "
                    f"FROM icustays i WHERE i.stay_id NOT IN ({have_hr})"
                    f"{_scope(subject_ids, 'i.subject_id')} ORDER BY i.subject_id")]


def check_near_duplicates(db: Database, subject_ids: list[int] | None = None) -> list[Finding]:
    scope = _scope(subject_ids)
    where = f"WHERE 1=1{scope} " if scope else ""
    r = db.query(
        "SELECT count(*) AS groups, coalesce(sum(c - 1), 0) AS extra FROM "
        "(SELECT subject_id, stay_id, itemid, charttime, count(*) AS c FROM chartevents "
        f"{where}GROUP BY 1,2,3,4 HAVING count(*) > 1)"
    )[0]
    groups = int(r["groups"] or 0)
    if groups == 0:
        return []
    return [Finding("duplicates", "amber", "chartevents",
                    f"{groups} (patient, stay, itemid, charttime) groups have >1 chartevents row "
                    f"({int(r['extra'])} extra) — potential duplicates or legitimate re-measurements "
                    f"(review, don't auto-delete)", groups, "data_error", "near-duplicate",
                    "duplicates:near",
                    "SELECT subject_id, stay_id, itemid, charttime, count(*) AS rows FROM chartevents "
                    f"{where}GROUP BY 1,2,3,4 HAVING count(*) > 1 ORDER BY count(*) DESC")]


def all_findings(db: Database, subject_ids: list[int] | None = None) -> list[Finding]:
    s = subject_ids
    return (check_plausibility(db, s) + check_units(db, s) + check_temporal(db, s)
            + check_completeness(db, s) + check_duplicates(db, s)
            + check_comments_hidden(db, s) + check_storetime(db, s)
            + check_hr_completeness(db, s) + check_near_duplicates(db, s))


def find_offending_rows(db: Database, findings: list[Finding], finding_id: str,
                        limit: int = 50) -> dict[str, Any] | None:
    """Return the actual rows behind one finding, so a flag is never taken on trust.

    The finding's own SELECT is run against the read-only store (capped), and returned
    with the SQL itself for full transparency. Returns None when the id is unknown or the
    finding has nothing to show (a clean/green check).
    """
    match = next((f for f in findings if f.id == finding_id), None)
    if match is None or not match.sample_sql:
        return None
    rows = db.query(f"{match.sample_sql} LIMIT {int(limit)}")
    columns = list(rows[0].keys()) if rows else []
    return {
        "finding": match.dict(),
        "ref": match.ref,
        "sql": match.sample_sql,
        "columns": columns,
        "rows": rows,
        "total": match.count,
        "shown": len(rows),
        "limit": int(limit),
    }


def propose_fixes(db: Database) -> dict[str, Any]:
    """Suggest reversible, rule-backed fixes. NOTHING here is ever applied — each fix is
    only a *proposed* transform carrying an explicit forward + reverse rule, so a downstream
    pipeline could apply it to its own copy and roll it back. The brief requires corrections
    to be reversible and rule-backed; ambiguous cases stay review-only.
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
        "note": "These are proposals only — CohortFit never applies them and never modifies the "
                "source data. Each carries a documented forward and reverse rule so you can apply "
                "it in your own pipeline and undo it.",
    }


KIND_ORDER = {"data_error": 2, "caveat": 1, "real_finding": 0}
# Assumed minutes a reviewer spends locating + judging one issue class by hand. Stated,
# not measured — used only to express "reviewer time saved", never as a hard claim.
ASSUMED_MINUTES_PER_ISSUE = 3


def scorecard(db: Database, findings: list[Finding] | None = None,
              subject_ids: list[int] | None = None) -> dict[str, Any]:
    if findings is None:
        findings = all_findings(db, subject_ids)
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
