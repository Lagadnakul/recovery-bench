import { cn } from "@/lib/utils";

/**
 * A bounded region of the canvas. Surface, one hairline, 6px radius, and no
 * shadow -- depth is not information here, so nothing floats.
 *
 * `title` is optional, and when a panel has one it keeps it even when empty:
 * an empty section that collapses to nothing tells the reader less than an
 * empty section that says what is missing.
 */
export function Panel({
  title,
  aside,
  sunk = false,
  className,
  children,
  ...rest
}: {
  title?: React.ReactNode;
  /** Right-aligned in the header -- a count, a unit, a control. */
  aside?: React.ReactNode;
  /** For a panel nested inside another panel, where white on white would vanish. */
  sunk?: boolean;
  className?: string;
  children?: React.ReactNode;
} & React.ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "border-rule rounded-panel border",
        sunk ? "bg-surface-sunk" : "bg-surface",
        className,
      )}
      {...rest}
    >
      {title !== undefined || aside !== undefined ? (
        <header className="border-rule flex items-baseline justify-between gap-3 border-b px-3 py-2">
          <h2 className="text-h2 text-ink">{title}</h2>
          {aside ? <div className="text-small text-ink-muted">{aside}</div> : null}
        </header>
      ) : null}
      <div className="p-3">{children}</div>
    </section>
  );
}

/**
 * The empty state for a panel's body. Keeps the frame, states what is absent
 * in one sentence, and never draws a picture about it.
 */
export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-small text-ink-muted max-w-prose py-6">{children}</p>
  );
}
