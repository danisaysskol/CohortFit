"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ExploreResult, TableInfo } from "../lib/api";
import { Erd } from "./Erd";

const OPS = ["contains", "=", "!=", ">", ">=", "<", "<="];
const PAGE = 25;

export default function SchemaPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tq, setTq] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [col, setCol] = useState("");
  const [op, setOp] = useState("contains");
  const [val, setVal] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [res, setRes] = useState<ExploreResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.schema().then((d) => {
      setTables(d.tables);
      if (d.tables.length) choose(d.tables[0].table);
    }).catch((e) => setErr(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (table: string, off: number) => {
    const params: Record<string, string> = { limit: String(PAGE), offset: String(off) };
    if (col && val) { params.col = col; params.op = op; params.val = val; }
    if (search) params.search = search;
    try {
      setRes(await api.explore(table, params));
    } catch (e) {
      setErr(String(e));
    }
  }, [col, op, val, search]);

  function choose(table: string) {
    setSel(table);
    setCol(""); setVal(""); setSearch(""); setOffset(0); setRes(null);
    load(table, 0);
  }

  function applyFilters() {
    setOffset(0);
    if (sel) load(sel, 0);
  }

  function page(delta: number) {
    if (!sel || !res) return;
    const next = Math.max(0, offset + delta * PAGE);
    if (next >= res.total) return;
    setOffset(next);
    load(sel, next);
  }

  const filtered = useMemo(
    () => tables.filter((t) => t.table.toLowerCase().includes(tq.toLowerCase())),
    [tables, tq]
  );
  const info = tables.find((t) => t.table === sel);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Schema explorer</h1>
          <p>The relational map of the demo, and a live data explorer — pick a table, filter by any column, search, and page through real rows.</p>
        </div>
      </div>

      {err && !tables.length && <div className="abstain"><span className="k">Error</span> — {err}. Is the backend running on :8000?</div>}

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-h"><span className="lbl">Schema map</span><span className="lbl">patient → admission → ICU stay</span></div>
        <div className="panel-b"><Erd /></div>
      </section>

      <div className="grid2" style={{ gridTemplateColumns: "260px 1fr" }}>
        <section className="panel">
          <div className="panel-h"><span className="lbl">Tables · {filtered.length}</span></div>
          <div className="panel-b">
            <input className="search" style={{ width: "100%", marginBottom: 10 }} placeholder="Filter tables…" value={tq} onChange={(e) => setTq(e.target.value)} aria-label="Filter tables" />
            <div className="tablelist">
              {filtered.map((t) => (
                <button key={t.table} className={t.table === sel ? "active" : ""} onClick={() => choose(t.table)}>
                  <span>{t.table} <span className="md">{t.module}</span></span>
                  <span className="rc">{t.rows.toLocaleString()}</span>
                </button>
              ))}
              {!tables.length && !err && <div className="loading">Loading…</div>}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-h">
            <span className="lbl">{sel || "—"}</span>
            {res && <span className="lbl">{res.total.toLocaleString()} rows match</span>}
          </div>
          <div className="panel-b">
            {info && (
              <div className="chips" style={{ marginTop: 0, marginBottom: 12 }}>
                {info.join_keys.map((k) => <span key={k} className="chip">key · <b>{k}</b></span>)}
                {info.timestamps.map((k) => <span key={k} className="chip">time · <b>{k}</b></span>)}
              </div>
            )}

            {/* filter bar */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <select value={col} onChange={(e) => setCol(e.target.value)} aria-label="Filter column">
                <option value="">— column —</option>
                {info?.columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <select value={op} onChange={(e) => setOp(e.target.value)} aria-label="Operator" style={{ width: 110 }}>
                {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <input className="search" style={{ width: 140 }} placeholder="value" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyFilters()} aria-label="Filter value" />
              <input className="search" style={{ width: 160 }} placeholder="search all columns" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyFilters()} aria-label="Search" />
              <button className="btn" onClick={applyFilters}>Apply</button>
            </div>

            {!res && <div className="loading">Loading rows…</div>}
            {res && (
              <>
                <div className="tablewrap">
                  <table className="gt">
                    <thead><tr>{res.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {res.rows.map((row, i) => (
                        <tr key={i}>
                          {res.columns.map((c) => (
                            <td key={c} className="mono" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                              {row[c] === null || row[c] === "" ? <span className="muted">·</span> : String(row[c]).slice(0, 40)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {res.rows.length === 0 && <tr><td colSpan={res.columns.length} className="muted">No rows match this filter.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <span className="lbl">rows {res.total ? offset + 1 : 0}–{Math.min(offset + PAGE, res.total)} of {res.total.toLocaleString()}</span>
                  <span style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" onClick={() => page(-1)} disabled={offset === 0}>Prev</button>
                    <button className="btn btn-ghost" onClick={() => page(1)} disabled={offset + PAGE >= res.total}>Next</button>
                  </span>
                </div>
              </>
            )}
            <p className="note">Rows are served to this local UI only. The AI cohort/quality paths receive schema + aggregates by default, not raw rows.</p>
          </div>
        </section>
      </div>
    </>
  );
}
