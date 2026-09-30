/**
 * Where sweep results are written.
 *
 * Append-only JSONL, one row per cell, flushed per cell rather than batched.
 * Three properties follow from that choice and all three are the point:
 *
 *   **Resumable.** A sweep of 1,224 cells at ~135 seconds each runs for hours.
 *   It must survive being stopped and restarted without re-spending, which
 *   means completed cells are read back and skipped.
 *
 *   **Crash-safe.** A kill mid-sweep loses at most the in-flight cell. A torn
 *   final line — the expected result of dying mid-append — is skipped and
 *   counted rather than being fatal, exactly as the budget ledger does.
 *
 *   **Auditable.** Rows accumulate in the order they were produced, so the
 *   file is a log of what happened rather than a snapshot of what survived.
 *
 * The prompt is NOT written: it is reconstructible from the template plus the
 * cached file, and storing it would duplicate both.
 *
 * The **response is** written, and that is a correction. It was left out at
 * first as audit-only bulk — but a later round is shown the earlier round's
 * response verbatim, so it is required *input*, not a record. Without it a
 * resumed sweep could not build round 1's prompt without re-running and
 * re-paying for round 0. It also makes the file far more useful: what the model
 * actually said is the thing a reader most wants to see.
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Outcome, Row, Usage } from "../../core/types.ts";
import { cellKey, type Cell } from "../../core/types.ts";
import type { CellOutcome } from "../strategies/types.ts";

export const SWEEP_ROWS = "data/sweep_rows.jsonl";

/**
 * One completed cell.
 *
 * `Row<"apply">` plus the step-5 provenance fields, flattened one level so the
 * file is readable with `jq` without nested lookups.
 */
export interface SweepRecord {
  /** `cellKey()` — the unique identity used for resume and for the no-holes check. */
  key: string;
  arm: string;
  runId: string;
  timestamp: string;
  cell: Cell;
  verification: "apply";
  outcome: Outcome;
  usage: Usage | null;
  /** Which evidence a Diagnose+Revise cell received (D22). */
  evidenceSource: "archived_test" | "apply_error" | "none";
  /** False when this cell must not be pooled with Chapter 5's equivalent. */
  comparableToChapter5: boolean;
  /** Whether the response contained the reasoning section its condition demanded. */
  honouredCondition: boolean;
  /** The patch, when one was produced. Small, and the evidence for the outcome. */
  patch: string | null;
  /**
   * The model's raw response.
   *
   * Required, not optional: a later round is shown this verbatim, so a resumed
   * sweep reads it back rather than re-paying for the earlier round.
   */
  response: string;
}

export function toRecord(arm: string, out: CellOutcome): SweepRecord {
  return {
    key: cellKey(out.row.cell),
    arm,
    runId: out.row.runId,
    timestamp: out.row.timestamp,
    cell: out.row.cell,
    verification: "apply",
    outcome: out.row.outcome,
    usage: out.row.usage,
    evidenceSource: out.evidenceSource,
    comparableToChapter5: out.comparableToChapter5,
    honouredCondition: out.honouredCondition,
    patch: out.patch,
    response: out.response,
  };
}

/** Rebuilds a `Row<"apply">` from a record, for the analysis layer. */
export function toRow(rec: SweepRecord): Row<"apply"> {
  return {
    cell: rec.cell,
    verification: "apply",
    outcome: rec.outcome,
    resolved: null,
    tests: null,
    usage: rec.usage,
    runId: rec.runId,
    timestamp: rec.timestamp,
  };
}

export interface LoadedRows {
  records: SweepRecord[];
  /** Keys already completed — what resume skips. */
  done: Set<string>;
  /** Malformed lines, counted so a torn file is visible rather than assumed. */
  skipped: number;
  /** Keys appearing more than once. Should always be empty; checked, not assumed. */
  duplicates: string[];
}

export class RowStore {
  private done = new Set<string>();
  private byKey = new Map<string, SweepRecord>();

  private constructor(
    readonly path: string,
    private readonly records: SweepRecord[],
  ) {
    for (const r of records) {
      this.done.add(r.key);
      this.byKey.set(r.key, r);
    }
  }

  static async open(path = SWEEP_ROWS): Promise<{ store: RowStore; loaded: LoadedRows }> {
    const loaded = await readRows(path);
    return { store: new RowStore(path, loaded.records), loaded };
  }

  /** True when this cell already has a row and must not be run again. */
  has(cell: Cell): boolean {
    return this.done.has(cellKey(cell));
  }

  /** The stored row for a cell, so a resumed run can rebuild its history. */
  get(cell: Cell): SweepRecord | undefined {
    return this.byKey.get(cellKey(cell));
  }

  get completed(): number {
    return this.done.size;
  }

  /**
   * Appends one row and marks the cell done.
   *
   * Awaited per cell. Batching would be faster and would lose more on a crash;
   * at ~135 seconds per cell the write is not the bottleneck, so the safer
   * trade is free.
   */
  async append(arm: string, out: CellOutcome): Promise<SweepRecord> {
    const rec = toRecord(arm, out);
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(rec)}\n`, "utf8");
    this.records.push(rec);
    this.done.add(rec.key);
    this.byKey.set(rec.key, rec);
    return rec;
  }

  all(): readonly SweepRecord[] {
    return this.records;
  }
}

export async function readRows(path = SWEEP_ROWS): Promise<LoadedRows> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return { records: [], done: new Set(), skipped: 0, duplicates: [] };
  }

  const records: SweepRecord[] = [];
  const seen = new Set<string>();
  const duplicates: string[] = [];
  let skipped = 0;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    let rec: SweepRecord;
    try {
      rec = JSON.parse(trimmed) as SweepRecord;
    } catch {
      skipped++;
      continue;
    }
    if (typeof rec.key !== "string" || typeof rec.outcome?.kind !== "string") {
      skipped++;
      continue;
    }
    if (seen.has(rec.key)) duplicates.push(rec.key);
    seen.add(rec.key);
    records.push(rec);
  }

  return { records, done: seen, skipped, duplicates };
}
