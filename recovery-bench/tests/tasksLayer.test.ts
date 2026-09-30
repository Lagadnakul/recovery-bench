/**
 * The task layer: dataset, oracle localisation, and the file cache.
 *
 * The localisation tests carry the load here. Oracle localisation means the
 * model is told which file to edit, derived from the reference solution — the
 * study's declared method. The risk is not the path; it is that the gold patch
 * *body* leaks into a prompt, which would hand the model the answer. That is
 * asserted directly.
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../packages/core/config.ts";
import { loadDataset, resolveTaskSet } from "../packages/pipeline/tasks/dataset.ts";
import {
  localise,
  targetFiles,
  tryLocalise,
  LocalisationError,
} from "../packages/pipeline/tasks/localise.ts";
import { getFile, FetchError } from "../packages/pipeline/tasks/files.ts";
import { buildPrompt } from "../packages/pipeline/strategies/prompt.ts";
import type { Task } from "../packages/core/types.ts";

const cfg = (await loadConfig("configs/base.yaml")).config;

const task = (patch: string, id = "t-1"): Task => ({
  instanceId: id,
  repo: "django/django",
  baseCommit: "abc123",
  environmentSetupCommit: "abc123",
  problemStatement: "a bug",
  patch,
  testPatch: "",
  failToPass: ["a"],
  passToPass: [],
  version: "1.0",
});

const GOLD = `diff --git a/django/views/debug.py b/django/views/debug.py
--- a/django/views/debug.py
+++ b/django/views/debug.py
@@ -1,3 +1,3 @@
-SECRET = "leak me"
+SECRET = "fixed"
`;

describe("oracle localisation", () => {
  test("extracts the path from the gold patch, matching the original regex", () => {
    expect(localise(task(GOLD))).toBe("django/views/debug.py");
  });

  test("strips the a/ prefix and any trailing timestamp", () => {
    const p = "--- a/pkg/mod.py\t2024-01-01 00:00:00.000\n+++ b/pkg/mod.py\n";
    expect(targetFiles(p)).toEqual(["pkg/mod.py"]);
  });

  test("ignores /dev/null, which has no original to quote", () => {
    const p = "--- /dev/null\n+++ b/new_file.py\n";
    expect(targetFiles(p)).toEqual([]);
  });

  test("a patch with no file header is a loud error", () => {
    expect(() => localise(task("no headers here"))).toThrow(LocalisationError);
  });

  test("a multi-file gold patch is REFUSED, not silently truncated to [0]", () => {
    // The original took target_files[0]. All 300 instances are single-file
    // (D21), so taking the first costs nothing — but an unchecked assumption
    // that happens to hold is one dataset change away from a dropped edit.
    const multi =
      "--- a/one.py\n+++ b/one.py\n--- a/two.py\n+++ b/two.py\n";
    expect(() => localise(task(multi))).toThrow(/touches 2 files/);
  });

  test("tryLocalise records the reason instead of throwing", () => {
    // A cell whose task cannot be localised must still terminate in a recorded
    // outcome rather than vanish (D2, D15).
    const r = tryLocalise(task("nothing"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("no `--- a/` header");
  });

  test("EVERY instance in the frozen dataset localises to exactly one file", async () => {
    // This is the measurement that justifies the original's `[0]` (D21).
    const { tasks } = await loadDataset(cfg);
    expect(tasks.size).toBe(300);
    let ok = 0;
    for (const t of tasks.values()) {
      expect(targetFiles(t.patch).length, `${t.instanceId} is not single-file`).toBe(1);
      ok++;
    }
    expect(ok).toBe(300);
  });
});

describe("the gold patch body must never reach a prompt", () => {
  test("localise returns a path only — no patch text escapes", () => {
    const path = localise(task(GOLD));
    expect(path).toBe("django/views/debug.py");
    expect(path).not.toContain("SECRET");
    expect(path).not.toContain("+++");
  });

  test("a rendered prompt contains the file content but not the gold diff", async () => {
    const t = task(GOLD);
    const filePath = localise(t);
    const fileContent = 'SECRET = "leak me"\n';
    const { prompt } = await buildPrompt("l1_blind_retry", {
      repo: t.repo,
      problemStatement: t.problemStatement,
      filePath,
      fileContent,
    });

    // The current file is shown — that is the point of the condition.
    expect(prompt).toContain(fileContent);
    // The reference solution is not.
    expect(prompt).not.toContain('SECRET = "fixed"');
    expect(prompt).not.toContain("diff --git");
    expect(prompt).not.toContain("@@ -1,3 +1,3 @@");
    expect(prompt).not.toContain(t.patch);
  });
});

describe("dataset loading", () => {
  test("reads 300 tasks and pins the revision", async () => {
    const { tasks, meta } = await loadDataset(cfg);
    expect(tasks.size).toBe(300);
    expect(meta.revision).toBe(cfg.tasks.revision);
  });

  test("test lists are arrays, and FAIL_TO_PASS is never empty", async () => {
    const { tasks } = await loadDataset(cfg);
    for (const t of tasks.values()) {
      expect(Array.isArray(t.failToPass)).toBe(true);
      // An empty FAIL_TO_PASS would make a task trivially resolved.
      expect(t.failToPass.length).toBeGreaterThan(0);
    }
  });

  test("a revision mismatch is fatal, not a warning", async () => {
    const bad = {
      ...cfg,
      tasks: { ...cfg.tasks, revision: "0".repeat(40) },
    };
    await expect(loadDataset(bad)).rejects.toThrow(/revision mismatch/);
  });

  test("failure_pool resolves to the four logic-class tasks", async () => {
    const { tasks } = await loadDataset(cfg);
    const pool = resolveTaskSet("failure_pool", cfg, tasks);
    expect(pool.map((t) => t.instanceId).sort()).toEqual([
      "astropy__astropy-7746",
      "django__django-11019",
      "django__django-11283",
      "django__django-11564",
    ]);
  });

  test("an unknown task set names the known ones", async () => {
    const { tasks } = await loadDataset(cfg);
    expect(() => resolveTaskSet("nope", cfg, tasks)).toThrow(/known sets/);
  });

  test("an explicit set with a missing id fails rather than shrinking", async () => {
    const { tasks } = await loadDataset(cfg);
    const bad = {
      ...cfg,
      tasks: {
        ...cfg.tasks,
        sets: {
          ...cfg.tasks.sets,
          broken: {
            selection: "explicit" as const,
            ids: ["does__not-exist"],
            n: null,
            perRepoMin: 0,
          },
        },
      },
    };
    // A silently shorter task set changes every denominator downstream.
    expect(() => resolveTaskSet("broken", bad, tasks)).toThrow(/absent from the/);
  });

  test("stratified_60 gives 60 tasks across at least 12 repos, deterministically", async () => {
    const { tasks } = await loadDataset(cfg);
    const a = resolveTaskSet("stratified_60", cfg, tasks);
    const b = resolveTaskSet("stratified_60", cfg, tasks);
    expect(a.length).toBe(60);
    // Same config, same dataset, same selection — no RNG in selection.
    expect(a.map((t) => t.instanceId)).toEqual(b.map((t) => t.instanceId));

    const repos = new Set(a.map((t) => t.repo));
    // D0's bias was 20 tasks from 2 repositories; the floor fixes that.
    expect(repos.size).toBe(12);
    for (const r of repos) {
      expect(a.filter((t) => t.repo === r).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("file cache", () => {
  test("a cache miss with network disabled is an error, not a fetch", async () => {
    await expect(
      getFile("some/repo", "deadbeef", "a.py", { allowNetwork: false }),
    ).rejects.toThrow(/not cached and network access is disabled/);
  });

  test("a fetched file is cached, hash-verified, and served from disk next time", async () => {
    const content = "def f():\n    return 1\n";
    let calls = 0;
    const fake = (async () => {
      calls++;
      return new Response(content, { status: 200 });
    }) as unknown as typeof fetch;

    const dir = await mkdtemp(join(tmpdir(), "rb-fc-"));
    const cwd = process.cwd();
    try {
      process.chdir(dir);
      const first = await getFile("r/r", "c0ffee", "x.py", { fetchImpl: fake });
      expect(first.fromCache).toBe(false);
      expect(first.content).toBe(content);
      expect(first.meta.lines).toBe(3);

      const second = await getFile("r/r", "c0ffee", "x.py", { fetchImpl: fake });
      expect(second.fromCache).toBe(true);
      expect(second.content).toBe(content);
      // One network call for two reads — the prompt is now reproducible.
      expect(calls).toBe(1);
    } finally {
      process.chdir(cwd);
    }
  });

  test("a corrupted cache blob is detected rather than served", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-fc-"));
    const cwd = process.cwd();
    try {
      process.chdir(dir);
      const fake = (async () =>
        new Response("original\n", { status: 200 })) as unknown as typeof fetch;
      const got = await getFile("r/r", "abc", "y.py", { fetchImpl: fake });
      expect(got.fromCache).toBe(false);

      // Tamper with the blob. A cache that can silently drift would change the
      // prompt without the experiment recording it.
      const idx = JSON.parse(
        await Bun.file("data/file_cache/index.json").text(),
      ) as Record<string, unknown>;
      const key = Object.keys(idx)[0]!;
      const hash = new Bun.CryptoHasher("sha256").update(key).digest("hex");
      await writeFile(
        join("data/file_cache/blobs", hash.slice(0, 2), `${hash}.txt`),
        "TAMPERED\n",
        "utf8",
      );

      await expect(getFile("r/r", "abc", "y.py", { allowNetwork: false })).rejects.toThrow(
        FetchError,
      );
    } finally {
      process.chdir(cwd);
    }
  });

  test("a non-200 fetch explains that the cache is the durable record", async () => {
    const fake = (async () =>
      new Response("not found", { status: 404 })) as unknown as typeof fetch;
    const dir = await mkdtemp(join(tmpdir(), "rb-fc-"));
    const cwd = process.cwd();
    try {
      process.chdir(dir);
      await expect(getFile("r/r", "gone", "z.py", { fetchImpl: fake })).rejects.toThrow(
        /HTTP 404/,
      );
    } finally {
      process.chdir(cwd);
    }
  });
});
