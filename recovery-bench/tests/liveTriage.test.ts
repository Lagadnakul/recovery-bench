/**
 * Triage over the live sweep, pinned.
 *
 * Two properties carry this file, and both are regressions that already
 * happened once:
 *
 * **1. The lineage key must exclude the round.** `cellKey` ends
 * `…|r${round}|n${repeat}`, so grouping trajectories on `SweepRecord.key`
 * produces one trajectory per *attempt*. The depth then pins at 2 (the row plus
 * its prepended baseline), every trajectory falls short of `window = 3`, and
 * LOST becomes unobservable again — the exact defect this module exists to fix,
 * silently restored. `groups five rounds into one trajectory` fails if that
 * returns.
 *
 * **2. LOGIC must stay unreachable.** Live rows are `verification: "apply"`, so
 * `resolved` is `null` and an applied-but-untested patch must classify as
 * unverified rather than as a logic failure. A pipeline with no Docker that
 * reports a LOGIC rate is reporting a number it cannot observe (D6).
 *
 * The novelty primitives themselves are tested in `triage.test.ts`; this file
 * tests the live trajectory *construction*, which is the new code.
 */

import { test, expect, describe } from "bun:test";
import { OUTCOME_KINDS, MALFORMED_REASONS, type Outcome, type OutcomeKind } from "@rb/core";
import type { SweepRecord } from "../packages/pipeline/matrix/store.ts";
import { cellKey, type Cell, type StrategyId } from "../packages/core/types.ts";
import { LOST_DEFAULTS } from "../packages/pipeline/analysis/triage.ts";
import {
  liveTriageTable,
  liveTrajectories,
  liveTriageSummary,
  renderLiveTriageReport,
} from "../packages/pipeline/analysis/liveTriage.ts";

// --------------------------------------------------------------- fixtures

interface RowSpec {
  taskId?: string;
  strategy?: StrategyId;
  model?: string;
  editFormat?: "search_replace" | "unified_diff";
  thinking?: boolean;
  round?: number;
  repeat?: number;
  outcome?: Outcome;
  patch?: string | null;
  arm?: string;
}

/** A patch whose line set is `marker`-specific, so novelty is controllable. */
function patchWith(marker: string): string {
  return ["--- a/f.py", "+++ b/f.py", "@@ -1,1 +1,1 @@", `-old_${marker}`, `+new_${marker}`].join("\n");
}

function row(spec: RowSpec = {}): SweepRecord {
  const cell: Cell = {
    taskId: spec.taskId ?? "django__django-11019",
    strategy: spec.strategy ?? "l1_blind_retry",
    model: spec.model ?? "nemotron_ultra",
    editFormat: spec.editFormat ?? "search_replace",
    thinking: spec.thinking ?? false,
    round: spec.round ?? 1,
    repeat: spec.repeat ?? 0,
  };
  const patch = spec.patch === undefined ? patchWith(`r${cell.round}`) : spec.patch;
  return {
    key: cellKey(cell),
    arm: spec.arm ?? "test_arm",
    runId: "run-1",
    timestamp: "2026-10-31T00:00:00.000Z",
    cell,
    verification: "apply",
    outcome: spec.outcome ?? { kind: "APPLIED", patch: patch ?? "", filesChanged: ["f.py"] },
    usage: null,
    evidenceSource: "none",
    comparableToChapter5: true,
    honouredCondition: true,
    patch,
    response: "response text",
  };
}

/** One representative outcome per kind, so the totality check is exhaustive. */
function sample(kind: OutcomeKind): Outcome {
  switch (kind) {
    case "NO_OUTPUT":
      return { kind, detail: "provider returned nothing" };
    case "NO_PATCH":
      return { kind, responseChars: 120 };
    case "MALFORMED":
      return {
        kind,
        reason: MALFORMED_REASONS[0]!,
        blockIndex: 0,
        searchText: "x",
        nearestLine: null,
        detail: "d",
      };
    case "APPLY_FAIL":
      return { kind, patch: patchWith("a"), gitStderr: "does not apply" };
    case "APPLIED":
      return { kind, patch: patchWith("a"), filesChanged: ["f.py"] };
    case "CONTAMINATED":
      return { kind, patch: patchWith("a"), similarity: 0.99, threshold: 0.95 };
    case "PROVIDER_ERROR":
      return { kind, status: 503, reason: "unavailable", retries: 2 };
    case "BUDGET_STOP":
      return { kind, tokensUsed: 10, ceiling: 10 };
    case "TRUNCATED":
      return { kind, finishReason: "length", completionTokens: 4096, maxTokens: 4096, contentChars: 10 };
  }
}

// ------------------------------------------------------- the lineage key

