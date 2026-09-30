/**
 * Loading the frozen task set.
 *
 * The dataset is read from the local export made in step 0 and never from the
 * network. `swebench_lite.meta.json` pins the upstream revision, and a mismatch
 * is fatal rather than a warning: two runs against different revisions of
 * SWE-bench Lite are not comparable, and nothing downstream could detect it.
 */

import type { Config } from "../../core/config.ts";
import type { Task } from "../../core/types.ts";

/** The nine fields every row must carry, as exported in step 0. */
interface RawRow {
  instance_id: string;
  repo: string;
  base_commit: string;
  environment_setup_commit: string;
  problem_statement: string;
  patch: string;
  test_patch: string;
  FAIL_TO_PASS: string | string[];
  PASS_TO_PASS: string | string[];
  version: string;
}

export interface DatasetMeta {
  dataset: string;
  revision: string;
  rows: number;
  repos: Record<string, number>;
}

export class DatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatasetError";
  }
}

/**
 * SWE-bench ships the test lists sometimes as JSON strings and sometimes as
 * arrays, depending on the export path. Both are accepted; anything else is an
 * error rather than an empty list, because an empty FAIL_TO_PASS would make a
 * task trivially "resolved".
 */
function testList(v: string | string[], field: string, id: string): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v) as unknown;
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      throw new DatasetError(`${id}: ${field} is a string but not valid JSON`);
    }
  }
  throw new DatasetError(`${id}: ${field} is neither an array nor a JSON array`);
}

function toTask(r: RawRow): Task {
  return {
    instanceId: r.instance_id,
    repo: r.repo,
    baseCommit: r.base_commit,
    environmentSetupCommit: r.environment_setup_commit,
    problemStatement: r.problem_statement,
    patch: r.patch,
    testPatch: r.test_patch,
    failToPass: testList(r.FAIL_TO_PASS, "FAIL_TO_PASS", r.instance_id),
    passToPass: testList(r.PASS_TO_PASS, "PASS_TO_PASS", r.instance_id),
    version: r.version,
  };
}

export async function loadMeta(
  path = "data/swebench_lite.meta.json",
): Promise<DatasetMeta> {
  const f = Bun.file(path);
  if (!(await f.exists())) {
    throw new DatasetError(
      `no dataset metadata at ${path} — run \`bun run export-dataset\` (step 0)`,
    );
  }
  return (await f.json()) as DatasetMeta;
}

/**
 * Reads every row, keyed by instance id.
 *
 * Asserts the row count and the pinned revision from config. Step 0's exporter
 * refuses to write anything but exactly 300 complete rows, so a disagreement
 * here means the file was edited or replaced.
 */
export async function loadDataset(
  cfg: Config,
): Promise<{ tasks: Map<string, Task>; meta: DatasetMeta }> {
  const f = Bun.file(cfg.tasks.source);
  if (!(await f.exists())) {
    throw new DatasetError(
      `no dataset at ${cfg.tasks.source} — run \`bun run export-dataset\` (step 0)`,
    );
  }

  const meta = await loadMeta();
  if (meta.revision !== cfg.tasks.revision) {
    throw new DatasetError(
      `dataset revision mismatch: config pins ${cfg.tasks.revision}, ` +
        `the export is ${meta.revision}. Two revisions of SWE-bench Lite are ` +
        `not comparable — re-export or correct the pin, do not proceed.`,
    );
  }

  const tasks = new Map<string, Task>();
  const text = await f.text();
  let lineNo = 0;
  for (const line of text.split("\n")) {
    lineNo++;
    const trimmed = line.trim();
    if (trimmed === "") continue;
    let row: RawRow;
    try {
      row = JSON.parse(trimmed) as RawRow;
    } catch {
      throw new DatasetError(`${cfg.tasks.source}:${lineNo} is not valid JSON`);
    }
    const task = toTask(row);
    if (tasks.has(task.instanceId)) {
      throw new DatasetError(`duplicate instance_id ${task.instanceId}`);
    }
    tasks.set(task.instanceId, task);
  }

  if (tasks.size !== cfg.tasks.expectedRows) {
    throw new DatasetError(
      `expected ${cfg.tasks.expectedRows} instances, read ${tasks.size}`,
    );
  }
  return { tasks, meta };
}

/**
 * Resolves a named task set from config to concrete tasks.
 *
 * `explicit` lists ids; a missing id is fatal, because a silently shorter task
 * set changes every denominator downstream — which is the class of defect D15
 * found in the original analysis.
 *
 * `stratified` is deterministic: repos are visited in a fixed order and tasks
 * are taken in sorted id order, so the same config and dataset always select
 * the same tasks. There is no RNG here; `run.seed` exists for repeats, not for
 * selection.
 */
export function resolveTaskSet(
  name: string,
  cfg: Config,
  all: Map<string, Task>,
): Task[] {
  const set = cfg.tasks.sets[name];
  if (!set) {
    const known = Object.keys(cfg.tasks.sets).join(", ");
    throw new DatasetError(`unknown task set "${name}" — known sets: ${known}`);
  }

  if (set.selection === "explicit") {
    const out: Task[] = [];
    const missing: string[] = [];
    for (const id of set.ids ?? []) {
      const t = all.get(id);
      if (!t) missing.push(id);
      else out.push(t);
    }
    if (missing.length > 0) {
      throw new DatasetError(
        `task set "${name}" names ${missing.length} id(s) absent from the ` +
          `dataset: ${missing.join(", ")}`,
      );
    }
    return out;
  }

  // stratified
  const n = set.n ?? 0;
  const perRepoMin = set.perRepoMin ?? 0;
  const byRepo = new Map<string, Task[]>();
  for (const t of [...all.values()].sort((a, b) =>
    a.instanceId.localeCompare(b.instanceId),
  )) {
    const list = byRepo.get(t.repo) ?? [];
    list.push(t);
    byRepo.set(t.repo, list);
  }

  const repos = [...byRepo.keys()].sort();
  const eligible = repos.filter((r) => (byRepo.get(r)?.length ?? 0) >= perRepoMin);
  if (eligible.length === 0) {
    throw new DatasetError(
      `task set "${name}": no repository has the required ${perRepoMin} tasks`,
    );
  }

  // Floor first, so every eligible repo is represented before any repo gets a
  // second share. D0's sampling bias was 20 tasks drawn from 2 repositories.
  const picked: Task[] = [];
  for (const repo of eligible) {
    picked.push(...(byRepo.get(repo) ?? []).slice(0, perRepoMin));
  }
  if (picked.length > n) {
    throw new DatasetError(
      `task set "${name}": per_repo_min ${perRepoMin} over ${eligible.length} ` +
        `repositories needs ${picked.length} tasks, but n is ${n}`,
    );
  }

  // Then round-robin the remainder, which keeps the tail balanced instead of
  // filling from django alone (114 of 300 instances).
  const taken = new Map(eligible.map((r) => [r, perRepoMin]));
  let progress = true;
  while (picked.length < n && progress) {
    progress = false;
    for (const repo of eligible) {
      if (picked.length >= n) break;
      const list = byRepo.get(repo) ?? [];
      const i = taken.get(repo) ?? 0;
      if (i < list.length) {
        picked.push(list[i]!);
        taken.set(repo, i + 1);
        progress = true;
      }
    }
  }

  if (picked.length < n) {
    throw new DatasetError(
      `task set "${name}": asked for ${n} tasks, only ${picked.length} available`,
    );
  }
  return picked;
}
