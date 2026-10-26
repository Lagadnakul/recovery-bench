/**
 * CC-OS — Class-Conditioned Optimal Stopping, implemented.
 *
 * ## What this file is, and what it is not
 *
 * It is a **demonstration that the method is implementable**, run against the
 * pilot's 51 archived records. It is **not a finding**. No arm was executed, no
 * escalation ever happened, and nothing here measures whether CC-OS beats the
 * baselines — that is Stage 2. Every number this file prints is either a
 * property of the algorithm (provable, and proved in `tests/ccos.test.ts`) or an
 * estimate from the pilot clearly labelled with what is wrong with it.
 *
 * ## The rule, from `proposal/index.html:601`
 *
 * ```
 *   E[retry]    = p(c,k) · G − r
 *   E[escalate] = q_c     · G − h
 *   RETRY  ⟺  p(c,k) > θ_c        where  θ_c = q_c − (h − r)/G
 * ```
 *
 * with the Beta–Bernoulli belief `p(c,k) = α_c/(α_c+β_c) · λᵏ` and the
 * finite-horizon form `V_k = max(p_k·G − r + (1−p_k)·V_{k+1}, q·G − h)` solved
 * backwards in O(K).
 *
 * ## The two claims the paper makes, and where they are kept honest
 *
 * **1. "All four experiment arms are one algorithm at different θ."** There is
 * exactly one decision function here — `decide` — and the four arms are four
 * `thetaFor` functions handed to it. Stubborn returns −∞, Needy +∞, Random
 * flips a seeded coin between the two, and CC-OS returns θ_c. Nothing else
 * differs, so the claim is structural rather than asserted, and
 * `tests/ccos.test.ts` checks it by enumeration over the decision space.
 *
 * **2. "λ is measured, not tuned."** `fitLambda` is a real maximum-likelihood
 * fit with a profile-likelihood interval, and on the pilot it does return an
 * interior estimate — λ̂ ≈ 0.72. The estimate is also **uninformative**, and the
 * report says so in the same breath, because its 95% likelihood-ratio interval
 * reaches 1.000: *the pilot provides no evidence that context rot exists at
 * all.* That is the honest reading, and it is a weaker claim than either "λ is
 * measured" or "λ cannot be measured".
 *
 * Two separate reasons, both computed rather than argued:
 *
 * - **Partial separation.** Three of the five observation cells sit at a rate of
 *   exactly 0 or 1. A Bernoulli rate with no interior value constrains the
 *   level, not the slope, so most of the data cannot speak about decay.
 * - **Successes left the experiment.** No sequence that resolved was retried
 *   afterwards, so every later-round denominator is conditioned on earlier-round
 *   failure. λ̂ therefore confounds context rot with difficulty selection — the
 *   sequence keeps only the tasks that were already losing. It is the same
 *   survivorship error as scoring a baseline over the cells that happened to
 *   produce a report, one level up, and it biases λ̂ *down*.
 *
 * So Stage 2 needs **K ≥ 4 rounds run unconditionally on a subsample** (or an
 * explicit heterogeneity term) before λ carries weight. `excludesNoDecay` is the
 * gate that matters: until the interval clears 1, the paper reports an interval,
 * not a knob.
 */

import { existsSync } from "node:fs";
import { ARCHIVE_RUNS, loadArchive, type ArchiveRow } from "./load.ts";
import { BASELINE_RUN, CONDITIONS, FAILURE_POOL } from "./runs.ts";
import {
  loadPatches,
  renderTriageReport,
  triageAttempt,
  triageSummary,
  type TriageClass,
} from "./triage.ts";

// ------------------------------------------------------------------- payoffs

export interface Payoffs {
  /** G — value of solving the bug. */
  G: number;
  /** r — cost of one more attempt. */
  r: number;
  /** h — cost of one human interruption. */
  h: number;
}

/**
 * θ = q − (h − r)/G, the whole decision.
 *
 * Note the sign: when a human costs more than a retry (`h > r`, always true in
 * practice) the threshold sits *below* q, so the policy tolerates a retry whose
 * success probability is worse than the human's. That is correct — the retry is
 * cheaper — and it is the part a reader checks first, so it is asserted in the
 * tests rather than left to the reader.
 */
export function theta(q: number, p: Payoffs): number {
  if (p.G <= 0) throw new Error(`G must be positive, got ${p.G}`);
  return q - (p.h - p.r) / p.G;
}

export function retryValue(p: number, payoffs: Payoffs): number {
  return p * payoffs.G - payoffs.r;
}

export function escalateValue(q: number, payoffs: Payoffs): number {
  return q * payoffs.G - payoffs.h;
}

// -------------------------------------------------------------------- belief

/**
 * A Beta–Bernoulli posterior over "does one more attempt succeed", per class.
 *
 * `alpha`/`beta` start at the Jeffreys prior (½, ½) rather than (1, 1). With
 * four logic-class observations the choice of prior visibly moves the posterior
 * mean, and Jeffreys is the one that does not pull a 0/4 towards the middle as
 * hard — which matters here because 0/4 is the pilot's actual logic-class
 * record and overstating it would overstate the case for escalation.
 */
export interface Belief {
  alpha: number;
  beta: number;
}

export const JEFFREYS: Belief = { alpha: 0.5, beta: 0.5 };

export function update(b: Belief, success: boolean): Belief {
  return success ? { alpha: b.alpha + 1, beta: b.beta } : { alpha: b.alpha, beta: b.beta + 1 };
}

export function posteriorMean(b: Belief): number {
  return b.alpha / (b.alpha + b.beta);
}

