/**
 * The load-bearing test. `doctor` checks this once before a sweep; these keep it
 * checked on every commit, across the shapes that actually break diff generation.
 *
 * If this file goes red, no result the pipeline has ever produced can be trusted:
 * an APPLY_FAIL would no longer mean "the model produced an uninstallable patch",
 * it would mean "we produced one".
 */

import { test, expect, describe } from "bun:test";
import { toPatch, toUnifiedDiff, patchTargets } from "../packages/pipeline/edits/toPatch.ts";
import { checkApply, withScratchRepo, applyAndRead } from "../packages/pipeline/verify/apply.ts";

const PATH = "pkg/mod/thing.py";

/** Asserts a generated diff both applies and yields exactly `after`. */
async function roundTrip(before: string, after: string, path = PATH) {
  const patch = toPatch([{ path, before, after }]);
  return withScratchRepo({ [path]: before }, async (dir) => {
    const check = await checkApply(dir, patch);
    if (!check.ok) return { ok: false as const, stderr: check.stderr, patch };
    const applied = await applyAndRead(dir, patch, path);
    return {
      ok: applied.ok && applied.content === after,
      stderr: applied.stderr,
      content: applied.content,
      patch,
      filesChanged: check.filesChanged,
    };
  });
}

const base = Array.from({ length: 40 }, (_, i) => `line_${i} = ${i}`).join("\n") + "\n";

describe("jsdiff output is git-applicable", () => {
  test("single-line change mid-file", async () => {
    const after = base.replace("line_20 = 20", "line_20 = 999");
    const r = await roundTrip(base, after);
    expect(r.stderr).toBe("");
    expect(r.ok).toBe(true);
  });

  test("two hunks far enough apart to be separate", async () => {
    const after = base
      .replace("line_2 = 2", "line_2 = 22")
      .replace("line_37 = 37", "line_37 = 377");
    const r = await roundTrip(base, after);
    expect(r.ok).toBe(true);
    expect((r.patch.match(/^@@ /gm) ?? []).length).toBe(2);
  });

  test("change on the first line", async () => {
    const r = await roundTrip(base, base.replace("line_0 = 0", "line_0 = -1"));
    expect(r.ok).toBe(true);
  });

  test("change on the last line", async () => {
    const r = await roundTrip(base, base.replace("line_39 = 39", "line_39 = 40"));
    expect(r.ok).toBe(true);
  });

  test("pure insertion", async () => {
    const r = await roundTrip(base, base.replace("line_10 = 10", "line_10 = 10\nline_10b = 10.5"));
    expect(r.ok).toBe(true);
  });

  test("pure deletion", async () => {
    const r = await roundTrip(base, base.replace("line_15 = 15\n", ""));
    expect(r.ok).toBe(true);
  });

  test("file with no trailing newline", async () => {
    const noNl = "a = 1\nb = 2\nc = 3";
    const r = await roundTrip(noNl, "a = 1\nb = 22\nc = 3");
    expect(r.ok).toBe(true);
    // git marks this case explicitly; if jsdiff omitted it the patch would
    // silently add a newline the model never asked for.
    expect(r.patch).toContain("\\ No newline at end of file");
  });

  test("gaining a trailing newline", async () => {
    const r = await roundTrip("a = 1\nb = 2", "a = 1\nb = 2\n");
    expect(r.ok).toBe(true);
  });

  test("non-ASCII content survives byte-exact", async () => {
    const before = 'msg = "coördinate — separability §3"\nx = 1\n';
    const after = 'msg = "coördinate — separability §4"\nx = 1\n';
    const r = await roundTrip(before, after);
    expect(r.ok).toBe(true);
    expect(r.content).toBe(after);
  });

  test("indentation-only change (the whitespace trap)", async () => {
    const before = "def f():\n    if x:\n        return 1\n    return 2\n";
    const after = "def f():\n    if x:\n            return 1\n    return 2\n";
    const r = await roundTrip(before, after);
    expect(r.ok).toBe(true);
    expect(r.content).toBe(after);
  });

  test("deeply nested path", async () => {
    const p = "src/a/b/c/d/e/mod.py";
    const r = await roundTrip("x = 1\n", "x = 2\n", p);
    expect(r.ok).toBe(true);
    expect(r.filesChanged).toEqual([p]);
  });
});

