"use client";

import { useEffect, useMemo, useState } from "react";
import { api, CohortScorecard, Finding, FindingRows } from "../lib/api";
import { Verdict, DimTile, SeverityBar, Sev } from "./charts";
import { CoverageByTable } from "./CoverageByTable";
import { Drawer } from "./Drawer";
import { Icon } from "./Icon";

const SEV_RANK: Record<Sev, number> = { green: 0, amber: 1, red: 2 };
const KIND_PILL: Record<string, string> = { data_error: "err", real_finding: "find", caveat: "caveat" };
const KIND_LABEL: Record<string, string> = { data_error: "Data error", real_finding: "Verified finding", caveat: "Documented caveat" };
const VERDICT: Record<Sev, { t: string; s: string }> = {
  red: { t: "Requires correction", s: "Critical data-quality issues are present in this selection." },
  amber: { t: "Usable with caveats", s: "Suitable for analysis provided the flagged issues are accounted for." },
  green: { t: "Fit for analysis", s: "No blocking data-quality issues were detected." },
};

// The data-fitness scorecard for a set of patients. Pass a cohort's subject_ids to judge
// that cohort; pass [] to judge the whole dataset. Findings and their drill-in stay scoped.
export function CohortFitness({ subjectIds }: { subjectIds: number[] }) {
  const [sc, setSc] = useState<CohortScorecard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dimFilter, setDimFilter] = useState<string | null>(null);
  const [drill, setDrill] = useState<FindingRows | null>(null);
  const [drillId, setDrillId] = useState<string | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const key = subjectIds.join(",");
  useEffect(() => {
    setSc(null); setErr(null); setDrill(null); setDrillId(null); setDimFilter(null);
    api.cohortQuality(subjectIds).then(setSc).catch((e) => setErr(String(e)));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const derived = useMemo(() => {
    if (!sc) return null;
    const overall = sc.dimensions.reduce<Sev>((w, d) => (SEV_RANK[d.severity] > SEV_RANK[w] ? d.severity : w), "green");
    const counts = { red: 0, amber: 0, green: 0 };
    const perDim: Record<string, number> = {};
    for (const f of sc.findings) { counts[f.severity as Sev]++; perDim[f.dimension] = (perDim[f.dimension] ?? 0) + 1; }
    return { overall, counts, perDim };
  }, [sc]);

  function openDrill(f: Finding) {
    if (!f.drillable) return;
    if (drillId === f.id) { setDrill(null); setDrillId(null); return; }
    setDrillId(f.id); setDrill(null); setDrillLoading(true);
    api.cohortFindingRows(subjectIds, f.id).then(setDrill).catch(() => {}).finally(() => setDrillLoading(false));
  }

  if (err) return <div className="abstain"><span className="k">Unavailable</span> — {err}.</div>;
  if (!sc || !derived) return <div className="loading">Assessing data fitness…</div>;

  const findings = sc.findings.filter((f) => !dimFilter || f.dimension === dimFilter);

  return (
    <>
      <div className="grid2 rise-in" style={{ gridTemplateColumns: "1.5fr 1fr", alignItems: "stretch" }}>
        <Verdict severity={derived.overall} title={VERDICT[derived.overall].t} sub={VERDICT[derived.overall].s} />
        <div className="metrics" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="stile"><div className="stile-v">{sc.summary.issues_found}</div><div className="stile-l">Data-error issues</div><div className="stile-m">Ranked most severe first</div></div>
          <div className="stile"><div className="stile-v">{sc.findings.length}</div><div className="stile-l">Total findings</div><div className="stile-m">across five dimensions</div></div>
        </div>
      </div>

      <div className="dgrid" style={{ marginTop: 14 }}>
        {sc.dimensions.map((d) => (
          <DimTile key={d.dimension} dimension={d.dimension} severity={d.severity as Sev}
            detail={`${derived.perDim[d.dimension] ?? 0} finding${(derived.perDim[d.dimension] ?? 0) === 1 ? "" : "s"}`}
            active={dimFilter === d.dimension}
            onClick={() => setDimFilter((v) => (v === d.dimension ? null : d.dimension))} />
        ))}
      </div>

      <div style={{ marginTop: 14 }}><CoverageByTable findings={sc.findings} /></div>

      <section className="panel" style={{ marginTop: 14 }}>
        <div className="panel-h">
          <span className="lbl">{dimFilter ? `Findings · ${dimFilter}` : "Findings, ranked"}</span>
          {dimFilter
            ? <button className="btn btn-ghost btn-sm" onClick={() => setDimFilter(null)}><Icon name="x" size={11} /> Clear filter</button>
            : <span className="lbl">{sc.findings.length} total</span>}
        </div>
        <div className="panel-b" style={{ maxHeight: 340, overflow: "auto" }}>
          <div className="flags">
            {findings.map((f, i) => {
              const active = drillId === f.id;
              return (
                <div className={"flag" + (f.drillable ? " flag-click" : "") + (active ? " flag-on" : "")}
                  key={i} onClick={() => openDrill(f)}
                  {...(f.drillable ? { role: "button", tabIndex: 0, onKeyDown: (e: { key: string; preventDefault: () => void }) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDrill(f); } } } : {})}
                  title={f.drillable ? "Show the offending rows" : undefined}>
                  <span className={"sq " + f.severity} />
                  <span>
                    <div className="t1">{f.detail}</div>
                    <div className="t2">{f.table}{f.ref ? " · " + f.ref : ""}</div>
                  </span>
                  <span className={"pill " + KIND_PILL[f.kind]}>{KIND_LABEL[f.kind]}</span>
                  {f.drillable && (
                    <span className="rowcta">
                      {drillLoading && active ? <span className="spin" /> : <><Icon name={active ? "chevron" : "search"} size={11} /> {active ? "Hide" : "Inspect"}</>}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {drill && (
        <Drawer wide onClose={() => { setDrill(null); setDrillId(null); }}
          title={<><Icon name="search" size={13} /> Offending rows</>}>
          <div className="t1" style={{ marginBottom: 4 }}>{drill.finding.detail}</div>
          <div className="t2" style={{ marginBottom: 12 }}>{drill.finding.table}{drill.ref ? " · " + drill.ref : ""} — showing {drill.shown.toLocaleString()} of {drill.total.toLocaleString()}</div>
          <pre><code>{drill.sql}</code></pre>
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="drill-tbl">
              <thead><tr>{drill.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {drill.rows.map((r, i) => (
                  <tr key={i}>{drill.columns.map((c) => <td key={c}>{r[c] === null ? <span className="null">null</span> : String(r[c])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">Real rows in the selected patients, returned by the query above. Source data is never modified.</p>
        </Drawer>
      )}
    </>
  );
}
