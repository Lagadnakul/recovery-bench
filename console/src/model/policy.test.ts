import { describe, expect, test } from "bun:test";
import { loadCcos } from "./ccos";
import {
  belief,
  finiteHorizon,
  myopicDecision,
  pZero,
  qFlip,
  theta,
  type ClassInput,
} from "./policy";

/**
 * The acceptance test for screen 6.
 *
 * policy.ts recomputes live what recovery-bench computed once. These tests
 * assert the two agree at the committed payoffs, so the professor dragging a
 * slider is moving the same algorithm the paper describes.
 */

const run = loadCcos();
const { payoffs } = run;
const lambda = run.lambda.used;

const inputFor = (cls: string): ClassInput => {
  const belief_ = run.beliefs.find((b) => b.cls === cls);
  const policy = run.policy.find((p) => p.cls === cls)!;
  return {
    cls: policy.cls,
    alpha: belief_?.belief.alpha ?? 0.5,
    beta: belief_?.belief.beta ?? 0.5,
    q: policy.q,
    trials: policy.trials,
    successes: policy.successes,
  };
};

describe("the committed payoffs", () => {
  test("are what the paper says", () => {
    expect(payoffs).toEqual({ G: 1, r: 0.02, h: 0.3 });
  });
});

describe("policy.ts reproduces ccos.json", () => {
  for (const row of run.policy) {
    test(`${row.cls}: theta, decision and qFlip`, () => {
      const input = inputFor(row.cls);
      const got = myopicDecision(input, payoffs, lambda);

      expect(got.theta).toBeCloseTo(row.theta, 10);
      expect(got.p).toBeCloseTo(row.pZero, 10);
      expect(got.decision).toBe(row.decision);
      expect(got.qFlip).toBeCloseTo(row.qFlip, 10);
    });
  }

  test("theta is q minus (h - r)/G, for all four", () => {
    for (const row of run.policy) {
      expect(theta(row.q, payoffs)).toBeCloseTo(row.q - 0.28, 10);
    }
  });

  test("the four thetas are the paper's values", () => {
    const byCls = new Map(run.policy.map((p) => [p.cls, p.theta]));
    expect(byCls.get("FORMAT")).toBeCloseTo(0.62, 10);
    expect(byCls.get("LOGIC")).toBeCloseTo(0.42, 10);
    expect(byCls.get("BROKEN")).toBeCloseTo(-0.28, 10);
    expect(byCls.get("LOST")).toBeCloseTo(0.32, 10);
  });

  test("the finite-horizon run matches, decision for decision", () => {
    for (const horizon of run.horizons) {
      const input = inputFor(horizon.cls);
      const K = horizon.result.decisions.length;
      const got = finiteHorizon(input, payoffs, lambda, K);

      expect(got.decisions, horizon.cls).toEqual(horizon.result.decisions);
      for (let k = 0; k <= K; k++) {
        expect(got.values[k], `${horizon.cls} V_${k}`).toBeCloseTo(
          horizon.result.values[k]!,
          10,
        );
      }
      for (let k = 0; k < K; k++) {
        expect(got.thresholds[k], `${horizon.cls} threshold ${k}`).toBeCloseTo(
          horizon.result.thresholds[k]!,
          10,
        );
      }
    }
  });
});

describe("the finding — myopic and finite-horizon disagree on FORMAT", () => {
  test("myopic escalates the one class that actually recovers", () => {
    const format = run.policy.find((p) => p.cls === "FORMAT")!;
    expect(format.pZero).toBeCloseTo(0.5, 10);
    expect(format.theta).toBeCloseTo(0.62, 10);
    // p < theta, so the one-step rule asks a human.
    expect(format.decision).toBe("ESCALATE");
    // And it disagrees with what the proposal prescribed.
    expect(format.prescribed).toBe("retry");
    expect(format.agrees).toBe(false);
  });

  test("the horizon form retries FORMAT at every k", () => {
    const horizon = run.horizons.find((h) => h.cls === "FORMAT")!;
    expect(new Set(horizon.result.decisions)).toEqual(new Set(["RETRY"]));
    // Option value is why: a failed retry does not end the episode, so the
    // early thresholds are negative -- retry wins for any belief at all.
    expect(horizon.result.thresholds[0]).toBeLessThan(0);
  });

  test("LOGIC escalates under both forms, and that is the agreement", () => {
    const logic = run.policy.find((p) => p.cls === "LOGIC")!;
    expect(logic.decision).toBe("ESCALATE");
    expect(logic.agrees).toBe(true);
    const horizon = run.horizons.find((h) => h.cls === "LOGIC")!;
    expect(new Set(horizon.result.decisions)).toEqual(new Set(["ESCALATE"]));
  });

  test("option value is the mechanism, not a coincidence", () => {
    // Make retrying expensive and the horizon form stops preferring it.
    const input = inputFor("FORMAT");
    const cheap = finiteHorizon(input, payoffs, lambda, 5);
    const dear = finiteHorizon(input, { ...payoffs, r: 0.9 }, lambda, 5);
    expect(cheap.decisions[0]).toBe("RETRY");
    expect(dear.decisions[0]).toBe("ESCALATE");
  });
});

