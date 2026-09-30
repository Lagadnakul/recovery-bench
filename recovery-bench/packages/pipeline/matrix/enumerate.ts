/**
 * Cell enumeration.
 *
 * Every cell that will ever exist is listed before a single call is made. That
 * is the architectural commitment the whole project rests on: a cell cannot go
 * missing if the complete set is known in advance and each one must be
 * accounted for afterwards. The original study had no such list, which is how
 * 22 evaluations came to exist with no record (D15) and 8 of 24 planned cells
 * silently ceased to exist (D2).
 *
 * The other job here is **lineage**. Round 2 of a condition is shown round 1's
 * response, so those two cells are ordered with respect to each other while
 * being independent of every other lineage. Getting that wrong would either
 * serialise the whole sweep or feed round 2 an empty history.
 */

import type { Config } from "../../core/config.ts";
import type { Cell, Task } from "../../core/types.ts";
import { cellKey } from "../../core/types.ts";
import { resolveTaskSet } from "../tasks/dataset.ts";

/** A cell plus the arm that produced it — needed for `skip_arm` and reporting. */
export interface PlannedCell {
  cell: Cell;
  arm: string;
  /** Provider that will be billed, resolved from the model. */
  provider: string;
}

/**
 * All rounds of one condition on one task, in order.
 *
 * Cells within a lineage must run sequentially; lineages are independent of
 * each other and are what the sweep parallelises over.
 */
export interface Lineage {
  /** Stable identity: the cell key with the round removed. */
  id: string;
  arm: string;
  provider: string;
  taskId: string;
  /** Ascending by round. */
  cells: PlannedCell[];
}

/**
 * Conditions that need something to look back on.
 *
 * Each of these reads a previous attempt, so a lineage containing only them
 * can never start. In the original the prior was the baseline: `day8_test` is
 * round R0 and every condition's R1 reflected on it.
 */
const NEEDS_PRIOR = new Set(["l2_reflection", "l2_5_diagnose_revise"]);

/**
 * The group a baseline is shared across.
 *
 * One baseline attempt per task, model, format, thinking and repeat — and all
 * three conditions of that group reflect on the same one, exactly as the
 * original had one `day8_test` attempt per task feeding all three conditions.
 * Deliberately excludes the strategy: a per-condition baseline would give each
 * condition a different failure to recover from, and the comparison between
 * them would no longer be about the condition.
 */
export function baselineGroupId(c: Cell): string {
  return [
    c.taskId,
    c.model,
    c.editFormat,
    c.thinking ? "think" : "nothink",
    `n${c.repeat}`,
  ].join("|");
}

/** Cell key without the round — the lineage a cell belongs to. */
export function lineageId(c: Cell): string {
  return [
    c.taskId,
    c.strategy,
    c.model,
    c.editFormat,
    c.thinking ? "think" : "nothink",
    `n${c.repeat}`,
  ].join("|");
}

/**
 * Expands the enabled arms into cells.
 *
 * Iteration order is fixed — arms in config order, then tasks in the order the
 * task set resolves them, then models, strategies, formats, thinking, repeat,
 * round. Determinism matters because it decides which cells get run first when
 * a budget runs out partway, and a non-reproducible truncation point would make
 * two runs of the same config incomparable.
 */
export function enumerateCells(
  cfg: Config,
  tasks: Map<string, Task>,
): PlannedCell[] {
  const out: PlannedCell[] = [];

  for (const [armName, arm] of Object.entries(cfg.grid)) {
    if (!arm.enabled) continue;
    const set = resolveTaskSet(arm.tasks, cfg, tasks);

    for (const task of set) {
      for (const model of arm.models) {
        const m = cfg.models[model];
        if (!m) {
          throw new Error(`arm ${armName} names unknown model "${model}"`);
        }
        for (const strategy of arm.strategies) {
          for (const editFormat of arm.editFormats) {
            for (const thinking of arm.thinking) {
              for (let repeat = 0; repeat < arm.repeats; repeat++) {
                for (let round = 1; round <= arm.rounds; round++) {

                  out.push({
                    arm: armName,
                    provider: m.provider,
                    cell: {
                      taskId: task.instanceId,
                      strategy: strategy as Cell["strategy"],
                      model,
                      editFormat,
                      thinking,
                      round,
                      repeat,
                    },
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // ─────────────────────────────────────── round 0: the shared baseline
  //
  // Any arm containing a condition that looks backwards needs a baseline for
  // it to look back at. Without this, Reflection-only and Diagnose+Revise are
  // structurally unreachable — measured on the first live sweep as 16 of 24
  // cells refusing (D26).
  //
  // One baseline per group, inserted before the cells that depend on it, and
  // only where a dependent condition actually exists: an arm of pure
  // `l0_baseline` (a5) already has its own round-1 cells and needs nothing
  // added.
  const baselines: PlannedCell[] = [];
  const haveBaseline = new Set<string>();

  for (const p of out) {
    if (!NEEDS_PRIOR.has(p.cell.strategy)) continue;
    const group = baselineGroupId(p.cell);
    if (haveBaseline.has(group)) continue;
    haveBaseline.add(group);
    baselines.push({
      arm: p.arm,
      provider: p.provider,
      cell: { ...p.cell, strategy: "l0_baseline", round: 0 },
    });
  }

  // Baselines first: the sweep runs them before the lineages that read them.
  const all = [...baselines, ...out];

  // Every cell must be uniquely identified, or a "missing cell" check could be
  // satisfied by the wrong row.
  const seen = new Set<string>();
  for (const p of all) {
    const k = cellKey(p.cell);
    if (seen.has(k)) {
      throw new Error(
        `duplicate cell key ${k} — the grid produces the same cell twice, so ` +
          `one result would overwrite the other`,
      );
    }
    seen.add(k);
  }

  return all;
}

/** Groups cells into lineages, preserving enumeration order. */
export function toLineages(cells: PlannedCell[]): Lineage[] {
  const byId = new Map<string, Lineage>();

  for (const p of cells) {
    const id = lineageId(p.cell);
    const existing = byId.get(id);
    if (existing) {
      existing.cells.push(p);
    } else {
      byId.set(id, {
        id,
        arm: p.arm,
        provider: p.provider,
        taskId: p.cell.taskId,
        cells: [p],
      });
    }
  }

  for (const l of byId.values()) {
    l.cells.sort((a, b) => a.cell.round - b.cell.round);
  }
  return [...byId.values()];
}

export interface GridSummary {
  totalCells: number;
  lineages: number;
  byArm: Record<string, number>;
  byProvider: Record<string, number>;
  byStrategy: Record<string, number>;
  /** Arms present in config but switched off. */
  disabledArms: string[];
}

export function summarise(cfg: Config, cells: PlannedCell[]): GridSummary {
  const byArm: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  const byStrategy: Record<string, number> = {};

  for (const p of cells) {
    byArm[p.arm] = (byArm[p.arm] ?? 0) + 1;
    byProvider[p.provider] = (byProvider[p.provider] ?? 0) + 1;
    byStrategy[p.cell.strategy] = (byStrategy[p.cell.strategy] ?? 0) + 1;
  }

  return {
    totalCells: cells.length,
    lineages: toLineages(cells).length,
    byArm,
    byProvider,
    byStrategy,
    disabledArms: Object.entries(cfg.grid)
      .filter(([, a]) => !a.enabled)
      .map(([n]) => n),
  };
}
