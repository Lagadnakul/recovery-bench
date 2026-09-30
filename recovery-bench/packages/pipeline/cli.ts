#!/usr/bin/env bun
/**
 * One entry point. The original had 33 scripts and no entry point at all, which
 * is why nobody — including its author — could state what had been run.
 *
 *   bun run doctor                    every gate, offline
 *   bun run doctor -- --live          plus measured endpoint probes
 *
 * Subcommands land with their build-order step:
 *   sweep   step 6      replay  step 3      report  step 3      serve   step 7
 */

import { doctor } from "./doctor.ts";
import { replay, report } from "./analysis/replay.ts";
import { tryCell } from "./tryCell.ts";
import { warmCache } from "./warmCache.ts";
import { runSweep } from "./runSweep.ts";

const USAGE = `recovery-bench

  doctor [--config <path>] [--live]   run every precondition check
  replay                               rebuild every cell from the archive
  report [--stdout]                    regenerate master_table.md and figure data
  try [options]                        run ONE cell end to end and print it all
  warm-cache [--set <name>]            pre-fetch task files so runs are offline
  sweep [options]                      enumerate, project, and run the grid
  serve                                (step 7) open the dashboard

  --config   default configs/base.yaml
  --live     permit network calls (doctor only)
  --stdout   write the table to stdout instead of to disk (report only)

sweep options:
  --project-only         show the cost table and stop (the default is to stop)
  --run --yes            actually execute; both are required
  --arm <name>           restrict to one arm; repeatable
  --verify               check that every planned cell has exactly one row
  --force                proceed even when the projection exceeds the budget

try options:
  --task <instance_id>   default: first task of failure_pool
  --strategy <id>        default: l1_blind_retry
  --model <id>           default: muse_30b
  --round <n>            default: 1
  --show-prompt          print the entire prompt rather than the first 600 chars
  --dry-run              build the prompt and stop; no request, no spend
  --offline              refuse to fetch task files; use the cache only

\`replay\` and \`report\` need archive/legacy_runs/, which is gitignored. Their
derived output is committed, so the results are readable without it.
`;

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const command = process.argv[2];
const configPath = option("config", "configs/base.yaml");

switch (command) {
  case "doctor":
    process.exit(await doctor(configPath, flag("live")));

  case "replay":
    process.exit(await replay());

  case "report":
    process.exit(await report(flag("stdout")));

  case "try":
    process.exit(
      await tryCell({
        configPath,
        ...(option("task", "") ? { taskId: option("task", "") } : {}),
        strategy: option("strategy", "l1_blind_retry"),
        model: option("model", "muse_30b"),
        round: Number(option("round", "1")),
        showPrompt: flag("show-prompt"),
        dryRun: flag("dry-run"),
        allowNetwork: !flag("offline"),
      }),
    );

  case "warm-cache":
    process.exit(await warmCache(configPath, option("set", "failure_pool")));

  case "sweep": {
    const arms: string[] = [];
    process.argv.forEach((a, i) => {
      if (a === "--arm" && process.argv[i + 1]) arms.push(process.argv[i + 1]!);
    });
    process.exit(
      await runSweep({
        configPath,
        arms,
        projectOnly: flag("project-only") || !flag("run"),
        verifyOnly: flag("verify"),
        force: flag("force"),
        yes: flag("yes"),
      }),
    );
  }

  case "serve":
    console.log(
      `\`${command}\` is not built yet. Build order (ARCHITECTURE §6):\n` +
        `  step 2  edits/      step 3  analysis + replay\n` +
        `  step 4  providers   step 5  strategies\n` +
        `  step 6  sweep       step 7  dashboard\n`,
    );
    process.exit(2);

  default:
    console.log(USAGE);
    process.exit(command === undefined ? 0 : 2);
}
