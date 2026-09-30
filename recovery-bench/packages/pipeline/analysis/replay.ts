/**
 * `replay` and `report`, the two commands of step 3.
 *
 *   bun run replay     archive -> rows -> data/replay_rows.json
 *   bun run report     rows -> master_table.md + data/chapter5_figures.json
 *
 * ## Why the derived output is committed
 *
 * `archive/legacy_runs/` is gitignored: every file in it already exists upstream
 * at `Lagadnakul/Dissertation@c8872d0`, so the local copy is convenience rather
 * than record. That means **anything derived from it must be committed or it is
 * lost** — the same rule that applies to `data/legacy_patch_audit.json` in step
 * 2. `data/replay_rows.json` and `data/chapter5_figures.json` are therefore
 * committed, and the tests check them on machines with no archive at all.
 */

import { existsSync } from "node:fs";
import { loadArchive, ARCHIVE_RUNS, type ArchiveRow, type LoadResult } from "./load.ts";
import { buildMasterTable } from "./tables.ts";
import { buildFigures } from "./figures.ts";
import { comparePool, deriveFailureClasses } from "./classify.ts";
import { headline } from "./aggregate.ts";
import { FAILURE_POOL } from "./runs.ts";

export const ROWS_OUT = "data/replay_rows.json";
export const FIGURES_OUT = "data/chapter5_figures.json";
export const ORACLE = "../reports/data/master_table.md";

const UPSTREAM = "Lagadnakul/Dissertation@c8872d070fb0b098394796dfbc68bcf67c3bd957";

/**
 * The hand-written class map in `reports/data/build_master_table.py`.
 *
 * Reproduced here as the *expected* answer, never as the input. `replay` derives
 * the classes from outcomes and compares; a mismatch is reported loudly rather
 * than resolved in favour of either side.
 */
export const HARDCODED_FAILURE_CLASS: Record<string, "logic" | "format"> = {
  "astropy__astropy-7746": "logic",
  "django__django-11019": "logic",
  "django__django-11283": "logic",
  "django__django-11564": "logic",
  "astropy__astropy-14182": "format",
  "django__django-11039": "format",
  "django__django-11583": "format",
  "django__django-11620": "format",
};

export interface ReplaySummary {
  rows: number;
  testVerified: number;
  applyVerified: number;
  applyFailed: number;
  unregisteredDirs: number;
  ignoredDirs: number;
  poolMatches: boolean;
  classMatches: boolean;
  classDisagreements: { taskId: string; derived: string; hardcoded: string }[];
}

export function summarise(load: LoadResult): ReplaySummary {
  const { rows, unregistered, ignored } = load;
  const derived = deriveFailureClasses(rows);
  const disagreements: ReplaySummary["classDisagreements"] = [];
  for (const taskId of FAILURE_POOL) {
    const d = derived.get(taskId);
    const hc = HARDCODED_FAILURE_CLASS[taskId];
    if (d !== hc) {
      disagreements.push({ taskId, derived: d ?? "(not derived)", hardcoded: hc ?? "(absent)" });
    }
  }
  return {
    rows: rows.length,
    testVerified: rows.filter((r) => r.row.verification === "test").length,
    applyVerified: rows.filter((r) => r.row.verification === "apply").length,
    applyFailed: rows.filter((r) => r.row.outcome.kind === "APPLY_FAIL").length,
    unregisteredDirs: unregistered.length,
    ignoredDirs: ignored.length,
    poolMatches: comparePool(rows).matches,
    classMatches: disagreements.length === 0,
    classDisagreements: disagreements,
  };
}

/** Serialisable form of a row, with the outcome's bulky payload dropped. */
function serialise(r: ArchiveRow) {
  const o = r.row.outcome;
  return {
    taskId: r.row.cell.taskId,
    run: r.run,
    condition: r.condition,
    round: r.round,
    patchFormat: r.format,
    verification: r.row.verification,
    outcome: o.kind,
    // The patch body itself stays out: it is large, and it already lives in the
    // archive and in `legacy_patch_audit.json`.
    gitError: r.gitError,
    resolved: r.row.verification === "test" ? r.row.resolved : null,
    tests: r.tests,
    timestamp: r.row.timestamp,
  };
}