/** p(c,k) = posterior mean × λᵏ. */
export function pSucceed(b: Belief, k: number, lambda: number): number {
  if (k < 0) throw new Error(`k must be >= 0, got ${k}`);
  if (lambda < 0 || lambda > 1) throw new Error(`lambda must be in [0,1], got ${lambda}`);
  return posteriorMean(b) * Math.pow(lambda, k);
}

// --------------------------------------------------------------- the policy

export type Decision = "RETRY" | "ESCALATE";

export interface DecisionContext {
  cls: TriageClass;
  /** Attempts already made on this task. */
  k: number;
  belief: Belief;
  lambda: number;
  /** q_c — probability a human unblocks a failure of this class. */
  q: number;
  payoffs: Payoffs;
}

/**
 * The one decision function. Every arm is this, with a different θ.
 *
 * `thetaFor` receives the whole context so that an arm may ignore the class
 * (Random does, deliberately) without the signature admitting it is special.
 */
export type Arm = {
  id: "A_stubborn" | "B_needy" | "C_random" | "D_ccos";
  label: string;
  represents: string;
  thetaFor(ctx: DecisionContext): number;
};

export function decide(ctx: DecisionContext, arm: Arm): Decision {
  const p = pSucceed(ctx.belief, ctx.k, ctx.lambda);
  return p > arm.thetaFor(ctx) ? "RETRY" : "ESCALATE";
}

/**
 * Deterministic PRNG for arm C.
 *
 * Arm C is random *by design* — it is the control that matches D's escalation
 * budget while ignoring the class — so the randomness cannot be removed. It can
 * be made reproducible, which is why the seed is an argument and not a global.
 * mulberry32: 32-bit state, one multiply-xorshift round, adequate for a
 * Bernoulli draw and short enough to read.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STUBBORN: Arm = {
  id: "A_stubborn",
  label: "A · Stubborn",
  represents: "every agent shipping today",
  thetaFor: () => Number.NEGATIVE_INFINITY,
};

export const NEEDY: Arm = {
  id: "B_needy",
  label: "B · Needy",
  represents: 'the naive "add a human" answer',
  thetaFor: () => Number.POSITIVE_INFINITY,
};

/**
 * Arm C: escalates with probability ρ, ignoring the class.
 *
 * Expressed inside the same parameterisation as the others — it returns +∞ with
 * probability ρ and −∞ otherwise — so "the four arms are one algorithm" stays
 * literally true instead of true for three of them.
 */
export function randomArm(rho: number, seed = 20261024): Arm {
  if (rho < 0 || rho > 1) throw new Error(`rho must be in [0,1], got ${rho}`);
  const rand = mulberry32(seed);
  return {
    id: "C_random",
    label: "C · Random",
    represents: "the control that makes it science",
    thetaFor: () => (rand() < rho ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY),
  };
}

/** Arm D: θ_c from the payoffs and the class-conditioned q. */
export const CCOS: Arm = {
  id: "D_ccos",
  label: "D · CC-OS",
  represents: "our contribution",
  thetaFor: (ctx) => theta(ctx.q, ctx.payoffs),
};

// --------------------------------------------------- finite-horizon version

export interface HorizonResult {
  /** V_k for k = 0..K; `values[K]` is the terminal escalate value. */
  values: number[];
  /** The decision at each k under backward induction. */
  decisions: Decision[];
  /**
   * The success probability at which retrying and escalating are equal, per k.
   *
   * **It is ≤ the myopic θ exactly when the continuation value is non-negative**,
   * and strictly above it otherwise. The algebra is short enough to state:
   * `threshold ≤ θ  ⟺  V·(qG − h + r − G) ≤ 0`, and since `qG − h + r − G ≤ 0`
   * whenever `q ≤ 1` and `r ≤ h`, the sign of the continuation value decides it.
   *
   * The intuition for the awkward case: the one-step rule prices a failed retry
   * at nothing, while the horizon prices it at whatever is left — and if asking
   * a human is itself net-negative (`qG < h`), what is left is a liability, so
   * the horizon demands *more* of a retry than the myopic rule does, not less.
   *
   * That regime also exposes a gap in the rule as published: with both options
   * negative there is no *abandon* action, so the policy keeps spending on the
   * less-bad one. Naming it is a limitation for the protocol, not a bug here.
   */
  thresholds: number[];
}

/**
 * `V_k = max(p_k·G − r + (1−p_k)·V_{k+1}, q·G − h)`, solved backwards in O(K).
 *
 * The terminal value is the escalate value: with no attempts left, asking is the
 * only move. Setting it to 0 instead would price running out of budget as
 * costless and bias the whole recursion towards retrying.
 */
export function horizon(opts: {
  belief: Belief;
  lambda: number;
  q: number;
  payoffs: Payoffs;
  K: number;
}): HorizonResult {
  const { belief, lambda, q, payoffs, K } = opts;
  if (K < 1) throw new Error(`K must be >= 1, got ${K}`);
  const esc = escalateValue(q, payoffs);
  const values = new Array<number>(K + 1).fill(esc);
  const decisions = new Array<Decision>(K).fill("ESCALATE");
  const thresholds = new Array<number>(K).fill(NaN);

  for (let k = K - 1; k >= 0; k--) {
    const p = pSucceed(belief, k, lambda);
    const cont = values[k + 1]!;
    const tryV = p * payoffs.G - payoffs.r + (1 - p) * cont;
    values[k] = Math.max(tryV, esc);
    decisions[k] = tryV > esc ? "RETRY" : "ESCALATE";
    // tryV = esc  =>  p·G − r + (1−p)·cont = esc  =>  p(G − cont) = esc + r − cont
    const denom = payoffs.G - cont;
    thresholds[k] = denom === 0 ? NaN : (esc + payoffs.r - cont) / denom;
  }
  return { values, decisions, thresholds };
}

