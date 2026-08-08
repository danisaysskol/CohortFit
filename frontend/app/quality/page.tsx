"use client";

import { useEffect, useMemo, useState } from "react";
import { api, Scorecard } from "../lib/api";
import { Verdict, StatTile, DimTile, SeverityBar, Sev } from "../components/charts";
import { FixLedger } from "./FixLedger";

const KIND_PILL: Record<string, string> = { data_error: "err", real_finding: "find", caveat: "caveat" };
const KIND_LABEL: Record<string, string> = { data_error: "Data error", real_finding: "Verified finding", caveat: "Documented caveat" };
const SEV_RANK: Record<Sev, number> = { green: 0, amber: 1, red: 2 };

export default function QualityPage() {
  const [sc, setSc] = useState<Scorecard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.scorecard().then(setSc).catch((e) => setErr(String(e)));
  }, []);

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
          {/* Hero: verdict + headline numbers */}
          <div className="grid2" style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "stretch" }}>
            <Verdict severity={derived.overall} title={verdictCopy[derived.overall].t} sub={verdictCopy[derived.overall].s} />
            <div className="metrics" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <StatTile value={String(sc.summary.issues_found)} label="Data-error issues" meaning="Ranked most severe first" />
              <StatTile value={`≈${sc.summary.reviewer_minutes_saved_estimate}m`} label="Est. review time saved" meaning="vs. manual scanning" />
            </div>
          </div>

          {/* Dimension tiles */}
          <div className="dgrid" style={{ marginTop: 18 }}>
            {sc.dimensions.map((d) => (
              <DimTile key={d.dimension} dimension={d.dimension} severity={d.severity as Sev}
                       detail={`${derived.perDim[d.dimension] ?? 0} finding${(derived.perDim[d.dimension] ?? 0) === 1 ? "" : "s"}`} />
            ))}
          </div>

          {/* Severity distribution + findings */}
          <div className="grid2" style={{ marginTop: 18 }}>
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
              <div className="panel-h"><span className="lbl">Findings, ranked</span></div>
              <div className="panel-b" style={{ maxHeight: 360, overflow: "auto" }}>
                <div className="flags">
                  {sc.findings.map((f, i) => (
                    <div className="flag" key={i}>
                      <span className={"sq " + f.severity} />
                      <span>
                        <div className="t1">{f.detail}</div>
                        <div className="t2">{f.table}{f.ref ? " · " + f.ref : ""}</div>
                      </span>
                      <span className={"pill " + KIND_PILL[f.kind]}>{KIND_LABEL[f.kind]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <FixLedger />
        </>
      )}
    </>
  );
}
