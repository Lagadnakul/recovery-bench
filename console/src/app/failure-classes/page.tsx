import {
  FailureClasses,
  type FailureClassesData,
} from "@/components/screens/FailureClasses";
import { loadRows } from "@/model/rows";
import { loadCcos } from "@/model/ccos";
import { classify, malformedByReason, outcomeKinds } from "@/model/derive";
import {
  FAILURE_CLASSES,
  CLASS_LABEL,
  CLASS_PLAIN,
  type FailureClass,
} from "@/components/primitives/ClassMark";

/**
 * Server component for screen 4.
 *
 * The classes come from `classify()` over the live rows INCLUDING the ones it
 * returns zero for, because a class the run could not produce has to be drawn
 * as absent rather than omitted. Dropping the empty classes would hide the
 * screen's whole argument.
 *
 * The archive triage comes from ccos.json, which is a different dataset with
 * different provenance, and the screen keeps the two apart.
 */

/** Plain-language names for the engine's raw outcome kinds. */
const KIND_LABEL: Record<string, [string, string]> = {
  APPLIED: [
    "Edit accepted",
    "The repository applied the patch. It does not mean the bug was fixed.",
  ],
  MALFORMED: [
    "Unusable patch",
    "Not a valid edit at all — the repository could not even try it.",
  ],
  PROVIDER_ERROR: [
    "No answer came back",
    "Mostly the harness refusing to make the call on purpose.",
  ],
  NO_PATCH: [
    "No edit offered",
    "The model replied but proposed no change to any file.",
  ],
  APPLY_FAIL: [
    "Edit rejected",
    "A valid edit that did not fit the file as it stood.",
  ],
  TRUNCATED: [
    "Cut off mid-answer",
    "The model ran out of room, so the edit was incomplete.",
  ],
  NO_OUTPUT: ["Empty reply", "The model returned nothing at all."],
};

export default function Page() {
  const rows = loadRows();
  const run = loadCcos();

  const counts = new Map<FailureClass, number>(
    FAILURE_CLASSES.map((c) => [c, 0]),
  );
  for (const row of rows) {
    const cls = classify(row);
    if (cls) counts.set(cls, (counts.get(cls) ?? 0) + 1);
  }

  const reasons = malformedByReason(rows);
  const divider = reasons.find((r) => r.reason === "block_unterminated");

  const archive = new Map<FailureClass, { trials: number; successes: number }>();
  for (const o of run.observations) {
    const entry = archive.get(o.cls) ?? { trials: 0, successes: 0 };
    entry.trials += o.trials;
    entry.successes += o.successes;
    archive.set(o.cls, entry);
  }

  const data: FailureClassesData = {
    live: FAILURE_CLASSES.map((cls) => ({
      cls,
      label: CLASS_LABEL[cls],
      plain: CLASS_PLAIN[cls],
      count: counts.get(cls) ?? 0,
    })),
    liveTotal: [...counts.values()].reduce((n, c) => n + c, 0),
    kinds: outcomeKinds(rows).map((k) => ({
      kind: k.kind,
      label: KIND_LABEL[k.kind]?.[0] ?? k.kind,
      plain: KIND_LABEL[k.kind]?.[1] ?? "",
      count: k.count,
    })),
    reasons: reasons.map((r) => ({
      label: r.label,
      raw: r.reason,
      count: r.count,
      share: r.share,
    })),
    archive: [...archive.entries()]
      .map(([cls, v]) => ({ cls, ...v }))
      .sort((a, b) => b.trials - a.trials),
    archiveTotal: run.observations.reduce((n, o) => n + o.trials, 0),
    relabelled: {
      raw: "block_unterminated",
      label: "Divider missing",
      count: divider?.count ?? 0,
    },
  };

  return <FailureClasses data={data} />;
}
