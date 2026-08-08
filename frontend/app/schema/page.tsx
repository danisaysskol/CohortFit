"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, TableInfo } from "../lib/api";
import { Erd } from "./Erd";
import { DataTable } from "../components/DataTable";
import { FilterBar } from "../components/FilterBar";
import {
  ExploreParams,
  ExplorePage,
  toColumnMeta,
  useTableExplorer,
} from "../components/useTableExplorer";

const PAGE = 25;

export default function SchemaPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tq, setTq] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .schema()
      .then((d) => {
        setTables(d.tables);
        if (d.tables.length) setSel(d.tables[0].table);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  const info = tables.find((t) => t.table === sel);
  const columns = useMemo(() => toColumnMeta(info?.columns ?? []), [info]);
  const columnsByTable = useMemo(
    () => Object.fromEntries(tables.map((t) => [t.table, t.columns])),
    [tables]
  );

  // The Schema page's only backend-specific glue: map the generic explorer params onto
  // api.explore's string query. Everything richer is built on top of this single contract.
  const fetcher = useCallback(
    async (params: ExploreParams): Promise<ExplorePage> => {
      if (!sel) return { columns: [], rows: [], total: 0 };
      const q: Record<string, string> = { limit: String(params.limit), offset: String(params.offset) };
      if (params.col && params.op && params.val !== undefined) {
        q.col = params.col;
        q.op = params.op;
        q.val = params.val;
      }
      if (params.search) q.search = params.search;
      const r = await api.explore(sel, q);
      return { columns: r.columns, rows: r.rows, total: r.total };
    },
    [sel]
  );

  const ex = useTableExplorer({ columns, fetcher, pageSize: PAGE, resetKey: sel ?? "" });

  const filteredTables = useMemo(
    () => tables.filter((t) => t.table.toLowerCase().includes(tq.toLowerCase())),
    [tables, tq]
  );

  const from = ex.total ? ex.offset + 1 : 0;
  const to = Math.min(ex.offset + PAGE, ex.total);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Schema explorer</h1>
          <p>The relational map of the demo, and a live data explorer — pick a table, stack filters on any column, search across all of them, sort, and page through real rows.</p>
        </div>
      </div>

      {err && !tables.length && (
        <div className="abstain"><span className="k">Error</span> — {err}. Is the backend running on :8000?</div>
      )}

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-h">
          <span className="lbl">Schema map</span>
          <span className="lbl">patient → admission → ICU stay</span>
        </div>
        <div className="panel-b"><Erd columnsByTable={columnsByTable} onSelect={setSel} selected={sel} /></div>
      </section>

      <div className="grid2" style={{ gridTemplateColumns: "260px 1fr" }}>
        <section className="panel">
          <div className="panel-h"><span className="lbl">Tables · {filteredTables.length}</span></div>
          <div className="panel-b">
            <input
              className="search"
              style={{ width: "100%", marginBottom: 10 }}
              placeholder="Filter tables…"
              value={tq}
              onChange={(e) => setTq(e.target.value)}
              aria-label="Filter tables"
            />
            <div className="tablelist">
              {filteredTables.map((t) => (
                <button key={t.table} className={t.table === sel ? "active" : ""} onClick={() => setSel(t.table)}>
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
            <span className="lbl">
              {ex.total.toLocaleString()} row{ex.total === 1 ? "" : "s"} match
              {ex.hasClientRefinement && <> · {ex.rows.length} on page after refine</>}
            </span>
          </div>
          <div className="panel-b">
            {info && (
              <div className="chips" style={{ marginTop: 0, marginBottom: 12 }}>
                {info.join_keys.map((k) => <span key={k} className="chip">key · <b>{k}</b></span>)}
                {info.timestamps.map((k) => <span key={k} className="chip">time · <b>{k}</b></span>)}
              </div>
            )}

            <FilterBar
              columns={ex.columns}
              filters={ex.filters}
              onAdd={ex.addFilter}
              onRemove={ex.removeFilter}
              onClear={ex.clearFilters}
              search={ex.search}
              onSearchChange={ex.setSearch}
              onSearchCommit={ex.commitSearch}
            />

            {ex.error ? (
              <div className="abstain" style={{ marginTop: 12 }}>
                <span className="k">Error</span> — {ex.error}
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <DataTable
                  columns={ex.columns}
                  rows={ex.rows}
                  sort={ex.sort}
                  onSort={ex.toggleSort}
                  loading={ex.loading}
                />
              </div>
            )}

            <div className="dt-foot">
              <span className="lbl">
                {ex.total ? <>rows {from.toLocaleString()}–{to.toLocaleString()} of {ex.total.toLocaleString()}</> : "no rows"}
                {ex.hasClientRefinement && <> · {ex.rows.length} shown after page refine</>}
              </span>
              <span className="dt-pager">
                <button className="btn btn-ghost" onClick={ex.prev} disabled={!ex.canPrev}>Prev</button>
                <button className="btn btn-ghost" onClick={ex.next} disabled={!ex.canNext}>Next</button>
              </span>
            </div>

            <p className="note">
              The first column filter and the search run server-side and drive the match count; extra
              filters refine the current page (tagged <b>on page</b>) and sorting orders the page you
              are viewing. Rows are served to this local UI only — the AI cohort/quality paths receive
              schema + aggregates by default, not raw rows.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
