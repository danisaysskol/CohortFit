// Thin client to the CohortFit backend. Base URL is configurable so the same build
// runs locally and in Docker. The browser calls the host-mapped backend port.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// The demo dataset is frozen, so every GET is deterministic. We cache responses
// in sessionStorage keyed by path, making repeat visits to a page instant (no
// refetch) — the network round-trip happens once per browser session.
async function get<T>(path: string): Promise<T> {
  const key = `cf:${path}`;
  try {
    const hit = sessionStorage.getItem(key);
    if (hit) return JSON.parse(hit) as T;
  } catch { /* sessionStorage unavailable (SSR / private mode) — fall through */ }
  const r = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  const data = (await r.json()) as T;
  try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* quota/unavailable */ }
  return data;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

export type TimelineEvent = { time: string; kind: string; label: string; source: { table: string; id: string } };
export type PatientTimeline = {
  subject_id: number; gender: string; age: number; labs: number; meds: number;
  diagnoses: string[]; events: TimelineEvent[];
};
export type Column = { name: string; type: string };
export type ExploreResult = {
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
};
export type ForeignKey = { col: string; ref: string };
export type TableInfo = {
  table: string;
  module: string;
  rows: number;
  columns: Column[];
  join_keys: string[];
  timestamps: string[];
  pk: string[];
  fk: ForeignKey[];
};
export type FunnelStep = { criterion: string; source: string; remaining: number; delta: number | null };
export type Disposition = "cohort" | "clarify" | "refuse" | "abstain";
export type CohortResult = {
  method: string;
  disposition?: Disposition;
  ir: unknown;
  sql?: string;
  funnel?: FunnelStep[];
  subject_ids?: string[];
  patients?: Record<string, unknown>[];
  n?: number;
  answerable: boolean;
  abstain_reason?: string;
  confidence?: number;
};
export type Finding = {
  dimension: string;
  severity: "red" | "amber" | "green";
  table: string;
  detail: string;
  count: number;
  kind: "data_error" | "real_finding" | "caveat";
  ref: string;
  id: string;
  drillable: boolean;
};
export type FindingRows = {
  finding: Finding;
  ref: string;
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  shown: number;
  limit: number;
};
export type ScoreSummary = {
  issues_found: number;
  findings_total: number;
  assumed_minutes_per_issue: number;
  reviewer_minutes_saved_estimate: number;
  note: string;
};
export type Scorecard = {
  dimensions: { dimension: string; severity: "red" | "amber" | "green" }[];
  findings: Finding[];
  summary: ScoreSummary;
};
export type CohortScorecard = Scorecard & { n_patients: number; scoped: boolean };
export type Vital = {
  itemid: number; label: string; coverage_pct: number; stays_with: number; stays_total: number;
  n: number; units: string[]; unit_variation: boolean;
  min: number | null; max: number | null; mean: number | null;
  plausible: [number, number] | null; out_of_range: number | null;
};
export type LabMeasure = {
  itemid: number; label: string; n: number; units: string[]; unit_variation: boolean;
  min: number | null; max: number | null; mean: number | null;
};
export type Coding = { icd9: number; icd10: number; total: number; top: { code: string; version: number; title: string; n: number }[] };
export type Measurements = {
  n_patients: number; n_stays: number; n_admissions: number;
  vitals: Vital[]; labs: LabMeasure[]; coding: Coding; scoped: boolean;
};

export type AggStat = { mean: number; std: number; min: number; max: number };
export type EvalResult = {
  seeds: number[];
  runs: Record<string, number | string>[];
  aggregate: Record<"precision" | "recall" | "f1" | "false_positive_rate", AggStat>;
  baseline: { strategy: string; precision: number; recall: number; false_positive_rate: number };
  note: string;
};

export type Fix = {
  id: string;
  table: string;
  ref: string;
  title: string;
  detail: string;
  rule: string;
  reverse: string;
  affected: number;
  reversible: boolean;
};

// Streams the live build steps (Server-Sent Events) so the UI can show the work as it happens.
export async function streamCohort(text: string, onEvent: (ev: Record<string, unknown>) => void): Promise<void> {
  const r = await fetch(`${BASE}/cohort/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!r.ok || !r.body) throw new Error(`stream → ${r.status}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 2);
      if (line.startsWith("data:")) onEvent(JSON.parse(line.slice(5).trim()));
    }
  }
}

export const api = {
  health: () => get<{ status: string; tables: number }>("/health"),
  schema: () => get<{ tables: TableInfo[] }>("/schema"),
  table: (t: string, limit = 25) =>
    get<{ table: string; columns: string[]; rows: Record<string, unknown>[] }>(`/schema/${t}?limit=${limit}`),
  explore: (t: string, params: Record<string, string>) =>
    get<ExploreResult>(`/explore/${t}?${new URLSearchParams(params).toString()}`),
  buildCohort: (text: string) => post<CohortResult>("/cohort/build", { text }),
  patientTimeline: (id: string | number) => get<PatientTimeline>(`/patient/${id}/timeline`),
  scorecard: () => get<Scorecard>("/quality/scorecard"),
  findingRows: (id: string, limit = 50) => get<FindingRows>(`/quality/finding/${encodeURIComponent(id)}/rows?limit=${limit}`),
  cohortQuality: (subject_ids: number[]) => post<CohortScorecard>("/cohort/quality", { subject_ids }),
  cohortFindingRows: (subject_ids: number[], finding_id: string, limit = 50) =>
    post<FindingRows>("/cohort/quality/rows", { subject_ids, finding_id, limit }),
  cohortMeasurements: (subject_ids: number[]) => post<Measurements>("/cohort/measurements", { subject_ids }),
  fixes: () => get<{ fixes: Fix[]; note: string }>("/quality/fixes"),
  runEval: () => get<EvalResult>("/eval/run"),
};
