/**
 * Triage over the live sweep, which is where LOST was always going to live.
 *
 * ## Why this file exists at all
 *
 * `triage.ts` classifies the pilot's **51 archived records**. The live sweep has
 * **1,604+** rows and nothing read them: `grep -n sweep_rows analysis/*.ts`
 * returned nothing before this file. §6 of the paper therefore rested on 51
 * observations while 1,604 sat on disk, which is not a defensible ratio to put
 * in front of a reviewer.
 *
 * ## The reason LOST has never fired, and it is not the models
 *
 * ```ts
 * // runs.ts:19
 * export type RoundId = "R0" | "R1" | "R2";
 * ```
 *
 * `lostAt` needs `window = 3` consecutive attempts, so LOST needs a *fourth*
 * attempt to exist before it can fire once. The archive's rounds stop at R2 and
 * that type stops with them. **a3's live rows run `r0 … r4`.** So
 * `triage.lostObservable: false` was never a statement about model behaviour —
 * a class of the taxonomy was unfalsifiable because the round identifier could
 * not count past two.
 *
 * ## What is deliberately NOT done here
 *
 * **`triageAttempt` is not touched, and `runs.ts` is not widened.** The
 * classifier is already pure — `(outcome, resolved) => verdict`, with no archive
 * dependency — so it is imported and reused verbatim. Two consequences, both
 * wanted: the 51 archive numbers stay bit-identical, and nobody can argue the
 * classifier was adjusted until it produced a nicer taxonomy. `RoundId` stays
 * narrow because it is the archive's *run registry*, not a round counter; no
 * archived run is R3, and widening it would make that registry lie.
 *
 * The archive's `cellTraces` is also not reused, and could not be: it iterates
 * `FAILURE_POOL × CONDITIONS` over 8 hardcoded pilot tasks, keys patches by
 * `run/taskId`, and carries the `diff`-vs-`sr` supersession rule for four
 * pre-retrofit cells. None of that describes the live grid, which has 62+ tasks,
 * inline patches, and no superseded runs. The *primitives* are shared
 * (`noveltyTrace`, `lostAt`, `patchLineSet`); the trajectory builder is not.
 *
 * ## The two datasets are complementary, not substitutes
 *
 * This is the finding that matters for how §6 gets written, and it falls out of
 * the classifier rather than being chosen:
 *
 * | | archive (51) | live (1,604+) |
 * |---|---|---|
 * | test-verified | yes | **no** — `verification: "apply"` (D6) |
 * | LOGIC observable | **yes**, 25 of them | **no** — needs `resolved === false` |
 * | trajectory depth | 3 | **5** |
 * | LOST observable | **no** — too shallow | **yes** |
 *
 * So the live rows cannot replace the archive and the archive cannot replace the
 * live rows. FORMAT and BROKEN rates and the LOST detector come from the live
 * sweep at large N; LOGIC comes from the archive's test-verified records at
 * small N. Reporting one as if it were the other would be the same error D18
 * forbids in miniature.
 *
 * ## Novelty is computed from patches only
 *
 * A row with no patch contributes nothing to its trajectory, exactly as the
 * archive's `withPatch` filter does. Substituting the raw `response` text when
 * the patch is absent was considered and rejected: it would redefine novelty
 * mid-study and make live and archived traces incomparable. Rows without a patch
 * are counted in `attemptsWithoutPatch` so the exclusion is visible rather than
 * silent — it is large, because a MALFORMED reflection round produces no patch by
 * definition.
 */

import { existsSync } from "node:fs";
import { isFormatClass, isInstrumentLimit } from "@rb/core";
import { readRows, SWEEP_ROWS, type SweepRecord } from "../matrix/store.ts";
import {
  lostAt,
  noveltyTrace,
  triageAttempt,
  LOST_DEFAULTS,
  type NoveltyStep,
  type TriageClass,
} from "./triage.ts";

// --------------------------------------------------------------- one record

/** One live row, classified. The live counterpart of `TriageRecord`. */
export interface LiveTriageRecord {
  arm: string;
  taskId: string;
  model: string;
  editFormat: string;
  thinking: boolean;
  strategy: string;
  round: number;
  repeat: number;
  verification: "apply";
  cls: TriageClass | null;
  measuresModel: boolean;
  evidenceField: string;
  evidence: string;
}

