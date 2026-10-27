import type { BuildScene } from "@/components/explain/Act";

/**
 * Act 4 -- reflection helps once, then poisons.
 *
 * The richest act, because it is the only one with a mechanism worth showing.
 * The result is two lines crossing; the *reason* they cross is that after the
 * first retry the model's own failed patch is sitting in its prompt, and it
 * starts quoting that instead of reading the file.
 *
 * The act has to land four things in order and not let the reader stop early:
 * reflection wins round 1, collapses at round 2, the cause is anchoring, and
 * the whole thing rests on four bugs and does not replicate. An act that
 * stopped after the collapse would be the most quotable and the least honest.
 *
 * ## Why segment paths rather than one line each
 *
 * Each round is revealed separately, so each segment is its own `<path>` with
 * `pathLength={1}`. That normalises every segment to a 0-1 dash space whatever
 * its real length, so a long diagonal and a short flat both draw in the same
 * time -- which is what makes the reveal read as "round by round" rather than
 * as the steeper segments taking longer.
 */

export type Point = { round: number; rate: number };

export type CollapseActData = {
  blind: Point[];
  reflect: Point[];
  tasks: number;
  repeats: number;
  test: { b: number; c: number; pairs: number; odds: string };
  mechanism: {
    reflectCount: number;
    reflectReason: string;
    blindCount: number;
    blindReason: string;
  };
  replication: { label: string; verdict: string }[];
};

const W = 840;
const H = 330;

const PLOT = { left: 300, right: 760, top: 52, bottom: 248 };

