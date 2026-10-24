/**
 * Phase 2, pinned: the failure class is observed, not predicted.
 *
 * The feasibility claim — *"it reads exit codes, not intentions, so it cannot be
 * wrong and introduces no confound"* — is only worth making if the function is
 * total over the outcome taxonomy and agrees with the two-class derivation the
 * thesis tables already rest on. Both are checked here by enumeration rather
 * than by example, so adding an `OutcomeKind` to `@rb/core` without triaging it
 * fails this file instead of silently producing an unclassified record.
 */

import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import {
  OUTCOME_KINDS,
  MALFORMED_REASONS,
  isFormatClass,
  isInstrumentLimit,
  type Outcome,
  type OutcomeKind,
} from "@rb/core";
import { loadArchive, ARCHIVE_RUNS } from "../packages/pipeline/analysis/load.ts";
import { classifyRow } from "../packages/pipeline/analysis/classify.ts";
import { BASELINE_RUN, CONDITIONS, FAILURE_POOL } from "../packages/pipeline/analysis/runs.ts";
import {
  TRIAGE_CLASSES,
  CLASS_RESPONSE,
  LOST_DEFAULTS,
  triageAttempt,
  triageTable,
  triageSummary,
  matrixHoles,
  patchFileSet,
  patchLineSet,
  jaccard,
  noveltyTrace,
  lostAt,
  loadPatches,
  cellTraces,
} from "../packages/pipeline/analysis/triage.ts";

/** One representative outcome per kind, so the enumeration below is total. */
function sample(kind: OutcomeKind): Outcome {
  switch (kind) {
    case "NO_OUTPUT":
      return { kind, detail: "RECITATION" };
    case "NO_PATCH":
      return { kind, responseChars: 400 };
    case "MALFORMED":
      return {
        kind,
        reason: "search_not_found",
        blockIndex: 0,
        searchText: "def f():",
        nearestLine: null,
        detail: "no exact match",
      };
    case "APPLY_FAIL":
      return { kind, patch: "diff", gitStderr: "patch: **** garbage" };
    case "APPLIED":
      return { kind, patch: "diff", filesChanged: ["a.py"] };
    case "CONTAMINATED":
      return { kind, patch: "diff", similarity: 0.98, threshold: 0.9 };
    case "PROVIDER_ERROR":
      return { kind, status: 429, reason: "rate limited", retries: 3 };
    case "BUDGET_STOP":
      return { kind, tokensUsed: 9_000_000, ceiling: 8_000_000 };
    case "TRUNCATED":
      return { kind, finishReason: "length", completionTokens: 16, maxTokens: 16, contentChars: 0 };
  }
}

