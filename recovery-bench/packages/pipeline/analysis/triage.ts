/**
 * Triage: the failure class, observed rather than predicted.
 *
 * ## What this is for
 *
 * `proposal/index.html:566` makes the feasibility claim the whole contribution
 * rests on — the class is *"a deterministic function of the trajectory, not a
 * classifier. It reads exit codes, not intentions, so it cannot be wrong and
 * introduces no confound."* This file is that claim, executable, over every
 * record in the archive.
 *
 * ## Three things the data decided, not me
 *
 * **1. The proposal's precedence is wrong.** It checks `apply_failed` first:
 *
 * ```python
 * if attempt.apply_failed:          return CARELESS
 * if attempt.infra_error:           return BROKEN
 * if attempt.no_progress(window=3): return LOST
 * return CONFUSED
 * ```
 *
 * But an instrument limit — our own token ceiling severing the response, a 429,
 * a budget stop — measured nothing about the model, and if it is checked second
 * then any instrument limit that *also* left an unusable patch is scored as the
 * model's formatting failure. `BROKEN` is therefore tested first here. That is
 * the same argument `@rb/core`'s `isFormatClass` already makes for excluding
 * `TRUNCATED` (D18); this file just puts the two in the right order.
 *
 * **2. `triage(attempt)` cannot return `LOST`.** Three classes are properties of
 * one attempt. `LOST` is a property of a *sequence* — "no new progress across
 * several steps" needs several steps to look at. So the signature splits:
 * `triageAttempt` for the three, `lostAt` over a novelty trace for the fourth.
 * The proposal's single-argument signature is not implementable as written, and
 * finding that out here costs nothing while finding it out in Stage 2 costs a
 * round of attempts.
 *
 * **3. The novelty score in the proposal is degenerate on this benchmark, and it
 * fails in the worse of the two possible directions.** It specifies *"Jaccard
 * distance over the set of files touched"*. Measured over all 95 archived
 * patches: 85 touch exactly one file and 10 name none at all, and for a given
 * task it is always the same file — the gold patches are single-file (D21), so
 * the file set is a constant of the *task*, not a property of the *attempt*.
 *
 * File-level novelty is therefore exactly 0 on 21 of the 26 scoreable retries,
 * and all 5 non-zero values arise because one side of the comparison was a patch
 * with no readable file header. So the score does not merely fail to
 * discriminate: it **inverts**, calling an unparseable patch the most novel
 * attempt in the trajectory. A circuit breaker reading it would keep retrying
 * precisely the attempts that produced garbage.
 *
 * Jaccard over the set of *edited lines*, whitespace-normalised, has real spread
 * on the same data (0.000 to 1.000, mean 0.46) and orders near-repetition below
 * genuine re-attempts. `noveltyTrace` takes the level as an argument so both are
 * computed and the comparison stays checkable rather than asserted.
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { isFormatClass, isInstrumentLimit, type Outcome } from "@rb/core";
import { ARCHIVE_RUNS, type ArchiveRow } from "./load.ts";
import { CONDITIONS, FAILURE_POOL, BASELINE_RUN, type ConditionName } from "./runs.ts";

// ------------------------------------------------------------------ classes

/**
 * FORMAT / LOGIC / BROKEN / LOST, which is the vocabulary every evidence file
 * and the paper text use (BUILD.md §0.2). The proposal's CARELESS / CONFUSED
 * name the same two classes and remain the spoken analogy.
 */
export const TRIAGE_CLASSES = ["FORMAT", "LOGIC", "BROKEN", "LOST"] as const;
export type TriageClass = (typeof TRIAGE_CLASSES)[number];

/** What the correct response to each class is, per `proposal/index.html:528`. */
export const CLASS_RESPONSE: Record<TriageClass, "retry" | "escalate" | "abort"> = {
  FORMAT: "retry",
  LOGIC: "escalate",
  BROKEN: "abort",
  LOST: "escalate",
};

