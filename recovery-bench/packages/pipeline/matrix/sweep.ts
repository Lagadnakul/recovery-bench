/**
 * The sweep.
 *
 * Runs the enumerated grid to completion, where "completion" means **every
 * planned cell has exactly one recorded row** — not that every cell succeeded.
 * A refused condition, an exhausted budget, a provider outage: all are
 * outcomes, all are written, none is a gap. `verify.ts` checks the claim
 * afterwards using code that shares nothing with this file.
 *
 * Four things this has to get right, each of which would be a silent data
 * defect if it were wrong:
 *
 *   **Lineage order.** Round 2 is shown round 1's response, so rounds within a
 *   lineage run in sequence. Lineages are independent and are what gets
 *   parallelised.
 *
 *   **Concurrency limits.** NVIDIA returns HTTP 200 with an empty body past its
 *   worker limit rather than a 429 (D20). Unbounded parallelism would
 *   manufacture `NO_OUTPUT` rows and blame the model.
 *
 *   **Budget exhaustion.** `skip_arm` stops the arms on the spent provider and
 *   lets the others finish; `halt` stops everything. Either way the remaining
 *   cells are written as `BUDGET_STOP` rather than left absent.
 *
 *   **Resume.** Completed cells are read back and skipped, so a restart costs
 *   nothing and cannot double-spend.
 */

import type { Config } from "../../core/config.ts";
import type { Task } from "../../core/types.ts";
import { cellKey } from "../../core/types.ts";
import { BudgetLedger, LEDGER_PATH } from "../providers/budget.ts";
import { buildRegistry, type Registry } from "../providers/index.ts";
import { resolveEvidence, NO_EVIDENCE } from "../strategies/evidence.ts";
import { getStrategy } from "../strategies/conditions.ts";
import { runCell, toAttempt } from "../strategies/runCell.ts";
import type { Attempt, CellOutcome } from "../strategies/types.ts";
import { getTaskFile } from "../tasks/files.ts";
import { tryLocalise } from "../tasks/localise.ts";
import {
  baselineGroupId,
  enumerateCells,
  toLineages,
  type Lineage,
  type PlannedCell,
} from "./enumerate.ts";
import { RowStore, SWEEP_ROWS } from "./store.ts";

export interface SweepOptions {
  cfg: Config;
  tasks: Map<string, Task>;
  /** Restrict to these arms. Empty means every enabled arm. */
  arms?: string[];
  rowsPath?: string;
  ledgerPath?: string;
  /** Injected for tests; defaults to real `fetch`. */
  fetchImpl?: typeof fetch;
  /** Off in tests to stay hermetic; on by default because apply is the claim. */
  verifyApply?: boolean;
  /** Called after each cell, for progress output. */
  onCell?: (rec: { key: string; arm: string; outcome: string; index: number; total: number }) => void;
  /** Cache-only file reads. A sweep should not depend on GitHub mid-run. */
  allowNetwork?: boolean;
}

export interface SweepResult {
  planned: number;
  skippedResumed: number;
  ran: number;
  byOutcome: Record<string, number>;
  /** Arms abandoned because their provider's budget ran out. */
  armsSkipped: string[];
  tokensSpent: number;
}

/** Runs `tasks` with at most `limit` in flight. Order of completion is free. */
async function pool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i]!);
    }
  });
  await Promise.all(runners);
}

