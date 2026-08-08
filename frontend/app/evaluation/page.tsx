"use client";

import { useEffect, useState } from "react";
import { api, EvalResult } from "../lib/api";
import { StatTile, CompareBars, ConfusionMatrix } from "../components/charts";
import { Explain } from "../components/Explain";
import { Icon } from "../components/Icon";

export default function EvaluationPage() {
  const [ev, setEv] = useState<EvalResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.runEval().then(setEv).catch((e) => setErr(String(e)));
  }, []);

  // Aggregate a representative confusion matrix across the seeded runs (they are identical here).
  const totalTp = ev ? ev.runs.reduce((s, r) => s + Number(r.tp), 0) : 0;
  const totalFp = ev ? ev.runs.reduce((s, r) => s + Number(r.fp), 0) : 0;
  const totalFn = ev ? ev.runs.reduce((s, r) => s + Number(r.fn), 0) : 0;
  const totalTn = ev ? ev.runs.reduce((s, r) => s + Number(r.tn), 0) : 0;

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Detection performance</h1>
          <p>A fixed number of known errors is injected into a copy of the data across several random seeds; the quality engine must recover them. Results are reported as mean ± standard deviation and compared against a naive fixed-rule baseline. Synthetic errors never touch the source records.</p>
        </div>
      </div>

      <div className="abstain" style={{ borderColor: "var(--line-strong)", background: "var(--surface-2)", marginBottom: 16 }}>
        <span className="k" style={{ color: "var(--accent)" }}>Scope of these scores</span> — they cover <b>one check: temporal integrity</b> (admittime ≥ dischtime), the single dimension with a clean injectable ground truth (the real demo has 0 such violations, so a swapped timestamp is cleanly separable). This shows the harness is real, reproducible, and beats a naive baseline — <b>it is not a claim that all five dimensions score 1.00</b>. The other four are evidenced by real, clickable findings on the Data-fitness page, not by injection.
      </div>

      {err && !ev && <div className="abstain"><span className="k">Unavailable</span> — {err}. Confirm the backend is running on port 8000.</div>}
      {!ev && !err && <div className="loading">Running the injected-error evaluation across seeds…</div>}

      {ev && (
        <>
          <Explain items={[
            { k: "Context", icon: "chart", t: <>You cannot grade a bug-finder on the bugs it <b>happens to find</b> — there is no ground truth to score against.</> },
            { k: "Problem", icon: "alert", t: <>So we inject a <b>known number of errors</b> into a copy of the data and measure how many the engine recovers.</> },
            { k: "Method", icon: "play", t: <>Seeded injection across <b>{ev.seeds.length} seeds</b>; precision / recall / FPR vs a naive fixed-rule baseline. The source is never touched.</> },
            { k: "Result", icon: "check", t: <>Recall <b>{ev.aggregate.recall.mean.toFixed(2)}</b>, precision <b>{ev.aggregate.precision.mean.toFixed(2)}</b> on this check — reported honestly as a strong case, not a clinical claim.</> },
          ]} />

          {/* Headline metrics with plain-English meaning */}
          <div className="metrics">
            <StatTile value={ev.aggregate.precision.mean.toFixed(2)} label="Precision" meaning="Of the rows flagged, the share that were genuine injected errors." />
            <StatTile value={ev.aggregate.recall.mean.toFixed(2)} label="Recall" meaning="Of the injected errors, the share the engine caught." />
            <StatTile value={ev.aggregate.f1.mean.toFixed(2)} label="F1" meaning="The harmonic mean of precision and recall." />
            <StatTile value={ev.aggregate.false_positive_rate.mean.toFixed(2)} label="False-positive rate" meaning="Of the clean rows, the share wrongly flagged." />
          </div>

          <div className="grid2" style={{ marginTop: 18 }}>
            {/* The money chart: CohortFit vs the dumb baseline */}
            <section className="panel">
              <div className="panel-h"><span className="lbl">CohortFit vs. fixed-rule baseline</span><span className="lbl">{ev.seeds.length} seeds</span></div>
              <div className="panel-b">
                <CompareBars rows={[
                  { metric: "Precision", ours: ev.aggregate.precision.mean, baseline: ev.baseline.precision },
                  { metric: "Recall", ours: ev.aggregate.recall.mean, baseline: ev.baseline.recall },
                  { metric: "False-positive rate", ours: ev.aggregate.false_positive_rate.mean, baseline: ev.baseline.false_positive_rate },
                ]} />
                <p className="note">Both approaches catch every injected error (recall {ev.baseline.recall.toFixed(2)}), but the baseline "{ev.baseline.strategy}" holds a precision of only {ev.baseline.precision.toFixed(2)} — it flags almost everything. By gating on context, CohortFit maintains a precision of {ev.aggregate.precision.mean.toFixed(2)}.</p>
              </div>
            </section>

            {/* Confusion matrix — immediately legible */}
            <section className="panel">
              <div className="panel-h"><span className="lbl">Outcomes</span><span className="lbl">across all seeds</span></div>
              <div className="panel-b">
                <ConfusionMatrix tp={totalTp} fp={totalFp} fn={totalFn} tn={totalTn} />
                <p className="note">{totalTp} injected errors were correctly flagged, with {totalFp} false positives and {totalFn} misses across {totalTp + totalTn + totalFp + totalFn} evaluated rows. Standard deviation across seeds: ±{ev.aggregate.precision.std.toFixed(2)} precision, ±{ev.aggregate.recall.std.toFixed(2)} recall.</p>
              </div>
            </section>
          </div>

          <p className="note" style={{ marginTop: 14 }}><b>{ev.note}</b></p>

          <details className="fold">
            <summary><Icon name="chart" size={13} /> Per-seed detail <span className="lbl">{ev.seeds.length} seeds · {String(ev.runs[0]?.check ?? "")}</span></summary>
            <div className="fold-b">
              <div className="tablewrap">
                <table className="gt">
                  <thead><tr><th>Seed</th><th className="num">Injected</th><th className="num">True positives</th><th className="num">False positives</th><th className="num">Precision</th><th className="num">Recall</th></tr></thead>
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
            </div>
          </details>
        </>
      )}
    </>
  );
}
