import { cn } from "@/lib/utils";

/**
 * A statement about what the data does and does not mean.
 *
 * There is no dismiss control and there will not be one. These are R1, R2 and
 * R3 from CONSOLE.md -- `APPLIED` is not `RESOLVED`; 130 refusals are not 46
 * errors; 32 cells never ran -- and a reviewer who finds one of them unstated
 * discounts the whole artifact. A caveat the viewer can close is a caveat the
 * viewer did not read.
 *
 * Quiet by design: a left rule, muted text, no icon, no tinted box. It has to
 * be impossible to miss and impossible to mistake for an alarm.
 */
export function Note({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "border-rule-strong text-ink-muted max-w-prose border-l-2 pl-3 text-small",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * The caption that must travel with any mark that was not measured.
 *
 * Screen 6's policy curves are the main case: the cells are real, the outcome
 * of applying a policy to them is not. Wording is fixed rather than a prop,
 * because the whole point is that it reads identically everywhere and cannot be
 * softened mark by mark.
 */
export function Illustrative({ className }: { className?: string }) {
  return (
    <p className={cn("text-ink-muted text-label italic", className)}>
      Expected shape, drawn to illustrate the claim — not measured data.
    </p>
  );
}
