"""Schema introspection over the DuckDB views.

Powers the Schema Explorer page (the ER map + the filtered/paginated data explorer).
"""
from __future__ import annotations

from typing import Any

from .loader import Database

JOIN_KEYS = {
    "subject_id", "hadm_id", "stay_id", "transfer_id", "specimen_id", "itemid",
    "icd_code", "pharmacy_id", "poe_id", "emar_id", "caregiver_id", "provider_id",
}

# MIMIC-IV's logical primary/foreign keys. The CSVs carry no formal constraints, so
# these are the documented schema relationships (mimic.mit.edu/docs/iv). `pk` lists the
# primary-key columns; `fk` maps a column to the table.column it references.
KEYS: dict[str, dict[str, Any]] = {
    "patients": {"pk": ["subject_id"], "fk": []},
    "admissions": {"pk": ["hadm_id"], "fk": [{"col": "subject_id", "ref": "patients.subject_id"}]},
    "transfers": {"pk": ["transfer_id"], "fk": [
        {"col": "subject_id", "ref": "patients.subject_id"}, {"col": "hadm_id", "ref": "admissions.hadm_id"}]},
    "icustays": {"pk": ["stay_id"], "fk": [
        {"col": "subject_id", "ref": "patients.subject_id"}, {"col": "hadm_id", "ref": "admissions.hadm_id"}]},
    "diagnoses_icd": {"pk": ["subject_id", "hadm_id", "seq_num"], "fk": [
        {"col": "subject_id", "ref": "patients.subject_id"}, {"col": "hadm_id", "ref": "admissions.hadm_id"},
        {"col": "icd_code", "ref": "d_icd_diagnoses.icd_code"}]},
    "procedures_icd": {"pk": ["subject_id", "hadm_id", "seq_num"], "fk": [
        {"col": "hadm_id", "ref": "admissions.hadm_id"}, {"col": "icd_code", "ref": "d_icd_procedures.icd_code"}]},
    "labevents": {"pk": ["labevent_id"], "fk": [
        {"col": "subject_id", "ref": "patients.subject_id"}, {"col": "hadm_id", "ref": "admissions.hadm_id"},
        {"col": "itemid", "ref": "d_labitems.itemid"}]},
    "microbiologyevents": {"pk": ["microevent_id"], "fk": [
        {"col": "subject_id", "ref": "patients.subject_id"}, {"col": "hadm_id", "ref": "admissions.hadm_id"}]},
    "prescriptions": {"pk": [], "fk": [
        {"col": "subject_id", "ref": "patients.subject_id"}, {"col": "hadm_id", "ref": "admissions.hadm_id"}]},
    "emar": {"pk": ["emar_id"], "fk": [
        {"col": "subject_id", "ref": "patients.subject_id"}, {"col": "hadm_id", "ref": "admissions.hadm_id"}]},
    "poe": {"pk": ["poe_id"], "fk": [
        {"col": "subject_id", "ref": "patients.subject_id"}, {"col": "hadm_id", "ref": "admissions.hadm_id"}]},
    "chartevents": {"pk": [], "fk": [
        {"col": "subject_id", "ref": "patients.subject_id"}, {"col": "hadm_id", "ref": "admissions.hadm_id"},
        {"col": "stay_id", "ref": "icustays.stay_id"}, {"col": "itemid", "ref": "d_items.itemid"}]},
    "inputevents": {"pk": [], "fk": [
        {"col": "stay_id", "ref": "icustays.stay_id"}, {"col": "itemid", "ref": "d_items.itemid"}]},
    "outputevents": {"pk": [], "fk": [
        {"col": "stay_id", "ref": "icustays.stay_id"}, {"col": "itemid", "ref": "d_items.itemid"}]},
    "procedureevents": {"pk": [], "fk": [
        {"col": "stay_id", "ref": "icustays.stay_id"}, {"col": "itemid", "ref": "d_items.itemid"}]},
    "datetimeevents": {"pk": [], "fk": [
        {"col": "stay_id", "ref": "icustays.stay_id"}, {"col": "itemid", "ref": "d_items.itemid"}]},
    "ingredientevents": {"pk": [], "fk": [
        {"col": "stay_id", "ref": "icustays.stay_id"}, {"col": "itemid", "ref": "d_items.itemid"}]},
    "d_icd_diagnoses": {"pk": ["icd_code", "icd_version"], "fk": []},
    "d_icd_procedures": {"pk": ["icd_code", "icd_version"], "fk": []},
    "d_labitems": {"pk": ["itemid"], "fk": []},
    "d_items": {"pk": ["itemid"], "fk": []},
    "d_hcpcs": {"pk": ["code"], "fk": []},
    "provider": {"pk": ["provider_id"], "fk": []},
    "caregiver": {"pk": ["caregiver_id"], "fk": []},
}


