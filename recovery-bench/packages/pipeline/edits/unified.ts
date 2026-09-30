/**
 * The raw unified-diff path — the control condition.
 *
 * Kept so the ablation is one config field (`edit.formats`), and so the
 * pre-retrofit behaviour is reproducible rather than merely described.
 *
 * ## `validateDiff` is a pre-check, not a verdict
 *
 * `git apply` remains the authority. Step 1 (D13) measured that git is *lenient*
 * about things this validator flags — it forgives prose before the header and a
 * wildly wrong start line — and *strict* about things only git can see, namely
 * whether the context text exists in the real file.
 *
 * So the validator's job is explanation, not judgement. It answers "which defect
 * does this patch have?" for patches git rejected, and its disagreements with git
 * are themselves data: a patch that fails validation but applies anyway tells us
 * the defect was cosmetic.
 */

import type { MalformedReason } from "@rb/core";
import { stripFences } from "./searchReplace.ts";

export interface DiffDefect {
  reason: MalformedReason;
  /** Hunk index, or -1 for a file-level defect. */
  blockIndex: number;
  /** The offending hunk header, or "" at file level. */
  searchText: string;
  detail: string;
}

const FILE_HEADER = /^--- /m;
const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const ANY_HUNK_LINE = /^@@/;

/**
 * Pulls a diff out of a model response.
 *
 * Deliberately as lenient as `parseSearchReplace`: both strip fences and both
 * tolerate surrounding prose. **The symmetry is load-bearing.** If this extractor
 * were stricter, arm A5's comparison would measure our parsing rather than the
 * models, which is exactly the confound the thesis criticises in other work.
 * `tests/editsSymmetry.test.ts` asserts it directly.
 */
export function extractDiff(response: string): string | null {
  const text = stripFences(response).replace(/\r\n/g, "\n");

  // Prefer a proper file header; fall back to a bare hunk so that a headerless
  // diff reaches `validateDiff` and is reported as `no_file_header` rather than
  // vanishing as NO_PATCH. Six of the archive's 51 real diffs are this shape, and
  // conflating "produced nothing" with "produced an unaddressed hunk" would hide
  // a distinct model behaviour.
  const start = text.search(FILE_HEADER) >= 0 ? text.search(FILE_HEADER) : text.search(/^@@ /m);
  if (start < 0) return null;

  const lines = text.slice(start).split("\n");

  // Find where the diff ends. Models very often close with a sentence — "This
  // should resolve the failing test." — and letting that into the body makes it
  // count as context lines, producing a `hunk_count_mismatch` that the model did
  // not commit. Left unfixed it would bias arm A5 against `unified_diff`, which
  // `tests/editsSymmetry.test.ts` catches.
  let end = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    if (!isDiffLine(lines[i]!)) {
      end = i;
      break;
    }
  }

  const body = trimTrailingBlanks(lines.slice(0, end));
  if (body.length === 0) return null;
  return body.join("\n") + "\n";
}

/** Lines that can legally appear in a unified diff. Anything else ends it. */
function isDiffLine(line: string): boolean {
  return (
    line === "" || // a blank context line whose trailing space was stripped
    line.startsWith(" ") ||
    line.startsWith("+") ||
    line.startsWith("-") ||
    line.startsWith("@@") ||
    line.startsWith("\\") ||
    line.startsWith("diff --git") ||
    line.startsWith("index ")
  );
}

/**
 * Drops blank lines at the end — but keeps any the final hunk's declared counts
 * still need.
 *
 * Both halves matter. Without the trim, prose separated by a blank line leaves
 * that blank counted as context. Without the add-back, a diff that legitimately
 * ends on blank context lines would be truncated and reported as mismatched. The
 * declared counts decide between the two, and where they are themselves wrong the
 * shortfall survives to be reported — which is the defect we want to measure.
 */
