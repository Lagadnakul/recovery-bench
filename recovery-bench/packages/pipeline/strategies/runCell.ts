/**
 * One cell, start to finish.
 *
 * Every condition runs through this function, so any difference in outcome
 * between conditions comes from the prompt and nothing else. That is the
 * property the original study could not offer: one script per condition, each
 * edited between runs, so a handling difference was indistinguishable from an
 * effect.
 *
 * The contract, which is the whole architecture in one sentence: **this
 * function always returns a row**. There is no path — no refusal, no budget
 * stop, no provider failure, no unparseable response — on which a cell
 * disappears. That is the defect the pipeline exists to prevent (D2), and the
 * one step 3 found 22 instances of in the original data (D15).
 */

import type { Config } from "../../core/config.ts";
import type { Cell, Outcome, Row, Task } from "../../core/types.ts";
import { applyEdits } from "../edits/index.ts";
import { callCell, type Registry } from "../providers/index.ts";
import type { BudgetLedger } from "../providers/budget.ts";
import { checkApply, withScratchRepo } from "../verify/apply.ts";
import { getStrategy } from "./conditions.ts";
import { NO_EVIDENCE, type Evidence } from "./evidence.ts";
import { editText, honouredCondition, parseResponse } from "./parse.ts";
import type { Attempt, CellOutcome } from "./types.ts";

export interface RunCellInput {
  cell: Cell;
  task: Task;
  filePath: string;
  fileContent: string;
  cfg: Config;
  registry: Registry;
  ledger: BudgetLedger;
  history?: Attempt[];
  evidence?: Evidence;
  /**
   * Verify with a real `git apply` against a scratch checkout.
   *
   * On by default because "the patch applies" is this pipeline's only
   * verification claim (D6) and asserting it without running git would make
   * the claim hollow. Tests turn it off to stay hermetic.
   */
  verifyApply?: boolean;
}

/** Builds the row skeleton, so every exit path fills the same shape. */
function row(
  cell: Cell,
  outcome: Outcome,
  runId: string,
  usage: Row<"apply">["usage"] = null,
): Row<"apply"> {
  return {
    cell,
    verification: "apply",
    outcome,
    // Not a stylistic null: an apply-verified row can never carry a resolve
    // verdict, and step 1 makes `resolveRate` refuse this type outright.
    resolved: null,
    tests: null,
    usage,
    runId,
    timestamp: new Date().toISOString(),
  };
}

export async function runCell(input: RunCellInput): Promise<CellOutcome> {
  const { cell, task, filePath, fileContent, cfg, registry, ledger } = input;
  const history = input.history ?? [];
  const evidence = input.evidence ?? NO_EVIDENCE;
  const runId = cfg.run.name;
  const strategy = getStrategy(cell.strategy);

  const bare = (outcome: Outcome): CellOutcome => ({
    row: row(cell, outcome, runId),
    response: "",
    patch: null,
    usage: null,
    evidenceSource: evidence.source,
    comparableToChapter5: false,
    honouredCondition: false,
  });

  // ─────────────────────────────────────────────── 1. what to ask
  const plan = await strategy.plan({
    cell,
    task,
    filePath,
    fileContent,
    history,
    evidence,
  });

  if (!plan.runnable) {
    // A refused condition is a recorded outcome, not an absence. PROVIDER_ERROR
    // with status null is the existing shape for "no call was made and the
    // reason is ours"; the reason string carries the detail.
    return bare({
      kind: "PROVIDER_ERROR",
      status: null,
      reason: `condition not runnable: ${plan.reason}`,
      retries: 0,
    });
  }

  // ─────────────────────────────────────── 2. spend, under the ceiling
  const call = await callCell(cell, cfg, registry, ledger, plan.prompt);

  if (call.outcome !== null) {
    // BUDGET_STOP, TRUNCATED, NO_OUTPUT or PROVIDER_ERROR — already terminal,
    // and already charged to the ledger by callCell.
    return {
      row: row(cell, call.outcome, runId, call.usage),
      response: call.content,
      patch: null,
      usage: call.usage,
      evidenceSource: evidence.source,
      comparableToChapter5: false,
      honouredCondition: false,
    };
  }

  // ───────────────────────────────────────────── 3. read the response
  const parsed = parseResponse(call.content);
  const honoured = honouredCondition(
    parsed,
    strategy.id as "l1_blind_retry" | "l2_reflection" | "l2_5_diagnose_revise",
  );

  // ─────────────────────────────────────────────── 4. build the patch
  const edit = applyEdits(
    cell.editFormat,
    editText(parsed, call.content),
    { [filePath]: fileContent },
    filePath,
  );

  const finish = (outcome: Outcome, patch: string | null): CellOutcome => ({
    row: row(cell, outcome, runId, call.usage),
    response: call.content,
    patch,
    usage: call.usage,
    evidenceSource: evidence.source,
    // Only meaningful for l2.5; for the others the condition itself is
    // faithful, so the archived evidence question does not arise.
    comparableToChapter5:
      strategy.needsEvidence ? evidence.comparableToChapter5 : true,
    honouredCondition: honoured,
  });

  if (edit.outcome !== null) {
    // MALFORMED or NO_PATCH — the format-class failure the thesis is about.
    return finish(edit.outcome, edit.patch);
  }
  if (edit.patch === null) {
    return finish(
      { kind: "NO_PATCH", responseChars: call.content.length },
      null,
    );
  }

  // ──────────────────────────────── 5. does git actually accept it?
  if (input.verifyApply === false) {
    return finish(
      { kind: "APPLIED", patch: edit.patch, filesChanged: [filePath] },
      edit.patch,
    );
  }

  const applied = await withScratchRepo(
    { [filePath]: fileContent },
    async (dir) => checkApply(dir, edit.patch!),
  );

  if (!applied.ok) {
    return finish(
      { kind: "APPLY_FAIL", patch: edit.patch, gitStderr: applied.stderr },
      edit.patch,
    );
  }

  return finish(
    {
      kind: "APPLIED",
      patch: edit.patch,
      filesChanged: applied.filesChanged.length > 0 ? applied.filesChanged : [filePath],
    },
    edit.patch,
  );
}

/** The attempt record a later round needs, derived from a finished cell. */
export function toAttempt(out: CellOutcome): Attempt {
  return {
    response: out.response,
    patch: out.patch,
    outcome: out.row.outcome,
    gitStderr:
      out.row.outcome.kind === "APPLY_FAIL" ? out.row.outcome.gitStderr : null,
  };
}
