import { z } from "zod";
import rowsJson from "@/data/rows.json";
import provenanceJson from "@/data/provenance.json";

/**
 * The shape of a swept cell, parsed once.
 *
 * Strict where a wrong value would change a conclusion -- the arm, the
 * strategy, the edit format, the outcome kind, the verification level -- and
 * loose on the outcome's detail fields, which legitimately differ by kind
 * (`searchText` only exists on MALFORMED, `gitStderr` only on APPLY_FAIL).
 * An unknown arm or an unknown outcome kind should stop the build; an extra
 * diagnostic field the engine started emitting should not.
 */

export const ARMS = [
  "a1_replication",
  "a2_workhorse",
  "a3_capability",
  "a4_reasoning",
  "a5_format_at_scale",
  "a6_qwencloud",
] as const;

export const STRATEGIES = [
  "l0_baseline",
  "l1_blind_retry",
  "l2_reflection",
  "l2_5_diagnose_revise",
] as const;

export const EDIT_FORMATS = ["search_replace", "unified_diff"] as const;

export const OUTCOME_KINDS = [
  "APPLIED",
  "MALFORMED",
  "APPLY_FAIL",
  "TRUNCATED",
  "NO_PATCH",
  "NO_OUTPUT",
  "PROVIDER_ERROR",
] as const;

/**
 * Each block of the experiment in plain words, and the question it was run to
 * answer.
 *
 * The arm ids are internal names (`a3_capability`) that mean nothing to a
 * reader meeting them for the first time, and an examiner should never have to
 * learn six of them to follow an argument. The ids stay in the receipts; these
 * labels are what appears on screen.
 */
export const ARM_LABEL: Record<Arm, string> = {
  a1_replication: "The pilot, re-run",
  a2_workhorse: "The everyday model",
  a3_capability: "The large model",
  a4_reasoning: "Extended thinking",
  a5_format_at_scale: "Edit format, at scale",
  a6_qwencloud: "A hosted commercial model",
};

export const ARM_QUESTION: Record<Arm, string> = {
  a1_replication:
    "Could the original pilot design have detected anything at all, even in principle?",
  a2_workhorse:
    "On an ordinary model, does retrying help — and does thinking about the failure first help more?",
  a3_capability:
    "Does a far larger model recover from its own mistakes any better?",
  a4_reasoning:
    "Does turning on the model's extended thinking mode change how it recovers?",
  a5_format_at_scale:
    "Across 60 bugs: does the way the model is asked to write its edit decide whether it can be applied?",
  a6_qwencloud:
    "Do the same patterns appear on a commercial hosted model, or are they an artifact of one provider?",
};

export const STRATEGY_LABEL: Record<Strategy, string> = {
  l0_baseline: "First attempt",
  l1_blind_retry: "Blind retry",
  l2_reflection: "Reflection",
  l2_5_diagnose_revise: "Diagnose from evidence",
};

/** What each way of retrying actually does, for a reader meeting it cold. */
export const STRATEGY_PLAIN: Record<Strategy, string> = {
  l0_baseline: "The model's first go at the bug, with no retry.",
  l1_blind_retry:
    "Tell the model it failed and ask again, without saying what went wrong.",
  l2_reflection:
    "Ask the model to explain why it failed, then write a new patch.",
  l2_5_diagnose_revise:
    "Show the model the real error output and ask it to diagnose from that. Needs evidence the run could not collect, so it mostly refused.",
};

export const EDIT_FORMAT_LABEL: Record<EditFormat, string> = {
  search_replace: "search_replace",
  unified_diff: "unified_diff",
};

const Cell = z.object({
  taskId: z.string(),
  strategy: z.enum(STRATEGIES),
  model: z.string(),
  editFormat: z.enum(EDIT_FORMATS),
  thinking: z.boolean(),
  /**
   * Round numbering is NOT consistent across arms, and assuming it is will
   * produce a wrong chart. The five recovery arms number the baseline **0** and
   * recovery rounds 1..4 (92 rows at round 0). `a5` has no recovery at all and
   * numbers its single baseline shot **1** (720 rows). So "round 1" means
   * "first recovery attempt" in a2/a3/a4/a6/a1 and "the only attempt" in a5.
   * Always filter by arm before reading a round.
   */
  round: z.number().int().nonnegative(),
  /** 0-based. 0..2 in a5, 0..4 in the recovery arms. */
  repeat: z.number().int().nonnegative(),
});

const Outcome = z.looseObject({
  kind: z.enum(OUTCOME_KINDS),
  /** HTTP status, or null for a refusal that never reached the network. */
  status: z.number().nullable().optional(),
  reason: z.string().optional(),
  detail: z.string().optional(),
  gitStderr: z.string().optional(),
  searchText: z.string().optional(),
  retries: z.number().optional(),
  filesChanged: z.array(z.string()).optional(),
});

const Usage = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  /** Always null across the whole sweep; no model reported reasoning tokens. */
  reasoningTokens: z.number().nullable(),
  latencyMs: z.number(),
});

export const SweepRow = z.object({
  key: z.string(),
  arm: z.enum(ARMS),
  runId: z.string(),
  timestamp: z.string(),
  cell: Cell,
  /**
   * "apply" on every live row. This IS R1 in the data: the sweep verified
   * whether a patch applied, never whether it fixed the bug.
   */
  verification: z.literal("apply"),
  outcome: Outcome,
  /** null on exactly the rows where no call was made. */
  usage: Usage.nullable(),
  /** "none" on every live row -- Docker was out of reach (D6). */
  evidenceSource: z.string(),
  comparableToChapter5: z.boolean(),
  honouredCondition: z.boolean(),
});

export type SweepRow = z.infer<typeof SweepRow>;
export type Arm = (typeof ARMS)[number];
export type Strategy = (typeof STRATEGIES)[number];
export type EditFormat = (typeof EDIT_FORMATS)[number];
export type OutcomeKind = (typeof OUTCOME_KINDS)[number];

export const Provenance = z.object({
  syncedFrom: z.string(),
  commit: z.string().nullable(),
  rows: z.number(),
  patches: z.number(),
  cells: z.number(),
  dropped: z.array(z.string()),
  sourceHashes: z.record(z.string(), z.string()),
});
export type Provenance = z.infer<typeof Provenance>;

/**
 * Parsed once at module load, which under `output: "export"` means once at
 * build time. A malformed snapshot fails the build rather than rendering a
 * screen full of undefined.
 */
let cached: SweepRow[] | null = null;

export function loadRows(): SweepRow[] {
  if (cached) return cached;
  const parsed = z.array(SweepRow).safeParse(rowsJson);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      `rows.json failed validation: ${first?.path.join(".")} — ${first?.message}. ` +
        `Run \`bun run sync\` to refresh the snapshot.`,
    );
  }
  cached = parsed.data;
  return cached;
}

export function loadProvenance(): Provenance {
  return Provenance.parse(provenanceJson);
}
