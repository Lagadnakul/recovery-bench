import type { BuildScene } from "@/components/explain/Act";

/**
 * Act 2 -- the gate that was never opened.
 *
 * This is the most important picture in the console. Every limitation in the
 * thesis descends from one fact: the experiment asked *"did the repository
 * accept this patch?"* and never *"did the test pass afterwards?"*. Stated in
 * prose that takes a paragraph and gets skimmed. Drawn as a barrier with 718
 * attempts stopped dead against it, it takes three seconds.
 *
 * ## Why bands and not a field of dots
 *
 * A dot field is more visceral, and a dot per attempt is 1,604 nodes -- too
 * many to animate. The usual workaround is "one square = 10 attempts", which
 * means 160 squares standing for 1,600 and a quiet lie about the other 4, plus
 * 71.8 squares rounding to 72 for the 718.
 *
 * Proportional bands carry the exact counts instead: every height here is
 * `count / total` of the same pixel span, so the drawing cannot round anything
 * away. On a screen whose argument is that it does not dress up its numbers,
 * the bands are the only defensible choice.
 */

export type GateData = {
  tasks: number;
  attempts: number;
  applied: number;
  notApplied: number;
  /** Attempts whose fix was ever actually tested. It is zero, and that is act 2. */
  tested: number;
};

const W = 840;
const H = 330;

/** The vertical span one band of `attempts` occupies. */
const SPAN = 180;
const TOP = 40;
/** Space between the two outcome bands, taken OUT of the span so that the two
 *  bands plus the gap equal the whole exactly and both share one scale. */
const GAP = 6;

export function GateScene({ data }: { data: GateData }) {
  const h = (count: number) => (count / data.attempts) * (SPAN - GAP);
  const appliedH = h(data.applied);
  const rejectedH = h(data.notApplied);

  // 62 marks is few enough to draw one per bug, so this part is exact too.
  const bugs = Array.from({ length: data.tasks });

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full lg:max-w-208"
        role="img"
        aria-label={`${data.tasks} real bugs produced ${data.attempts.toLocaleString("en-US")} attempts. ${data.applied} were accepted by the repository and ${data.notApplied} were not. A second question, did the fix actually work, was never asked: ${data.tested} attempts were ever tested.`}
      >
        {/* ── the bugs ────────────────────────────────────────────────── */}
        <g data-gate="bugs">
          {bugs.map((_, i) => (
            <rect
              key={i}
              data-gate-bug
              x={8 + (i % 8) * 11}
              y={TOP + 14 + Math.floor(i / 8) * 11}
              width={7}
              height={7}
              fill="var(--color-class-format)"
            />
          ))}
          <text x={8} y={TOP + 2} className="fill-ink text-[12px]">
            {data.tasks} real bugs
          </text>
        </g>

        {/* ── every attempt ───────────────────────────────────────────── */}
        <g data-gate="all">
          <rect
            data-gate-allbar
            x={150}
            y={TOP + 10}
            width={58}
            height={SPAN}
            fill="var(--color-measure-wash)"
            stroke="var(--color-measure)"
          />
          <text x={150} y={TOP + 2} className="fill-ink text-[12px]">
            {data.attempts.toLocaleString("en-US")} attempts
          </text>
        </g>

        {/* ── question 1: an open gate ────────────────────────────────── */}
        <g data-gate="q1">
          <text x={246} y={TOP + 2} className="fill-ink text-[12px]">
            Did the patch apply?
          </text>
          <text
            x={246}
            y={TOP + SPAN + 30}
            className="fill-ink-muted text-[11px]"
          >
            asked every time
          </text>
          {/* Drawn open: two stubs with a gap the attempts pass through. */}
          <line
            x1={300}
            x2={300}
            y1={TOP + 10}
            y2={TOP + 34}
            stroke="var(--color-rule-strong)"
            strokeWidth={3}
            shapeRendering="crispEdges"
          />
          <line
            x1={300}
            x2={300}
            y1={TOP + SPAN - 14}
            y2={TOP + SPAN + 10}
            stroke="var(--color-rule-strong)"
            strokeWidth={3}
            shapeRendering="crispEdges"
          />
        </g>

        {/* ── the two outcomes ────────────────────────────────────────── */}
        <g data-gate="accepted">
          <rect
            data-gate-acceptedbar
            x={330}
            y={TOP + 10}
            width={250}
            height={appliedH}
            fill="var(--color-measure)"
          />
          <text x={336} y={TOP + 10 + appliedH / 2 + 4} className="fill-surface text-[12px]">
            {data.applied} accepted
          </text>
        </g>

        <g data-gate="rejected">
          <rect
            data-gate-rejectedbar
            x={330}
            y={TOP + 10 + appliedH + GAP}
            width={160}
            height={rejectedH}
            fill="var(--color-surface-sunk)"
            stroke="var(--color-rule)"
          />
          <text
            x={336}
            y={TOP + 10 + appliedH + GAP + rejectedH / 2 + 4}
            className="fill-ink-muted text-[12px]"
          >
            {data.notApplied} not accepted
          </text>
        </g>

        {/* ── question 2: the barrier ─────────────────────────────────── */}
        <g data-gate="q2" opacity={0}>
          {/* Solid, floor to ceiling. Nothing gets through, and it is the only
              heavy stroke in the whole console for that reason. */}
          <rect
            x={596}
            y={TOP - 6}
            width={7}
            height={SPAN + 32}
            fill="var(--color-ink)"
          />
          <text x={614} y={TOP + 2} className="fill-ink text-[12px]">
            Did the fix actually work?
          </text>
          <text x={614} y={TOP + 22} className="fill-ink text-[12px]">
            Never asked.
          </text>
          <text x={614} y={TOP + 48} className="fill-ink-muted text-[11px]">
            Running the project&rsquo;s tests needed
          </text>
          <text x={614} y={TOP + 63} className="fill-ink-muted text-[11px]">
            a container the run could not reach.
          </text>

          <text
            x={614}
            y={TOP + SPAN - 6}
            className="fill-ink font-mono text-[28px] tabular-nums"
          >
            {data.tested}
          </text>
          <text x={614} y={TOP + SPAN + 12} className="fill-ink-muted text-[11px]">
            attempts were ever tested
          </text>
        </g>
      </svg>

      <div className="flex w-full flex-col gap-3 lg:max-w-80">
        <p data-gate="step-1" className="text-ink text-body">
          {data.tasks} real bugs, taken from real open-source projects.
        </p>
        <p data-gate="step-2" className="text-ink text-body">
          They were attempted {data.attempts.toLocaleString("en-US")} times, by
          five different models under different settings.
        </p>
        <p data-gate="step-3" className="text-ink text-body">
          Every attempt was checked one way: <strong>did the repository
          accept the patch?</strong> {data.applied} did.
        </p>
        <p
          data-gate="step-4"
          className="text-ink border-rule-strong border-l-2 pl-3 text-body"
        >
          <strong>
            The second question was never asked. Not once in{" "}
            {data.attempts.toLocaleString("en-US")} attempts.
          </strong>{" "}
          A patch that applies neatly and fixes nothing counts here as a
          success.
        </p>
        <p data-gate="step-4" className="text-ink-muted text-small">
          This is why the console never says a bug was <em>resolved</em>, and
          why the stopping rule on a later screen rests on 31 older trials
          instead of these {data.attempts.toLocaleString("en-US")}.
        </p>
      </div>
    </div>
  );
}

