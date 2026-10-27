import { Figure } from "@/components/primitives/Figure";
import { REJECTION_FLOOR } from "@/model/derive";

/**
 * One paired test, drawn as the pairs it actually used.
 *
 * The exact McNemar test throws away every concordant pair, which is the fact
 * most readers of a p-value never see. So the strip is scaled by TOTAL pairs
 * and the discarded majority is drawn -- faint, but drawn. A test reporting
 * p = 3.8e-6 from 19 of 60 pairs and one reporting it from 19 of 19 are
 * different claims, and the difference should not require reading the method.
 *
 * The 6-pair rejection floor is a tick on the same scale rather than a number
 * in prose: below 6 discordant pairs the rejection region is empty, so power is
 * not low, it is zero. a1 landing at 0 is finding 4 of the whole thesis.
 */

export type PairTest = {
  label: string;
  sub?: string;
  b: number;
  c: number;
  concordant: number;
  n: number;
  p: number;
  canReject: boolean;
  dropped: number;
};

const H = 14;

export function PairStrip({ test }: { test: PairTest }) {
  const total = test.n + test.concordant;
  const pct = (count: number) => (total ? (count / total) * 100 : 0);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-ink text-small">
          {test.label}
          {test.sub ? (
            <span className="text-ink-muted ml-1.5 text-label">{test.sub}</span>
          ) : null}
        </p>
        <Figure
          value={
            total === 0
              ? null
              : test.canReject
                ? test.p < 0.001
                  ? test.p.toExponential(1)
                  : test.p.toFixed(3)
                : "no test"
          }
          tone={test.canReject && test.p < 0.05 ? "measure" : "muted"}
          className="text-small"
        />
      </div>

      {total === 0 ? (
        <p className="text-ink-muted mt-1 text-small">
          No pairs formed. Not a null result — nothing was compared.
        </p>
      ) : (
        <>
          <div
            className="border-rule relative mt-1.5 flex w-full overflow-hidden border"
            style={{ height: H }}
            role="img"
            aria-label={`${test.b} favour the control, ${test.c} favour reflection, ${test.concordant} tied and discarded, of ${total} pairs`}
          >
            <div
              className="bg-measure"
              style={{ width: `${pct(test.b)}%` }}
              title={`b = ${test.b}`}
            />
            <div
              className="bg-class-format"
              style={{ width: `${pct(test.c)}%` }}
              title={`c = ${test.c}`}
            />
            <div
              className="bg-surface-sunk"
              style={{ width: `${pct(test.concordant)}%` }}
              title={`${test.concordant} concordant, discarded by the test`}
            />
            {/* The floor, on the same scale as the bars it judges. */}
            <div
              aria-hidden
              className="bg-ink absolute top-0 bottom-0 w-px"
              style={{ left: `${pct(REJECTION_FLOOR)}%` }}
            />
          </div>

          <p className="text-ink-muted mt-1 font-mono text-label tabular-nums">
            b={test.b} c={test.c} · {test.n} discordant of {total} pairs
            {test.dropped > 0 ? ` · ${test.dropped} dropped` : ""}
          </p>
        </>
      )}
    </div>
  );
}

/** The legend, stated once for a group of strips rather than on each. */
export function PairStripLegend() {
  return (
    <p className="text-ink-muted text-label">
      <span className="bg-measure mr-1 inline-block h-2 w-2 align-middle" />
      control won ·
      <span className="bg-class-format mx-1 inline-block h-2 w-2 align-middle" />
      reflection won ·
      <span className="bg-surface-sunk border-rule mx-1 inline-block h-2 w-2 border align-middle" />
      tied, discarded by the test · the vertical rule is the {REJECTION_FLOOR}
      -pair rejection floor
    </p>
  );
}
