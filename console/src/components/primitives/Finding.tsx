import { cn } from "@/lib/utils";

/**
 * A screen's conclusion, stated under its title in full sentences.
 *
 * This is the component that decides whether the console reads as a report or
 * as a dashboard. Every screen answers one question, and the answer goes here
 * -- above the charts, in prose a professor can read in four seconds -- rather
 * than into a caption under a figure where it has to be hunted for.
 *
 * Keep it to two sentences. If it needs three, the screen is asking two
 * questions and should be two screens.
 */
export function Finding({
  children,
  stat,
  className,
}: {
  children: React.ReactNode;
  /** The one number the finding rests on, e.g. "p = 3.8e-6". */
  stat?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-prose", className)}>
      <p className="text-ink text-body [&_strong]:font-semibold">{children}</p>
      {stat ? (
        <p className="text-measure mt-1.5 font-mono text-small tabular-nums">
          {stat}
        </p>
      ) : null}
    </div>
  );
}
