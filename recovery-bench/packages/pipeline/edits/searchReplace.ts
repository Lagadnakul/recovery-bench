/**
 * SEARCH/REPLACE blocks — the fairness retrofit's input format.
 *
 * The model shows exact original code and its replacement. It writes no line
 * numbers and no hunk headers, so the two defects D13 identified as fatal —
 * inconsistent hunk counts and a missing file header — become *impossible by
 * construction* rather than merely less likely. What remains is the model's
 * ability to quote the source correctly, which is the thing we actually want to
 * measure.
 *
 * ## Ported from, and faithful to, the original
 *
 * `archive/legacy_code/day11b_diagnose_revise_searchreplace.py` produced the
 * archived numbers, so its semantics are preserved deliberately:
 *
 *   - exactly one occurrence → replace; zero → not found; more than one →
 *     ambiguous, and refuse rather than guess
 *   - blocks apply **sequentially to accumulating content**, so a later block's
 *     uniqueness is judged against the file as earlier blocks left it
 *   - the first failing block aborts the whole edit (`all_applied = False`)
 *
 * Three defects in the original are fixed, and each is noted where it was:
 *
 *   1. the non-greedy regex broke on a REPLACE body containing `=======`
 *   2. `content.count("")` returns `len+1` in Python, so an empty SEARCH block was
 *      misreported as *ambiguous* — a confusing diagnosis for a different bug
 *   3. an unterminated `<<<<<<< SEARCH` was indistinguishable from "no blocks at
 *      all", collapsing two very different model behaviours into one number
 */

import type { MalformedReason } from "@rb/core";

export interface SearchReplaceBlock {
  search: string;
  replace: string;
  /** Path if the model wrote one after the SEARCH marker, else null. */
  path: string | null;
}

export type ParseResult =
  | { ok: true; blocks: SearchReplaceBlock[] }
  | { ok: false; reason: Extract<MalformedReason, "block_unterminated">; detail: string }
  | { ok: false; reason: null; detail: string }; // no blocks at all → NO_PATCH

/**
 * Markers are matched leniently on run length (models emit 5–9 characters) and on
 * an optional path or language tag trailing the SEARCH marker, because that is
 * what models actually produce. Leniency here is safe: it cannot turn a wrong
 * edit into a right one, it only stops us scoring a formatting quirk as a
 * reasoning failure.
 */
const BLOCK = new RegExp(
  "^<{3,}\\s*SEARCH[^\\n]*\\n" + // <<<<<<< SEARCH  (optionally "  path/to/f.py")
    "([\\s\\S]*?)" + //            the search body
    "\\n={3,}[ \\t]*\\n" + //      =======
    "([\\s\\S]*?)" + //            the replace body
    "\\n>{3,}\\s*REPLACE[^\\n]*$", //  >>>>>>> REPLACE
  "gm",
);

/** A SEARCH marker with no matching terminator — reported, not swallowed. */
const OPEN_MARKER = /^<{3,}\s*SEARCH[^\n]*$/gm;

const PATH_AFTER_MARKER = /^<{3,}\s*SEARCH[ \t]+(\S+)/;

/** Strips ``` fences so both edit formats are extracted with equal leniency. */
export function stripFences(text: string): string {
  // Only unwrap when a fence actually encloses the markers; a fence inside a
  // REPLACE body (a docstring, say) must survive untouched.
  const fenced = text.match(/```[a-zA-Z]*\n([\s\S]*?)\n?```/g);
  if (!fenced) return text;
  let out = text;
  for (const block of fenced) {
    const inner = block.replace(/^```[a-zA-Z]*\n/, "").replace(/\n?```$/, "");
    if (/^<{3,}\s*SEARCH/m.test(inner) || /^--- /m.test(inner) || /^@@ /m.test(inner)) {
      out = out.replace(block, inner);
    }
  }
  return out;
}

