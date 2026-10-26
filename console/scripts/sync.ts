/**
 * Pulls the finished experiment out of recovery-bench into the console.
 *
 *   bun run sync
 *
 * The console never reads recovery-bench/ at build time. Everything it needs is
 * copied here and committed, so the build is hermetic: it works on Vercel, on a
 * fresh clone, and in 2027 when the pipeline has moved on. `provenance.json`
 * records which commit and which file hashes this snapshot came from, which is
 * also what the paper's Data Availability statement needs.
 *
 * What gets dropped, and why -- the raw `response` field is 5 MB of the 7.6 MB
 * source, and it is the model's unparsed output. Everything the console shows
 * about *why* a cell failed is already in `outcome.reason`, `outcome.detail`,
 * `outcome.searchText` and `outcome.gitStderr`. The full responses stay in
 * recovery-bench/data/sweep_rows.jsonl, which is the archival copy.
 *
 * `patch` and `outcome.patch` are byte-identical on all 735 rows that have one
 * (checked, not assumed), so one copy is kept and it lives in public/ to be
 * fetched when a row is expanded rather than inlined into the first paint.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const SRC = here("../../recovery-bench/data");
const REPO = here("../..");
const OUT_DATA = here("../src/data");
const OUT_PUBLIC = here("../public");

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function gitHead(): string | null {
  try {
    return execFileSync("git", ["-C", REPO, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

mkdirSync(OUT_DATA, { recursive: true });
mkdirSync(OUT_PUBLIC, { recursive: true });

// ── sweep rows ─────────────────────────────────────────────────────────────
const jsonlRaw = readFileSync(`${SRC}/sweep_rows.jsonl`, "utf8");
const rows = jsonlRaw
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as Record<string, unknown>);

const patches: Record<string, string> = {};
let patchMismatch = 0;

const trimmed = rows.map((row) => {
  const { response: _response, patch, ...rest } = row;
  const outcome = { ...(rest.outcome as Record<string, unknown>) };

  if (typeof patch === "string") {
    if (outcome.patch !== undefined && outcome.patch !== patch) patchMismatch++;
    patches[row.key as string] = patch;
  }
  delete outcome.patch;

  return { ...rest, outcome };
});

if (patchMismatch > 0) {
  // The assumption that lets one copy be kept. If it ever breaks, stop rather
  // than silently ship the wrong patch text next to a row.
  console.error(
    `sync: patch and outcome.patch differ on ${patchMismatch} row(s). ` +
      `The de-duplication in this script is no longer safe.`,
  );
  process.exit(1);
}

// ── derived analyses, copied as-is ─────────────────────────────────────────
const power = readFileSync(`${SRC}/power.json`, "utf8");
const ccos = readFileSync(`${SRC}/ccos.json`, "utf8");

// ── write ──────────────────────────────────────────────────────────────────
const outputs: [string, string][] = [
  [`${OUT_DATA}/rows.json`, JSON.stringify(trimmed)],
  [`${OUT_DATA}/power.json`, power],
  [`${OUT_DATA}/ccos.json`, ccos],
  [`${OUT_PUBLIC}/patches.json`, JSON.stringify(patches)],
];

for (const [path, contents] of outputs) writeFileSync(path, contents);

const provenance = {
  syncedFrom: "recovery-bench/data",
  commit: gitHead(),
  rows: trimmed.length,
  patches: Object.keys(patches).length,
  dropped: ["response", "outcome.patch (duplicate of patch)"],
  sourceHashes: {
    "sweep_rows.jsonl": sha(jsonlRaw),
    "power.json": sha(power),
    "ccos.json": sha(ccos),
  },
};
writeFileSync(
  `${OUT_DATA}/provenance.json`,
  JSON.stringify(provenance, null, 2) + "\n",
);

// Deliberately no `generated_at`. A timestamp makes the output differ on every
// run even when no value changed, which makes it undiffable and eventually gets
// a timestamp committed as if it were a result -- the problem CONSOLE.md §7
// records about recovery-bench's own derived JSON.

const kb = (s: string) => `${(s.length / 1024).toFixed(0)} KB`;
console.log(`sync — ${trimmed.length} rows from ${provenance.commit?.slice(0, 7) ?? "unknown commit"}\n`);
for (const [path, contents] of outputs) {
  console.log(`  ${path.split("/console/")[1]?.padEnd(26)} ${kb(contents)}`);
}
console.log(`\n  dropped response (${kb(jsonlRaw)} source -> ${kb(JSON.stringify(trimmed))})`);
