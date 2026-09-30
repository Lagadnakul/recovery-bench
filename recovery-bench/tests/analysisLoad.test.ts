/**
 * The loader, and the claim that the 22 missing reports are apply failures.
 *
 * The interesting assertions here are the arithmetic ones. `95 patch.diff` and
 * `73 report.json` is a 22-file gap, and it either has a complete explanation or
 * the analysis is built on a guess. These tests are that explanation, written so
 * it fails if a future archive contains a kind of abort this loader does not
 * model.
 */

import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { loadArchive, scanArchive, ARCHIVE_RUNS, type ArchiveRow } from "../packages/pipeline/analysis/load.ts";
import { RUNS, IGNORE, RECITATION_EXCLUDED, BASELINE_RUN, BASELINE_N } from "../packages/pipeline/analysis/runs.ts";
import { evaluableTasks, excludedTasks } from "../packages/pipeline/analysis/classify.ts";

const hasArchive = existsSync(ARCHIVE_RUNS);

describe("the run registry", () => {
  test("RUNS and IGNORE do not overlap", () => {
    for (const run of Object.keys(RUNS)) expect(IGNORE.has(run)).toBe(false);
  });

  test("exactly one baseline run, at round R0", () => {
    const baselines = Object.entries(RUNS).filter(([, m]) => m.condition === "Baseline");
    expect(baselines).toHaveLength(1);
    expect(baselines[0]![0]).toBe(BASELINE_RUN);
    expect(baselines[0]![1].round).toBe("R0");
  });

  test("every recovery run is R1 or R2", () => {
    for (const [run, m] of Object.entries(RUNS)) {
      if (m.condition === "Baseline") continue;
      expect(["R1", "R2"], run).toContain(m.round);
    }
  });
});

describe.skipIf(!hasArchive)("loading the archive", () => {
  test("the whole 95-directory picture accounts for every instance dir", async () => {
    const dirs = await scanArchive();
    const { rows, unregistered, ignored } = await loadArchive();
    // Nothing is dropped silently: every scanned directory is either loaded,
    // ignored as a smoke test, or reported as unregistered.
    expect(rows.length + unregistered.length + ignored.length).toBe(dirs.length);
  });

  test("42 test-verified rows — the number build_master_table.py reports", async () => {
    const { rows } = await loadArchive();
    expect(rows.filter((r) => r.row.verification === "test")).toHaveLength(42);
  });

  test("THE GAP: every report-less directory is an apply failure", async () => {
    // If this ever fails, the archive contains an abort this loader models
    // wrongly, and the format-class count derived from it is not trustworthy.
    const { rows } = await loadArchive();
    const applyRows = rows.filter((r) => r.row.verification === "apply");
    expect(applyRows.length).toBeGreaterThan(0);
    for (const r of applyRows) {
      expect(r.row.outcome.kind, `${r.run}/${r.row.cell.taskId}`).toBe("APPLY_FAIL");
    }
  });

  test("each apply failure carries git's own words", async () => {
    const { rows } = await loadArchive();
    for (const r of rows.filter((r) => r.row.outcome.kind === "APPLY_FAIL")) {
      expect(r.gitError, `${r.run}/${r.row.cell.taskId}`).toBeTruthy();
      // These are the D13/D14 defect classes seen from git's side.
      expect(r.gitError!).toMatch(/patch: \*\*\*\*|EvaluationError/);
    }
  });

  test("the baseline pilot is 20 cells: 16 evaluated + 4 apply failures", async () => {
    const { rows } = await loadArchive();
    const base = rows.filter((r) => r.run === BASELINE_RUN);
    expect(base).toHaveLength(BASELINE_N);
    expect(base.filter((r) => r.row.verification === "test")).toHaveLength(16);
    expect(base.filter((r) => r.row.verification === "apply")).toHaveLength(4);
  });

  test("apply-verified rows carry no resolved flag and no sub-test counts", async () => {
    const { rows } = await loadArchive();
    for (const r of rows.filter((r) => r.row.verification === "apply")) {
      expect(r.row.resolved).toBeNull();
      expect(r.row.tests).toBeNull();
      expect(r.tests).toBeNull();
    }
  });

  test("unregistered runs are surfaced rather than dropped", async () => {
    const { unregistered } = await loadArchive();
    // build_master_table.py collapses "ignored smoke test" and "nobody
    // classified this run" into one `continue`. They are different things.
    const runs = [...new Set(unregistered.map((d) => d.run))].sort();
    expect(runs).toEqual(["day11_test", "day4_test", "day4_test2"]);
    for (const run of runs) expect(IGNORE.has(run)).toBe(false);
  });
});

describe.skipIf(!hasArchive)("the RECITATION exclusion", () => {
  test("astropy-14182 has a baseline cell but no recovery cell anywhere", async () => {
    const { rows } = await loadArchive();
    const all = rows.filter((r) => r.row.cell.taskId === RECITATION_EXCLUDED);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((r) => r.run === BASELINE_RUN)).toBe(true);
  });

  test("it is the only excluded pool task, and it is excluded by absence", async () => {
    const { rows } = await loadArchive();
    expect(excludedTasks(rows)).toEqual([RECITATION_EXCLUDED]);
    expect(evaluableTasks(rows)).toHaveLength(7);
  });

  test("the archive's own aggregate agrees on why", async () => {
    // The reason is not in any run log — it is an absence of directories. The
    // record lives here, so the exclusion is evidenced rather than declared.
    const results = (await Bun.file("archive/legacy_aggregates/master_results.json").json()) as Record<
      string,
      Record<string, string>
    >;
    const entry = results[RECITATION_EXCLUDED]!;
    expect(entry.baseline).toBe("ERROR (malformed)");
    for (const k of ["blind_retry", "reflection_only", "diagnose_revise"]) {
      expect(entry[k]).toContain("RECITATION");
    }
  });
});

describe.skipIf(!hasArchive)("row shape", () => {
  test("every row has a run id, a task id and a strategy", async () => {
    const { rows } = await loadArchive();
    for (const r of rows as ArchiveRow[]) {
      expect(r.row.runId).toBe(r.run);
      expect(r.row.cell.taskId).toBeTruthy();
      expect(r.row.cell.strategy).toBeTruthy();
      expect(r.row.cell.editFormat).toBe(r.format === "sr" ? "search_replace" : "unified_diff");
    }
  });
});
