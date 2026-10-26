/**
 * The power analysis, pinned.
 *
 * These figures go into the Stage 1 protocol and decide the task budget, so the
 * arithmetic is checked against values computable by hand rather than against
 * whatever the code happened to print first. Every expectation below is either a
 * closed-form value, a property of the test (monotonicity, type I error), or a
 * count derived from the archive.
 */

import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { loadArchive, ARCHIVE_RUNS } from "../packages/pipeline/analysis/load.ts";
import { headline } from "../packages/pipeline/analysis/aggregate.ts";
import {
  mcnemarExactP,
  mcnemarPower,
  minDiscordantPairs,
  smallestN,
  poolRates,
  expectedPool,
  tasksForLogicPool,
  powerCurve,
  powerReport,
  SCENARIOS,
} from "../packages/pipeline/analysis/power.ts";

/** Floating point comparison for probabilities. */
const near = (a: number, b: number, eps = 1e-12) => Math.abs(a - b) < eps;

describe("the exact McNemar p-value", () => {
  test("no discordant pairs is p = 1, not a divide by zero", () => {
    expect(mcnemarExactP(0, 0)).toBe(1);
  });

  test("a perfectly split result is p = 1", () => {
    // b === c is the least possible evidence of a difference.
    expect(mcnemarExactP(3, 3)).toBe(1);
    expect(mcnemarExactP(10, 10)).toBe(1);
  });

  test("the extreme split is exactly 2 / 2^m — the hand-computable case", () => {
    // All m discordances one way: p = 2 * (1/2)^m.
    for (const m of [1, 2, 3, 4, 5, 6, 10]) {
      expect(near(mcnemarExactP(m, 0), 2 * Math.pow(0.5, m))).toBe(true);
    }
    // Spelled out, because these two values decide the floor below.
    expect(near(mcnemarExactP(5, 0), 0.0625)).toBe(true);
    expect(near(mcnemarExactP(6, 0), 0.03125)).toBe(true);
  });

  test("a known asymmetric case matches the binomial by hand", () => {
    // m = 7, k = 1: 2 * (C(7,0) + C(7,1)) / 2^7 = 2 * 8/128 = 0.125
    expect(near(mcnemarExactP(6, 1), 0.125)).toBe(true);
    // m = 8, k = 1: 2 * (1 + 8) / 256 = 0.0703125
    expect(near(mcnemarExactP(7, 1), 0.0703125)).toBe(true);
    // m = 10, k = 1: 2 * (1 + 10) / 1024 = 0.021484375
    expect(near(mcnemarExactP(9, 1), 0.021484375)).toBe(true);
  });

  test("it is symmetric in its arguments", () => {
    for (const [b, c] of [[7, 2], [9, 1], [12, 5]] as const) {
      expect(mcnemarExactP(b, c)).toBe(mcnemarExactP(c, b));
    }
  });

  test("p is never above 1, however lopsided the counts", () => {
    for (let b = 0; b <= 20; b++) {
      for (let c = 0; c <= 20; c++) expect(mcnemarExactP(b, c)).toBeLessThanOrEqual(1);
    }
  });

  test("negative or fractional counts throw rather than returning a number", () => {
    expect(() => mcnemarExactP(-1, 2)).toThrow();
    expect(() => mcnemarExactP(1.5, 2)).toThrow();
  });
});

describe("THE FLOOR: six discordant pairs, or no power at all", () => {
  test("alpha = 0.05 needs six", () => {
    expect(minDiscordantPairs(0.05)).toBe(6);
  });

  test("five cannot reject even when every pair favours one side", () => {
    expect(mcnemarExactP(5, 0)).toBeGreaterThan(0.05);
  });

  test("a stricter alpha raises the floor, a looser one lowers it", () => {
    expect(minDiscordantPairs(0.01)).toBe(8); // 2 * 0.5^8 = 0.0078
    expect(minDiscordantPairs(0.1)).toBe(5); // 2 * 0.5^5 = 0.0625
  });

  test("below the floor, power is exactly zero for every effect size", () => {
    // Not "low power" — the rejection region is empty, so no data can reject.
    for (const s of SCENARIOS) {
      for (let n = 1; n < 6; n++) {
        expect(mcnemarPower({ n, pOnlyA: s.pOnlyA, pOnlyB: s.pOnlyB })).toBe(0);
      }
    }
  });
});

