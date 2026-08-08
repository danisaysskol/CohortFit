"use client";

import { useEffect, useState } from "react";
import { api, EvalResult } from "../lib/api";

function fmt(a: { mean: number; std: number }) {
  return `${a.mean.toFixed(2)} ± ${a.std.toFixed(2)}`;
}

export default function EvaluationPage() {
  const [ev, setEv] = useState<EvalResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.runEval().then(setEv).catch((e) => setErr(String(e)));
  }, []);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Evaluation</h1>
          <p>Nobody hands us labelled errors, so we inject known ones into a copy of the data and measure detection across several seeds — reported as mean ± std, next to the dumb fixed-rule baseline. Synthetic errors never touch source records.</p>
        </div>
      </div>

      {err && !ev && <div className="abstain"><span className="k">Error</span> — {err}. Is the backend running on :8000?</div>}
      {!ev && !err && <div className="loading">Running the injected-error harness across seeds…</div>}

      {ev && (
        <>
          <div className="metrics">
            <div className="metric"><div className="v">{fmt(ev.aggregate.precision)}</div><div className="k lbl">Precision (mean ± std)</div></div>
            <div className="metric"><div className="v">{fmt(ev.aggregate.recall)}</div><div className="k lbl">Recall</div></div>
            <div className="metric"><div className="v">{fmt(ev.aggregate.f1)}</div><div className="k lbl">F1</div></div>
            <div className="metric"><div className="v">{fmt(ev.aggregate.false_positive_rate)}</div><div className="k lbl">False-positive rate</div></div>
          </div>

          <div className="grid2" style={{ marginTop: 18 }}>
            <section className="panel">
              <div className="panel-h"><span className="lbl">CohortFit vs. the dumb baseline</span><span className="lbl">temporal check</span></div>
              <div className="panel-b">
                <div className="tablewrap">
                  <table className="gt">
                    <thead><tr><th>Approach</th><th className="num">Precision</th><th className="num">Recall</th><th className="num">FPR</th></tr></thead>
                    <tbody>
                      <tr>
                        <td><b>CohortFit</b> — gated rule</td>
                        <td className="num mono">{ev.aggregate.precision.mean.toFixed(2)}</td>
                        <td className="num mono">{ev.aggregate.recall.mean.toFixed(2)}</td>
                        <td className="num mono">{ev.aggregate.false_positive_rate.mean.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="muted">Dumb version — {ev.baseline.strategy}</td>
                        <td className="num mono">{ev.baseline.precision.toFixed(2)}</td>
                        <td className="num mono">{ev.baseline.recall.toFixed(2)}</td>
                        <td className="num mono">{ev.baseline.false_positive_rate.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="note">The dumb rule catches every injected error too (recall {ev.baseline.recall.toFixed(2)}) but at a precision of {ev.baseline.precision.toFixed(2)} — it flags almost everything. CohortFit keeps precision at {ev.aggregate.precision.mean.toFixed(2)} because it gates on context.</p>
              </div>
            </section>

            <section className="panel">
              <div className="panel-h"><span className="lbl">Per-seed runs</span><span className="lbl">{ev.seeds.length} folds</span></div>
              <div className="panel-b">
                <div className="tablewrap">
                  <table className="gt">
                    <thead><tr><th>Seed</th><th className="num">Injected</th><th className="num">TP</th><th className="num">FP</th><th className="num">Precision</th><th className="num">Recall</th></tr></thead>
                    <tbody>
                      {ev.runs.map((r, i) => (
                        <tr key={i}>
                          <td className="mono">{String(r.seed)}</td>
                          <td className="num mono">{String(r.injected)}</td>
                          <td className="num mono">{String(r.tp)}</td>
                          <td className="num mono">{String(r.fp)}</td>
                          <td className="num mono">{Number(r.precision).toFixed(2)}</td>
                          <td className="num mono">{Number(r.recall).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="note"><b>{ev.note}</b></p>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