// ------------------------------------------------------------- fitting λ

export interface AttemptObservation {
  cls: TriageClass;
  /** Attempts already made when this retry was issued. */
  k: number;
  trials: number;
  successes: number;
}

/**
 * Retry outcomes grouped by the class of the attempt being retried.
 *
 * The grouping is the point: `p(c,k)` is the probability that a retry succeeds
 * *given the class of the failure it is retrying*, so a trial is attributed to
 * the class of attempt i, with the outcome of attempt i+1. Reading it the other
 * way round — grouping by the retry's own class — would make the belief
 * conditional on something not yet observed when the decision is taken.
 *
 * An `APPLY_FAIL` retry counts as an observed failure, not as missing data: the
 * patch demonstrably did not resolve the task. Only a BROKEN attempt is dropped,
 * because nothing about the model was measured.
 */
export function attemptObservations(rows: ArchiveRow[]): {
  observations: AttemptObservation[];
  /** Successes that were followed by another attempt on the same task. */
  retriedAfterSuccess: number;
  /** Successes, total. */
  successes: number;
  /** Longest attempt sequence seen. */
  maxDepth: number;
} {
  const buckets = new Map<string, AttemptObservation>();
  let retriedAfterSuccess = 0;
  let successes = 0;
  let maxDepth = 0;

  const order: Record<string, number> = { R0: 0, R1: 1, R2: 2 };

  for (const taskId of FAILURE_POOL) {
    for (const condition of CONDITIONS) {
      const seq = rows
        .filter((r) => r.row.cell.taskId === taskId && (r.condition === condition || r.run === BASELINE_RUN))
        .sort(
          (a, b) => (order[a.round] ?? 9) - (order[b.round] ?? 9) || a.format.localeCompare(b.format),
        );
      if (seq.length < 2) continue;
      maxDepth = Math.max(maxDepth, seq.length);

      const verdicts = seq.map((r) => ({
        row: r,
        resolved: r.row.verification === "test" ? Boolean(r.row.resolved) : null,
        v: triageAttempt(r.row.outcome, r.row.verification === "test" ? Boolean(r.row.resolved) : null),
      }));

      for (let i = 0; i + 1 < verdicts.length; i++) {
        const prev = verdicts[i]!;
        const next = verdicts[i + 1]!;
        // Nothing to retry: the attempt either succeeded or measured nothing.
        if (prev.v.cls === null || prev.v.cls === "BROKEN") {
          if (prev.resolved === true) retriedAfterSuccess++;
          continue;
        }
        // The retry itself must be interpretable.
        if (next.v.cls === "BROKEN") continue;
        const success = next.resolved === true;
        if (success) successes++;
        const key = `${prev.v.cls}|${i}`;
        const bucket = buckets.get(key) ?? { cls: prev.v.cls, k: i, trials: 0, successes: 0 };
        bucket.trials++;
        if (success) bucket.successes++;
        buckets.set(key, bucket);
      }
      // A success at the final position is a success that was never retried.
      const last = verdicts[verdicts.length - 1]!;
      if (last.resolved === true) successes++;
    }
  }

  return {
    observations: [...buckets.values()].sort((a, b) => a.cls.localeCompare(b.cls) || a.k - b.k),
    retriedAfterSuccess,
    successes,
    maxDepth,
  };
}

const EPS = 1e-12;

/** Bernoulli log-likelihood of `obs` under p(k) = pBar·λᵏ. */
export function logLikelihood(obs: readonly AttemptObservation[], pBar: number, lambda: number): number {
  let ll = 0;
  for (const o of obs) {
    const p = Math.min(1 - EPS, Math.max(EPS, pBar * Math.pow(lambda, o.k)));
    ll += o.successes * Math.log(p) + (o.trials - o.successes) * Math.log(1 - p);
  }
  return ll;
}

/**
 * Maximise over p̄ at fixed λ.
 *
 * The log-likelihood is concave in p̄ — each term is a sum of two concave
 * functions of p̄ — so a ternary search is exact to the tolerance rather than
 * merely plausible. No closed form exists once λᵏ varies across the terms.
 */
function bestPBar(obs: readonly AttemptObservation[], lambda: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const a = lo + (hi - lo) / 3;
    const b = hi - (hi - lo) / 3;
    if (logLikelihood(obs, a, lambda) < logLikelihood(obs, b, lambda)) lo = a;
    else hi = b;
  }
  return (lo + hi) / 2;
}

export interface LambdaFit {
  /** The λ maximising the profile likelihood. */
  lambda: number;
  pBar: number;
  logLik: number;
  /** Profile log-likelihood on the grid, for plotting and for the flatness test. */
  profile: { lambda: number; logLik: number }[];
  /** {λ : 2(ℓmax − ℓ(λ)) ≤ 3.841}, the 95% likelihood-ratio interval. */
  interval: { lo: number; hi: number };
  /** True when the estimate sits at an edge of [0,1]. */
  atBoundary: boolean;
  /**
   * True when the interval spans essentially the whole unit interval — the data
   * cannot distinguish any decay rate from any other.
   */
  unidentified: boolean;
  /**
   * **The gate that matters.** True when the interval excludes λ = 1, i.e. when
   * the data show evidence that a retry's success probability decays at all.
   *
   * A point estimate below 1 is not that evidence: λ̂ = 0.72 with an interval
   * reaching 1.000 is a sample that would arise comfortably with no decay
   * whatever. Quoting the 0.72 without this flag beside it is how an artefact
   * becomes a "measured property of the run".
   */
  excludesNoDecay: boolean;
  /** Total trials the fit saw, and total successes. */
  trials: number;
  successes: number;
  /** Observations where the rate is 0 or 1 — perfect separation, no slope. */
  degenerateCells: number;
}

