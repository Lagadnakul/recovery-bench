/**
 * Step 0 — freeze the task set.
 *
 * Exports SWE-bench Lite (test split, 300 instances) to data/swebench_lite.jsonl
 * over the HuggingFace datasets-server HTTP API. No Python, no `datasets`
 * library, no Docker (D6).
 *
 * The dataset revision sha is recorded in data/swebench_lite.meta.json so the
 * frozen file is traceable to an exact upstream commit. Re-running against a
 * different sha is therefore detectable rather than silent.
 *
 *   bun scripts/export_dataset.ts
 */

export {}; // module scope, so top-level await is legal before step 1 adds a tsconfig

const DATASET = "princeton-nlp/SWE-bench_Lite";
const CONFIG = "default";
const SPLIT = "test";
const PAGE = 100; // datasets-server hard limit
const EXPECTED_ROWS = 300;

/** Fields the pipeline depends on. Missing any of these is a hard failure. */
const REQUIRED_FIELDS = [
  "instance_id",
  "repo",
  "base_commit",
  "problem_statement",
  "patch",
  "test_patch",
  "FAIL_TO_PASS",
  "PASS_TO_PASS",
  "environment_setup_commit",
] as const;

async function getJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

async function revision(): Promise<string> {
  const info = await getJson(`https://huggingface.co/api/datasets/${DATASET}`);
  return info.sha as string;
}

async function rows(offset: number) {
  const url =
    `https://datasets-server.huggingface.co/rows` +
    `?dataset=${encodeURIComponent(DATASET)}` +
    `&config=${CONFIG}&split=${SPLIT}&offset=${offset}&length=${PAGE}`;
  return getJson(url);
}

const sha = await revision();
console.log(`dataset   ${DATASET} (${CONFIG}/${SPLIT})`);
console.log(`revision  ${sha}`);

const first = await rows(0);
const total: number = first.num_rows_total;
if (total !== EXPECTED_ROWS) {
  throw new Error(
    `expected ${EXPECTED_ROWS} rows, upstream reports ${total}. ` +
      `Refusing to write a task set that does not match the thesis.`,
  );
}

const available: string[] = first.features.map((f: any) => f.name);
const missing = REQUIRED_FIELDS.filter((f) => !available.includes(f));
if (missing.length) {
  throw new Error(`dataset is missing required fields: ${missing.join(", ")}`);
}

const collected: Record<string, unknown>[] = [];
for (let offset = 0; offset < total; offset += PAGE) {
  const page = offset === 0 ? first : await rows(offset);
  for (const r of page.rows) collected.push(r.row);
  console.log(`  fetched ${collected.length}/${total}`);
}

if (collected.length !== total) {
  throw new Error(`fetched ${collected.length} rows, expected ${total}`);
}

const ids = new Set(collected.map((r) => r.instance_id as string));
if (ids.size !== total) {
  throw new Error(`duplicate instance_id: ${total - ids.size} collision(s)`);
}

// Stable order, so the file is byte-reproducible regardless of page arrival.
collected.sort((a, b) =>
  (a.instance_id as string).localeCompare(b.instance_id as string),
);

const jsonl = collected.map((r) => JSON.stringify(r)).join("\n") + "\n";
await Bun.write("data/swebench_lite.jsonl", jsonl);

const byRepo = new Map<string, number>();
for (const r of collected) {
  const repo = r.repo as string;
  byRepo.set(repo, (byRepo.get(repo) ?? 0) + 1);
}

await Bun.write(
  "data/swebench_lite.meta.json",
  JSON.stringify(
    {
      dataset: DATASET,
      config: CONFIG,
      split: SPLIT,
      revision: sha,
      rows: total,
      exported_at: new Date().toISOString(),
      source: "datasets-server.huggingface.co/rows",
      fields: available,
      repos: Object.fromEntries([...byRepo].sort()),
    },
    null,
    2,
  ) + "\n",
);

console.log(`\nwrote data/swebench_lite.jsonl  (${collected.length} rows)`);
for (const [repo, n] of [...byRepo].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${repo}`);
}
