/**
 * Apply rate by edit format — the A5 comparison.
 *
 * Two series, one axis. ARCHITECTURE §7 bans a second axis anywhere, and here
 * there is no temptation: both bars count out of the same denominator.
 *
 * Two things this view got wrong the first time, both visible the moment it
 * rendered against real data:
 *
 *   It drew a single bar and still said "the two bars are comparable". When
 *   only one edit format is present there is no comparison, and the panel now
 *   says so instead of implying one.
 *
 *   It showed "5/8" large and "23 set aside" in small grey. Those 23 were
 *   three-quarters of everything in view — Gemini's free quota ran out mid-run
 *   — so the honest headline was not 63%, it was *most of this measured
 *   nothing*. When the set-aside count dominates, it now leads.
 */

import { useState } from "react";
import { applyRate, type ViewRow } from "../model/rows.ts";
import { Callout, Empty, Term, Track, ViewSwitch } from "../ui/primitives.tsx";

interface Group {
  format: string;
  applied: number;
  measured: number;
  setAside: number;
}

function group(rows: readonly ViewRow[]): Group[] {
  const byFormat = new Map<string, ViewRow[]>();
  for (const r of rows) {
    if (r.editFormat === null) continue;
    const list = byFormat.get(r.editFormat);
    if (list) list.push(r);
    else byFormat.set(r.editFormat, [r]);
  }
  return [...byFormat.entries()]
    .map(([format, list]) => ({ format, ...applyRate(list) }))
    .sort((a, b) => a.format.localeCompare(b.format));
}

export function FormatBars({ rows }: { rows: readonly ViewRow[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const groups = group(rows);

  if (groups.length === 0) {
    return (
      <Empty
        heading="No attempts in view carry an edit format"
        detail="This comparison needs attempts tagged search_replace or unified_diff. Widen the filters, or run a sweep that includes the a5 arm."
      />
    );
  }

  const totalMeasured = groups.reduce((n, g) => n + g.measured, 0);
  const totalSetAside = groups.reduce((n, g) => n + g.setAside, 0);
  const total = totalMeasured + totalSetAside;
  // The scale is the largest group's measured count, so two bars are directly
  // comparable. With one group it is just that group's own denominator.
  const scale = Math.max(...groups.map((g) => g.measured), 1);
  const onlyOne = groups.length === 1;

  return (
    <div className="flex flex-col gap-4">
      {/* When most of the view measured nothing, that is the finding, and it
          goes first at a size a reader cannot skim past. */}
      {totalSetAside > totalMeasured && (
        <Callout tone="warn">
          <strong>
            {totalSetAside} of {total} attempts measured nothing about the edit format.
          </strong>{" "}
          They stopped at an <Term of="instrument limit">instrument limit</Term> — our
          budget, our token ceiling, or a provider error — so they are excluded from
          both sides of every rate below. The bars describe the {totalMeasured} that
          remain.
        </Callout>
      )}

      <div className="flex items-center justify-between gap-3">
        {onlyOne ? (
          <p className="t-caption m-0">
            Only one edit format is present in this view, so there is nothing to compare
            yet. Run the <code>a5_format_at_scale</code> arm to produce the other.
          </p>
        ) : (
          <span />
        )}
        <div className="ml-auto shrink-0">
          <ViewSwitch view={view} onChange={setView} idBase="formats" />
        </div>
      </div>

      {view === "table" ? (
        <table className="data">
          <thead>
            <tr>
              <th scope="col">edit format</th>
              <th scope="col">applied</th>
              <th scope="col">measured</th>
              <th scope="col">rate</th>
              <th scope="col">set aside</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.format}>
                <th scope="row" className="mono font-normal">
                  {g.format}
                </th>
                <td>{g.applied}</td>
                <td>{g.measured}</td>
                <td className="font-bold">
                  {g.measured === 0
                    ? "no data"
                    : `${Math.round((g.applied / g.measured) * 100)}%`}
                </td>
                <td className="text-ink-faint">{g.setAside === 0 ? "—" : g.setAside}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.format} className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <span className="mono text-[14px] font-semibold">{g.format}</span>
                <span className="ml-auto text-[14px]">
                  <strong className="text-[17px]">{g.applied}</strong>
                  <span className="text-ink-faint">/{g.measured} applied</span>
                </span>
              </div>
              <Track
                value={g.applied}
                total={scale}
                fill="var(--st-good)"
                label={`${g.format} applied`}
              />
              {g.measured === 0 && (
                <p className="t-caption m-0">
                  Nothing here was measured, so this is not a rate of zero — it is no
                  rate at all.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="t-caption m-0">
        The dashed outline is the denominator
        {onlyOne ? "." : ", drawn to the larger group so the bars are comparable."}{" "}
        Attempts stopped by our own token ceiling, budget or a provider error are
        excluded from both numerator and denominator — they measured nothing about the
        format.
      </p>
    </div>
  );
}