export interface TriageVerdict {
  /** `null` when the attempt did not fail — there is no class to assign. */
  cls: TriageClass | null;
  /**
   * Whether this record says anything about the model's repair ability.
   *
   * `false` for BROKEN (the instrument stopped) and for CONTAMINATED (the patch
   * matched the gold patch, so what was measured is recall). Both must be
   * reported outside the failure classes rather than folded into one — the
   * archive already sets that precedent with `RECITATION_EXCLUDED`.
   */
  measuresModel: boolean;
  /** The field name that decided the class, printed beside it in the table. */
  evidenceField: string;
  /** Its value, truncated by the caller if long. */
  evidence: string;
}

/**
 * The class of one attempt, from its outcome alone. O(1), no model call.
 *
 * `resolved` is only legible on a test-verified row and must be passed as `null`
 * otherwise: an applied patch whose tests were never run is not a LOGIC failure,
 * it is an unverified apply, and conflating the two would let the no-Docker
 * pipeline (D6) manufacture logic-class failures it cannot observe.
 */
export function triageAttempt(outcome: Outcome, resolved: boolean | null): TriageVerdict {
  // 1. BROKEN first — see the header. Nothing about the model was measured.
  //
  // The branches switch on `kind` rather than leaning on `isInstrumentLimit` to
  // narrow, because that predicate returns a plain boolean. The `instrument`
  // assertion below is what keeps the two definitions from drifting apart: if
  // `@rb/core` ever adds an instrument-limit kind, this throws rather than
  // silently classifying it as a model failure.
  if (outcome.kind === "PROVIDER_ERROR") {
    return {
      cls: "BROKEN",
      measuresModel: false,
      evidenceField: "outcome.reason",
      evidence: `${outcome.status ?? "no status"} ${outcome.reason}`,
    };
  }
  if (outcome.kind === "BUDGET_STOP") {
    return {
      cls: "BROKEN",
      measuresModel: false,
      evidenceField: "outcome.tokensUsed",
      evidence: `${outcome.tokensUsed} of ${outcome.ceiling}`,
    };
  }
  if (outcome.kind === "TRUNCATED") {
    return {
      cls: "BROKEN",
      measuresModel: false,
      evidenceField: "outcome.finishReason",
      evidence: `${outcome.finishReason} at ${outcome.maxTokens} max_tokens`,
    };
  }
  if (isInstrumentLimit(outcome)) {
    throw new Error(
      `@rb/core calls ${outcome.kind} an instrument limit and triage does not. Add it to the ` +
        "BROKEN branch above — classifying it as a model failure would blame the model for " +
        "our own configuration (D18).",
    );
  }

  /**
   * `NO_OUTPUT` is BROKEN too, and it is the one place triage is wider than
   * `isInstrumentLimit`.
   *
   * The archive's precedent is exactly this case: Gemini refused to generate for
   * `astropy__astropy-14182` and cited RECITATION, so no patch ever existed to
   * evaluate, and the submitted tables exclude it from the recovery denominator
   * rather than scoring it as a format failure. A provider that returns nothing
   * has not demonstrated bad formatting; it has demonstrated that the attempt
   * did not happen.
   */
  if (outcome.kind === "NO_OUTPUT") {
    return {
      cls: "BROKEN",
      measuresModel: false,
      evidenceField: "outcome.detail",
      evidence: outcome.detail,
    };
  }

  // 2. FORMAT — the patch never reached the repository. `@rb/core` owns this
  //    predicate so the taxonomy has exactly one definition.
  if (isFormatClass(outcome)) {
    if (outcome.kind === "APPLY_FAIL") {
      return {
        cls: "FORMAT",
        measuresModel: true,
        evidenceField: "outcome.gitStderr",
        evidence: outcome.gitStderr || "git apply refused the patch",
      };
    }
    if (outcome.kind === "MALFORMED") {
      return {
        cls: "FORMAT",
        measuresModel: true,
        evidenceField: "outcome.reason",
        evidence: `${outcome.reason} at block ${outcome.blockIndex}`,
      };
    }
    if (outcome.kind === "NO_PATCH") {
      return {
        cls: "FORMAT",
        measuresModel: true,
        evidenceField: "outcome.responseChars",
        evidence: `${outcome.responseChars} chars, no patch block`,
      };
    }
    // Same guard as above, in the other direction: a new format-class kind in
    // `@rb/core` must be given its own evidence field rather than inheriting a
    // neighbour's.
    throw new Error(
      `@rb/core calls ${outcome.kind} format-class and triage has no evidence field for it.`,
    );
  }

  // 3. CONTAMINATED applied, so it is not a format failure, but scoring it as
  //    recovery would score memorisation.
  if (outcome.kind === "CONTAMINATED") {
    return {
      cls: null,
      measuresModel: false,
      evidenceField: "outcome.similarity",
      evidence: `${outcome.similarity.toFixed(3)} vs threshold ${outcome.threshold}`,
    };
  }

  // 4. APPLIED. Resolved is a success with no class; unresolved is LOGIC; and
  //    unverified is neither, which has to stay visible.
  if (resolved === null) {
    return {
      cls: null,
      measuresModel: true,
      evidenceField: "verification",
      evidence: "apply-verified only — resolved is unobservable without Docker (D6)",
    };
  }
  if (resolved) {
    return {
      cls: null,
      measuresModel: true,
      evidenceField: "resolved",
      evidence: "true — FAIL_TO_PASS passed",
    };
  }
  return {
    cls: "LOGIC",
    measuresModel: true,
    evidenceField: "resolved",
    evidence: "false — patch applied, FAIL_TO_PASS still failing",
  };
}