export async function sweep(opts: SweepOptions): Promise<SweepResult> {
  const { cfg, tasks } = opts;
  const rowsPath = opts.rowsPath ?? SWEEP_ROWS;

  let planned: PlannedCell[] = enumerateCells(cfg, tasks);
  if (opts.arms && opts.arms.length > 0) {
    const want = new Set(opts.arms);
    planned = planned.filter((p) => want.has(p.arm));
  }

  const { store } = await RowStore.open(rowsPath);
  const { ledger } = await BudgetLedger.load(
    cfg.budget.providers,
    opts.ledgerPath ?? LEDGER_PATH,
  );
  const registry: Registry = buildRegistry(cfg, opts.fetchImpl ?? fetch);

  const byOutcome: Record<string, number> = {};
  const armsSkipped = new Set<string>();
  /** Providers whose budget is spent. Checked before each cell. */
  const deadProviders = new Set<string>();
  let halted = false;
  let ran = 0;
  let skippedResumed = 0;
  let index = 0;

  const lineages = toLineages(planned);
  const total = planned.length;

  const record = async (arm: string, out: CellOutcome) => {
    await store.append(arm, out);
    const kind = out.row.outcome.kind;
    byOutcome[kind] = (byOutcome[kind] ?? 0) + 1;
    index++;
    opts.onCell?.({
      key: cellKey(out.row.cell),
      arm,
      outcome: kind,
      index,
      total,
    });
  };

  /**
   * The baseline attempt each group produced, keyed by `baselineGroupId`.
   *
   * Populated by phase 1 and read by phase 2. Also filled from the row store on
   * resume, which is why the response is persisted (see `store.ts`): without it
   * a resumed sweep would have to re-pay for round 0 to rebuild round 1's
   * prompt.
   */
  const baselineAttempts = new Map<string, Attempt>();

  /** One lineage: its rounds in order, each feeding the next. */
  const runLineage = async (lin: Lineage, seed?: Attempt): Promise<void> => {
    const history: Attempt[] = seed ? [seed] : [];
    const task = tasks.get(lin.taskId);
    if (!task) throw new Error(`lineage names unknown task ${lin.taskId}`);

    // Localisation and the file are per-task, so resolve once per lineage.
    const loc = tryLocalise(task);
    let fileContent: string | null = null;
    let locError: string | null = loc.ok ? null : loc.reason;

    if (loc.ok) {
      try {
        const f = await getTaskFile(task, loc.path, {
          allowNetwork: opts.allowNetwork ?? false,
        });
        fileContent = f.content;
      } catch (e) {
        locError = `file unavailable: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    for (const p of lin.cells) {
      if (store.has(p.cell)) {
        skippedResumed++;
        index++;
        continue;
      }

      // A task whose file cannot be read still produces a row per cell. The
      // original would have skipped it and left nothing behind.
      if (locError !== null || fileContent === null) {
        await record(p.arm, {
          row: {
            cell: p.cell,
            verification: "apply",
            outcome: {
              kind: "PROVIDER_ERROR",
              status: null,
              reason: `task unavailable: ${locError ?? "no file content"}`,
              retries: 0,
            },
            resolved: null,
            tests: null,
            usage: null,
            runId: cfg.run.name,
            timestamp: new Date().toISOString(),
          },
          response: "",
          patch: null,
          usage: null,
          evidenceSource: "none",
          comparableToChapter5: false,
          honouredCondition: false,
        });
        continue;
      }

      if (halted || deadProviders.has(p.provider)) {
        // Budget gone. Record the remaining cells rather than dropping them:
        // "we stopped here" is data, "these cells never existed" is the defect.
        const cap = ledger.ceilingOf(p.provider);
        await record(p.arm, {
          row: {
            cell: p.cell,
            verification: "apply",
            outcome: {
              kind: "BUDGET_STOP",
              tokensUsed: ledger.spendOfProvider(p.provider).tokens,
              ceiling: cap?.maxTokens ?? 0,
            },
            resolved: null,
            tests: null,
            usage: null,
            runId: cfg.run.name,
            timestamp: new Date().toISOString(),
          },
          response: "",
          patch: null,
          usage: null,
          evidenceSource: "none",
          comparableToChapter5: false,
          honouredCondition: false,
        });
        continue;
      }

      const strategy = getStrategy(p.cell.strategy);
      const evidence = strategy.needsEvidence
        ? await resolveEvidence({
            instanceId: task.instanceId,
            ...(history.at(-1)?.gitStderr
              ? { gitStderr: history.at(-1)!.gitStderr! }
              : {}),
          })
        : NO_EVIDENCE;

      const out = await runCell({
        cell: p.cell,
        task,
        filePath: loc.ok ? loc.path : "",
        fileContent,
        cfg,
        registry,
        ledger,
        history,
        evidence,
        ...(opts.verifyApply === undefined ? {} : { verifyApply: opts.verifyApply }),
      });

      await record(p.arm, out);
      ran++;
      const attempt = toAttempt(out);
      history.push(attempt);

      // A baseline is the prior every recovery condition of its group reads.
      if (p.cell.strategy === "l0_baseline" && p.cell.round === 0) {
        baselineAttempts.set(baselineGroupId(p.cell), attempt);
      }

      // A BUDGET_STOP from the cell itself means every key of that provider is
      // spent. Honour stop_on_exhaustion from here on.
      if (out.row.outcome.kind === "BUDGET_STOP") {
        if (cfg.budget.stopOnExhaustion === "halt") {
          halted = true;
        } else {
          deadProviders.add(p.provider);
          armsSkipped.add(p.arm);
        }
      }
    }
  };

  /** Runs a set of lineages, each provider under its own concurrency cap. */
  const runPhase = async (
    set: Lineage[],
    seedFor?: (l: Lineage) => Attempt | undefined,
  ): Promise<void> => {
    const byProvider = new Map<string, Lineage[]>();
    for (const l of set) {
      const list = byProvider.get(l.provider) ?? [];
      list.push(l);
      byProvider.set(l.provider, list);
    }
    await Promise.all(
      [...byProvider].map(([provider, list]) => {
        const limit = cfg.run.concurrency[provider] ?? cfg.run.defaultConcurrency;
        return pool(list, limit, (l) => runLineage(l, seedFor?.(l)));
      }),
    );
  };

  // ───────────────────────────────────────── phase 1: the baselines
  //
  // Two phases, not one, because the recovery conditions read the baseline's
  // response. Running them together would either serialise every condition
  // behind one lineage or hand round 1 an empty history — which is exactly what
  // the first live sweep did, refusing 16 of 24 cells (D26).
  const baselineLineages = lineages.filter((l) =>
    l.cells.every((c) => c.cell.strategy === "l0_baseline" && c.cell.round === 0),
  );
  const recoveryLineages = lineages.filter((l) => !baselineLineages.includes(l));

  // On resume the baselines are already done, so their responses come from the
  // rows rather than from a re-run.
  for (const l of baselineLineages) {
    for (const c of l.cells) {
      const stored = store.get(c.cell);
      if (stored) {
        baselineAttempts.set(baselineGroupId(c.cell), {
          response: stored.response ?? "",
          patch: stored.patch,
          outcome: stored.outcome,
          gitStderr:
            stored.outcome.kind === "APPLY_FAIL" ? stored.outcome.gitStderr : null,
        });
      }
    }
  }

  await runPhase(baselineLineages);

  // ───────────────────────────────────── phase 2: the recovery conditions
  await runPhase(recoveryLineages, (l) => {
    const first = l.cells[0];
    if (!first) return undefined;
    return baselineAttempts.get(baselineGroupId(first.cell));
  });

  let tokensSpent = 0;
  for (const provider of Object.keys(cfg.budget.providers)) {
    tokensSpent += ledger.spendOfProvider(provider).tokens;
  }

  return {
    planned: total,
    skippedResumed,
    ran,
    byOutcome,
    armsSkipped: [...armsSkipped].sort(),
    tokensSpent,
  };
}
