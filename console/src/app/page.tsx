// Phase 0 placeholder. It exists to prove three things in one screen: both
// fonts load, the width axis on Instrument Sans is reachable, and figures are
// tabular. Phase 1 replaces this with the primitives gallery.

const facts: [string, string][] = [
  ["Cells", "1,604"],
  ["Calls", "1,428"],
  ["Tokens", "18,102,295"],
  ["Arms", "6 of 6"],
  ["Refused by design", "130"],
];

export default function Phase0() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Recovery console
      </h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
        When should an AI coding agent stop retrying and ask a human? Six
        experimental arms, one finished sweep, and a stopping rule you can move
        with your hand.
      </p>

      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-5">
        {facts.map(([label, value]) => (
          <div key={label} className="bg-background px-3 py-2.5">
            <dt
              className="text-[11px] text-muted-foreground"
              style={{ fontStretch: "85%" }}
            >
              {label}
            </dt>
            <dd className="mt-1 font-mono text-sm tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-10 max-w-prose border-l-2 pl-3 text-xs leading-relaxed text-muted-foreground">
        APPLIED is patch-apply success, not a test pass. evidenceSource is none
        on all 1,604 live rows.
      </p>

      <p className="mt-10 font-mono text-xs text-muted-foreground">
        phase 0 — scaffold. next: tokens and primitives.
      </p>
    </main>
  );
}
