import type { FailureClass } from "@/components/primitives/ClassMark";
import {
  ARMS,
  type Arm,
  type EditFormat,
  type OutcomeKind,
  type Strategy,
  type SweepRow,
} from "./rows";

/**
 * Every number the console shows comes from a function in this file.
 *
 * No component computes an aggregate and no component hardcodes a figure. The
 * rule exists so that a disputed number has exactly one place to be checked,
 * and so the tests in derive.test.ts are a complete audit of what gets shown.
 */

// ── R2: the provider-error split ───────────────────────────────────────────

/**
 * 176 rows carry `outcome.kind === "PROVIDER_ERROR"`, and they are THREE
 * different things. Rendering the kind directly says "the API failed 176
 * times", which is false.
 *
 *   STARVED  98   l2_5_diagnose_revise needs real test evidence, which needs
 *                 Docker, which D6 ruled out. The condition could not run on
 *                 any row -- a structural limit of the study design.
 *   CASCADE  32   A reflection condition whose previous attempt died, so there
 *                 was nothing to reflect on (D36). a1 lost 4, a2 lost 8,
 *                 a4 lost 20.
 *   REAL     46   27 HTTP 503, 15 timeouts, 2 HTTP 404, 2 other.
 *
 * The split is on the reason prefix, NOT on `status === null`: 145 of the 176
 * have a null status, because the 15 timeouts do too. Using status
 * over-reports by-design refusals by 15.
 */
export type RefusalKind = "STARVED" | "CASCADE" | "REAL";

export function refusalKind(row: SweepRow): RefusalKind | null {
  if (row.outcome.kind !== "PROVIDER_ERROR") return null;
  const reason = row.outcome.reason ?? "";
  if (reason.includes("needs real evidence")) return "STARVED";
  if (reason.includes("needs a previous attempt")) return "CASCADE";
  return "REAL";
}

export function splitProviderError(rows: SweepRow[]) {
  let starved = 0;
  let cascade = 0;
  let real = 0;
  for (const row of rows) {
    switch (refusalKind(row)) {
      case "STARVED":
        starved++;
        break;
      case "CASCADE":
        cascade++;
        break;
      case "REAL":
        real++;
        break;
    }
  }
  return {
    starved,
    cascade,
    real,
    /** What the paper calls "refused by design" -- never measured the model. */
    byDesign: starved + cascade,
    total: starved + cascade + real,
  };
}

// ── R3: the holes ──────────────────────────────────────────────────────────

/**
 * The cells that were never attempted because an earlier round in their
 * lineage died. Drawn as absences, never as zeros: a blank in a results table
 * reads as a measured zero.
 *
 * These are a SUBSET of the 130 by-design refusals, not a separate population.
 * Counting both independently double-counts 32 cells.
 */
export function holes(rows: SweepRow[]) {
  return rows
    .filter((row) => refusalKind(row) === "CASCADE")
    .map((row) => ({
      key: row.key,
      arm: row.arm,
      taskId: row.cell.taskId,
      strategy: row.cell.strategy,
      round: row.cell.round,
      repeat: row.cell.repeat,
      reason: row.outcome.reason ?? "",
    }));
}

// ── classification ─────────────────────────────────────────────────────────

/**
 * The failure class of a row, observed from its outcome rather than predicted.
 * Zero model calls -- that is the feasibility claim the paper makes.
 *
 * Returns null for a row that did not fail. Note what this CANNOT say on live
 * data: LOGIC means "applied cleanly and the test still failed", and no live
 * row ran a test (R1). So on the sweep, APPLIED is not a success -- it is an
 * unknown, and it is reported as its own category rather than folded into
 * either side.
 */
export function classify(row: SweepRow): FailureClass | null {
  switch (row.outcome.kind) {
    case "APPLIED":
      return null;
    case "MALFORMED":
    case "APPLY_FAIL":
    case "TRUNCATED":
    case "NO_PATCH":
    case "NO_OUTPUT":
      return "FORMAT";
    case "PROVIDER_ERROR":
      return refusalKind(row) === "REAL" ? "BROKEN" : null;
  }
}

// ── per-arm summary ────────────────────────────────────────────────────────

export type ArmSummary = {
  arm: Arm;
  rows: number;
  applied: number;
  malformed: number;
  starved: number;
  cascade: number;
  realErrors: number;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  tokens: number;
  tasks: number;
  models: string[];
  maxRound: number;
  /** Span from first to last timestamp, in ms. */
  wallMs: number;
};

