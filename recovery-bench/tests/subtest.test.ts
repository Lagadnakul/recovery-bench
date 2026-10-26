/**
 * Phase 1b, pinned: partial credit does not rescue the power problem.
 *
 * These tests exist because the sub-test idea is the first thing a reviewer will
 * suggest — `django-11019` has 16 FAIL_TO_PASS tests, so scoring partial credit
 * looks obviously better than a binary outcome. The numbers below are the reason
 * it is not, and they are checked against the frozen dataset and the archive
 * rather than argued.
 */

import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { loadArchive, ARCHIVE_RUNS } from "../packages/pipeline/analysis/load.ts";
import { headline } from "../packages/pipeline/analysis/aggregate.ts";
import { minDiscordantPairs } from "../packages/pipeline/analysis/power.ts";
import {
  f2pDistribution,
  readTestCounts,
  pairedF2PDiffs,
  informativePairs,
  p2pRegressions,
  subTestVerdict,
  H1_PAIR,
} from "../packages/pipeline/analysis/subtest.ts";

describe("f2pDistribution, on values computable by hand", () => {
  test("quantiles and buckets over a known vector", () => {
    const d = f2pDistribution([1, 1, 1, 1, 2, 2, 3, 6, 10, 10]);
    expect(d.n).toBe(10);
    expect(d.min).toBe(1);
    expect(d.max).toBe(10);
    expect(d.singleTest).toBe(4);
    expect(d.multiTest).toBe(6);
    expect(d.atLeastSix).toBe(3); // 6, 10, 10
    expect(d.mean).toBeCloseTo(3.7, 10);
  });

  test("buckets partition the sample exactly once", () => {
    const d = f2pDistribution([1, 1, 2, 4, 7, 12, 355]);
    expect(d.buckets.reduce((a, b) => a + b.count, 0)).toBe(d.n);
    expect(d.buckets.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1, 10);
  });

  test("an empty sample throws rather than returning NaN quantiles", () => {
    expect(() => f2pDistribution([])).toThrow();
  });

  test("singleTest and multiTest are complementary", () => {
    const d = f2pDistribution([1, 1, 1, 2, 3, 9]);
    expect(d.singleTest + d.multiTest).toBe(d.n);
  });
});

describe("the frozen dataset: there is barely any partial credit to be had", () => {
  test("THE FINDING: 64% of instances have exactly one FAIL_TO_PASS test", async () => {
    const counts = await readTestCounts();
    const d = f2pDistribution(counts.f2p);

    expect(d.n).toBe(300);
    expect(d.singleTest).toBe(192);
    expect(d.singleTest / d.n).toBeCloseTo(0.64, 2);
    // For those 192, a sub-test score and the binary outcome are the same number.
    expect(d.median).toBe(1);
  });

  test("the median task cannot express a partial difference at all", async () => {
    const d = f2pDistribution((await readTestCounts()).f2p);
    expect(d.median).toBe(1);
    expect(d.q75).toBe(2);
    expect(d.q90).toBe(3);
  });

  test("django-11019 is an outlier, not the typical case", async () => {
    const d = f2pDistribution((await readTestCounts()).f2p);
    // 16 sub-tests puts it in the top 3% — the example that makes the idea look
    // good is the least representative instance available.
    expect(d.atLeastSix / d.n).toBeLessThan(0.05);
    expect(d.max).toBe(355); // and the tail is one pathological instance
  });

  test("PASS_TO_PASS is the opposite story: nearly every task can show a regression", async () => {
    const counts = await readTestCounts();
    const withP2P = counts.p2p.filter((x) => x >= 1).length;
    expect(withP2P / counts.p2p.length).toBeGreaterThan(0.97);
    const sorted = [...counts.p2p].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]!).toBeGreaterThan(20);
  });
});

const hasArchive = existsSync(ARCHIVE_RUNS);

