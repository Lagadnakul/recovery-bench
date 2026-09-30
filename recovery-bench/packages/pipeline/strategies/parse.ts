/**
 * Splitting a model response into its declared sections.
 *
 * The prompts demand an exact shape:
 *
 *     REFLECTION:   (l2 only)      2-4 sentences
 *     DIAGNOSIS:    (l2.5 only)    2-4 sentences
 *     EXPLANATION:  (all)          1-3 sentences
 *     EDITS:        (all)          SEARCH/REPLACE blocks
 *
 * Two reasons this is a separate module from `edits/searchReplace.ts`.
 *
 * First, whether the model *produced* a reflection is a finding in its own
 * right. A Reflection-only cell whose response has no REFLECTION section did
 * not run the condition it claims to, and the original code could not tell:
 * it searched the whole response for SEARCH/REPLACE markers and ignored the
 * prose entirely.
 *
 * Second, section extraction must not corrupt the edit body. `EDITS:` is last
 * in every template, so everything after it belongs to the blocks — including
 * any line that happens to look like a header. Parsing headers greedily over
 * the whole response would truncate a patch that legitimately contains the
 * word `EXPLANATION:` in a docstring.
 */

export type Section =
  | "REFLECTION"
  | "DIAGNOSIS"
  | "EXPLANATION"
  | "EDITS"
  | "PATCH";

/**
 * The header that ends the prose and begins the edit body.
 *
 * `EDITS:` in the retrofitted SEARCH/REPLACE prompts, `PATCH:` in the original
 * unified-diff baseline prompt. Both are last in their template, so whichever
 * appears first is the boundary.
 */
const EDIT_SECTIONS: readonly Section[] = ["EDITS", "PATCH"];

const PROSE_SECTIONS: readonly Section[] = ["REFLECTION", "DIAGNOSIS", "EXPLANATION"];

export interface ParsedResponse {
  reflection: string | null;
  diagnosis: string | null;
  explanation: string | null;
  /** Everything after `EDITS:`, unmodified. Null when the header is absent. */
  edits: string | null;
  /** Sections found, in the order they appeared. */
  found: Section[];
  /** True when neither `EDITS:` nor `PATCH:` appears; the body may still be there. */
  missingEditsHeader: boolean;
}

/**
 * Finds a section header at the start of a line.
 *
 * Anchored to line starts so a mention inside prose or code is not mistaken
 * for a header. Trailing whitespace after the colon is tolerated because
 * models add it; leading whitespace is not, because an indented `EDITS:` is
 * inside a code block, not a header.
 */
function headerIndex(text: string, section: Section): number {
  const re = new RegExp(`^${section}:[ \\t]*$|^${section}:[ \\t]*(?=\\S)`, "m");
  const m = re.exec(text);
  return m ? m.index : -1;
}

export function parseResponse(raw: string): ParsedResponse {
  const text = raw.replace(/\r\n/g, "\n");

  // The edit header terminates the prose. Everything past it is edit body and
  // is never scanned for further headers.
  let editsAt = -1;
  let editHeader: Section | null = null;
  for (const h of EDIT_SECTIONS) {
    const at = headerIndex(text, h);
    if (at !== -1 && (editsAt === -1 || at < editsAt)) {
      editsAt = at;
      editHeader = h;
    }
  }
  const proseRegion = editsAt === -1 ? text : text.slice(0, editsAt);
  const editBody =
    editsAt === -1 || editHeader === null
      ? null
      : text.slice(editsAt).replace(new RegExp(`^${editHeader}:[ \\t]*\\n?`), "");

  const positions: { section: Section; at: number }[] = [];
  for (const s of PROSE_SECTIONS) {
    const at = headerIndex(proseRegion, s);
    if (at !== -1) positions.push({ section: s, at });
  }
  positions.sort((a, b) => a.at - b.at);

  const body = (i: number): string => {
    const start = positions[i]!.at;
    const end = i + 1 < positions.length ? positions[i + 1]!.at : proseRegion.length;
    return proseRegion
      .slice(start, end)
      .replace(new RegExp(`^${positions[i]!.section}:[ \\t]*`), "")
      .trim();
  };

  const out: ParsedResponse = {
    reflection: null,
    diagnosis: null,
    explanation: null,
    edits: editBody,
    found: positions.map((p) => p.section),
    missingEditsHeader: editsAt === -1,
  };

  for (let i = 0; i < positions.length; i++) {
    const value = body(i);
    switch (positions[i]!.section) {
      case "REFLECTION":
        out.reflection = value;
        break;
      case "DIAGNOSIS":
        out.diagnosis = value;
        break;
      case "EXPLANATION":
        out.explanation = value;
        break;
    }
  }
  if (editHeader !== null) out.found.push(editHeader);

  return out;
}

/**
 * The text to hand the edit layer.
 *
 * When `EDITS:` is missing the whole response is returned rather than nothing.
 * The blocks are frequently present without the header, and refusing to look
 * would record `NO_PATCH` for a response that contained a perfectly good
 * patch — misattributing a formatting slip as a failure to propose an edit.
 * `missingEditsHeader` stays on the parse so the looseness is visible.
 */
export function editText(parsed: ParsedResponse, raw: string): string {
  return parsed.edits ?? raw;
}

/**
 * Whether the response honoured the reasoning section its condition demanded.
 *
 * Not a validity check on content — nothing here judges whether a reflection
 * is any good. It records only whether the section exists, which is the
 * minimum evidence that the condition was actually exercised.
 */
export function honouredCondition(
  parsed: ParsedResponse,
  condition:
    | "l0_baseline"
    | "l1_blind_retry"
    | "l2_reflection"
    | "l2_5_diagnose_revise",
): boolean {
  switch (condition) {
    case "l0_baseline":
    case "l1_blind_retry":
      // Neither asks for a reasoning section, only EXPLANATION.
      return true;
    case "l2_reflection":
      return parsed.reflection !== null && parsed.reflection.length > 0;
    case "l2_5_diagnose_revise":
      return parsed.diagnosis !== null && parsed.diagnosis.length > 0;
  }
}
