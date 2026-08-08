"""Shared fixtures. One DuckDB session reused across tests (fast)."""
from __future__ import annotations

import pytest

from app.config import settings
from app.data.loader import Database


@pytest.fixture(autouse=True)
def _no_llm(monkeypatch):
    """Force the deterministic keyword path in tests — never call the real OpenAI API
    (avoids cost, network, and nondeterminism). The OpenAI path is validated separately."""
    monkeypatch.setattr(settings, "openai_api_key", None)


@pytest.fixture(scope="session")
def db() -> Database:
    return Database()
