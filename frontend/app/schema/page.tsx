"use client";

import { useEffect, useMemo, useState } from "react";
import { api, TableInfo } from "../lib/api";

export default function SchemaPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [sample, setSample] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.schema().then((d) => {
      setTables(d.tables);
      if (d.tables.length) pick(d.tables[0].table);
    }).catch((e) => setErr(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(t: string) {
    setSel(t);
    setSample(null);
    try {
      const d = await api.table(t, 25);
      setSample({ columns: d.columns, rows: d.rows });
    } catch (e) {
      setErr(String(e));
    }
  }

  const filtered = useMemo(
    () => tables.filter((t) => t.table.toLowerCase().includes(q.toLowerCase())),
    [tables, q]
  );
  const info = tables.find((t) => t.table === sel);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Schema explorer</h1>
          <p>Every table in the frozen demo: row counts, columns, join keys, and timestamps — with a live sample. Search to filter; click a table to inspect it.</p>
        </div>
        <input className="search" placeholder="Filter tables…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter tables" />
      </div>

      {err && !tables.length && <div className="abstain"><span className="k">Error</span> — {err}. Is the backend running on :8000?</div>}

      <div className="grid2" style={{ gridTemplateColumns: "300px 1fr" }}>
        <section className="panel">
          <div className="panel-h"><span className="lbl">Tables · {filtered.length}</span></div>
          <div className="panel-b">
            <div className="tablelist">
              {filtered.map((t) => (
                <button key={t.table} className={t.table === sel ? "active" : ""} onClick={() => pick(t.table)}>
                  <span>{t.table} <span className="md">{t.module}</span></span>
                  <span className="rc">{t.rows.toLocaleString()}</span>
                </button>
              ))}
              {!tables.length && !err && <div className="loading">Loading schema…</div>}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-h">
            <span className="lbl">{sel || "—"}</span>
            {info && <span className="lbl">{info.rows.toLocaleString()} rows · {info.columns.length} cols</span>}
          </div>
          <div className="panel-b">
            {info && (
              <div className="chips" style={{ marginTop: 0, marginBottom: 12 }}>
                {info.join_keys.map((k) => <span key={k} className="chip">key · <b>{k}</b></span>)}
                {info.timestamps.map((k) => <span key={k} className="chip">time · <b>{k}</b></span>)}
              </div>
            )}
            {!sample && <div className="loading">Select a table…</div>}
            {sample && (
              <div className="tablewrap">
                <table className="gt">
                  <thead>
                    <tr>{sample.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {sample.rows.map((row, i) => (
                      <tr key={i}>
                        {sample.columns.map((c) => (
                          <td key={c} className="mono" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                            {row[c] === null || row[c] === "" ? <span className="muted">·</span> : String(row[c]).slice(0, 40)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="note">Sample rows are served to this local UI only. The AI cohort/quality paths receive schema + aggregates by default, not raw rows.</p>
          </div>
        </section>
      </div>
    </>
  );
}