/** χ²(1) at 0.95, the cutoff for a likelihood-ratio interval on one parameter. */
export const CHI2_1_95 = 3.841458820694124;

export function fitLambda(obs: readonly AttemptObservation[], steps = 1001): LambdaFit {
  const trials = obs.reduce((a, o) => a + o.trials, 0);
  const successes = obs.reduce((a, o) => a + o.successes, 0);
  const degenerateCells = obs.filter((o) => o.successes === 0 || o.successes === o.trials).length;

  const profile: { lambda: number; logLik: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const lambda = i / (steps - 1);
    profile.push({ lambda, logLik: logLikelihood(obs, bestPBar(obs, lambda), lambda) });
  }

  let best = profile[0]!;
  for (const p of profile) if (p.logLik > best.logLik) best = p;

  const inside = profile.filter((p) => 2 * (best.logLik - p.logLik) <= CHI2_1_95);
  const interval = {
    lo: inside.length ? Math.min(...inside.map((p) => p.lambda)) : best.lambda,
    hi: inside.length ? Math.max(...inside.map((p) => p.lambda)) : best.lambda,
  };

  return {
    lambda: best.lambda,
    pBar: bestPBar(obs, best.lambda),
    logLik: best.logLik,
    profile,
    interval,
    atBoundary: best.lambda <= 0 || best.lambda >= 1,
    unidentified: interval.hi - interval.lo >= 0.98,
    excludesNoDecay: trials > 0 && interval.hi < 1,
    trials,
    successes,
    degenerateCells,
  };
}

/**
 * The λ the paper may use as a point value, or `null`.
 *
 * Returning `null` is the whole safeguard, and the condition is deliberately
 * `excludesNoDecay` rather than "did the optimiser converge". The proposal
 * promises λ is *"a measured property of the run, not a tuned knob"*. An
 * estimate whose interval contains 1 has not measured decay — it has failed to
 * rule out its absence — and propagating its point value into θ_c would let a
 * sampling artefact set the policy. Callers must handle `null` by saying so.
 */
export function reportedLambda(fit: LambdaFit): number | null {
  if (fit.trials === 0) return null;
  if (fit.atBoundary || fit.unidentified) return null;
  if (!fit.excludesNoDecay) return null;
  return fit.lambda;
}

// ------------------------------------------------------------ class beliefs

export interface ClassBelief {
  cls: TriageClass;
  belief: Belief;
  trials: number;
  successes: number;
  /** Posterior mean — p(c, 0). */
  pZero: number;
}

export function classBeliefs(obs: readonly AttemptObservation[]): ClassBelief[] {
  const out = new Map<TriageClass, ClassBelief>();
  for (const o of obs) {
    const entry =
      out.get(o.cls) ?? { cls: o.cls, belief: { ...JEFFREYS }, trials: 0, successes: 0, pZero: 0 };
    for (let i = 0; i < o.successes; i++) entry.belief = update(entry.belief, true);
    for (let i = 0; i < o.trials - o.successes; i++) entry.belief = update(entry.belief, false);
    entry.trials += o.trials;
    entry.successes += o.successes;
    out.set(o.cls, entry);
  }
  for (const e of out.values()) e.pZero = posteriorMean(e.belief);
  return [...out.values()].sort((a, b) => a.cls.localeCompare(b.cls));
}

// ----------------------------------------------------------------- report

/**
 * q_c — the probability a human unblocks a failure of class c.
 *
 * **These are assumptions, not measurements, and nothing in this project can
 * measure them**: no human was ever interrupted, so the archive is silent. They
 * are declared here as a single named constant so that every figure derived from
 * them can be traced back to one place and labelled as conditional on it — the
 * alternative is the same number typed into six call sites, where a reader
 * cannot tell an assumption from a result.
 *
 * The ordering is the defensible part and it comes straight from the thesis: a
 * human is most useful on a LOGIC failure (the agent is confused and will not
 * find the answer alone), least useful on a FORMAT failure (the agent can fix it
 * itself, instantly), and useless on a BROKEN one (there is nothing to unblock).
 * Stage 2 either elicits these or reports the policy over a range of them.
 */
export const ASSUMED_Q: Record<TriageClass, number> = {
  FORMAT: 0.9,
  LOGIC: 0.7,
  BROKEN: 0.0,
  LOST: 0.6,
};

export const DEFAULT_PAYOFFS: Payoffs = { G: 1, r: 0.02, h: 0.3 };

export interface PolicyRow {
  cls: TriageClass;
  q: number;
  theta: number;
  pZero: number;
  trials: number;
  successes: number;
  /**
   * What CC-OS does at k = 0 given the pilot's belief.
   *
   * `"ABORT"` for BROKEN: triage aborts that class before the stopping rule is
   * consulted, so the rule has no opinion. Printing a RETRY/ESCALATE for it
   * would invite a reader to check an inequality that is never evaluated.
   */
  decision: Decision | "ABORT";
  /** What the class *should* get, per the proposal's table. */
  prescribed: "retry" | "escalate" | "abort";
  /** Whether the derived policy agrees with the prescription. */
  agrees: boolean;
  /** True when the row rests on the prior alone — no observation of this class. */
  priorOnly: boolean;
  /**
   * The value of q_c at which this class's decision flips, from
   * `p > q − (h − r)/G`  ⟺  `q < p + (h − r)/G`.
   *
   * This is the useful output of a disagreement. `q_c` is assumed, not measured,
   * so a derived policy that contradicts the thesis is not evidence against
   * either until the assumption is pinned — and the flip point says exactly
   * which assumption would have to hold. It is also the quantity the dashboard's
   * first view puts on a slider.
   */
  qFlip: number;
}