describe.skipIf(!hasArchive)("the pilot: every paired sub-test difference is zero", () => {
  test("THE FINDING: partial credit converts no tie into a usable pair", async () => {
    const { rows } = await loadArchive();
    const h = headline(rows);
    const diffs = pairedF2PDiffs(rows, h.logicTasks);

    expect(diffs.length).toBeGreaterThan(0); // pairs do exist to compare
    for (const d of diffs) expect(d.diff).toBe(0);
    expect(informativePairs(diffs)).toBe(0);
  });

  test("the pair compared is the one H1 names", async () => {
    const { rows } = await loadArchive();
    const h = headline(rows);
    for (const d of pairedF2PDiffs(rows, h.logicTasks)) {
      expect([d.strategyA, d.strategyB]).toEqual([...H1_PAIR]);
    }
  });

  test("identical scores, not merely identical verdicts", async () => {
    const { rows } = await loadArchive();
    const h = headline(rows);
    for (const d of pairedF2PDiffs(rows, h.logicTasks)) {
      expect(d.f2pA).toBe(d.f2pB);
    }
  });

  test("an unmatched round is omitted, never imputed as a zero difference", async () => {
    const { rows } = await loadArchive();
    const h = headline(rows);
    const diffs = pairedF2PDiffs(rows, h.logicTasks);
    // Four logic tasks over at most two rounds is eight possible pairs; coverage
    // is incomplete (D2/D3), so a smaller number here is the honest one.
    expect(diffs.length).toBeLessThanOrEqual(8);
  });

  test("the verdict is that sub-tests do not help, and it is below the floor", async () => {
    const { rows } = await loadArchive();
    const h = headline(rows);
    const v = subTestVerdict(rows, h.logicTasks, await readTestCounts(), minDiscordantPairs(0.05));

    expect(v.floor).toBe(6);
    expect(v.informative).toBe(0);
    expect(v.helps).toBe(false);
    expect(v.informative).toBeLessThan(v.floor);
  });
});

describe.skipIf(!hasArchive)("PASS_TO_PASS regressions did separate the strategies", () => {
  test("D4 reproduced: Diagnose+Revise broke 8 tests on django-11283", async () => {
    const { rows } = await loadArchive();
    const regs = p2pRegressions(rows);
    const hit = regs.find(
      (r) => r.taskId === "django__django-11283" && r.strategy === "l2_5_diagnose_revise",
    );
    expect(hit).toBeDefined();
    expect(hit!.broken).toBe(8);
  });

  test("Blind Retry broke none on that task — the difference is real", async () => {
    const { rows } = await loadArchive();
    const regs = p2pRegressions(rows);
    const blind = regs.filter(
      (r) => r.taskId === "django__django-11283" && r.strategy === "l1_blind_retry",
    );
    expect(blind.length).toBe(0); // only cells that broke something are listed
  });

  test("the baseline's 33 broken tests on django-11019 are the largest regression", async () => {
    const { rows } = await loadArchive();
    const regs = p2pRegressions(rows);
    expect(regs[0]!.broken).toBe(33);
    expect(regs[0]!.taskId).toBe("django__django-11019");
    expect(regs[0]!.strategy).toBe("l0_baseline");
  });

  test("regressions are sorted worst first, and every entry really broke something", async () => {
    const { rows } = await loadArchive();
    const regs = p2pRegressions(rows);
    for (const r of regs) {
      expect(r.broken).toBeGreaterThan(0);
      expect(r.broken).toBeLessThanOrEqual(r.p2pTotal);
    }
    for (let i = 1; i < regs.length; i++) {
      expect(regs[i - 1]!.broken).toBeGreaterThanOrEqual(regs[i]!.broken);
    }
  });

  test("unlike F2P, this outcome is NOT tied across strategies", async () => {
    const { rows } = await loadArchive();
    const regs = p2pRegressions(rows);
    const distinct = new Set(regs.map((r) => r.broken));
    expect(distinct.size).toBeGreaterThan(1);
  });
});
