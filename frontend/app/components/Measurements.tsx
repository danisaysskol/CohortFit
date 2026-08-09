"use client";

import { Measurements as MData } from "../lib/api";
import { Icon } from "./Icon";

// Track-2 point 3, made visual: measurement coverage, unit variation, value range
// vs plausibility bounds, and diagnosis coding — for whatever cohort (or dataset)
// the caller passes in. Read-only; it describes the data, never edits it.
export function Measurements({ data }: { data: MData }) {
  return (
    <div className="grid2" style={{ alignItems: "start" }}>
      <section className="panel">
        <div className="panel-h">
          <span className="lbl lbl-i"><Icon name="activity" size={13} /> Vital coverage</span>
          <span className="lbl">{data.n_stays.toLocaleString()} ICU stays</span>
        </div>
        <div className="panel-b">
          <div className="mcov">
            {data.vitals.map((v) => (
              <div className="mcov-row" key={v.itemid}>
                <div className="mcov-top">
                  <span className="mcov-label">{v.label}</span>
                  <span className="mcov-pct mono">{v.coverage_pct}%</span>
                </div>
                <div className="mcov-bar"><span style={{ width: `${v.coverage_pct}%` }} /></div>
                <div className="mcov-meta mono">
                  n={v.n.toLocaleString()} · {v.units.join(", ") || "—"}
                  {v.unit_variation && <span className="mcov-warn"> · mixed units</span>}
                  {v.out_of_range != null && v.out_of_range > 0 && v.plausible &&
                    <span className="mcov-warn"> · {v.out_of_range} outside [{v.plausible[0]},{v.plausible[1]}]</span>}
                </div>
              </div>
            ))}
          </div>
          <p className="note">Coverage is the share of the {data.n_stays.toLocaleString()} ICU stays with at least one reading. Low coverage or mixed units is a fitness <b>caveat</b>, not necessarily an error.</p>
        </div>
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <section className="panel">
          <div className="panel-h">
            <span className="lbl lbl-i"><Icon name="sitemap" size={13} /> Diagnosis coding</span>
            <span className="lbl">{data.coding.total.toLocaleString()} codes</span>
          </div>
          <div className="panel-b">
            <div className="codebar">
              {data.coding.icd9 > 0 && <span className="codebar-9" style={{ flexGrow: data.coding.icd9 }} title={`ICD-9: ${data.coding.icd9}`} />}
              {data.coding.icd10 > 0 && <span className="codebar-10" style={{ flexGrow: data.coding.icd10 }} title={`ICD-10: ${data.coding.icd10}`} />}
            </div>
            <div className="codelegend">
              <span><i className="c9" /> ICD-9 · {data.coding.icd9.toLocaleString()}</span>
              <span><i className="c10" /> ICD-10 · {data.coding.icd10.toLocaleString()}</span>
            </div>
            <div className="chips" style={{ marginTop: 10 }}>
              {data.coding.top.slice(0, 6).map((t, i) =>
                <span key={i} className="chip" style={{ textTransform: "none" }}>{t.title} <b>×{t.n}</b></span>)}
            </div>
            <p className="note">Two coding systems coexist (ICD-9 and ICD-10); a cohort query must handle both — CohortFit joins on each.</p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-h"><span className="lbl lbl-i"><Icon name="flask" size={13} /> Most-recorded labs</span></div>
          <div className="panel-b">
            <div className="mlab">
              {data.labs.slice(0, 8).map((l) => (
                <div className="mlab-row" key={l.itemid}>
                  <span className="mlab-name">{l.label}</span>
                  <span className="mlab-meta mono">
                    {l.n.toLocaleString()} · {l.units.join(", ") || "—"}
                    {l.unit_variation && <span className="mcov-warn"> · mixed</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {data.subgroups && (
          <section className="panel">
            <div className="panel-h">
              <span className="lbl lbl-i"><Icon name="users" size={13} /> Subgroup composition</span>
              <span className="lbl">{data.n_patients} patients</span>
            </div>
            <div className="panel-b">
              <div className="chips">
                {data.subgroups.gender.map((g) => (
                  <span key={g.key} className="chip">{g.key === "F" ? "Female" : g.key === "M" ? "Male" : g.key} <b>{g.n}</b></span>
                ))}
              </div>
              <div className="chips" style={{ marginTop: 8 }}>
                {data.subgroups.age_bands.map((b) => (
                  <span key={b.key} className="chip" style={{ textTransform: "none" }}>Age {b.key} <b>{b.n}</b></span>
                ))}
              </div>
              <p className="note">{data.subgroups.caveat}</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