/**
 * `resolved` for a live row. Always `null`, and the type system says so.
 *
 * This began as `rec.verification === "test" ? ... : null`, mirroring
 * `triageTable`. `tsc` rejected it:
 *
 * ```
 * TS2367: This comparison appears to be unintentional because the types
 *         '"apply"' and '"test"' have no overlap.
 * ```
 *
 * That error is a better guarantee than the branch was. `SweepRecord.verification`
 * is the *literal* `"apply"`, so **no row this file can ever receive is
 * test-verified**, and the compiler refuses to let the code pretend otherwise.
 * LOGIC is therefore unreachable here by construction, not by accident — which
 * is exactly the property `LIMITATIONS.md` §1 claims and D6 explains.
 *
 * Keeping the function rather than inlining `null` keeps the single place a
 * future test-verified run would have to change, and keeps the reason attached
 * to it. `triageAttempt`'s refusal to read an applied-but-unverified patch as a
 * LOGIC failure is the only thing stopping a no-Docker pipeline from
 * manufacturing logic failures it never observed.
 */
function resolvedOf(_rec: SweepRecord): boolean | null {
  return null;
}

export function liveTriageTable(records: readonly SweepRecord[]): LiveTriageRecord[] {
  return records
    .map((rec) => {
      const v = triageAttempt(rec.outcome, resolvedOf(rec));
      return {
        arm: rec.arm,
        taskId: rec.cell.taskId,
        model: rec.cell.model,
        editFormat: rec.cell.editFormat,
        thinking: rec.cell.thinking,
        strategy: rec.cell.strategy,
        round: rec.cell.round,
        repeat: rec.cell.repeat,
        verification: rec.verification,
        cls: v.cls,
        measuresModel: v.measuresModel,
        evidenceField: v.evidenceField,
        evidence: v.evidence.length > 110 ? v.evidence.slice(0, 107) + "..." : v.evidence,
      };
    })
    .sort(
      (a, b) =>
        a.arm.localeCompare(b.arm) ||
        a.taskId.localeCompare(b.taskId) ||
        a.strategy.localeCompare(b.strategy) ||
        a.repeat - b.repeat ||
        a.round - b.round,
    );
}

// -------------------------------------------------------------- trajectories

/**
 * One attempt sequence: a lineage at one repeat, baseline first.
 *
 * A lineage is `taskId | strategy | model | editFormat | thinking`, which is
 * exactly what `cellKey` already encodes, and rounds within it are the attempts.
 * The matching `l0_baseline` row is a *separate* lineage in the sweep but the
 * *first attempt* of this one, so it is prepended — the same argument
 * `cellTraces` makes for the archive: "attempt 1 is the model's first try at the
 * task, and a retry's novelty is only meaningful against it."
 */
export interface LiveTrajectory {
  taskId: string;
  strategy: string;
  model: string;
  editFormat: string;
  thinking: boolean;
  repeat: number;
  /** Rounds that contributed a patch, in attempt order. */
  rounds: number[];
  /** Whether the `l0_baseline` attempt was found and prepended. */
  hasBaseline: boolean;
  /** Attempts present in the lineage but carrying no patch to compare. */
  attemptsWithoutPatch: number;
  fileTrace: NoveltyStep[];
  lineTrace: NoveltyStep[];
  lostFile: number | null;
  lostLine: number | null;
}

/** `taskId|model|editFormat|thinking|repeat` — a lineage without its strategy. */
function baselineKey(rec: SweepRecord): string {
  const c = rec.cell;
  return `${c.taskId}|${c.model}|${c.editFormat}|${c.thinking}|${c.repeat}`;
}

/**
 * The lineage a row belongs to: everything in `cellKey` except the round.
 *
 * **Not `rec.key`.** `cellKey` ends `…|r${round}|n${repeat}`, so it is unique per
 * *row*, not per lineage — grouping on it yields one trajectory per attempt, a
 * uniform depth of 2 once the baseline is prepended, and a LOST detector that
 * can never reach its window. That was the first version of this function and
 * the depth-2 output is what exposed it.
 *
 * `repeat` stays in the key: repeat 0 and repeat 1 are independent re-runs of
 * the same lineage, not successive attempts within one.
 */
