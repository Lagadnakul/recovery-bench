import { Overview, type OverviewData } from "@/components/screens/Overview";
import { loadRows, loadProvenance, ARM_LABEL, ARM_QUESTION } from "@/model/rows";
import { armSummary, holes, totals } from "@/model/derive";

/**
 * Server component. Replaces the Phase 0 placeholder, which hardcoded the five
 * headline numbers as strings -- exactly the thing Phase 5's acceptance rule
 * forbids. Every figure on the screen now comes from a `derive.ts` function.
 */
export default function Page() {
  const rows = loadRows();
  const t = totals(rows);

  const data: OverviewData = {
    totals: {
      rows: t.rows,
      calls: t.calls,
      tokens: t.tokens,
      arms: t.arms,
      models: t.models,
      tasks: t.tasks,
      byDesign: t.byDesign,
      real: t.real,
      starved: t.starved,
      cascade: t.cascade,
    },
    // The cells that never ran. A SUBSET of byDesign, which is why the screen
    // tells the reader not to add the two together.
    holes: holes(rows).length,
    arms: armSummary(rows)
      .sort((a, b) => b.rows - a.rows)
      .map((a) => ({
        arm: a.arm,
        label: ARM_LABEL[a.arm],
        question: ARM_QUESTION[a.arm],
        rows: a.rows,
        tasks: a.tasks,
        models: a.models,
        applied: a.applied,
        malformed: a.malformed,
        byDesign: a.starved + a.cascade,
        realErrors: a.realErrors,
        calls: a.calls,
        maxRound: a.maxRound,
      })),
    provenance: (() => {
      const p = loadProvenance();
      return { commit: p.commit, rows: p.rows };
    })(),
  };

  return <Overview data={data} />;
}
