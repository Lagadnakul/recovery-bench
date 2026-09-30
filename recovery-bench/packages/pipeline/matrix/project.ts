/**
 * Cost projection, before anything is spent.
 *
 * `budget.estimate_before_run: true` has been in the config since step 1 with
 * nothing implementing it. This is that implementation, and the first time it
 * ran it found the committed grid needs **14.56M tokens against an 8M
 * per-account ceiling** (D25) — a 178% overrun that had been sitting in the
 * configuration undetected, in exactly the way the `max_tokens: 8_000_000`
 * string sat there never being compared against anything (D3).
 *
 * The projection is built from real file sizes in the committed cache, not from
 * an average. A grid whose cost is only affordable on average is not
 * affordable: `astropy/wcs/wcs.py` is 3,300 lines and
 * `matplotlib/figure.py` is 3,444, and whole-file context means those dominate.
 */

import type { Config } from "../../core/config.ts";
import type { Task } from "../../core/types.ts";
import { getTaskFile } from "../tasks/files.ts";
import { tryLocalise } from "../tasks/localise.ts";
import type { PlannedCell } from "./enumerate.ts";

/**
 * Characters per token, measured rather than assumed.
 *
 * Step 5's live cell: a 4,015-character prompt billed 899 prompt tokens. The
 * ratio differs per tokenizer — the same probe billed 63 tokens on `muse_30b`
 * and 23 on `nemotron_ultra` (D17) — so this is an estimate and the ledger
 * always corrects it with the provider's own count.
 */
export const CHARS_PER_TOKEN = 4015 / 899;

/** Template overhead: the fixed scaffolding around the task-specific text. */
export const TEMPLATE_CHARS = 1_100;

/**
 * What the conditions that look backwards add to a prompt.
 *
 * Measured on step 5's live cell, whose response was 3,361 characters. The
 * evidence block is capped at 3,000 by the original's own truncation rule.
 */
export const PREVIOUS_ATTEMPT_CHARS = 3_400;
export const EVIDENCE_CHARS = 3_000;

/** Completion tokens per cell, measured; capped by the model's own ceiling. */
export const COMPLETION_TOKENS = 1_400;

export interface CellEstimate {
  promptTokens: number;
  completionTokens: number;
  total: number;
}

export interface ProviderProjection {
  provider: string;
  cells: number;
  tokens: number;
  /** Keys with a value set — the per-key multiplier comes from this. */
  keysSet: number;
  capacityTokens: number;
  capacityCalls: number;
  pctTokens: number;
  pctCalls: number;
  fits: boolean;
}

export interface Projection {
  totalCells: number;
  totalTokens: number;
  byArm: { arm: string; cells: number; tokens: number }[];
  byProvider: ProviderProjection[];
  /** Arms whose removal would bring the worst provider inside its ceiling. */
  worstArms: string[];
  fits: boolean;
  /** Cells whose file could not be sized — counted, never silently ignored. */
  unsized: number;
}

export function estimateCell(
  cfg: Config,
  p: PlannedCell,
  task: Task,
  fileBytes: number,
): CellEstimate {
  let chars = TEMPLATE_CHARS + task.problemStatement.length + fileBytes;
  if (p.cell.strategy === "l2_reflection") chars += PREVIOUS_ATTEMPT_CHARS;
  if (p.cell.strategy === "l2_5_diagnose_revise") {
    chars += PREVIOUS_ATTEMPT_CHARS + EVIDENCE_CHARS;
  }
  const promptTokens = Math.ceil(chars / CHARS_PER_TOKEN);
  const maxOut = cfg.models[p.cell.model]?.maxTokens ?? COMPLETION_TOKENS;
  const completionTokens = Math.min(COMPLETION_TOKENS, maxOut);
  return { promptTokens, completionTokens, total: promptTokens + completionTokens };
}

/**
 * Projects the whole grid.
 *
 * Reads file sizes from the cache only — `allowNetwork: false`. A projection
 * that fetched 60 files from GitHub would be slow and would fail offline, and
 * the whole point is to answer "can this run?" before committing to anything.
 * An unsized cell is counted and reported rather than assumed free.
 */
