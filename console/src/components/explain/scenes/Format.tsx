import type { BuildScene } from "@/components/explain/Act";

/**
 * Act 3 -- how you ask decides what you get.
 *
 * The first actual finding, after two acts of setup, and the easiest one in
 * the study to tell: the same models, on the same 60 bugs, succeed seven times
 * more often when asked to write their edit one way rather than the other.
 *
 * The scene has to do one thing the bars alone cannot: make it obvious that
 * **nothing about the model changed**. So it starts from a single prompt,
 * splits it into two identical copies, and changes exactly one word on one
 * side. Everything after that divergence is caused by that one word.
 *
 * The mechanism is shown rather than asserted. The losing format fails mostly
 * on `hunk_count_mismatch` -- the model miscounting how many lines its own
 * change touches -- which is arithmetic, not comprehension. That distinction
 * is the whole reason this result matters beyond the thesis.
 */

export type FormatData = {
  tasks: number;
  models: string[];
  quote: { rows: number; applied: number; rate: number };
  diff: { rows: number; applied: number; rate: number };
  /** How many times more often the winning format applied. */
  ratio: number;
  reasons: { label: string; count: number; share: number }[];
};

const W = 840;
const H = 330;

/** Pixel length of a 100% bar. Both bars share it, so the ratio is exact. */
const TRACK = 430;
const BAR_X = 250;

export function FormatScene({ data }: { data: FormatData }) {
  const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
  const topReason = data.reasons[0];

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full lg:max-w-208"
        role="img"
        aria-label={`The same models on the same ${data.tasks} bugs. Asked to quote the lines they want to change, ${pct(data.quote.rate)} of their patches were accepted. Asked to write a Git-style diff, ${pct(data.diff.rate)} were. ${data.ratio.toFixed(1)} times the difference, from the format alone.`}
      >
        {/* ── one prompt, split into two identical copies ─────────────── */}
        <g data-fmt="source">
          <rect
            x={8}
            y={128}
            width={120}
            height={54}
            fill="var(--color-surface)"
            stroke="var(--color-rule-strong)"
            shapeRendering="crispEdges"
          />
          <text x={68} y={150} textAnchor="middle" className="fill-ink text-[14px]">
            one bug
          </text>
          <text
            x={68}
            y={167}
            textAnchor="middle"
            className="fill-ink-muted text-[13px]"
          >
            one model
          </text>
        </g>

        {/* The split. Two branches, identical until the label changes. */}
        <g data-fmt="split" opacity={0}>
          <path
            d="M128 155 L168 155 L168 78 L206 78"
            fill="none"
            stroke="var(--color-rule-strong)"
            strokeWidth={1}
          />
          <path
            d="M128 155 L168 155 L168 236 L206 236"
            fill="none"
            stroke="var(--color-rule-strong)"
            strokeWidth={1}
          />
        </g>

        {/* ── the two instructions ────────────────────────────────────── */}
        <g data-fmt="ask-a" opacity={0}>
          <text x={206} y={62} className="fill-ink text-[14px]">
            &ldquo;Quote the lines you want to change.&rdquo;
          </text>
          <text x={206} y={78} className="fill-ink-muted text-[13px]">
            copy the old text, write the new text
          </text>
        </g>

        <g data-fmt="ask-b" opacity={0}>
          <text x={206} y={220} className="fill-ink text-[14px]">
            &ldquo;Write it the way Git does.&rdquo;
          </text>
          <text x={206} y={236} className="fill-ink-muted text-[13px]">
            count the lines, and get the count right
          </text>
        </g>

        {/* ── the result ──────────────────────────────────────────────── */}
        <g data-fmt="bar-a">
          <rect
            x={BAR_X}
            y={90}
            width={TRACK}
            height={30}
            fill="var(--color-surface-sunk)"
          />
          <rect
            data-fmt-fill-a
            x={BAR_X}
            y={90}
            width={TRACK * data.quote.rate}
            height={30}
            fill="var(--color-measure)"
          />
          <text
            data-fmt-pct-a
            x={BAR_X + TRACK * data.quote.rate - 10}
            y={111}
            textAnchor="end"
            className="fill-surface font-mono text-[17px] tabular-nums"
          >
            {pct(data.quote.rate)}
          </text>
          <text x={BAR_X} y={138} className="fill-ink-muted text-[13px]">
            {data.quote.applied} of {data.quote.rows} patches accepted
          </text>
        </g>

        <g data-fmt="bar-b">
          <rect
            x={BAR_X}
            y={248}
            width={TRACK}
            height={30}
            fill="var(--color-surface-sunk)"
          />
          <rect
            data-fmt-fill-b
            x={BAR_X}
            y={248}
            width={TRACK * data.diff.rate}
            height={30}
            fill="var(--color-rule-strong)"
          />
          <text
            data-fmt-pct-b
            x={BAR_X + TRACK * data.diff.rate + 10}
            y={269}
            className="fill-ink font-mono text-[17px] tabular-nums"
          >
            {pct(data.diff.rate)}
          </text>
          <text x={BAR_X} y={296} className="fill-ink-muted text-[13px]">
            {data.diff.applied} of {data.diff.rows} patches accepted
          </text>
        </g>

        {/* ── the gap, called out between the two bars ────────────────── */}
        <g data-fmt="gap" opacity={0}>
          <line
            x1={BAR_X + TRACK * data.diff.rate}
            x2={BAR_X + TRACK * data.diff.rate}
            y1={130}
            y2={244}
            stroke="var(--color-rule-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <line
            x1={BAR_X + TRACK * data.quote.rate}
            x2={BAR_X + TRACK * data.quote.rate}
            y1={124}
            y2={190}
            stroke="var(--color-rule-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <line
            x1={BAR_X + TRACK * data.diff.rate}
            x2={BAR_X + TRACK * data.quote.rate}
            y1={190}
            y2={190}
            stroke="var(--color-measure)"
            strokeWidth={1}
          />
          <text
            x={(BAR_X + TRACK * data.diff.rate + BAR_X + TRACK * data.quote.rate) / 2}
            y={184}
            textAnchor="middle"
            className="fill-measure text-[15px]"
          >
            {data.ratio.toFixed(1)}× more often
          </text>
          <text
            x={(BAR_X + TRACK * data.diff.rate + BAR_X + TRACK * data.quote.rate) / 2}
            y={206}
            textAnchor="middle"
            className="fill-ink-muted text-[13px]"
          >
            and the only thing that changed was the question
          </text>
        </g>
      </svg>

      <div className="flex w-full flex-col gap-3 lg:max-w-80">
        <p data-fmt="step-1" className="text-ink text-body">
          Same {data.tasks} bugs. Same models. Same instructions.
        </p>
        <p data-fmt="step-2" className="text-ink text-body">
          One difference: <strong>how the edit was to be written.</strong>{" "}
          Quote the lines you are changing, or write it the way Git does — which
          means counting line numbers correctly.
        </p>
        <p data-fmt="step-3" className="text-ink text-body">
          {pct(data.quote.rate)} of patches were usable one way.{" "}
          {pct(data.diff.rate)} the other way.
        </p>
        <p
          data-fmt="step-4"
          className="text-ink border-rule-strong border-l-2 pl-3 text-body"
        >
          <strong>
            This is the largest effect in the whole study, and it has nothing to
            do with how clever the model is.
          </strong>{" "}
          {topReason
            ? `${topReason.count} of the failures are the model miscounting how many lines its own change touches.`
            : ""}{" "}
          That is arithmetic, not understanding.
        </p>
        <p data-fmt="step-5" className="text-ink-muted text-small">
          Benchmarks that score models on fixing bugs usually fix one format and
          never say which. If the format alone moves the result{" "}
          {data.ratio.toFixed(1)}×, two published scores are not comparable
          unless they used the same one.
        </p>
        <p data-fmt="step-5" className="text-ink-muted text-small">
          As everywhere here, &ldquo;accepted&rdquo; means the repository
          applied the patch. It does not mean the bug was fixed.
        </p>
      </div>
    </div>
  );
}

