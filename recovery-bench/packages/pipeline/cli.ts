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

const USAGE = `recovery-bench

  doctor [--config <path>] [--live]   run every precondition check
  replay                               rebuild every cell from the archive
  report [--stdout]                    regenerate master_table.md and figure data
  sweep                                (step 6) execute the grid
  serve                                (step 7) open the dashboard

  --config   default configs/base.yaml
  --live     permit network calls (doctor only)
  --stdout   write the table to stdout instead of to disk (report only)

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

  case "sweep":
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
