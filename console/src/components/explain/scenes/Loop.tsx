import type { BuildScene } from "@/components/explain/Act";

/**
 * Act 1 -- the loop.
 *
 * The problem, before any result: an AI agent is asked to fix a bug, its fix
 * does not work, so it tries again. And again. Each try costs real money and
 * may never succeed. Nothing tells it when to stop.
 *
 * Written for someone who has never read a line of this thesis. No symbols, no
 * jargon, one short sentence per step, and the only numbers on screen are real
 * measured token counts passed in from `derive.ts`.
 *
 * ## What is drawn, and what is measured
 *
 * The agent, the file and the arrow are a **diagram** -- they illustrate the
 * situation and measure nothing. The per-attempt token counts in the ledger are
 * **measured**: mean completion tokens per round for blind retry on the 550B
 * arm. The scene says which is which on screen rather than letting a reader
 * assume the whole picture is data.
 */

export type LoopData = {
  /** Mean completion tokens per attempt, measured. */
  attempts: { round: number; tokens: number | null }[];
  /** Sum of the above -- what four tries cost before anything is known. */
  totalTokens: number;
  model: string;
};

const W = 820;
const H = 300;

/** The ledger row height, shared by the SVG and the timeline. */
const ROW = 30;

export function LoopScene({ data }: { data: LoopData }) {
  const rows = data.attempts.slice(0, 4);

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full lg:max-w-208"
        role="img"
        aria-label={`An AI agent writes a fix, the code is still broken, and it tries again. After ${rows.length} attempts it has written ${data.totalTokens.toLocaleString("en-US")} tokens and nothing is known about whether the bug is fixed.`}
      >
        {/* ── the agent ───────────────────────────────────────────────── */}
        <g data-loop="agent">
          <rect
            x={8}
            y={60}
            width={150}
            height={62}
            fill="var(--color-surface)"
            stroke="var(--color-rule-strong)"
            shapeRendering="crispEdges"
          />
          <text x={83} y={86} textAnchor="middle" className="fill-ink text-[15px]">
            AI agent
          </text>
          <text
            x={83}
            y={105}
            textAnchor="middle"
            className="fill-ink-muted text-[13px]"
          >
            asked to fix a bug
          </text>
        </g>

        {/* ── the broken code ─────────────────────────────────────────── */}
        <g data-loop="code">
          <rect
            x={662}
            y={46}
            width={150}
            height={90}
            fill="var(--color-surface)"
            stroke="var(--color-rule-strong)"
            shapeRendering="crispEdges"
          />
          <text x={737} y={74} textAnchor="middle" className="fill-ink text-[15px]">
            the broken code
          </text>
          {[88, 100, 112].map((y, i) => (
            <line
              key={y}
              x1={682}
              x2={i === 1 ? 760 : 792}
              y1={y}
              y2={y}
              stroke="var(--color-rule)"
              strokeWidth={3}
              shapeRendering="crispEdges"
            />
          ))}
          {/* The bug itself, marked on the middle line. */}
          <rect
            data-loop="bug"
            x={766}
            y={96}
            width={26}
            height={8}
            fill="var(--color-class-format)"
          />
        </g>

        {/* ── the track the fix travels along ─────────────────────────── */}
        <line
          x1={158}
          x2={662}
          y1={91}
          y2={91}
          stroke="var(--color-rule)"
          strokeWidth={1}
          shapeRendering="crispEdges"
        />

        {/* The fix in flight. One element, reused for every attempt. */}
        <g data-loop="fix" opacity={0}>
          <rect
            x={-26}
            y={-11}
            width={52}
            height={22}
            fill="var(--color-measure-wash)"
            stroke="var(--color-measure)"
            shapeRendering="crispEdges"
          />
          <text
            y={4}
            textAnchor="middle"
            className="fill-measure text-[13px]"
          >
            a fix
          </text>
        </g>

        {/* The verdict, every time. */}
        <g data-loop="reject" opacity={0}>
          <text
            x={737}
            y={160}
            textAnchor="middle"
            className="fill-ink text-[14px]"
          >
            still broken
          </text>
        </g>

        {/* ── the ledger ──────────────────────────────────────────────── */}
        <g data-loop="ledger">
          <line
            x1={8}
            x2={W - 8}
            y1={178}
            y2={178}
            stroke="var(--color-rule)"
            shapeRendering="crispEdges"
          />
          {rows.map((attempt, i) => (
            <g key={attempt.round} data-loop-row={i}>
              <text
                x={8}
                y={198 + i * ROW}
                className="fill-ink-muted text-[14px]"
              >
                Attempt {i + 1}
              </text>
              <text
                x={150}
                y={198 + i * ROW}
                className="fill-ink font-mono text-[14px] tabular-nums"
              >
                {attempt.tokens === null
                  ? "–"
                  : Math.round(attempt.tokens).toLocaleString("en-US")}
              </text>
              <text
                x={222}
                y={198 + i * ROW}
                className="fill-ink-muted text-[14px]"
              >
                tokens written
              </text>
              <text
                x={400}
                y={198 + i * ROW}
                className="fill-ink-muted text-[14px]"
              >
                still broken
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* ── the narration ───────────────────────────────────────────────── */}
      <div className="flex w-full flex-col gap-3 lg:max-w-80">
        <p data-loop="step-1" className="text-ink text-body">
          The agent writes a fix and sends it to the code.
        </p>
        <p data-loop="step-2" className="text-ink text-body">
          It doesn&rsquo;t work. The agent is told only that it failed.
        </p>
        <p data-loop="step-3" className="text-ink text-body">
          So it tries again. And again. Each try costs real money.
        </p>
        <p
          data-loop="question"
          className="text-ink border-rule-strong border-l-2 pl-3 text-body"
        >
          <strong>
            Nothing tells it when to stop. It can keep going forever.
          </strong>{" "}
          After {data.attempts.length} tries it had written{" "}
          {data.totalTokens.toLocaleString("en-US")} tokens — and still nobody
          knew whether the bug was fixed.
        </p>
        <p data-loop="question" className="text-ink-muted text-small">
          The agent, the file and the arrow are a drawing. The token counts are
          real, measured from {data.model}.
        </p>
      </div>
    </div>
  );
}

/**
 * The scrubbed timeline.
 *
 * Only `transform` and `opacity` are animated -- never `x`/`y` attributes or
 * anything that forces layout -- so each frame stays on the compositor. GSAP's
 * `x` on an SVG element writes a transform, not the `x` attribute.
 */
export const buildLoop: BuildScene = (tl, scope) => {
  const q = <T extends Element>(sel: string) =>
    Array.from(scope.querySelectorAll<T>(sel));

  const fix = q<SVGGElement>('[data-loop="fix"]')[0];
  const reject = q<SVGGElement>('[data-loop="reject"]')[0];
  const rows = q<SVGGElement>("[data-loop-row]");
  const steps = [1, 2, 3].map((n) => q<HTMLElement>(`[data-loop="step-${n}"]`)[0]);
  const question = q<HTMLElement>('[data-loop="question"]');

  // No set() at position zero. A paused timeline does not render its first
  // frame, so a set() there never applies and everything stays visible -- the
  // bug this scene shipped with. `fromTo` renders its FROM state at creation
  // instead, which hides each element the moment the timeline is built and
  // re-applies on every backwards seek.

  rows.forEach((row, i) => {
    const label = steps[Math.min(i, steps.length - 1)];

    // One label per attempt. The player turns these into the numbered buttons
    // and seeks to them, so an examiner can jump straight to "the third try"
    // instead of scrubbing for it.
    tl.addLabel(`attempt-${i + 1}`);

    tl.set(fix, { x: 190, y: 91, opacity: 1 })
      // The fix travels from the agent to the code.
      .to(fix, { x: 636, duration: 0.75, ease: "none" }, "<")
      // Its narration appears while it is in flight.
      .fromTo(label, { opacity: 0 }, { opacity: 1, duration: 0.25 }, "<")
      // It arrives, and nothing is fixed.
      .to(fix, { opacity: 0, duration: 0.12 })
      .to(reject, { opacity: 1, duration: 0.18 }, "<")
      // The attempt is written into the ledger.
      .fromTo(
        row,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.28 },
        "<",
      )
      .to(reject, { opacity: 0, duration: 0.18 }, ">+=0.45");
  });

  tl.addLabel("forever");
  tl.fromTo(
    question,
    { opacity: 0 },
    { opacity: 1, duration: 0.4, stagger: 0.12 },
  );
};