export async function project(
  cfg: Config,
  cells: PlannedCell[],
  tasks: Map<string, Task>,
): Promise<Projection> {
  const armTokens = new Map<string, { cells: number; tokens: number }>();
  const provTokens = new Map<string, { cells: number; tokens: number }>();
  const fileBytes = new Map<string, number>();
  let unsized = 0;
  let totalTokens = 0;

  for (const p of cells) {
    const task = tasks.get(p.cell.taskId);
    if (!task) throw new Error(`cell names unknown task ${p.cell.taskId}`);

    let bytes = fileBytes.get(p.cell.taskId);
    if (bytes === undefined) {
      const loc = tryLocalise(task);
      if (!loc.ok) {
        unsized++;
        bytes = 0;
      } else {
        try {
          const f = await getTaskFile(task, loc.path, { allowNetwork: false });
          bytes = f.meta.bytes;
        } catch {
          unsized++;
          bytes = 0;
        }
      }
      fileBytes.set(p.cell.taskId, bytes);
    }

    const est = estimateCell(cfg, p, task, bytes);
    totalTokens += est.total;

    const a = armTokens.get(p.arm) ?? { cells: 0, tokens: 0 };
    a.cells++;
    a.tokens += est.total;
    armTokens.set(p.arm, a);

    const v = provTokens.get(p.provider) ?? { cells: 0, tokens: 0 };
    v.cells++;
    v.tokens += est.total;
    provTokens.set(p.provider, v);
  }

  const byProvider: ProviderProjection[] = [];
  for (const [provider, v] of [...provTokens].sort()) {
    const ceiling = cfg.budget.providers[provider];
    const pc = cfg.providers[provider];
    const keysSet = (pc?.apiKeyEnv ?? []).filter(
      (n) => (process.env[n] ?? "").length > 0,
    ).length;

    // With no keys set the multiplier would be zero, which would report every
    // grid as impossible. Project against one account instead and let `doctor`
    // be the thing that complains about missing keys.
    const n = ceiling?.perKey ? Math.max(keysSet, 1) : 1;
    const capacityTokens = (ceiling?.maxTokens ?? 0) * n;
    const capacityCalls = (ceiling?.maxCalls ?? 0) * n;

    byProvider.push({
      provider,
      cells: v.cells,
      tokens: v.tokens,
      keysSet,
      capacityTokens,
      capacityCalls,
      pctTokens: capacityTokens === 0 ? Infinity : (v.tokens / capacityTokens) * 100,
      pctCalls: capacityCalls === 0 ? Infinity : (v.cells / capacityCalls) * 100,
      fits: v.tokens <= capacityTokens && v.cells <= capacityCalls,
    });
  }

  const byArm = [...armTokens]
    .map(([arm, v]) => ({ arm, ...v }))
    .sort((a, b) => b.tokens - a.tokens);

  // Which arms to name when it does not fit: the biggest contributors on the
  // providers that overflow, largest first. Naming them is the difference
  // between a useful refusal and an unhelpful one.
  const overflowing = new Set(
    byProvider.filter((p) => !p.fits).map((p) => p.provider),
  );
  const worstArms = overflowing.size === 0
    ? []
    : byArm
        .filter((a) =>
          cells.some(
            (c) => c.arm === a.arm && overflowing.has(c.provider),
          ),
        )
        .map((a) => a.arm);

  return {
    totalCells: cells.length,
    totalTokens,
    byArm,
    byProvider,
    worstArms,
    fits: byProvider.every((p) => p.fits),
    unsized,
  };
}

const m = (n: number) => `${(n / 1e6).toFixed(2)}M`;

export function formatProjection(p: Projection): string[] {
  const out: string[] = [];
  out.push(`${p.totalCells} cells, ${m(p.totalTokens)} tokens projected`);
  out.push("");
  out.push("by arm:");
  for (const a of p.byArm) {
    out.push(`  ${a.arm.padEnd(20)} ${String(a.cells).padStart(5)} cells  ${m(a.tokens)}`);
  }
  out.push("");
  out.push("against capacity:");
  for (const v of p.byProvider) {
    const keys = v.keysSet > 1 ? `  [${v.keysSet} keys]` : "";
    out.push(
      `  ${v.provider.padEnd(11)} ${m(v.tokens)} / ${m(v.capacityTokens)} tokens ` +
        `(${v.pctTokens.toFixed(0)}%)  ${v.cells} / ${v.capacityCalls} calls ` +
        `(${v.pctCalls.toFixed(0)}%)${keys}${v.fits ? "" : "   EXCEEDS"}`,
    );
  }
  if (p.unsized > 0) {
    out.push("");
    out.push(
      `  ${p.unsized} cell(s) could not be sized from the cache — run ` +
        `\`bun run warm-cache\`; they are projected as 0 and the real cost is higher`,
    );
  }
  return out;
}
