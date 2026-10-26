#!/usr/bin/env bun
/**
 * One command for every offline gate: `bun run verify`.
 *
 * `doctor` checks that a sweep would produce real data. This checks that the
 * repository itself is sound — types, tests, the doctor gates, the oracle
 * reproduction, the sample-size analysis and the palette. Nothing here needs an
 * API key, Docker or the network.
 *
 * It exists because the alternative is six commands typed by hand in a specific
 * order, which is how a step gets skipped on the day it would have caught
 * something. The CRLF defect of 24 October was found by running the whole suite
 * on a fresh machine; the point of this script is that doing so is one word.
 *
 *   bun run verify              every gate
 *   bun run verify --fast       skip the two slow ones (typecheck, contrast)
 *   bun run verify --list       show the gates and exit
 *
 * Exit code is the number of failed gates, so `&&` chains behave.
 */

import { existsSync } from "node:fs";

/**
 * The running Bun binary, not the string "bun".
 *
 * A spawned process does not necessarily inherit a PATH containing bun — on
 * Windows it usually does not, which is the whole reason this script exists in
 * the first place. `process.execPath` always resolves.
 */
const BUN = process.execPath;

interface Gate {
  name: string;
  /** What a failure here actually means, printed when it fails. */
  meaning: string;
  cmd: string[];
  cwd?: string;
  /** Slow gates are dropped by --fast. */
  slow?: boolean;
  /** Gates that cannot run without the gitignored archive payload. */
  needsArchive?: boolean;
}

const ARCHIVE = "archive/legacy_runs";

const GATES: Gate[] = [
  {
    name: "typecheck",
    meaning: "the strict tsconfig is no longer satisfied",
    cmd: [BUN, "x", "tsc", "--noEmit", "-p", "tsconfig.json"],
    slow: true,
  },
  {
    name: "test",
    meaning: "a behavioural claim the suite pins is now false",
    cmd: [BUN, "test"],
  },
  {
    name: "doctor",
    meaning: "a sweep launched now would produce data that looks real and is not",
    cmd: [BUN, "packages/pipeline/cli.ts", "doctor"],
  },
  {
    name: "report",
    meaning: "master_table.md no longer regenerates byte-identically from the archive",
    cmd: [BUN, "packages/pipeline/cli.ts", "report"],
    needsArchive: true,
  },
  {
    name: "power",
    meaning: "the sample-size analysis no longer reaches its target power",
    cmd: [BUN, "packages/pipeline/cli.ts", "power"],
    needsArchive: true,
  },
  {
    name: "ccos",
    meaning: "triage can no longer classify every archived record with zero model calls",
    cmd: [BUN, "packages/pipeline/cli.ts", "ccos"],
    needsArchive: true,
  },
  {
    name: "contrast",
    meaning: "a dashboard colour pair fails WCAG in light or dark",
    cmd: [BUN, "scripts/check_contrast.ts"],
    cwd: "packages/dashboard",
    slow: true,
  },
];

const argv = process.argv.slice(2);
const fast = argv.includes("--fast");
const list = argv.includes("--list");

if (list) {
  for (const g of GATES) {
    const tags = [g.slow ? "slow" : null, g.needsArchive ? "needs archive" : null]
      .filter(Boolean)
      .join(", ");
    console.log(`  ${g.name.padEnd(10)} ${tags ? `(${tags})` : ""}`);
  }
  process.exit(0);
}

const hasArchive = existsSync(ARCHIVE);
const selected = GATES.filter((g) => !(fast && g.slow));

console.log(`\nverify — ${selected.length} gate(s)${fast ? ", --fast" : ""}`);
if (!hasArchive) {
  console.log(`  no ${ARCHIVE}/ — archive gates will be skipped, not failed`);
}

interface Result {
  gate: Gate;
  state: "pass" | "fail" | "skip";
  ms: number;
  code: number;
}

const results: Result[] = [];

for (const gate of selected) {
  if (gate.needsArchive && !hasArchive) {
    results.push({ gate, state: "skip", ms: 0, code: 0 });
    console.log(`  SKIP  ${gate.name}`);
    continue;
  }

  const started = Date.now();
  const proc = Bun.spawn(gate.cmd, {
    // Spread rather than assigned: exactOptionalPropertyTypes refuses an
    // explicit `undefined` where the option is declared optional.
    ...(gate.cwd ? { cwd: gate.cwd } : {}),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  const ms = Date.now() - started;
  const state = code === 0 ? "pass" : "fail";
  results.push({ gate, state, ms, code });

  console.log(`  ${state === "pass" ? "PASS" : "FAIL"}  ${gate.name.padEnd(10)} ${ms} ms`);

  if (state === "fail") {
    // Only failures print their output. A green run should be six lines, so that
    // the one time it is not green, the reason is the thing on screen.
    console.log(`        ${gate.meaning}`);
    const shown = ["bun", ...gate.cmd.slice(1)].join(" ");
    console.log(`        $ ${shown}${gate.cwd ? `   (in ${gate.cwd})` : ""}`);
    const body = (out + err).trimEnd();
    if (body) {
      for (const line of body.split("\n").slice(-40)) console.log(`        ${line}`);
    }
  }
}

const failed = results.filter((r) => r.state === "fail");
const skipped = results.filter((r) => r.state === "skip");
const total = results.reduce((a, r) => a + r.ms, 0);

console.log("");
if (failed.length === 0) {
  const tail = skipped.length ? `, ${skipped.length} skipped` : "";
  console.log(`all gates pass${tail} — ${(total / 1000).toFixed(1)}s\n`);
  process.exit(0);
}
console.log(
  `${failed.length} gate(s) FAILED: ${failed.map((r) => r.gate.name).join(", ")} — ` +
    `${(total / 1000).toFixed(1)}s\n`,
);
process.exit(failed.length);