export function CollapseScene({ data }: { data: CollapseActData }) {
  const rounds = data.blind.map((p) => p.round);
  const x = (round: number) => {
    const i = rounds.indexOf(round);
    const step = (PLOT.right - PLOT.left) / Math.max(1, rounds.length - 1);
    return PLOT.left + i * step;
  };
  // Rate 0 at the bottom, 1 at the top. One shared scale for both series.
  const y = (rate: number) =>
    PLOT.bottom - rate * (PLOT.bottom - PLOT.top);

  /** One `<path>` per round-to-round segment, so each can be drawn alone. */
  const segments = (points: Point[]) =>
    points.slice(0, -1).map((from, i) => {
      const to = points[i + 1]!;
      return {
        i,
        d: `M${x(from.round)} ${y(from.rate)} L${x(to.round)} ${y(to.rate)}`,
      };
    });

  const pct = (r: number) => `${Math.round(r * 100)}%`;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full lg:max-w-208"
        role="img"
        aria-label={`Across four tries, retrying blind stays near ${pct(data.blind[0]!.rate)} while reflection starts higher at ${pct(data.reflect[0]!.rate)} and falls to ${pct(data.reflect[1]!.rate)} on the second try, never recovering.`}
      >
        {/* ── the two ways of retrying ────────────────────────────────── */}
        <g data-col="legend">
          <g data-col="legend-blind" opacity={0}>
            <line
              x1={8}
              x2={40}
              y1={76}
              y2={76}
              stroke="var(--color-ink-muted)"
              strokeWidth={2}
              strokeDasharray="6 3"
            />
            <text x={8} y={64} className="fill-ink text-[12px]">
              Retry blind
            </text>
            <text x={8} y={94} className="fill-ink-muted text-[11px]">
              &ldquo;That failed. Try again.&rdquo;
            </text>
            <text x={8} y={109} className="fill-ink-muted text-[11px]">
              Nothing else is said.
            </text>
          </g>

          <g data-col="legend-reflect" opacity={0}>
            <line
              x1={8}
              x2={40}
              y1={162}
              y2={162}
              stroke="var(--color-measure)"
              strokeWidth={2}
            />
            <text x={8} y={150} className="fill-ink text-[12px]">
              Reflect first
            </text>
            <text x={8} y={180} className="fill-ink-muted text-[11px]">
              &ldquo;Explain why that failed,
            </text>
            <text x={8} y={195} className="fill-ink-muted text-[11px]">
              then try again.&rdquo;
            </text>
            <text x={8} y={216} className="fill-ink-muted text-[11px]">
              The popular advice.
            </text>
          </g>
        </g>

        {/* ── grid ────────────────────────────────────────────────────── */}
        {[0, 0.25, 0.5, 0.75, 1].map((rate) => (
          <g key={rate}>
            <line
              x1={PLOT.left}
              x2={PLOT.right}
              y1={y(rate)}
              y2={y(rate)}
              stroke="var(--color-rule)"
              shapeRendering="crispEdges"
            />
            <text
              x={PLOT.left - 8}
              y={y(rate) + 4}
              textAnchor="end"
              className="fill-ink-muted font-mono text-[10px] tabular-nums"
            >
              {rate * 100}
            </text>
          </g>
        ))}
        <text x={PLOT.left} y={28} className="fill-ink-muted text-[11px]">
          out of every 100 patches, how many the repository accepted
        </text>
        {rounds.map((round) => (
          <text
            key={round}
            x={x(round)}
            y={PLOT.bottom + 22}
            textAnchor="middle"
            className="fill-ink-muted font-mono text-[10px] tabular-nums"
          >
            {round}
          </text>
        ))}
        <text
          x={(PLOT.left + PLOT.right) / 2}
          y={PLOT.bottom + 40}
          textAnchor="middle"
          className="fill-ink-muted text-[11px]"
        >
          try number
        </text>

        {/* ── the collapse, marked where it happens ───────────────────── */}
        <g data-col="crossing" opacity={0}>
          <rect
            x={x(rounds[0]!)}
            y={PLOT.top - 6}
            width={x(rounds[1]!) - x(rounds[0]!)}
            height={PLOT.bottom - PLOT.top + 12}
            fill="var(--color-measure-wash)"
          />
          <text
            x={(x(rounds[0]!) + x(rounds[1]!)) / 2}
            y={PLOT.top - 12}
            textAnchor="middle"
            className="fill-measure text-[12px]"
          >
            it happens here
          </text>
        </g>

        {/* ── the lines ───────────────────────────────────────────────── */}
        {segments(data.blind).map((seg) => (
          <path
            key={`b${seg.i}`}
            data-col-blind={seg.i}
            d={seg.d}
            fill="none"
            stroke="var(--color-ink-muted)"
            strokeWidth={2}
            strokeDasharray="6 3"
            pathLength={1}
          />
        ))}
        {segments(data.reflect).map((seg) => (
          <path
            key={`r${seg.i}`}
            data-col-reflect={seg.i}
            d={seg.d}
            fill="none"
            stroke="var(--color-measure)"
            strokeWidth={2}
            pathLength={1}
          />
        ))}

        {/* The first point of each line, so round 1 is visible before any
            segment is drawn -- otherwise the act opens on an empty plot. */}
        <circle
          data-col="dot-blind"
          cx={x(rounds[0]!)}
          cy={y(data.blind[0]!.rate)}
          r={3}
          fill="var(--color-ink-muted)"
        />
        <circle
          data-col="dot-reflect"
          cx={x(rounds[0]!)}
          cy={y(data.reflect[0]!.rate)}
          r={3}
          fill="var(--color-measure)"
        />

        {/* Round 1: reflection is ahead, and that is real. */}
        <g data-col="round1" opacity={0}>
          <text
            x={x(rounds[0]!) + 8}
            y={y(data.reflect[0]!.rate) - 8}
            className="fill-measure font-mono text-[12px] tabular-nums"
          >
            {pct(data.reflect[0]!.rate)}
          </text>
          <text
            x={x(rounds[0]!) + 8}
            y={y(data.blind[0]!.rate) + 16}
            className="fill-ink-muted font-mono text-[12px] tabular-nums"
          >
            {pct(data.blind[0]!.rate)}
          </text>
        </g>

        {/* Round 2 onward: it is below and stays below. */}
        <g data-col="after" opacity={0}>
          <text
            x={x(rounds[1]!) + 8}
            y={y(data.reflect[1]!.rate) + 16}
            className="fill-measure font-mono text-[12px] tabular-nums"
          >
            {pct(data.reflect[1]!.rate)}
          </text>
        </g>
      </svg>

      <div className="flex w-full flex-col gap-3 lg:max-w-80">
        <p data-col="step-1" className="text-ink text-body">
          When a fix fails, you can just ask again — or you can ask the model to
          explain what went wrong first, then try again. The second is the
          popular advice.
        </p>
        <p data-col="step-2" className="text-ink text-body">
          On the <strong>first</strong> retry it works.{" "}
          {pct(data.reflect[0]!.rate)} of reflected patches were accepted
          against {pct(data.blind[0]!.rate)} for retrying blind.
        </p>
        <p data-col="step-3" className="text-ink text-body">
          <strong>
            On the second retry it falls to {pct(data.reflect[1]!.rate)}
          </strong>{" "}
          — below retrying blind — and it never recovers.
        </p>
        <p
          data-col="step-4"
          className="text-ink border-rule-strong border-l-2 pl-3 text-body"
        >
          <strong>Here is why.</strong> After the first retry, the model&rsquo;s
          own failed patch is sitting in its prompt. It starts copying from that
          instead of from the file. Every one of its{" "}
          {data.mechanism.reflectCount} unusable patches after that point failed
          the same way: it asked the repository to find text that was not there.
          Retrying blind produced {data.mechanism.blindCount}.
        </p>
        <p data-col="step-5" className="text-ink text-body">
          Is it real? In {data.test.pairs} matched attempts, {data.test.b} went
          against reflection and <strong>{data.test.c} went for it</strong>.
          Luck would do that {data.test.odds}.
        </p>
        <p data-col="step-5" className="text-ink-muted text-small">
          But it is narrow: {data.tasks} bugs, {data.repeats} runs each, one
          model — and it does not replicate.{" "}
          {data.replication.map((r) => `${r.label}: ${r.verdict}`).join(" · ")}.
          Three models, three answers, reported as three.
        </p>
      </div>
    </div>
  );
}

