/**
 * The headline, as four numbers.
 *
 * ARCHITECTURE §7: "one number → stat tiles, not a chart". A bar chart of
 * 3-of-3 against 0-of-4 would add ink and no information; the finding is the
 * ratio, and the ratio is legible as text.
 *
 * The two middle tiles are the thesis's central result, which is why they carry
 * the failure-class colours and nothing else on the page does: **every
 * format-class failure that could be retried was recovered, and no logic-class
 * failure was.** The denominators differ (3 and 4) and are shown, because the
 * pool is eight tasks and one was excluded.
 */

import type { Figures } from "../model/load.ts";
import { Pill } from "../ui/primitives.tsx";

function Tile({
  value,
  of,
  label,
  detail,
  tone,
}: {
  value: number | string;
  of?: string;
  label: string;
  detail: string;
  tone?: "format" | "logic";
}) {
  const colour =
    tone === "format" ? "text-format" : tone === "logic" ? "text-logic" : "text-ink";
  return (
    <div className="panel px-4 py-3">
      <p className={`m-0 text-[32px] leading-none font-semibold ${colour}`}>
        {value}
        {of !== undefined && (
          <span className="text-[18px] font-normal text-ink-faint">/{of}</span>
        )}
      </p>
      <p className="mt-2 mb-0 text-[12px] font-semibold">{label}</p>
      <p className="mt-0.5 mb-0 text-[11px] text-ink-faint">{detail}</p>
    </div>
  );
}

export function StatTiles({ figures, cells }: { figures: Figures; cells: number }) {
  const h = figures.headline;
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          value={h.recoveredFormat.length}
          of={String(h.formatTasksEvaluable.length)}
          label="format-class recovered"
          detail="the patch had never applied"
          tone="format"
        />
        <Tile
          value={h.recoveredLogic.length}
          of={String(h.logicTasks.length)}
          label="logic-class recovered"
          detail="the patch applied, tests still failed"
          tone="logic"
        />
        <Tile
          value={`${h.baselinePct}%`}
          label="baseline resolve rate"
          detail={`${h.baselineResolved} of ${h.baselineN} instances, test-verified`}
        />
        <Tile
          value={cells.toLocaleString()}
          label="cells in view"
          detail="filtered from both datasets"
        />
      </div>

      <p className="mt-3 mb-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-soft">
        <span>
          Failure pool {h.poolSize} tasks, {h.evaluable} evaluable.
        </span>
        {h.excluded.length > 0 && (
          <>
            <Pill>
              {h.excluded.length} excluded: {h.excluded.join(", ")}
            </Pill>
            <span>
              stopped for provider recitation, so nothing about recovery was measured.
            </span>
          </>
        )}
      </p>
    </div>
  );
}
