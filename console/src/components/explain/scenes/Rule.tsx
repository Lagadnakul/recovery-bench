import type { BuildScene } from "@/components/explain/Act";

/**
 * Act 5 -- the stopping rule.
 *
 * The contribution, and the act that has to survive an examiner who has never
 * seen a threshold policy. So it is built from two things a reader can hold at
 * once: a dot (how likely one more try is to work) and a line (the point where
 * trying stops being worth it). Above the line, keep going. Below it, ask a
 * person. That is the entire rule, and every symbol in the thesis is a name
 * for one of those two things.
 *
 * The act runs on FORMAT throughout, because it is the one class with real
 * evidence behind its dot -- 10 trials, 5 successes. Using a made-up lane to
 * teach the mechanism and only then showing the real one would be teaching
 * with a number nobody measured.
 *
 * ## The punchline is step 5, not step 2
 *
 * Showing that the rule works is a weak claim; a reader can always say "so
 * what, you invented a dial". The structural claim is the strong one: every
 * agent shipping today already IS this rule, with the line jammed at one end.
 * Drawing those as positions of the same line turns an assertion into
 * something you can see.
 */

export type RuleClass = {
  key: string;
  label: string;
  plain: string;
  /** Chance one more try works, from the trials. */
  pHat: number;
  /** The break-even point at the committed costs. */
  theta: number;
  trials: number;
  successes: number;
};

export type RuleData = {
  payoffs: { G: number; r: number; h: number };
  /** The class the act runs on -- the one with real evidence. */
  lead: RuleClass;
  /** The second class with evidence, introduced at step 4. */
  second: RuleClass;
  /** Raising the cost of asking a person moves the line. */
  demo: { fromH: number; fromTheta: number; toH: number; toTheta: number };
  arms: { label: string; plain: string; at: number | "class" }[];
};

const W = 840;
const H = 330;

const PLOT = { left: 250, right: 770 };
const LANE_A = 132;
const LANE_B = 226;

