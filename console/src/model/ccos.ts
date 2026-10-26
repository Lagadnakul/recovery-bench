import { z } from "zod";
import ccosJson from "@/data/ccos.json";
import { FAILURE_CLASSES } from "@/components/primitives/ClassMark";

/**
 * The CC-OS run, as recovery-bench computed it.
 *
 * This is the authoritative source for the beliefs, the payoffs and the fitted
 * decay. `policy.ts` recomputes the same quantities live so a slider can move
 * them, and its test asserts that it reproduces THIS file at the default
 * payoffs. If the two ever disagree, the test fails rather than the screen
 * quietly showing a different algorithm than the paper describes.
 *
 * Everything here is derived from the ARCHIVE's 31 test-verified trials, not
 * from the live sweep. The live sweep cannot contribute: a class belief needs
 * to know whether a retry succeeded, and no live row ran a test (R1).
 */

const Cls = z.enum(FAILURE_CLASSES);

/** G = what a fix is worth, r = cost of a retry, h = cost of asking a human. */
export const Payoffs = z.object({
  G: z.number(),
  r: z.number(),
  h: z.number(),
});
export type Payoffs = z.infer<typeof Payoffs>;

/** Observed retry outcomes per class and attempt index. The p-hat evidence. */
const Observation = z.object({
  cls: Cls,
  /** Attempt index, 0-based. */
  k: z.number().int().nonnegative(),
  trials: z.number().int().nonnegative(),
  successes: z.number().int().nonnegative(),
});

/** The Beta-Bernoulli posterior per class. Jeffreys prior, so alpha/beta carry .5 */
const Belief = z.object({
  cls: Cls,
  belief: z.object({ alpha: z.number(), beta: z.number() }),
  trials: z.number().int().nonnegative(),
  successes: z.number().int().nonnegative(),
  /** The posterior mean at k = 0, i.e. p-hat before any decay. */
  pZero: z.number(),
});

/**
 * The context-rot decay, fitted by profile likelihood.
 *
 * `isMeasured` is the field that matters, and on this run it is FALSE: the
 * interval reaches 1, `excludesNoDecay` is false, and `used` is 1. So the
 * policy as computed carries NO decay. The proposal, BUILD.md and ENGINE.md
 * all state that lambda is "measured, not tuned" -- that is not yet true, and
 * the screen says so rather than repeating the claim.
 */
const Lambda = z.object({
  estimate: z.number(),
  pBar: z.number(),
  interval: z.object({ lo: z.number(), hi: z.number() }),
  atBoundary: z.boolean(),
  unidentified: z.boolean(),
  trials: z.number(),
  successes: z.number(),
  degenerateCells: z.number(),
  /** False means the fit cannot rule out lambda = 1, i.e. no decay at all. */
  excludesNoDecay: z.boolean(),
  /** The value the policy actually ran with. */
  used: z.number(),
  isMeasured: z.boolean(),
  profile: z
    .array(z.object({ lambda: z.number(), logLik: z.number() }))
    .optional(),
});
export type Lambda = z.infer<typeof Lambda>;

export const DECISIONS = ["RETRY", "ESCALATE", "ABORT"] as const;
export type Decision = (typeof DECISIONS)[number];

const PolicyRow = z.object({
  cls: Cls,
  /** Probability a human resolves a class-c failure. An assumption, not data. */
  q: z.number(),
  theta: z.number(),
  pZero: z.number(),
  trials: z.number(),
  successes: z.number(),
  decision: z.enum(DECISIONS),
  /** What the proposal said the rule ought to do for this class. */
  prescribed: z.string(),
  agrees: z.boolean(),
  /** True when the class has no trials and the belief is the prior alone. */
  priorOnly: z.boolean(),
  /** The value of q at which this class's decision flips. */
  qFlip: z.number(),
});
export type PolicyRow = z.infer<typeof PolicyRow>;

const Arm = z.object({
  id: z.string(),
  label: z.string(),
  represents: z.string(),
  decisions: z.record(Cls, z.enum(DECISIONS)),
});
export type Arm = z.infer<typeof Arm>;

const Horizon = z.object({
  cls: Cls,
  result: z.object({
    /** V_k for k = 0..K. */
    values: z.array(z.number()),
    decisions: z.array(z.enum(DECISIONS)),
    thresholds: z.array(z.number()),
  }),
});

/**
 * 10 successes and 0 retried after success, so the data never observes what a
 * retry after a success would do. The screen states this; it is the kind of
 * confound a reviewer finds immediately.
 */
const Survivorship = z.object({
  successes: z.number(),
  retriedAfterSuccess: z.number(),
  confounded: z.boolean(),
  maxDepth: z.number(),
});

export const CcosRun = z.object({
  payoffs: Payoffs,
  observations: z.array(Observation),
  beliefs: z.array(Belief),
  lambda: Lambda,
  policy: z.array(PolicyRow),
  arms: z.array(Arm),
  horizons: z.array(Horizon),
  survivorship: Survivorship,
});
export type CcosRun = z.infer<typeof CcosRun>;

let cached: CcosRun | null = null;

export function loadCcos(): CcosRun {
  if (cached) return cached;
  const parsed = CcosRun.safeParse(
    (ccosJson as { ccos: unknown }).ccos,
  );
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      `ccos.json failed validation: ${first?.path.join(".")} — ${first?.message}. ` +
        `Run \`bun run sync\` to refresh the snapshot.`,
    );
  }
  cached = parsed.data;
  return cached;
}
