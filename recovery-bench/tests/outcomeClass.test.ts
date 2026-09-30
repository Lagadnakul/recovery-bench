/**
 * What counts as a format-class failure, and what must never count.
 *
 * This file exists because a mutation survived. Adding `TRUNCATED` to
 * `isFormatClass` — the exact error D18 was written to prevent — broke nothing
 * in a 237-test suite. The predicate carries the thesis's central measurement
 * and had no test of its own; the taxonomy was documented and unguarded.
 *
 * Every case below is an assertion about a *number in Chapter 5*, not about a
 * type definition.
 */

import { describe, expect, test } from "bun:test";
import {
  isApplied,
  isFormatClass,
  isInstrumentLimit,
  OUTCOME_KINDS,
  type Outcome,
  type OutcomeKind,
} from "../packages/core/types.ts";

/** One representative value per outcome kind, so the sets below are total. */
const SAMPLES: Record<OutcomeKind, Outcome> = {
  NO_OUTPUT: { kind: "NO_OUTPUT", detail: "empty" },
  NO_PATCH: { kind: "NO_PATCH", responseChars: 200 },
  MALFORMED: {
    kind: "MALFORMED",
    reason: "search_not_found",
    blockIndex: 0,
    searchText: "x",
    nearestLine: null,
    detail: "no match",
  },
  APPLY_FAIL: { kind: "APPLY_FAIL", patch: "diff", gitStderr: "corrupt patch" },
  APPLIED: { kind: "APPLIED", patch: "diff", filesChanged: ["a.py"] },
  CONTAMINATED: { kind: "CONTAMINATED", patch: "diff", similarity: 0.99, threshold: 0.95 },
  PROVIDER_ERROR: { kind: "PROVIDER_ERROR", status: 503, reason: "capacity", retries: 4 },
  BUDGET_STOP: { kind: "BUDGET_STOP", tokensUsed: 8_000_000, ceiling: 8_000_000 },
  TRUNCATED: {
    kind: "TRUNCATED",
    finishReason: "length",
    completionTokens: 16,
    maxTokens: 16,
    contentChars: 0,
  },
};

describe("the outcome taxonomy is total", () => {
  test("every declared kind has a sample here", () => {
    // If a tenth outcome is added, this fails until it is classified below —
    // which is the point. An unclassified outcome is one that silently lands
    // in neither failure class.
    expect(Object.keys(SAMPLES).sort()).toEqual([...OUTCOME_KINDS].sort());
  });
});

describe("isFormatClass — the patch never reached the repository", () => {
  const expected: OutcomeKind[] = ["NO_PATCH", "MALFORMED", "APPLY_FAIL"];

  test("is exactly the three model-attributable failures", () => {
    const actual = (Object.keys(SAMPLES) as OutcomeKind[]).filter((k) =>
      isFormatClass(SAMPLES[k]),
    );
    expect(actual.sort()).toEqual([...expected].sort());
  });

  test("TRUNCATED is NOT format-class — this is the load-bearing exclusion", () => {
    // D18. Our own token ceiling severed the response. Counting it as a
    // format-class failure would inflate the thesis's headline number with a
    // configuration choice, the same category error as scoring a baseline over
    // only the tasks that happened to produce a report.
    expect(isFormatClass(SAMPLES.TRUNCATED)).toBe(false);
  });

  test("BUDGET_STOP and PROVIDER_ERROR are NOT format-class", () => {
    // Nothing about the model was measured in either case.
    expect(isFormatClass(SAMPLES.BUDGET_STOP)).toBe(false);
    expect(isFormatClass(SAMPLES.PROVIDER_ERROR)).toBe(false);
  });

  test("NO_OUTPUT is not format-class either — there was no patch to malform", () => {
    expect(isFormatClass(SAMPLES.NO_OUTPUT)).toBe(false);
  });

  test("a successful apply is never format-class", () => {
    expect(isFormatClass(SAMPLES.APPLIED)).toBe(false);
    expect(isFormatClass(SAMPLES.CONTAMINATED)).toBe(false);
  });
});

describe("isInstrumentLimit — measured nothing about the model", () => {
  test("is exactly the three cases attributable to our own setup", () => {
    const actual = (Object.keys(SAMPLES) as OutcomeKind[]).filter((k) =>
      isInstrumentLimit(SAMPLES[k]),
    );
    const want: OutcomeKind[] = ["BUDGET_STOP", "PROVIDER_ERROR", "TRUNCATED"];
    expect(actual.sort()).toEqual(want.sort());
  });

  test("no outcome is both a format-class failure and an instrument limit", () => {
    // The two sets must be disjoint or a single cell would be counted twice,
    // once against the model and once against the harness.
    for (const k of Object.keys(SAMPLES) as OutcomeKind[]) {
      const o = SAMPLES[k];
      expect(isFormatClass(o) && isInstrumentLimit(o)).toBe(false);
    }
  });

  test("an instrument limit is never counted as applied", () => {
    for (const k of ["TRUNCATED", "BUDGET_STOP", "PROVIDER_ERROR"] as OutcomeKind[]) {
      expect(isApplied(SAMPLES[k])).toBe(false);
    }
  });
});

describe("isApplied — the patch reached the repository", () => {
  test("is exactly APPLIED and CONTAMINATED", () => {
    const actual = (Object.keys(SAMPLES) as OutcomeKind[]).filter((k) =>
      isApplied(SAMPLES[k]),
    );
    const want: OutcomeKind[] = ["APPLIED", "CONTAMINATED"];
    expect(actual.sort()).toEqual(want.sort());
  });

  test("CONTAMINATED counts as applied but is excluded from success elsewhere", () => {
    // It applied cleanly; whether it should score is a separate judgement made
    // by the analysis, not by this predicate.
    expect(isApplied(SAMPLES.CONTAMINATED)).toBe(true);
  });
});
