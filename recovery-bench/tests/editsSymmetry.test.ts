/**
 * The fairness rule, as a test.
 *
 * Arm A5 compares `unified_diff` against `search_replace` at scale. That
 * comparison is only about the models if both formats are extracted from the raw
 * response with the *same* tolerance. If our SEARCH/REPLACE parser forgave
 * markdown fences and our diff extractor did not, A5 would measure our code — the
 * precise confound the thesis criticises in other people's work.
 *
 * So: for each way a model might wrap its answer, both formats must survive
 * identically. A failure here silently biases the headline result, which is why it
 * is a test and not a comment.
 */

import { test, expect, describe } from "bun:test";
import { applyEdits } from "../packages/pipeline/edits/index.ts";
import type { EditFormat, OutcomeKind } from "@rb/core";

const PATH = "f.py";
const FILE = ["def f():", "    a = 1", "    b = 2", "    return a + b", ""].join("\n");
const SOURCES = { [PATH]: FILE };

/** The same edit — `b = 2` → `b = 3` — expressed in each format. */
const PAYLOAD: Record<EditFormat, string> = {
  search_replace: ["<<<<<<< SEARCH", "    b = 2", "=======", "    b = 3", ">>>>>>> REPLACE"].join("\n"),
  unified_diff: [
    `--- a/${PATH}`,
    `+++ b/${PATH}`,
    "@@ -1,4 +1,4 @@",
    " def f():",
    "     a = 1",
    "-    b = 2",
    "+    b = 3",
    "     return a + b",
  ].join("\n"),
};

const FORMATS: EditFormat[] = ["search_replace", "unified_diff"];

/** Ways a model actually wraps its answer, applied identically to both formats. */
const WRAPPERS: { name: string; wrap: (payload: string) => string }[] = [
  { name: "bare", wrap: (p) => p },
  { name: "```-fenced", wrap: (p) => "```\n" + p + "\n```" },
  { name: "language-fenced", wrap: (p) => "```diff\n" + p + "\n```" },
  { name: "prose before", wrap: (p) => "EXPLANATION:\nThe constant is wrong.\n\nEDITS:\n" + p },
  { name: "prose after", wrap: (p) => p + "\n\nThis should resolve the failing test." },
  { name: "prose both sides", wrap: (p) => "Here is the fix:\n\n" + p + "\n\nLet me know if this helps." },
  { name: "leading blank lines", wrap: (p) => "\n\n\n" + p },
  { name: "no trailing newline", wrap: (p) => p.replace(/\n+$/, "") },
  { name: "CRLF line endings", wrap: (p) => p.replace(/\n/g, "\r\n") },
  { name: "fenced inside prose", wrap: (p) => "Proposed change:\n\n```\n" + p + "\n```\n\nDone." },
];

describe("both edit formats survive identical wrapping", () => {
  for (const { name, wrap } of WRAPPERS) {
    test(`${name} — accepted for both formats`, () => {
      const results = FORMATS.map((format) => ({
        format,
        result: applyEdits(format, wrap(PAYLOAD[format]), SOURCES, PATH),
      }));

      for (const { format, result } of results) {
        expect(result.outcome, `${format} rejected "${name}"`).toBeNull();
        expect(result.patch, `${format} produced no patch for "${name}"`).not.toBeNull();
      }
    });
  }

  test("no wrapper is tolerated by one format and refused by the other", () => {
    // The asymmetry check stated directly: collect the verdicts and require the
    // two columns to be equal, rather than requiring both to be "accepted".
    const asymmetric: string[] = [];
    for (const { name, wrap } of WRAPPERS) {
      const verdicts = FORMATS.map(
        (f) => applyEdits(f, wrap(PAYLOAD[f]), SOURCES, PATH).outcome === null,
      );
      if (verdicts[0] !== verdicts[1]) asymmetric.push(name);
    }
    expect(asymmetric).toEqual([]);
  });
});

describe("both formats reach the same verdict on degenerate input", () => {
  const cases: { name: string; text: string; expected: OutcomeKind }[] = [
    { name: "empty string", text: "", expected: "NO_OUTPUT" },
    { name: "whitespace only", text: "   \n\t\n  ", expected: "NO_OUTPUT" },
    { name: "a refusal", text: "I cannot determine the correct fix.", expected: "NO_PATCH" },
    { name: "prose with no edit", text: "The bug is in the mask handling logic.", expected: "NO_PATCH" },
    {
      name: "a fenced code block that is not an edit",
      text: "```python\ndef f():\n    return 3\n```",
      expected: "NO_PATCH",
    },
  ];

  for (const { name, text, expected } of cases) {
    test(`${name} → ${expected} for both formats`, () => {
      for (const format of FORMATS) {
        const r = applyEdits(format, text, SOURCES, PATH);
        expect(r.outcome?.kind, format).toBe(expected);
      }
    });
  }
});

describe("the two formats produce the same patch for the same edit", () => {
  test("identical intent, identical result", () => {
    // If they diverged, A5 would be comparing two different edits rather than two
    // ways of expressing one.
    const sr = applyEdits("search_replace", PAYLOAD.search_replace, SOURCES, PATH);
    const ud = applyEdits("unified_diff", PAYLOAD.unified_diff, SOURCES, PATH);

    expect(sr.outcome).toBeNull();
    expect(ud.outcome).toBeNull();

    // The unified path passes the model's own text through, so byte equality is
    // not expected; equality of the *change* is.
    const changed = (p: string) =>
      p
        .split("\n")
        .filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"))
        .join("\n");

    expect(changed(sr.patch!)).toBe(changed(ud.patch!));
  });
});