export const buildGate: BuildScene = (tl, scope) => {
  const q = <T extends Element>(sel: string) =>
    Array.from(scope.querySelectorAll<T>(sel));

  const bugs = q<SVGRectElement>("[data-gate-bug]");
  const allBar = q<SVGRectElement>("[data-gate-allbar]")[0];
  const q1 = q<SVGGElement>('[data-gate="q1"]')[0];
  const accepted = q<SVGGElement>('[data-gate="accepted"]')[0];
  const acceptedBar = q<SVGRectElement>("[data-gate-acceptedbar]")[0];
  const rejected = q<SVGGElement>('[data-gate="rejected"]')[0];
  const rejectedBar = q<SVGRectElement>("[data-gate-rejectedbar]")[0];
  const q2 = q<SVGGElement>('[data-gate="q2"]')[0];
  const step = (n: number) => q<HTMLElement>(`[data-gate="step-${n}"]`);

  // The bugs arrive.
  tl.addLabel("bugs");
  tl.fromTo(
    bugs,
    { opacity: 0, scale: 0.4 },
    {
      opacity: 1,
      scale: 1,
      duration: 0.5,
      stagger: { each: 0.008, from: "start" },
      transformOrigin: "center",
    },
  ).fromTo(step(1), { opacity: 0 }, { opacity: 1, duration: 0.25 }, "<");

  // They become 1,604 attempts. scaleY, so no layout is touched.
  tl.addLabel("attempts");
  tl.fromTo(
    allBar,
    { scaleY: 0, transformOrigin: "center top" },
    { scaleY: 1, duration: 0.5, ease: "power2.out" },
  ).fromTo(step(2), { opacity: 0 }, { opacity: 1, duration: 0.25 }, "<");

  // The first question, and it opens.
  tl.addLabel("question-1");
  tl.fromTo(q1, { opacity: 0 }, { opacity: 1, duration: 0.3 })
    .fromTo(
      [acceptedBar, rejectedBar],
      { scaleX: 0, transformOrigin: "left center" },
      { scaleX: 1, duration: 0.6, ease: "power2.out", stagger: 0.08 },
      "<+=0.1",
    )
    .fromTo(
      [accepted.querySelector("text"), rejected.querySelector("text")],
      { opacity: 0 },
      { opacity: 1, duration: 0.25 },
      "<+=0.35",
    )
    .fromTo(step(3), { opacity: 0 }, { opacity: 1, duration: 0.25 }, "<");

  // The second question, which never opens. The accepted band runs into it
  // and stops -- a short push and a settle, so it reads as impact rather than
  // as the animation simply ending.
  tl.addLabel("the-wall");
  tl.fromTo(q2, { opacity: 0 }, { opacity: 1, duration: 0.35 })
    .to(acceptedBar, { scaleX: 1.06, duration: 0.25, ease: "power2.in" }, "<")
    .to(acceptedBar, { scaleX: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" })
    .fromTo(step(4), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.12 }, "<-=0.2");
};
