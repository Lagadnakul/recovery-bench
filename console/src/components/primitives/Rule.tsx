import { cn } from "@/lib/utils";

/**
 * A hairline that carries a value.
 *
 * The distinction this component exists to hold: a `Rule` is a *measurement* --
 * a scale, a baseline, a rejection floor, a threshold -- and it is labelled
 * with the value it marks. A plain divider between two blocks is a border on
 * the block, not a Rule. If you reach for this without having a number to put
 * on it, you want a border.
 *
 * `variant="reference"` is dashed, for a value drawn for comparison rather than
 * measured on this axis -- a baseline carried over from another series, a floor
 * the data has to clear.
 */
export function Rule({
  value,
  label,
  variant = "scale",
  className,
}: {
  /** What the line marks. Rendered in mono, because it is a figure. */
  value?: string | number;
  label?: string;
  variant?: "scale" | "reference";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "h-px flex-1",
          variant === "reference"
            ? "border-rule-strong border-t border-dashed"
            : "bg-rule-strong",
        )}
      />
      {value !== undefined || label ? (
        <span className="text-label text-ink-muted flex shrink-0 items-baseline gap-1">
          {label ? <span>{label}</span> : null}
          {value !== undefined ? (
            <span className="font-mono tabular-nums">{value}</span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