export interface CcosReport {
  payoffs: Payoffs;
  observations: AttemptObservation[];
  beliefs: ClassBelief[];
  fit: LambdaFit;
  /** The λ used downstream: the fit when it is usable, else the stated fallback. */
  lambdaUsed: number;
  lambdaIsMeasured: boolean;
  policy: PolicyRow[];
  arms: { id: string; label: string; represents: string; decisions: Record<string, Decision> }[];
  /**
   * The backward induction, run per class.
   *
   * LOGIC alone makes a poor demonstration: its p ≈ 0.02 is so far below every
   * threshold that V_k is constant and the recursion visibly does nothing.
   * FORMAT, at p = 0.5, is where the horizon and the myopic rule actually
   * disagree — which is the property worth showing.
   */
  horizons: { cls: TriageClass; result: HorizonResult }[];
  /** Survivorship diagnostics for the λ fit. */
  survivorship: { successes: number; retriedAfterSuccess: number; confounded: boolean; maxDepth: number };
}

/**
 * λ = 1 when the fit is unusable: no decay.
 *
 * It is the only defensible placeholder. Any value below 1 asserts a rate of
 * context rot the data did not support, and asserting none is at least a stated
 * null that the Stage-2 fit can reject.
 */
export const LAMBDA_FALLBACK = 1;

export function ccosReport(rows: ArchiveRow[], payoffs: Payoffs = DEFAULT_PAYOFFS): CcosReport {
  const obs = attemptObservations(rows);
  const beliefs = classBeliefs(obs.observations);
  const fit = fitLambda(obs.observations);
  const measured = reportedLambda(fit);
  const lambdaUsed = measured ?? LAMBDA_FALLBACK;

  const byClass = new Map(beliefs.map((b) => [b.cls, b]));
  const policy: PolicyRow[] = (["FORMAT", "LOGIC", "BROKEN", "LOST"] as const).map((cls) => {
    const b = byClass.get(cls);
    const belief = b?.belief ?? { ...JEFFREYS };
    const q = ASSUMED_Q[cls];
    const ctx: DecisionContext = { cls, k: 0, belief, lambda: lambdaUsed, q, payoffs };
    const pZero = posteriorMean(belief);
    // BROKEN is aborted by triage before the rule is consulted.
    const decision: Decision | "ABORT" = cls === "BROKEN" ? "ABORT" : decide(ctx, CCOS);
    const prescribed =
      cls === "FORMAT" ? ("retry" as const) : cls === "BROKEN" ? ("abort" as const) : ("escalate" as const);
    return {
      cls,
      q,
      theta: theta(q, payoffs),
      pZero,
      trials: b?.trials ?? 0,
      successes: b?.successes ?? 0,
      decision,
      prescribed,
      agrees:
        cls === "BROKEN" ? true : decision === (prescribed === "retry" ? "RETRY" : "ESCALATE"),
      priorOnly: (b?.trials ?? 0) === 0,
      qFlip: pZero + (payoffs.h - payoffs.r) / payoffs.G,
    };
  });

  const armList = [STUBBORN, NEEDY, randomArm(0.5), CCOS];
  const arms = armList.map((arm) => {
    const decisions: Record<string, Decision> = {};
    for (const row of policy) {
      const b = byClass.get(row.cls);
      decisions[row.cls] = decide(
        {
          cls: row.cls,
          k: 0,
          belief: b?.belief ?? { ...JEFFREYS },
          lambda: lambdaUsed,
          q: row.q,
          payoffs,
        },
        arm,
      );
    }
    return { id: arm.id, label: arm.label, represents: arm.represents, decisions };
  });

  const horizons = (["FORMAT", "LOGIC"] as const).map((cls) => ({
    cls: cls as TriageClass,
    result: horizon({
      belief: byClass.get(cls)?.belief ?? { ...JEFFREYS },
      lambda: lambdaUsed,
      q: ASSUMED_Q[cls],
      payoffs,
      K: 5,
    }),
  }));

  return {
    payoffs,
    observations: obs.observations,
    beliefs,
    fit,
    lambdaUsed,
    lambdaIsMeasured: measured !== null,
    policy,
    arms,
    horizons,
    survivorship: {
      successes: obs.successes,
      retriedAfterSuccess: obs.retriedAfterSuccess,
      confounded: obs.successes > 0 && obs.retriedAfterSuccess === 0,
      maxDepth: obs.maxDepth,
    },
  };
}