function requireArchive(): void {
  if (existsSync(ARCHIVE_RUNS)) return;
  console.error(
    `no archive at ${ARCHIVE_RUNS}/.\n` +
      `The payload is gitignored; rebuild it from ${UPSTREAM}.\n` +
      `The derived results in ${ROWS_OUT} and ${FIGURES_OUT} are committed and can be read without it.`,
  );
  process.exit(1);
}

export async function replay(): Promise<number> {
  requireArchive();
  const load = await loadArchive();
  const s = summarise(load);
  const derived = deriveFailureClasses(load.rows);

  await Bun.write(
    ROWS_OUT,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        generated_by: "packages/pipeline/analysis/replay.ts",
        source: { dir: ARCHIVE_RUNS, upstream: UPSTREAM },
        method:
          "Walks instance directories rather than globbing report.json, so cells " +
          "whose patch never applied — which produce no report — are recovered " +
          "instead of vanishing.",
        summary: s,
        failure_class_derived: Object.fromEntries([...derived].sort()),
        failure_class_hardcoded: HARDCODED_FAILURE_CLASS,
        rows: load.rows.map(serialise),
        unregistered: load.unregistered.map((d) => ({ run: d.run, taskId: d.taskId })),
      },
      null,
      2,
    ) + "\n",
  );

  const h = headline(load.rows);
  console.log(`\nreplay — ${s.rows} cells from ${ARCHIVE_RUNS}\n`);
  console.log(`  test-verified (report.json)    ${s.testVerified}`);
  console.log(`  apply-verified (no report)     ${s.applyVerified}   of which APPLY_FAIL: ${s.applyFailed}`);
  console.log(`  unregistered run dirs          ${s.unregisteredDirs}`);
  console.log(`  ignored smoke-test dirs        ${s.ignoredDirs}`);
  console.log(`\n  baseline resolved              ${h.baselineResolved}/${h.baselineN}`);
  console.log(`  failure pool                   ${h.poolSize}   evaluable: ${h.evaluable}`);
  console.log(`  recovered                      ${h.recovered.length}/${h.evaluable}`);
  console.log(`    logic-class                  ${h.recoveredLogic.length}/${h.logicTasks.length}`);
  console.log(`    format-class                 ${h.recoveredFormat.length}/${h.formatTasksEvaluable.length}`);

  console.log(`\n  failure pool matches declared  ${s.poolMatches ? "yes" : "NO"}`);
  console.log(`  failure class matches hardcoded ${s.classMatches ? "yes" : "NO"}`);
  for (const d of s.classDisagreements) {
    console.log(`    ${d.taskId}: derived=${d.derived} hardcoded=${d.hardcoded}`);
  }
  console.log(`\nwrote ${ROWS_OUT}`);
  return s.classMatches && s.poolMatches ? 0 : 1;
}

export async function report(toStdout: boolean): Promise<number> {
  requireArchive();
  const { rows } = await loadArchive();
  const table = buildMasterTable(rows);

  if (toStdout) {
    process.stdout.write(table);
    return 0;
  }

  await Bun.write(FIGURES_OUT, JSON.stringify(buildFigures(rows), null, 2) + "\n");

  // The oracle check, run as part of the command rather than only in tests: the
  // person regenerating a report is exactly the person who needs to know it no
  // longer matches the submitted document.
  let verdict = "oracle not present — skipped";
  let code = 0;
  if (existsSync(ORACLE)) {
    const committed = await Bun.file(ORACLE).text();
    if (committed === table) {
      verdict = "byte-identical to the committed master_table.md";
    } else {
      verdict = `DIFFERS from ${ORACLE} — investigate before citing anything`;
      code = 1;
    }
  }

  console.log(`\nreport — ${rows.length} cells`);
  console.log(`  wrote ${FIGURES_OUT}`);
  console.log(`  ${verdict}\n`);
  return code;
}
