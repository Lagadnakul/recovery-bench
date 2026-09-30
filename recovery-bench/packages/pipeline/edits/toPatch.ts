/**
 * Programmatic unified-diff generation.
 *
 * This is the fairness retrofit, in code. Nakul's finding was that his weaker
 * model failed on *patch format*, not on reasoning: it could describe the right
 * fix but could not hand-write a unified diff with correct `@@` line numbers.
 * The retrofit asks the model for SEARCH/REPLACE blocks — which need no line
 * arithmetic — and then computes the diff here, where arithmetic is free.
 *
 * So this file carries the study's load-bearing assumption: **that jsdiff's
 * output is something `git apply` accepts.** `doctor` proves it before any other
 * code runs (ARCHITECTURE §6, step 1). If this were wrong and undetected, every
 * APPLY_FAIL in the results would be an artefact of our tooling rather than a
 * property of the model — which is exactly the confound the thesis identified in
 * someone else's work.
 */

import { createTwoFilesPatch } from "diff";

export interface FileEdit {
  /** Repo-relative path, no leading slash and no `a/` prefix. */
  path: string;
  before: string;
  after: string;
}

/**
 * Emits a git-applicable unified diff for one file.
 *
 * `git apply` expects `a/`/`b/` path prefixes (the default `-p1`), so they are
 * added here rather than left to the caller. jsdiff's `Index:` preamble is not
 * emitted by `createTwoFilesPatch`, which is what we want — git tolerates it but
 * it is noise.
 */
export function toUnifiedDiff(edit: FileEdit, contextLines = 3): string {
  if (edit.before === edit.after) return "";

  const patch = createTwoFilesPatch(
    `a/${edit.path}`,
    `b/${edit.path}`,
    edit.before,
    edit.after,
    undefined, // no `\told-header` timestamp — git ignores it, readers don't
    undefined,
    { context: contextLines },
  );

  // jsdiff prefixes a bare `====…` rule — the underline belonging to an `Index:`
  // line it does not emit when the two filenames differ. git treats it as leading
  // junk and ignores it, but other diff parsers do not, so drop it.
  const body = patch.replace(/^={10,}\n/, "");

  // Normalise the terminator so concatenating per-file diffs cannot put a `---`
  // or `@@` on a shared line.
  return body.endsWith("\n") ? body : body + "\n";
}

/** Concatenates per-file diffs into one patch, in stable path order. */
export function toPatch(edits: FileEdit[], contextLines = 3): string {
  return edits
    .filter((e) => e.before !== e.after)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((e) => toUnifiedDiff(e, contextLines))
    .join("");
}

/** Files a patch claims to touch, read off its `+++ b/…` lines. */
export function patchTargets(patch: string): string[] {
  return patch
    .split("\n")
    .filter((l) => l.startsWith("+++ "))
    .map((l) => l.slice(4).replace(/^b\//, "").split("\t")[0] ?? "")
    .filter((p) => p.length > 0 && p !== "/dev/null");
}
