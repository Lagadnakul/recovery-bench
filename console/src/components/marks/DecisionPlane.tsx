"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  CLASS_LABEL,
  ClassMarkDefs,
  classFill,
  classStroke,
  type FailureClass,
} from "@/components/primitives/ClassMark";
import type { Decision } from "@/model/ccos";

/**
 * The decision plane: one lane per failure class, probability along x.
 *
 * In each lane -- the real trials as individual marks, the class belief p-hat
 * as a solid mark, and theta_c as a line that moves when the payoffs move.
 * Everything right of theta is the retry region.
 *
 * Hand-drawn rather than a charting library because none of these marks is a
 * standard one, and because a data mark here gets square corners and crisp
 * edges: a rounded corner on a plotted value is a lie about precision.
 */

export type Lane = {
  cls: FailureClass;
  /** Posterior mean. */
  p: number;
  theta: number;
  decision: Decision;
  /** What backward induction over K attempts says, where it was computed. */
  horizonDecision: Decision | null;
  trials: number;
  successes: number;
  /** True when there are no trials and the belief is the prior alone. */
  priorOnly: boolean;
};

const W = 760;
const LANE_H = 76;
const AXIS_H = 34;
const PAD_L = 116;
const PAD_R = 150;
const PLOT_W = W - PAD_L - PAD_R;

const x = (p: number) => PAD_L + Math.min(1, Math.max(0, p)) * PLOT_W;
const offScale = (p: number) => p < 0 || p > 1;

const VERDICT_COPY: Record<Decision, string> = {
  RETRY: "Retry",
  ESCALATE: "Ask a human",
  ABORT: "Abort",
};