describe("patch assembly", () => {
  test("multiple files concatenate in stable path order", async () => {
    const files = { "z.py": "z = 1\n", "a.py": "a = 1\n", "m.py": "m = 1\n" };
    const patch = toPatch([
      { path: "z.py", before: files["z.py"], after: "z = 2\n" },
      { path: "a.py", before: files["a.py"], after: "a = 2\n" },
      { path: "m.py", before: files["m.py"], after: "m = 2\n" },
    ]);
    expect(patchTargets(patch)).toEqual(["a.py", "m.py", "z.py"]);

    const res = await withScratchRepo(files, (dir) => checkApply(dir, patch));
    expect(res.ok).toBe(true);
    expect(res.filesChanged.sort()).toEqual(["a.py", "m.py", "z.py"]);
  });

  test("an unchanged file contributes nothing", () => {
    expect(toUnifiedDiff({ path: PATH, before: base, after: base })).toBe("");
    expect(toPatch([{ path: PATH, before: base, after: base }])).toBe("");
  });

  test("uses a/ b/ prefixes so git applies at its default -p1", () => {
    const patch = toUnifiedDiff({ path: PATH, before: "x\n", after: "y\n" });
    expect(patch).toContain(`--- a/${PATH}`);
    expect(patch).toContain(`+++ b/${PATH}`);
  });

  test("emits no Index: preamble and no bare === rule", () => {
    // jsdiff prefixes a lone `====…` line (an Index: underline with no Index:).
    // git ignores it; stricter parsers do not.
    const patch = toUnifiedDiff({ path: PATH, before: "x\n", after: "y\n" });
    expect(patch.startsWith("--- a/")).toBe(true);
    expect(patch).not.toContain("=====");
    expect(patch).not.toContain("Index:");
  });
});

describe("the apply layer rejects what it should", () => {
  test("an empty patch is not a success", async () => {
    const res = await withScratchRepo({ [PATH]: base }, (dir) => checkApply(dir, ""));
    expect(res.ok).toBe(false);
  });

  test("a patch whose context does not exist at base_commit fails", async () => {
    // This is the real-world APPLY_FAIL: correct-looking diff, wrong source.
    const patch = toPatch([
      { path: PATH, before: "completely = different\n", after: "completely = changed\n" },
    ]);
    const res = await withScratchRepo({ [PATH]: base }, (dir) => checkApply(dir, patch));
    expect(res.ok).toBe(false);
    expect(res.stderr.length).toBeGreaterThan(0);
  });

  /**
   * These four tests pin down *which* hand-written-diff defect is actually fatal.
   * The answer is not the one the thesis's prose implies, and it was measured
   * here rather than assumed — see docs/DECISIONS.md D13.
   */
  const handWritten = (header: string, body: string[]) =>
    [`--- a/${PATH}`, `+++ b/${PATH}`, `@@ ${header} @@`, ...body, ""].join("\n");

  const goodBody = [" line_20 = 20", "-line_21 = 21", "+line_21 = 999", " line_22 = 22"];

  test("correct header and body applies", async () => {
    const res = await withScratchRepo({ [PATH]: base }, (dir) =>
      checkApply(dir, handWritten("-21,3 +21,3", goodBody)),
    );
    expect(res.ok).toBe(true);
  });

  test("a wildly wrong start line is TOLERATED — git rescans for the context", async () => {
    // Locking in the surprise. If a future git tightens this, the test tells us,
    // because the interpretation of every unified_diff APPLY_FAIL depends on it.
    const res = await withScratchRepo({ [PATH]: base }, (dir) =>
      checkApply(dir, handWritten("-999,3 +999,3", goodBody)),
    );
    expect(res.ok).toBe(true);
  });

  test("inconsistent hunk LENGTH counts are fatal — corrupt patch", async () => {
    // This is the arithmetic that actually matters: ,9 over a 3-line body.
    const res = await withScratchRepo({ [PATH]: base }, (dir) =>
      checkApply(dir, handWritten("-21,9 +21,9", goodBody)),
    );
    expect(res.ok).toBe(false);
    expect(res.stderr).toContain("corrupt patch");
  });

  test("a misquoted context line is fatal", async () => {
    const res = await withScratchRepo({ [PATH]: base }, (dir) =>
      checkApply(dir, handWritten("-21,3 +21,3", [
        " line_XX = nope",
        "-line_21 = 21",
        "+line_21 = 999",
        " line_22 = 22",
      ])),
    );
    expect(res.ok).toBe(false);
    expect(res.stderr).toContain("does not apply");
  });

  test("a misquoted deleted line is fatal", async () => {
    const res = await withScratchRepo({ [PATH]: base }, (dir) =>
      checkApply(dir, handWritten("-21,3 +21,3", [
        " line_20 = 20",
        "-line_21 = WRONG",
        "+line_21 = 999",
        " line_22 = 22",
      ])),
    );
    expect(res.ok).toBe(false);
    expect(res.stderr).toContain("does not apply");
  });

  test("--check does not modify the worktree", async () => {
    const patch = toPatch([{ path: PATH, before: base, after: base.replace("line_5 = 5", "line_5 = 55") }]);
    const unchanged = await withScratchRepo({ [PATH]: base }, async (dir) => {
      const res = await checkApply(dir, patch);
      expect(res.ok).toBe(true);
      return Bun.file(`${dir}/${PATH}`).text();
    });
    expect(unchanged).toBe(base);
  });
});
