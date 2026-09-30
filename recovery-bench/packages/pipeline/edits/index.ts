/**
 * The one entry point the strategies call.
 *
 * Its contract is the property the original code lacked: **it always returns an
 * Outcome.** It never throws, never returns nothing, and never prints
 * `Not applied` and moves on. That behaviour is why 8 of 24 cells in the original
 * study ceased to exist rather than becoming negative results — and those vanished
 * cells were the single most frequent outcome in the study (PLAN.md D2).
 *
 * `git apply` is not called here. This layer is pure: text in, patch plus outcome
 * out. Verification belongs to `verify/apply.ts`, which needs a checked-out
 * repository, and the split is what lets every function here be tested without
 * cloning django.
 */

import type { EditFormat, Outcome } from "@rb/core";
import { parseSearchReplace, applyBlocks } from "./searchReplace.ts";
import { extractDiff, validateDiff } from "./unified.ts";
import { toPatch } from "./toPatch.ts";

export interface EditResult {
  /** A patch when one could be produced, else null. */
  patch: string | null;
  /**
   * `null` when the edit produced a patch worth handing to `git apply --check`.
   * Non-null when the cell already has a terminal outcome and must not proceed.
   */
  outcome: Outcome | null;
  /** New content per path, for callers that want it without re-parsing. */
  files: Record<string, string>;
}

/** Keeps a diagnostic field readable in a results file without losing its shape. */
const clip = (s: string, n = 400) =>
  s.length <= n ? s : `${s.slice(0, n)}\n… (${s.length - n} more chars)`;

/**
 * @param format     which edit format the cell was run under
 * @param response   the model's raw text
 * @param sources    path → current file content, from the checked-out repo
 * @param targetPath the oracle-localised file, used when the model names none
 */
export function applyEdits(
  format: EditFormat,
  response: string,
  sources: Record<string, string>,
  targetPath: string,
): EditResult {
  const empty = { patch: null, files: {} };

  if (response.trim().length === 0) {
    return { ...empty, outcome: { kind: "NO_OUTPUT", detail: "empty response" } };
  }

  return format === "search_replace"
    ? viaSearchReplace(response, sources, targetPath)
    : viaUnifiedDiff(response);
}

// ------------------------------------------------------------ search_replace

function viaSearchReplace(
  response: string,
  sources: Record<string, string>,
  targetPath: string,
): EditResult {
  const empty = { patch: null, files: {} };
  const parsed = parseSearchReplace(response);

  if (!parsed.ok) {
    if (parsed.reason === null) {
      return {
        ...empty,
        outcome: { kind: "NO_PATCH", responseChars: response.length },
      };
    }
    return {
      ...empty,
      outcome: {
        kind: "MALFORMED",
        reason: parsed.reason,
        blockIndex: -1,
        searchText: "",
        nearestLine: null,
        detail: parsed.detail,
      },
    };
  }

  // Group by target file. A block that names no path belongs to the localised
  // file, which is how the original worked (single-file, oracle-localised).
  const byPath = new Map<string, typeof parsed.blocks>();
  for (const block of parsed.blocks) {
    const path = block.path ?? targetPath;
    const list = byPath.get(path);
    if (list) list.push(block);
    else byPath.set(path, [block]);
  }

  const edits: { path: string; before: string; after: string }[] = [];
  const files: Record<string, string> = {};

  for (const [path, blocks] of byPath) {
    const before = sources[path];
    if (before === undefined) {
      // The model edited a file it was never shown. Not a format defect — it
      // located the wrong file, and that must read differently in the results.
      return {
        ...empty,
        outcome: {
          kind: "MALFORMED",
          reason: "search_not_found",
          blockIndex: 0,
          searchText: clip(blocks[0]?.search ?? ""),
          nearestLine: null,
          detail: `block targets "${path}", which was not among the files provided`,
        },
      };
    }

    const applied = applyBlocks(before, blocks);
    if (!applied.ok) {
      const f = applied.failure;
      return {
        ...empty,
        outcome: {
          kind: "MALFORMED",
          reason: f.reason,
          blockIndex: f.blockIndex,
          searchText: clip(f.searchText),
          nearestLine: f.nearestLine,
          detail: `${path}: ${f.detail}`,
        },
      };
    }

    files[path] = applied.content;
    edits.push({ path, before, after: applied.content });
  }

  const patch = toPatch(edits);
  if (patch.length === 0) {
    // Every block applied and changed nothing: the model "fixed" the bug by
    // replacing code with itself. A no-op is not a patch.
    return {
      ...empty,
      outcome: {
        kind: "NO_PATCH",
        responseChars: response.length,
      },
    };
  }

  return { patch, outcome: null, files };
}

// -------------------------------------------------------------- unified_diff

function viaUnifiedDiff(response: string): EditResult {
  const empty = { patch: null, files: {} };
  const patch = extractDiff(response);

  if (patch === null) {
    return { ...empty, outcome: { kind: "NO_PATCH", responseChars: response.length } };
  }

  const defects = validateDiff(patch);

  // Only the defects git treats as fatal (D13) stop the cell here. Everything
  // else goes to `git apply`, which is the authority — a validator that
  // pre-empted git would be substituting our judgement for the measurement.
  const fatal = defects.find(
    (d) =>
      d.reason === "no_file_header" ||
      d.reason === "hunk_count_mismatch" ||
      d.reason === "hunk_header_unparseable",
  );

  if (fatal) {
    return {
      ...empty,
      outcome: {
        kind: "MALFORMED",
        reason: fatal.reason,
        blockIndex: fatal.blockIndex,
        searchText: clip(fatal.searchText),
        nearestLine: null,
        detail: fatal.detail,
      },
    };
  }

  return { patch, outcome: null, files: {} };
}

export { parseSearchReplace, applyBlocks, findNormalisedMatch, stripFences } from "./searchReplace.ts";
export { extractDiff, validateDiff, diffFiles } from "./unified.ts";
export { toPatch, toUnifiedDiff, patchTargets } from "./toPatch.ts";
export type { SearchReplaceBlock } from "./searchReplace.ts";
export type { DiffDefect } from "./unified.ts";
