/**
 * The unified-diff path — the control condition.
 *
 * The important tests here are the last block: every validator verdict is checked
 * against what real `git apply` does. The validator is a pre-check whose purpose
 * is explanation, so where it disagrees with git that disagreement must be known
 * and deliberate, not discovered later in a results table.
 */

import { test, expect, describe } from "bun:test";
import { extractDiff, validateDiff, diffFiles } from "../packages/pipeline/edits/unified.ts";
import { applyEdits } from "../packages/pipeline/edits/index.ts";
import { checkApply, withScratchRepo } from "../packages/pipeline/verify/apply.ts";

const PATH = "f.py";
const FILE = Array.from({ length: 40 }, (_, i) => `line_${i} = ${i}`).join("\n") + "\n";

const diff = (header: string, body: string[], withFileHeader = true) =>
  [
    ...(withFileHeader ? [`--- a/${PATH}`, `+++ b/${PATH}`] : []),
    `@@ ${header} @@`,
    ...body,
    "",
  ].join("\n");

const GOOD_BODY = [" line_20 = 20", "-line_21 = 21", "+line_21 = 999", " line_22 = 22"];
const GOOD = diff("-21,3 +21,3", GOOD_BODY);

describe("extractDiff", () => {
  test("a bare diff passes through", () => {
    expect(extractDiff(GOOD)).toBe(GOOD);
  });

  test("prose before the diff is dropped", () => {
    const r = extractDiff("EXPLANATION:\nThe guard is inverted.\n\nPATCH:\n" + GOOD);
    expect(r?.startsWith("--- a/")).toBe(true);
  });

  test("a ```diff fence is unwrapped — what the original prompt asked for", () => {
    // The legacy prompt's rule 5 required ```diff fences, so real responses have
    // them and the extractor must handle them.
    const r = extractDiff("```diff\n" + GOOD.trimEnd() + "\n```");
    expect(r?.startsWith("--- a/")).toBe(true);
    expect(r).toContain("@@ -21,3 +21,3 @@");
  });

  test("a plain ``` fence is unwrapped too", () => {
    expect(extractDiff("```\n" + GOOD.trimEnd() + "\n```")?.startsWith("--- a/")).toBe(true);
  });

  test("a headerless hunk is still extracted, not discarded", () => {
    // 6 of the archive's 51 real diffs are this shape. Returning null would score
    // them as NO_PATCH and hide a distinct model behaviour.
    const r = extractDiff(diff("-21,3 +21,3", GOOD_BODY, false));
    expect(r).not.toBeNull();
    expect(r?.startsWith("@@ ")).toBe(true);
  });

  test("prose with no diff at all is null", () => {
    expect(extractDiff("I cannot produce a patch for this issue.")).toBeNull();
  });

  test("the result is newline-terminated", () => {
    expect(extractDiff(GOOD.trimEnd())?.endsWith("\n")).toBe(true);
  });

  test("CRLF is normalised", () => {
    expect(extractDiff(GOOD.replace(/\n/g, "\r\n"))).not.toContain("\r");
  });
});

