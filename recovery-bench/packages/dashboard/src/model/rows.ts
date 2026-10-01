/**
 * One row type for two datasets that do not have the same shape.
 *
 * The dashboard reads from two places and must never silently pool them:
 *
 *   `replay_rows.json`    the original study, replayed from the archive. Some
 *                         rows are TEST-verified and carry `resolved` plus
 *                         FAIL_TO_PASS counts. Committed.
 *   `sweep_rows.jsonl`    new sweeps. APPLY-verified, so `resolved` is null by
 *                         type. Gitignored — absent on a fresh clone.
 *
 * `ViewRow` carries `verification` and keeps `resolved: boolean | null`, so the
 * distinction survives normalisation rather than being flattened away. The
 * integrity rule from ARCHITECTURE §6 is a compile-time one in the pipeline;
 * here it is preserved by keeping the discriminator on every row and refusing
 * to compute a resolve rate over anything apply-verified (see `resolveRate`).
 */

import type { Outcome, OutcomeKind } from "@rb/core";
import { isFormatClass, isInstrumentLimit } from "@rb/core";

export type Source = "replay" | "sweep";
export type EvidenceSource = "archived_test" | "apply_error" | "none";

export interface TestCounts {
  f2pPassed: number;
  f2pTotal: number;
  p2pPassed: number;
  p2pTotal: number;
}

export interface ViewRow {
  /** Unique within the dataset. Sweep rows use `cellKey()`; replay rows synthesise one. */
  id: string;
  source: Source;
  /** Identity minus the round — the rounds of one lineage sit on one grid line. */
  lineage: string;
  taskId: string;
  /** Short task label: `django-11620` from `django__django-11620`. */
  taskLabel: string;
  /** Strategy id where known, so both datasets speak one vocabulary. */
  strategy: string;
  /** What the thesis calls it: "Reflection-only", "Diagnose+Revise". */
  conditionLabel: string;
  model: string | null;
  editFormat: string | null;
  thinking: boolean | null;
  round: number;
  arm: string | null;
  /** Which legacy run produced it. Replay rows only. */
  run: string | null;
  verification: "test" | "apply";
  outcomeKind: OutcomeKind;
  /** Full payload for sweep rows; a reconstructed minimum for replay rows. */
  outcome: Outcome;
  /** Non-null only when `verification === "test"`. */
  resolved: boolean | null;
  tests: TestCounts | null;
  evidenceSource: EvidenceSource | null;
  comparableToChapter5: boolean;
  honouredCondition: boolean | null;
  patch: string | null;
  response: string | null;
  timestamp: string;
}

// ------------------------------------------------------------------ labelling

/** `django__django-11620` → `django-11620`. Keeps the grid readable at 1,308 rows. */
export function shortTask(taskId: string): string {
  const i = taskId.indexOf("__");
  return i === -1 ? taskId : taskId.slice(i + 2);
}

const STRATEGY_LABEL: Record<string, string> = {
  l0_baseline: "Baseline",
  l1_blind_retry: "Blind Retry",
  l2_reflection: "Reflection-only",
  l2_5_diagnose_revise: "Diagnose+Revise",
  l3_constrained: "Constrained",
  l4_tool_grounded: "Tool-grounded",
};

/** The thesis's own condition names, reversed, so replay rows map to strategy ids. */
const STRATEGY_BY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(STRATEGY_LABEL).map(([id, label]) => [label, id]),
);

export function strategyLabel(id: string): string {
  return STRATEGY_LABEL[id] ?? id;
}

const FORMAT_LABEL: Record<string, string> = {
  diff: "unified_diff",
  sr: "search_replace",
};

// ------------------------------------------------------------------ the sweep

/** `SweepRecord` as it sits in `data/sweep_rows.jsonl`. */
export interface SweepRecord {
  key: string;
  arm: string;
  runId: string;
  timestamp: string;
  cell: {
    taskId: string;
    strategy: string;
    model: string;
    editFormat: string;
    thinking: boolean;
    round: number;
    repeat: number;
  };
  verification: "apply";
  outcome: Outcome;
  usage: unknown;
  evidenceSource: EvidenceSource;
  comparableToChapter5: boolean;
  honouredCondition: boolean;
  patch: string | null;
  response: string;
}

