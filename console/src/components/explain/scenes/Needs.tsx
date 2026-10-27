import type { BuildScene } from "@/components/explain/Act";

/**
 * Act 6 -- what the rule still needs.
 *
 * The explainer ends on the limitations rather than a victory lap, and that is
 * the whole design. An examiner who reaches act 5 is holding a neat result;
 * the one question they will certainly ask is "what does this actually rest
 * on?". Answering it first, unprompted, in the same voice as the findings, is
 * worth more than any additional finding.
 *
 * The scene is a ledger: the seven quantities the rule needs, and which of
 * them anyone actually measured. Two were. That ratio IS the act -- it is not
 * softened, and it is not apologised for either, because a method
 * demonstration that names its own gaps is a contribution and a result that
 * hides them is not.
 *
 * ## "No evidence" is drawn differently from "assumed"
 *
 * They are not the same failure. An assumed number is a choice someone made
 * and can defend; a class with zero trials has nothing behind it at all. The
 * console separates zero from missing everywhere else, and this act has to as
 * well or it would be the one screen breaking its own rule.
 */

export type NeedState = "measured" | "assumed" | "none" | "inconclusive";

export type NeedItem = {
  key: string;
  label: string;
  detail: string;
  state: NeedState;
  /** What the status block reads. */
  status: string;
};

export type NeedsData = {
  items: NeedItem[];
  measured: number;
  trials: number;
  lambda: { estimate: number; lo: number; hi: number; used: number };
};

const W = 840;
const ROW = 42;
const TOP = 52;
const STATUS_X = 580;
const STATUS_W = 252;

const FILL: Record<NeedState, string> = {
  measured: "var(--color-measure)",
  assumed: "var(--color-surface-sunk)",
  none: "var(--color-surface-sunk)",
  inconclusive: "var(--color-surface-sunk)",
};

const TEXT: Record<NeedState, string> = {
  measured: "fill-surface",
  assumed: "fill-ink-muted",
  none: "fill-ink-muted",
  inconclusive: "fill-ink-muted",
};

export function NeedsScene({ data }: { data: NeedsData }) {
  const H = TOP + data.items.length * ROW + 46;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full lg:max-w-208"
        role="img"
        aria-label={`Of the ${data.items.length} quantities the stopping rule needs, ${data.measured} were measured. The rest were assumed, inconclusive, or had no evidence at all.`}
      >
        <text x={8} y={28} className="fill-ink-muted text-[13px]">
          what the rule needs
        </text>
        <text x={STATUS_X} y={28} className="fill-ink-muted text-[13px]">
          where it came from
        </text>

        {data.items.map((item, i) => {
          const y = TOP + i * ROW;
          return (
            <g key={item.key} data-need-row={i}>
              <line
                x1={8}
                x2={W - 8}
                y1={y - 12}
                y2={y - 12}
                stroke="var(--color-rule)"
                shapeRendering="crispEdges"
              />
              <text x={8} y={y + 6} className="fill-ink text-[15px]">
                {item.label}
              </text>
              <text x={8} y={y + 24} className="fill-ink-muted text-[13px]">
                {item.detail}
              </text>

              <g data-need-status={i} opacity={0}>
                <rect
                  x={STATUS_X}
                  y={y - 6}
                  width={STATUS_W}
                  height={28}
                  fill={FILL[item.state]}
                  stroke={
                    item.state === "measured"
                      ? "none"
                      : "var(--color-rule-strong)"
                  }
                  // A dashed outline for the one state that has nothing behind
                  // it. Zero and missing are different, and the console draws
                  // them differently everywhere else.
                  strokeDasharray={item.state === "none" ? "4 3" : undefined}
                />
                <text
                  x={STATUS_X + 12}
                  y={y + 13}
                  className={`${TEXT[item.state]} text-[14px]`}
                >
                  {item.status}
                </text>
              </g>
            </g>
          );
        })}

        <g data-need="tally" opacity={0}>
          <text
            x={8}
            y={TOP + data.items.length * ROW + 24}
            className="fill-ink text-[15px]"
          >
            {data.measured} of {data.items.length} measured.
          </text>
          <text
            x={200}
            y={TOP + data.items.length * ROW + 24}
            className="fill-ink-muted text-[15px]"
          >
            Which is why the rule is a proposal, not a result.
          </text>
        </g>
      </svg>

      <div className="flex w-full flex-col gap-3 lg:max-w-80">
        <p data-need="step-1" className="text-ink text-body">
          The rule needs seven numbers to give an answer. Here is where each one
          actually came from.
        </p>
        <p data-need="step-2" className="text-ink text-body">
          <strong>Two were measured</strong>, from {data.trials} trials that
          were checked by hand — the only place in this study where anyone
          confirmed whether a fix really worked.
        </p>
        <p data-need="step-3" className="text-ink text-body">
          Two of the four kinds of failure were <strong>never seen at all</strong>.
          Their dots sit at 50% because that is where they started, not because
          anything was observed.
        </p>
        <p data-need="step-4" className="text-ink text-body">
          The rest were <strong>chosen, not measured</strong>. How often a
          person succeeds instead. What a fix is worth. What a try costs. Act 5
          showed the verdict flipping when one of those moved — and nobody has
          measured any of them.
        </p>
        <p data-need="step-4" className="text-ink-muted text-small">
          The fading factor is the subtlest. It was fitted, and came out at{" "}
          {data.lambda.estimate} — but the range it could be runs from{" "}
          {data.lambda.lo} to {data.lambda.hi}. Reaching {data.lambda.hi} means
          the data cannot rule out <em>no fading at all</em>, so the rule ran
          with {data.lambda.used}: no fading. The idea the whole thesis is built
          on is not yet visible in its own data.
        </p>
        <p
          data-need="step-5"
          className="text-ink border-rule-strong border-l-2 pl-3 text-body"
        >
          <strong>One change fixes most of this:</strong> run the project&rsquo;s
          tests after applying a patch. That turns &ldquo;the edit was
          accepted&rdquo; into &ldquo;the bug was fixed&rdquo;, makes the two
          missing kinds of failure visible for the first time, and gives the
          rule real evidence instead of {data.trials} hand-checked trials.
        </p>
        <p data-need="step-5" className="text-ink-muted text-small">
          It is the same closed gate from the beginning. It cost the study its
          main measurement, one of its three strategies, and most of the
          evidence behind its rule.
        </p>
      </div>
    </div>
  );
}

