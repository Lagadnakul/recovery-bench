/**
 * The strategy interface.
 *
 * A strategy decides one thing: what the model is shown. Everything else —
 * localising the file, spending the budget, parsing the edit, checking that
 * `git` accepts it, recording the row — is identical across conditions and
 * lives in `runCell.ts`.
 *
 * Keeping it that narrow is what makes the comparison valid. If each condition
 * had its own runner, a difference in outcome could come from a difference in
 * handling rather than from the manipulated variable, and no reader could rule
 * that out. The original study had exactly this shape of risk: one Python
 * script per condition, each edited between runs.
 */

import type { Cell, Outcome, Row, Task, Usage } from "../../core/types.ts";
import type { Evidence } from "./evidence.ts";
import type { PromptCondition } from "./prompt.ts";

/** What a previous round left behind, for the conditions that look back. */
export interface Attempt {
  /** The model's raw response, verbatim. This is what l2/l2.5 are shown. */
  response: string;
  /** The patch that was produced, when one was. */
  patch: string | null;
  outcome: Outcome;
  /** git's rejection, when the patch failed to apply. Feeds l2.5 evidence. */
  gitStderr: string | null;
}

export interface StrategyContext {
  cell: Cell;
  task: Task;
  /** The oracle-localised path. */
  filePath: string;
  /** The file at `base_commit`, exactly as it will appear in the prompt. */
  fileContent: string;
  /** Rounds already run for this task, oldest first. */
  history: Attempt[];
  /** Resolved for l2.5 only. Its `source` travels onto the row. */
  evidence: Evidence;
}

/** Why a strategy declined to run, when it did. */
export interface Unrunnable {
  runnable: false;
  /** Recorded on the row. A cell is never silently skipped (D2, D15). */
  reason: string;
}

export interface Runnable {
  runnable: true;
  prompt: string;
  /** Provenance of the template, carried onto the row for audit. */
  promptSource: string;
  promptSha256: string;
}

export type StrategyPlan = Runnable | Unrunnable;

export interface Strategy {
  readonly id: PromptCondition | "l0_baseline";
  /** Human-readable, matching the dissertation's condition names. */
  readonly label: string;
  /** Rounds this strategy needs before it can run. L0 and L1 need none. */
  readonly needsHistory: boolean;
  /** True only for l2.5 — the condition defined by having test evidence. */
  readonly needsEvidence: boolean;
  plan(ctx: StrategyContext): Promise<StrategyPlan>;
}

/** The row a completed cell produces, plus the step-5 provenance fields. */
export interface CellOutcome {
  row: Row<"apply">;
  /** The raw model response, kept so a later round can show it back. */
  response: string;
  patch: string | null;
  usage: Usage | null;
  /** Which evidence the cell actually received, when it is l2.5. */
  evidenceSource: Evidence["source"];
  /** False when this cell cannot be pooled with Chapter 5's equivalent. */
  comparableToChapter5: boolean;
  /** Whether the response contained the reasoning section its condition asked for. */
  honouredCondition: boolean;
}