describe("triage is total over the outcome taxonomy", () => {
  test("every OutcomeKind produces a verdict with named evidence", () => {
    for (const kind of OUTCOME_KINDS) {
      for (const resolved of [true, false, null]) {
        const v = triageAttempt(sample(kind), resolved);
        expect(v.evidenceField.length).toBeGreaterThan(0);
        expect(v.evidence.length).toBeGreaterThan(0);
        if (v.cls !== null) expect(TRIAGE_CLASSES).toContain(v.cls);
      }
    }
  });

  test("every MALFORMED reason is FORMAT, and names the reason as its evidence", () => {
    for (const reason of MALFORMED_REASONS) {
      const v = triageAttempt(
        { kind: "MALFORMED", reason, blockIndex: 2, searchText: "x", nearestLine: 7, detail: "d" },
        null,
      );
      expect(v.cls).toBe("FORMAT");
      expect(v.evidenceField).toBe("outcome.reason");
      expect(v.evidence).toContain(reason);
    }
  });

  test("BROKEN is checked before FORMAT — the precedence the proposal gets backwards", () => {
    // An instrument limit must win even though a truncated response is also
    // unusable as a patch. Scoring it FORMAT would blame the model for our
    // token ceiling (D18).
    for (const kind of OUTCOME_KINDS) {
      const o = sample(kind);
      if (!isInstrumentLimit(o)) continue;
      expect(triageAttempt(o, null).cls).toBe("BROKEN");
    }
  });

  test("BROKEN never claims to measure the model; FORMAT and LOGIC always do", () => {
    for (const kind of OUTCOME_KINDS) {
      const v = triageAttempt(sample(kind), false);
      if (v.cls === "BROKEN") expect(v.measuresModel).toBe(false);
      if (v.cls === "FORMAT" || v.cls === "LOGIC") expect(v.measuresModel).toBe(true);
    }
  });

  test("FORMAT agrees exactly with @rb/core's isFormatClass", () => {
    for (const kind of OUTCOME_KINDS) {
      const o = sample(kind);
      if (isInstrumentLimit(o) || kind === "NO_OUTPUT") continue; // BROKEN wins first
      expect(triageAttempt(o, false).cls === "FORMAT").toBe(isFormatClass(o));
    }
  });

  test("an applied-but-unverified row is never LOGIC — D6 has no opinion to give", () => {
    const v = triageAttempt(sample("APPLIED"), null);
    expect(v.cls).toBeNull();
    expect(v.evidenceField).toBe("verification");
  });

  test("applied + resolved is a success with no class; applied + unresolved is LOGIC", () => {
    expect(triageAttempt(sample("APPLIED"), true).cls).toBeNull();
    expect(triageAttempt(sample("APPLIED"), false).cls).toBe("LOGIC");
  });

  test("CONTAMINATED gets no class and does not count as measuring the model", () => {
    const v = triageAttempt(sample("CONTAMINATED"), true);
    expect(v.cls).toBeNull();
    expect(v.measuresModel).toBe(false);
  });

  test("the prescribed response per class is the proposal's table", () => {
    expect(CLASS_RESPONSE).toEqual({
      FORMAT: "retry",
      LOGIC: "escalate",
      BROKEN: "abort",
      LOST: "escalate",
    });
  });
});

describe("jaccard and the two novelty levels", () => {
  test("jaccard on sets computable by hand", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3, 10);
    expect(jaccard(new Set(["a"]), new Set(["a"]))).toBe(1);
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
    // Two empty sets are identical, not maximally different.
    expect(jaccard(new Set(), new Set())).toBe(1);
  });

  test("patchFileSet reads both headers and ignores /dev/null", () => {
    const p = ["--- a/src/x.py", "+++ b/src/x.py", "@@ -1 +1 @@", "-a", "+b"].join("\n");
    expect([...patchFileSet(p)]).toEqual(["src/x.py"]);
    expect(patchFileSet("--- a/dev/null\n+++ b/new.py").has("dev/null")).toBe(false);
  });

  test("patchLineSet normalises whitespace, so re-indenting is not progress", () => {
    const a = patchLineSet("--- a/x.py\n+++ b/x.py\n-  old\n+  new");
    const b = patchLineSet("--- a/x.py\n+++ b/x.py\n-old\n+      new");
    expect(a).toEqual(b);
    expect(jaccard(a, b)).toBe(1);
  });

  test("patchLineSet keeps the sign — removing a line is not adding it", () => {
    const s = patchLineSet("+x\n-x");
    expect(s.size).toBe(2);
  });

  test("the first attempt is always fully novel; an identical repeat is zero", () => {
    const patch = "--- a/x.py\n+++ b/x.py\n+hello";
    const trace = noveltyTrace([patch, patch, patch], "line");
    expect(trace[0]!.novelty).toBe(1);
    expect(trace[1]!.novelty).toBe(0);
    expect(trace[2]!.novelty).toBe(0);
    expect(trace[2]!.cumulative).toBe(trace[0]!.cumulative);
  });
});