export function RuleScene({ data }: { data: RuleData }) {
  // The axis is a probability, so it is always 0 to 1. Thresholds outside that
  // range are clamped for drawing and labelled, never silently rescaled.
  const x = (p: number) =>
    PLOT.left + Math.max(0, Math.min(1, p)) * (PLOT.right - PLOT.left);
  const pct = (p: number) => `${Math.round(p * 100)}%`;

  const lane = (y: number, cls: RuleClass, mark: string) => (
    <g data-rule={mark}>
      <line
        x1={PLOT.left}
        x2={PLOT.right}
        y1={y}
        y2={y}
        stroke="var(--color-rule)"
        shapeRendering="crispEdges"
      />
      <text x={8} y={y - 10} className="fill-ink text-[12px]">
        {cls.label}
      </text>
      <text x={8} y={y + 6} className="fill-ink-muted text-[11px]">
        {cls.plain}
      </text>
      <text x={8} y={y + 22} className="fill-ink-muted text-[11px]">
        {cls.successes} worked of {cls.trials} tried
      </text>
    </g>
  );

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full lg:max-w-208"
        role="img"
        aria-label={`For ${data.lead.label}, one more try works about ${pct(data.lead.pHat)} of the time, and the break-even point sits at ${pct(data.lead.theta)}. Because the dot is below the line, the rule says ask a person.`}
      >
        {/* ── the axis: a probability, floor to ceiling ───────────────── */}
        <text x={PLOT.left} y={46} className="fill-ink-muted text-[11px]">
          how likely is one more try to work?
        </text>
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <line
              x1={x(p)}
              x2={x(p)}
              y1={56}
              y2={268}
              stroke="var(--color-rule)"
              shapeRendering="crispEdges"
            />
            <text
              x={x(p)}
              y={286}
              textAnchor="middle"
              className="fill-ink-muted font-mono text-[10px] tabular-nums"
            >
              {p * 100}
            </text>
          </g>
        ))}

        {/* ── the two zones the line divides ──────────────────────────── */}
        <g data-rule="zones" opacity={0}>
          <rect
            data-rule-ask
            x={PLOT.left}
            y={62}
            width={x(data.lead.theta) - PLOT.left}
            height={54}
            fill="var(--color-surface-sunk)"
          />
          <rect
            data-rule-try
            x={x(data.lead.theta)}
            y={62}
            width={PLOT.right - x(data.lead.theta)}
            height={54}
            fill="var(--color-measure-wash)"
          />
          <text
            data-rule-asklabel
            x={(PLOT.left + x(data.lead.theta)) / 2}
            y={94}
            textAnchor="middle"
            className="fill-ink text-[12px]"
          >
            below the line — ask a person
          </text>
          <text
            data-rule-trylabel
            x={(x(data.lead.theta) + PLOT.right) / 2}
            y={94}
            textAnchor="middle"
            className="fill-measure text-[12px]"
          >
            above the line — keep trying
          </text>
        </g>

        {/* ── lane A: the class with real evidence ────────────────────── */}
        {lane(LANE_A, data.lead, "lane-a")}

        {/* ── lane B: introduced later ────────────────────────────────── */}
        <g data-rule="lane-b-wrap" opacity={0}>
          {lane(LANE_B, data.second, "lane-b")}
        </g>

        {/* ── the line, which moves ───────────────────────────────────── */}
        <g
          data-rule="line"
          opacity={0}
          // The timeline animates to these. Carried on the element rather than
          // written into buildRule, so the line the scene draws and the figure
          // the prose quotes are the same derived number and cannot drift.
          data-rule-committed={data.lead.theta}
          data-rule-moved={data.demo.toTheta}
        >
          <line
            data-rule-theta
            x1={x(data.lead.theta)}
            x2={x(data.lead.theta)}
            y1={62}
            y2={252}
            stroke="var(--color-ink)"
            strokeWidth={2}
          />
          <text
            data-rule-thetalabel
            x={x(data.lead.theta)}
            y={266}
            textAnchor="middle"
            className="fill-ink font-mono text-[11px] tabular-nums"
          >
            {pct(data.lead.theta)}
          </text>
        </g>

        {/* ── the dots ────────────────────────────────────────────────── */}
        <g data-rule="dot-a" opacity={0}>
          <circle
            cx={x(data.lead.pHat)}
            cy={LANE_A}
            r={6}
            fill="var(--color-measure)"
          />
          <text
            x={x(data.lead.pHat)}
            y={LANE_A - 14}
            textAnchor="middle"
            className="fill-measure font-mono text-[12px] tabular-nums"
          >
            {pct(data.lead.pHat)}
          </text>
        </g>

        <g data-rule="dot-b" opacity={0}>
          <circle
            cx={x(data.second.pHat)}
            cy={LANE_B}
            r={6}
            fill="var(--color-class-logic)"
          />
          <text
            x={x(data.second.pHat) + 14}
            y={LANE_B + 4}
            className="fill-ink font-mono text-[12px] tabular-nums"
          >
            {pct(data.second.pHat)}
          </text>
        </g>

        {/* ── the verdict, which flips ────────────────────────────────── */}
        <g data-rule="verdict" opacity={0}>
          <text
            data-rule-verdicttext
            x={PLOT.right}
            y={LANE_A - 34}
            textAnchor="end"
            className="fill-ink text-[13px]"
          >
            the rule says: ask a person
          </text>
        </g>
      </svg>

      <div className="flex w-full flex-col gap-3 lg:max-w-80">
        <p data-rule="step-1" className="text-ink text-body">
          The whole rule is two things. <strong>A dot</strong> — how likely one
          more try is to work, from how often tries like it have worked before.
          And <strong>a line</strong> — the point where trying stops being worth
          it.
        </p>
        <p data-rule="step-2" className="text-ink text-body">
          Dot above the line, keep trying. Dot below it, stop and ask a person.
          That is it. Every symbol in the thesis is a name for one of those two.
        </p>
        <p data-rule="step-3" className="text-ink text-body">
          <strong>The line is made of costs</strong>, not chosen. What a fix is
          worth, what one more try costs, and what interrupting a person costs.
          Make interrupting a person dearer — from {data.demo.fromH} to{" "}
          {data.demo.toH} — and the line slides left, until the same dot that
          meant &ldquo;ask&rdquo; now means &ldquo;keep trying&rdquo;.
        </p>
        <p data-rule="step-4" className="text-ink text-body">
          It is a different line for <strong>each kind of failure</strong>.
          A formatting slip is worth another go; a wrong idea is not. That is
          the contribution — not one threshold, but one per kind.
        </p>
        <p
          data-rule="step-5"
          className="text-ink border-rule-strong border-l-2 pl-3 text-body"
        >
          <strong>
            And every agent shipping today is already this rule, with the line
            jammed at one end.
          </strong>{" "}
          Never give up is the line on the floor. Always ask is the line on the
          ceiling. They are not rival designs — they are this one rule, set
          carelessly.
        </p>
        <p data-rule="step-5" className="text-ink-muted text-small">
          One caution, and act 6 is about it: those three costs were never
          measured. Change them and the verdict changes, which is the point of
          the sliders on the stopping-rule screen — and the problem.
        </p>
      </div>
    </div>
  );
}

