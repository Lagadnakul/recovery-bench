/**
 * The experimental registry: which archived run directory is which cell.
 *
 * Ported from `reports/data/build_master_table.py`, which is the provenance of
 * the submitted Chapter 4-5 tables. The values must match that file exactly —
 * `tests/analysisClassify.test.ts` asserts it — because if they drift, replay
 * silently answers a different question than the thesis asked.
 *
 * What is *not* ported is `FAILURE_CLASS`. That dict is hand-written there, and
 * deriving it instead is the point of this step; see `classify.ts`.
 */

/** Patch representation in use for a run. The retrofit is the `diff` -> `sr` step. */
export type PatchFormat = "diff" | "sr";

/** Recovery strategy label, spelled as the submitted tables spell it. */
export type ConditionName = "Baseline" | "Blind Retry" | "Reflection-only" | "Diagnose+Revise";

export type RoundId = "R0" | "R1" | "R2";

export interface RunMeta {
  condition: ConditionName;
  round: RoundId;
  format: PatchFormat;
  note: string;
}

export const RUNS: Record<string, RunMeta> = {
  day8_test: { condition: "Baseline", round: "R0", format: "diff", note: "20-task baseline pilot" },
  day9_test: { condition: "Blind Retry", round: "R1", format: "diff", note: "pre-retrofit, superseded" },
  day10_test: { condition: "Reflection-only", round: "R1", format: "diff", note: "pre-retrofit, superseded" },
  day11b_tes: { condition: "Diagnose+Revise", round: "R1", format: "sr", note: "retrofitted" },
  day12_blindretry_test: { condition: "Blind Retry", round: "R1", format: "sr", note: "retrofitted" },
  day12_reflection_test: { condition: "Reflection-only", round: "R1", format: "sr", note: "retrofitted" },
  day15_blindretry: { condition: "Blind Retry", round: "R2", format: "sr", note: "retrofitted" },
  day15_reflection: { condition: "Reflection-only", round: "R2", format: "sr", note: "retrofitted" },
  day15_diagnose: { condition: "Diagnose+Revise", round: "R2", format: "sr", note: "retrofitted" },
};

/**
 * Single-task smoke tests from the build-up days, excluded from the thesis.
 *
 * Note `day11_test` is absent from both RUNS and IGNORE, exactly as in the
 * Python. It holds 5 instance directories, none with a `report.json` — the
 * pre-retrofit Diagnose+Revise attempt that was superseded by `day11b_tes`.
 * Replay records those cells as unevaluated rather than dropping them, which is
 * the one place it sees more than `build_master_table.py` does.
 */
export const IGNORE: ReadonlySet<string> = new Set([
  "day5_test",
  "day5_wsl_test",
  "day6_test",
  "day6_test2",
  "day7_test",
  "day7_test2",
]);

/** The 8 tasks unresolved at baseline — the input to every recovery condition. */
export const FAILURE_POOL: readonly string[] = [
  "astropy__astropy-14182",
  "astropy__astropy-7746",
  "django__django-11019",
  "django__django-11039",
  "django__django-11283",
  "django__django-11564",
  "django__django-11583",
  "django__django-11620",
];

/** Recovery conditions, in the order the submitted tables present them. */
export const CONDITIONS: readonly ConditionName[] = [
  "Blind Retry",
  "Reflection-only",
  "Diagnose+Revise",
];

/** The run the failure pool is derived from. */
export const BASELINE_RUN = "day8_test";

/** Size of the baseline pilot. Not derived — it is the sampling decision itself. */
export const BASELINE_N = 20;

/**
 * The one task with no recovery evidence of any kind.
 *
 * It fails APPLY at baseline like the other format-class tasks, but no recovery
 * cell exists for it in any run: Gemini refused to generate, citing RECITATION,
 * so there was never a patch to evaluate. That is an *absence* of directories,
 * which cannot be read from a log — the record lives in
 * `archive/legacy_aggregates/master_results.json`:
 *
 *     "astropy__astropy-14182": {
 *       "baseline": "ERROR (malformed)",
 *       "blind_retry": "EXCLUDED (permanently blocked - RECITATION)", ...
 *     }
 *
 * Declared here so the exclusion is explicit rather than an unexplained hole,
 * and cross-checked against that file in `tests/analysisLoad.test.ts`.
 */
export const RECITATION_EXCLUDED = "astropy__astropy-14182";