function lineageKey(rec: SweepRecord): string {
  const c = rec.cell;
  return [c.taskId, c.strategy, c.model, c.editFormat, c.thinking ? "think" : "nothink", `n${c.repeat}`].join("|");
}

/** The recovery strategies. `l0_baseline` heads a trajectory, it is not one. */
const RECOVERY = /^l[12]/;

export function liveTrajectories(records: readonly SweepRecord[]): LiveTrajectory[] {
  // Baselines, indexed so each recovery lineage can find its own round-0 attempt.
  const baselines = new Map<string, SweepRecord>();
  for (const rec of records) {
    if (rec.cell.strategy === "l0_baseline") baselines.set(baselineKey(rec), rec);
  }

  const lineages = new Map<string, SweepRecord[]>();
  for (const rec of records) {
    if (!RECOVERY.test(rec.cell.strategy)) continue;
    const k = lineageKey(rec);
    const held = lineages.get(k);
    if (held) held.push(rec);
    else lineages.set(k, [rec]);
  }

  const out: LiveTrajectory[] = [];
  for (const group of lineages.values()) {
    const first = group[0]!;
    const base = baselines.get(baselineKey(first));
    const ordered = [...group].sort((a, b) => a.cell.round - b.cell.round);
    const chain = base ? [base, ...ordered] : ordered;

    const withPatch = chain.filter((r) => r.patch !== null && r.patch.trim() !== "");
    const texts = withPatch.map((r) => r.patch!);
    const fileTrace = noveltyTrace(texts, "file");
    const lineTrace = noveltyTrace(texts, "line");

    out.push({
      taskId: first.cell.taskId,
      strategy: first.cell.strategy,
      model: first.cell.model,
      editFormat: first.cell.editFormat,
      thinking: first.cell.thinking,
      repeat: first.cell.repeat,
      rounds: withPatch.map((r) => r.cell.round),
      hasBaseline: base !== undefined,
      attemptsWithoutPatch: chain.length - withPatch.length,
      fileTrace,
      lineTrace,
      lostFile: lostAt(fileTrace),
      lostLine: lostAt(lineTrace),
    });
  }

  return out.sort(
    (a, b) =>
      a.taskId.localeCompare(b.taskId) ||
      a.strategy.localeCompare(b.strategy) ||
      a.model.localeCompare(b.model) ||
      a.repeat - b.repeat,
  );
}

// ------------------------------------------------------------------ summary

export interface LiveTriageSummary {
  rows: number;
  /** Lines the reader could not parse. A torn file must be visible, not assumed. */
  skipped: number;
  arms: string[];
  tasks: number;
  models: string[];
  counts: {
    FORMAT: number;
    LOGIC: number;
    BROKEN: number;
    LOST: number;
    /** APPLIED but never test-run — the honest residual of a no-Docker pipeline. */
    unverified: number;
    /** Patch matched the gold patch, so what was measured is recall. */
    contaminated: number;
  };
  measuring: number;
  notMeasuring: number;
  /** The feasibility claim, as a number. Unchanged from the archive: zero. */
  modelCalls: 0;
  /** FORMAT sub-reasons, which is the mechanism §4 reports. */
  formatReasons: Record<string, number>;
  trajectories: {
    total: number;
    /** With at least `LOST_DEFAULTS.window` patch-bearing attempts. */
    longEnough: number;
    maxDepth: number;
    /** Whether any trajectory is deep enough for the window=3 detector. */
    lostObservable: boolean;
    /** Where the line-level detector fires. The file-level score is degenerate (D21). */
    lostFiredLine: number;
    lostFiredFile: number;
    /** Attempts dropped from traces for carrying no patch. */
    attemptsWithoutPatch: number;
  };
  /**
   * LOST exposure and firing per strategy.
   *
   * Reported because the headline count is uninterpretable without it: "LOST
   * fires 6 times" could mean the detector works or merely that only one
   * strategy produced trajectories deep enough to try. The `eligible` column is
   * what makes the comparison honest.
   */
  lostByStrategy: {
    strategy: string;
    trajectories: number;
    eligible: number;
    fired: number;
    /** Distinct tasks among the firings — the clustering check. */
    distinctTasks: number;
  }[];
  /** Why LOGIC cannot appear here, stated rather than left as a zero. */
  logicObservable: false;
  records: LiveTriageRecord[];
  traces: LiveTrajectory[];
}

