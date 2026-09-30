/**
 * The Chapter 5 figures, checked against what they actually draw.
 *
 * `reports/data/make_figures.py` types every quantity directly into a draw.io
 * shape — `("Resolved&#xa;12", 12, ...)`, `f.box(620, 180, 70, 40, "6 of 16")`,
 * a fully literal `data` dict for the 5.3 matrix. Those figures agree with the
 * tables only because one person typed both.
 *
 * Each expectation below is quoted from that file, so a derived value drifting
 * away from what the submitted figure shows fails here. Figures are where a
 * stale number survives longest: everyone reads them as illustration rather than
 * as claim.
 */

import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { loadArchive, ARCHIVE_RUNS } from "../packages/pipeline/analysis/load.ts";
import { fig51, fig52, fig53, fig54, buildFigures } from "../packages/pipeline/analysis/figures.ts";

const hasArchive = existsSync(ARCHIVE_RUNS);

const committed = (await Bun.file("data/chapter5_figures.json").json()) as ReturnType<typeof buildFigures>;

describe("the committed figure data", () => {
  test("fig 5.1 — the stacked bar reads 12 / 4 / 4 over 20", () => {
    // make_figures.py: segs = [("Resolved&#xa;12", 12, ...), ("Logic&#xa;4", 4, ...),
    //                          ("Format&#xa;4", 4, ...)]
    const f = committed.fig5_1;
    expect(f.resolved).toBe(12);
    expect(f.logic).toBe(4);
    expect(f.format).toBe(4);
    expect(f.pool).toBe(8);
    expect(f.n).toBe(20);
    expect(f.resolved + f.logic + f.format).toBe(f.n);
  });

  test("fig 5.1 — the share column reads 60 / 20 / 20 / 40 per cent", () => {
    expect(committed.fig5_1.shares.map((s) => Math.round(s.pct))).toEqual([60, 20, 20, 40]);
  });

  test("fig 5.2 — 0 of 16 with 33 broken, then 6 of 16 with none", () => {
    // make_figures.py: f.box(620, 130, 70, 40, "0 of 16"); f.box(630, 294, 60, 40, "33")
    //                  f.box(620, 180, 70, 40, "6 of 16"); f.box(290, 344, 60, 40, "none")
    const f = committed.fig5_2;
    expect(f.taskId).toBe("django__django-11019");
    expect(f.baseline).toEqual({ f2pPassed: 0, f2pTotal: 16, p2pBroken: 33 });
    expect(f.retrofitted).toEqual({ f2pPassed: 6, f2pTotal: 16, p2pBroken: 0 });
  });

  test("fig 5.2 — the caption's claim of six identical cells is true", () => {
    // "Six independent generations, three strategies, two rounds" — if one of
    // them disagreed, the most load-bearing figure in the chapter would be
    // making a false claim.
    const f = committed.fig5_2;
    expect(f.cells).toHaveLength(6);
    expect(f.allIdentical).toBe(true);
  });

  test("fig 5.3 — 16 of 24 cells evaluated, none resolved", () => {
    // make_figures.py: "16 of the 24 cells were evaluated; 8 were not."
    const f = committed.fig5_3;
    expect(f.tasks).toHaveLength(4);
    expect(f.totalCells).toBe(24);
    expect(f.evaluatedCells).toBe(16);
    expect(f.resolvedCells).toBe(0);
  });

  test("fig 5.3 — an unevaluated cell is null, never a zero", () => {
    // The figure renders these as "not evaluated" and the caption promises they
    // "are never counted as failures". `null` carries that promise into data.
    const f = committed.fig5_3;
    const unevaluated = f.cells.filter((c) => c.score === null);
    expect(unevaluated).toHaveLength(f.totalCells - f.evaluatedCells);
    for (const c of unevaluated) expect(c.resolved).toBeNull();
  });

  test("fig 5.3 — the footnote's counter-signal is the real maximum", () => {
    // make_figures.py: "* Diagnose+Revise additionally broke 8 PASS_TO_PASS
    // tests on this cell. Blind Retry broke none."
    const cs = committed.fig5_3.counterSignal;
    expect(cs).not.toBeNull();
    expect(cs!.taskId).toBe("django__django-11283");
    expect(cs!.condition).toBe("Diagnose+Revise");
    expect(cs!.p2pBroken).toBe(8);
  });

  test("fig 5.4 — 1x / 2x / 3x input volume, zero resolved at every level", () => {
    // make_figures.py: conds = [("Blind Retry", 1, ...), ("Reflection-only", 2, ...),
    //                           ("Diagnose+Revise", 3, ...)] and f.box(..., "0", BOX_DASH) x3
    const f = committed.fig5_4;
    expect(f.conditions.map((c) => c.relativeInputVolume)).toEqual([1, 2, 3]);
    expect(f.conditions.map((c) => c.logicResolved)).toEqual([0, 0, 0]);
  });

  test("fig 5.4 — the cost multipliers are labelled as an input, not a measurement", () => {
    // The archive holds no usage records; the original never captured them.
    // Saying so in the data stops a later reader treating 3x as measured here.
    expect(committed.fig5_4.relativeVolumeSource).toContain("config.md");
    expect(committed.fig5_4.relativeVolumeSource).toContain("not measured");
  });
});

describe.skipIf(!hasArchive)("regeneration against the live archive", () => {
  test("the current code still produces the committed figure data", async () => {
    const { rows } = await loadArchive();
    expect(fig51(rows)).toEqual(committed.fig5_1);
    expect(fig52(rows)).toEqual(committed.fig5_2);
    expect(fig53(rows)).toEqual(committed.fig5_3);
    expect(fig54(rows)).toEqual(committed.fig5_4);
  });

  test("the figures agree with the tables they sit beside", async () => {
    // The whole reason to derive figure data: the two can now be compared.
    const { rows } = await loadArchive();
    const f = fig51(rows);
    const h = buildFigures(rows).headline;
    expect(f.resolved).toBe(h.baselineResolved);
    expect(f.pool).toBe(h.poolSize);
    expect(fig53(rows).resolvedCells).toBe(h.recoveredLogic.length);
  });
});
