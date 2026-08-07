"""API smoke tests via FastAPI TestClient."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["tables"] >= 30


def test_schema():
    r = client.get("/schema")
    assert r.status_code == 200
    assert any(t["table"] == "patients" for t in r.json()["tables"])


def test_build_cohort():
    r = client.post("/cohort/build", json={"text": "ICU patients over 65 who died in hospital"})
    assert r.status_code == 200
    body = r.json()
    assert body["n"] == 9 and body["answerable"] is True
    assert "SELECT" in body["sql"]


def test_scorecard_endpoint():
    r = client.get("/quality/scorecard")
    assert r.status_code == 200
    assert r.json()["dimensions"]