describe("validateDiff", () => {
  const reasons = (p: string) => validateDiff(p).map((d) => d.reason);

  test("a correct diff has no defects", () => {
    expect(validateDiff(GOOD)).toEqual([]);
  });

  test("REGRESSION: a newline-terminated patch is not reported as mismatched", () => {
    // A first attempt at this counted the trailing "" from split("\n") as a
    // context line, inflating every hunk body by one and flagging 100% of
    // patches — including programmatically generated ones known to apply.
    expect(reasons(GOOD)).not.toContain("hunk_count_mismatch");
    expect(reasons(GOOD.trimEnd())).not.toContain("hunk_count_mismatch");
  });

  test("a blank context line arriving as \"\" counts as context", () => {
    // Transports and editors strip trailing whitespace, so a blank context line
    // " " arrives as "". git tolerates it, so the validator must count it.
    //
    // Body: " a = 1" (ctx), "" (ctx), "-b = 2", "+b = 3"
    //   counting "" as context → old 3, new 3
    //   NOT counting it       → old 2, new 2
    // Declaring 3,3 must pass and declaring 2,2 must fail; together those pin the
    // behaviour, where either one alone would not.
    const body = [" a = 1", "", "-b = 2", "+b = 3"];
    const head = [`--- a/${PATH}`, `+++ b/${PATH}`];

    expect(validateDiff([...head, "@@ -1,3 +1,3 @@", ...body, ""].join("\n"))).toEqual([]);
    expect(reasons([...head, "@@ -1,2 +1,2 @@", ...body, ""].join("\n"))).toContain(
      "hunk_count_mismatch",
    );
  });

  test("a missing file header is reported", () => {
    expect(reasons(diff("-21,3 +21,3", GOOD_BODY, false))).toContain("no_file_header");
  });

  test("inconsistent hunk counts are reported with both numbers", () => {
    const d = validateDiff(diff("-21,9 +21,9", GOOD_BODY));
    expect(d[0]!.reason).toBe("hunk_count_mismatch");
    expect(d[0]!.detail).toContain("declares 9,9");
    expect(d[0]!.detail).toContain("body has 3,3");
  });

  test("an absent count means 1", () => {
    const p = [`--- a/${PATH}`, `+++ b/${PATH}`, "@@ -1 +1 @@", "-a = 1", "+a = 2", ""].join("\n");
    expect(validateDiff(p)).toEqual([]);
  });

  test("an unparseable hunk header is reported", () => {
    const p = [`--- a/${PATH}`, `+++ b/${PATH}`, "@@ nonsense @@", " x", ""].join("\n");
    expect(reasons(p)).toContain("hunk_header_unparseable");
  });

  test("no hunks at all is reported", () => {
    expect(reasons(`--- a/${PATH}\n+++ b/${PATH}\n`)).toContain("hunk_header_unparseable");
  });

  test("the \\ No newline marker is not counted as content", () => {
    const p = [
      `--- a/${PATH}`,
      `+++ b/${PATH}`,
      "@@ -1,2 +1,2 @@",
      " a = 1",
      "-b = 2",
      "\\ No newline at end of file",
      "+b = 3",
      "\\ No newline at end of file",
      "",
    ].join("\n");
    expect(validateDiff(p)).toEqual([]);
  });

  test("defects in a multi-hunk patch carry the right hunk index", () => {
    const p = [
      `--- a/${PATH}`,
      `+++ b/${PATH}`,
      "@@ -1,3 +1,3 @@",
      " line_0 = 0",
      "-line_1 = 1",
      "+line_1 = 11",
      " line_2 = 2",
      "@@ -30,9 +30,9 @@",
      " line_29 = 29",
      "-line_30 = 30",
      "+line_30 = 30x",
      " line_31 = 31",
      "",
    ].join("\n");
    const d = validateDiff(p);
    expect(d).toHaveLength(1);
    expect(d[0]!.blockIndex).toBe(1);
  });
});

describe("diffFiles", () => {
  test("strips the a/ prefix and dedupes", () => {
    expect(diffFiles(GOOD)).toEqual([PATH]);
  });

  test("ignores /dev/null", () => {
    expect(diffFiles("--- /dev/null\n+++ b/new.py\n")).toEqual([]);
  });
});

