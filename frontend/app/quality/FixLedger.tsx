"use client";

import { useEffect, useState } from "react";
import { api, Fix } from "../lib/api";

type Applied = { id: string; title: string; rule: string; reverse: string; appliedAt: string };
const STORE = "cohortfit:fix-ledger";

export function FixLedger() {
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [applied, setApplied] = useState<Applied[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    api.fixes().then((d) => {
      setFixes(d.fixes);
      setNote(d.note);
    }).catch(() => {});
    try {
      const saved = localStorage.getItem(STORE);
      if (saved) setApplied(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  function persist(next: Applied[]) {
    setApplied(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function apply(f: Fix) {
    if (applied.some((a) => a.id === f.id)) return;
    persist([
      ...applied,
      { id: f.id, title: f.title, rule: f.rule, reverse: f.reverse, appliedAt: new Date().toISOString().slice(0, 19).replace("T", " ") },
    ]);
  }

  function undo(id: string) {
    persist(applied.filter((a) => a.id !== id));
  }

  const isApplied = (id: string) => applied.some((a) => a.id === id);

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-h">
        <span className="lbl">Reversible fixes</span>
        <span className="lbl">source never modified</span>
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
              isApplied(f.id) ? (
                <button className="btn btn-ghost" onClick={() => undo(f.id)}>Undo</button>
              ) : (
                <button className="btn" onClick={() => apply(f)}>Apply &amp; log</button>
              )
            ) : (
              <span className="pill caveat">Review only</span>
            )}
          </div>
        ))}

        {applied.length > 0 && (
          <>
            <div className="lbl" style={{ marginTop: 14, marginBottom: 6 }}>Fix ledger · {applied.length}</div>
            <div className="tablewrap">
              <table className="gt">
                <thead><tr><th>Applied at</th><th>Fix</th><th>Forward</th><th>Reverse</th></tr></thead>
                <tbody>
                  {applied.map((a) => (
                    <tr key={a.id}>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>{a.appliedAt}</td>
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
