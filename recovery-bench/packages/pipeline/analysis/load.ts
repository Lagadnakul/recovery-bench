/**
 * The archive, read as cells rather than as results.
 *
 * ## Why this is not a `report.json` glob
 *
 * `reports/data/build_master_table.py` globs for `report.json` and finds 73.
 * The archive holds **95** evaluated instance directories. The 22-file gap is
 * not corruption: the SWE-bench harness raises before writing `report.json`
 * when `git apply` refuses the patch, so those runs left a `patch.diff` and a
 * `run_instance.log` and nothing else.
 *
 *     swebench.harness.utils.EvaluationError: Error in evaluation for
 *     django__django-11039: >>>>> Patch Apply Failed:
 *     patch: **** Only garbage was found in the patch input.
 *
 * That is the concrete form of the defect ARCHITECTURE §2 was written against —
 * **a failed cell leaves no record** — and it is the reason 8 of 24 cells
 * "ceased to exist" in the original write-up.
 *
 * So this walks *directories*, and a missing `report.json` is read as evidence
 * rather than as absence. The 22 recovered cells are the ones that carry the
 * thesis's central claim, since a patch that never applied is precisely a
 * format-class failure.
 *
 * ## The verification split is enforced by the type, not by care
 *
 * A directory with a `report.json` yields `Row<"test">` — it went through the
 * Docker harness, which is the only thing that can say `resolved`. Everything
 * else yields `Row<"apply">` with `resolved: null`. `resolveRate` has no
 * overload accepting `Row<"apply">`, so an apply-failure cannot be counted into
 * a resolve rate even by accident (D6, types.ts).
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AnyRow, Cell, Outcome, Row, StrategyId, EditFormat } from "@rb/core";
import { RUNS, IGNORE, type ConditionName, type PatchFormat, type RoundId } from "./runs.ts";

export const ARCHIVE_RUNS = "archive/legacy_runs";

/** A directory that was evaluated, before we decide what it means. */
export interface InstanceDir {
  run: string;
  /** The condition directory name, e.g. `gemini-3.6-flash-blindretry-attempt1`. */
  conditionDir: string;
  taskId: string;
  path: string;
  hasReport: boolean;
  hasPatch: boolean;
}

/** What `build_master_table.py` calls a cell record, kept alongside the typed row. */
export interface ArchiveRow {
  row: AnyRow;
  run: string;
  condition: ConditionName;
  round: RoundId;
  format: PatchFormat;
  /** Present only when the harness wrote a report. */
  tests: { f2pPassed: number; f2pTotal: number; p2pPassed: number; p2pTotal: number } | null;
  /** The git-apply message, for apply failures. */
  gitError: string | null;
}

const CONDITION_TO_STRATEGY: Record<ConditionName, StrategyId> = {
  Baseline: "l0_baseline",
  "Blind Retry": "l1_blind_retry",
  "Reflection-only": "l2_reflection",
  "Diagnose+Revise": "l2_5_diagnose_revise",
};

const FORMAT_TO_EDIT: Record<PatchFormat, EditFormat> = {
  diff: "unified_diff",
  sr: "search_replace",
};

const ROUND_TO_NUMBER: Record<RoundId, number> = { R0: 0, R1: 1, R2: 2 };