export const buildNeeds: BuildScene = (tl, scope) => {
  const q = <T extends Element>(sel: string) =>
    Array.from(scope.querySelectorAll<T>(sel));

  const rows = q<SVGGElement>("[data-need-row]");
  const statuses = q<SVGGElement>("[data-need-status]");
  const tally = q<SVGGElement>('[data-need="tally"]')[0];
  const step = (n: number) => q<HTMLElement>(`[data-need="step-${n}"]`);

  // Which rows belong to which beat. Read off the status text rather than
  // hardcoded indices, so reordering the ledger cannot silently desynchronise
  // the animation from it.
  const indicesWhere = (test: (el: SVGGElement) => boolean) =>
    statuses.map((el, i) => (test(el) ? i : -1)).filter((i) => i >= 0);

  const dashed = (el: SVGGElement) =>
    el.querySelector("rect")?.getAttribute("stroke-dasharray") !== null;
  const solidFilled = (el: SVGGElement) =>
    el.querySelector("rect")?.getAttribute("stroke") === "none";

  const measured = indicesWhere(solidFilled);
  const none = indicesWhere((el) => dashed(el) && !solidFilled(el));
  const rest = statuses
    .map((_, i) => i)
    .filter((i) => !measured.includes(i) && !none.includes(i));

  const reveal = (indices: number[], duration = 0.35) =>
    tl.fromTo(
      indices.map((i) => statuses[i]!),
      { opacity: 0, x: -8 },
      { opacity: 1, x: 0, duration, stagger: 0.1 },
    );

  // The list of what is needed, with nothing filled in yet.
  tl.addLabel("what-it-needs");
  tl.fromTo(
    rows,
    { opacity: 0, y: 6 },
    { opacity: 1, y: 0, duration: 0.35, stagger: 0.07 },
  ).fromTo(step(1), { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<");

  // The two that came from data.
  tl.addLabel("two-measured");
  reveal(measured, 0.4);
  tl.fromTo(step(2), { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<");

  // The ones with nothing behind them at all.
  tl.addLabel("no-evidence");
  reveal(none, 0.4);
  tl.fromTo(step(3), { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<");

  // And the rest, chosen.
  tl.addLabel("the-rest-assumed");
  reveal(rest, 0.35);
  tl.fromTo(step(4), { opacity: 0 }, { opacity: 1, duration: 0.35, stagger: 0.12 }, "<");

  // The tally, then what would fix it.
  tl.addLabel("what-would-fix-it");
  tl.fromTo(tally, { opacity: 0 }, { opacity: 1, duration: 0.4 }).fromTo(
    step(5),
    { opacity: 0 },
    { opacity: 1, duration: 0.4, stagger: 0.14 },
    "<+=0.15",
  );
};