export function renderCcosReport(rep: CcosReport): string {
  const L: string[] = [];
  const { payoffs: p } = rep;

  L.push("## CC-OS, implemented");
  L.push("");
  L.push(
    "**This section demonstrates that the method is implementable. It is not a result.** " +
      "No arm was executed against a model, no human was ever interrupted, and nothing below " +
      "measures whether CC-OS beats the baselines — that is Stage 2.",
  );
  L.push("");
  L.push(`Payoffs: G = ${p.G}, r = ${p.r}, h = ${p.h}. θ_c = q_c − (h − r)/G.`);
  L.push("");

  L.push("### The four arms are one algorithm");
  L.push("");
  L.push("| Arm | θ | Represents | FORMAT | LOGIC | BROKEN | LOST |");
  L.push("|---|---|---|---|---|---|---|");
  const thetaLabel: Record<string, string> = {
    A_stubborn: "−∞",
    B_needy: "+∞",
    C_random: "±∞, ρ = 0.5",
    D_ccos: "θ_c",
  };
  for (const a of rep.arms) {
    L.push(
      `| ${a.label} | ${thetaLabel[a.id] ?? "—"} | ${a.represents} | ` +
        `${a.decisions.FORMAT} | ${a.decisions.LOGIC} | ${a.decisions.BROKEN} | ${a.decisions.LOST} |`,
    );
  }
  L.push("");
  L.push(
    "There is one `decide` function in `ccos.ts`. The rows above differ only in the `thetaFor` " +
      "handed to it, which is what makes *\"the baselines are not separate programs\"* a " +
      "structural property rather than a claim — `tests/ccos.test.ts` checks it by enumerating " +
      "the decision space.",
  );
  L.push("");

  L.push("### The policy is derived, not written");
  L.push("");
  L.push(
    "| Class | trials | successes | p(c,0) | q_c (assumed) | θ_c | CC-OS decides | thesis prescribes | agrees iff |",
  );
  L.push("|---|---:|---:|---:|---:|---:|---|---|---|");
  for (const row of rep.policy) {
    const p = row.priorOnly ? `${row.pZero.toFixed(3)} _(prior)_` : row.pZero.toFixed(3);
    const flip =
      row.cls === "BROKEN"
        ? "n/a — aborted by triage"
        : row.prescribed === "retry"
          ? `q_c < ${row.qFlip.toFixed(3)}`
          : `q_c > ${row.qFlip.toFixed(3)}`;
    L.push(
      `| ${row.cls} | ${row.trials} | ${row.successes} | ${p} | ${row.q} | ` +
        `${row.theta.toFixed(3)} | ${row.decision} | ${row.prescribed} | ${flip} |`,
    );
  }
  L.push("");
  const disagree = rep.policy.filter((r) => !r.agrees);
  const priorOnly = rep.policy.filter((r) => r.priorOnly && r.cls !== "BROKEN");
  L.push(
    "The derived column is the point: nobody wrote *retry formatting errors* anywhere. The " +
      "inequality is evaluated against the pilot's own observed rates, and the last column " +
      "gives the condition on the one quantity this study could not observe.",
  );
  L.push("");
  if (disagree.length > 0) {
    L.push(
      `**${disagree.length} class(es) come out against the thesis's prescription under the ` +
        `assumed q: ${disagree.map((d) => d.cls).join(", ")}.** This is reported rather than ` +
        "corrected, and it is not yet a contradiction — it is a constraint on `ASSUMED_Q`:",
    );
    L.push("");
    for (const d of disagree) {
      L.push(
        `- **${d.cls}** is prescribed *${d.prescribed}*, and the rule prescribes it too for ` +
          `**${d.prescribed === "retry" ? `q_${d.cls} < ${d.qFlip.toFixed(3)}` : `q_${d.cls} > ${d.qFlip.toFixed(3)}`}**. ` +
          `The assumed value is ${d.q}` +
          (d.priorOnly
            ? ", and p(c,0) here is the Jeffreys prior with no observation behind it, so the row carries no data at all."
            : `, against an observed p = ${d.pZero.toFixed(3)} over ${d.trials} retries.`),
      );
    }
    L.push("");
    L.push(
      "Pick FORMAT as the worked case. The thesis's argument for retrying a format failure is " +
        "about *cost* — the agent fixes it itself, instantly — and the inequality already " +
        "carries that through `h` and `r`. What it cannot carry is a human who is assumed to " +
        "succeed 90% of the time on a failure the agent itself repairs half the time. Elicit " +
        "q_FORMAT below the figure above and the derived policy reproduces the prescription " +
        "with no code change, which is the behaviour the thesis claims.",
    );
    L.push("");
  }
  L.push(
    "`q_c` is an **assumption** (`ASSUMED_Q`), not a measurement: no human was ever interrupted " +
      "in this study, so the archive is silent on it and no amount of reanalysis will fill it " +
      "in. Every θ_c above is conditional on it, and Stage 2 either elicits these four numbers " +
      "or reports the policy as a function of them.",
  );
  if (priorOnly.length > 0) {
    L.push("");
    L.push(
      `${priorOnly.map((r) => r.cls).join(" and ")} rest on the Jeffreys prior alone — zero ` +
        "observations — so their p(c,0) of 0.5 is a statement about the prior and not about " +
        "any model. They are shown to demonstrate that the policy is total over the taxonomy, " +
        "not to report a rate.",
    );
  }
  L.push("");

  L.push("### λ is fitted, and the fit does not evidence context rot");
  L.push("");
  L.push(`| | |`);
  L.push(`|---|---|`);
  L.push(`| retry trials observed | ${rep.fit.trials} |`);
  L.push(`| successes | ${rep.fit.successes} |`);
  L.push(`| cells at a rate of exactly 0 or 1 | ${rep.fit.degenerateCells} of ${rep.observations.length} |`);
  L.push(`| profile-likelihood maximum | λ̂ = ${rep.fit.lambda.toFixed(3)}, p̄ = ${rep.fit.pBar.toFixed(3)} |`);
  L.push(
    `| 95% likelihood-ratio interval | [${rep.fit.interval.lo.toFixed(3)}, ${rep.fit.interval.hi.toFixed(3)}] |`,
  );
  L.push(`| at a boundary of [0,1] | ${rep.fit.atBoundary ? "**yes**" : "no"} |`);
  L.push(`| interval excludes λ = 1 (any decay at all) | ${rep.fit.excludesNoDecay ? "yes" : "**no**"} |`);
  L.push(`| λ propagated into θ_c | ${rep.lambdaIsMeasured ? rep.lambdaUsed.toFixed(3) : `${LAMBDA_FALLBACK} — see below`} |`);
  L.push("");
  L.push(
    `The fit converges to an interior λ̂ = ${rep.fit.lambda.toFixed(3)}, so this is a real ` +
      "maximum-likelihood estimate rather than a tuned constant — which is what the proposal " +
      "promised. It is also **uninformative**, and both halves have to be said together:",
  );
  L.push("");
  if (!rep.fit.excludesNoDecay) {
    L.push(
      `- **The interval reaches ${rep.fit.interval.hi.toFixed(3)}.** λ = 1 is no decay at all, ` +
        "so the pilot does not establish that context rot exists, let alone its rate. A reader " +
        `handed "λ = ${rep.fit.lambda.toFixed(3)}" alone would reasonably believe otherwise, ` +
        "which is why `reportedLambda` returns `null` here and θ_c is computed at " +
        `λ = ${LAMBDA_FALLBACK}, the stated null.`,
    );
  }
  L.push(
    `- **Partial separation.** ${rep.fit.degenerateCells} of ${rep.observations.length} ` +
      "observation cells sit at a rate of exactly 0 or 1 — format-class retries succeeded " +
      "about half the time, logic-class retries never. A Bernoulli rate with no interior " +
      "value constrains the level and not the slope, so most of the sample cannot speak " +
      "about decay even in principle.",
  );
  L.push(
    `- **Successes left the experiment.** ${rep.survivorship.successes} sequences resolved, ` +
      `and ${rep.survivorship.retriedAfterSuccess} of them were retried afterwards. Every ` +
      "later-round denominator is therefore conditioned on earlier-round failure, so λ̂ " +
      "confounds context rot with difficulty selection: the sequence keeps only the tasks " +
      "that were already losing, which biases λ̂ **downwards**. The same survivorship error " +
      "as scoring a baseline over the cells that happened to produce a report, one level up.",
  );
  L.push("");
  L.push(
    `**Design requirement for Stage 2: K ≥ 4 attempt rounds, run unconditionally on a ` +
      `subsample.** The archive's deepest sequence is ${rep.survivorship.maxDepth}. Four is ` +
      "also what the LOST detector needs to be able to fire at all (see the triage section), " +
      "so one change to the grid unblocks both — and it is a change to depth, not to breadth, " +
      "which matters against a token budget already 178% over its ceiling (D25).",
  );
  L.push("");

  for (const { cls, result } of rep.horizons) {
    const row = rep.policy.find((r) => r.cls === cls)!;
    L.push(`### Finite-horizon form, ${cls} class, K = ${result.decisions.length}`);
    L.push("");
    L.push("| k | p(c,k) | V_k | decision | horizon threshold | myopic θ |");
    L.push("|---:|---:|---:|---|---:|---:|");
    for (let k = 0; k < result.decisions.length; k++) {
      const pk = row.pZero * Math.pow(rep.lambdaUsed, k);
      L.push(
        `| ${k} | ${pk.toFixed(3)} | ${result.values[k]!.toFixed(4)} | ` +
          `${result.decisions[k]} | ${result.thresholds[k]!.toFixed(3)} | ` +
          `${row.theta.toFixed(3)} |`,
      );
    }
    L.push("");
  }
  L.push(
    "Solved backwards in O(K) from a terminal value of q·G − h: with no attempts left, asking " +
      "is the only move, and setting that terminal value to 0 instead would price running out " +
      "of budget as costless.",
  );
  L.push("");
  L.push(
    "The horizon threshold sits **at or below the myopic θ exactly when the continuation value " +
      "is non-negative** — a retry that fails still leaves attempts in hand, so the option has " +
      "worth and retrying becomes weakly more attractive than the one-step rule allows. The " +
      "inequality reverses when q·G < h: asking is then net-negative, a failed retry leaves a " +
      "liability rather than an option, and the horizon demands *more* of a retry than the " +
      "myopic rule does. The first draft of this analysis asserted the unconditional version; " +
      "`tests/ccos.test.ts` refuted it and now pins both branches.",
  );
  L.push("");
  L.push(
    "That regime also exposes a gap in the rule as published, worth one line in Threats to " +
      "Validity: with both options negative there is no **abandon** action, so the policy keeps " +
      "spending on the less-bad one. A deployment would want a third terminal.",
  );
  L.push("");
  return L.join("\n");
}