function trimTrailingBlanks(lines: string[]): string[] {
  let blanks = 0;
  while (blanks < lines.length && lines[lines.length - 1 - blanks] === "") blanks += 1;
  if (blanks === 0) return lines;

  const trimmed = lines.slice(0, lines.length - blanks);

  // Counts of the last hunk in the trimmed body, and what its header declared.
  let declaredOld = 0;
  let declaredNew = 0;
  let oldCount = 0;
  let newCount = 0;
  for (const line of trimmed) {
    const m = line.match(HUNK);
    if (m) {
      declaredOld = Number(m[2] ?? 1);
      declaredNew = Number(m[4] ?? 1);
      oldCount = 0;
      newCount = 0;
      continue;
    }
    if (line.startsWith("\\") || line.startsWith("--- ") || line.startsWith("+++ ")) continue;
    if (line.startsWith("-")) oldCount += 1;
    else if (line.startsWith("+")) newCount += 1;
    else {
      oldCount += 1;
      newCount += 1;
    }
  }

  const needed = Math.max(declaredOld - oldCount, declaredNew - newCount, 0);
  return [...trimmed, ...Array(Math.min(blanks, needed)).fill("")];
}

/**
 * Structural defects detectable without the source file.
 *
 * Two subtleties that a first attempt at this got wrong, both recorded because
 * they changed the numbers:
 *
 *  1. `text.split("\n")` leaves a trailing `""` for a newline-terminated patch.
 *     Counting it as a context line inflates every hunk body by one and reports
 *     a mismatch on *every* patch — including the programmatically generated ones
 *     that are known to apply. The trailing element must be dropped.
 *  2. A blank context line may legitimately arrive as `""` rather than `" "`,
 *     because editors and transports strip trailing whitespace. git tolerates
 *     this, so `""` counts as context.
 */
export function validateDiff(patch: string): DiffDefect[] {
  const defects: DiffDefect[] = [];
  const lines = patch.split("\n");
  if (lines.at(-1) === "") lines.pop(); // (1)

  if (!FILE_HEADER.test(patch)) {
    defects.push({
      reason: "no_file_header",
      blockIndex: -1,
      searchText: "",
      detail:
        "no `--- a/path` header, so git cannot know which file to patch; " +
        "the hunks are unaddressed",
    });
  }

  let hunkIndex = -1;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!ANY_HUNK_LINE.test(line)) {
      i += 1;
      continue;
    }
    hunkIndex += 1;

    const m = line.match(HUNK);
    if (!m) {
      defects.push({
        reason: "hunk_header_unparseable",
        blockIndex: hunkIndex,
        searchText: line.slice(0, 120),
        detail: "hunk header does not match `@@ -a,b +c,d @@`",
      });
      i += 1;
      continue;
    }

    // An absent count means 1, per the unified-diff format.
    const declaredOld = Number(m[2] ?? 1);
    const declaredNew = Number(m[4] ?? 1);

    i += 1;
    let oldCount = 0;
    let newCount = 0;
    while (i < lines.length && !ANY_HUNK_LINE.test(lines[i]!) && !lines[i]!.startsWith("--- ")) {
      const l = lines[i]!;
      if (l.startsWith("\\")) {
        // "\ No newline at end of file" is a marker, not a line of content.
      } else if (l.startsWith("-")) {
        oldCount += 1;
      } else if (l.startsWith("+")) {
        newCount += 1;
      } else {
        oldCount += 1; // " " or "" → context  (2)
        newCount += 1;
      }
      i += 1;
    }

    if (oldCount !== declaredOld || newCount !== declaredNew) {
      defects.push({
        reason: "hunk_count_mismatch",
        blockIndex: hunkIndex,
        searchText: line,
        detail:
          `header declares ${declaredOld},${declaredNew} lines but the body has ` +
          `${oldCount},${newCount} — git reports this as "corrupt patch" (D13)`,
      });
    }
  }

  if (hunkIndex < 0) {
    defects.push({
      reason: "hunk_header_unparseable",
      blockIndex: -1,
      searchText: "",
      detail: "no `@@` hunk header anywhere in the patch",
    });
  }

  return defects;
}

/** Files a diff addresses, for reporting alongside a defect list. */
export function diffFiles(patch: string): string[] {
  return [
    ...new Set(
      patch
        .split("\n")
        .filter((l) => l.startsWith("--- "))
        .map((l) => (l.slice(4).split("\t")[0] ?? "").replace(/^a\//, ""))
        .filter((p) => p.length > 0 && p !== "/dev/null"),
    ),
  ];
}
