import { cn } from "@/lib/utils";

/**
 * The only way a number is rendered in this app.
 *
 * Mono, tabular, right-aligned by default. The rule it enforces -- a number is
 * never set in the sans -- is what makes columns of figures comparable at a
 * glance, and on a screen that is almost entirely numbers it does most of the
 * typographic work.
 *
 * Missing and zero are different things, and the difference is load-bearing:
 * R3 says an unrun cell is a hole, never a zero. A real zero prints `0`; a
 * missing value prints a grey dash at the same size, so it never reads as a
 * measurement and never reads as "loading".
 */
export function Figure({
  value,
  unit,
  align = "right",
  tone = "default",
  className,
  ...rest
}: {
  /** A number, a pre-formatted string, or null/undefined for "not measured". */
  value: number | string | null | undefined;
  unit?: string;
  align?: "left" | "right";
  tone?: "default" | "measure" | "muted";
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<"span">, "children">) {
  const missing = value === null || value === undefined;

  const text =
    typeof value === "number" ? value.toLocaleString("en-US") : value;

  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        align === "right" ? "text-right" : "text-left",
        missing
          ? "text-ink-muted"
          : tone === "measure"
            ? "text-measure"
            : tone === "muted"
              ? "text-ink-muted"
              : "text-ink",
        className,
      )}
      // A screen reader should hear "not measured", not "dash".
      aria-label={missing ? "not measured" : undefined}
      {...rest}
    >
      {missing ? "–" : text}
      {!missing && unit ? (
        <span className="text-ink-muted ml-0.5 font-sans text-[0.85em]">
          {unit}
        </span>
      ) : null}
    </span>
  );
}
