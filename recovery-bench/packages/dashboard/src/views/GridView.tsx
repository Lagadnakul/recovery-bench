/**
 * The grid. Where this interface spends its boldness.
 *
 * One line per lineage, one cell per round. A lineage is the cell key minus the
 * round, so the three rounds of one task/model/condition sit side by side and a
 * recovery chain reads left to right.
 *
 * Three properties worth defending:
 *
 *   **It is a real `<table>`.** Not a div grid. Screen readers get row and
 *   column headers, and keyboard users get arrow-key movement between cells,
 *   because 1,044 unreachable buttons would be worse than no view at all.
 *
 *   **A hole is drawn as a hole.** A lineage missing round 2 shows a dashed
 *   outline, not an absence of pixels and not a zero. The whole project exists
 *   because the original code let failed cells vanish.
 *
 *   **Colour is never the only signal.** Fill, plus a glyph, plus a hatch for
 *   the three outcomes that measured nothing about the model.
 */

import { useRef } from "react";
import { toLineages, type ViewRow } from "../model/rows.ts";
import { reasonOf, statusOf } from "../model/status.ts";
import { Empty } from "../ui/primitives.tsx";

/** Rounds are 0..2 in both datasets. Derived, not assumed, so a round 3 shows up. */
function roundsPresent(rows: readonly ViewRow[]): number[] {
  const s = new Set<number>();
  for (const r of rows) s.add(r.round);
  if (s.size === 0) return [0];
  return [...s].sort((a, b) => a - b);
}

export function GridView({
  rows,
  selectedId,
  onSelect,
  limit = 400,
}: {
  rows: readonly ViewRow[];
  selectedId: string | null;
  onSelect: (row: ViewRow) => void;
  /**
   * Rows rendered at once.
   *
   * Not virtualization. The react guidance is explicit that virtualization is
   * a measured optimization rather than a default, and a plain cap is honest
   * about what it is doing — the count of what is not shown is printed below
   * the table, where a virtualized list would have hidden it.
   */
  limit?: number;
}) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const lineages = toLineages(rows);
  const rounds = roundsPresent(rows);

  if (lineages.length === 0) {
    return (
      <Empty
        heading="No cells match these filters"
        detail="Every facet is a filter; clearing one widens the view. An empty result here means the filters exclude each other, not that the data is missing."
      />
    );
  }

  const shown = lineages.slice(0, limit);

  /** Arrow-key movement, so the grid is navigable without a mouse. */
  function onKeyDown(e: React.KeyboardEvent<HTMLTableSectionElement>) {
    const keys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"];
    if (!keys.includes(e.key)) return;
    const cells = [...(bodyRef.current?.querySelectorAll<HTMLButtonElement>("button.cell") ?? [])];
    const at = cells.indexOf(document.activeElement as HTMLButtonElement);
    if (at === -1) return;
    e.preventDefault();
    const perRow = rounds.length;
    const delta =
      e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? perRow : -perRow;
    cells[Math.max(0, Math.min(cells.length - 1, at + delta))]?.focus();
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="data" style={{ minWidth: 560 }}>
          <caption className="sr-only">
            Outcome per round for each lineage. Use the arrow keys to move between cells.
          </caption>
          <thead>
            <tr>
              <th scope="col">task</th>
              <th scope="col">condition</th>
              <th scope="col">model</th>
              {rounds.map((r) => (
                <th key={r} scope="col" className="text-center">
                  R{r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={bodyRef} onKeyDown={onKeyDown}>
            {shown.map((l) => (
              <tr key={l.id}>
                <th scope="row" className="mono font-normal whitespace-nowrap">
                  {l.taskLabel}
                </th>
                <td className="whitespace-nowrap">{l.conditionLabel}</td>
                <td className="mono whitespace-nowrap text-ink-soft">{l.model ?? "—"}</td>
                {rounds.map((r) => {
                  const row = l.rounds.get(r);
                  if (!row) {
                    return (
                      <td key={r} className="text-center">
                        <span
                          className="cell cell--empty"
                          title={`round ${r} was never run for this lineage`}
                          aria-label={`round ${r}: not run`}
                        >
                          &nbsp;
                        </span>
                      </td>
                    );
                  }
                  const s = statusOf(row.outcomeKind);
                  return (
                    <td key={r} className="text-center">
                      <button
                        type="button"
                        className={`cell${s.hatched ? " cell--hatched" : ""}`}
                        style={{
                          ["--cell-fill" as string]: `var(${s.token})`,
                          ["--cell-ink" as string]: `var(${s.onToken})`,
                        }}
                        aria-pressed={selectedId === row.id}
                        aria-label={`${l.taskLabel}, ${l.conditionLabel}, round ${r}: ${s.label}. ${reasonOf(row.outcome)}`}
                        title={`${s.label} — ${reasonOf(row.outcome)}`}
                        onClick={() => onSelect(row)}
                      >
                        <span aria-hidden="true">{s.glyph}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="t-caption mt-3 mb-0">
        {lineages.length > limit ? (
          <>
            Showing {limit.toLocaleString()} of {lineages.length.toLocaleString()} lineages.
            Narrow the filters to reach the rest &mdash;{" "}
            {(lineages.length - limit).toLocaleString()} are not drawn.
          </>
        ) : (
          <>
            {lineages.length.toLocaleString()}{" "}
            {lineages.length === 1 ? "lineage" : "lineages"}, {rows.length.toLocaleString()}{" "}
            cells. A dashed outline is a round that was never run.
          </>
        )}
      </p>
    </div>
  );
}
