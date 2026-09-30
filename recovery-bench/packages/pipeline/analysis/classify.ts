/**
 * Failure class, derived.
 *
 * ## What this replaces
 *
 * `reports/data/build_master_table.py` opens with:
 *
 * > *"Nothing in this script invents a number. Every cell is read from a
 * > report.json produced by `swebench.harness.run_evaluation`."*
 *
 * That holds for 38 of its 42 records. The other four are written as a literal:
 *
 * ```python
 * for t in ["astropy__astropy-14182", "django__django-11039",
 *           "django__django-11583", "django__django-11620"]:
 *     w(f"| {n} | `{t}` | **no** | ERROR (malformed patch) | n/a | n/a |")
 * w("- Patch never applied (format-class failure): **4/20**")
 * ```
 *
 * and `FAILURE_CLASS` — the logic/format split the entire thesis rests on — is a
 * hand-maintained dict.
 *
 * **The four values are correct.** `day8_test` holds exactly 20 instance
 * directories, 16 with a `report.json`, and the 4 without are exactly those 4
 * ids. Nothing in the submitted document is wrong.
 *
 * But the script could not derive them, because it only ever looked at
 * `report.json` files, and an apply failure does not produce one. The evidence
 * was in `run_instance.log` the whole time. Deriving it here turns a constant
 * into a claim that `tests/analysisClassify.test.ts` checks.
 */

import { isFormatClass } from "@rb/core";
import type { ArchiveRow } from "./load.ts";
import { BASELINE_RUN, FAILURE_POOL, RECITATION_EXCLUDED } from "./runs.ts";

/**
 * - `logic`  — the patch applied, and FAIL_TO_PASS tests still failed.
 *              The model's reasoning was wrong.
 * - `format` — the patch never reached the repository at all.
 *              Nothing can be said about the reasoning until this is fixed.
 */
export type FailureClass = "logic" | "format";

/** The class of a single baseline cell, from its outcome alone. */
export function classifyRow(row: ArchiveRow): FailureClass {
  return isFormatClass(row.row.outcome) ? "format" : "logic";
}

/**
 * Derive the failure class of every unresolved baseline task.
 *
 * Only `day8_test` is consulted: the class is a property of how a task failed
 * *at baseline*, which is what makes the pool a fair input to every recovery
 * condition. A later run failing differently does not reclassify it.
 */
export function deriveFailureClasses(rows: ArchiveRow[]): Map<string, FailureClass> {
  const out = new Map<string, FailureClass>();
  for (const r of rows) {
    if (r.run !== BASELINE_RUN) continue;
    // A resolved task is not a failure and has no class.
    if (r.row.verification === "test" && r.row.resolved) continue;
    out.set(r.row.cell.taskId, classifyRow(r));
  }
  return out;
}

/** Tasks unresolved at baseline, in SWE-bench Lite order. */
export function deriveFailurePool(rows: ArchiveRow[]): string[] {
  return [...deriveFailureClasses(rows).keys()].sort();
}

export interface PoolComparison {
  derived: string[];
  hardcoded: readonly string[];
  matches: boolean;
  missing: string[];
  unexpected: string[];
}

/** Compare the derived pool with the one the submitted tables declare. */
export function comparePool(rows: ArchiveRow[]): PoolComparison {
  const derived = deriveFailurePool(rows);
  const d = new Set(derived);
  const h = new Set(FAILURE_POOL);
  return {
    derived,
    hardcoded: FAILURE_POOL,
    matches: derived.length === FAILURE_POOL.length && derived.every((t) => h.has(t)),
    missing: FAILURE_POOL.filter((t) => !d.has(t)),
    unexpected: derived.filter((t) => !h.has(t)),
  };
}

/**
 * Whether a pool task has any recovery evidence.
 *
 * `astropy__astropy-14182` has none: it fails APPLY at baseline like the other
 * format-class tasks, but no recovery directory exists for it in any run,
 * because Gemini refused to generate and cited RECITATION. That is an *absence*
 * of directories, which cannot be read from a log — see `RECITATION_EXCLUDED`.
 */
export function evaluableTasks(rows: ArchiveRow[]): string[] {
  const seen = new Set(rows.filter((r) => r.run !== BASELINE_RUN).map((r) => r.row.cell.taskId));
  return FAILURE_POOL.filter((t) => seen.has(t));
}

export function excludedTasks(rows: ArchiveRow[]): string[] {
  const evaluable = new Set(evaluableTasks(rows));
  return FAILURE_POOL.filter((t) => !evaluable.has(t));
}

/**
 * Tasks recovered by any condition after baseline.
 *
 * `resolved` is only legible on a test-verified row, and the narrowing below is
 * what makes that explicit — an apply-verified row has `resolved: null` and can
 * never be counted as a recovery.
 */
export function recoveredTasks(rows: ArchiveRow[]): string[] {
  const out = new Set<string>();
  for (const r of rows) {
    if (r.run === BASELINE_RUN) continue;
    if (r.row.verification !== "test") continue;
    if (r.row.resolved) out.add(r.row.cell.taskId);
  }
  return [...out].sort();
}

export { RECITATION_EXCLUDED };
