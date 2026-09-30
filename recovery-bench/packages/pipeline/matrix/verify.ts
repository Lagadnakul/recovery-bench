/**
 * THE ORACLE for step 6: no cell may go missing.
 *
 * Everything else in this step is machinery. This file is the claim.
 *
 * The defect the whole project was built against is a cell that was run, or
 * should have been run, and left no record — 8 of 24 planned cells silently
 * ceasing to exist (D2), and 22 real evaluations whose patches and logs survive
 * but which no table could see because the harness died before writing its
 * report (D15).
 *
 * The check is deliberately dumb, which is what makes it trustworthy:
 * re-enumerate the grid from the same config, read back every row, and compare
 * the two sets of keys. It shares no code with the sweep, so a bug in the
 * runner cannot hide itself here.
 */

import type { Config } from "../../core/config.ts";
import type { Task } from "../../core/types.ts";
import { cellKey } from "../../core/types.ts";
import { enumerateCells, type PlannedCell } from "./enumerate.ts";
import { readRows, SWEEP_ROWS, type SweepRecord } from "./store.ts";

export interface VerifyResult {
  /** Cells the grid says must exist. */
  planned: number;
  /** Rows actually written. */
  written: number;
  /** Planned cells with no row. The number that must be zero. */
  missing: string[];
  /** Rows whose key is not in the grid — a stale file or a config change. */
  unexpected: string[];
  /** Keys with more than one row. One cell, one outcome. */
  duplicates: string[];
  /** Unreadable lines in the row file. */
  skipped: number;
  /** Outcome kinds, counted. A sanity view of what actually happened. */
  byOutcome: Record<string, number>;
  /** Cells not comparable with Chapter 5, and why (D22). */
  notComparable: number;
  complete: boolean;
}

export async function verify(
  cfg: Config,
  tasks: Map<string, Task>,
  opts: { path?: string; arms?: string[] } = {},
): Promise<VerifyResult> {
  let planned: PlannedCell[] = enumerateCells(cfg, tasks);
  if (opts.arms && opts.arms.length > 0) {
    const want = new Set(opts.arms);
    planned = planned.filter((p) => want.has(p.arm));
  }

  const plannedKeys = new Set(planned.map((p) => cellKey(p.cell)));
  const { records, skipped, duplicates } = await readRows(opts.path ?? SWEEP_ROWS);

  // When verifying a subset of arms, rows from other arms are not "unexpected".
  const relevant: SweepRecord[] = opts.arms?.length
    ? records.filter((r) => opts.arms!.includes(r.arm))
    : records;

  const writtenKeys = new Set(relevant.map((r) => r.key));

  const missing = [...plannedKeys].filter((k) => !writtenKeys.has(k)).sort();
  const unexpected = [...writtenKeys].filter((k) => !plannedKeys.has(k)).sort();

  const byOutcome: Record<string, number> = {};
  let notComparable = 0;
  for (const r of relevant) {
    byOutcome[r.outcome.kind] = (byOutcome[r.outcome.kind] ?? 0) + 1;
    if (!r.comparableToChapter5) notComparable++;
  }

  return {
    planned: plannedKeys.size,
    written: writtenKeys.size,
    missing,
    unexpected,
    duplicates: [...new Set(duplicates)].sort(),
    skipped,
    byOutcome,
    notComparable,
    complete:
      missing.length === 0 && duplicates.length === 0 && skipped === 0,
  };
}

/** Human-readable report. Truncates the key lists; the counts are the claim. */
export function formatVerify(v: VerifyResult): string[] {
  const out: string[] = [];
  const show = (keys: string[], limit = 8) =>
    keys.slice(0, limit).map((k) => `    ${k}`).concat(
      keys.length > limit ? [`    … and ${keys.length - limit} more`] : [],
    );

  out.push(`planned  ${v.planned}`);
  out.push(`written  ${v.written}`);
  out.push("");

  if (v.missing.length > 0) {
    out.push(`MISSING  ${v.missing.length} cell(s) have no row:`);
    out.push(...show(v.missing));
    out.push("");
  }
  if (v.duplicates.length > 0) {
    out.push(`DUPLICATE  ${v.duplicates.length} key(s) have more than one row:`);
    out.push(...show(v.duplicates));
    out.push("");
  }
  if (v.unexpected.length > 0) {
    // Not a failure by itself: an arm may have been disabled since the rows
    // were written. Reported so the discrepancy is never silent.
    out.push(
      `note  ${v.unexpected.length} row(s) are not in the current grid ` +
        `(config changed, or a stale file):`,
    );
    out.push(...show(v.unexpected, 4));
    out.push("");
  }
  if (v.skipped > 0) {
    out.push(`unreadable  ${v.skipped} line(s) in the row file`);
    out.push("");
  }

  if (Object.keys(v.byOutcome).length > 0) {
    out.push("outcomes:");
    for (const [kind, n] of Object.entries(v.byOutcome).sort((a, b) => b[1] - a[1])) {
      out.push(`  ${kind.padEnd(16)} ${n}`);
    }
    out.push("");
    out.push(
      `  ${v.notComparable} row(s) are marked not comparable with Chapter 5 (D22)`,
    );
    out.push("");
  }

  out.push(
    v.complete
      ? "COMPLETE — every planned cell has exactly one row."
      : "INCOMPLETE — see above. A missing cell is the defect this project exists to prevent.",
  );
  return out;
}