describe("exact power behaves like a power function", () => {
  test("n = 0 has no power", () => {
    expect(mcnemarPower({ n: 0, pOnlyA: 0.2, pOnlyB: 0.05 })).toBe(0);
  });

  test("under the null, rejection stays at or below alpha", () => {
    // pOnlyA === pOnlyB is the null. The exact test is conservative, so this is
    // the type I error rate and it must never exceed the nominal level.
    for (const n of [10, 25, 50, 100, 150]) {
      const alpha = 0.05;
      expect(mcnemarPower({ n, pOnlyA: 0.1, pOnlyB: 0.1, alpha })).toBeLessThanOrEqual(alpha);
    }
  });

  test("power does not decrease as n grows", () => {
    let prev = -1;
    for (let n = 1; n <= 200; n += 1) {
      const p = mcnemarPower({ n, pOnlyA: 0.2, pOnlyB: 0.05 });
      expect(p).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = p;
    }
  });

  test("power rises with the effect size at fixed n", () => {
    const n = 60;
    const ps = SCENARIOS.map((s) => mcnemarPower({ n, pOnlyA: s.pOnlyA, pOnlyB: s.pOnlyB }));
    expect(ps[0]!).toBeLessThan(ps[1]!);
    expect(ps[1]!).toBeLessThan(ps[2]!);
  });

  test("a probability is returned, never a count", () => {
    for (const n of [7, 30, 120]) {
      const p = mcnemarPower({ n, pOnlyA: 0.2, pOnlyB: 0.05 });
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  test("a degenerate effect (all discordance one way) approaches certainty", () => {
    // pOnlyB = 0 means every discordant pair favours A: once six accumulate,
    // rejection is certain, so power is just P(at least 6 discordant pairs).
    expect(mcnemarPower({ n: 200, pOnlyA: 0.5, pOnlyB: 0 })).toBeGreaterThan(0.99);
  });

  test("impossible probabilities throw", () => {
    expect(() => mcnemarPower({ n: 10, pOnlyA: 0.7, pOnlyB: 0.7 })).toThrow();
    expect(() => mcnemarPower({ n: 10, pOnlyA: -0.1, pOnlyB: 0.2 })).toThrow();
    expect(() => mcnemarPower({ n: -5, pOnlyA: 0.2, pOnlyB: 0.05 })).toThrow();
  });
});

describe("agreement with the pre-registered reference table", () => {
  // ccos-study/docs/analysis_plan.md section 7 reports simulated power
  // (3,000 runs, alpha 0.05). Exact values should land near it; the gap is that
  // table's Monte-Carlo error, not a disagreement about the test.
  const reference: Record<number, [number, number, number]> = {
    40: [0.11, 0.28, 0.37],
    60: [0.27, 0.5, 0.57],
    90: [0.5, 0.74, 0.79],
  };

  test("every cell is within 0.1 of the simulated figure", () => {
    for (const [nStr, expected] of Object.entries(reference)) {
      const n = Number(nStr);
      SCENARIOS.forEach((s, i) => {
        const exact = mcnemarPower({ n, pOnlyA: s.pOnlyA, pOnlyB: s.pOnlyB });
        expect(Math.abs(exact - expected[i]!)).toBeLessThan(0.1);
      });
    }
  });

  test("the reference's own conclusion holds: n = 60 is adequate only for large effects", () => {
    const [small, medium, large] = SCENARIOS.map((s) =>
      mcnemarPower({ n: 60, pOnlyA: s.pOnlyA, pOnlyB: s.pOnlyB }),
    );
    expect(small!).toBeLessThan(0.5);
    expect(medium!).toBeLessThan(0.8);
    expect(large!).toBeLessThan(0.8); // even the large effect misses 80% at n = 60
  });
});

describe("smallestN", () => {
  test("it returns the first n meeting the target, not an n past it", () => {
    for (const s of SCENARIOS) {
      const n = smallestN({ pOnlyA: s.pOnlyA, pOnlyB: s.pOnlyB, targetPower: 0.8 });
      expect(n).not.toBeNull();
      expect(mcnemarPower({ n: n!, pOnlyA: s.pOnlyA, pOnlyB: s.pOnlyB })).toBeGreaterThanOrEqual(0.8);
      expect(mcnemarPower({ n: n! - 1, pOnlyA: s.pOnlyA, pOnlyB: s.pOnlyB })).toBeLessThan(0.8);
    }
  });

  test("a smaller effect needs a larger n", () => {
    const ns = SCENARIOS.map((s) => smallestN({ pOnlyA: s.pOnlyA, pOnlyB: s.pOnlyB })!);
    expect(ns[0]!).toBeGreaterThan(ns[1]!);
    expect(ns[1]!).toBeGreaterThan(ns[2]!);
  });

  test("an unreachable target returns null rather than looping to nMax", () => {
    expect(smallestN({ pOnlyA: 0.1, pOnlyB: 0.1, targetPower: 0.8, nMax: 300 })).toBeNull();
  });
});

// ------------------------------------------------------------- against data

const hasArchive = existsSync(ARCHIVE_RUNS);

describe.skipIf(!hasArchive)("the rates come from the archive, not from prose", () => {
  test("poolRates reproduces the pilot: 8/20 failures, 4 logic, 4 format", async () => {
    const { rows } = await loadArchive();
    const r = poolRates(headline(rows));

    expect(r.source).toEqual({ failures: 8, tasks: 20, logic: 4, format: 4, evaluable: 7 });
    expect(near(r.failureRate, 0.4)).toBe(true);
    expect(near(r.logicShare, 0.5)).toBe(true);
    expect(near(r.logicRate, 0.2)).toBe(true);
    expect(near(r.formatRate, 0.2)).toBe(true);
    expect(near(r.evaluableShare, 7 / 8)).toBe(true);
  });

  test("THE CORRECTION: the H1 pool is a fifth of N, not the two fifths section 7 assumed", async () => {
    const { rows } = await loadArchive();
    const r = poolRates(headline(rows));
    const at150 = expectedPool(150, r);

    // The whole failure pool at N = 150 is the ~60 the reference table used.
    expect(near(at150.failures, 60)).toBe(true);
    // But H1 tests logic-class failures only, and that is half of it.
    expect(near(at150.logic, 30)).toBe(true);
    expect(at150.logic).toBeLessThan(at150.failures);
  });

  test("the task budget needed for each effect size, as the paper must state it", async () => {
    const { rows } = await loadArchive();
    const rep = powerReport(headline(rows));

    for (const req of rep.requirement) {
      expect(req.nPairs).not.toBeNull();
      expect(req.tasksForH1).not.toBeNull();
      // Five tasks attempted per logic-class failure, so the budget is always
      // several times the paired n. This is the number that decides feasibility.
      expect(req.tasksForH1!).toBeGreaterThan(req.nPairs! * 4);
    }
    // Harder effects cost more tasks.
    const [small, medium, large] = rep.requirement;
    expect(small!.tasksForH1!).toBeGreaterThan(medium!.tasksForH1!);
    expect(medium!.tasksForH1!).toBeGreaterThan(large!.tasksForH1!);
  });

  test("tasksForLogicPool inverts expectedPool", async () => {
    const { rows } = await loadArchive();
    const r = poolRates(headline(rows));
    for (const nLogic of [6, 30, 44, 100]) {
      const tasks = tasksForLogicPool(nLogic, r);
      expect(expectedPool(tasks, r).logic).toBeGreaterThanOrEqual(nLogic - 1e-9);
    }
  });

  test("THE FINDING: the pilot could not have reached significance on any data", async () => {
    const { rows } = await loadArchive();
    const rep = powerReport(headline(rows));

    // Four logic-class failures, and the exact test needs six discordant pairs.
    expect(rep.pilot.logicPool).toBe(4);
    expect(rep.pilot.minDiscordant).toBe(6);
    expect(rep.pilot.couldEverReject).toBe(false);
    // Even if all four had favoured one strategy: p = 2 * 0.5^4 = 0.125.
    expect(near(rep.pilot.bestAttainableP, 0.125)).toBe(true);
    expect(rep.pilot.bestAttainableP).toBeGreaterThan(rep.alpha);
  });

  test("the pilot had zero power, which is why H1 is worth re-testing", async () => {
    const { rows } = await loadArchive();
    const r = poolRates(headline(rows));
    const pilotLogic = r.source.logic;
    for (const s of SCENARIOS) {
      expect(mcnemarPower({ n: pilotLogic, pOnlyA: s.pOnlyA, pOnlyB: s.pOnlyB })).toBe(0);
    }
  });
});

describe("the report shape the paper and dashboard consume", () => {
  test("powerCurve covers every scenario at every n, in order", () => {
    const ns = [10, 30, 60] as const;
    const curve = powerCurve(ns);
    expect(curve.map((r) => r.n)).toEqual([...ns]);
    for (const row of curve) {
      expect(row.power.map((p) => p.label)).toEqual(SCENARIOS.map((s) => s.label));
      expect(row.alpha).toBe(0.05);
    }
  });

  test.skipIf(!hasArchive)("powerReport carries its own provenance", async () => {
    const { rows } = await loadArchive();
    const rep = powerReport(headline(rows));
    // The rates must be traceable to counts, so a reviewer can check the chain.
    expect(rep.rates.source.tasks).toBe(20);
    expect(rep.alpha).toBe(0.05);
    expect(rep.targetPower).toBe(0.8);
    expect(rep.curve.length).toBeGreaterThan(0);
    expect(rep.requirement.length).toBe(SCENARIOS.length);
  });
});