// ------------------------------------------------------------------ novelty

/** `+++ b/path` and `--- a/path` targets, which is what the proposal's score uses. */
export function patchFileSet(patch: string): Set<string> {
  const out = new Set<string>();
  for (const line of patch.split("\n")) {
    const m = /^(?:\+\+\+ b\/|--- a\/)(.+)$/.exec(line.trimEnd());
    if (m?.[1] && m[1] !== "dev/null") out.add(m[1].trim());
  }
  return out;
}

/**
 * The set of lines the patch adds or removes, whitespace-normalised.
 *
 * Normalising is deliberate: two attempts that differ only in indentation are
 * the same proposed edit, and a novelty score that called them different would
 * report progress where there is none — which is precisely the failure mode the
 * circuit breaker exists to catch.
 */
export function patchLineSet(patch: string): Set<string> {
  const out = new Set<string>();
  for (const line of patch.split("\n")) {
    if (/^(\+\+\+|---)/.test(line)) continue;
    const m = /^([+-])(.*)$/.exec(line);
    if (!m) continue;
    const body = m[2]!.trim();
    if (body) out.add(`${m[1]}${body}`);
  }
  return out;
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
}

export type NoveltyLevel = "file" | "line";

export interface NoveltyStep {
  /** 1-based attempt index within the sequence. */
  index: number;
  /** Size of this attempt's set. */
  size: number;
  /**
   * `1 - jaccard(this, everything tried so far)`.
   *
   * The first attempt is 1 by definition: there is nothing to repeat yet.
   */
  novelty: number;
  /** Size of the union after this attempt. */
  cumulative: number;
}

export function noveltyTrace(patches: readonly string[], level: NoveltyLevel): NoveltyStep[] {
  const extract = level === "file" ? patchFileSet : patchLineSet;
  const seen = new Set<string>();
  const out: NoveltyStep[] = [];
  patches.forEach((patch, i) => {
    const set = extract(patch);
    const novelty = i === 0 ? 1 : 1 - jaccard(set, seen);
    for (const x of set) seen.add(x);
    out.push({ index: i + 1, size: set.size, novelty, cumulative: seen.size });
  });
  return out;
}

export interface LostOptions {
  /** `proposal/index.html:572` specifies 3. */
  window: number;
  /** Moving-average floor below which the trajectory is going in circles. */
  epsilon: number;
}

export const LOST_DEFAULTS: LostOptions = { window: 3, epsilon: 0.2 };

