/**
 * The hand-written constant, turned into a checked claim.
 *
 * `reports/data/build_master_table.py` declares:
 *
 * > *"Nothing in this script invents a number. Every cell is read from a
 * > report.json produced by `swebench.harness.run_evaluation`."*
 *
 * That is true of 38 of its 42 records. The logic/format split — the distinction
 * the whole thesis turns on — is a dict somebody typed:
 *
 * ```python
 * FAILURE_CLASS = { "astropy__astropy-7746": "logic", ..., "django__django-11620": "format" }
 * ```
 *
 * It could not have been derived there, because an apply failure produces no
 * `report.json` and the script only ever globs for those. The evidence was in
 * `run_instance.log` all along.
 *
 * These tests derive the split from outcomes and compare. **They are the point
 * of build-order step 3.** If they pass, a constant in the thesis's own pipeline
 * has become a result. If they ever fail, either the dissertation's central
 * classification is wrong or this pipeline is — and that is worth knowing either
 * way.
 */

import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { loadArchive, ARCHIVE_RUNS } from "../packages/pipeline/analysis/load.ts";
import {
  classifyRow,
  comparePool,
  deriveFailureClasses,
  deriveFailurePool,
  recoveredTasks,
} from "../packages/pipeline/analysis/classify.ts";
import { HARDCODED_FAILURE_CLASS } from "../packages/pipeline/analysis/replay.ts";
import { FAILURE_POOL, BASELINE_RUN } from "../packages/pipeline/analysis/runs.ts";

const hasArchive = existsSync(ARCHIVE_RUNS);

describe.skipIf(!hasArchive)("THE CLAIM: the failure class is derivable", () => {
  test("the derived map equals build_master_table.py's FAILURE_CLASS exactly", async () => {
    const { rows } = await loadArchive();
    const derived = Object.fromEntries([...deriveFailureClasses(rows)].sort());
    expect(derived).toEqual(HARDCODED_FAILURE_CLASS);
  });

  test("it covers all 8 pool tasks and nothing else", async () => {
    const { rows } = await loadArchive();
    expect(deriveFailurePool(rows)).toEqual([...FAILURE_POOL].sort());
  });

  test("the pool itself is derived, not read from failure_pool.json", async () => {
    const { rows } = await loadArchive();
    const cmp = comparePool(rows);
    expect(cmp.matches).toBe(true);
    expect(cmp.missing).toEqual([]);
    expect(cmp.unexpected).toEqual([]);
  });

  test("the archive's own failure_pool.json agrees", async () => {
    // A third, independent copy of the same list, written by the original code.
    const onDisk = (await Bun.file("archive/legacy_aggregates/failure_pool.json").json()) as string[];
    expect([...onDisk].sort()).toEqual([...FAILURE_POOL].sort());
  });
});

describe.skipIf(!hasArchive)("what the classification means", () => {
  test("format-class cells never reached the repository", async () => {
    const { rows } = await loadArchive();
    const classes = deriveFailureClasses(rows);
    for (const r of rows.filter((r) => r.run === BASELINE_RUN)) {
      const cls = classes.get(r.row.cell.taskId);
      if (cls !== "format") continue;
      expect(r.row.outcome.kind, r.row.cell.taskId).toBe("APPLY_FAIL");
      expect(r.row.verification).toBe("apply");
    }
  });

  test("logic-class cells applied cleanly and then failed their tests", async () => {
    const { rows } = await loadArchive();
    const classes = deriveFailureClasses(rows);
    for (const r of rows.filter((r) => r.run === BASELINE_RUN)) {
      const cls = classes.get(r.row.cell.taskId);
      if (cls !== "logic") continue;
      expect(r.row.verification, r.row.cell.taskId).toBe("test");
      expect(r.row.resolved).toBe(false);
      // Applied, but not a single required test passed or partially passed
      // enough to resolve it.
      expect(r.tests!.f2pPassed).toBeLessThan(r.tests!.f2pTotal);
    }
  });

  test("a resolved baseline task has no failure class at all", async () => {
    const { rows } = await loadArchive();
    const classes = deriveFailureClasses(rows);
    const resolved = rows.filter(
      (r) => r.run === BASELINE_RUN && r.row.verification === "test" && r.row.resolved,
    );
    expect(resolved).toHaveLength(12);
    for (const r of resolved) expect(classes.has(r.row.cell.taskId)).toBe(false);
  });
});

describe("classifyRow, unit", () => {
  const mk = (kind: string) =>
    ({ row: { outcome: { kind } } }) as unknown as Parameters<typeof classifyRow>[0];

  test("outcomes where the patch never landed are format-class", () => {
    for (const kind of ["APPLY_FAIL", "MALFORMED", "NO_PATCH"]) {
      expect(classifyRow(mk(kind)), kind).toBe("format");
    }
  });

  test("outcomes where the patch landed are logic-class", () => {
    for (const kind of ["APPLIED", "CONTAMINATED"]) {
      expect(classifyRow(mk(kind)), kind).toBe("logic");
    }
  });
});

describe.skipIf(!hasArchive)("recovery", () => {
  test("only test-verified rows can count as a recovery", async () => {
    // An apply-verified row has resolved: null. If one could be counted, a patch
    // that merely applied would look like a solved task.
    const { rows } = await loadArchive();
    const recovered = recoveredTasks(rows);
    for (const t of recovered) {
      const evidence = rows.filter(
        (r) => r.row.cell.taskId === t && r.run !== BASELINE_RUN && r.row.verification === "test" && r.row.resolved,
      );
      expect(evidence.length, t).toBeGreaterThan(0);
    }
  });

  test("no logic-class task was recovered by any strategy in any round", async () => {
    const { rows } = await loadArchive();
    const classes = deriveFailureClasses(rows);
    const logicRecovered = recoveredTasks(rows).filter((t) => classes.get(t) === "logic");
    expect(logicRecovered).toEqual([]);
  });
});