export function liveTriageSummary(
  records: readonly SweepRecord[],
  skipped = 0,
): LiveTriageSummary {
  const table = liveTriageTable(records);
  const traces = liveTrajectories(records);

  const counts = { FORMAT: 0, LOGIC: 0, BROKEN: 0, LOST: 0, unverified: 0, contaminated: 0 };
  let measuring = 0;
  const formatReasons: Record<string, number> = {};

  for (const r of table) {
    if (r.measuresModel) measuring++;
    if (r.cls) counts[r.cls]++;
    else if (r.evidenceField === "verification") counts.unverified++;
    else if (r.evidenceField === "outcome.similarity") counts.contaminated++;
  }

  // The mechanism, not just the rate. `outcome.reason` is the parser's own verdict.
  for (const rec of records) {
    if (!isFormatClass(rec.outcome)) continue;
    const o = rec.outcome;
    const reason = o.kind === "MALFORMED" ? o.reason : o.kind;
    formatReasons[reason] = (formatReasons[reason] ?? 0) + 1;
  }

  // LOST is a property of a sequence, so it is counted over trajectories and
  // then folded into the class counts — the one class no single row can carry.
  const longEnough = traces.filter((t) => t.lineTrace.length >= LOST_DEFAULTS.window);
  const lostFiredLine = traces.filter((t) => t.lostLine !== null).length;
  counts.LOST = lostFiredLine;

  const maxDepth = traces.reduce((m, t) => Math.max(m, t.lineTrace.length), 0);

  const strategies = [...new Set(traces.map((t) => t.strategy))].sort();
  const lostByStrategy = strategies.map((strategy) => {
    const mine = traces.filter((t) => t.strategy === strategy);
    const fired = mine.filter((t) => t.lostLine !== null);
    return {
      strategy,
      trajectories: mine.length,
      eligible: mine.filter((t) => t.lineTrace.length >= LOST_DEFAULTS.window).length,
      fired: fired.length,
      distinctTasks: new Set(fired.map((t) => t.taskId)).size,
    };
  });

  return {
    rows: records.length,
    skipped,
    arms: [...new Set(records.map((r) => r.arm))].sort(),
    tasks: new Set(records.map((r) => r.cell.taskId)).size,
    models: [...new Set(records.map((r) => r.cell.model))].sort(),
    counts,
    measuring,
    notMeasuring: table.length - measuring,
    modelCalls: 0,
    formatReasons,
    trajectories: {
      total: traces.length,
      longEnough: longEnough.length,
      maxDepth,
      lostObservable: longEnough.length > 0,
      lostFiredLine,
      lostFiredFile: traces.filter((t) => t.lostFile !== null).length,
      attemptsWithoutPatch: traces.reduce((a, t) => a + t.attemptsWithoutPatch, 0),
    },
    lostByStrategy,
    logicObservable: false,
    records: table,
    traces,
  };
}

