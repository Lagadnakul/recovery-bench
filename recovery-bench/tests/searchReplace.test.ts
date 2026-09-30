/**
 * SEARCH/REPLACE is the format the thesis's finding rests on, so it gets the
 * heaviest tests in the repository.
 *
 * Several cases below are regression tests for defects in the original
 * implementation (`archive/legacy_code/day11b_*.py`). Those are labelled, because
 * knowing the original was wrong in a specific way is part of the contribution.
 */

import { test, expect, describe } from "bun:test";
import {
  parseSearchReplace,
  applyBlocks,
  findNormalisedMatch,
  stripFences,
} from "../packages/pipeline/edits/searchReplace.ts";
import { applyEdits } from "../packages/pipeline/edits/index.ts";

const FILE = [
  "import numpy as np",
  "",
  "",
  "def separable(model):",
  "    if not model.separable:",
  "        return False",
  "    return True",
  "",
  "",
  "def other(model):",
  "    if not model.separable:",
  "        return False",
  "    return None",
  "",
].join("\n");

const block = (search: string, replace: string, path?: string) =>
  `<<<<<<< SEARCH${path ? ` ${path}` : ""}\n${search}\n=======\n${replace}\n>>>>>>> REPLACE`;

describe("parsing", () => {
  test("one block", () => {
    const r = parseSearchReplace(block("    return True", "    return None"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]!.search).toBe("    return True");
    expect(r.blocks[0]!.replace).toBe("    return None");
    expect(r.blocks[0]!.path).toBeNull();
  });

  test("multiple blocks with prose between them", () => {
    const text = [
      "EXPLANATION:",
      "Two changes are needed.",
      "",
      "EDITS:",
      block("    return True", "    return None"),
      "",
      "and also:",
      "",
      block("    return False", "    raise ValueError"),
    ].join("\n");
    const r = parseSearchReplace(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.blocks).toHaveLength(2);
  });

  test("a path after the SEARCH marker is captured", () => {
    const r = parseSearchReplace(block("x", "y", "astropy/modeling/separable.py"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.blocks[0]!.path).toBe("astropy/modeling/separable.py");
  });

  test("marker run length varies between models", () => {
    const text = "<<<<< SEARCH\nx\n=====\ny\n>>>>> REPLACE";
    const r = parseSearchReplace(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.blocks[0]!.search).toBe("x");
  });

  test("CRLF input is normalised", () => {
    const r = parseSearchReplace(block("a\nb", "c\nd").replace(/\n/g, "\r\n"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.blocks[0]!.search).toBe("a\nb");
  });

  test("fenced blocks are unwrapped", () => {
    const r = parseSearchReplace("```\n" + block("x", "y") + "\n```");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.blocks).toHaveLength(1);
  });

  test("a fence INSIDE a replace body survives", () => {
    // A model adding a docstring containing ``` must not have it eaten.
    const body = '    """Example:\n    ```python\n    f()\n    ```\n    """';
    const r = parseSearchReplace(block("    pass", body));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.blocks[0]!.replace).toBe(body);
  });

  test("REGRESSION (original bug 1): ======= inside a REPLACE body", () => {
    // The original's non-greedy regex terminated the search body at the first
    // `=======`, silently producing a wrong edit.
    const replace = "    header = '=' * 7\n    sep = '======='";
    const r = parseSearchReplace(block("    return True", replace));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]!.search).toBe("    return True");
  });

  test("REGRESSION (original bug 3): unterminated block is its own reason", () => {
    const r = parseSearchReplace("<<<<<<< SEARCH\n    return True\n");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("block_unterminated");
  });

  test("a second unterminated block after a good one is still reported", () => {
    const r = parseSearchReplace(block("x", "y") + "\n<<<<<<< SEARCH\nz\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("block_unterminated");
  });

  test("no blocks at all is NOT malformed — it is NO_PATCH", () => {
    const r = parseSearchReplace("I cannot determine the fix from the information given.");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBeNull();
  });
});