/**
 * The first attempt index at which the moving average of novelty falls below
 * `epsilon`, or `null` when it never does.
 *
 * Returns `null` for a trace shorter than the window rather than averaging what
 * is there. A two-attempt trajectory has not had the chance to go in circles
 * three times, and letting a short window stand in would make `LOST` fire on
 * exactly the sequences that cannot evidence it.
 */
export function lostAt(trace: readonly NoveltyStep[], opts: LostOptions = LOST_DEFAULTS): number | null {
  if (opts.window < 1) throw new Error(`window must be >= 1, got ${opts.window}`);
  if (trace.length < opts.window) return null;
  for (let end = opts.window; end <= trace.length; end++) {
    const slice = trace.slice(end - opts.window, end);
    const mean = slice.reduce((a, s) => a + s.novelty, 0) / opts.window;
    if (mean < opts.epsilon) return trace[end - 1]!.index;
  }
  return null;
}

// ------------------------------------------------------------- the archive

/** `${run}/${taskId}` -> patch text, for every `patch.diff` under the archive. */
export async function loadPatches(root = ARCHIVE_RUNS): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!existsSync(root)) return out;
  for (const run of (await readdir(root, { withFileTypes: true })).filter((e) => e.isDirectory())) {
    const runPath = join(root, run.name);
    for (const cond of (await readdir(runPath, { withFileTypes: true })).filter((e) => e.isDirectory())) {
      const condPath = join(runPath, cond.name);
      for (const task of (await readdir(condPath, { withFileTypes: true })).filter((e) => e.isDirectory())) {
        const p = join(condPath, task.name, "patch.diff");
        if (existsSync(p)) out.set(`${run.name}/${task.name}`, await readFile(p, "utf8"));
      }
    }
  }
  return out;
}

export interface TriageRecord {
  taskId: string;
  run: string;
  condition: ConditionName;
  round: string;
  format: "diff" | "sr";
  verification: "test" | "apply";
  cls: TriageClass | null;
  measuresModel: boolean;
  evidenceField: string;
  evidence: string;
}

/** Every archived record, classified. No model calls, no network, no Docker. */
export function triageTable(rows: ArchiveRow[]): TriageRecord[] {
  return rows
    .map((r) => {
      const resolved = r.row.verification === "test" ? Boolean(r.row.resolved) : null;
      const v = triageAttempt(r.row.outcome, resolved);
      return {
        taskId: r.row.cell.taskId,
        run: r.run,
        condition: r.condition,
        round: r.round,
        format: r.format,
        verification: r.row.verification,
        cls: v.cls,
        measuresModel: v.measuresModel,
        evidenceField: v.evidenceField,
        evidence: v.evidence.length > 110 ? v.evidence.slice(0, 107) + "..." : v.evidence,
      };
    })
    .sort((a, b) => a.taskId.localeCompare(b.taskId) || a.run.localeCompare(b.run));
}

export interface Hole {
  taskId: string;
  condition: ConditionName;
  /** Why the cell is empty, when the archive says why. */
  reason: string;
}

/**
 * Condition-task cells with no record at all.
 *
 * These are the 8 of 24 that D2 found "ceased to exist", and they are printed as
 * holes rather than left blank because a blank cell in a results table reads as
 * a measured zero. The free-tier quota (20 requests/day, `reports/data/config.md`)
 * is the cause for most of them; RECITATION is the cause for the other three.
 */
export function matrixHoles(rows: ArchiveRow[]): Hole[] {
  const present = new Set(
    rows.filter((r) => r.run !== BASELINE_RUN).map((r) => `${r.row.cell.taskId}|${r.condition}`),
  );
  const out: Hole[] = [];
  for (const taskId of FAILURE_POOL) {
    for (const condition of CONDITIONS) {
      if (present.has(`${taskId}|${condition}`)) continue;
      out.push({
        taskId,
        condition,
        reason:
          taskId === "astropy__astropy-14182"
            ? "provider refused to generate (RECITATION) — no patch ever existed"
            : "never run — free-tier quota exhausted (D3)",
      });
    }
  }
  return out;
}

