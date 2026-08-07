"""Shared fixtures. One DuckDB session reused across tests (fast)."""
from __future__ import annotations

import pytest

from app.data.loader import Database


@pytest.fixture(scope="session")
def db() -> Database:
    return Database()
