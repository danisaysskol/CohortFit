"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, Scorecard, Finding, FindingRows } from "../lib/api";
import { Verdict, StatTile, DimTile, SeverityBar, Sev } from "../components/charts";
import { Icon } from "../components/Icon";
import { Explain } from "../components/Explain";
import { FixLedger } from "./FixLedger";

const KIND_PILL: Record<string, string> = { data_error: "err", real_finding: "find", caveat: "caveat" };
const KIND_LABEL: Record<string, string> = { data_error: "Data error", real_finding: "Verified finding", caveat: "Documented caveat" };
const SEV_RANK: Record<Sev, number> = { green: 0, amber: 1, red: 2 };

export default function QualityPage() {
  const [sc, setSc] = useState<Scorecard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drill, setDrill] = useState<FindingRows | null>(null);
  const [drillId, setDrillId] = useState<string | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [dimFilter, setDimFilter] = useState<string | null>(null);   // focus findings by dimension
  const drillRef = useRef<HTMLElement>(null);

  useEffect(() => {
    api.scorecard().then(setSc).catch((e) => setErr(String(e)));
  }, []);

  // Motion with purpose: bring the offending rows into view the moment they load.
  useEffect(() => {
    if (drill) drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [drill]);

  function openDrill(f: Finding) {
    if (!f.drillable) return;
    if (drillId === f.id) { setDrill(null); setDrillId(null); return; }  // toggle off
    setDrillId(f.id); setDrill(null); setDrillLoading(true);
    api.findingRows(f.id).then(setDrill).catch(() => {}).finally(() => setDrillLoading(false));
  }

  const derived = useMemo(() => {
    if (!sc) return null;
    const overall = sc.dimensions.reduce<Sev>((w, d) => (SEV_RANK[d.severity] > SEV_RANK[w] ? d.severity : w), "green");
    const counts = { red: 0, amber: 0, green: 0 };
    for (const f of sc.findings) counts[f.severity as Sev]++;
    const perDim: Record<string, number> = {};
    for (const f of sc.findings) perDim[f.dimension] = (perDim[f.dimension] ?? 0) + 1;
    return { overall, counts, perDim };
  }, [sc]);

  const verdictCopy: Record<Sev, { t: string; s: string }> = {
    red: { t: "Requires correction", s: "Critical data-quality issues are present. Review the flagged errors before using this data for analysis." },
    amber: { t: "Usable with caveats", s: "The data are suitable for analysis provided the flagged issues and documented caveats are accounted for." },
    green: { t: "Fit for analysis", s: "No blocking data-quality issues were detected." },
  };

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Data-fitness assessment</h1>
          <p>An at-a-glance verdict across five quality dimensions, with every finding traced to its source table and classified as a data error, a verified clinical finding, or a documented caveat.</p>
        </div>
      </div>

      {err && !sc && <div className="abstain"><span className="k">Unavailable</span> — {err}. Confirm the backend is running on port 8000.</div>}
      {!sc && !err && <div className="loading">Assessing the dataset…</div>}

      {sc && derived && (
        <>
          <Explain items={[
            { k: "Context", icon: "database", t: <>Real ICU and hospital records (MIMIC-IV demo, <b>100 patients</b>), de-identified and date-shifted.</> },
            { k: "Problem", icon: "alert", t: <>Before trusting an analysis you must know if the data are fit — and tell a <b>genuine clinical extreme</b> from a <b>data error</b>.</> },
            { k: "Method", icon: "filter", t: <>Rules across <b>five dimensions</b>, each gated on <span className="mono">d_items.param_type</span> so text items are not miscounted.</> },
            { k: "Result", icon: "check", t: <><b>{sc.summary.issues_found} data errors</b> + caveats, ranked worst-first, each traceable to real rows.</> },
          ]} />

          {/* Hero: verdict + headline numbers */}
          <div className="grid2 rise-in" style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "stretch" }}>
            <Verdict severity={derived.overall} title={verdictCopy[derived.overall].t} sub={verdictCopy[derived.overall].s} />
            <div className="metrics" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <StatTile value={String(sc.summary.issues_found)} label="Data-error issues" meaning="Ranked most severe first" />
              <StatTile value={`≈${sc.summary.reviewer_minutes_saved_estimate}m`} label="Est. review time saved" meaning="vs. manual scanning" />
            </div>
          </div>

          {/* Dimension tiles double as filters for the findings list */}
          <div className="dgrid" style={{ marginTop: 14 }}>
            {sc.dimensions.map((d) => (
              <DimTile key={d.dimension} dimension={d.dimension} severity={d.severity as Sev}
                       detail={`${derived.perDim[d.dimension] ?? 0} finding${(derived.perDim[d.dimension] ?? 0) === 1 ? "" : "s"}`}
                       active={dimFilter === d.dimension}
                       onClick={() => setDimFilter((v) => (v === d.dimension ? null : d.dimension))} />
            ))}
          </div>

          {/* Severity distribution + findings */}
          <div className="grid2" style={{ marginTop: 14, alignItems: "start" }}>
            <section className="panel">
              <div className="panel-h"><span className="lbl">Finding distribution</span><span className="lbl">{sc.findings.length} total</span></div>
              <div className="panel-b">
                <SeverityBar red={derived.counts.red} amber={derived.counts.amber} green={derived.counts.green} />
                <div className="ai" style={{ marginTop: 16 }}>
                  <span className="b">AI</span>
                  <span>Rules are gated on <span className="mono">d_items.param_type</span> and reference ranges, so an extreme-but-genuine laboratory value is reported as a finding rather than an error. AI-generated explanations are kept visually distinct from source data.</span>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-h">
                <span className="lbl">{dimFilter ? `Findings · ${dimFilter}` : "Findings, ranked"}</span>
                {dimFilter
                  ? <button className="btn btn-ghost btn-sm" onClick={() => setDimFilter(null)}><Icon name="x" size={11} /> Clear filter</button>
                  : <span className="lbl">{sc.findings.length} total</span>}
              </div>
              <div className="panel-b" style={{ maxHeight: 360, overflow: "auto" }}>
                <div className="flags">
                  {sc.findings.filter((f) => !dimFilter || f.dimension === dimFilter).map((f, i) => {
                    const active = drillId === f.id;
                    return (
                      <div className={"flag" + (f.drillable ? " flag-click" : "") + (active ? " flag-on" : "")}
                           key={i} onClick={() => openDrill(f)}
                           title={f.drillable ? "Show the offending rows" : undefined}>
                        <span className={"sq " + f.severity} />
                        <span>
                          <div className="t1">{f.detail}</div>
                          <div className="t2">{f.table}{f.ref ? " · " + f.ref : ""}</div>
                        </span>
                        <span className={"pill " + KIND_PILL[f.kind]}>{KIND_LABEL[f.kind]}</span>
                        {f.drillable && (
                          <span className="rowcta">
                            {drillLoading && active
                              ? <span className="spin" />
                              : <><Icon name={active ? "chevron" : "search"} size={11} /> {active ? "Hide" : "Inspect"}</>}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {drill && (
            <section className="panel panel-pop" ref={drillRef} style={{ marginTop: 18 }}>
              <div className="panel-h">
                <span className="lbl lbl-i"><Icon name="search" size={13} /> Offending rows</span>
                <button className="btn btn-ghost" onClick={() => { setDrill(null); setDrillId(null); }}>
                  <Icon name="x" size={12} /> Close
                </button>
              </div>
              <div className="panel-b">
                <div className="t1" style={{ marginBottom: 4 }}>{drill.finding.detail}</div>
                <div className="t2" style={{ marginBottom: 12 }}>
                  {drill.finding.table}{drill.ref ? " · " + drill.ref : ""} — showing {drill.shown.toLocaleString()} of {drill.total.toLocaleString()}
                </div>
                <pre><code>{drill.sql}</code></pre>
                <div style={{ overflowX: "auto", marginTop: 12 }}>
                  <table className="drill-tbl">
                    <thead>
                      <tr>{drill.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {drill.rows.map((r, i) => (
                        <tr key={i}>
                          {drill.columns.map((c) => (
                            <td key={c}>{r[c] === null ? <span className="null">null</span> : String(r[c])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="note">These are real rows in the demo dataset, returned by the query above. Source data is never modified — the flag points here so a reviewer can judge it directly.</p>
              </div>
            </section>
          )}

          <FixLedger />
        </>
      )}
    </>
  );
}