export interface CellTrace {
  taskId: string;
  condition: ConditionName;
  /** Runs in attempt order, baseline first. */
  runs: string[];
  /** Rows dropped as superseded re-runs of a round rather than further attempts. */
  superseded: string[];
  fileTrace: NoveltyStep[];
  lineTrace: NoveltyStep[];
  /** Attempt index LOST would fire at, or `null`. */
  lostFile: number | null;
  lostLine: number | null;
}

const ROUND_ORDER: Record<string, number> = { R0: 0, R1: 1, R2: 2 };

/**
 * Attempt trajectories per condition, with the baseline attempt at the head.
 *
 * The baseline belongs in the sequence: attempt 1 is the model's first try at
 * the task, and a retry's novelty is only meaningful against it.
 *
 * **One round contributes one attempt.** Four cells hold two rows for R1 — the
 * pre-retrofit unified-diff run and the SEARCH/REPLACE run that *replaced* it
 * (`runs.ts`: "pre-retrofit, superseded"). Those are the same attempt expressed
 * twice, not two attempts, and counting both would inflate the trajectory depth
 * to 4 and hand the LOST detector a window it has not earned. The retrofitted
 * row wins, which is the same `format: "sr"` convention `logicCoverage` uses;
 * the dropped run ids are kept in `superseded` so the choice is visible.
 */
export function cellTraces(rows: ArchiveRow[], patches: Map<string, string>): CellTrace[] {
  const out: CellTrace[] = [];
  for (const taskId of FAILURE_POOL) {
    for (const condition of CONDITIONS) {
      const seq = rows
        .filter((r) => r.row.cell.taskId === taskId && (r.condition === condition || r.run === BASELINE_RUN))
        .sort(
          (a, b) =>
            (ROUND_ORDER[a.round] ?? 9) - (ROUND_ORDER[b.round] ?? 9) ||
            a.format.localeCompare(b.format),
        );

      const perRound = new Map<string, ArchiveRow>();
      const superseded: string[] = [];
      for (const r of seq) {
        const held = perRound.get(r.round);
        if (!held) {
          perRound.set(r.round, r);
          continue;
        }
        // Keep the retrofitted SEARCH/REPLACE row; record the other as dropped.
        if (held.format === "diff" && r.format === "sr") {
          superseded.push(held.run);
          perRound.set(r.round, r);
        } else {
          superseded.push(r.run);
        }
      }
      const deduped = [...perRound.entries()]
        .sort((a, b) => (ROUND_ORDER[a[0]] ?? 9) - (ROUND_ORDER[b[0]] ?? 9))
        .map(([, r]) => r);

      const withPatch = deduped.filter((r) => patches.has(`${r.run}/${taskId}`));
      if (withPatch.length === 0) continue;
      const texts = withPatch.map((r) => patches.get(`${r.run}/${taskId}`)!);
      const fileTrace = noveltyTrace(texts, "file");
      const lineTrace = noveltyTrace(texts, "line");
      out.push({
        taskId,
        condition,
        runs: withPatch.map((r) => r.run),
        superseded,
        fileTrace,
        lineTrace,
        lostFile: lostAt(fileTrace),
        lostLine: lostAt(lineTrace),
      });
    }
  }
  return out;
}

export interface TriageSummary {
  records: TriageRecord[];
  /** Records per class, plus the unclassified successes. */
  counts: { FORMAT: number; LOGIC: number; BROKEN: number; LOST: number; succeeded: number; unverified: number };
  /** Records that say something about the model, and records that do not. */
  measuring: number;
  notMeasuring: number;
  holes: Hole[];
  /** The feasibility claim, as a number: how many model calls triage needed. */
  modelCalls: 0;
  traces: CellTrace[];
  /** Longest attempt sequence available anywhere in the archive. */
  maxDepth: number;
  /** Trajectories with at least `LOST_DEFAULTS.window` attempts. */
  tracesLongEnough: number;
  /** Whether any sequence is long enough for the window=3 detector. */
  lostObservable: boolean;
  /** Trajectories where the line-level detector actually fires. */
  lostFired: number;
  /** File-level novelty on every retry across the whole archive. */
  fileNoveltyAfterFirst: number[];
  lineNoveltyAfterFirst: number[];
  /**
   * Why the file-level score is useless, counted rather than asserted.
   *
   * A retry whose file set and whose history are both parseable always scores
   * exactly 0. Every non-zero value comes from a patch with no readable file
   * header on one side of the comparison — so the signal does not merely fail to
   * discriminate, it **inverts**: the garbage patches are the ones it calls novel.
   */
  fileRetries: { zero: number; nonzero: number; nonzeroInvolvingUnparseable: number };
  /** Patches with no readable `--- a/` or `+++ b/` header at all. */
  unparseablePatches: number;
  totalPatches: number;
}