describe("applying", () => {
  test("a unique match applies", () => {
    const r = applyBlocks(FILE, [{ search: "    return True", replace: "    return None", path: null }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.content).toContain("    return None\n\n\ndef other");
  });

  test("zero matches → search_not_found", () => {
    const r = applyBlocks(FILE, [{ search: "def nonexistent():", replace: "x", path: null }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure.reason).toBe("search_not_found");
    expect(r.failure.nearestLine).toBeNull();
  });

  test("two matches → search_ambiguous, and it refuses rather than guesses", () => {
    // "        return False" appears in both functions.
    const r = applyBlocks(FILE, [{ search: "        return False", replace: "        return 0", path: null }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure.reason).toBe("search_ambiguous");
    expect(r.failure.detail).toContain("2 times");
  });

  test("REGRESSION (original bug 2): empty SEARCH is empty, not ambiguous", () => {
    // Python's "".count() returns len+1, so the original reported this as
    // ambiguous — a misleading diagnosis for a different defect.
    const r = applyBlocks(FILE, [{ search: "", replace: "x", path: null }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure.reason).toBe("search_empty");
  });

  test("blocks apply in order against accumulating content", () => {
    const r = applyBlocks(FILE, [
      { search: "def separable(model):", replace: "def is_separable(model):", path: null },
      { search: "    return True", replace: "    return bool(model)", path: null },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.content).toContain("def is_separable(model):");
    expect(r.content).toContain("    return bool(model)");
    expect(r.blocksApplied).toBe(2);
  });

  test("ORDERING HAZARD: a block can become ambiguous because of an earlier one", () => {
    // Block 1 introduces a second copy of the text block 2 targets. In the file
    // the model was shown, block 2 was unique. This is a property of the format
    // and must surface in the results rather than being silently resolved.
    const r = applyBlocks(FILE, [
      { search: "    return True", replace: "    return None", path: null },
      { search: "    return None", replace: "    return 0", path: null },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure.reason).toBe("search_ambiguous");
    expect(r.failure.blockIndex).toBe(1);
    expect(r.failure.detail).toContain("1 earlier block");
  });

  test("the first failure aborts — later blocks are not applied", () => {
    const r = applyBlocks(FILE, [
      { search: "def nope():", replace: "x", path: null },
      { search: "    return True", replace: "    return None", path: null },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.blockIndex).toBe(0);
  });

  test("a replacement containing $& is literal, not a regex reference", () => {
    // String.replace with a string argument interprets $&; the implementation
    // passes a function to prevent that.
    const r = applyBlocks("cost = 1\n", [{ search: "cost = 1", replace: "cost = '$&$1'", path: null }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.content).toBe("cost = '$&$1'\n");
  });
});

describe("whitespace diagnosis — classify, never apply", () => {
  test("internal-spacing mismatch is named, and reports a line", () => {
    // Double space after `if`; the file has one. Not a substring of the file, so
    // exact matching genuinely misses.
    const r = applyBlocks(FILE, [
      { search: "    if  not model.separable:", replace: "    if not model.is_sep:", path: null },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure.reason).toBe("search_not_found_whitespace");
    expect(r.failure.nearestLine).toBeGreaterThan(0);
    expect(r.failure.detail).toContain("whitespace");
  });

  test("HAZARD: under-indented SEARCH is a substring, so it matches exactly", () => {
    // "  return True" (2 spaces) occurs inside "    return True" (4), so indexOf
    // finds it and the edit applies. Here the surviving prefix happens to keep the
    // indentation correct — but a model that intends absolute indentation in its
    // REPLACE body would silently produce a wrongly-indented file.
    //
    // Inherited from the original's `content.count(search)` approach and kept, so
    // archived and new rows mean the same thing. Recorded rather than fixed: a
    // change here would alter what the retrofit measures.
    const r = applyBlocks(FILE, [
      { search: "  return True", replace: "  return None", path: null },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.content).toContain("    return None"); // prefix preserved, this time
  });

  test("tabs instead of spaces is named", () => {
    const r = applyBlocks(FILE, [{ search: "\treturn True", replace: "\treturn None", path: null }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.reason).toBe("search_not_found_whitespace");
  });

  test("it does NOT apply the near-match", () => {
    const r = applyBlocks(FILE, [
      { search: "    if  not model.separable:", replace: "    if not model.is_sep:", path: null },
    ]);
    expect(r.ok).toBe(false); // exact matching is untouched by diagnosis
  });

  test("a genuine hallucination is not mislabelled as whitespace", () => {
    const r = applyBlocks(FILE, [
      { search: "    return model.is_fully_separable()", replace: "x", path: null },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.reason).toBe("search_not_found");
  });

  test("findNormalisedMatch returns a 1-based line", () => {
    expect(findNormalisedMatch("a\nb\n  c\n", "c")).toBe(3);
    expect(findNormalisedMatch("a\nb\n", "zzz")).toBeNull();
    expect(findNormalisedMatch("a\n", "")).toBeNull();
  });
});

describe("stripFences", () => {
  test("leaves text with no fences alone", () => {
    expect(stripFences("plain text")).toBe("plain text");
  });

  test("unwraps a fence around a diff", () => {
    expect(stripFences("```diff\n--- a/x\n+++ b/x\n```")).toContain("--- a/x");
  });

  test("leaves a fence that wraps unrelated content", () => {
    const t = "```python\nprint(1)\n```";
    expect(stripFences(t)).toBe(t);
  });
});

describe("applyEdits — the contract: always an Outcome, never nothing", () => {
  const sources = { "mod.py": FILE };

  test("a good edit yields a patch and no terminal outcome", () => {
    const r = applyEdits("search_replace", block("    return True", "    return None"), sources, "mod.py");
    expect(r.outcome).toBeNull();
    expect(r.patch).toContain("--- a/mod.py");
    expect(r.files["mod.py"]).toContain("return None");
  });

  test("an empty response is NO_OUTPUT", () => {
    const r = applyEdits("search_replace", "   \n ", sources, "mod.py");
    expect(r.outcome?.kind).toBe("NO_OUTPUT");
  });

  test("prose with no blocks is NO_PATCH", () => {
    const r = applyEdits("search_replace", "I am unable to fix this.", sources, "mod.py");
    expect(r.outcome?.kind).toBe("NO_PATCH");
  });

  test("a failed match is MALFORMED with a reason", () => {
    const r = applyEdits("search_replace", block("def nope():", "x"), sources, "mod.py");
    expect(r.outcome?.kind).toBe("MALFORMED");
    if (r.outcome?.kind === "MALFORMED") expect(r.outcome.reason).toBe("search_not_found");
  });

  test("editing a file that was never provided is reported as such", () => {
    const r = applyEdits("search_replace", block("x", "y", "other/file.py"), sources, "mod.py");
    expect(r.outcome?.kind).toBe("MALFORMED");
    if (r.outcome?.kind === "MALFORMED") {
      expect(r.outcome.detail).toContain("not among the files provided");
    }
  });

  test("a no-op edit is NO_PATCH, not a success", () => {
    // The model "fixed" the bug by replacing code with itself.
    const r = applyEdits("search_replace", block("    return True", "    return True"), sources, "mod.py");
    expect(r.outcome?.kind).toBe("NO_PATCH");
    expect(r.patch).toBeNull();
  });

  test("multi-file edits produce one patch addressing both", () => {
    const two = { "a.py": "x = 1\n", "b.py": "y = 1\n" };
    const response = [block("x = 1", "x = 2", "a.py"), block("y = 1", "y = 2", "b.py")].join("\n\n");
    const r = applyEdits("search_replace", response, two, "a.py");
    expect(r.outcome).toBeNull();
    expect(r.patch).toContain("--- a/a.py");
    expect(r.patch).toContain("--- a/b.py");
  });

  test("every terminal outcome names a legal MALFORMED reason", () => {
    const bad = applyEdits("search_replace", "<<<<<<< SEARCH\nx\n", sources, "mod.py");
    expect(bad.outcome?.kind).toBe("MALFORMED");
    if (bad.outcome?.kind === "MALFORMED") {
      expect(bad.outcome.reason).toBe("block_unterminated");
      expect(bad.outcome.blockIndex).toBe(-1);
    }
  });
});
