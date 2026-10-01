/**
 * The palette has to agree with the predicates it is drawing.
 *
 * `STATUS` is a hand-written literal. That is deliberate — it carries display
 * decisions (`"patch never applied"`, the hatch, the glyph) that no predicate
 * can derive. But it encodes the same grouping `isFormatClass` and
 * `isInstrumentLimit` encode, and two sources of one truth drift.
 *
 * So these tests make them collide. If a tenth outcome is added, or
 * `isFormatClass` changes its mind about `TRUNCATED`, the dashboard's colours
 * stop being a matter of taste and start failing a test.
 */

import { describe, expect, test } from "bun:test";
import {
  isFormatClass,
  isInstrumentLimit,
  OUTCOME_KINDS,
  type Outcome,
  type OutcomeKind,
} from "../packages/core/types.ts";
import {
  BAND_LABEL,
  BAND_ORDER,
  ORDERED_KINDS,
  reasonOf,
  STATUS,
  statusOf,
} from "../packages/dashboard/src/model/status.ts";

/** A minimal, valid payload per kind. Values are arbitrary but well-formed. */
function sample(kind: OutcomeKind): Outcome {
  switch (kind) {
    case "NO_OUTPUT":
      return { kind, detail: "empty body" };
    case "NO_PATCH":
      return { kind, responseChars: 1200 };
    case "MALFORMED":
      return {
        kind,
        reason: "hunk_count_mismatch",
        blockIndex: 0,
        searchText: "@@ -9,9 +9,9 @@",
        nearestLine: null,
        detail: "header declares 9,9 but the body has 8,8",
      };
    case "APPLY_FAIL":
      return { kind, patch: "x", gitStderr: "error: corrupt patch at line 4" };
    case "APPLIED":
      return { kind, patch: "x", filesChanged: ["a/b.py"] };
    case "CONTAMINATED":
      return { kind, patch: "x", similarity: 0.97, threshold: 0.9 };
    case "PROVIDER_ERROR":
      return { kind, status: 429, reason: "rate limited", retries: 2 };
    case "BUDGET_STOP":
      return { kind, tokensUsed: 8200, ceiling: 8000 };
    case "TRUNCATED":
      return {
        kind,
        finishReason: "length",
        completionTokens: 16,
        maxTokens: 16,
        contentChars: 0,
      };
  }
}

describe("the status table covers the taxonomy exactly", () => {
  test("every outcome kind has an entry", () => {
    for (const kind of OUTCOME_KINDS) {
      expect(STATUS[kind], `no palette entry for ${kind}`).toBeDefined();
      expect(STATUS[kind].kind).toBe(kind);
    }
  });

  test("there are no entries for kinds that do not exist", () => {
    expect(Object.keys(STATUS).sort()).toEqual([...OUTCOME_KINDS].sort());
  });

  test("ORDERED_KINDS is a permutation of the taxonomy", () => {
    expect([...ORDERED_KINDS].sort()).toEqual([...OUTCOME_KINDS].sort());
    expect(ORDERED_KINDS.length).toBe(OUTCOME_KINDS.length);
  });

  test("every entry names a fill and a glyph colour", () => {
    for (const kind of OUTCOME_KINDS) {
      expect(STATUS[kind].token.startsWith("--st-"), `${kind} fill`).toBe(true);
      // Two glyph colours exist because one cannot sit legibly on every fill.
      // `tests/dashboardPalette.test.ts` checks the ratios; this only checks
      // that a choice was made for every outcome.
      expect(["--on-status", "--on-status-ink"]).toContain(STATUS[kind].onToken);
    }
  });

  test("every band used has a label", () => {
    for (const kind of OUTCOME_KINDS) {
      expect(BAND_LABEL[statusOf(kind).band]).toBeTruthy();
      expect(BAND_ORDER).toContain(statusOf(kind).band);
    }
  });
});

describe("the bands agree with the core predicates", () => {
  test("band 'format' is exactly isFormatClass", () => {
    const byBand = OUTCOME_KINDS.filter((k) => STATUS[k].band === "format").sort();
    const byPredicate = OUTCOME_KINDS.filter((k) => isFormatClass(sample(k))).sort();
    expect(byBand).toEqual(byPredicate);
  });

  test("band 'limit' is exactly isInstrumentLimit", () => {
    const byBand = OUTCOME_KINDS.filter((k) => STATUS[k].band === "limit").sort();
    const byPredicate = OUTCOME_KINDS.filter((k) => isInstrumentLimit(sample(k))).sort();
    expect(byBand).toEqual(byPredicate);
  });

  test("TRUNCATED is a limit and NOT a format-class failure (D18)", () => {
    // The specific case the palette exists to get right. A fourth ochre step
    // for TRUNCATED would read as "the model produced unusable output" when
    // the truth is "our token ceiling cut it off".
    expect(STATUS.TRUNCATED.band).toBe("limit");
    expect(STATUS.TRUNCATED.hatched).toBe(true);
    expect(isFormatClass(sample("TRUNCATED"))).toBe(false);
    expect(isInstrumentLimit(sample("TRUNCATED"))).toBe(true);
  });

  test("exactly the limit band is hatched", () => {
    for (const kind of OUTCOME_KINDS) {
      expect(STATUS[kind].hatched, `${kind} hatching`).toBe(STATUS[kind].band === "limit");
    }
  });

  test("the three limit outcomes share one token", () => {
    const tokens = new Set(
      OUTCOME_KINDS.filter((k) => STATUS[k].band === "limit").map((k) => STATUS[k].token),
    );
    expect(tokens.size).toBe(1);
  });
});

describe("cells stay distinguishable without colour", () => {
  test("every glyph is unique", () => {
    const glyphs = OUTCOME_KINDS.map((k) => STATUS[k].glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  test("every glyph is a single character", () => {
    for (const kind of OUTCOME_KINDS) {
      expect([...STATUS[kind].glyph].length, `${kind} glyph`).toBe(1);
    }
  });

  test("labels are plain words, not the enum", () => {
    for (const kind of OUTCOME_KINDS) {
      const label = STATUS[kind].label;
      expect(label).not.toBe(kind);
      expect(label).toBe(label.toLowerCase());
      expect(label.includes("_")).toBe(false);
    }
  });
});

describe("reasonOf renders the evidence each outcome carries", () => {
  test("every kind produces a non-empty reason", () => {
    for (const kind of OUTCOME_KINDS) {
      expect(reasonOf(sample(kind)).length, `${kind} reason`).toBeGreaterThan(0);
    }
  });

  test("an apply failure reports git's first line, not the whole stderr", () => {
    const r = reasonOf({
      kind: "APPLY_FAIL",
      patch: "x",
      gitStderr: "error: corrupt patch at line 4\nerror: could not build fake ancestor\n",
    });
    expect(r).toBe("error: corrupt patch at line 4");
  });

  test("a truncation names our ceiling, not the model", () => {
    const r = reasonOf(sample("TRUNCATED"));
    expect(r).toContain("16");
    expect(r).toContain("length");
  });

  test("a malformed outcome prefers its detail over its reason code", () => {
    expect(reasonOf(sample("MALFORMED"))).toContain("9,9");
  });

  test("a malformed outcome with no detail falls back to readable words", () => {
    const r = reasonOf({
      kind: "MALFORMED",
      reason: "search_not_found",
      blockIndex: 1,
      searchText: "",
      nearestLine: null,
      detail: "",
    });
    expect(r).toBe("search not found");
  });
});