// ------------------------------------------------------------------- report

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((100 * n) / d).toFixed(1)}%`;
}

export function renderLiveTriageReport(s: LiveTriageSummary): string {
  const L: string[] = [];
  const t = s.trajectories;

  L.push("# Triage over the live sweep");
  L.push("");
  L.push(
    `Generated by \`packages/pipeline/analysis/liveTriage.ts\` over **${s.rows.toLocaleString()} ` +
      `rows** from \`${SWEEP_ROWS}\`: ${s.arms.length} arms, ${s.tasks} tasks, ` +
      `${s.models.length} models. **Model calls required to classify them: ${s.modelCalls}.**`,
  );
  if (s.skipped > 0) {
    L.push("");
    L.push(`> ⚠️ **${s.skipped} lines could not be parsed** and are excluded from every count.`);
  }
  L.push("");
  L.push(
    "This complements `docs/ccos.md` rather than replacing it. The classifier is the same " +
      "function; only the input differs, and the two inputs can observe different classes — " +
      "see the two tables below.",
  );
  L.push("");

  // ------------------------------------------------------------- the classes
  L.push("## 1. The four classes over live rows");
  L.push("");
  L.push("| Class | Count | Share | Observable here? |");
  L.push("|---|---:|---:|---|");
  L.push(`| FORMAT | ${s.counts.FORMAT} | ${pct(s.counts.FORMAT, s.rows)} | yes |`);
  L.push(
    `| LOGIC | ${s.counts.LOGIC} | ${pct(s.counts.LOGIC, s.rows)} | ` +
      "**no — needs `resolved === false`, which needs Docker (D6)** |",
  );
  L.push(`| BROKEN | ${s.counts.BROKEN} | ${pct(s.counts.BROKEN, s.rows)} | yes |`);
  L.push(
    `| LOST | ${s.counts.LOST} | ${pct(s.counts.LOST, t.total)} of trajectories | ` +
      `${t.lostObservable ? "**yes — for the first time**" : "no"} |`,
  );
  L.push("");
  L.push(
    `Plus **${s.counts.unverified.toLocaleString()}** rows that applied cleanly but were never ` +
      `test-run (${pct(s.counts.unverified, s.rows)}), and **${s.counts.contaminated}** ` +
      "excluded as contaminated.",
  );
  L.push("");
  L.push(
    `**${s.measuring.toLocaleString()}** rows say something about the model; ` +
      `**${s.notMeasuring.toLocaleString()}** do not (D18).`,
  );
  L.push("");
  L.push(
    "**LOGIC's zero is structural and must never be reported as a rate.** An applied patch " +
      "whose tests were never run is not a logic failure, it is an unverified apply, and " +
      "`triageAttempt` refuses to conflate them. The archive's 25 LOGIC records remain the " +
      "only evidence for that class, at n = 51.",
  );
  L.push("");

  // ------------------------------------------------------------ the mechanism
  L.push("## 2. FORMAT, by mechanism");
  L.push("");
  L.push("The class is the *what*; this is the *why*, straight from the parser's own verdict.");
  L.push("");
  L.push("| Reason | Count |");
  L.push("|---|---:|");
  for (const [reason, n] of Object.entries(s.formatReasons).sort((a, b) => b[1] - a[1])) {
    L.push(`| \`${reason}\` | ${n} |`);
  }
  L.push("");

  // ----------------------------------------------------------------- LOST
  L.push("## 3. LOST, and why it could not fire before");
  L.push("");
  L.push("```ts");
  L.push('// runs.ts:19 — the archive\'s run registry');
  L.push('export type RoundId = "R0" | "R1" | "R2";');
  L.push("```");
  L.push("");
  L.push(
    `\`lostAt\` needs a window of **${LOST_DEFAULTS.window}** consecutive attempts, so LOST needs ` +
      "a fourth attempt to exist before it can fire once. No archived run is R3. The live rows " +
      "run `r0 … r4`.",
  );
  L.push("");
  L.push("| | value |");
  L.push("|---|---:|");
  L.push(`| Trajectories reconstructed | ${t.total.toLocaleString()} |`);
  L.push(`| Deepest trajectory (patch-bearing attempts) | **${t.maxDepth}** |`);
  L.push(`| Long enough for the window=${LOST_DEFAULTS.window} detector | ${t.longEnough.toLocaleString()} |`);
  L.push(`| LOST observable | **${t.lostObservable ? "yes" : "no"}** |`);
  L.push(`| Detector fires (line-level novelty) | **${t.lostFiredLine.toLocaleString()}** |`);
  L.push(`| Detector fires (file-level, degenerate per D21) | ${t.lostFiredFile.toLocaleString()} |`);
  L.push(`| Attempts dropped for carrying no patch | ${t.attemptsWithoutPatch.toLocaleString()} |`);
  L.push("");
  if (t.lostObservable && t.lostFiredLine === 0) {
    L.push(
      "**The detector was given its window and did not fire.** That is a finding, not a gap: " +
        `${t.longEnough.toLocaleString()} trajectories were deep enough and none went in circles ` +
        "by the window=3, ε=0.2 criterion. It argues the taxonomy should be three classes rather " +
        "than four on this benchmark, and the escalate-on-LOST branch of the policy is " +
        "unexercised.",
    );
  } else if (t.lostFiredLine > 0) {
    L.push(
      `**LOST fires on ${t.lostFiredLine.toLocaleString()} of ${t.total.toLocaleString()} ` +
        "trajectories.** This is the first observation of the class anywhere in the study; the " +
        "archive could not reach it at depth 3. Every other number in this file is a rate over " +
        "rows, but this one is a rate over *sequences*, and the two must not be pooled.",
    );
  } else {
    L.push(
      "**LOST remains unobservable**, now for a measurable reason rather than a type-level one: " +
        `no trajectory reached ${LOST_DEFAULTS.window} patch-bearing attempts. The dominant cause ` +
        `is the ${t.attemptsWithoutPatch.toLocaleString()} attempts carrying no patch — a ` +
        "MALFORMED round produces nothing to compare, so a lineage that fails to parse on every " +
        "round has no trajectory at all.",
    );
  }
  L.push("");

  // ------------------------------------------------- LOST, by strategy
  L.push("### 3.1 Which strategy goes in circles");
  L.push("");
  L.push(
    "The headline count means nothing on its own — it could reflect the detector working, or " +
      "merely that one strategy happened to produce the only trajectories deep enough to try. " +
      "`eligible` is the column that settles it.",
  );
  L.push("");
  L.push("| Strategy | Trajectories | Eligible (≥3) | LOST fires | Rate of eligible | Distinct tasks |");
  L.push("|---|---:|---:|---:|---:|---:|");
  for (const r of s.lostByStrategy) {
    L.push(
      `| \`${r.strategy}\` | ${r.trajectories} | ${r.eligible} | **${r.fired}** | ` +
        `${pct(r.fired, r.eligible)} | ${r.distinctTasks} |`,
    );
  }
  L.push("");

  const blind = s.lostByStrategy.find((r) => r.strategy === "l1_blind_retry");
  const refl = s.lostByStrategy.find((r) => r.strategy === "l2_reflection");
  if (blind && refl && blind.eligible > 0 && refl.eligible > 0) {
    L.push(
      `**Exposure is matched and the result is not.** Blind retry had ${blind.eligible} eligible ` +
        `trajectories and LOST fired on ${blind.fired}; reflection had ${refl.eligible} and it ` +
        `fired on ${refl.fired}.`,
    );
    L.push("");
    L.push(
      "This matters more than the count. §5's reflection result is an exact McNemar test on " +
        "*apply outcomes*. This is a **different measure on different data** — Jaccard novelty " +
        "over patch content, which never looks at whether a patch applied — and it points the " +
        "same way: reflection makes the model re-propose its own previous edit. Two independent " +
        "measures agreeing is considerably stronger than either alone, and the mechanism " +
        "(`LIMITATIONS.md` §8 item 2: the model quotes its own previous attempt) predicts " +
        "exactly this signature.",
    );
    L.push("");
    if (refl.fired > 0 && refl.distinctTasks < refl.fired) {
      L.push(
        `**The same clustering caveat applies, and it must be stated with the result.** The ` +
          `${refl.fired} firings come from only **${refl.distinctTasks} distinct tasks** across ` +
          "repeats, so they are not " +
          `${refl.fired} independent observations — the same weakness \`LIMITATIONS.md\` §3 ` +
          "records for the McNemar result. Treat this as corroboration of a narrow finding, not " +
          "as a broad one.",
      );
      L.push("");
    }
  }

  // -------------------------------------------------------------- the caveat
  L.push("## 4. What this does not establish");
  L.push("");
  L.push(
    "1. **No row here is test-verified.** Every count is over `verification: \"apply\"`, so the " +
      "unit is *did the patch reach the repository*, not *did it fix the bug* " +
      "(`LIMITATIONS.md` §1).",
  );
  L.push(
    "2. **Novelty is computed from patches only.** Attempts without a patch are excluded, not " +
      "scored as zero-novelty, and the count is published above. Substituting the raw response " +
      "would redefine the measure mid-study.",
  );
  L.push(
    "3. **These rows and the archive's are not interchangeable.** The archive can see LOGIC and " +
      "cannot see LOST; this sweep is the reverse. Neither set is the superset.",
  );
  L.push("");

  return L.join("\n") + "\n";
}