describe("the sliders move it in the right direction", () => {
  const format = () => inputFor("FORMAT");

  test("an expensive human lowers the bar for retrying", () => {
    const cheapHuman = myopicDecision(format(), { G: 1, r: 0.02, h: 0.1 }, lambda);
    const dearHuman = myopicDecision(format(), { G: 1, r: 0.02, h: 0.8 }, lambda);
    expect(dearHuman.theta).toBeLessThan(cheapHuman.theta);
    expect(cheapHuman.decision).toBe("ESCALATE");
    expect(dearHuman.decision).toBe("RETRY");
  });

  test("FORMAT flips once h passes 0.42", () => {
    // theta < p  <=>  0.9 - (h - 0.02) < 0.5  <=>  h > 0.42
    const below = myopicDecision(format(), { G: 1, r: 0.02, h: 0.41 }, lambda);
    const above = myopicDecision(format(), { G: 1, r: 0.02, h: 0.43 }, lambda);
    expect(below.decision).toBe("ESCALATE");
    expect(above.decision).toBe("RETRY");
  });

  test("qFlip is where the decision turns over", () => {
    for (const row of run.policy) {
      if (row.priorOnly || row.q === 0) continue;
      const input = inputFor(row.cls);
      const justBelow = myopicDecision(
        { ...input, q: row.qFlip - 0.01 },
        payoffs,
        lambda,
      );
      const justAbove = myopicDecision(
        { ...input, q: row.qFlip + 0.01 },
        payoffs,
        lambda,
      );
      expect(justBelow.decision, `${row.cls} below qFlip`).toBe("RETRY");
      expect(justAbove.decision, `${row.cls} above qFlip`).toBe("ESCALATE");
    }
  });
});

describe("what the screen must not overclaim", () => {
  test("lambda is NOT measured, and the policy ran without decay", () => {
    // The proposal, BUILD.md and ENGINE.md all say lambda is "measured, not
    // tuned". It is not. If a future fit changes that, this test fails and the
    // screen's wording gets revisited deliberately.
    expect(run.lambda.isMeasured).toBe(false);
    expect(run.lambda.excludesNoDecay).toBe(false);
    expect(run.lambda.interval.hi).toBe(1);
    expect(run.lambda.used).toBe(1);
  });

  test("with lambda = 1 the belief is flat in k", () => {
    const input = inputFor("FORMAT");
    expect(belief(input.alpha, input.beta, 1, 0)).toBeCloseTo(0.5, 10);
    expect(belief(input.alpha, input.beta, 1, 4)).toBeCloseTo(0.5, 10);
    // The fitted estimate would decay, if it were identified.
    expect(belief(input.alpha, input.beta, run.lambda.estimate, 4)).toBeLessThan(
      0.2,
    );
  });

  test("BROKEN and LOST are prior only — zero trials", () => {
    for (const cls of ["BROKEN", "LOST"]) {
      const row = run.policy.find((p) => p.cls === cls)!;
      expect(row.priorOnly).toBe(true);
      expect(row.trials).toBe(0);
    }
  });

  test("the evidence is 31 archive trials, not the live sweep", () => {
    const trials = run.observations.reduce((n, o) => n + o.trials, 0);
    expect(trials).toBe(31);
    expect(run.lambda.trials).toBe(31);
    // FORMAT 10, LOGIC 21.
    const byCls = new Map<string, number>();
    for (const o of run.observations) {
      byCls.set(o.cls, (byCls.get(o.cls) ?? 0) + o.trials);
    }
    expect(byCls.get("FORMAT")).toBe(10);
    expect(byCls.get("LOGIC")).toBe(21);
  });

  test("the data is survivorship-confounded", () => {
    expect(run.survivorship.confounded).toBe(true);
    expect(run.survivorship.retriedAfterSuccess).toBe(0);
  });

  test("LOGIC never once succeeded in 21 trials", () => {
    const logic = run.observations.filter((o) => o.cls === "LOGIC");
    expect(logic.reduce((n, o) => n + o.successes, 0)).toBe(0);
    expect(pZero(0.5, 21.5)).toBeCloseTo(0.0227, 4);
  });
});

describe("arithmetic edges", () => {
  test("G = 0 degenerates to q without dividing by zero", () => {
    expect(theta(0.7, { G: 0, r: 0.02, h: 0.3 })).toBe(0.7);
    expect(qFlip(0.5, { G: 0, r: 0.02, h: 0.3 })).toBe(0.5);
  });

  test("an empty belief is p = 0, not NaN", () => {
    expect(pZero(0, 0)).toBe(0);
  });
});
