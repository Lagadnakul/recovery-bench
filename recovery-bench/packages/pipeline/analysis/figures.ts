/**
 * The datasets behind figures 5.1 - 5.4, derived.
 *
 * ## Why this exists
 *
 * `reports/data/make_figures.py` types every quantity straight into a draw.io
 * shape:
 *
 * ```python
 * segs = [("Resolved&#xa;12", 12, ...), ("Logic&#xa;4", 4, ...), ("Format&#xa;4", 4, ...)]
 * ```
 *
 * so the figures agree with the tables only because the same person typed both.
 * Nothing checks them against each other, and a figure is exactly where a stale
 * number survives longest — it is read as an illustration, not as a claim.
 *
 * This module computes those same quantities from the archive and writes them to
 * `data/chapter5_figures.json`. `tests/analysisFigures.test.ts` then pins them
 * against the literals in `make_figures.py`.
 *
 * ## What this deliberately does not do
 *
 * It does **not** rewrite the `.drawio` sources or the PNGs. Those exports are
 * already embedded in `Self.docx`, which is final and cannot be re-exported, so
 * regenerating them could only introduce drift between the repository and the
 * submitted document. Making the numbers checkable was the missing part; making
 * them re-renderable was not.
 */

import type { ArchiveRow } from "./load.ts";
import { BASELINE_RUN, BASELINE_N, CONDITIONS, type ConditionName, type RoundId } from "./runs.ts";
import { deriveFailureClasses } from "./classify.ts";
import { baselineApplyFailed, baselineResolved, baselineUnresolved, findCell, headline, logicCoverage, p2pBroken, subTestTrace } from "./aggregate.ts";

export interface Fig51 {
  title: string;
  resolved: number;
  logic: number;
  format: number;
  pool: number;
  n: number;
  shares: { label: string; count: number; pct: number }[];
}

/** Figure 5.1 — baseline outcome breakdown. */
export function fig51(rows: ArchiveRow[]): Fig51 {
  const resolved = baselineResolved(rows).length;
  const logic = baselineUnresolved(rows).length;
  const format = baselineApplyFailed(rows).length;
  const pool = logic + format;
  const share = (c: number) => (100 * c) / BASELINE_N;
  return {
    title: "Baseline Outcome Breakdown, 20 Instances",
    resolved,
    logic,
    format,
    pool,
    n: BASELINE_N,
    shares: [
      { label: "Resolved on first attempt", count: resolved, pct: share(resolved) },
      { label: "Logic-class failure", count: logic, pct: share(logic) },
      { label: "Format-class failure", count: format, pct: share(format) },
      { label: "Failure pool", count: pool, pct: share(pool) },
    ],
  };
}

export interface Fig52 {
  taskId: string;
  baseline: { f2pPassed: number; f2pTotal: number; p2pBroken: number };
  retrofitted: { f2pPassed: number; f2pTotal: number; p2pBroken: number } | null;
  /** Every evaluated recovery cell, which the figure claims are identical. */
  cells: { label: string; f2pPassed: number; f2pTotal: number; p2pBroken: number }[];
  /** Derived, not asserted: whether those cells really do all agree. */
  allIdentical: boolean;
}

/**
 * Figure 5.2 — the sub-test recovery figure, labelled "the money figure" in the
 * original source.
 *
 * Its claim is that six independent generations returned an identical score.
 * `allIdentical` computes that rather than trusting the caption, because if a
 * single cell disagreed the figure would be making a false claim about the most
 * load-bearing result in the chapter.
 */
export function fig52(rows: ArchiveRow[], taskId = "django__django-11019"): Fig52 {
  const trace = subTestTrace(rows, taskId);
  const baselineCell = findCell(rows, { run: BASELINE_RUN, taskId });
  const cells = trace.filter((t) => t.label !== "Baseline (unified diff)");
  const first = cells[0];

  return {
    taskId,
    baseline: {
      f2pPassed: baselineCell?.tests?.f2pPassed ?? 0,
      f2pTotal: baselineCell?.tests?.f2pTotal ?? 0,
      p2pBroken: p2pBroken(baselineCell),
    },
    retrofitted: first
      ? { f2pPassed: first.f2pPassed, f2pTotal: first.f2pTotal, p2pBroken: first.p2pBroken }
      : null,
    cells: cells.map((c) => ({
      label: c.label,
      f2pPassed: c.f2pPassed,
      f2pTotal: c.f2pTotal,
      p2pBroken: c.p2pBroken,
    })),
    allIdentical:
      cells.length > 0 &&
      cells.every((c) => c.f2pPassed === first!.f2pPassed && c.f2pTotal === first!.f2pTotal),
  };
}

