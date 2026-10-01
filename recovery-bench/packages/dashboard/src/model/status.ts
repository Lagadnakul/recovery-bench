/**
 * The status palette, as data.
 *
 * `DASHBOARD.md` §4 fixes the encoding and this module is the only place it is
 * written down:
 *
 *     hue        = what the cell tells you
 *     saturation = whether it tells you anything about the model at all
 *
 * The three outcomes satisfying `isInstrumentLimit()` share one grey token and
 * carry a hatch. That predicate exists in `@rb/core` precisely to say *this
 * cell is evidence about the harness, not about the model*. Painting a
 * provider's 429 in a failure colour would let it read as the model failing —
 * the misattribution D18 was written to prevent.
 *
 * The three `isFormatClass()` outcomes share one hue in three steps, because
 * that predicate groups exactly those three. `TRUNCATED` is deliberately NOT
 * among them (D18), which is why it is grey rather than a fourth ochre step.
 *
 * Nothing here reads a CSS variable. The tokens are names; `tokens.css` binds
 * them to values and `scripts/check_contrast.ts` proves those values are
 * legible. Keeping this module DOM-free is what lets `bun test` check the
 * mapping against the core predicates without a browser.
 */

import { OUTCOME_KINDS, type Outcome, type OutcomeKind } from "@rb/core";

/** Which of the five visual bands an outcome belongs to. */
export type Band = "good" | "alarm" | "format" | "silent" | "limit";

export interface Status {
  kind: OutcomeKind;
  band: Band;
  /** CSS custom-property name for the fill, bound in `tokens.css`. */
  token: string;
  /**
   * The glyph colour for THIS fill.
   *
   * Not a constant: white clears 4.5:1 on the dark end of the ramp and reaches
   * only 3.53:1 on the lightest ochre step, so the mid-tone fills take the ink
   * colour instead. `scripts/check_contrast.ts` reads this field and checks
   * the pair the grid actually draws.
   */
  onToken: "--on-status" | "--on-status-ink";
  /** Single character drawn in a grid cell. Never the only signal. */
  glyph: string;
  /** What a reader is told. Plain words, not the enum (DASHBOARD.md §10). */
  label: string;
  /** Diagonal hatch, so instrument limits are distinguishable without colour. */
  hatched: boolean;
}

/**
 * One entry per kind, in the order `OUTCOME_KINDS` declares them.
 *
 * Kept as a literal record rather than derived from the predicates, so that a
 * change to either side has to collide with the other. `tests/dashboardStatus.test.ts`
 * asserts the two agree — if a tenth outcome is added, or `isFormatClass`
 * changes its mind, that test fails rather than the palette silently drifting.
 */
export const STATUS: Record<OutcomeKind, Status> = {
  APPLIED: {
    kind: "APPLIED",
    band: "good",
    token: "--st-good",
    onToken: "--on-status",
    glyph: "A",
    label: "patch applied",
    hatched: false,
  },
  CONTAMINATED: {
    kind: "CONTAMINATED",
    band: "alarm",
    token: "--st-alarm",
    onToken: "--on-status",
    glyph: "C",
    label: "too close to the gold patch",
    hatched: false,
  },
  MALFORMED: {
    kind: "MALFORMED",
    band: "format",
    token: "--st-format-3",
    onToken: "--on-status",
    glyph: "M",
    label: "patch could not be parsed",
    hatched: false,
  },
  APPLY_FAIL: {
    kind: "APPLY_FAIL",
    band: "format",
    token: "--st-format-2",
    onToken: "--on-status",
    glyph: "F",
    label: "patch never applied",
    hatched: false,
  },
  NO_PATCH: {
    kind: "NO_PATCH",
    band: "format",
    token: "--st-format-1",
    // The lightest ochre step: white sits at 3.53:1 on it, so the glyph is ink.
    onToken: "--on-status-ink",
    glyph: "N",
    label: "no patch in the response",
    hatched: false,
  },
  NO_OUTPUT: {
    kind: "NO_OUTPUT",
    band: "silent",
    token: "--st-silent",
    onToken: "--on-status",
    glyph: "·",
    label: "model returned nothing",
    hatched: false,
  },
  TRUNCATED: {
    kind: "TRUNCATED",
    band: "limit",
    token: "--st-limit",
    onToken: "--on-status-ink",
    glyph: "T",
    label: "cut off by our token ceiling",
    hatched: true,
  },
  BUDGET_STOP: {
    kind: "BUDGET_STOP",
    band: "limit",
    token: "--st-limit",
    onToken: "--on-status-ink",
    glyph: "B",
    label: "stopped by our budget",
    hatched: true,
  },
  PROVIDER_ERROR: {
    kind: "PROVIDER_ERROR",
    band: "limit",
    token: "--st-limit",
    onToken: "--on-status-ink",
    glyph: "E",
    label: "provider error",
    hatched: true,
  },
};

export function statusOf(kind: OutcomeKind): Status {
  return STATUS[kind];
}

/** Display order: good first, then what the model did, then what we did to it. */
export const BAND_ORDER: readonly Band[] = ["good", "alarm", "format", "silent", "limit"];

export const ORDERED_KINDS: readonly OutcomeKind[] = [...OUTCOME_KINDS].sort((a, b) => {
  const d = BAND_ORDER.indexOf(STATUS[a].band) - BAND_ORDER.indexOf(STATUS[b].band);
  return d !== 0 ? d : a.localeCompare(b);
});

/** Human text for the band, used as a legend group heading. */
export const BAND_LABEL: Record<Band, string> = {
  good: "applied",
  alarm: "validity threat",
  format: "format-class failure",
  silent: "no response",
  limit: "measured nothing — our limit, not the model's",
};

/**
 * The evidence the outcome carries, as one line of prose.
 *
 * Every `Outcome` variant stores why it was classified the way it was — the
 * property the original code lacked. This renders that payload instead of
 * discarding it, so a reader never has to open the JSONL to learn why a cell
 * failed.
 */
export function reasonOf(o: Outcome): string {
  switch (o.kind) {
    case "APPLIED":
      return o.filesChanged.length === 0
        ? "applied cleanly"
        : `applied cleanly to ${o.filesChanged.join(", ")}`;
    case "CONTAMINATED":
      return `similarity ${o.similarity.toFixed(2)} against the gold patch, over the ${o.threshold.toFixed(2)} threshold`;
    case "MALFORMED":
      return o.detail || o.reason.replace(/_/g, " ");
    case "APPLY_FAIL":
      return o.gitStderr.trim().split("\n")[0] ?? "git refused the patch";
    case "NO_PATCH":
      return `${o.responseChars.toLocaleString()} characters of response, no patch in it`;
    case "NO_OUTPUT":
      return o.detail || "empty response";
    case "PROVIDER_ERROR":
      return `${o.status === null ? "no status" : `HTTP ${o.status}`} — ${o.reason}${
        o.retries > 0 ? ` (after ${o.retries} ${o.retries === 1 ? "retry" : "retries"})` : ""
      }`;
    case "BUDGET_STOP":
      return `${o.tokensUsed.toLocaleString()} of ${o.ceiling.toLocaleString()} tokens spent — no request was sent`;
    case "TRUNCATED":
      return `${o.completionTokens.toLocaleString()} of ${o.maxTokens.toLocaleString()} tokens, finish reason ${o.finishReason}, ${o.contentChars} visible characters`;
  }
}
