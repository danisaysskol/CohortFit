"use client";

import { useMemo } from "react";
import { Finding } from "../lib/api";
import { Sev } from "./charts";

const SEV_RANK: Record<Sev, number> = { green: 0, amber: 1, red: 2 };

// Issue coverage by source table (Track-2 §6 supporting measure): the same findings
// grouped by table, so a researcher sees where the data-quality risk concentrates for
// the tables their analysis actually touches.
export function CoverageByTable({ findings }: { findings: Finding[] }) {
  const byTable = useMemo(() => {
    const m = new Map<string, { table: string; n: number; worst: Sev }>();
    for (const f of findings) {
      const e = m.get(f.table) ?? { table: f.table, n: 0, worst: "green" as Sev };
      e.n += 1;
      if (SEV_RANK[f.severity as Sev] > SEV_RANK[e.worst]) e.worst = f.severity as Sev;
      m.set(f.table, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n || SEV_RANK[b.worst] - SEV_RANK[a.worst]);
  }, [findings]);
  const max = Math.max(1, ...byTable.map((t) => t.n));

  return (
    <section className="panel">
      <div className="panel-h"><span className="lbl">Issue coverage by table</span><span className="lbl">{byTable.length} tables</span></div>
      <div className="panel-b">
        <div className="cbt">
          {byTable.map((t) => (
            <div className="cbt-row" key={t.table}>
              <span className="cbt-name mono">{t.table}</span>
              <span className="cbt-bar"><span className={"cbt-fill " + t.worst} style={{ width: `${(100 * t.n) / max}%` }} /></span>
              <span className="cbt-n mono">{t.n}</span>
            </div>
          ))}
        </div>
        <p className="note">The same findings grouped by source table — so you can see where the data-quality risk concentrates for the tables your analysis uses.</p>
      </div>
    </section>
  );
}