/**
 * The cell key minus the round — rounds of one lineage share a line.
 *
 * Deliberately recomputed here from the cell rather than string-sliced off
 * `key`, so a change to `cellKey`'s field order cannot quietly regroup the
 * grid.
 */
export function lineageOf(c: SweepRecord["cell"]): string {
  return [
    c.taskId,
    c.strategy,
    c.model,
    c.editFormat,
    c.thinking ? "think" : "nothink",
    `n${c.repeat}`,
  ].join("|");
}

export function fromSweep(rec: SweepRecord): ViewRow {
  return {
    id: rec.key,
    source: "sweep",
    lineage: lineageOf(rec.cell),
    taskId: rec.cell.taskId,
    taskLabel: shortTask(rec.cell.taskId),
    strategy: rec.cell.strategy,
    conditionLabel: strategyLabel(rec.cell.strategy),
    model: rec.cell.model,
    editFormat: rec.cell.editFormat,
    thinking: rec.cell.thinking,
    round: rec.cell.round,
    arm: rec.arm,
    run: null,
    verification: "apply",
    outcomeKind: rec.outcome.kind,
    outcome: rec.outcome,
    // Apply-verified: `resolved` is null by type in the pipeline, and stays
    // null here. No view may infer it.
    resolved: null,
    tests: null,
    evidenceSource: rec.evidenceSource,
    comparableToChapter5: rec.comparableToChapter5,
    honouredCondition: rec.honouredCondition,
    patch: rec.patch,
    response: rec.response,
    timestamp: rec.timestamp,
  };
}

// ----------------------------------------------------------------- the replay

/** A row of `replay_rows.json`, as `analysis/load.ts` writes it. */
export interface ReplayRow {
  taskId: string;
  run: string;
  condition: string;
  round: string;
  patchFormat: string;
  verification: "test" | "apply";
  outcome: OutcomeKind;
  gitError: string | null;
  resolved: boolean | null;
  tests: TestCounts | null;
  timestamp: string;
}

export interface ReplayFile {
  generated_at: string;
  summary: Record<string, unknown>;
  failure_class_derived: Record<string, string>;
  rows: ReplayRow[];
}