export function parseSearchReplace(response: string): ParseResult {
  const text = stripFences(response).replace(/\r\n/g, "\n");

  const blocks: SearchReplaceBlock[] = [];
  for (const m of text.matchAll(BLOCK)) {
    blocks.push({
      search: m[1] ?? "",
      replace: m[2] ?? "",
      path: m[0].match(PATH_AFTER_MARKER)?.[1] ?? null,
    });
  }

  // An unterminated block is its own finding. The original could not tell it
  // apart from "the model ignored the format entirely".
  const opened = [...text.matchAll(OPEN_MARKER)].length;
  if (opened > blocks.length) {
    return {
      ok: false,
      reason: "block_unterminated",
      detail:
        `${opened} SEARCH marker(s) but only ${blocks.length} complete block(s) — ` +
        `a ======= or >>>>>>> REPLACE terminator is missing`,
    };
  }

  if (blocks.length === 0) {
    return { ok: false, reason: null, detail: "no SEARCH/REPLACE block in the response" };
  }
  return { ok: true, blocks };
}

// ----------------------------------------------------------------- applying

export interface BlockFailure {
  reason: MalformedReason;
  blockIndex: number;
  searchText: string;
  nearestLine: number | null;
  detail: string;
}

export type ApplyBlocksResult =
  | { ok: true; content: string; blocksApplied: number }
  | { ok: false; failure: BlockFailure };

/** Collapses runs of whitespace — used to *classify* a miss, never to apply one. */
const normalise = (s: string) => s.replace(/[ \t]+/g, " ").replace(/[ \t]+$/gm, "");

/**
 * Finds where a search body would have matched under normalised whitespace.
 * Returns a 1-based line number, or null.
 *
 * This is the diagnosis that turns MALFORMED into evidence. A model that got the
 * logic right and the indentation wrong is a fundamentally different result from
 * one that hallucinated the surrounding code, and without this they are the same
 * number.
 */
export function findNormalisedMatch(content: string, search: string): number | null {
  if (search.length === 0) return null;
  const haystack = normalise(content);
  const needle = normalise(search);
  if (needle.length === 0) return null;
  const at = haystack.indexOf(needle);
  if (at === -1) return null;
  // Map the offset in the normalised text back to a line number by counting
  // newlines, which normalisation preserves exactly.
  return haystack.slice(0, at).split("\n").length;
}

/**
 * Applies blocks in order against accumulating content — the original's
 * semantics, kept so archived and new rows mean the same thing.
 *
 * The ordering hazard is real and is tested: if block 1 creates text that block 2
 * also matches, block 2 becomes ambiguous even though it was unique in the file
 * the model was shown. That is a property of the format, not a bug here, and it
 * must be visible in the results rather than silently resolved.
 */
export function applyBlocks(
  original: string,
  blocks: SearchReplaceBlock[],
): ApplyBlocksResult {
  let content = original;

  for (const [i, block] of blocks.entries()) {
    const { search, replace } = block;

    if (search.length === 0) {
      // The original reported this as "ambiguous": Python's "".count() returns
      // len+1, so the >1 branch fired. Different bug, different name.
      return {
        ok: false,
        failure: {
          reason: "search_empty",
          blockIndex: i,
          searchText: "",
          nearestLine: null,
          detail: "empty SEARCH body — there is nothing to locate",
        },
      };
    }

    const count = occurrences(content, search);

    if (count === 1) {
      content = content.replace(search, () => replace);
      continue;
    }

    if (count === 0) {
      const nearestLine = findNormalisedMatch(content, search);
      return {
        ok: false,
        failure: {
          reason: nearestLine === null ? "search_not_found" : "search_not_found_whitespace",
          blockIndex: i,
          searchText: search,
          nearestLine,
          detail:
            nearestLine === null
              ? "SEARCH text does not occur in the file"
              : `SEARCH text would match at line ${nearestLine} if whitespace were ` +
                `normalised — the model quoted the logic correctly and the ` +
                `indentation or spacing incorrectly`,
        },
      };
    }

    return {
      ok: false,
      failure: {
        reason: "search_ambiguous",
        blockIndex: i,
        searchText: search,
        nearestLine: null,
        detail:
          `SEARCH text occurs ${count} times after ${i} earlier block(s) applied; ` +
          `refusing to guess which one was meant`,
      },
    };
  }

  return { ok: true, content, blocksApplied: blocks.length };
}

/** Literal, non-overlapping occurrence count. */
function occurrences(haystack: string, needle: string): number {
  let n = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return n;
    n += 1;
    from = at + needle.length;
  }
}
