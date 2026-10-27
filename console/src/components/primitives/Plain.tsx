import { cn } from "@/lib/utils";
import { GLOSSARY, type TermKey } from "@/model/glossary";

/**
 * The plain-language layer.
 *
 * The console is read by three people with nothing in common: a supervisor who
 * wants the statistics, an examiner who wants the argument, and the student who
 * has to defend it in a viva. A line like `b = 19, c = 0, p = 3.8e-6` serves
 * exactly one of them.
 *
 * So the rule across every screen is: **the plain sentence is the primary text
 * and the notation is the receipt.** Not a tooltip, not an expandable, not an
 * info icon -- hover does not exist on a projector, and a caveat behind a click
 * is a caveat nobody read. The sentence is always on screen; the notation sits
 * under it in mono for the reader who wants to check the arithmetic.
 */

/**
 * A restatement in ordinary words, directly beneath the figure it explains.
 *
 * Set at body size, not small: this is the text most readers will actually
 * read, and shrinking it says the opposite.
 */
export function Plain({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // `overflow-wrap: anywhere` is a guard, not a style. A long unbroken
    // figure -- "1 in 13,000,000,..." with no spaces and no break opportunity,
    // since browsers do not wrap on commas -- otherwise widens the whole page
    // and introduces horizontal scroll on every screen below it.
    <p
      className={cn(
        "text-ink max-w-prose text-body [overflow-wrap:anywhere]",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * The notation, demoted to what it is: the audit trail under a claim already
 * made in words. Never the only statement of a result.
 */
export function Receipt({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-ink-muted mt-1 font-mono text-label tabular-nums [overflow-wrap:anywhere]",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * A glossary term, inline.
 *
 * Renders the plain name first and the notation second -- "retry threshold (θ)"
 * -- so the symbol is introduced by its meaning every time it appears, rather
 * than assumed. `title` gives the full definition on hover for a reader at a
 * desk, and the screen's term list gives it to everyone else.
 */
export function Term({
  k,
  of,
  className,
}: {
  k: TermKey;
  /** Override the displayed name, e.g. a plural or a sentence-case variant. */
  of?: string;
  className?: string;
}) {
  const entry = GLOSSARY[k];
  return (
    <span
      title={entry.plain}
      className={cn(
        "decoration-rule-strong underline decoration-dotted underline-offset-2",
        className,
      )}
    >
      {of ?? entry.term}
      {entry.symbol ? (
        <span className="text-ink-muted ml-1 font-mono text-[0.9em]">
          ({entry.symbol})
        </span>
      ) : null}
    </span>
  );
}

/**
 * The terms used on this screen, defined in full at the bottom of it.
 *
 * Per-screen rather than one global page, because a reader meets a word in the
 * middle of an argument and should not have to leave the argument to look it
 * up. The definitions come from the shared record, so the same word cannot be
 * defined two ways in two places.
 */
export function TermList({
  keys,
  title = "Words used on this screen",
}: {
  keys: readonly TermKey[];
  title?: string;
}) {
  // De-duplicated and stably ordered: a screen listing a term twice looks like
  // two different terms at a glance.
  const unique = [...new Set(keys)];
  return (
    <section className="mt-10">
      <h2 className="text-ink text-h2">{title}</h2>
      <dl className="border-rule mt-3 grid gap-x-8 border-t sm:grid-cols-2">
        {unique.map((k) => {
          const entry = GLOSSARY[k];
          return (
            <div key={k} className="border-rule border-b py-2.5">
              <dt className="text-ink text-small font-medium">
                {entry.term}
                {entry.symbol ? (
                  <span className="text-ink-muted ml-1.5 font-mono text-label">
                    {entry.symbol}
                  </span>
                ) : null}
              </dt>
              <dd className="text-ink-muted mt-0.5 max-w-prose text-small">
                {entry.plain}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/**
 * "How to read this" -- the orientation block at the top of every screen.
 *
 * Answers three questions before any figure is shown: what is being asked, what
 * you are looking at, and what would change your mind. A reader who has those
 * three cannot misread the chart, and a reader who does not have them usually
 * will.
 */
export function ReadThis({
  question,
  children,
}: {
  /** The one question this screen answers, as a question. */
  question: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-rule bg-surface-sunk rounded-panel mt-6 border p-4">
      <h2 className="text-ink text-small font-medium">
        How to read this screen
      </h2>
      <p className="text-ink mt-2 max-w-prose text-body">
        <span className="text-ink-muted">The question:</span> {question}
      </p>
      <div className="text-ink-muted mt-2 flex max-w-prose flex-col gap-2 text-body">
        {children}
      </div>
    </section>
  );
}