def _is_timestamp(col: str) -> bool:
    return col.endswith("time") or col.endswith("date") or col == "dod"


def describe(db: Database) -> list[dict[str, Any]]:
    """One entry per table: module, row count, columns, join keys, timestamps."""
    out: list[dict[str, Any]] = []
    for table, module in sorted(db.tables().items()):
        cols = db.query(f"DESCRIBE {table}")
        names = [c["column_name"] for c in cols]
        n = db.query(f"SELECT count(*) AS n FROM {table}")[0]["n"]
        keys = KEYS.get(table, {"pk": [], "fk": []})
        out.append({
            "table": table,
            "module": module,
            "rows": int(n),
            "columns": [{"name": c["column_name"], "type": c["column_type"]} for c in cols],
            "join_keys": [c for c in names if c in JOIN_KEYS],
            "timestamps": [c for c in names if _is_timestamp(c)],
            "pk": keys["pk"],
            "fk": keys["fk"],
        })
    return out


def sample(db: Database, table: str, limit: int = 25) -> dict[str, Any]:
    """A few rows of one table for the Schema Explorer (local UI only)."""
    if table not in db.tables():
        raise KeyError(table)
    cols = [c["column_name"] for c in db.query(f"DESCRIBE {table}")]
    rows = db.query(f"SELECT * FROM {table} LIMIT {int(limit)}")
    return {"table": table, "columns": cols, "rows": rows}


_EXPLORE_OPS = {"=", "!=", ">", ">=", "<", "<="}


def explore(
    db: Database,
    table: str,
    *,
    limit: int = 25,
    offset: int = 0,
    col: str | None = None,
    op: str | None = None,
    val: str | None = None,
    search: str | None = None,
) -> dict[str, Any]:
    """Filtered, paginated data explorer over one table (local UI only).

    Safe: the table and filter column are whitelisted against the real schema, and all
    values are bound parameters — never string-formatted into SQL. Read-only.
    """
    if table not in db.tables():
        raise KeyError(table)
    cols = [c["column_name"] for c in db.query(f"DESCRIBE {table}")]

    where: list[str] = []
    params: list[Any] = []
    if col in cols and val not in (None, ""):
        if op == "contains":
            where.append(f'CAST("{col}" AS VARCHAR) ILIKE ?')
            params.append(f"%{val}%")
        elif op in {"=", "!="}:
            where.append(f'CAST("{col}" AS VARCHAR) {op} ?')
            params.append(str(val))
        elif op in _EXPLORE_OPS:
            try:
                params.append(float(val))
                where.append(f'TRY_CAST("{col}" AS DOUBLE) {op} ?')
            except ValueError:
                pass
    if search:
        ors = " OR ".join(f'CAST("{c}" AS VARCHAR) ILIKE ?' for c in cols)
        where.append("(" + ors + ")")
        params += [f"%{search}%"] * len(cols)

    clause = (" WHERE " + " AND ".join(where)) if where else ""
    total = int(db.query(f"SELECT count(*) AS n FROM {table}{clause}", params)[0]["n"])
    rows = db.query(
        f"SELECT * FROM {table}{clause} LIMIT {int(limit)} OFFSET {int(offset)}", params
    )
    return {"table": table, "columns": cols, "rows": rows, "total": total,
            "limit": limit, "offset": offset}