export function DecisionPlane({ lanes }: { lanes: Lane[] }) {
  const reduced = useReducedMotion();
  // Zero lanes would give the svg a height of AXIS_H alone and render an axis
  // under nothing, which looks like a chart that failed rather than a policy
  // with no classes to decide about.
  const H = lanes.length * LANE_H + AXIS_H;

  if (lanes.length === 0) {
    return (
      <p className="text-ink-muted max-w-prose text-small">
        The policy has no failure classes to decide about, so there is nothing
        to draw. This is an absence of classes, not a decision to abort.
      </p>
    );
  }

  const spring = reduced
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 420, damping: 34 } as const);

  return (
    <figure className="m-0">
      <ClassMarkDefs />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={
          `Decision plane. ` +
          lanes
            .map(
              (lane) =>
                `${CLASS_LABEL[lane.cls]}: belief ${lane.p.toFixed(2)}, ` +
                `threshold ${lane.theta.toFixed(2)}, ${VERDICT_COPY[lane.decision]}.`,
            )
            .join(" ")
        }
        style={{ shapeRendering: "crispEdges" }}
      >
        {/* Scale. Four gridlines, no axis line -- the ticks carry the values. */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line
              x1={x(tick)}
              y1={0}
              x2={x(tick)}
              y2={H - AXIS_H}
              stroke="var(--color-rule)"
              strokeWidth={1}
            />
            <text
              x={x(tick)}
              y={H - AXIS_H + 16}
              textAnchor={tick === 0 ? "start" : tick === 1 ? "end" : "middle"}
              fontSize={10}
              fill="var(--color-ink-muted)"
              fontFamily="var(--font-mono)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {tick.toFixed(2)}
            </text>
          </g>
        ))}
        <text
          x={PAD_L}
          y={H - AXIS_H + 30}
          fontSize={10}
          fill="var(--color-ink-muted)"
          fontFamily="var(--font-sans)"
        >
          probability the next attempt succeeds
        </text>

        {lanes.map((lane, i) => {
          const top = i * LANE_H;
          const mid = top + LANE_H / 2 - 6;
          const thetaX = x(lane.theta);
          const retryWide = PAD_L + PLOT_W - thetaX;

          return (
            <g key={lane.cls}>
              {i > 0 ? (
                <line
                  x1={0}
                  y1={top}
                  x2={W}
                  y2={top}
                  stroke="var(--color-rule)"
                  strokeWidth={1}
                />
              ) : null}

              <text
                x={0}
                y={mid - 6}
                fontSize={13}
                fill="var(--color-ink)"
                fontFamily="var(--font-sans)"
              >
                {CLASS_LABEL[lane.cls]}
              </text>
              <text
                x={0}
                y={mid + 11}
                fontSize={11}
                fill="var(--color-ink-muted)"
                fontFamily="var(--font-mono)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {lane.priorOnly
                  ? "prior only"
                  : `${lane.successes}/${lane.trials} retries`}
              </text>

              {/* The retry region: everything above the threshold. */}
              <motion.rect
                y={top + 10}
                height={LANE_H - 24}
                fill="var(--color-measure-wash)"
                animate={{ x: thetaX, width: Math.max(0, retryWide) }}
                initial={false}
                transition={spring}
              />

              {/* The trials, as individual marks. Filled = recovered. */}
              {!lane.priorOnly
                ? Array.from({ length: lane.trials }, (_, t) => {
                    const recovered = t < lane.successes;
                    return (
                      <rect
                        key={t}
                        x={PAD_L + t * 7}
                        y={mid + 16}
                        width={5}
                        height={5}
                        fill={
                          recovered ? classStroke(lane.cls) : "var(--color-surface)"
                        }
                        stroke={classStroke(lane.cls)}
                        strokeWidth={1}
                      />
                    );
                  })
                : null}

              {/* p-hat. A solid mark, because it is a measured quantity. */}
              <g>
                <rect
                  x={x(lane.p) - 5}
                  y={mid - 10}
                  width={10}
                  height={20}
                  fill={classFill(lane.cls)}
                  stroke={classStroke(lane.cls)}
                  strokeWidth={1}
                />
                <text
                  x={x(lane.p)}
                  y={mid - 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--color-ink-muted)"
                  fontFamily="var(--font-mono)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {lane.p.toFixed(3)}
                </text>
              </g>

              {/* theta. A line that carries its value -- a Rule, in SVG. */}
              <motion.line
                y1={top + 6}
                y2={top + LANE_H - 12}
                stroke="var(--color-measure)"
                strokeWidth={2}
                animate={{ x1: thetaX, x2: thetaX }}
                initial={false}
                transition={spring}
              />
              <motion.text
                y={top + LANE_H - 1}
                fontSize={10}
                fill="var(--color-measure)"
                fontFamily="var(--font-mono)"
                textAnchor={lane.theta > 0.85 ? "end" : "start"}
                style={{ fontVariantNumeric: "tabular-nums" }}
                animate={{ x: thetaX + (lane.theta > 0.85 ? -4 : 4) }}
                initial={false}
                transition={spring}
              >
                {`θ ${lane.theta.toFixed(2)}`}
                {offScale(lane.theta) ? " (off scale)" : ""}
              </motion.text>

              {/* The verdict. */}
              <text
                x={W - 6}
                y={mid - 4}
                textAnchor="end"
                fontSize={13}
                fill="var(--color-ink)"
                fontFamily="var(--font-sans)"
                fontWeight={500}
              >
                {VERDICT_COPY[lane.decision]}
              </text>
              <text
                x={W - 6}
                y={mid + 13}
                textAnchor="end"
                fontSize={11}
                fill={
                  lane.horizonDecision && lane.horizonDecision !== lane.decision
                    ? "var(--color-measure)"
                    : "var(--color-ink-muted)"
                }
                fontFamily="var(--font-sans)"
              >
                {lane.horizonDecision === null
                  ? "no horizon fit"
                  : lane.horizonDecision === lane.decision
                    ? "horizon agrees"
                    : `over K attempts: ${VERDICT_COPY[lane.horizonDecision].toLowerCase()}`}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
