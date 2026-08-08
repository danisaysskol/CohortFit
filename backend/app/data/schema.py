"""Schema introspection over the DuckDB views.

Powers the Schema Explorer page and gives the cohort layer the list of real
columns (so an IR can be validated against columns that actually exist).
"""
from __future__ import annotations

from typing import Any

from .loader import Database

JOIN_KEYS = {
    "subject_id", "hadm_id", "stay_id", "transfer_id", "specimen_id", "itemid",
    "icd_code", "pharmacy_id", "poe_id", "emar_id", "caregiver_id", "provider_id",
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
        out.append({
            "table": table,
            "module": module,
            "rows": int(n),
            "columns": [{"name": c["column_name"], "type": c["column_type"]} for c in cols],
            "join_keys": [c for c in names if c in JOIN_KEYS],
            "timestamps": [c for c in names if _is_timestamp(c)],
        })
    return out


def column_index(db: Database) -> dict[str, list[str]]:
    """table -> [columns]. Used to validate IR criteria against real columns."""
    return {t: [c["column_name"] for c in db.query(f"DESCRIBE {t}")] for t in db.tables()}


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