export const buildCollapseAct: BuildScene = (tl, scope) => {
  const q = <T extends Element>(sel: string) =>
    Array.from(scope.querySelectorAll<T>(sel));

  const legendBlind = q<SVGGElement>('[data-col="legend-blind"]')[0];
  const legendReflect = q<SVGGElement>('[data-col="legend-reflect"]')[0];
  const dots = q<SVGCircleElement>('[data-col^="dot-"]');
  const blind = q<SVGPathElement>("[data-col-blind]");
  const reflect = q<SVGPathElement>("[data-col-reflect]");
  const round1 = q<SVGGElement>('[data-col="round1"]')[0];
  const crossing = q<SVGGElement>('[data-col="crossing"]')[0];
  const after = q<SVGGElement>('[data-col="after"]')[0];
  const step = (n: number) => q<HTMLElement>(`[data-col="step-${n}"]`);

  // `pathLength={1}` means every segment shares a 0-1 dash space regardless of
  // its real length, so a steep fall and a flat run draw in the same time.
  const draw = (paths: SVGPathElement[], i: number, duration: number) =>
    tl.fromTo(
      paths.filter((_, n) => n === i),
      { strokeDasharray: 1, strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration, ease: "none" },
      "<",
    );

  // The two approaches, side by side, before any data.
  tl.addLabel("two-ways");
  tl.fromTo(
    [legendBlind, legendReflect],
    { opacity: 0 },
    { opacity: 1, duration: 0.35, stagger: 0.15 },
  )
    .fromTo(dots, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.3, transformOrigin: "center" }, "<+=0.2")
    .fromTo(step(1), { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<");

  // Round 1: reflection is ahead.
  tl.addLabel("first-try");
  tl.fromTo(round1, { opacity: 0 }, { opacity: 1, duration: 0.35 }).fromTo(
    step(2),
    { opacity: 0 },
    { opacity: 1, duration: 0.3 },
    "<",
  );

  // Round 2: the collapse. The band is painted first so the drop lands inside
  // something already marked, rather than being explained after the fact.
  tl.addLabel("the-collapse");
  tl.fromTo(crossing, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  draw(blind, 0, 0.55);
  draw(reflect, 0, 0.55);
  tl.fromTo(after, { opacity: 0 }, { opacity: 1, duration: 0.3 }).fromTo(
    step(3),
    { opacity: 0 },
    { opacity: 1, duration: 0.3 },
    "<",
  );

  // It never comes back.
  tl.addLabel("it-stays-down");
  tl.to({}, { duration: 0.01 });
  draw(blind, 1, 0.45);
  draw(reflect, 1, 0.45);
  tl.to({}, { duration: 0.12 });
  draw(blind, 2, 0.45);
  draw(reflect, 2, 0.45);

  // The mechanism.
  tl.addLabel("why");
  tl.fromTo(step(4), { opacity: 0 }, { opacity: 1, duration: 0.4 });

  // And what it does not support.
  tl.addLabel("how-sure");
  tl.fromTo(step(5), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.14 });
};