describe("trajectory construction", () => {
  test("groups five rounds into one trajectory, not five of one", () => {
    // This is the regression guard. `SweepRecord.key` differs on every row here
    // because `cellKey` embeds the round, so grouping on it yields five
    // trajectories of depth 1 instead of one of depth 5.
    const rows = [
      row({ strategy: "l0_baseline", round: 0 }),
      row({ round: 1 }),
      row({ round: 2 }),
      row({ round: 3 }),
      row({ round: 4 }),
    ];
    expect(new Set(rows.map((r) => r.key)).size).toBe(5); // the trap, made explicit

    const traces = liveTrajectories(rows);
    expect(traces).toHaveLength(1);
    expect(traces[0]!.lineTrace).toHaveLength(5);
    expect(traces[0]!.rounds).toEqual([0, 1, 2, 3, 4]);
    expect(traces[0]!.lineTrace.length).toBeGreaterThanOrEqual(LOST_DEFAULTS.window);
  });

  test("the baseline is prepended as attempt 1, and its absence is recorded", () => {
    const withBase = liveTrajectories([
      row({ strategy: "l0_baseline", round: 0 }),
      row({ round: 1 }),
      row({ round: 2 }),
    ]);
    expect(withBase[0]!.hasBaseline).toBe(true);
    expect(withBase[0]!.lineTrace).toHaveLength(3);

    const without = liveTrajectories([row({ round: 1 }), row({ round: 2 })]);
    expect(without[0]!.hasBaseline).toBe(false);
    expect(without[0]!.lineTrace).toHaveLength(2);
  });

  test("a baseline is matched only to its own task, model, format and repeat", () => {
    // A baseline from a different model must not head this lineage.
    const traces = liveTrajectories([
      row({ strategy: "l0_baseline", round: 0, model: "muse_30b" }),
      row({ round: 1, model: "nemotron_ultra" }),
    ]);
    expect(traces).toHaveLength(1);
    expect(traces[0]!.hasBaseline).toBe(false);
  });

  test("repeats are separate trajectories, not deeper ones", () => {
    const traces = liveTrajectories([
      row({ round: 1, repeat: 0 }),
      row({ round: 2, repeat: 0 }),
      row({ round: 1, repeat: 1 }),
      row({ round: 2, repeat: 1 }),
    ]);
    expect(traces).toHaveLength(2);
    for (const t of traces) expect(t.lineTrace).toHaveLength(2);
    expect(traces.map((t) => t.repeat).sort()).toEqual([0, 1]);
  });

  test("l0_baseline is a head, never a trajectory of its own", () => {
    expect(liveTrajectories([row({ strategy: "l0_baseline", round: 0 })])).toHaveLength(0);
  });

  test("rounds out of file order still sort into attempt order", () => {
    const traces = liveTrajectories([row({ round: 3 }), row({ round: 1 }), row({ round: 2 })]);
    expect(traces[0]!.rounds).toEqual([1, 2, 3]);
  });

  test("attempts without a patch are excluded from the trace and counted", () => {
    const traces = liveTrajectories([
      row({ round: 1 }),
      row({ round: 2, patch: null, outcome: sample("MALFORMED") }),
      row({ round: 3, patch: "   ", outcome: sample("MALFORMED") }),
      row({ round: 4 }),
    ]);
    expect(traces[0]!.lineTrace).toHaveLength(2);
    expect(traces[0]!.attemptsWithoutPatch).toBe(2);
    expect(traces[0]!.rounds).toEqual([1, 4]);
  });
});

// --------------------------------------------------------------- LOST

describe("LOST over live trajectories", () => {
  test("fires when the model re-proposes the same edit", () => {
    // Four attempts, all the identical patch — including the baseline.
    //
    // Attempt 1 is novelty 1 by definition, so a window of 3 cannot average
    // below ε = 0.2 until three *repeats* have followed it: the means are
    // (1+0+0)/3 = 0.333 and then (0+0+0)/3 = 0. Three attempts therefore never
    // fire however repetitive they are, which is `lostAt` being conservative
    // rather than a defect, and the first version of this test asserted
    // otherwise and failed. The live data shows the same shape at scale:
    // novelty 1.000 -> 0.000 -> 0.000 -> 0.000.
    const same = patchWith("identical");
    const traces = liveTrajectories([
      row({ strategy: "l0_baseline", round: 0, patch: same }),
      row({ round: 1, patch: same }),
      row({ round: 2, patch: same }),
      row({ round: 3, patch: same }),
    ]);
    expect(traces[0]!.lineTrace.map((s) => s.novelty)).toEqual([1, 0, 0, 0]);
    expect(traces[0]!.lostLine).toBe(4);
  });

  test("three identical attempts are not yet enough to fire", () => {
    const same = patchWith("identical");
    const traces = liveTrajectories([
      row({ strategy: "l0_baseline", round: 0, patch: same }),
      row({ round: 1, patch: same }),
      row({ round: 2, patch: same }),
    ]);
    expect(traces[0]!.lineTrace).toHaveLength(LOST_DEFAULTS.window);
    expect(traces[0]!.lostLine).toBeNull();
  });

  test("does not fire when every attempt is genuinely new", () => {
    const traces = liveTrajectories([
      row({ strategy: "l0_baseline", round: 0, patch: patchWith("a") }),
      row({ round: 1, patch: patchWith("b") }),
      row({ round: 2, patch: patchWith("c") }),
      row({ round: 3, patch: patchWith("d") }),
    ]);
    expect(traces[0]!.lostLine).toBeNull();
  });

  test("cannot fire below the window, however repetitive", () => {
    const same = patchWith("identical");
    const traces = liveTrajectories([row({ round: 1, patch: same }), row({ round: 2, patch: same })]);
    expect(traces[0]!.lineTrace.length).toBeLessThan(LOST_DEFAULTS.window);
    expect(traces[0]!.lostLine).toBeNull();
  });

  test("lostByStrategy reports exposure, so a firing count is interpretable", () => {
    const same = patchWith("identical");
    // Exposure is matched at four attempts each: the point of the table is that
    // the two strategies differ in firing, not in how many chances they got.
    const rows = [
      // reflection: repetitive, eligible, fires
      row({ strategy: "l2_reflection", round: 1, patch: same }),
      row({ strategy: "l2_reflection", round: 2, patch: same }),
      row({ strategy: "l2_reflection", round: 3, patch: same }),
      row({ strategy: "l2_reflection", round: 4, patch: same }),
      // blind retry: novel, eligible, does not fire
      row({ strategy: "l1_blind_retry", round: 1, patch: patchWith("a") }),
      row({ strategy: "l1_blind_retry", round: 2, patch: patchWith("b") }),
      row({ strategy: "l1_blind_retry", round: 3, patch: patchWith("c") }),
      row({ strategy: "l1_blind_retry", round: 4, patch: patchWith("d") }),
    ];
    const s = liveTriageSummary(rows);
    const refl = s.lostByStrategy.find((r) => r.strategy === "l2_reflection")!;
    const blind = s.lostByStrategy.find((r) => r.strategy === "l1_blind_retry")!;
    expect(refl.eligible).toBe(1);
    expect(refl.fired).toBe(1);
    expect(refl.distinctTasks).toBe(1);
    expect(blind.eligible).toBe(1);
    expect(blind.fired).toBe(0);
  });
});