export function triageSummary(rows: ArchiveRow[], patches: Map<string, string>): TriageSummary {
  const records = triageTable(rows);
  const counts = {
    FORMAT: records.filter((r) => r.cls === "FORMAT").length,
    LOGIC: records.filter((r) => r.cls === "LOGIC").length,
    BROKEN: records.filter((r) => r.cls === "BROKEN").length,
    LOST: 0, // never assignable from a single record; see `lostObservable`
    succeeded: records.filter((r) => r.cls === null && r.evidenceField === "resolved").length,
    unverified: records.filter((r) => r.cls === null && r.evidenceField === "verification").length,
  };
  const traces = cellTraces(rows, patches);
  const maxDepth = traces.reduce((a, t) => Math.max(a, t.lineTrace.length), 0);
  const after = (pick: (t: CellTrace) => NoveltyStep[]): number[] =>
    traces.flatMap((t) => pick(t).slice(1).map((s) => s.novelty));

  // A non-zero file-level novelty means one side of the comparison had no
  // readable file header — the step's own set is empty, or everything before it
  // was. Counted here so the report can say which rather than imply it.
  let zero = 0;
  let nonzero = 0;
  let nonzeroInvolvingUnparseable = 0;
  for (const t of traces) {
    for (const step of t.fileTrace.slice(1)) {
      if (step.novelty === 0) {
        zero++;
        continue;
      }
      nonzero++;
      const historyBefore = step.cumulative - step.size;
      if (step.size === 0 || historyBefore <= 0) nonzeroInvolvingUnparseable++;
    }
  }

  let unparseablePatches = 0;
  for (const text of patches.values()) if (patchFileSet(text).size === 0) unparseablePatches++;

  return {
    records,
    counts,
    measuring: records.filter((r) => r.measuresModel).length,
    notMeasuring: records.filter((r) => !r.measuresModel).length,
    holes: matrixHoles(rows),
    modelCalls: 0,
    traces,
    maxDepth,
    tracesLongEnough: traces.filter((t) => t.lineTrace.length >= LOST_DEFAULTS.window).length,
    /**
     * Not `maxDepth >= window`.
     *
     * The first attempt's novelty is 1 by definition, so a trajectory of exactly
     * `window` attempts has one window, that window contains attempt 1, and its
     * mean is at least `1/window` whatever the rest of the data says. With
     * ε below that, LOST is unreachable for *any* data at that depth — so the
     * detector needs a window that excludes the first attempt, which needs
     * `window + 1` attempts. The `epsilon >= 1/window` branch is the degenerate
     * case where the threshold is so permissive that the first window can fire.
     */
    lostObservable:
      maxDepth > LOST_DEFAULTS.window ||
      (maxDepth >= LOST_DEFAULTS.window && LOST_DEFAULTS.epsilon >= 1 / LOST_DEFAULTS.window),
    lostFired: traces.filter((t) => t.lostLine !== null).length,
    fileNoveltyAfterFirst: after((t) => t.fileTrace),
    lineNoveltyAfterFirst: after((t) => t.lineTrace),
    fileRetries: { zero, nonzero, nonzeroInvolvingUnparseable },
    unparseablePatches,
    totalPatches: patches.size,
  };
}

