import type { FailureClass } from "@/components/primitives/ClassMark";
import type { Decision, Payoffs } from "./ccos";

/**
 * Class-conditioned optimal stopping, recomputed live.
 *
 * recovery-bench computed this once, at one set of payoffs, and wrote the
 * answer to ccos.json. This module computes it for ANY payoffs so a slider can
 * move it -- and policy.test.ts asserts it reproduces ccos.json exactly at the
 * committed values. That test is the whole reason to trust the screen: the
 * professor is dragging the same algorithm the paper describes, not a
 * lookalike.
 *
 * Two forms, and they do not always agree:
 *
 *   MYOPIC          one step. Retry if this attempt's expected value beats
 *                   escalating. Ignores that you have further attempts left.
 *   FINITE-HORIZON  backward induction over K attempts, so retrying carries the
 *                   option value of the attempts it preserves.
 *
 * On FORMAT at the committed payoffs they disagree -- myopic escalates, the
 * horizon form retries -- and that disagreement is the screen's finding.
 */

export type ClassInput = {
  cls: FailureClass;
  /** Beta-Bernoulli posterior. */
  alpha: number;
  beta: number;
  /** Probability a human resolves this class. An assumption, not measured. */
  q: number;
  trials: number;
  successes: number;
};

/** Posterior mean at k = 0. */
export function pZero(alpha: number, beta: number): number {
  const total = alpha + beta;
  return total === 0 ? 0 : alpha / total;
}

/**
 * The belief that attempt k+1 succeeds:  p(c,k) = alpha/(alpha+beta) * lambda^k
 *
 * lambda is the context-rot decay. On this run it is 1 -- the fit could not
 * exclude no decay -- so p is flat in k, and anything the screen says about
 * decay has to say that too.
 */
export function belief(
  alpha: number,
  beta: number,
  lambda: number,
  k: number,
): number {
  return pZero(alpha, beta) * lambda ** k;
}

/**
 *     E[retry]    = p * G - r
 *     E[escalate] = q * G - h
 *
 * Retry when the first beats the second, which rearranges to p > theta with
 *
 *     theta_c = q_c - (h - r) / G
 *
 * Note what this means at the edges: a cheaper human (small h) RAISES theta and
 * makes escalation easier to justify; an expensive human lowers the bar for
 * retrying. That is the direction the sliders demonstrate.
 */
export function theta(q: number, { G, r, h }: Payoffs): number {
  if (G === 0) return q;
  return q - (h - r) / G;
}

/** The q at which this class's decision flips, given p and the payoffs. */
export function qFlip(p: number, { G, r, h }: Payoffs): number {
  if (G === 0) return p;
  return p + (h - r) / G;
}

/**
 * BROKEN aborts rather than escalating, and that is not a threshold decision.
 * A broken instrument is not a failure a human can fix by looking at the patch,
 * so the class leaves the retry/escalate question entirely. q = 0 encodes it.
 */
export function myopicDecision(
  input: ClassInput,
  payoffs: Payoffs,
  lambda: number,
  k = 0,
): { p: number; theta: number; decision: Decision; qFlip: number } {
  const p = belief(input.alpha, input.beta, lambda, k);
  const t = theta(input.q, payoffs);
  const decision: Decision =
    input.q === 0 ? "ABORT" : p > t ? "RETRY" : "ESCALATE";
  return { p, theta: t, decision, qFlip: qFlip(p, payoffs) };
}

/**
 * Finite-horizon backward induction, O(K).
 *
 *     V_K = q*G - h                                  nothing left but to ask
 *     V_k = max( p_k*G - r + (1 - p_k)*V_{k+1},       retry
 *                q*G - h )                           escalate
 *
 * The retry branch is what the myopic rule drops: a failed retry does not end
 * the episode, it leaves you at V_{k+1}, so a cheap retry is worth taking even
 * when its own expected value looks worse than escalating.
 *
 * `thresholds[k]` is the p above which retrying wins at step k. A negative
 * threshold means retry is better for any belief at all.
 */
export function finiteHorizon(
  input: ClassInput,
  payoffs: Payoffs,
  lambda: number,
  K: number,
): { values: number[]; decisions: Decision[]; thresholds: number[] } {
  const { G, r, h } = payoffs;
  const escalateValue = input.q * G - h;

  const values = new Array<number>(K + 1);
  const decisions = new Array<Decision>(K);
  const thresholds = new Array<number>(K);

  values[K] = escalateValue;

  for (let k = K - 1; k >= 0; k--) {
    const p = belief(input.alpha, input.beta, lambda, k);
    const continuation = values[k + 1]!;
    const retryValue = p * G - r + (1 - p) * continuation;

    values[k] = Math.max(retryValue, escalateValue);
    decisions[k] = retryValue > escalateValue ? "RETRY" : "ESCALATE";

    // retryValue > escalateValue  <=>  p * (G - continuation) > escalate - continuation + r
    const slope = G - continuation;
    thresholds[k] =
      slope === 0
        ? Number.POSITIVE_INFINITY
        : (escalateValue - continuation + r) / slope;
  }

  return { values, decisions, thresholds };
}

/**
 * The four arms in the literature are one algorithm at different thresholds.
 * Deriving them from a single policy rather than implementing four makes the
 * claim structural instead of asserted -- which is the point the paper makes.
 */
export const ARM_THETA = {
  A_stubborn: Number.NEGATIVE_INFINITY,
  B_needy: Number.POSITIVE_INFINITY,
  /** Ignores the class: one threshold for all of them. */
  C_random: null,
  /** theta_c, per class. */
  D_ccos: null,
} as const;

export function decisionAt(p: number, t: number, q: number): Decision {
  if (q === 0) return "ABORT";
  return p > t ? "RETRY" : "ESCALATE";
}
