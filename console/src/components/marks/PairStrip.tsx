import { Figure } from "@/components/primitives/Figure";
import { REJECTION_FLOOR } from "@/model/derive";
import { chanceInWords, strengthInWords } from "@/model/glossary";

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
  /** The two things being compared, named. Used in the plain-language sentence. */
  methodA: string;
  methodB: string;
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
          No attempts could be matched up here, so nothing was compared. That is
          different from finding no difference — this test was never run.
        </p>
      ) : (
        <>
          <div
            className="border-rule relative mt-1.5 flex w-full overflow-hidden border"
            style={{ height: H }}
            role="img"
            aria-label={`${test.b} favour ${test.methodA}, ${test.c} favour ${test.methodB}, ${test.concordant} tied and discarded, of ${total} pairs`}
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

          {/* The sentence first. The notation underneath is the receipt. */}
          <p className="text-ink mt-1.5 text-small">
            Of {total} matched attempts, {test.n} disagreed:{" "}
            <strong>{test.b}</strong> where {test.methodA} worked and{" "}
            {test.methodB} did not, <strong>{test.c}</strong> the other way
            round. The remaining {test.concordant} came out the same both ways
            and tell us nothing.{" "}
            {test.canReject
              ? `${strengthInWords(test.p, true)} — a split this lopsided happens by luck ${chanceInWords(test.p)}.`
              : `Fewer than ${REJECTION_FLOOR} disagreements, so this test cannot give an answer either way.`}
          </p>
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
export function PairStripLegend({
  methodA,
  methodB,
}: {
  methodA: string;
  methodB: string;
}) {
  return (
    <div className="text-ink-muted flex flex-col gap-1 text-small">
      <p>
        <span className="bg-measure mr-1.5 inline-block h-2 w-2 align-middle" />
        {methodA} won ·
        <span className="bg-class-format mx-1.5 inline-block h-2 w-2 align-middle" />
        {methodB} won ·
        <span className="bg-surface-sunk border-rule mx-1.5 inline-block h-2 w-2 border align-middle" />
        same result both ways, thrown away by the test
      </p>
      <p>
        Each bar is every matched attempt, so you can see how much of it the
        test actually used. The thin vertical line marks {REJECTION_FLOOR}{" "}
        disagreements — below that, this test cannot return an answer however
        lopsided the result looks.
      </p>
    </div>
  );
}
