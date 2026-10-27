import { Overview, type OverviewData } from "@/components/screens/Overview";
import {
  loadRows,
  loadProvenance,
  ARM_LABEL,
  ARM_QUESTION,
  STRATEGY_LABEL,
} from "@/model/rows";
import { armSummary, holes, refusalKind, totals } from "@/model/derive";

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
    // The third designed condition. Every figure counted from the rows, so if
    // a future run ever collects the evidence this needs, the panel stops
    // saying "never ran" on its own.
    thirdStrategy: (() => {
      const scope = rows.filter(
        (r) => r.cell.strategy === "l2_5_diagnose_revise",
      );
      const blocks = [...new Set(scope.map((r) => r.arm))].map((arm) => ({
        label: ARM_LABEL[arm],
        rows: scope.filter((r) => r.arm === arm).length,
      }));
      return {
        label: STRATEGY_LABEL.l2_5_diagnose_revise,
        rows: scope.length,
        calls: scope.filter((r) => r.usage).length,
        applied: scope.filter((r) => r.outcome.kind === "APPLIED").length,
        starved: scope.filter((r) => refusalKind(r) === "STARVED").length,
        cascade: scope.filter((r) => refusalKind(r) === "CASCADE").length,
        blocks: blocks.sort((a, b) => b.rows - a.rows),
      };
    })(),
    provenance: (() => {
      const p = loadProvenance();
      return { commit: p.commit, rows: p.rows };
    })(),
  };

  return <Overview data={data} />;
}