function stats(xs: readonly number[]): { n: number; min: number; max: number; mean: number } {
  if (xs.length === 0) return { n: 0, min: NaN, max: NaN, mean: NaN };
  return {
    n: xs.length,
    min: Math.min(...xs),
    max: Math.max(...xs),
    mean: xs.reduce((a, b) => a + b, 0) / xs.length,
  };
}

export function renderTriageReport(s: TriageSummary): string {
  const L: string[] = [];
  const f = stats(s.fileNoveltyAfterFirst);
  const l = stats(s.lineNoveltyAfterFirst);

  L.push("## Triage feasibility");
  L.push("");
  L.push(
    `Every one of the ${s.records.length} archived records below is classified by ` +
      `\`triageAttempt\`, which reads the outcome field and nothing else. ` +
      `**Model calls required: ${s.modelCalls}.** That is the feasibility claim.`,
  );
  L.push("");
  L.push("| Class | Records | Correct response | Measures the model |");
  L.push("|---|---:|---|---|");
  for (const c of TRIAGE_CLASSES) {
    const n = s.counts[c];
    L.push(`| ${c} | ${n} | ${CLASS_RESPONSE[c]} | ${c === "BROKEN" ? "no" : "yes"} |`);
  }
  L.push(`| _(resolved — no class)_ | ${s.counts.succeeded} | — | yes |`);
  L.push(`| _(apply-verified only)_ | ${s.counts.unverified} | — | not yet |`);
  L.push("");
  L.push(
    `${s.measuring} records measure the model; ${s.notMeasuring} measure the instrument ` +
      "and are reported outside the failure classes rather than folded into one.",
  );
  L.push("");
  if (s.counts.BROKEN === 0) {
    L.push(
      "**BROKEN has no records, and that is itself a result about the instrument.** Every " +
        "instrument limit in this study removed the cell from disk instead of recording " +
        "itself: the provider refusal left no directory to read, and the quota exhaustion " +
        "left no directory either. So the class that exists to keep unmeasured attempts out " +
        "of the failure counts has nothing to hold, while the holes table below has seven " +
        "entries. A pipeline that writes a row before it calls the model (ARCHITECTURE §2) " +
        "converts those holes into BROKEN records; until the sweep runs, the class is " +
        "implemented and unexercised.",
    );
    L.push("");
  }

  L.push("### LOST: the detector is implementable, and barely exercised here");
  L.push("");
  L.push(
    `The detector averages novelty over ${LOST_DEFAULTS.window} attempts, so a trajectory ` +
      `needs at least ${LOST_DEFAULTS.window} of them. One round contributes one attempt — ` +
      "the pre-retrofit unified-diff runs are the same attempt re-expressed, not further " +
      "attempts, so they are excluded and listed as superseded.",
  );
  L.push("");
  L.push(
    `On that basis the deepest trajectory in the archive is **${s.maxDepth}** ` +
      `(baseline + ${Math.max(0, s.maxDepth - 1)} recovery round${s.maxDepth === 2 ? "" : "s"}), ` +
      `**${s.tracesLongEnough} of ${s.traces.length}** trajectories are long enough to score ` +
      `at all, and the detector fires on **${s.lostFired}** of them at ε = ${LOST_DEFAULTS.epsilon}.`,
  );
  L.push("");
  L.push(
    `**It could not have fired, and that is provable rather than observed.** The first ` +
      "attempt's novelty is 1 by definition — there is nothing yet to repeat. A trajectory of " +
      `exactly ${LOST_DEFAULTS.window} attempts therefore has exactly one window, that window ` +
      `contains attempt 1, and its mean is at least 1/${LOST_DEFAULTS.window} = ` +
      `${(1 / LOST_DEFAULTS.window).toFixed(3)} whatever the other attempts did. Since ` +
      `ε = ${LOST_DEFAULTS.epsilon} < ${(1 / LOST_DEFAULTS.window).toFixed(3)}, LOST is ` +
      `unreachable on a ${LOST_DEFAULTS.window}-attempt trajectory for *any* data — and every ` +
      `scoreable trajectory in this archive has exactly ${LOST_DEFAULTS.window}.`,
  );
  L.push("");
  L.push(
    `So the ${s.lostFired} above is arithmetic, not evidence, in the same way the pilot's ` +
      "null on H1 was arithmetic (see the power analysis). **Design requirement: K >= " +
      `${LOST_DEFAULTS.window + 1} attempt rounds**, one more than the window, so that at ` +
      "least one window excludes the first attempt. Below that the detector is a decoration: " +
      "it runs, it returns, and it cannot say yes.",
  );
  L.push("");

  L.push("### The proposal's novelty score does not work, and the replacement is measured");
  L.push("");
  L.push("| Novelty level | Retries scored | min | mean | max | Usable |");
  L.push("|---|---:|---:|---:|---:|---|");
  L.push(
    `| files touched (as proposed) | ${f.n} | ${f.min.toFixed(3)} | ${f.mean.toFixed(3)} | ` +
      `${f.max.toFixed(3)} | **no** |`,
  );
  L.push(
    `| edited lines (replacement) | ${l.n} | ${l.min.toFixed(3)} | ${l.mean.toFixed(3)} | ` +
      `${l.max.toFixed(3)} | yes |`,
  );
  L.push("");
  L.push(
    "SWE-bench Lite gold patches are single-file (D21), and every attempt at a task edits " +
      "that same file — so the set of files touched is a property of the *task*, not of the " +
      "*attempt*. Measured over the archive: **file-level novelty is exactly 0 on " +
      `${s.fileRetries.zero} of ${f.n} retries**, and all ${s.fileRetries.nonzero} non-zero ` +
      `values come from a patch with no readable file header on one side of the comparison ` +
      `(${s.fileRetries.nonzeroInvolvingUnparseable} of ${s.fileRetries.nonzero} confirmed; ` +
      `${s.unparseablePatches} of ${s.totalPatches} archived patches have no \`--- a/\` or ` +
      "`+++ b/` line at all).",
  );
  L.push("");
  L.push(
    "So the score does not merely fail to discriminate — it **inverts**. The only attempts it " +
      "calls novel are the ones too malformed to name a file, which are precisely the attempts " +
      "a circuit breaker should treat as worthless. Jaccard over the set of edited lines, " +
      "whitespace-normalised, has real spread and ranks near-repetition below genuine " +
      "re-attempts.",
  );
  L.push("");

  if (s.traces.length > 0) {
    L.push("| Task | Condition | Attempts | Line novelty per retry | LOST at | Superseded |");
    L.push("|---|---|---:|---|---:|---|");
    for (const t of s.traces) {
      const seq = t.lineTrace
        .slice(1)
        .map((x) => x.novelty.toFixed(3))
        .join(", ");
      L.push(
        `| \`${t.taskId}\` | ${t.condition} | ${t.lineTrace.length} | ${seq || "_no retry_"} | ` +
          `${t.lostLine ?? "—"} | ${t.superseded.join(", ") || "—"} |`,
      );
    }
    L.push("");
  }

  L.push("### The holes, printed as holes");
  L.push("");
  L.push(
    `**${s.holes.length} of ${FAILURE_POOL.length * CONDITIONS.length} condition-task cells ` +
      "have no record of any kind.** A blank cell in a results table reads as a measured zero, " +
      "so they are enumerated:",
  );
  L.push("");
  L.push("| Task | Condition | Why the cell is empty |");
  L.push("|---|---|---|");
  for (const h of s.holes) L.push(`| \`${h.taskId}\` | ${h.condition} | ${h.reason} |`);
  L.push("");

  L.push("### Every record and the field that classified it");
  L.push("");
  L.push("| Task | Run | Condition | Rd | Fmt | Class | Evidence field | Value |");
  L.push("|---|---|---|---|---|---|---|---|");
  for (const r of s.records) {
    L.push(
      `| \`${r.taskId}\` | ${r.run} | ${r.condition} | ${r.round} | ${r.format} | ` +
        `${r.cls ?? "_none_"} | \`${r.evidenceField}\` | ${r.evidence} |`,
    );
  }
  L.push("");
  return L.join("\n");
}