/** Every `<run>/<condition>/<instance>/` directory under the archive. */
export async function scanArchive(root = ARCHIVE_RUNS): Promise<InstanceDir[]> {
  const out: InstanceDir[] = [];
  for (const run of (await readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()) {
    const runPath = join(root, run);
    for (const conditionDir of (await readdir(runPath, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()) {
      const condPath = join(runPath, conditionDir);
      for (const taskId of (await readdir(condPath, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()) {
        const path = join(condPath, taskId);
        out.push({
          run,
          conditionDir,
          taskId,
          path,
          hasReport: existsSync(join(path, "report.json")),
          hasPatch: existsSync(join(path, "patch.diff")),
        });
      }
    }
  }
  return out;
}

/**
 * The harness writes `{ "<instance_id>": { ... } }`, so the payload is the sole
 * value under a single dynamic key.
 *
 * Read as "the first value" rather than as `blob[taskId]`, matching the Python's
 * `blob[next(iter(blob))]`. All 73 archived reports do key on their own
 * directory name — checked, not assumed — so the two readings agree here; this
 * one also survives a report whose key and directory disagree.
 */
interface ReportBlob {
  resolved?: boolean;
  patch_successfully_applied?: boolean;
  tests_status?: Record<string, { success?: string[]; failure?: string[] }>;
}

function readReport(blob: Record<string, ReportBlob>): ReportBlob | null {
  const first = Object.values(blob)[0];
  return first ?? null;
}

/** First ISO-ish timestamp in the harness log, or "" when the log is unusable. */
function logTimestamp(log: string): string {
  const m = log.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/m);
  return m?.[1] ? m[1]!.replace(" ", "T") + "Z" : "";
}

/**
 * The reason `git apply` refused, verbatim.
 *
 * Kept as the tool wrote it. These strings are the D13/D14 defect classes seen
 * from the other side — "Only garbage was found in the patch input" is a diff
 * with no usable file header, "malformed patch at line N" is a hunk whose
 * declared counts disagree with its body.
 */
function gitApplyError(log: string): string | null {
  const patchErr = log.match(/^patch: \*\*\*\*.*$/m);
  if (patchErr) return patchErr[0]!.trim();
  const evalErr = log.match(/^.*EvaluationError:.*$/m);
  return evalErr ? evalErr[0]!.trim() : null;
}

function makeCell(taskId: string, meta: { condition: ConditionName; round: RoundId; format: PatchFormat }): Cell {
  return {
    taskId,
    strategy: CONDITION_TO_STRATEGY[meta.condition],
    // The archive is one model throughout; config.md pins the exact endpoint.
    model: "gemini-3.6-flash",
    editFormat: FORMAT_TO_EDIT[meta.format],
    // The original never enabled extended thinking (D5 postdates it).
    thinking: false,
    round: ROUND_TO_NUMBER[meta.round],
    repeat: 0,
  };
}

/**
 * Read one instance directory into a row.
 *
 * Returns `null` only for a directory holding neither a report nor a patch,
 * which means the harness never got as far as producing anything to evaluate.
 */
export async function loadInstance(dir: InstanceDir): Promise<ArchiveRow | null> {
  const meta = RUNS[dir.run];
  if (!meta) return null;

  const logPath = join(dir.path, "run_instance.log");
  const log = existsSync(logPath) ? await readFile(logPath, "utf8") : "";
  const timestamp = logTimestamp(log);
  const cell = makeCell(dir.taskId, meta);
  const base = { cell, runId: dir.run, timestamp, usage: null };

  if (dir.hasReport) {
    const blob = JSON.parse(await readFile(join(dir.path, "report.json"), "utf8")) as Record<
      string,
      ReportBlob
    >;
    const rec = readReport(blob);
    if (!rec) return null;

    const st = rec.tests_status ?? {};
    const f2p = st.FAIL_TO_PASS ?? {};
    const p2p = st.PASS_TO_PASS ?? {};
    const tests = {
      f2pPassed: (f2p.success ?? []).length,
      f2pTotal: (f2p.success ?? []).length + (f2p.failure ?? []).length,
      p2pPassed: (p2p.success ?? []).length,
      p2pTotal: (p2p.success ?? []).length + (p2p.failure ?? []).length,
    };

    // A report exists, so the patch reached the repository. `APPLIED` is the
    // outcome; `resolved` carries whether the tests then passed.
    const outcome: Outcome = {
      kind: "APPLIED",
      patch: "",
      filesChanged: [],
    };

    const row: Row<"test"> = {
      ...base,
      verification: "test",
      outcome,
      resolved: Boolean(rec.resolved),
      tests,
    };
    return { row, run: dir.run, condition: meta.condition, round: meta.round, format: meta.format, tests, gitError: null };
  }

  if (!dir.hasPatch) return null;

  // No report, but a patch exists: the harness aborted. Every such directory in
  // this archive is an apply failure, which `tests/analysisLoad.test.ts` pins —
  // if a future archive holds a different abort, the outcome below is wrong and
  // that test is where it surfaces.
  const gitError = gitApplyError(log);
  const applyFailed = /Patch Apply Failed/.test(log);

  const outcome: Outcome = applyFailed
    ? { kind: "APPLY_FAIL", patch: await readFile(join(dir.path, "patch.diff"), "utf8"), gitStderr: gitError ?? "" }
    : { kind: "PROVIDER_ERROR", status: null, reason: gitError ?? "harness produced no report and no apply error", retries: 0 };

  const row: Row<"apply"> = {
    ...base,
    verification: "apply",
    outcome,
    resolved: null,
    tests: null,
  };
  return { row, run: dir.run, condition: meta.condition, round: meta.round, format: meta.format, tests: null, gitError };
}

export interface LoadResult {
  rows: ArchiveRow[];
  /** Directories under a run not in the registry — reported, never silently dropped. */
  unregistered: InstanceDir[];
  /** Directories under an explicitly ignored smoke-test run. */
  ignored: InstanceDir[];
}

/**
 * Load the whole archive.
 *
 * Unregistered runs are surfaced rather than skipped. `build_master_table.py`
 * drops them with `if run in IGNORE or run not in RUNS: continue`, which
 * conflates "deliberately excluded smoke test" with "run nobody classified".
 * `day11_test` and `day4_test*` fall in the second group — 7 instance
 * directories, none with a report — and they should be visible as a coverage
 * gap rather than invisible.
 */
export async function loadArchive(root = ARCHIVE_RUNS): Promise<LoadResult> {
  const dirs = await scanArchive(root);
  const rows: ArchiveRow[] = [];
  const unregistered: InstanceDir[] = [];
  const ignored: InstanceDir[] = [];

  for (const dir of dirs) {
    if (IGNORE.has(dir.run)) {
      ignored.push(dir);
      continue;
    }
    if (!RUNS[dir.run]) {
      unregistered.push(dir);
      continue;
    }
    const loaded = await loadInstance(dir);
    if (loaded) rows.push(loaded);
  }

  return { rows, unregistered, ignored };
}

/** The 38 + 4 records `build_master_table.py` would have seen, for oracle parity. */
export function testVerified(rows: ArchiveRow[]): ArchiveRow[] {
  return rows.filter((r) => r.row.verification === "test");
}

export function applyVerified(rows: ArchiveRow[]): ArchiveRow[] {
  return rows.filter((r) => r.row.verification === "apply");
}