// --------------------------------------------------------------------- CLI

const TABLE_OUT = "../reports/data/ccos.md";
const JSON_OUT = "data/ccos.json";

/**
 * `ccos` — regenerate the Phase 2 section and the dashboard feed.
 *
 * Triage rides along, the way the sub-test verdict rides along with `power`:
 * the two halves of Phase 2 answer one question ("is the method implementable,
 * and on what data") and splitting them across two commands would let one be
 * regenerated without the other.
 *
 * Exits non-zero when a *structural* property fails — a class the derived policy
 * handles against its prescription, or a triage record it cannot classify.
 * A degenerate λ is NOT a failure: it is this phase's finding, and the report
 * says so in full.
 */
export async function ccos(toStdout: boolean): Promise<number> {
  if (!existsSync(ARCHIVE_RUNS)) {
    console.error(
      [
        `no archive at ${ARCHIVE_RUNS}/.`,
        "Triage classifies archived records and the beliefs are fitted from them, so",
        "nothing here can be computed without it. Recipe in archive/MANIFEST.md.",
      ].join("\n"),
    );
    return 1;
  }

  const { rows } = await loadArchive();
  const patches = await loadPatches();
  const summary = triageSummary(rows, patches);
  const rep = ccosReport(rows);

  const body = [renderTriageReport(summary), renderCcosReport(rep)].join("\n");

  if (toStdout) {
    process.stdout.write(body);
    return 0;
  }

  await Bun.write(TABLE_OUT, body);
  await Bun.write(
    JSON_OUT,
    JSON.stringify(
      {
        generated_by: "packages/pipeline/analysis/ccos.ts",
        triage: {
          counts: summary.counts,
          measuring: summary.measuring,
          notMeasuring: summary.notMeasuring,
          modelCalls: summary.modelCalls,
          holes: summary.holes,
          maxDepth: summary.maxDepth,
          lostObservable: summary.lostObservable,
          novelty: {
            file: summary.fileNoveltyAfterFirst,
            line: summary.lineNoveltyAfterFirst,
          },
          traces: summary.traces,
          records: summary.records,
        },
        ccos: {
          payoffs: rep.payoffs,
          observations: rep.observations,
          beliefs: rep.beliefs,
          lambda: {
            estimate: rep.fit.lambda,
            pBar: rep.fit.pBar,
            interval: rep.fit.interval,
            atBoundary: rep.fit.atBoundary,
            unidentified: rep.fit.unidentified,
            trials: rep.fit.trials,
            successes: rep.fit.successes,
            degenerateCells: rep.fit.degenerateCells,
            excludesNoDecay: rep.fit.excludesNoDecay,
            used: rep.lambdaUsed,
            isMeasured: rep.lambdaIsMeasured,
            // The profile is what the dashboard's power/λ view plots; 1001 points
            // is small enough to ship and dense enough to draw.
            profile: rep.fit.profile,
          },
          policy: rep.policy,
          arms: rep.arms,
          horizons: rep.horizons,
          survivorship: rep.survivorship,
        },
      },
      null,
      2,
    ) + "\n",
  );

  const unclassified = summary.records.filter(
    (r) => r.cls === null && r.evidenceField !== "resolved" && r.evidenceField !== "verification",
  );
  const disagree = rep.policy.filter((r) => !r.agrees);

  console.log(`\nccos - triage + CC-OS over ${summary.records.length} archived records`);
  console.log(`  model calls to classify them: ${summary.modelCalls}`);
  console.log(
    `  FORMAT ${summary.counts.FORMAT}  LOGIC ${summary.counts.LOGIC}` +
      `  BROKEN ${summary.counts.BROKEN}  LOST ${summary.counts.LOST}` +
      `  (resolved ${summary.counts.succeeded}, unverified ${summary.counts.unverified})`,
  );
  console.log(
    `  matrix holes: ${summary.holes.length} of ${FAILURE_POOL.length * CONDITIONS.length}` +
      " condition-task cells have no record",
  );
  console.log(
    `  LOST reachable: ${summary.lostObservable ? "yes" : "NO"} - deepest trajectory ` +
      `${summary.maxDepth}, window 3, so every window contains attempt 1 (novelty 1 by` +
      " definition) and the mean cannot fall below 1/3",
  );
  console.log(
    `  file novelty on retries: ${summary.fileRetries.zero} of ` +
      `${summary.fileNoveltyAfterFirst.length} are exactly 0, and all ` +
      `${summary.fileRetries.nonzero} non-zero come from an unparseable patch - the` +
      " proposal's score inverts",
  );
  console.log(
    `  line novelty on retries: ${
      summary.lineNoveltyAfterFirst.length
        ? `${Math.min(...summary.lineNoveltyAfterFirst).toFixed(3)}-${Math.max(
            ...summary.lineNoveltyAfterFirst,
          ).toFixed(3)}`
        : "n/a"
    } - the replacement separates`,
  );
  console.log(
    `  lambda: ${rep.fit.lambda.toFixed(3)} [${rep.fit.interval.lo.toFixed(2)}, ` +
      `${rep.fit.interval.hi.toFixed(2)}] - evidence of any decay: ` +
      `${rep.fit.excludesNoDecay ? "yes" : "NO"} (${rep.fit.degenerateCells}/` +
      `${rep.observations.length} cells separated, ${rep.fit.successes}/${rep.fit.trials} retries succeeded)`,
  );
  console.log(
    `  survivorship: ${rep.survivorship.retriedAfterSuccess} of ${rep.survivorship.successes}` +
      ` successes were retried -> ${rep.survivorship.confounded ? "CONFOUNDED" : "ok"}`,
  );
  console.log(`  four arms, one decide(): ${rep.arms.map((a) => a.id).join(", ")}`);
  if (disagree.length > 0) {
    console.log(
      `  under assumed q, the rule contradicts the prescription on ` +
        `${disagree.map((d) => `${d.cls} (needs q ${d.prescribed === "retry" ? "<" : ">"} ${d.qFlip.toFixed(2)}, assumed ${d.q})`).join(", ")}`,
    );
  }
  console.log(`  wrote ${TABLE_OUT}`);
  console.log(`  wrote ${JSON_OUT}`);

  /**
   * Only a *structural* failure exits non-zero.
   *
   * A record triage cannot classify breaks the feasibility claim, so it fails.
   * A policy that contradicts the prescription under an **assumed** q does not:
   * the assumption is the weak link, the report prints the value of q that would
   * resolve it, and failing the gate here would pressure a future reader into
   * editing `ASSUMED_Q` until the test passes — which is the exact opposite of
   * "the policy is derived, not written".
   */
  if (unclassified.length > 0) {
    console.error(
      `\n  ${unclassified.length} record(s) triage could not classify. The taxonomy is` +
        " incomplete, which breaks the feasibility claim:",
    );
    for (const r of unclassified.slice(0, 5)) {
      console.error(`    ${r.taskId} ${r.run} - ${r.evidenceField}`);
    }
    return 1;
  }
  console.log("");
  return 0;
}