/** `"R1"` → `1`. Anything unparseable stays 0 rather than becoming NaN. */
export function roundOf(label: string): number {
  const n = Number.parseInt(label.replace(/^R/i, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Rebuilds an `Outcome` for a replay row.
 *
 * The archive records only the kind plus a git error, so the payload is thinner
 * than a sweep row's — but it is real, not invented: `gitError` is the stderr
 * `git apply` actually printed. Where the archive knows nothing, the field says
 * so in words rather than being filled with a plausible value.
 */
function replayOutcome(r: ReplayRow): Outcome {
  switch (r.outcome) {
    case "APPLIED":
      return { kind: "APPLIED", patch: "", filesChanged: [] };
    case "APPLY_FAIL":
      return {
        kind: "APPLY_FAIL",
        patch: "",
        gitStderr: r.gitError ?? "git refused the patch; the archive kept no stderr",
      };
    default:
      return {
        kind: "NO_OUTPUT",
        detail: `archived as ${r.outcome}; the archive kept no further detail`,
      };
  }
}

export function fromReplay(r: ReplayRow, index: number): ViewRow {
  const strategy = STRATEGY_BY_LABEL[r.condition] ?? r.condition;
  return {
    id: `replay:${r.run}:${r.taskId}:${r.condition}:${r.round}:${index}`,
    source: "replay",
    lineage: `${r.taskId}|${strategy}|${r.run}`,
    taskId: r.taskId,
    taskLabel: shortTask(r.taskId),
    strategy,
    conditionLabel: r.condition,
    model: "gemini-3.6-flash",
    editFormat: FORMAT_LABEL[r.patchFormat] ?? r.patchFormat,
    thinking: null,
    round: roundOf(r.round),
    arm: null,
    run: r.run,
    verification: r.verification,
    outcomeKind: r.outcome,
    outcome: replayOutcome(r),
    resolved: r.verification === "test" ? r.resolved : null,
    tests: r.tests,
    evidenceSource: r.verification === "test" ? "archived_test" : "apply_error",
    comparableToChapter5: true,
    honouredCondition: null,
    patch: null,
    response: null,
    timestamp: r.timestamp,
  };
}

// --------------------------------------------------------------- aggregations

export interface Lineage {
  id: string;
  taskLabel: string;
  taskId: string;
  conditionLabel: string;
  model: string | null;
  editFormat: string | null;
  arm: string | null;
  run: string | null;
  /** Rounds present, sparse — index is the round number. */
  rounds: Map<number, ViewRow>;
}

export function toLineages(rows: readonly ViewRow[]): Lineage[] {
  const out = new Map<string, Lineage>();
  for (const r of rows) {
    let l = out.get(r.lineage);
    if (!l) {
      l = {
        id: r.lineage,
        taskLabel: r.taskLabel,
        taskId: r.taskId,
        conditionLabel: r.conditionLabel,
        model: r.model,
        editFormat: r.editFormat,
        arm: r.arm,
        run: r.run,
        rounds: new Map(),
      };
      out.set(r.lineage, l);
    }
    // A duplicate round within a lineage would mean two rows for one cell. The
    // pipeline's `verify` already checks for that, so the last one wins here
    // rather than this view inventing a second kind of duplicate report.
    l.rounds.set(r.round, r);
  }
  return [...out.values()].sort(
    (a, b) =>
      a.taskLabel.localeCompare(b.taskLabel) ||
      a.conditionLabel.localeCompare(b.conditionLabel) ||
      a.id.localeCompare(b.id),
  );
}

export function countByOutcome(rows: readonly ViewRow[]): Map<OutcomeKind, number> {
  const m = new Map<OutcomeKind, number>();
  for (const r of rows) m.set(r.outcomeKind, (m.get(r.outcomeKind) ?? 0) + 1);
  return m;
}

/**
 * Apply rate, with the instrument limits removed from the denominator.
 *
 * Same arithmetic D18 requires of the pipeline: a cell that measured nothing
 * about the model belongs in neither numerator nor denominator. `measured` is
 * returned alongside so a view can show how much was set aside instead of
 * hiding the adjustment.
 */
export function applyRate(rows: readonly ViewRow[]): {
  applied: number;
  measured: number;
  setAside: number;
} {
  let applied = 0;
  let measured = 0;
  let setAside = 0;
  for (const r of rows) {
    if (isInstrumentLimit(r.outcome)) {
      setAside++;
      continue;
    }
    measured++;
    if (r.outcomeKind === "APPLIED" || r.outcomeKind === "CONTAMINATED") applied++;
  }
  return { applied, measured, setAside };
}

export function formatClassCount(rows: readonly ViewRow[]): number {
  return rows.filter((r) => isFormatClass(r.outcome)).length;
}

/**
 * Resolve rate over TEST-verified rows only.
 *
 * The pipeline makes this a compile error for apply-verified rows. Here the
 * rows arrive from JSON at runtime, so the guard is explicit: anything
 * apply-verified is dropped and counted, never treated as unresolved. Treating
 * a missing result as a negative result is the error this whole project exists
 * to avoid.
 */
export function resolveRate(rows: readonly ViewRow[]): {
  resolved: number;
  tested: number;
  skippedApplyVerified: number;
} {
  let resolved = 0;
  let tested = 0;
  let skipped = 0;
  for (const r of rows) {
    if (r.verification !== "test" || r.resolved === null) {
      skipped++;
      continue;
    }
    tested++;
    if (r.resolved) resolved++;
  }
  return { resolved, tested, skippedApplyVerified: skipped };
}

// --------------------------------------------------------------- the pipeline

/** The six stages a cell passes through, in order. */
export const STAGES = ["localise", "prompt", "call", "parse", "apply", "record"] as const;
export type Stage = (typeof STAGES)[number];

/**
 * How far a cell got before it stopped.
 *
 * Returns the index of the last stage *completed*. A cell always reaches
 * `record` — that is `runCell`'s contract, every cell terminates in a written
 * row — so the value says where the useful work ended, not where execution did.
 */
export function stageReached(kind: OutcomeKind): number {
  switch (kind) {
    case "BUDGET_STOP":
      return 1; // never dispatched: the ledger refused before the request
    case "PROVIDER_ERROR":
    case "NO_OUTPUT":
    case "TRUNCATED":
      return 2; // the call happened; nothing usable came back
    case "NO_PATCH":
    case "MALFORMED":
      return 3; // parsed, and the parse is what failed
    case "APPLY_FAIL":
      return 4; // reached git, which refused it
    case "APPLIED":
    case "CONTAMINATED":
      return 5; // all the way through
  }
}