export interface MatrixCell {
  taskId: string;
  condition: ConditionName;
  round: RoundId;
  /** `null` when the cell was never run — never rendered as a failure. */
  score: string | null;
  p2pBroken: number;
  resolved: boolean | null;
}

export interface Fig53 {
  tasks: string[];
  conditions: readonly ConditionName[];
  cells: MatrixCell[];
  evaluatedCells: number;
  totalCells: number;
  resolvedCells: number;
  /** The footnote: the one cell that broke P2P tests where its peers did not. */
  counterSignal: { taskId: string; condition: ConditionName; round: RoundId; p2pBroken: number } | null;
}

/**
 * Figure 5.3 — the logic-class comparison matrix.
 *
 * The distinction that matters here is between a cell that ran and failed and a
 * cell that never ran. The original figure gets this right, rendering the
 * latter as "not evaluated"; `score: null` carries the same distinction into
 * data, so a later consumer cannot quietly average them together.
 */
export function fig53(rows: ArchiveRow[]): Fig53 {
  const classes = deriveFailureClasses(rows);
  const tasks = [...classes.keys()].filter((t) => classes.get(t) === "logic").sort();
  const cells: MatrixCell[] = [];
  let counterSignal: Fig53["counterSignal"] = null;

  for (const taskId of tasks) {
    for (const condition of CONDITIONS) {
      for (const round of ["R1", "R2"] as RoundId[]) {
        const c = findCell(rows, { taskId, condition, round, format: "sr" });
        const broken = p2pBroken(c);
        cells.push({
          taskId,
          condition,
          round,
          score: c?.tests ? `${c.tests.f2pPassed} of ${c.tests.f2pTotal}` : null,
          p2pBroken: broken,
          resolved: c && c.row.verification === "test" ? c.row.resolved : null,
        });
        if (broken > 0 && (counterSignal === null || broken > counterSignal.p2pBroken)) {
          counterSignal = { taskId, condition, round, p2pBroken: broken };
        }
      }
    }
  }

  const cov = logicCoverage(rows, tasks);
  return {
    tasks,
    conditions: CONDITIONS,
    cells,
    evaluatedCells: cov.evaluatedCells,
    totalCells: cov.totalCells,
    resolvedCells: cells.filter((c) => c.resolved === true).length,
    counterSignal,
  };
}

export interface Fig54 {
  conditions: { condition: ConditionName; relativeInputVolume: number; logicResolved: number }[];
  /**
   * The multipliers are an input, not a derivation.
   *
   * They come from the token accounting in `reports/data/config.md`. The archive
   * holds no usage records — the original never captured them, which is why
   * `Usage` is nullable on every replayed row and why step 4 adds a ledger. Kept
   * here so the figure's data is in one place, labelled so nobody mistakes it
   * for something this pipeline measured.
   */
  relativeVolumeSource: string;
}

/** Figure 5.4 — recovery cost against outcome. */
export function fig54(rows: ArchiveRow[]): Fig54 {
  const classes = deriveFailureClasses(rows);
  const logicTasks = [...classes.keys()].filter((t) => classes.get(t) === "logic");
  const RELATIVE_VOLUME: Record<ConditionName, number> = {
    Baseline: 1,
    "Blind Retry": 1,
    "Reflection-only": 2,
    "Diagnose+Revise": 3,
  };

  return {
    conditions: CONDITIONS.map((condition) => ({
      condition,
      relativeInputVolume: RELATIVE_VOLUME[condition],
      // Derived: the figure renders "0" three times.
      logicResolved: logicTasks.filter((taskId) =>
        (["R1", "R2"] as RoundId[]).some((round) => {
          const c = findCell(rows, { taskId, condition, round, format: "sr" });
          return c !== null && c.row.verification === "test" && c.row.resolved;
        }),
      ).length,
    })),
    relativeVolumeSource: "reports/data/config.md — token accounting, not measured by this pipeline",
  };
}

export interface Chapter5Figures {
  generated_at: string;
  generated_by: string;
  note: string;
  fig5_1: Fig51;
  fig5_2: Fig52;
  fig5_3: Fig53;
  fig5_4: Fig54;
  headline: ReturnType<typeof headline>;
}

export function buildFigures(rows: ArchiveRow[]): Chapter5Figures {
  return {
    generated_at: new Date().toISOString(),
    generated_by: "packages/pipeline/analysis/figures.ts",
    note:
      "Datasets behind figures 5.1-5.4, derived from archive/legacy_runs. The .drawio " +
      "sources and PNG exports are NOT regenerated: they are already embedded in the " +
      "submitted Self.docx, which is final.",
    fig5_1: fig51(rows),
    fig5_2: fig52(rows),
    fig5_3: fig53(rows),
    fig5_4: fig54(rows),
    headline: headline(rows),
  };
}
