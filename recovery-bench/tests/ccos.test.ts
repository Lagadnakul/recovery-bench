/**
 * Phase 2, pinned: CC-OS is one algorithm, and λ is fitted rather than chosen.
 *
 * Two claims in the paper are structural, so they are checked by enumerating the
 * decision space rather than by spot-checking a case:
 *
 * - *"All four experiment arms are one algorithm at different θ"* — there is one
 *   `decide`, and the arms are four `thetaFor` functions handed to it.
 * - *"λ is a measured property of the run, not a tuned knob"* — `fitLambda` is a
 *   maximum-likelihood fit, and the safeguard that it cannot quietly become a
 *   knob is `reportedLambda` returning `null` while the interval contains 1.
 *
 * The third group is the arithmetic: the stopping rule, the Beta update and the
 * backward induction, on values computable by hand.
 */

import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { loadArchive, ARCHIVE_RUNS } from "../packages/pipeline/analysis/load.ts";
import { TRIAGE_CLASSES, type TriageClass } from "../packages/pipeline/analysis/triage.ts";
import {
  theta,
  retryValue,
  escalateValue,
  JEFFREYS,
  update,
  posteriorMean,
  pSucceed,
  decide,
  horizon,
  mulberry32,
  STUBBORN,
  NEEDY,
  CCOS,
  randomArm,
  fitLambda,
  reportedLambda,
  logLikelihood,
  attemptObservations,
  classBeliefs,
  ccosReport,
  ASSUMED_Q,
  DEFAULT_PAYOFFS,
  LAMBDA_FALLBACK,
  CHI2_1_95,
  type AttemptObservation,
  type DecisionContext,
  type Payoffs,
} from "../packages/pipeline/analysis/ccos.ts";

const P: Payoffs = { G: 1, r: 0.02, h: 0.3 };

function ctx(over: Partial<DecisionContext> = {}): DecisionContext {
  return {
    cls: "LOGIC",
    k: 0,
    belief: { alpha: 1, beta: 1 },
    lambda: 1,
    q: 0.7,
    payoffs: P,
    ...over,
  };
}

describe("the stopping rule, by hand", () => {
  test("theta = q - (h - r)/G", () => {
    expect(theta(0.7, P)).toBeCloseTo(0.7 - 0.28, 10);
    expect(theta(0.5, { G: 2, r: 1, h: 3 })).toBeCloseTo(0.5 - 1, 10);
  });

  test("a human costing more than a retry pushes the threshold BELOW q", () => {
    // The policy tolerates a retry whose success probability is worse than the
    // human's, because the retry is cheaper. Readers check this sign first.
    for (const q of [0, 0.3, 0.7, 1]) expect(theta(q, P)).toBeLessThan(q);
  });

  test("a free human (h = r) makes the threshold exactly q", () => {
    expect(theta(0.6, { G: 1, r: 0.1, h: 0.1 })).toBeCloseTo(0.6, 10);
  });

  test("RETRY iff E[retry] > E[escalate] — the inequality and the threshold agree", () => {
    for (const q of [0.1, 0.5, 0.9]) {
      for (let p = 0; p <= 1.0001; p += 0.05) {
        const byValue = retryValue(p, P) > escalateValue(q, P);
        const byThreshold = p > theta(q, P);
        expect(byThreshold).toBe(byValue);
      }
    }
  });

  test("G <= 0 is rejected rather than dividing by zero", () => {
    expect(() => theta(0.5, { G: 0, r: 1, h: 2 })).toThrow();
    expect(() => theta(0.5, { G: -1, r: 1, h: 2 })).toThrow();
  });
});

