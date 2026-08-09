"use client";

import { useEffect, useState } from "react";
import { api, Fix } from "../lib/api";

type Planned = { id: string; title: string; rule: string; reverse: string; addedAt: string };
const STORE = "cohortfit:fix-plan";

export function FixLedger() {
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [planned, setPlanned] = useState<Planned[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    api.fixes().then((d) => {
      setFixes(d.fixes);
      setNote(d.note);
    }).catch(() => {});
    try {
      const saved = localStorage.getItem(STORE);
      if (saved) setPlanned(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  function persist(next: Planned[]) {
    setPlanned(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  // Add a proposed fix to a local, browser-side review plan. This does NOT apply the fix
  // or touch any data — it just records the transform you intend to run in your own pipeline.
  function addToPlan(f: Fix) {
    if (planned.some((a) => a.id === f.id)) return;
    persist([
      ...planned,
      { id: f.id, title: f.title, rule: f.rule, reverse: f.reverse, addedAt: new Date().toISOString().slice(0, 19).replace("T", " ") },
    ]);
  }

  function remove(id: string) {
    persist(planned.filter((a) => a.id !== id));
  }

  const isPlanned = (id: string) => planned.some((a) => a.id === id);

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-h">
        <span className="lbl">Proposed reversible fixes</span>
        <span className="lbl">nothing applied · source never modified</span>
      </div>
      <div className="panel-b">
        {fixes.map((f) => (
          <div className="flag" key={f.id} style={{ borderTop: "1px solid var(--line)" }}>
            <span className={"sq " + (f.reversible ? "amber" : "green")} />
            <span>
              <div className="t1">{f.title} · <span className="muted">{f.affected} row(s)</span></div>
              <div className="t2">{f.table} · {f.ref} · rule: {f.rule}</div>
            </span>
            {f.reversible ? (
              isPlanned(f.id) ? (
                <button className="btn btn-ghost" onClick={() => remove(f.id)}>Remove</button>
              ) : (
                <button className="btn" onClick={() => addToPlan(f)}>Add to plan</button>
              )
            ) : (
              <span className="pill caveat">Review only</span>
            )}
          </div>
        ))}

        {planned.length > 0 && (
          <>
            <div className="lbl" style={{ marginTop: 14, marginBottom: 6 }}>Local review plan · {planned.length} <span className="muted">(saved in this browser only — not applied)</span></div>
            <div className="tablewrap">
              <table className="gt">
                <thead><tr><th>Added at</th><th>Fix</th><th>Forward</th><th>Reverse</th></tr></thead>
                <tbody>
                  {planned.map((a) => (
                    <tr key={a.id}>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>{a.addedAt}</td>
                      <td>{a.title}</td>
                      <td className="mono" style={{ fontSize: 11 }}>{a.rule}</td>
                      <td className="mono" style={{ fontSize: 11 }}>{a.reverse || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="note"><b>{note}</b></p>
      </div>
    </section>
  );
}
