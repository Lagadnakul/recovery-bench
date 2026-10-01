/**
 * Where cells die.
 *
 * ARCHITECTURE §7 asks for "six stages lighting up as a task flows through".
 * With a selected cell that is literal: the stages it completed are filled and
 * the one that stopped it is marked. With nothing selected it becomes a census
 * — how many of the rows in view got as far as each stage — which answers the
 * more useful question when you are looking at 1,308 of them.
 *
 * The census is a cumulative count, so it only ever decreases left to right.
 * That shape is the point: a step down between two stages is a loss, and its
 * size is how many cells that stage cost.
 */

import { STAGES, stageReached, type ViewRow } from "../model/rows.ts";
import { statusOf } from "../model/status.ts";

export function Pipeline({
  rows,
  selected,
}: {
  rows: readonly ViewRow[];
  selected: ViewRow | null;
}) {
  if (selected !== null) return <Single row={selected} />;
  return <Census rows={rows} />;
}

function Single({ row }: { row: ViewRow }) {
  const reached = stageReached(row.outcomeKind);
  const s = statusOf(row.outcomeKind);
  return (
    <div>
      <ol className="m-0 flex list-none flex-wrap items-center gap-0 p-0">
        {STAGES.map((stage, i) => {
          const done = i <= reached;
          const stopped = i === reached + 1;
          return (
            <li key={stage} className="flex items-center">
              <div className="flex flex-col items-center gap-1 px-2">
                <span
                  aria-hidden="true"
                  className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold"
                  style={{
                    background: done
                      ? `var(${s.token})`
                      : stopped
                        ? "transparent"
                        : "var(--surface-2)",
                    color: done ? `var(${s.onToken})` : "var(--ink-faint)",
                    border: stopped ? "1px dashed var(--edge)" : "1px solid transparent",
                  }}
                >
                  {done ? "✓" : stopped ? "×" : ""}
                </span>
                <span
                  className={`text-[12px] ${done ? "text-ink" : "text-ink-faint"} ${
                    stopped ? "font-semibold" : ""
                  }`}
                >
                  {stage}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <span aria-hidden="true" className="text-ink-faint">
                  &rarr;
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 mb-0 text-[15px]">
        <span className="font-semibold" style={{ color: `var(${s.token})` }}>
          {s.label}
        </span>
        {reached === STAGES.length - 1
          ? " — this cell completed every stage."
          : ` — stopped before ${STAGES[reached + 1]}.`}
      </p>
    </div>
  );
}

function Census({ rows }: { rows: readonly ViewRow[] }) {
  // Cumulative: a cell that reached `apply` also reached `call`.
  const counts = STAGES.map(
    (_, i) => rows.filter((r) => stageReached(r.outcomeKind) >= i).length,
  );
  const total = rows.length;

  return (
    <div>
      <ol className="m-0 flex list-none flex-wrap items-end gap-0 p-0">
        {STAGES.map((stage, i) => {
          const n = counts[i] ?? 0;
          const prev = i === 0 ? total : (counts[i - 1] ?? 0);
          const lost = prev - n;
          const pct = total === 0 ? 0 : (n / total) * 100;
          return (
            <li key={stage} className="flex items-end">
              <div className="flex w-[84px] flex-col items-center gap-1 px-1.5">
                <span className="text-[17px] font-bold">{n.toLocaleString()}</span>
                <div
                  aria-hidden="true"
                  className="h-10 w-full rounded-chip"
                  style={{
                    background: "var(--surface-2)",
                    borderBottom: "1px solid var(--rule-strong)",
                    position: "relative",
                  }}
                >
                  {n > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        inset: "auto 0 0 0",
                        height: `${pct}%`,
                        background: "var(--accent)",
                        borderRadius: "1px 1px 0 0",
                      }}
                    />
                  )}
                </div>
                <span className="text-[12px] font-semibold text-ink-soft">{stage}</span>
                {lost > 0 ? (
                  <span className="text-[12px] font-bold text-format">
                    &minus;{lost.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-[12px] text-ink-faint">&nbsp;</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="t-caption mt-3 mb-0">
        Cumulative over {total.toLocaleString()} cells in view. A drop between two
        stages is what that stage cost. Select a cell to trace it individually.
      </p>
    </div>
  );
}