export const buildRule: BuildScene = (tl, scope) => {
  const q = <T extends Element>(sel: string) =>
    Array.from(scope.querySelectorAll<T>(sel));
  const one = <T extends Element>(sel: string) =>
    scope.querySelector<T>(sel) as T;

  const zones = one<SVGGElement>('[data-rule="zones"]');
  const ask = one<SVGRectElement>("[data-rule-ask]");
  const tryZone = one<SVGRectElement>("[data-rule-try]");
  const askLabel = one<SVGTextElement>("[data-rule-asklabel]");
  const tryLabel = one<SVGTextElement>("[data-rule-trylabel]");
  const line = one<SVGGElement>('[data-rule="line"]');
  const theta = one<SVGLineElement>("[data-rule-theta]");
  const thetaLabel = one<SVGTextElement>("[data-rule-thetalabel]");
  const dotA = one<SVGGElement>('[data-rule="dot-a"]');
  const laneB = one<SVGGElement>('[data-rule="lane-b-wrap"]');
  const dotB = one<SVGGElement>('[data-rule="dot-b"]');
  const verdict = one<SVGGElement>('[data-rule="verdict"]');
  const verdictText = one<SVGTextElement>("[data-rule-verdicttext]");
  const step = (n: number) => q<HTMLElement>(`[data-rule="step-${n}"]`);

  const committed = Number(line.dataset.ruleCommitted);
  const moved = Number(line.dataset.ruleMoved);
  const asPct = (p: number) => `${Math.round(p * 100)}%`;

  const PLOT_LEFT = 250;
  const PLOT_RIGHT = 770;
  const xOf = (p: number) =>
    PLOT_LEFT + Math.max(0, Math.min(1, p)) * (PLOT_RIGHT - PLOT_LEFT);

  /** Moves the line and both zones together, so they can never disagree. */
  const moveLine = (to: number, duration: number, label: string) => {
    const at = xOf(to);
    tl.to(theta, { attr: { x1: at, x2: at }, duration, ease: "power2.inOut" })
      .to(thetaLabel, { attr: { x: at }, duration, ease: "power2.inOut" }, "<")
      .to(thetaLabel, { textContent: label, duration: 0, ease: "none" }, "<")
      .to(ask, { attr: { width: at - PLOT_LEFT }, duration, ease: "power2.inOut" }, "<")
      .to(
        tryZone,
        { attr: { x: at, width: PLOT_RIGHT - at }, duration, ease: "power2.inOut" },
        "<",
      )
      .to(askLabel, { attr: { x: (PLOT_LEFT + at) / 2 }, duration, ease: "power2.inOut" }, "<")
      .to(tryLabel, { attr: { x: (at + PLOT_RIGHT) / 2 }, duration, ease: "power2.inOut" }, "<");
  };

  // The dot.
  tl.addLabel("the-dot");
  tl.fromTo(step(1), { opacity: 0 }, { opacity: 1, duration: 0.3 }).fromTo(
    dotA,
    { opacity: 0, scale: 0 },
    { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)", transformOrigin: "center" },
    "<+=0.1",
  );

  // The line, and the two sides it makes.
  tl.addLabel("the-line");
  tl.fromTo(line, { opacity: 0 }, { opacity: 1, duration: 0.35 })
    .fromTo(zones, { opacity: 0 }, { opacity: 1, duration: 0.4 }, "<+=0.15")
    .fromTo(verdict, { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<+=0.2")
    .fromTo(step(2), { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<");

  // The line is made of costs, and it moves. The verdict flips with it, which
  // is the moment the whole act exists for.
  tl.addLabel("costs-move-it");
  tl.fromTo(step(3), { opacity: 0 }, { opacity: 1, duration: 0.3 });
  moveLine(moved, 1.1, asPct(moved));
  tl.to(verdictText, { textContent: "the rule says: keep trying", duration: 0 }, ">-=0.25")
    .fromTo(verdictText, { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<");
  // Back to the committed costs, so the act does not leave a reader with a
  // number nobody actually used.
  moveLine(committed, 0.8, asPct(committed));
  tl.to(verdictText, { textContent: "the rule says: ask a person", duration: 0 }, ">-=0.2");

  // A different line per kind of failure.
  tl.addLabel("one-per-kind");
  tl.fromTo(laneB, { opacity: 0 }, { opacity: 1, duration: 0.4 })
    .fromTo(
      dotB,
      { opacity: 0, scale: 0 },
      { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)", transformOrigin: "center" },
      "<+=0.15",
    )
    .fromTo(step(4), { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<");

  // The structural claim: existing agents are this rule at an extreme.
  tl.addLabel("everyone-already-does-this");
  tl.fromTo(step(5), { opacity: 0 }, { opacity: 1, duration: 0.35, stagger: 0.14 });
  moveLine(0, 0.6, "never give up");
  tl.to({}, { duration: 0.35 });
  moveLine(1, 0.7, "always ask");
  tl.to({}, { duration: 0.35 });
  moveLine(committed, 0.6, asPct(committed));
};
