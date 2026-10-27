import { cn } from "@/lib/utils";

/**
 * The four failure classes, as marks. One source of truth for every screen.
 *
 * The classes cannot be four hues, because the figures are printed in a journal
 * in greyscale. So they separate by **value plus texture**, and each texture
 * carries meaning rather than just telling two things apart:
 *
 *   FORMAT  solid, light      the patch never applied — a surface failure
 *   LOGIC   45° hatch, dark   it applied and the thinking was wrong; something
 *                             underneath did not work
 *   BROKEN  grey cross-hatch  measures the INSTRUMENT, not the model. Deliberately
 *                             outside the accent hue, so it never reads as a result
 *   LOST    dotted            the trajectory stopped going anywhere
 *
 * BROKEN being greyscale is the important one. D18's rule is that an instrument
 * limit must never be folded into a failure rate, and a mark in the same hue
 * family as the real classes invites exactly that mistake.
 */

export const FAILURE_CLASSES = ["FORMAT", "LOGIC", "BROKEN", "LOST"] as const;
export type FailureClass = (typeof FAILURE_CLASSES)[number];

export const CLASS_LABEL: Record<FailureClass, string> = {
  FORMAT: "Format",
  LOGIC: "Logic",
  BROKEN: "Broken",
  LOST: "Lost",
};

export const CLASS_MEANING: Record<FailureClass, string> = {
  FORMAT: "the patch never applied",
  LOGIC: "the patch applied, the test still failed",
  BROKEN: "the instrument failed, not the model",
  LOST: "the trajectory stopped making progress",
};

/** The same four meanings for a reader who has never met the taxonomy. */
export const CLASS_PLAIN: Record<FailureClass, string> = {
  FORMAT:
    "The model wrote something the repository could not use at all. A mechanical mistake, not a misunderstanding.",
  LOGIC:
    "The patch was accepted and the bug was still there. The model understood the format and misunderstood the problem.",
  BROKEN:
    "The tools failed, not the model. Nothing about the model's ability can be read from these.",
  LOST: "The attempt stopped getting anywhere — going round in circles.",
};

const PATTERN_ID: Record<FailureClass, string | null> = {
  FORMAT: null, // solid
  LOGIC: "cm-hatch-logic",
  BROKEN: "cm-cross-broken",
  LOST: "cm-dots-lost",
};

const SOLID: Record<FailureClass, string> = {
  FORMAT: "var(--color-class-format)",
  LOGIC: "var(--color-class-logic)",
  BROKEN: "var(--color-rule-strong)",
  LOST: "var(--color-ink-muted)",
};

/**
 * The flat CSS colour for a class, for HTML elements.
 *
 * Separate from `classFill` on purpose: that one returns `url(#cm-hatch-logic)`
 * for the patterned classes, which is meaningless as a CSS `background` and
 * fails silently to transparent. Anything that is not an SVG shape wants this.
 */
export function classColor(cls: FailureClass): string {
  return SOLID[cls];
}

/**
 * The SVG fill for a class. Render `<ClassMarkDefs />` once on any page that
 * uses this, or the pattern references resolve to nothing and the marks vanish.
 */
export function classFill(cls: FailureClass): string {
  const id = PATTERN_ID[cls];
  return id ? `url(#${id})` : SOLID[cls];
}

/** The flat colour for a class, for strokes, text and 1px marks too small to hatch. */
export function classStroke(cls: FailureClass): string {
  return SOLID[cls];
}

/**
 * The pattern definitions. Include once per page that draws class marks.
 * Patterns are in `userSpaceOnUse` so the hatch stays the same physical
 * density whatever size the mark is -- a hatch that scales with its shape
 * reads as a different texture at a different size.
 */
export function ClassMarkDefs() {
  return (
    <svg aria-hidden width={0} height={0} className="absolute">
      <defs>
        <pattern
          id="cm-hatch-logic"
          patternUnits="userSpaceOnUse"
          width={4}
          height={4}
          patternTransform="rotate(45)"
        >
          <rect width={4} height={4} fill="var(--color-surface)" />
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={4}
            stroke="var(--color-class-logic)"
            strokeWidth={2}
          />
        </pattern>

        <pattern
          id="cm-cross-broken"
          patternUnits="userSpaceOnUse"
          width={5}
          height={5}
        >
          <rect width={5} height={5} fill="var(--color-surface)" />
          <path
            d="M0 0L5 5M5 0L0 5"
            stroke="var(--color-rule-strong)"
            strokeWidth={0.9}
          />
        </pattern>

        <pattern
          id="cm-dots-lost"
          patternUnits="userSpaceOnUse"
          width={4}
          height={4}
        >
          <rect width={4} height={4} fill="var(--color-surface)" />
          <circle cx={2} cy={2} r={0.9} fill="var(--color-ink-muted)" />
        </pattern>
      </defs>
    </svg>
  );
}

/**
 * An inline swatch, for legends and table cells. Carries the label as text, so
 * the mark is never the only channel -- texture and value help a reader scan,
 * but they are not how anyone is asked to identify a class.
 */
export function ClassMark({
  cls,
  showLabel = true,
  className,
}: {
  cls: FailureClass;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <svg
        aria-hidden
        width={10}
        height={10}
        className="shrink-0"
        style={{ shapeRendering: "crispEdges" }}
      >
        <rect
          width={10}
          height={10}
          fill={classFill(cls)}
          stroke={classStroke(cls)}
          strokeWidth={1}
        />
      </svg>
      {showLabel ? (
        <span className="text-small text-ink">{CLASS_LABEL[cls]}</span>
      ) : (
        <span className="sr-only">{CLASS_LABEL[cls]}</span>
      )}
    </span>
  );
}