export function armSummary(rows: SweepRow[]): ArmSummary[] {
  return ARMS.map((arm) => {
    const inArm = rows.filter((row) => row.arm === arm);
    const split = splitProviderError(inArm);

    let promptTokens = 0;
    let completionTokens = 0;
    let calls = 0;
    let first = Infinity;
    let last = -Infinity;

    for (const row of inArm) {
      const at = Date.parse(row.timestamp);
      if (Number.isFinite(at)) {
        if (at < first) first = at;
        if (at > last) last = at;
      }
      if (row.usage) {
        calls++;
        promptTokens += row.usage.promptTokens;
        completionTokens += row.usage.completionTokens;
      }
    }

    return {
      arm,
      rows: inArm.length,
      applied: inArm.filter((r) => r.outcome.kind === "APPLIED").length,
      malformed: inArm.filter((r) => r.outcome.kind === "MALFORMED").length,
      starved: split.starved,
      cascade: split.cascade,
      realErrors: split.real,
      calls,
      promptTokens,
      completionTokens,
      tokens: promptTokens + completionTokens,
      tasks: new Set(inArm.map((r) => r.cell.taskId)).size,
      models: [...new Set(inArm.map((r) => r.cell.model))].sort(),
      maxRound: inArm.reduce((m, r) => Math.max(m, r.cell.round), 0),
      wallMs: Number.isFinite(first) ? last - first : 0,
    };
  }).filter((summary) => summary.rows > 0);
}

export function totals(rows: SweepRow[]) {
  const summaries = armSummary(rows);
  return {
    rows: rows.length,
    calls: summaries.reduce((n, s) => n + s.calls, 0),
    tokens: summaries.reduce((n, s) => n + s.tokens, 0),
    arms: summaries.length,
    models: new Set(rows.map((r) => r.cell.model)).size,
    tasks: new Set(rows.map((r) => r.cell.taskId)).size,
    ...splitProviderError(rows),
  };
}

// ── exact McNemar ──────────────────────────────────────────────────────────

/** log(n!) via lgamma, so n in the hundreds does not overflow. */
function lnFactorial(n: number): number {
  let sum = 0;
  for (let i = 2; i <= n; i++) sum += Math.log(i);
  return sum;
}