describe("the Beta-Bernoulli belief", () => {
  test("Jeffreys, and one success each way", () => {
    expect(posteriorMean(JEFFREYS)).toBe(0.5);
    expect(posteriorMean(update(JEFFREYS, true))).toBeCloseTo(1.5 / 2, 10);
    expect(posteriorMean(update(JEFFREYS, false))).toBeCloseTo(0.5 / 2, 10);
  });

  test("updates are immutable — a belief is never mutated under a caller", () => {
    const b = { ...JEFFREYS };
    update(b, true);
    expect(b).toEqual(JEFFREYS);
  });

  test("0 of 4 under Jeffreys stays low without reaching zero", () => {
    let b = { ...JEFFREYS };
    for (let i = 0; i < 4; i++) b = update(b, false);
    expect(posteriorMean(b)).toBeCloseTo(0.5 / 5, 10);
    expect(posteriorMean(b)).toBeGreaterThan(0);
  });

  test("p(c,k) decays geometrically in k, and lambda = 1 is no decay", () => {
    const b = { alpha: 1, beta: 1 };
    expect(pSucceed(b, 0, 0.8)).toBeCloseTo(0.5, 10);
    expect(pSucceed(b, 1, 0.8)).toBeCloseTo(0.4, 10);
    expect(pSucceed(b, 3, 0.8)).toBeCloseTo(0.5 * 0.512, 10);
    for (const k of [0, 1, 5, 20]) expect(pSucceed(b, k, 1)).toBeCloseTo(0.5, 10);
  });

  test("out-of-range k or lambda throws instead of returning a quiet NaN", () => {
    expect(() => pSucceed(JEFFREYS, -1, 0.5)).toThrow();
    expect(() => pSucceed(JEFFREYS, 0, 1.5)).toThrow();
    expect(() => pSucceed(JEFFREYS, 0, -0.1)).toThrow();
  });
});

