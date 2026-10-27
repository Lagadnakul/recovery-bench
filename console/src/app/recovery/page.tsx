import { Collapse, type CollapseData } from "@/components/screens/Collapse";
import { loadRows } from "@/model/rows";
import {
  harmByTask,
  malformedByReason,
  reflectionHarm,
  roundSeries,
  tokenSeries,
} from "@/model/derive";
import { STRATEGY_LABEL, type Arm } from "@/model/rows";

/**
 * Server component. Derives every number at build time and hands the screen a
 * projection -- the 1.1 MB row snapshot never reaches the client, and this
 * screen ships zero JavaScript of its own.
 *
 * The arms are named here rather than in the component because which arm holds
 * the result is itself a finding: `a3_capability` is the 550B model, and the
 * two contrast arms exist to show the result failing to replicate.
 */

/** The arm the reflection collapse appears in. */
const SUBJECT: Arm = "a3_capability";

/** Contrast arms, in the order a reader should meet them. */
const CONTRAST: { arm: Arm; sub: string }[] = [
  { arm: "a2_workhorse", sub: "30B — null" },
  { arm: "a4_reasoning", sub: "reasoning — leans the other way" },
];

const FROM_ROUND = 2;

export default function Page() {
  const rows = loadRows();
  const modelOf = (arm: Arm) =>
    [...new Set(rows.filter((r) => r.arm === arm).map((r) => r.cell.model))].join(", ");

  const blind = roundSeries(rows, SUBJECT, "l1_blind_retry");
  const reflect = roundSeries(rows, SUBJECT, "l2_reflection");

  const malformedIn = (strategy: "l1_blind_retry" | "l2_reflection") => {
    const scope = rows.filter(
      (r) =>
        r.arm === SUBJECT &&
        r.cell.strategy === strategy &&
        r.cell.round >= FROM_ROUND,
    );
    const reasons = malformedByReason(scope);
    return {
      label: STRATEGY_LABEL[strategy],
      total: reasons.reduce((n, x) => n + x.count, 0),
      reasons: reasons.map((x) => ({ label: x.label, count: x.count })),
    };
  };

  const test = (arm: Arm, label: string, sub: string) => {
    const t = reflectionHarm(rows, arm, FROM_ROUND);
    return { label, sub, ...t };
  };

  const data: CollapseData = {
    arm: SUBJECT,
    model: modelOf(SUBJECT),
    tasks: new Set(rows.filter((r) => r.arm === SUBJECT).map((r) => r.cell.taskId)).size,
    repeats: new Set(rows.filter((r) => r.arm === SUBJECT).map((r) => r.cell.repeat)).size,
    fromRound: FROM_ROUND,
    series: [
      {
        id: "l2_reflection",
        label: "Reflection",
        tone: "measure",
        points: reflect,
      },
      {
        id: "l1_blind_retry",
        label: "Blind retry",
        tone: "muted",
        points: blind,
      },
    ],
    // The round-1 blind-retry rate: what a reader should compare the collapse
    // against. Null rather than 0 if that round is somehow absent.
    baseline:
      blind[0] !== undefined
        ? { rate: blind[0].rate, label: "round 1, blind retry" }
        : null,
    tests: [
      test(SUBJECT, modelOf(SUBJECT), "550B — the result"),
      ...CONTRAST.map((c) => test(c.arm, modelOf(c.arm), c.sub)),
    ],
    byTask: harmByTask(rows, SUBJECT, FROM_ROUND).map((t) => ({
      taskId: t.taskId,
      b: t.b,
      c: t.c,
      n: t.n,
    })),
    tokens: (["l2_reflection", "l1_blind_retry"] as const).map((strategy) => ({
      label: STRATEGY_LABEL[strategy],
      tone: strategy === "l2_reflection" ? ("measure" as const) : ("muted" as const),
      points: tokenSeries(rows, SUBJECT, strategy).map((p) => ({
        round: p.round,
        meanCompletion: p.meanCompletion,
        calls: p.calls,
      })),
    })),
    malformed: [malformedIn("l2_reflection"), malformedIn("l1_blind_retry")],
  };

  return <Collapse data={data} />;
}
