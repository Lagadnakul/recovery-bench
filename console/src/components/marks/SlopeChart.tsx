import { Figure } from "@/components/primitives/Figure";

/**
 * Two apply-rate series across the recovery rounds, as straight segments.
 *
 * Deliberately not a line chart library's idea of a line chart. No curve
 * smoothing -- a spline between four measured points invents three values
 * between every pair of them, and the whole claim here is about the direction
 * of one specific segment. No point markers, because a 2px segment meeting
 * another at an angle already marks its own vertices. No area fill, because
 * nothing is being summed. Four faint gridlines, no y-axis line, and a 1px
 * dashed reference at the baseline rate.
 *
 * The y-domain is pinned to 0..1, never fitted to the data. A fitted domain
 * makes a 5-point difference look like a collapse, and this screen's argument
 * is that one series actually collapses -- it has to be legible against a
 * fixed scale or it is a drawing trick.
 */

export type Series = {
  id: string;
  label: string;
  points: { round: number; rate: number; applied: number; rows: number }[];
  /** `measure` for the series under test, `muted` for its control. */
  tone: "measure" | "muted";
};

const W = 520;
const H = 300;
const PAD = { top: 16, right: 92, bottom: 34, left: 34 };

export function SlopeChart({
  series,
  reference,
  annotate,
}: {
  series: Series[];
  /** The dashed horizontal reference, as a rate. Usually the baseline. */
  reference?: { rate: number; label: string };
  /** A segment to call out, by the round it ends on. */
  annotate?: { seriesId: string; toRound: number; label: string };
}) {
  const rounds = [
    ...new Set(series.flatMap((s) => s.points.map((p) => p.round))),
  ].sort((a, b) => a - b);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (round: number) => {
    const i = rounds.indexOf(round);
    // A single round would divide by zero; it also would not be a slope chart.
    const step = rounds.length > 1 ? plotW / (rounds.length - 1) : 0;
    return PAD.left + i * step;
  };
  const y = (rate: number) => PAD.top + (1 - rate) * plotH;

  const gridlines = [0, 0.25, 0.5, 0.75, 1];

  const annotated = annotate
    ? series.find((s) => s.id === annotate.seriesId)
    : undefined;
  const from = annotated?.points.find((p) => p.round === annotate!.toRound - 1);
  const to = annotated?.points.find((p) => p.round === annotate!.toRound);

  /**
   * The empty chart is still a chart.
   *
   * CONSOLE.md's rule: draw the grid and the axis, leave the series out, and
   * say in one sentence what is absent. No "No data" illustration and no
   * padded range -- an empty plot area at the real scale tells a reader the
   * shape of what is missing, which a shrug icon does not.
   */
  if (rounds.length === 0) {
    return (
      <figure className="m-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="No rounds measured">
          {gridlines.map((rate) => (
            <line
              key={rate}
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={y(rate)}
              y2={y(rate)}
              stroke="var(--color-rule)"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
          ))}
        </svg>
        <figcaption className="text-ink-muted mt-1 max-w-prose text-small">
          No rounds were measured for these conditions, so there is nothing to
          plot. This is an absence, not a run of zeros.
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={series
          .map(
            (s) =>
              `${s.label}: ${s.points
                .map((p) => `round ${p.round} ${Math.round(p.rate * 100)}%`)
                .join(", ")}`,
          )
          .join(". ")}
      >
        {/* Gridlines, and no y-axis line. The grid is the axis. */}
        {gridlines.map((rate) => (
          <g key={rate}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={y(rate)}
              y2={y(rate)}
              stroke="var(--color-rule)"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            <text
              x={PAD.left - 6}
              y={y(rate)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-ink-muted font-mono text-[10px] tabular-nums"
            >
              {rate * 100}
            </text>
          </g>
        ))}

        {reference ? (
          <line
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={y(reference.rate)}
            y2={y(reference.rate)}
            stroke="var(--color-rule-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
            shapeRendering="crispEdges"
          />
        ) : null}

        {/* The called-out segment, drawn under the series so the series wins. */}
        {from && to ? (
          <line
            x1={x(from.round)}
            x2={x(to.round)}
            y1={y(from.rate)}
            y2={y(to.rate)}
            stroke="var(--color-measure-wash)"
            strokeWidth={14}
            strokeLinecap="butt"
          />
        ) : null}

        {series.map((s) => {
          const stroke =
            s.tone === "measure"
              ? "var(--color-measure)"
              : "var(--color-ink-muted)";
          const last = s.points.at(-1);
          return (
            <g key={s.id}>
              <polyline
                points={s.points.map((p) => `${x(p.round)},${y(p.rate)}`).join(" ")}
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                strokeLinejoin="miter"
                strokeDasharray={s.tone === "muted" ? "6 3" : undefined}
              />
              {last ? (
                <text
                  x={x(last.round) + 8}
                  y={y(last.rate)}
                  dominantBaseline="middle"
                  fill={stroke}
                  className="text-[11px]"
                >
                  {s.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {rounds.map((round) => (
          <text
            key={round}
            x={x(round)}
            y={H - 12}
            textAnchor="middle"
            className="fill-ink-muted font-mono text-[10px] tabular-nums"
          >
            {round}
          </text>
        ))}
        <text
          x={PAD.left + plotW / 2}
          y={H - 1}
          textAnchor="middle"
          className="fill-ink-muted text-[10px]"
        >
          recovery round
        </text>
      </svg>

      {annotate && from && to ? (
        <figcaption className="text-ink-muted mt-1 max-w-prose text-small">
          <Figure
            value={`${Math.round(from.rate * 100)}% → ${Math.round(to.rate * 100)}%`}
            tone="measure"
            align="left"
          />{" "}
          {annotate.label}
        </figcaption>
      ) : null}
    </figure>
  );
}