describe("THE STRUCTURAL CLAIM: four arms, one decide()", () => {
  /** The decision space, coarse but exhaustive over what varies. */
  const space: DecisionContext[] = [];
  for (const cls of TRIAGE_CLASSES) {
    for (const k of [0, 1, 4]) {
      for (const alpha of [0.5, 1, 4]) {
        for (const lambda of [0.5, 1]) {
          space.push(ctx({ cls, k, lambda, belief: { alpha, beta: 2 }, q: ASSUMED_Q[cls] }));
        }
      }
    }
  }

  test("the space is non-trivial", () => {
    expect(space.length).toBe(TRIAGE_CLASSES.length * 3 * 3 * 2);
  });

  test("A - Stubborn retries everywhere, by theta = -Infinity alone", () => {
    for (const c of space) expect(decide(c, STUBBORN)).toBe("RETRY");
    expect(STUBBORN.thetaFor(space[0]!)).toBe(Number.NEGATIVE_INFINITY);
  });

  test("B - Needy escalates everywhere, by theta = +Infinity alone", () => {
    for (const c of space) expect(decide(c, NEEDY)).toBe("ESCALATE");
    expect(NEEDY.thetaFor(space[0]!)).toBe(Number.POSITIVE_INFINITY);
  });

  test("C - Random ignores the class: same seed, same decisions whatever the class", () => {
    // Two runs over the same contexts in the same order must agree; and the
    // decisions must not be a function of the class at all.
    const a = randomArm(0.5, 7);
    const b = randomArm(0.5, 7);
    const da = space.map((c) => decide(c, a));
    const db = space.map((c) => decide(c, b));
    expect(da).toEqual(db);

    // Same contexts with every class rewritten to FORMAT: same decision stream.
    const c2 = randomArm(0.5, 7);
    const forced = space.map((c) => decide({ ...c, cls: "FORMAT" as TriageClass }, c2));
    expect(forced).toEqual(da);
  });

  test("C - Random honours rho approximately, and is degenerate at 0 and 1", () => {
    const n = 4000;
    const base = ctx();
    const always = randomArm(1, 11);
    const never = randomArm(0, 11);
    for (let i = 0; i < 50; i++) {
      expect(decide(base, always)).toBe("ESCALATE");
      expect(decide(base, never)).toBe("RETRY");
    }
    const half = randomArm(0.5, 11);
    let esc = 0;
    for (let i = 0; i < n; i++) if (decide(base, half) === "ESCALATE") esc++;
    expect(esc / n).toBeGreaterThan(0.45);
    expect(esc / n).toBeLessThan(0.55);
  });

  test("rho outside [0,1] is rejected", () => {
    expect(() => randomArm(-0.1)).toThrow();
    expect(() => randomArm(1.1)).toThrow();
  });

  test("D - CC-OS is the only arm whose decision depends on the class", () => {
    // Hold everything but the class fixed and give the classes different q.
    const beliefs = { alpha: 4, beta: 2 }; // p = 2/3
    const atQ = (q: number) => ctx({ belief: beliefs, q, lambda: 1 });
    expect(decide(atQ(0.5), CCOS)).toBe("RETRY"); // theta 0.22 < 0.667
    expect(decide(atQ(0.99), CCOS)).toBe("ESCALATE"); // theta 0.71 > 0.667
    // Whereas the class-blind arms are unmoved.
    expect(decide(atQ(0.5), STUBBORN)).toBe(decide(atQ(0.99), STUBBORN));
    expect(decide(atQ(0.5), NEEDY)).toBe(decide(atQ(0.99), NEEDY));
  });

  test("CC-OS with one q for every class IS a class-blind threshold policy", () => {
    // The degenerate case is the proof that class-conditioning is the only
    // difference between arm D and a fixed-threshold baseline.
    const flat = space.map((c) => decide({ ...c, q: 0.7 }, CCOS));
    for (let i = 0; i < space.length; i++) {
      const c = space[i]!;
      const p = pSucceed(c.belief, c.k, c.lambda);
      expect(flat[i]).toBe(p > theta(0.7, P) ? "RETRY" : "ESCALATE");
    }
  });

  test("the arms differ in thetaFor and in nothing else", () => {
    for (const arm of [STUBBORN, NEEDY, CCOS, randomArm(0.5)]) {
      expect(typeof arm.thetaFor).toBe("function");
      expect(arm.id).toMatch(/^[A-D]_/);
      // Every arm's decision is reproducible from decide() and its own theta.
      const c = ctx({ belief: { alpha: 3, beta: 1 } });
      const t = arm.thetaFor(c);
      if (Number.isFinite(t)) {
        expect(decide(c, arm)).toBe(pSucceed(c.belief, c.k, c.lambda) > t ? "RETRY" : "ESCALATE");
      }
    }
  });

  test("mulberry32 is deterministic and stays in [0,1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 200; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("the finite-horizon form", () => {
  test("K = 1 reduces to the one-step rule", () => {
    const belief = { alpha: 4, beta: 2 };
    const h = horizon({ belief, lambda: 1, q: 0.7, payoffs: P, K: 1 });
    const myopic = decide(ctx({ belief, lambda: 1, q: 0.7 }), CCOS);
    expect(h.decisions[0]).toBe(myopic);
  });

  test("the terminal value is the escalate value, not zero", () => {
    const h = horizon({ belief: JEFFREYS, lambda: 1, q: 0.7, payoffs: P, K: 4 });
    expect(h.values[4]).toBeCloseTo(escalateValue(0.7, P), 10);
  });

  test("V_k is never worse than escalating — the max guarantees it", () => {
    const esc = escalateValue(0.7, P);
    const h = horizon({ belief: { alpha: 3, beta: 2 }, lambda: 0.8, q: 0.7, payoffs: P, K: 6 });
    for (const v of h.values) expect(v).toBeGreaterThanOrEqual(esc - 1e-12);
  });

  test("THE DOMINANCE PROPERTY: horizon <= myopic exactly when continuation value >= 0", () => {
    // Not an unconditional inequality — the first draft of this file asserted one
    // and this test refuted it. threshold <= theta  <=>  V*(qG - h + r - G) <= 0,
    // and the bracket is <= 0 whenever q <= 1 and r <= h, so the sign of V
    // decides. Both branches are checked, including the awkward one.
    let sawNonNegative = false;
    let sawNegative = false;

    for (const q of [0.2, 0.5, 0.9]) {
      for (const lambda of [0.5, 0.9, 1]) {
        const h = horizon({ belief: { alpha: 2, beta: 2 }, lambda, q, payoffs: P, K: 8 });
        const myopic = theta(q, P);
        for (let k = 0; k < h.thresholds.length; k++) {
          const t = h.thresholds[k]!;
          if (Number.isNaN(t)) continue;
          const cont = h.values[k + 1]!;
          if (cont >= 0) {
            sawNonNegative = true;
            expect(t).toBeLessThanOrEqual(myopic + 1e-12);
          } else {
            sawNegative = true;
            expect(t).toBeGreaterThanOrEqual(myopic - 1e-12);
          }
        }
      }
    }
    expect(sawNonNegative).toBe(true);
    expect(sawNegative).toBe(true);
  });

  test("the awkward regime: when asking is net-negative the horizon demands MORE of a retry", () => {
    // qG - h < 0, so a failed retry leaves a liability rather than an option.
    const payoffs: Payoffs = { G: 1, r: 0.02, h: 0.3 };
    const q = 0.2;
    expect(escalateValue(q, payoffs)).toBeLessThan(0);
    const K = 4;
    const h = horizon({ belief: { alpha: 2, beta: 2 }, lambda: 1, q, payoffs, K });

    // The reversal lives at the LAST decision, where the continuation value is
    // the terminal escalate value and so is itself negative. Earlier k have a
    // positive continuation (a retry is worth having) and obey the usual
    // direction — which is why the aggregate test above has to split on sign
    // rather than on k.
    const last = K - 1;
    expect(h.values[last + 1]!).toBeLessThan(0);
    expect(h.thresholds[last]!).toBeGreaterThan(theta(q, payoffs));
    expect(h.values[1]!).toBeGreaterThan(0);
    expect(h.thresholds[0]!).toBeLessThan(theta(q, payoffs));

    // And the published rule has no abandon action, so it still picks one.
    expect(["RETRY", "ESCALATE"]).toContain(h.decisions[last]!);
  });

  test("more value in the fix makes retrying weakly more attractive", () => {
    const lo = horizon({ belief: { alpha: 2, beta: 2 }, lambda: 1, q: 0.7, payoffs: { G: 1, r: 0.2, h: 0.3 }, K: 5 });
    const hi = horizon({ belief: { alpha: 2, beta: 2 }, lambda: 1, q: 0.7, payoffs: { G: 10, r: 0.2, h: 0.3 }, K: 5 });
    expect(hi.values[0]!).toBeGreaterThan(lo.values[0]!);
  });

  test("K < 1 is rejected", () => {
    expect(() => horizon({ belief: JEFFREYS, lambda: 1, q: 0.5, payoffs: P, K: 0 })).toThrow();
  });
});

describe("fitting lambda", () => {
  const synth = (pBar: number, lambda: number, perCell: number): AttemptObservation[] =>
    [0, 1, 2, 3].map((k) => ({
      cls: "LOGIC" as TriageClass,
      k,
      trials: perCell,
      successes: Math.round(perCell * pBar * Math.pow(lambda, k)),
    }));

  test("recovers a known decay from clean synthetic data", () => {
    const fit = fitLambda(synth(0.8, 0.6, 500));
    expect(fit.lambda).toBeGreaterThan(0.55);
    expect(fit.lambda).toBeLessThan(0.65);
    expect(fit.excludesNoDecay).toBe(true);
    expect(reportedLambda(fit)).not.toBeNull();
  });

  test("recovers no decay from data generated with none", () => {
    const fit = fitLambda(synth(0.5, 1, 500));
    expect(fit.lambda).toBeGreaterThan(0.95);
    // And it must NOT claim evidence of decay, since there is none.
    expect(fit.excludesNoDecay).toBe(false);
    expect(reportedLambda(fit)).toBeNull();
  });

  test("the likelihood-ratio interval is the standard one", () => {
    expect(CHI2_1_95).toBeCloseTo(3.8415, 3);
    const fit = fitLambda(synth(0.8, 0.6, 500));
    for (const p of fit.profile) {
      const inside = 2 * (fit.logLik - p.logLik) <= CHI2_1_95;
      if (inside) {
        expect(p.lambda).toBeGreaterThanOrEqual(fit.interval.lo);
        expect(p.lambda).toBeLessThanOrEqual(fit.interval.hi);
      }
    }
  });

  test("the profile maximum really is the maximum on the grid", () => {
    const fit = fitLambda(synth(0.7, 0.75, 200));
    for (const p of fit.profile) expect(p.logLik).toBeLessThanOrEqual(fit.logLik + 1e-9);
  });

  test("logLikelihood is finite at the edges rather than -Infinity", () => {
    const obs = synth(0.5, 0.5, 10);
    expect(Number.isFinite(logLikelihood(obs, 0, 0))).toBe(true);
    expect(Number.isFinite(logLikelihood(obs, 1, 1))).toBe(true);
  });

  test("no data means no lambda — not a default", () => {
    const fit = fitLambda([]);
    expect(fit.trials).toBe(0);
    expect(reportedLambda(fit)).toBeNull();
  });

  test("perfect separation is flagged, and blocks the point estimate", () => {
    // All-success and all-failure cells: the level is pinned, the slope is not.
    const obs: AttemptObservation[] = [
      { cls: "FORMAT", k: 0, trials: 3, successes: 3 },
      { cls: "LOGIC", k: 0, trials: 4, successes: 0 },
    ];
    const fit = fitLambda(obs);
    expect(fit.degenerateCells).toBe(2);
    expect(reportedLambda(fit)).toBeNull();
  });

  test("a wide interval touching 1 blocks the point estimate even with an interior peak", () => {
    const fit = fitLambda(synth(0.5, 0.9, 12));
    if (fit.interval.hi >= 1) expect(reportedLambda(fit)).toBeNull();
  });
});

const hasArchive = existsSync(ARCHIVE_RUNS);

describe.skipIf(!hasArchive)("the pilot, through CC-OS", () => {
  test("retry trials are attributed to the class of the attempt being retried", async () => {
    const { rows } = await loadArchive();
    const { observations } = attemptObservations(rows);
    expect(observations.length).toBeGreaterThan(0);
    for (const o of observations) {
      expect(["FORMAT", "LOGIC"]).toContain(o.cls); // BROKEN is dropped, LOST unobservable
      expect(o.successes).toBeLessThanOrEqual(o.trials);
      expect(o.k).toBeGreaterThanOrEqual(0);
    }
  });

  test("the class-conditioned rates reproduce the pilot's headline split", async () => {
    const { rows } = await loadArchive();
    const beliefs = classBeliefs(attemptObservations(rows).observations);
    const format = beliefs.find((b) => b.cls === "FORMAT")!;
    const logic = beliefs.find((b) => b.cls === "LOGIC")!;

    // The thesis's result, seen from the belief's side: format failures recover,
    // logic failures never did.
    expect(logic.successes).toBe(0);
    expect(logic.trials).toBeGreaterThan(0);
    expect(format.successes).toBeGreaterThan(0);
    expect(format.successes / format.trials).toBeGreaterThan(logic.successes / logic.trials);
  });

  test("THE FINDING: successes left the experiment, so lambda is confounded", async () => {
    const { rows } = await loadArchive();
    const o = attemptObservations(rows);
    expect(o.successes).toBeGreaterThan(0);
    expect(o.retriedAfterSuccess).toBe(0);
  });

  test("THE FINDING: the fit converges, and still does not evidence any decay", async () => {
    const { rows } = await loadArchive();
    const rep = ccosReport(rows);

    expect(rep.fit.trials).toBeGreaterThan(0);
    expect(rep.fit.atBoundary).toBe(false); // a real interior estimate
    expect(rep.fit.interval.hi).toBeGreaterThanOrEqual(1); // reaching no-decay
    expect(rep.fit.excludesNoDecay).toBe(false);
    expect(rep.lambdaIsMeasured).toBe(false);
    // So the policy is computed at the stated null rather than at the artefact.
    expect(rep.lambdaUsed).toBe(LAMBDA_FALLBACK);
    expect(rep.survivorship.confounded).toBe(true);
  });

  test("BROKEN never reaches the stopping rule", async () => {
    const { rows } = await loadArchive();
    const broken = ccosReport(rows).policy.find((r) => r.cls === "BROKEN")!;
    expect(broken.decision).toBe("ABORT");
    expect(broken.agrees).toBe(true);
  });

  test("LOGIC is escalated, from its own observed rate and not from a constant", async () => {
    const { rows } = await loadArchive();
    const logic = ccosReport(rows).policy.find((r) => r.cls === "LOGIC")!;
    expect(logic.trials).toBeGreaterThan(0);
    expect(logic.successes).toBe(0);
    expect(logic.decision).toBe("ESCALATE");
    expect(logic.agrees).toBe(true);
  });

  test("a class with no observations is marked prior-only rather than reported as a rate", async () => {
    const { rows } = await loadArchive();
    for (const row of ccosReport(rows).policy) {
      if (row.trials === 0) {
        expect(row.priorOnly).toBe(true);
        expect(row.pZero).toBe(0.5); // the Jeffreys prior, and nothing else
      } else {
        expect(row.priorOnly).toBe(false);
      }
    }
  });

  test("every disagreement reports the q that would resolve it", async () => {
    const { rows } = await loadArchive();
    const rep = ccosReport(rows);
    for (const row of rep.policy) {
      if (row.agrees) continue;
      expect(row.qFlip).toBeGreaterThan(0);
      // The flip point is exactly where the inequality turns over.
      const flipped = decide(
        {
          cls: row.cls,
          k: 0,
          belief: { alpha: row.pZero, beta: 1 - row.pZero },
          lambda: rep.lambdaUsed,
          q: row.qFlip - 0.01,
          payoffs: rep.payoffs,
        },
        CCOS,
      );
      if (row.prescribed === "retry") expect(flipped).toBe("RETRY");
    }
  });

  test("the four arms all appear, and only CC-OS varies by class", async () => {
    const { rows } = await loadArchive();
    const rep = ccosReport(rows);
    expect(rep.arms.map((a) => a.id)).toEqual(["A_stubborn", "B_needy", "C_random", "D_ccos"]);

    const stubborn = rep.arms.find((a) => a.id === "A_stubborn")!;
    expect(new Set(Object.values(stubborn.decisions)).size).toBe(1);
    const needy = rep.arms.find((a) => a.id === "B_needy")!;
    expect(new Set(Object.values(needy.decisions)).size).toBe(1);
  });

  test("the payoffs and the assumed q are declared in one place", async () => {
    const { rows } = await loadArchive();
    const rep = ccosReport(rows);
    expect(rep.payoffs).toEqual(DEFAULT_PAYOFFS);
    for (const cls of TRIAGE_CLASSES) {
      expect(ASSUMED_Q[cls]).toBeGreaterThanOrEqual(0);
      expect(ASSUMED_Q[cls]).toBeLessThanOrEqual(1);
    }
    // The ordering is the defensible part: a human helps most on LOGIC and not
    // at all on BROKEN.
    expect(ASSUMED_Q.BROKEN).toBe(0);
    expect(ASSUMED_Q.LOGIC).toBeGreaterThan(ASSUMED_Q.BROKEN);
  });

  test("the horizon is solved for a class where it is not degenerate", async () => {
    const { rows } = await loadArchive();
    const rep = ccosReport(rows);
    expect(rep.horizons.map((h) => h.cls)).toEqual(["FORMAT", "LOGIC"]);
    for (const h of rep.horizons) {
      expect(h.result.values.length).toBe(h.result.decisions.length + 1);
    }
  });
});