describe("applyEdits on the unified_diff path", () => {
  test("a valid diff yields a patch and no terminal outcome", () => {
    const r = applyEdits("unified_diff", GOOD, { [PATH]: FILE }, PATH);
    expect(r.outcome).toBeNull();
    expect(r.patch).toContain("@@ -21,3 +21,3 @@");
  });

  test("prose with no diff is NO_PATCH", () => {
    const r = applyEdits("unified_diff", "I cannot fix this.", { [PATH]: FILE }, PATH);
    expect(r.outcome?.kind).toBe("NO_PATCH");
  });

  test("a headerless hunk is MALFORMED/no_file_header, not NO_PATCH", () => {
    const r = applyEdits("unified_diff", diff("-21,3 +21,3", GOOD_BODY, false), { [PATH]: FILE }, PATH);
    expect(r.outcome?.kind).toBe("MALFORMED");
    if (r.outcome?.kind === "MALFORMED") expect(r.outcome.reason).toBe("no_file_header");
  });

  test("a count mismatch is MALFORMED and never reaches git", () => {
    const r = applyEdits("unified_diff", diff("-21,9 +21,9", GOOD_BODY), { [PATH]: FILE }, PATH);
    expect(r.outcome?.kind).toBe("MALFORMED");
    if (r.outcome?.kind === "MALFORMED") expect(r.outcome.reason).toBe("hunk_count_mismatch");
  });

  test("a wrong START line is NOT pre-empted — git decides (D13)", () => {
    // git rescans for the context, so this is not ours to reject. Pre-empting it
    // would substitute our judgement for the measurement.
    const r = applyEdits("unified_diff", diff("-999,3 +999,3", GOOD_BODY), { [PATH]: FILE }, PATH);
    expect(r.outcome).toBeNull();
    expect(r.patch).not.toBeNull();
  });

  test("misquoted context is NOT pre-empted — only git can see the source", () => {
    const body = [" line_XX = nope", "-line_21 = 21", "+line_21 = 999", " line_22 = 22"];
    const r = applyEdits("unified_diff", diff("-21,3 +21,3", body), { [PATH]: FILE }, PATH);
    expect(r.outcome).toBeNull(); // structurally fine; git will reject it
  });
});

describe("the validator agrees with git where it claims to", () => {
  /** Runs the patch past both the validator and real git. */
  async function both(patch: string) {
    const defects = validateDiff(patch).map((d) => d.reason);
    const git = await withScratchRepo({ [PATH]: FILE }, (dir) => checkApply(dir, patch));
    return { defects, gitOk: git.ok, stderr: git.stderr };
  }

  test("clean patch: validator silent, git accepts", async () => {
    const r = await both(GOOD);
    expect(r.defects).toEqual([]);
    expect(r.gitOk).toBe(true);
  });

  test("count mismatch: validator flags, git says corrupt patch", async () => {
    const r = await both(diff("-21,9 +21,9", GOOD_BODY));
    expect(r.defects).toContain("hunk_count_mismatch");
    expect(r.gitOk).toBe(false);
    expect(r.stderr).toContain("corrupt patch");
  });

  test("no file header: validator flags, git refuses", async () => {
    const r = await both(diff("-21,3 +21,3", GOOD_BODY, false));
    expect(r.defects).toContain("no_file_header");
    expect(r.gitOk).toBe(false);
  });

  test("KNOWN DISAGREEMENT: wrong start line — validator silent, git accepts", async () => {
    // Both permissive, so they agree in outcome. Recorded because it is the case
    // a reader most expects to fail.
    const r = await both(diff("-999,3 +999,3", GOOD_BODY));
    expect(r.defects).toEqual([]);
    expect(r.gitOk).toBe(true);
  });

  test("KNOWN DISAGREEMENT: misquoted context — validator silent, git rejects", async () => {
    // The validator cannot see the source file, so this is by design. It is why
    // `git apply` stays the authority and the validator only explains.
    const body = [" line_XX = nope", "-line_21 = 21", "+line_21 = 999", " line_22 = 22"];
    const r = await both(diff("-21,3 +21,3", body));
    expect(r.defects).toEqual([]);
    expect(r.gitOk).toBe(false);
    expect(r.stderr).toContain("does not apply");
  });

  test("prose before the header: git tolerates it, so we must not reject it", async () => {
    const r = await both("valid unified diff\n" + GOOD);
    expect(r.gitOk).toBe(true);
  });
});