export const buildFormat: BuildScene = (tl, scope) => {
  const q = <T extends Element>(sel: string) =>
    Array.from(scope.querySelectorAll<T>(sel));

  const split = q<SVGGElement>('[data-fmt="split"]')[0];
  const askA = q<SVGGElement>('[data-fmt="ask-a"]')[0];
  const askB = q<SVGGElement>('[data-fmt="ask-b"]')[0];
  const fillA = q<SVGRectElement>("[data-fmt-fill-a]")[0];
  const fillB = q<SVGRectElement>("[data-fmt-fill-b]")[0];
  const pctA = q<SVGTextElement>("[data-fmt-pct-a]")[0];
  const pctB = q<SVGTextElement>("[data-fmt-pct-b]")[0];
  const barA = q<SVGGElement>('[data-fmt="bar-a"]')[0];
  const barB = q<SVGGElement>('[data-fmt="bar-b"]')[0];
  const gap = q<SVGGElement>('[data-fmt="gap"]')[0];
  const step = (n: number) => q<HTMLElement>(`[data-fmt="step-${n}"]`);

  const caption = (g: SVGGElement) => g.querySelectorAll("text");

  // One prompt.
  tl.addLabel("same-everything");
  tl.fromTo(step(1), { opacity: 0 }, { opacity: 1, duration: 0.3 })
    .fromTo(split, { opacity: 0 }, { opacity: 1, duration: 0.4 }, "<+=0.1")
    // The two tracks exist from the start, empty. Showing the empty tracks
    // before either fills is what makes the comparison legible: a reader sees
    // the same distance available to both.
    .fromTo(
      [barA.querySelector("rect"), barB.querySelector("rect")],
      { opacity: 0 },
      { opacity: 1, duration: 0.3 },
      "<",
    );

  // Only the instruction differs.
  tl.addLabel("one-difference");
  tl.fromTo(
    [askA, askB],
    { opacity: 0 },
    { opacity: 1, duration: 0.35, stagger: 0.12 },
  ).fromTo(step(2), { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<");

  // The bars fill. Same duration for both, so the eye reads the difference as
  // distance rather than as speed -- a shorter bar finishing sooner would
  // suggest it was faster, which is not the claim.
  tl.addLabel("the-result");
  tl.fromTo(
    [fillA, fillB],
    { scaleX: 0, transformOrigin: "left center" },
    { scaleX: 1, duration: 0.9, ease: "power2.out" },
  )
    .fromTo(
      [pctA, pctB, ...caption(barA), ...caption(barB)],
      { opacity: 0 },
      { opacity: 1, duration: 0.3 },
      "<+=0.6",
    )
    .fromTo(step(3), { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<");

  // The gap between them, measured.
  tl.addLabel("the-gap");
  tl.fromTo(gap, { opacity: 0 }, { opacity: 1, duration: 0.45 }).fromTo(
    step(4),
    { opacity: 0 },
    { opacity: 1, duration: 0.35 },
    "<",
  );

  // Why it matters past this thesis.
  tl.addLabel("why-it-matters");
  tl.fromTo(
    step(5),
    { opacity: 0 },
    { opacity: 1, duration: 0.4, stagger: 0.12 },
  );
};
