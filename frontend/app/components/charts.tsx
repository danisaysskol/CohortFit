"use client";

// Lightweight, dependency-free chart primitives for the Quality and Evaluation
// dashboards. Status colours (red/amber/green) always ship with a label — never
// colour alone. Comparison bars carry a legend + direct value labels. All within
// the Lab Ledger design system.

export type Sev = "red" | "amber" | "green";
const SEV_VAR: Record<Sev, string> = { red: "var(--danger)", amber: "var(--warn)", green: "var(--ok)" };
const SEV_WORD: Record<Sev, string> = { red: "Critical", amber: "Caution", green: "Clean" };

export function Verdict({ severity, title, sub }: { severity: Sev; title: string; sub: string }) {
  return (
    <div className="verdict" style={{ borderLeftColor: SEV_VAR[severity] }}>
      <span className="verdict-dot" style={{ background: SEV_VAR[severity] }} />
      <div>
        <div className="verdict-t" style={{ color: SEV_VAR[severity] }}>{title}</div>
        <div className="verdict-s">{sub}</div>
      </div>
    </div>
  );
}

export function StatTile({ value, label, meaning }: { value: string; label: string; meaning?: string }) {
  return (
    <div className="stile">
      <div className="stile-v">{value}</div>
      <div className="stile-l">{label}</div>
      {meaning && <div className="stile-m">{meaning}</div>}
    </div>
  );
}

export function DimTile({ dimension, severity, detail }: { dimension: string; severity: Sev; detail: string }) {
  return (
    <div className="dtile" title={`${dimension}: ${SEV_WORD[severity]} — ${detail}`}>
      <span className="dtile-stripe" style={{ background: SEV_VAR[severity] }} />
      <div className="dtile-d">{dimension}</div>
      <div className="dtile-s" style={{ color: SEV_VAR[severity] }}>● {SEV_WORD[severity]}</div>
      <div className="dtile-x">{detail}</div>
    </div>
  );
}

export function SeverityBar({ red, amber, green }: { red: number; amber: number; green: number }) {
  const seg = (n: number, sev: Sev, label: string) =>
    n > 0 ? <div className="sevseg" style={{ flexGrow: n, background: SEV_VAR[sev] }} title={`${label}: ${n}`} /> : null;
  return (
    <div>
      <div className="sevbar" role="img" aria-label={`${red} critical, ${amber} caution, ${green} clean`}>
        {seg(red, "red", "Critical")}
        {seg(amber, "amber", "Caution")}
        {seg(green, "green", "Clean")}
      </div>
      <div className="sevlegend">
        <span><i style={{ background: SEV_VAR.red }} />{red} data errors</span>
        <span><i style={{ background: SEV_VAR.amber }} />{amber} cautions</span>
        <span><i style={{ background: SEV_VAR.green }} />{green} clean checks</span>
      </div>
    </div>
  );
}

/** Grouped horizontal bars comparing CohortFit against a fixed-rule baseline (0–1 scale). */
export function CompareBars({ rows }: { rows: { metric: string; ours: number; baseline: number; higherIsBetter?: boolean }[] }) {
  return (
    <div className="cbars">
      <div className="cbars-legend">
        <span><i style={{ background: "var(--accent)" }} />CohortFit</span>
        <span><i style={{ background: "var(--faint)" }} />Fixed-rule baseline</span>
      </div>
      {rows.map((r) => (
        <div className="cbar-row" key={r.metric}>
          <div className="cbar-label">{r.metric}</div>
          <div className="cbar-tracks">
            <div className="cbar-track">
              <div className="cbar-fill" style={{ width: `${Math.max(2, r.ours * 100)}%`, background: "var(--accent)" }} />
              <span className="cbar-val">{r.ours.toFixed(2)}</span>
            </div>
            <div className="cbar-track">
              <div className="cbar-fill" style={{ width: `${Math.max(2, r.baseline * 100)}%`, background: "var(--faint)" }} />
              <span className="cbar-val muted">{r.baseline.toFixed(2)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** 2×2 confusion matrix. TP is good (green), FP/FN are errors (red-tinted), TN neutral. */
export function ConfusionMatrix({ tp, fp, fn, tn }: { tp: number; fp: number; fn: number; tn: number }) {
  const Cell = ({ n, label, tone }: { n: number; label: string; tone: "good" | "bad" | "neutral" }) => (
    <div className={"cm-cell cm-" + tone} title={`${label}: ${n}`}>
      <div className="cm-n">{n}</div>
      <div className="cm-l">{label}</div>
    </div>
  );
  return (
    <div className="cm">
      <div className="cm-corner" />
      <div className="cm-colh">Flagged by rule</div>
      <div className="cm-colh">Not flagged</div>
      <div className="cm-rowh">Injected error</div>
      <Cell n={tp} label="True positive" tone="good" />
      <Cell n={fn} label="False negative" tone="bad" />
      <div className="cm-rowh">Clean row</div>
      <Cell n={fp} label="False positive" tone="bad" />
      <Cell n={tn} label="True negative" tone="neutral" />
    </div>
  );
}
