/**
 * Every headline number in Chapter 5, computed and pinned.
 *
 * Each expectation below is a figure that currently appears in `Self.docx` as
 * prose, in `master_table.md` as a formatted string, and in a draw.io shape as a
 * typed literal — three copies, none of which checks the others. These tests are
 * the fourth, and the only one derived from the logs.
 */

import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { loadArchive, ARCHIVE_RUNS } from "../packages/pipeline/analysis/load.ts";
import {
  baselineResolveRate,
  baselineResolved,
  baselineUnresolved,
  baselineApplyFailed,
  headline,
  logicCoverage,
  subTestTrace,
  findCell,
  p2pBroken,
} from "../packages/pipeline/analysis/aggregate.ts";
import { deriveFailureClasses, recoveredTasks } from "../packages/pipeline/analysis/classify.ts";

const hasArchive = existsSync(ARCHIVE_RUNS);

describe.skipIf(!hasArchive)("the headline figures", () => {
  test("baseline resolve rate is 12/20 = 60%", async () => {
    const { rows } = await loadArchive();
    const r = baselineResolveRate(rows);
    expect(r.resolved).toBe(12);
    expect(r.n).toBe(20);
    expect(Math.round(r.pct)).toBe(60);
  });

  test("the denominator is the pilot size, not the number of reports", async () => {
    // Dividing by 16 — the cells that produced a report — would score the run on
    // the survivors only. That is precisely the survivorship error this whole
    // project exists to correct: an unapplied patch is a failure, not a gap.
    const { rows } = await loadArchive();
    expect(baselineResolveRate(rows).n).toBe(20);
    expect(baselineResolved(rows).length + baselineUnresolved(rows).length).toBe(16);
    expect(baselineApplyFailed(rows)).toHaveLength(4);
  });

  test("the failure pool splits 4 logic / 4 format", async () => {
    const { rows } = await loadArchive();
    const classes = [...deriveFailureClasses(rows).values()];
    expect(classes.filter((c) => c === "logic")).toHaveLength(4);
    expect(classes.filter((c) => c === "format")).toHaveLength(4);
  });

  test("THE FINDING: 3/7 recovered — 0/4 logic, 3/3 format", async () => {
    const { rows } = await loadArchive();
    const h = headline(rows);
    expect(h.evaluable).toBe(7);
    expect(h.recovered).toEqual([
      "django__django-11039",
      "django__django-11583",
      "django__django-11620",
    ]);
    expect(h.recoveredLogic).toEqual([]);
    expect(h.recoveredLogic.length).toBe(0);
    expect(h.logicTasks).toHaveLength(4);
    expect(h.recoveredFormat).toHaveLength(3);
    expect(h.formatTasksEvaluable).toHaveLength(3);
  });

  test("every recovery was format-class — the claim stated as a set operation", async () => {
    const { rows } = await loadArchive();
    const classes = deriveFailureClasses(rows);
    for (const t of recoveredTasks(rows)) {
      expect(classes.get(t), t).toBe("format");
    }
  });

  test("the 22 cells the original pipeline could not see are counted", async () => {
    const { rows } = await loadArchive();
    expect(headline(rows).applyFailedCells).toBe(9);
  });
});

describe.skipIf(!hasArchive)("coverage", () => {
  test("16 of 24 logic-class cells were evaluated", async () => {
    // Reported because the gaps are a free-tier quota artefact, not a selection
    // decision — a consistency claim is worth little without this denominator.
    const { rows } = await loadArchive();
    const classes = deriveFailureClasses(rows);
    const logic = [...classes.keys()].filter((t) => classes.get(t) === "logic").sort();
    const cov = logicCoverage(rows, logic);
    expect(cov.totalCells).toBe(24);
    expect(cov.evaluatedCells).toBe(16);
  });
});

describe.skipIf(!hasArchive)("the sub-test trace on django-11019", () => {
  test("baseline is 0/16 with 33 P2P broken", async () => {
    const { rows } = await loadArchive();
    const trace = subTestTrace(rows, "django__django-11019");
    expect(trace[0]!.label).toBe("Baseline (unified diff)");
    expect(trace[0]!.f2pPassed).toBe(0);
    expect(trace[0]!.f2pTotal).toBe(16);
    expect(trace[0]!.p2pBroken).toBe(33);
  });

  test("all six recovery cells return an identical 6/16 with no regressions", async () => {
    // Finding 2: richer post-failure information changed nothing. Computed
    // rather than asserted, because the figure's caption depends on it.
    const { rows } = await loadArchive();
    const recovery = subTestTrace(rows, "django__django-11019").slice(1);
    expect(recovery).toHaveLength(6);
    for (const c of recovery) {
      expect(c.f2pPassed, c.label).toBe(6);
      expect(c.f2pTotal, c.label).toBe(16);
      expect(c.p2pBroken, c.label).toBe(0);
    }
  });
});

describe.skipIf(!hasArchive)("the counter-signal", () => {
  test("Diagnose+Revise broke 8 P2P tests on django-11283 where Blind Retry broke none", async () => {
    // Worth a test of its own: it is the one result in the chapter that runs
    // against the project's own thesis, and averaging it away would be easy.
    const { rows } = await loadArchive();
    const diagnose = findCell(rows, {
      taskId: "django__django-11283",
      condition: "Diagnose+Revise",
      round: "R1",
      format: "sr",
    });
    const blind = findCell(rows, {
      taskId: "django__django-11283",
      condition: "Blind Retry",
      round: "R1",
      format: "sr",
    });
    expect(p2pBroken(diagnose)).toBe(8);
    expect(p2pBroken(blind)).toBe(0);
  });
});
