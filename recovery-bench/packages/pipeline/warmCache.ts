/**
 * `bun run warm-cache` — fetch every task file a set needs, once.
 *
 * After this, prompts are byte-reproducible with no network: the file content
 * pasted into a prompt comes from `data/file_cache/`, which is committed. That
 * is what keeps the offline guarantee of steps 0-3 intact now that live calls
 * exist — the only thing a run needs the network for is the model itself.
 */

import { loadConfig } from "../core/config.ts";
import { loadDataset, resolveTaskSet } from "./tasks/dataset.ts";
import { getTaskFile, cacheStats } from "./tasks/files.ts";
import { tryLocalise } from "./tasks/localise.ts";

export async function warmCache(configPath: string, setName: string): Promise<number> {
  const { config: cfg } = await loadConfig(configPath);
  const { tasks } = await loadDataset(cfg);

  let selected;
  try {
    selected = resolveTaskSet(setName, cfg, tasks);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }

  console.log(`\nwarm-cache — ${selected.length} task(s) in "${setName}"\n`);

  let fetched = 0;
  let cached = 0;
  let failed = 0;

  for (const task of selected) {
    const loc = tryLocalise(task);
    if (!loc.ok) {
      console.log(`  FAIL  ${task.instanceId}  ${loc.reason}`);
      failed++;
      continue;
    }
    try {
      const r = await getTaskFile(task, loc.path);
      if (r.fromCache) cached++;
      else fetched++;
      console.log(
        `  ${r.fromCache ? "hit " : "GET "}  ${task.instanceId.padEnd(26)} ` +
          `${String(r.meta.lines).padStart(5)} lines  ${loc.path}`,
      );
    } catch (e) {
      console.log(`  FAIL  ${task.instanceId}  ${e instanceof Error ? e.message : e}`);
      failed++;
    }
  }

  const stats = await cacheStats();
  console.log(
    `\n  ${fetched} fetched, ${cached} already cached, ${failed} failed\n` +
      `  cache now holds ${stats.entries} file(s), ` +
      `${(stats.totalBytes / 1024).toFixed(1)} KB, ${stats.totalLines} lines\n`,
  );
  return failed > 0 ? 1 : 0;
}
