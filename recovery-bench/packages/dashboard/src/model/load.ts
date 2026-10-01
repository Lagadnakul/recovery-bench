/**
 * Fetching the data, and reporting honestly when some of it is not there.
 *
 * Every path is relative (`./data/...`) because the build must work from
 * `file://` (D11). A leading slash would break it on an examiner's machine.
 *
 * The one rule this module exists to enforce: **a missing file is a state, not
 * a zero.** `sweep_rows.jsonl` is gitignored, so a fresh clone legitimately has
 * none, and `present: false` travels with the dataset so the UI can say which
 * command fills it.
 */

import {
  fromReplay,
  fromSweep,
  type ReplayFile,
  type SweepRecord,
  type ViewRow,
} from "./rows.ts";

export interface Figures {
  note: string;
  fig5_1: {
    title: string;
    resolved: number;
    logic: number;
    format: number;
    pool: number;
    n: number;
  };
  fig5_2: {
    taskId: string;
    baseline: { f2pPassed: number; f2pTotal: number; p2pBroken: number };
    retrofitted: { f2pPassed: number; f2pTotal: number; p2pBroken: number };
    allIdentical: boolean;
  };
  fig5_3: {
    tasks: string[];
    conditions: string[];
    evaluatedCells: number;
    totalCells: number;
    resolvedCells: number;
  };
  headline: {
    baselineResolved: number;
    baselineN: number;
    baselinePct: number;
    poolSize: number;
    evaluable: number;
    excluded: string[];
    recovered: string[];
    logicTasks: string[];
    formatTasksEvaluable: string[];
    recoveredLogic: string[];
    recoveredFormat: string[];
    applyFailedCells: number;
  };
}

export interface AuditRow {
  file: string;
  instanceId: string;
  model: string;
  era: "unified_diff" | "search_replace";
  chars: number;
  hunks: number;
  files: string[];
  reasons: string[];
  details: string[];
}

export interface AuditFile {
  totals: {
    patches: number;
    by_era: Record<
      string,
      { patches: number; clean: number; cleanPct: number; patchesWithDefect: number }
    >;
  };
  rows: AuditRow[];
}

export interface Dataset {
  replay: ViewRow[];
  sweep: ViewRow[];
  figures: Figures;
  audit: AuditFile;
  /** False when `sweep_rows.jsonl` was absent at sync time. Not an error. */
  sweepPresent: boolean;
  /** Lines of the sweep file that would not parse. Shown, never swallowed. */
  sweepSkipped: number;
  syncedAt: string | null;
}

interface Manifest {
  syncedAt: string;
  files: { name: string; present: boolean; bytes: number | null; note: string }[];
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} — HTTP ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Parses JSONL, skipping and counting lines that will not parse.
 *
 * A torn final line is the expected result of killing a sweep mid-append, and
 * `RowStore` already treats it that way. The count is surfaced rather than
 * discarded, for the same reason the pipeline surfaces it: a silently shorter
 * dataset is worse than a visible defect.
 */
export function parseJsonl(text: string): { records: SweepRecord[]; skipped: number } {
  const records: SweepRecord[] = [];
  let skipped = 0;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t === "") continue;
    try {
      const rec = JSON.parse(t) as SweepRecord;
      if (typeof rec.key !== "string" || typeof rec.outcome?.kind !== "string") {
        skipped++;
        continue;
      }
      records.push(rec);
    } catch {
      skipped++;
    }
  }
  return { records, skipped };
}

export async function loadDataset(): Promise<Dataset> {
  let manifest: Manifest | null = null;
  try {
    manifest = await getJson<Manifest>("./data/manifest.json");
  } catch {
    // No manifest means `bun run sync` has not run. The required files below
    // will fail with their own message, which is more useful than this one.
  }

  const [replayFile, figures, audit] = await Promise.all([
    getJson<ReplayFile>("./data/replay_rows.json"),
    getJson<Figures>("./data/chapter5_figures.json"),
    getJson<AuditFile>("./data/legacy_patch_audit.json"),
  ]);

  const declared = manifest?.files.find((f) => f.name === "sweep_rows.jsonl");
  let sweep: ViewRow[] = [];
  let sweepSkipped = 0;
  let sweepPresent = declared?.present ?? false;

  if (sweepPresent) {
    try {
      const res = await fetch("./data/sweep_rows.jsonl");
      if (res.ok) {
        const { records, skipped } = parseJsonl(await res.text());
        sweep = records.map(fromSweep);
        sweepSkipped = skipped;
      } else {
        sweepPresent = false;
      }
    } catch {
      sweepPresent = false;
    }
  }

  return {
    replay: replayFile.rows.map(fromReplay),
    sweep,
    figures,
    audit,
    sweepPresent,
    sweepSkipped,
    syncedAt: manifest?.syncedAt ?? null,
  };
}
