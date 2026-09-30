/**
 * Every headline quantity in Chapter 5, as a function over rows.
 *
 * Each of these is currently a literal somewhere — in `build_master_table.py`'s
 * output strings, or typed into a draw.io segment in `make_figures.py`
 * (`("Resolved&#xa;12", 12, ...)`). Computing them is what makes the chapter
 * checkable rather than merely consistent with itself.
 *
 * The functions take `ArchiveRow[]` and narrow internally. Resolve-rate style
 * questions are answered only from test-verified rows — not by convention, but
 * because `resolved` is typed `null` on everything else.
 */

import type { Row } from "@rb/core";
import type { ArchiveRow } from "./load.ts";
import { BASELINE_RUN, BASELINE_N, CONDITIONS, type ConditionName, type RoundId } from "./runs.ts";
import { deriveFailureClasses, evaluableTasks, excludedTasks, recoveredTasks } from "./classify.ts";

/** Test-verified rows only — the 42 records `build_master_table.py` sees. */
export function evaluated(rows: ArchiveRow[]): ArchiveRow[] {
  return rows.filter((r) => r.row.verification === "test");
}

/** Baseline cells that produced a test result (16 of the 20 pilot tasks). */
export function baselineEvaluated(rows: ArchiveRow[]): ArchiveRow[] {
  return evaluated(rows).filter((r) => r.run === BASELINE_RUN);
}

/** Baseline cells whose patch never applied (the other 4). */
export function baselineApplyFailed(rows: ArchiveRow[]): ArchiveRow[] {
  return rows.filter((r) => r.run === BASELINE_RUN && r.row.verification === "apply");
}

function isResolved(r: ArchiveRow): boolean {
  return r.row.verification === "test" && (r.row as Row<"test">).resolved;
}

export function baselineResolved(rows: ArchiveRow[]): string[] {
  return baselineEvaluated(rows)
    .filter(isResolved)
    .map((r) => r.row.cell.taskId)
    .sort();
}

export function baselineUnresolved(rows: ArchiveRow[]): string[] {
  return baselineEvaluated(rows)
    .filter((r) => !isResolved(r))
    .map((r) => r.row.cell.taskId)
    .sort();
}

/**
 * Baseline resolve rate over the *pilot*, not over the evaluated subset.
 *
 * The denominator is 20, the number of tasks sampled — not 16, the number that
 * produced a report. Dividing by 16 would score the run on only the cells that
 * survived, which is exactly the survivorship error the whole project is about:
 * a patch that never applied is a failure, not a missing data point.
 */
export function baselineResolveRate(rows: ArchiveRow[]): { resolved: number; n: number; pct: number } {
  const resolved = baselineResolved(rows).length;
  return { resolved, n: BASELINE_N, pct: (100 * resolved) / BASELINE_N };
}

/** One cell, addressed the way the submitted tables address it. */
export function findCell(
  rows: ArchiveRow[],
  q: { taskId?: string; run?: string; condition?: ConditionName; round?: RoundId; format?: "diff" | "sr" },
): ArchiveRow | null {
  const hit = evaluated(rows).find(
    (r) =>
      (q.taskId === undefined || r.row.cell.taskId === q.taskId) &&
      (q.run === undefined || r.run === q.run) &&
      (q.condition === undefined || r.condition === q.condition) &&
      (q.round === undefined || r.round === q.round) &&
      (q.format === undefined || r.format === q.format),
  );
  return hit ?? null;
}

export interface Coverage {
  condition: ConditionName;
  r1: number;
  r2: number;
  total: number;
}

/**
 * How many logic-class cells were actually run.
 *
 * Reported because the gaps are a free-tier quota artefact (20 requests/day,
 * `reports/data/config.md`), not a selection decision — and a consistency claim
 * across conditions means little without the denominator beside it.
 */
export function logicCoverage(rows: ArchiveRow[], logicTasks: string[]): { per: Coverage[]; evaluatedCells: number; totalCells: number } {
  const per = CONDITIONS.map((condition) => {
    const count = (round: RoundId) =>
      logicTasks.filter((taskId) => findCell(rows, { taskId, condition, round, format: "sr" })).length;
    const r1 = count("R1");
    const r2 = count("R2");
    return { condition, r1, r2, total: r1 + r2 };
  });
  return {
    per,
    evaluatedCells: per.reduce((a, c) => a + c.total, 0),
    totalCells: logicTasks.length * CONDITIONS.length * 2,
  };
}

export interface Headline {
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
  /** Cells the original pipeline could not see at all. */
  applyFailedCells: number;
}

/** Table E, computed. */
export function headline(rows: ArchiveRow[]): Headline {
  const classes = deriveFailureClasses(rows);
  const pool = [...classes.keys()].sort();
  const logicTasks = pool.filter((t) => classes.get(t) === "logic");
  const evaluable = evaluableTasks(rows);
  const recovered = recoveredTasks(rows);
  const rate = baselineResolveRate(rows);

  return {
    baselineResolved: rate.resolved,
    baselineN: rate.n,
    baselinePct: rate.pct,
    poolSize: pool.length,
    evaluable: evaluable.length,
    excluded: excludedTasks(rows),
    recovered,
    logicTasks,
    formatTasksEvaluable: evaluable.filter((t) => classes.get(t) === "format"),
    recoveredLogic: recovered.filter((t) => classes.get(t) === "logic"),
    recoveredFormat: recovered.filter((t) => classes.get(t) === "format"),
    applyFailedCells: rows.filter((r) => r.row.outcome.kind === "APPLY_FAIL").length,
  };
}

/** Sub-test trace for one task across every condition and round. */
export interface SubTestRow {
  label: string;
  f2pPassed: number;
  f2pTotal: number;
  p2pBroken: number;
}

export function subTestTrace(rows: ArchiveRow[], taskId: string): SubTestRow[] {
  const out: SubTestRow[] = [];
  const base = findCell(rows, { run: BASELINE_RUN, taskId });
  if (base?.tests) {
    out.push({
      label: "Baseline (unified diff)",
      f2pPassed: base.tests.f2pPassed,
      f2pTotal: base.tests.f2pTotal,
      p2pBroken: base.tests.p2pTotal - base.tests.p2pPassed,
    });
  }
  for (const condition of CONDITIONS) {
    for (const round of ["R1", "R2"] as const) {
      const c = findCell(rows, { taskId, condition, round, format: "sr" });
      if (c?.tests) {
        out.push({
          label: `${condition} ${round}`,
          f2pPassed: c.tests.f2pPassed,
          f2pTotal: c.tests.f2pTotal,
          p2pBroken: c.tests.p2pTotal - c.tests.p2pPassed,
        });
      }
    }
  }
  return out;
}

/** P2P tests broken by a cell, or 0 when it has no test record. */
export function p2pBroken(r: ArchiveRow | null): number {
  return r?.tests ? r.tests.p2pTotal - r.tests.p2pPassed : 0;
}
