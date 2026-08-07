"""Plausibility bounds for numeric ICU vitals.

itemid -> (low, high, label, unit). These mirror the bounds in MIT's
mimic-code `concepts/measurement/vitalsign.sql` (cited in docs/RESEARCH_AND_EXPLORATION.md),
so our rules are citeable and non-arbitrary rather than invented thresholds.

A value is implausible when valuenum < low or valuenum > high. Because these
itemids are numeric vitals, the check is inherently gated to numeric data — we
never flag a text/checkbox item for a missing number (the Track-2 strict rule).
"""
from __future__ import annotations

VITAL_RANGES: dict[int, tuple[float, float, str, str]] = {
    220045: (0, 300, "Heart Rate", "bpm"),
    220210: (0, 70, "Respiratory Rate", "insp/min"),
    220277: (0, 100, "SpO2", "%"),
    220179: (0, 400, "NBP systolic", "mmHg"),
    220180: (0, 300, "NBP diastolic", "mmHg"),
    220181: (0, 300, "NBP mean", "mmHg"),
    220050: (0, 400, "ABP systolic", "mmHg"),
    220051: (0, 300, "ABP diastolic", "mmHg"),
    220052: (0, 300, "ABP mean", "mmHg"),
    223761: (70, 120, "Temperature (F)", "F"),
    223762: (10, 50, "Temperature (C)", "C"),
}