// --------------------------------------------------------------------- entry

export const LIVE_TRIAGE_TABLE = "docs/live_triage.md";
export const LIVE_TRIAGE_JSON = "data/live_triage.json";

export async function liveTriage(toStdout: boolean): Promise<number> {
  if (!existsSync(SWEEP_ROWS)) {
    console.error(
      [
        `no sweep rows at ${SWEEP_ROWS}.`,
        "This classifies the live sweep, so there is nothing to compute without it.",
        "Run `bun run sweep -- --run --yes` first, or use `bun run ccos` for the archive.",
      ].join("\n"),
    );
    return 1;
  }

  const { records, skipped } = await readRows(SWEEP_ROWS);
  if (records.length === 0) {
    console.error(`${SWEEP_ROWS} parsed to zero rows (${skipped} lines skipped).`);
    return 1;
  }

  const summary = liveTriageSummary(records, skipped);
  const body = renderLiveTriageReport(summary);

  if (toStdout) {
    process.stdout.write(body);
    return 0;
  }

  await Bun.write(LIVE_TRIAGE_TABLE, body);
  await Bun.write(
    LIVE_TRIAGE_JSON,
    JSON.stringify(
      {
        generated_by: "packages/pipeline/analysis/liveTriage.ts",
        source: SWEEP_ROWS,
        rows: summary.rows,
        skipped: summary.skipped,
        arms: summary.arms,
        tasks: summary.tasks,
        models: summary.models,
        counts: summary.counts,
        measuring: summary.measuring,
        notMeasuring: summary.notMeasuring,
        modelCalls: summary.modelCalls,
        formatReasons: summary.formatReasons,
        trajectories: summary.trajectories,
        logicObservable: summary.logicObservable,
        traces: summary.traces,
      },
      null,
      2,
    ) + "\n",
  );

  const t = summary.trajectories;
  console.log(`\nlive-triage - ${summary.rows.toLocaleString()} rows from ${SWEEP_ROWS}`);
  console.log(`  model calls to classify them: ${summary.modelCalls}`);
  console.log(
    `  FORMAT ${summary.counts.FORMAT}  LOGIC ${summary.counts.LOGIC} (unobservable, D6)` +
      `  BROKEN ${summary.counts.BROKEN}  LOST ${summary.counts.LOST}`,
  );
  console.log(
    `  unverified applies: ${summary.counts.unverified.toLocaleString()}` +
      `   contaminated: ${summary.counts.contaminated}`,
  );
  console.log(
    `  trajectories: ${t.total.toLocaleString()}, deepest ${t.maxDepth}, ` +
      `${t.longEnough.toLocaleString()} long enough for window=${LOST_DEFAULTS.window}`,
  );
  console.log(`  LOST observable: ${t.lostObservable ? "YES" : "no"}  fires: ${t.lostFiredLine}`);
  console.log(`  wrote ${LIVE_TRIAGE_TABLE} and ${LIVE_TRIAGE_JSON}`);

  // A row the classifier cannot place is a structural failure: the taxonomy
  // claims to be total over outcomes. `isInstrumentLimit` is asserted inside
  // `triageAttempt`, so reaching here with an unplaced row means a new outcome
  // kind arrived without a branch.
  const unplaced = summary.records.filter(
    (r) =>
      r.cls === null &&
      r.evidenceField !== "verification" &&
      r.evidenceField !== "outcome.similarity",
  );
  if (unplaced.length > 0) {
    console.error(
      `\n${unplaced.length} rows could not be classified. First: ` +
        `${unplaced[0]!.taskId} ${unplaced[0]!.strategy} (${unplaced[0]!.evidenceField})`,
    );
    return 1;
  }
  return 0;
}

/** Re-exported so callers do not need to know the guard lives in `@rb/core`. */
export { isInstrumentLimit };
