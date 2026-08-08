"""DuckDB access layer.

We materialise one in-memory table per CSV at startup (read once) rather than a view
over the file. A view re-reads and re-parses the whole CSV on *every* query, which made
cohort-scoped scans of the 669k-row chartevents file take seconds each; a materialised
table turns those into fast columnar scans. DuckDB still sniffs types (timestamps,
doubles, blanks -> NULL), exactly what the quality rules need. This class is the ONLY
place that touches the engine, keeping the rest of the app decoupled from DuckDB.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb

from ..config import settings

MODULES = ("hosp", "icu")


class Database:
    """Read-only DuckDB session with an in-memory table per demo CSV."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = Path(data_dir or settings.mimic_data_dir)
        if not self.data_dir.exists():
            raise FileNotFoundError(
                f"MIMIC data dir not found: {self.data_dir} "
                f"(set MIMIC_DATA_DIR or mount the demo folder)."
            )
        self.con = duckdb.connect(database=":memory:")
        self._tables: dict[str, str] = {}
        self._load_tables()

    def _load_tables(self) -> None:
        for module in MODULES:
            module_dir = self.data_dir / module
            if not module_dir.exists():
                continue
            for csv in sorted(module_dir.glob("*.csv")):
                name = csv.stem
                path_lit = str(csv).replace("'", "''")
                # Materialise into an in-memory table (read once). sample_size=-1 scans the
                # whole file so types are inferred correctly.
                self.con.execute(
                    f"CREATE OR REPLACE TABLE {name} AS "
                    f"SELECT * FROM read_csv_auto('{path_lit}', sample_size=-1)"
                )
                self._tables[name] = module

    def tables(self) -> dict[str, str]:
        """Map of table name -> module ('hosp' | 'icu')."""
        return dict(self._tables)

    def query(self, sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
        """Run SQL and return rows as dicts. Params are bound (never string-formatted).

        Uses a fresh cursor per query: a DuckDB connection is NOT thread-safe, but
        `.cursor()` yields an independent connection over the same in-memory database,
        so concurrent requests (FastAPI's threadpool) don't corrupt each other's results.
        """
        cur = self.con.cursor()
        try:
            cur.execute(sql, params or [])
            cols = [c[0] for c in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
        finally:
            cur.close()