// ------------------------------------------------------- LOGIC is unreachable

describe("LOGIC cannot be observed without test verification", () => {
  test("an applied-but-untested patch is unverified, not a logic failure", () => {
    const [rec] = liveTriageTable([row({ outcome: sample("APPLIED") })]);
    expect(rec!.cls).toBeNull();
    expect(rec!.evidenceField).toBe("verification");
    expect(rec!.evidence).toContain("Docker");
  });

  test("no live row anywhere classifies as LOGIC", () => {
    const rows = OUTCOME_KINDS.map((kind, i) => row({ round: i + 1, outcome: sample(kind) }));
    const s = liveTriageSummary(rows);
    expect(s.counts.LOGIC).toBe(0);
    expect(s.logicObservable).toBe(false);
  });
});

// ----------------------------------------------------------------- totality

describe("the taxonomy is total over live rows", () => {
  test("every outcome kind is placed in a class, unverified, or contaminated", () => {
    for (const kind of OUTCOME_KINDS) {
      const [rec] = liveTriageTable([row({ outcome: sample(kind) })]);
      const placed =
        rec!.cls !== null ||
        rec!.evidenceField === "verification" ||
        rec!.evidenceField === "outcome.similarity";
      expect(placed).toBe(true);
    }
  });

  test("counts and the measuring split add up to the row count", () => {
    const rows = OUTCOME_KINDS.map((kind, i) => row({ round: i + 1, outcome: sample(kind) }));
    const s = liveTriageSummary(rows);
    const { FORMAT, LOGIC, BROKEN, unverified, contaminated } = s.counts;
    // LOST is excluded: it is a property of a sequence, so it is not a partition
    // of the rows and must never be added to a row-level total.
    expect(FORMAT + LOGIC + BROKEN + unverified + contaminated).toBe(rows.length);
    expect(s.measuring + s.notMeasuring).toBe(rows.length);
  });

  test("model calls to classify anything is zero — the feasibility claim", () => {
    expect(liveTriageSummary([row()]).modelCalls).toBe(0);
  });

  test("a torn file is surfaced, not assumed away", () => {
    expect(liveTriageSummary([row()], 7).skipped).toBe(7);
  });
});

// ------------------------------------------------------------------- report

describe("the report states its own limits", () => {
  const s = liveTriageSummary([
    row({ strategy: "l0_baseline", round: 0 }),
    row({ round: 1 }),
    row({ round: 2, outcome: sample("MALFORMED"), patch: null }),
    row({ round: 3, outcome: sample("PROVIDER_ERROR"), patch: null }),
  ]);
  const body = renderLiveTriageReport(s);

  test("names LOGIC as unobservable rather than printing a bare zero", () => {
    expect(body).toContain("needs `resolved === false`");
    expect(body).toContain("Docker");
  });

  test("declares that no row is test-verified", () => {
    expect(body).toContain("No row here is test-verified");
  });

  test("declares the two datasets are not interchangeable", () => {
    expect(body).toContain("not interchangeable");
  });

  test("publishes the count of attempts dropped for having no patch", () => {
    expect(body).toContain("carrying no patch");
  });

  test("quotes the RoundId type that made LOST unobservable", () => {
    expect(body).toContain('"R0" | "R1" | "R2"');
  });
});
