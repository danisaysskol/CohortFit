"""DuckDB access layer.

We register one SQL view per CSV (no import step) so queries run directly over the
frozen demo files. DuckDB sniffs types (timestamps, doubles, blanks -> NULL), which is
exactly what the quality rules need. This class is the ONLY place that touches the engine,
keeping the rest of the app decoupled from DuckDB specifics.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb

from ..config import settings

MODULES = ("hosp", "icu")


class Database:
    """Read-only DuckDB session with a view per demo table."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = Path(data_dir or settings.mimic_data_dir)
        if not self.data_dir.exists():
            raise FileNotFoundError(
                f"MIMIC data dir not found: {self.data_dir} "
                f"(set MIMIC_DATA_DIR or mount the demo folder)."
            )
        self.con = duckdb.connect(database=":memory:")
        self._tables: dict[str, str] = {}
        self._register_views()

    def _register_views(self) -> None:
        for module in MODULES:
            module_dir = self.data_dir / module
            if not module_dir.exists():
                continue
            for csv in sorted(module_dir.glob("*.csv")):
                name = csv.stem
                path_lit = str(csv).replace("'", "''")
                # sample_size=-1 => scan the whole file so types are inferred correctly
                self.con.execute(
                    f"CREATE OR REPLACE VIEW {name} AS "
                    f"SELECT * FROM read_csv_auto('{path_lit}', sample_size=-1)"
                )
                self._tables[name] = module

    def tables(self) -> dict[str, str]:
        """Map of table name -> module ('hosp' | 'icu')."""
        return dict(self._tables)

    def query(self, sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
        """Run SQL and return rows as dicts. Params are bound (never string-formatted)."""
        cur = self.con.execute(sql, params or [])
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
