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
    findings = r.json()["findings"]
    assert findings
    assert all("id" in f and "drillable" in f for f in findings)


def test_finding_rows_endpoint():
    r = client.get("/quality/finding/plausibility:220052/rows", params={"limit": 5})
    assert r.status_code == 200
    body = r.json()
    assert body["rows"] and body["shown"] == len(body["rows"]) <= 5
    assert "SELECT" in body["sql"]
    # unknown / clean findings 404 rather than returning an empty table
    assert client.get("/quality/finding/nope/rows").status_code == 404


def test_patient_timeline_endpoint():
    r = client.get("/patient/10006580/timeline")
    assert r.status_code == 200
    assert r.json()["events"]
    assert client.get("/patient/999999999/timeline").status_code == 404


def test_negative_limit_is_clamped_not_500():
    # A negative limit/offset must clamp to a valid page, never reach SQL as a
    # negative LIMIT (which crashed DuckDB -> 500). Regression for the blackbox find.
    assert client.get("/explore/patients", params={"limit": -5, "offset": -9}).status_code == 200
    assert client.get("/schema/patients", params={"limit": -3}).status_code == 200


def test_empty_cohort_build_is_clarify():
    r = client.post("/cohort/build", json={"text": "   "})
    assert r.status_code == 200 and r.json()["answerable"] is False
    assert r.json()["disposition"] == "clarify"
