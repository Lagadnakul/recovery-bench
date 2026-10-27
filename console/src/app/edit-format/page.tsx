import { EditFormat, type EditFormatData } from "@/components/screens/EditFormat";
import { loadRows } from "@/model/rows";
import { applyRateByFormat, malformedByReason } from "@/model/derive";

/**
 * Server component for screen 3.
 *
 * `a5_format_at_scale` is the only block designed to test the format, and the
 * only one spanning 60 bugs. The whole-sweep figures are computed too, but
 * presented as context rather than as replication -- the other five blocks held
 * the format fixed, so they cannot confirm anything about it.
 */
const ARM = "a5_format_at_scale" as const;

export default function Page() {
  const rows = loadRows();
  const inArm = rows.filter((r) => r.arm === ARM);

  const scoped = applyRateByFormat(rows, ARM);
  const overall = applyRateByFormat(rows);

  // Why the losing format loses: its own malformed reasons, counted.
  const losing = inArm.filter((r) => r.cell.editFormat === "unified_diff");
  const reasons = malformedByReason(losing);

  const data: EditFormatData = {
    arm: ARM,
    tasks: new Set(inArm.map((r) => r.cell.taskId)).size,
    models: [...new Set(inArm.map((r) => r.cell.model))].sort(),
    searchReplace: {
      rows: scoped.searchReplace.rows,
      applied: scoped.searchReplace.applied,
      rate: scoped.searchReplace.rate,
    },
    unifiedDiff: {
      rows: scoped.unifiedDiff.rows,
      applied: scoped.unifiedDiff.applied,
      rate: scoped.unifiedDiff.rate,
    },
    test: {
      label: "Quoting the lines against a Git-style diff",
      methodA: "quoting the lines",
      methodB: "the Git-style diff",
      ...scoped.test,
    },
    reasons: reasons.map((r) => ({
      label: r.label,
      count: r.count,
      share: r.share,
    })),
    overall: {
      searchReplace: overall.searchReplace.rate,
      unifiedDiff: overall.unifiedDiff.rate,
    },
  };

  return <EditFormat data={data} />;
}