describe("lostAt, and why K = 3 cannot evidence LOST", () => {
  test("a trace shorter than the window returns null rather than averaging what is there", () => {
    const flat = noveltyTrace(["+a", "+a"], "line");
    expect(lostAt(flat, { window: 3, epsilon: 0.9 })).toBeNull();
  });

  test("THE THEOREM: at depth == window, LOST is unreachable for any data when eps < 1/window", () => {
    // The first attempt's novelty is 1 by definition, so the single available
    // window has mean >= 1/window no matter what the other attempts did. This is
    // why the design requirement is K >= 4 and not K >= 3.
    const w = LOST_DEFAULTS.window;
    expect(LOST_DEFAULTS.epsilon).toBeLessThan(1 / w);
    const identical = "--- a/x.py\n+++ b/x.py\n+same";
    // The most repetitive trajectory possible: every attempt identical.
    const trace = noveltyTrace(Array.from({ length: w }, () => identical), "line");
    expect(trace[0]!.novelty).toBe(1);
    for (let i = 1; i < w; i++) expect(trace[i]!.novelty).toBe(0);
    const mean = trace.reduce((a, s) => a + s.novelty, 0) / w;
    expect(mean).toBeCloseTo(1 / w, 10);
    expect(mean).toBeGreaterThan(LOST_DEFAULTS.epsilon);
    expect(lostAt(trace)).toBeNull();
  });

  test("one more attempt makes it reachable — the window finally excludes the first", () => {
    const identical = "--- a/x.py\n+++ b/x.py\n+same";
    const trace = noveltyTrace(Array.from({ length: LOST_DEFAULTS.window + 1 }, () => identical), "line");
    expect(lostAt(trace)).toBe(LOST_DEFAULTS.window + 1);
  });

  test("it fires at the first qualifying window, not the last", () => {
    const steps = [1, 0, 0, 0, 0].map((novelty, i) => ({
      index: i + 1,
      size: 1,
      novelty,
      cumulative: 1,
    }));
    expect(lostAt(steps, { window: 3, epsilon: 0.2 })).toBe(4);
  });

  test("a genuinely varied trajectory never fires", () => {
    const steps = [1, 0.6, 0.5, 0.7].map((novelty, i) => ({
      index: i + 1,
      size: 5,
      novelty,
      cumulative: 5,
    }));
    expect(lostAt(steps, { window: 3, epsilon: 0.2 })).toBeNull();
  });

  test("window 0 is rejected rather than dividing by zero", () => {
    expect(() => lostAt([], { window: 0, epsilon: 0.1 })).toThrow();
  });
});

const hasArchive = existsSync(ARCHIVE_RUNS);

