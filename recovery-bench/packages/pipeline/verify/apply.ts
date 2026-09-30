/**
 * The apply layer — the whole of verification, per D6.
 *
 * A patch is checked with `git apply --check` against a real repository at the
 * task's `base_commit`. That is a complete, decidable test of the thing Nakul's
 * headline finding is about: whether a generated patch is even *installable*.
 * It needs no Docker, no environment build, and no test execution.
 *
 * What it cannot tell us is whether the patch is *correct*. That distinction is
 * carried in the type system (`Row<"apply">` vs `Row<"test">`), not in prose.
 */

import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

export interface ApplyResult {
  ok: boolean;
  stderr: string;
  /** Files git reported as changed, when the patch applied. */
  filesChanged: string[];
}

async function git(cwd: string, args: string[], stdin?: string) {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

/**
 * Checks a patch against a checked-out worktree without modifying it.
 *
 * `--check` is the operative flag: git parses the patch, locates every hunk, and
 * reports whether it would apply — then changes nothing. Running it against a
 * real repo at `base_commit` (rather than a synthetic file) is what makes the
 * result meaningful, because most real APPLY_FAILs come from context lines that
 * do not exist at that commit.
 */
export async function checkApply(repoDir: string, patch: string): Promise<ApplyResult> {
  if (patch.trim().length === 0) {
    return { ok: false, stderr: "empty patch", filesChanged: [] };
  }

  const check = await git(repoDir, ["apply", "--check", "--verbose", "-"], patch);
  if (check.exitCode !== 0) {
    return { ok: false, stderr: check.stderr.trim(), filesChanged: [] };
  }

  const stat = await git(repoDir, ["apply", "--numstat", "-z", "-"], patch);
  const filesChanged = stat.stdout
    .split("\0")
    .map((chunk) => chunk.split("\t").at(-1) ?? "")
    .filter((p) => p.length > 0);

  return { ok: true, stderr: "", filesChanged };
}

/**
 * Builds a throwaway git repo containing `files`, commits it, and hands the path
 * to `fn`. Used by the doctor gate, and by tests that need an apply target
 * without cloning 114 django checkouts.
 */
export async function withScratchRepo<T>(
  files: Record<string, string>,
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "rb-scratch-"));
  try {
    await git(dir, ["init", "--quiet"]);
    await git(dir, ["config", "user.email", "doctor@recovery-bench.local"]);
    await git(dir, ["config", "user.name", "recovery-bench doctor"]);
    for (const [path, content] of Object.entries(files)) {
      const full = join(dir, path);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, content, "utf8");
    }
    await git(dir, ["add", "-A"]);
    await git(dir, ["commit", "--quiet", "-m", "base"]);
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Applies for real (not `--check`) and returns the resulting file contents. */
export async function applyAndRead(
  repoDir: string,
  patch: string,
  path: string,
): Promise<{ ok: boolean; stderr: string; content: string | null }> {
  const res = await git(repoDir, ["apply", "-"], patch);
  if (res.exitCode !== 0) {
    return { ok: false, stderr: res.stderr.trim(), content: null };
  }
  const content = await Bun.file(join(repoDir, path)).text();
  return { ok: true, stderr: "", content };
}