function binomPmf(k: number, n: number, p = 0.5): number {
  if (k < 0 || k > n) return 0;
  const lnC = lnFactorial(n) - lnFactorial(k) - lnFactorial(n - k);
  return Math.exp(lnC + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

export type McNemar = {
  /** Discordant in favour of A. */
  b: number;
  /** Discordant in favour of B. */
  c: number;
  /** Discordant pairs, b + c. */
  n: number;
  /** Concordant pairs, which the test discards. */
  concordant: number;
  p: number;
  /**
   * The exact test cannot reach alpha = 0.05 below 6 discordant pairs,
   * whatever the sample size: the most extreme split of m pairs gives
   * p = 2 * (1/2)^m. Below that the rejection region is empty, so power is not
   * low -- it is zero.
   */
  canReject: boolean;
};

export const REJECTION_FLOOR = 6;

/**
 * Exact two-sided McNemar: a binomial test at p = 1/2 on the discordant pairs.
 * No normal approximation and no continuity correction, both of which are
 * wrong at these sample sizes.
 */
export function mcNemar(b: number, c: number, concordant = 0): McNemar {
  const n = b + c;
  let p = 1;
  if (n > 0) {
    const lo = Math.min(b, c);
    let tail = 0;
    for (let k = 0; k <= lo; k++) tail += binomPmf(k, n);
    p = Math.min(1, 2 * tail);
  }
  return { b, c, n, concordant, p, canReject: n >= REJECTION_FLOOR };
}

/**
 * Pair rows on everything except the dimension under test, then run the exact
 * test on whether the outcome applied.
 *
 * Pairing is explicit rather than positional. In a5 the 720 rows form exactly
 * 360 groups of 2 on (taskId, model, repeat, round, strategy) -- verified, not
 * assumed -- and a group that does not have exactly one row per side is
 * dropped and counted, never silently half-used.
 */
export function pairOnApplied(
  rows: SweepRow[],
  dimension: (row: SweepRow) => string,
  sideA: string,
  sideB: string,
  pairKey: (row: SweepRow) => string,
): McNemar & { dropped: number } {
  const groups = new Map<string, Map<string, SweepRow[]>>();
  for (const row of rows) {
    const side = dimension(row);
    if (side !== sideA && side !== sideB) continue;
    const key = pairKey(row);
    let group = groups.get(key);
    if (!group) groups.set(key, (group = new Map()));
    const bucket = group.get(side) ?? [];
    bucket.push(row);
    group.set(side, bucket);
  }

  let b = 0;
  let c = 0;
  let concordant = 0;
  let dropped = 0;

  for (const group of groups.values()) {
    const a = group.get(sideA);
    const bb = group.get(sideB);
    if (a?.length !== 1 || bb?.length !== 1) {
      dropped++;
      continue;
    }
    const aApplied = a[0]!.outcome.kind === "APPLIED";
    const bApplied = bb[0]!.outcome.kind === "APPLIED";
    if (aApplied && !bApplied) b++;
    else if (!aApplied && bApplied) c++;
    else concordant++;
  }

  return { ...mcNemar(b, c, concordant), dropped };
}

const FORMAT_PAIR_KEY = (row: SweepRow) =>
  [
    row.cell.taskId,
    row.cell.model,
    row.cell.repeat,
    row.cell.round,
    row.cell.strategy,
  ].join("|");

// ── apply rate by edit format ──────────────────────────────────────────────

export function applyRateByFormat(rows: SweepRow[], arm?: Arm) {
  const scope = arm ? rows.filter((r) => r.arm === arm) : rows;

  const byFormat = (format: EditFormat) => {
    const inFormat = scope.filter((r) => r.cell.editFormat === format);
    const applied = inFormat.filter((r) => r.outcome.kind === "APPLIED").length;
    return {
      format,
      rows: inFormat.length,
      applied,
      rate: inFormat.length ? applied / inFormat.length : 0,
    };
  };

  return {
    searchReplace: byFormat("search_replace"),
    unifiedDiff: byFormat("unified_diff"),
    test: pairOnApplied(
      scope,
      (r) => r.cell.editFormat,
      "search_replace",
      "unified_diff",
      FORMAT_PAIR_KEY,
    ),
  };
}

// ── apply rate per round ───────────────────────────────────────────────────

export type RoundPoint = {
  round: number;
  rows: number;
  applied: number;
  rate: number;
};

/**
 * Apply rate per round for one strategy within one arm.
 *
 * Takes an arm rather than defaulting to all of them, because round numbering
 * differs between arms (see rows.ts) and pooling them would silently mix a5's
 * single-shot "round 1" with a recovery arm's first retry.
 */
export function roundSeries(
  rows: SweepRow[],
  arm: Arm,
  strategy: Strategy,
): RoundPoint[] {
  const scope = rows.filter(
    (r) => r.arm === arm && r.cell.strategy === strategy,
  );
  const rounds = [...new Set(scope.map((r) => r.cell.round))].sort(
    (x, y) => x - y,
  );
  return rounds.map((round) => {
    const inRound = scope.filter((r) => r.cell.round === round);
    const applied = inRound.filter((r) => r.outcome.kind === "APPLIED").length;
    return {
      round,
      rows: inRound.length,
      applied,
      rate: inRound.length ? applied / inRound.length : 0,
    };
  });
}

/**
 * The reflection-harm test: blind retry against reflection on rounds 2-4,
 * paired within (task, model, repeat, round, thinking, editFormat).
 *
 * Round 1 is excluded deliberately and that is the finding, not a convenience.
 * Reflection HELPS at round 1 (90% against 75%); the harm appears from round 2
 * onward, so a test pooling all four rounds would average the help against the
 * harm and report nothing.
 *
 * `thinking` and `editFormat` are in the key because `a4_reasoning` crosses
 * `thinking` within an arm. Without them every a4 group holds two rows per side
 * and `pairOnApplied` -- correctly refusing to half-use a group -- drops all 60.
 * That returns `n = 0`, which renders as "no harm found" when it means "no pairs
 * formed": the exact failure R3 exists to prevent. The other four recovery arms
 * are single-valued on both dimensions, so adding them changes nothing there
 * (asserted in derive.test.ts).
 */
export function reflectionHarm(rows: SweepRow[], arm: Arm, fromRound = 2) {
  const scope = rows.filter((r) => r.arm === arm && r.cell.round >= fromRound);
  return pairOnApplied(
    scope,
    (r) => r.cell.strategy,
    "l1_blind_retry",
    "l2_reflection",
    (r) =>
      [
        r.cell.taskId,
        r.cell.model,
        r.cell.repeat,
        r.cell.round,
        r.cell.thinking,
        r.cell.editFormat,
      ].join("|"),
  );
}

/**
 * The same test run inside each task separately.
 *
 * The reflection result rests on 4 tasks with 5 repeats, so its 19 discordant
 * pairs are not 19 independent observations -- they cluster. Drawing the split
 * per task turns that limitation from a sentence a reader can skim into a
 * figure they can see: one task supplies over half the signal.
 */
export function harmByTask(rows: SweepRow[], arm: Arm, fromRound = 2) {
  const scope = rows.filter((r) => r.arm === arm && r.cell.round >= fromRound);
  const tasks = [...new Set(scope.map((r) => r.cell.taskId))].sort();
  return tasks
    .map((taskId) => ({
      taskId,
      ...reflectionHarm(
        scope.filter((r) => r.cell.taskId === taskId),
        arm,
        fromRound,
      ),
    }))
    .sort((x, y) => y.n - x.n || x.taskId.localeCompare(y.taskId));
}

// ── completion tokens per round ────────────────────────────────────────────

export type TokenPoint = {
  round: number;
  /** Rows carrying a usage object. A refused row has none and is not averaged. */
  calls: number;
  meanCompletion: number | null;
};

/**
 * Mean completion tokens per round for one strategy within one arm -- the
 * mechanism behind the reflection collapse.
 *
 * Rows without a `usage` object are excluded rather than counted as zero: a
 * refusal that never reached the network did not produce a short completion, it
 * produced no completion. A round where every row refused yields `null`, which
 * `Figure` draws as a grey dash.
 */
export function tokenSeries(
  rows: SweepRow[],
  arm: Arm,
  strategy: Strategy,
): TokenPoint[] {
  const scope = rows.filter(
    (r) => r.arm === arm && r.cell.strategy === strategy,
  );
  const rounds = [...new Set(scope.map((r) => r.cell.round))].sort(
    (x, y) => x - y,
  );
  return rounds.map((round) => {
    const calls = scope.filter((r) => r.cell.round === round && r.usage);
    return {
      round,
      calls: calls.length,
      meanCompletion: calls.length
        ? calls.reduce((n, r) => n + r.usage!.completionTokens, 0) /
          calls.length
        : null,
    };
  });
}

// ── malformed reasons ──────────────────────────────────────────────────────

/**
 * `block_unterminated` is a misleading engine label: in a4, 164 of 181 such
 * rows DID close the block -- the missing piece was the `=======` divider.
 * Relabelled for display only; the underlying value is untouched so it still
 * matches the engine and the archive.
 */
export const MALFORMED_LABEL: Record<string, string> = {
  hunk_count_mismatch: "Hunk count mismatch",
  block_unterminated: "Divider missing",
  search_not_found: "Search text not found",
  no_file_header: "No file header",
  search_not_found_whitespace: "Search text not found (whitespace)",
  hunk_header_unparseable: "Hunk header unparseable",
};

export function malformedByReason(rows: SweepRow[], arm?: Arm) {
  const scope = (arm ? rows.filter((r) => r.arm === arm) : rows).filter(
    (r) => r.outcome.kind === "MALFORMED",
  );
  const counts = new Map<string, number>();
  for (const row of scope) {
    const reason = row.outcome.reason ?? "unknown";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({
      reason,
      label: MALFORMED_LABEL[reason] ?? reason,
      count,
      share: scope.length ? count / scope.length : 0,
    }))
    .sort((x, y) => y.count - x.count);
}

export function outcomeKinds(rows: SweepRow[]) {
  const counts = new Map<OutcomeKind, number>();
  for (const row of rows) {
    counts.set(row.outcome.kind, (counts.get(row.outcome.kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((x, y) => y.count - x.count);
}

// ── the stopping rule ──────────────────────────────────────────────────────

/**
 * The CC-OS threshold.
 *
 *     E[retry]    = p(c,k) * G - r
 *     E[escalate] = q_c    * G - h
 *     RETRY  <=>  p(c,k) > theta_c      where theta_c = q_c - (h - r) / G
 *
 * G is what a fix is worth, r what a retry costs, h what asking a human costs,
 * and q_c the probability a human resolves a class-c failure.
 *
 * This is the design. Applying it to the sweep produces an ILLUSTRATION, not a
 * measurement: the cells are real, the policy outcome is not, because no live
 * row ran a test (R1). Anything drawn from it carries the Illustrative caption.
 */
export function thetaFor(G: number, r: number, h: number, q: number): number {
  if (G === 0) return q;
  return q - (h - r) / G;
}

/**
 * The belief that attempt k+1 succeeds: a Beta-Bernoulli posterior decayed by
 * context rot.
 *
 *     p(c,k) = alpha_c / (alpha_c + beta_c) * lambda^k
 *
 * lambda is measured from the observed success rate against attempt index, not
 * tuned. Reporting it is a result in its own right.
 */
export function belief(
  alpha: number,
  beta: number,
  lambda: number,
  k: number,
): number {
  const base = alpha + beta === 0 ? 0 : alpha / (alpha + beta);
  return base * lambda ** k;
}

/**
 * The four arms in the literature are one algorithm at four thresholds, which
 * is a structural claim rather than an asserted one -- so they are derived from
 * a single policy rather than implemented separately.
 */
export const POLICY_ARMS = {
  stubborn: { label: "Stubborn", theta: Number.NEGATIVE_INFINITY },
  needy: { label: "Needy", theta: Number.POSITIVE_INFINITY },
  ccos: { label: "CC-OS", theta: null },
} as const;

export function shouldRetry(p: number, theta: number): boolean {
  return p > theta;
}