describe.skipIf(!hasArchive)("the archive, triaged", () => {
  test("THE FEASIBILITY CLAIM: every record classified, zero model calls", async () => {
    const { rows } = await loadArchive();
    const s = triageSummary(rows, await loadPatches());

    expect(s.modelCalls).toBe(0);
    expect(s.records.length).toBe(rows.length);
    const accounted =
      s.counts.FORMAT + s.counts.LOGIC + s.counts.BROKEN + s.counts.succeeded + s.counts.unverified;
    expect(accounted).toBe(s.records.length);
  });

  test("the counts are the pilot's, and they are the submitted numbers", async () => {
    const { rows } = await loadArchive();
    const s = triageSummary(rows, await loadPatches());
    expect(s.records.length).toBe(51);
    expect(s.counts.FORMAT).toBe(9);
    expect(s.counts.LOGIC).toBe(25);
    expect(s.counts.succeeded).toBe(17);
  });

  test("triage agrees with classify.ts on every baseline row", async () => {
    // `classify.ts` derives the two-class split the thesis tables rest on. If
    // triage disagreed with it on a single row, one of the two is wrong and
    // every downstream table is in question.
    const { rows } = await loadArchive();
    for (const r of rows) {
      if (r.run !== BASELINE_RUN) continue;
      if (r.row.verification === "test" && r.row.resolved) continue;
      const mine = triageAttempt(
        r.row.outcome,
        r.row.verification === "test" ? Boolean(r.row.resolved) : null,
      );
      expect(mine.cls?.toLowerCase()).toBe(classifyRow(r));
    }
  });

  test("BROKEN is empty — every instrument limit here deleted its own cell", async () => {
    const { rows } = await loadArchive();
    const s = triageSummary(rows, await loadPatches());
    expect(s.counts.BROKEN).toBe(0);
    // And the evidence for that reading is that the holes are not empty.
    expect(s.holes.length).toBeGreaterThan(0);
  });

  test("the holes are 7 of 24, and the three RECITATION ones name their cause", async () => {
    const { rows } = await loadArchive();
    const holes = matrixHoles(rows);
    expect(holes.length).toBe(7);
    expect(FAILURE_POOL.length * CONDITIONS.length).toBe(24);
    const recitation = holes.filter((h) => h.taskId === "astropy__astropy-14182");
    expect(recitation.length).toBe(3);
    for (const h of recitation) expect(h.reason).toContain("RECITATION");
    for (const h of holes) expect(h.reason.length).toBeGreaterThan(0);
  });

  test("a hole is never also a record — the two partition the matrix", async () => {
    const { rows } = await loadArchive();
    const s = triageSummary(rows, await loadPatches());
    const recorded = new Set(
      s.records.filter((r) => r.run !== BASELINE_RUN).map((r) => `${r.taskId}|${r.condition}`),
    );
    for (const h of s.holes) expect(recorded.has(`${h.taskId}|${h.condition}`)).toBe(false);
  });

  test("one round contributes one attempt — the superseded diff runs are excluded", async () => {
    const { rows } = await loadArchive();
    const traces = cellTraces(rows, await loadPatches());
    // Without the dedup the deepest trajectory reads 4 and hands the detector a
    // window it has not earned.
    expect(Math.max(...traces.map((t) => t.lineTrace.length))).toBe(3);
    const dropped = traces.flatMap((t) => t.superseded);
    expect(dropped.length).toBeGreaterThan(0);
    for (const run of dropped) expect(["day9_test", "day10_test"]).toContain(run);
  });

  test("THE FINDING: file-level novelty is 0 except where a patch names no file", async () => {
    const { rows } = await loadArchive();
    const s = triageSummary(rows, await loadPatches());

    expect(s.fileRetries.nonzero).toBe(s.fileRetries.nonzeroInvolvingUnparseable);
    expect(s.fileRetries.zero).toBeGreaterThan(s.fileRetries.nonzero);
    expect(s.unparseablePatches).toBeGreaterThan(0);
    // The inversion: the only "novel" attempts are the unusable ones.
    for (const n of s.fileNoveltyAfterFirst) expect(n === 0 || n === 1).toBe(true);
  });

  test("the line-level replacement actually discriminates", async () => {
    const { rows } = await loadArchive();
    const s = triageSummary(rows, await loadPatches());
    const distinct = new Set(s.lineNoveltyAfterFirst.map((n) => n.toFixed(3)));
    expect(distinct.size).toBeGreaterThan(5);
    const mean =
      s.lineNoveltyAfterFirst.reduce((a, b) => a + b, 0) / s.lineNoveltyAfterFirst.length;
    expect(mean).toBeGreaterThan(0.2);
    expect(mean).toBeLessThan(0.8);
  });

  test("LOST is reported as unreachable at this depth, not as a measured zero", async () => {
    const { rows } = await loadArchive();
    const s = triageSummary(rows, await loadPatches());
    expect(s.maxDepth).toBe(LOST_DEFAULTS.window);
    expect(s.lostObservable).toBe(false);
    expect(s.lostFired).toBe(0);
    expect(s.counts.LOST).toBe(0);
    expect(s.tracesLongEnough).toBeGreaterThan(0); // scoreable, yet unable to fire
  });

  test("every record carries the field that classified it", async () => {
    const { rows } = await loadArchive();
    for (const r of triageTable(rows)) {
      expect(r.evidenceField).toMatch(/^(outcome\.|resolved$|verification$)/);
      expect(r.evidence.length).toBeGreaterThan(0);
      expect(r.evidence.length).toBeLessThanOrEqual(110);
    }
  });
});
