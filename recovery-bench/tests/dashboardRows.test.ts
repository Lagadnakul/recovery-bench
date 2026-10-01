/**
 * Normalisation, aggregation and the integrity rule at runtime.
 *
 * The pipeline makes "no resolve rate over apply-verified rows" a compile
 * error. The dashboard reads its rows from JSON, so the same rule has to be
 * enforced at runtime — and the failure mode it guards against is the one this
 * project exists to prevent: treating an unknown result as a negative one.
 */

import { describe, expect, test } from "bun:test";
import type { Outcome } from "../packages/core/types.ts";
import { parseJsonl } from "../packages/dashboard/src/model/load.ts";
import {
  applyRate,
  countByOutcome,
  formatClassCount,
  fromReplay,
  fromSweep,
  lineageOf,
  resolveRate,
  roundOf,
  shortTask,
  STAGES,
  stageReached,
  strategyLabel,
  toLineages,
  type ReplayRow,
  type SweepRecord,
  type ViewRow,
} from "../packages/dashboard/src/model/rows.ts";

const CELL: SweepRecord["cell"] = {
  taskId: "django__django-11620",
  strategy: "l2_reflection",
  model: "nemotron_ultra",
  editFormat: "search_replace",
  thinking: false,
  round: 1,
  repeat: 0,
};

function sweep(over: Partial<SweepRecord> = {}): SweepRecord {
  return {
    key: "k",
    arm: "a1_replication",
    runId: "full_grid",
    timestamp: "2026-09-30T09:04:53.076Z",
    cell: CELL,
    verification: "apply",
    outcome: { kind: "APPLIED", patch: "p", filesChanged: ["django/views/debug.py"] },
    usage: null,
    evidenceSource: "apply_error",
    comparableToChapter5: true,
    honouredCondition: true,
    patch: "p",
    response: "r",
    ...over,
  };
}

function replay(over: Partial<ReplayRow> = {}): ReplayRow {
  return {
    taskId: "astropy__astropy-7746",
    run: "day10_test",
    condition: "Reflection-only",
    round: "R1",
    patchFormat: "diff",
    verification: "test",
    outcome: "APPLIED",
    gitError: null,
    resolved: false,
    tests: { f2pPassed: 0, f2pTotal: 1, p2pPassed: 56, p2pTotal: 56 },
    timestamp: "2026-08-29T05:51:51Z",
    ...over,
  };
}

describe("labels", () => {
  test("a task id is shortened to its instance", () => {
    expect(shortTask("django__django-11620")).toBe("django-11620");
    expect(shortTask("astropy__astropy-7746")).toBe("astropy-7746");
  });

  test("a task id with no separator is left alone", () => {
    expect(shortTask("weird-id")).toBe("weird-id");
  });

  test("strategy ids map to the thesis's own condition names", () => {
    expect(strategyLabel("l2_5_diagnose_revise")).toBe("Diagnose+Revise");
    expect(strategyLabel("l0_baseline")).toBe("Baseline");
  });

  test("an unknown strategy shows its id rather than an empty cell", () => {
    expect(strategyLabel("l9_invented")).toBe("l9_invented");
  });
});

describe("normalising the two datasets", () => {
  test("a sweep row is apply-verified and carries no resolve verdict", () => {
    const r = fromSweep(sweep());
    expect(r.verification).toBe("apply");
    expect(r.resolved).toBeNull();
    expect(r.tests).toBeNull();
    expect(r.source).toBe("sweep");
  });

  test("a sweep row keeps its provenance fields", () => {
    const r = fromSweep(sweep({ evidenceSource: "none", comparableToChapter5: false }));
    expect(r.evidenceSource).toBe("none");
    expect(r.comparableToChapter5).toBe(false);
  });

  test("a test-verified replay row keeps its verdict and counts", () => {
    const r = fromReplay(replay(), 0);
    expect(r.verification).toBe("test");
    expect(r.resolved).toBe(false);
    expect(r.tests?.f2pTotal).toBe(1);
    expect(r.conditionLabel).toBe("Reflection-only");
    expect(r.strategy).toBe("l2_reflection");
  });

  test("an apply-verified replay row never carries a verdict", () => {
    const r = fromReplay(
      replay({ verification: "apply", outcome: "APPLY_FAIL", resolved: null, tests: null }),
      0,
    );
    expect(r.resolved).toBeNull();
    expect(r.outcomeKind).toBe("APPLY_FAIL");
  });

  test("an archived git error survives into the outcome payload", () => {
    const r = fromReplay(
      replay({
        verification: "apply",
        outcome: "APPLY_FAIL",
        gitError: "patch: **** Only garbage was found in the patch input.",
        resolved: null,
        tests: null,
      }),
      0,
    );
    expect(r.outcome.kind).toBe("APPLY_FAIL");
    if (r.outcome.kind === "APPLY_FAIL") {
      expect(r.outcome.gitStderr).toContain("Only garbage");
    }
  });

  test("a missing git error says the archive kept none rather than inventing one", () => {
    const r = fromReplay(
      replay({ verification: "apply", outcome: "APPLY_FAIL", gitError: null, resolved: null, tests: null }),
      0,
    );
    if (r.outcome.kind === "APPLY_FAIL") {
      expect(r.outcome.gitStderr).toContain("archive kept no stderr");
    }
  });

  test("round labels parse, and an unparseable one does not become NaN", () => {
    expect(roundOf("R0")).toBe(0);
    expect(roundOf("R2")).toBe(2);
    expect(roundOf("")).toBe(0);
    expect(roundOf("later")).toBe(0);
  });

  test("replay ids are unique even for otherwise identical rows", () => {
    const a = fromReplay(replay(), 0);
    const b = fromReplay(replay(), 1);
    expect(a.id).not.toBe(b.id);
  });
});

describe("lineages", () => {
  test("the lineage excludes the round, so rounds group onto one line", () => {
    const r0 = lineageOf({ ...CELL, round: 0 });
    const r2 = lineageOf({ ...CELL, round: 2 });
    expect(r0).toBe(r2);
    expect(r0).not.toContain("r0");
  });

  test("the lineage keeps every other axis", () => {
    expect(lineageOf(CELL)).not.toBe(lineageOf({ ...CELL, thinking: true }));
    expect(lineageOf(CELL)).not.toBe(lineageOf({ ...CELL, repeat: 1 }));
    expect(lineageOf(CELL)).not.toBe(lineageOf({ ...CELL, model: "muse_30b" }));
  });

  test("three rounds of one lineage become one row with three cells", () => {
    const rows = [0, 1, 2].map((round) =>
      fromSweep(sweep({ key: `k${round}`, cell: { ...CELL, round } })),
    );
    const lineages = toLineages(rows);
    expect(lineages.length).toBe(1);
    expect([...(lineages[0]?.rounds.keys() ?? [])].sort()).toEqual([0, 1, 2]);
  });

  test("a lineage missing a round has a hole, not a substitute", () => {
    const rows = [0, 2].map((round) =>
      fromSweep(sweep({ key: `k${round}`, cell: { ...CELL, round } })),
    );
    const l = toLineages(rows)[0];
    expect(l?.rounds.has(1)).toBe(false);
    expect(l?.rounds.size).toBe(2);
  });
});

describe("rates", () => {
  const kinds = (...ks: ViewRow["outcomeKind"][]): ViewRow[] =>
    ks.map((kind, i) => {
      // Annotated rather than `as const`: `as const` makes `filesChanged`
      // `readonly []`, which `Outcome` does not accept.
      const outcome: Outcome =
        kind === "APPLIED"
          ? { kind, patch: "p", filesChanged: [] }
          : kind === "APPLY_FAIL"
            ? { kind, patch: "p", gitStderr: "no" }
            : kind === "TRUNCATED"
              ? {
                  kind,
                  finishReason: "length",
                  completionTokens: 1,
                  maxTokens: 1,
                  contentChars: 0,
                }
              : kind === "PROVIDER_ERROR"
                ? { kind, status: 429, reason: "rate", retries: 1 }
                : { kind: "NO_PATCH", responseChars: 10 };
      return fromSweep(sweep({ key: `k${i}`, outcome }));
    });

  test("instrument limits leave both numerator and denominator", () => {
    const r = applyRate(kinds("APPLIED", "APPLY_FAIL", "TRUNCATED", "PROVIDER_ERROR"));
    expect(r.applied).toBe(1);
    expect(r.measured).toBe(2);
    expect(r.setAside).toBe(2);
  });

  test("a set of only instrument limits measures nothing, and says so", () => {
    const r = applyRate(kinds("TRUNCATED", "PROVIDER_ERROR"));
    expect(r.measured).toBe(0);
    expect(r.applied).toBe(0);
    expect(r.setAside).toBe(2);
  });

  test("format-class counts the three predicate members only", () => {
    expect(formatClassCount(kinds("APPLY_FAIL", "NO_PATCH", "TRUNCATED", "APPLIED"))).toBe(2);
  });

  test("a resolve rate ignores apply-verified rows instead of scoring them unresolved", () => {
    const applyVerified = fromSweep(sweep());
    const testedPass = fromReplay(replay({ resolved: true }), 0);
    const testedFail = fromReplay(replay({ resolved: false }), 1);

    const r = resolveRate([applyVerified, testedPass, testedFail]);
    expect(r.tested).toBe(2);
    expect(r.resolved).toBe(1);
    expect(r.skippedApplyVerified).toBe(1);
    // The bug this guards: 1/3 instead of 1/2, by counting an unknown as a no.
    expect(r.resolved / r.tested).toBe(0.5);
  });

  test("counting by outcome totals the rows", () => {
    const rows = kinds("APPLIED", "APPLIED", "APPLY_FAIL");
    const c = countByOutcome(rows);
    expect(c.get("APPLIED")).toBe(2);
    expect(c.get("APPLY_FAIL")).toBe(1);
    expect([...c.values()].reduce((a, b) => a + b, 0)).toBe(rows.length);
  });
});

describe("how far a cell got", () => {
  test("an applied cell completed every stage", () => {
    expect(stageReached("APPLIED")).toBe(STAGES.length - 1);
    expect(stageReached("CONTAMINATED")).toBe(STAGES.length - 1);
  });

  test("a budget stop never reached the call", () => {
    const call = STAGES.indexOf("call");
    expect(stageReached("BUDGET_STOP")).toBeLessThan(call);
  });

  test("a parse failure got past the call and no further", () => {
    const parse = STAGES.indexOf("parse");
    expect(stageReached("MALFORMED")).toBe(parse);
    expect(stageReached("NO_PATCH")).toBe(parse);
  });

  test("an apply failure reached apply", () => {
    expect(stageReached("APPLY_FAIL")).toBe(STAGES.indexOf("apply"));
  });

  test("every stage index is within the stage list", () => {
    for (const kind of ["APPLIED", "MALFORMED", "BUDGET_STOP", "TRUNCATED"] as const) {
      const i = stageReached(kind);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(STAGES.length);
    }
  });
});

describe("reading the sweep file", () => {
  test("well-formed lines parse", () => {
    const text = [JSON.stringify(sweep({ key: "a" })), JSON.stringify(sweep({ key: "b" }))].join(
      "\n",
    );
    const { records, skipped } = parseJsonl(text);
    expect(records.length).toBe(2);
    expect(skipped).toBe(0);
  });

  test("a torn final line is skipped and counted, not fatal", () => {
    const text = `${JSON.stringify(sweep({ key: "a" }))}\n{"key":"b","outcome":{"kin`;
    const { records, skipped } = parseJsonl(text);
    expect(records.length).toBe(1);
    expect(skipped).toBe(1);
  });

  test("a line that parses but is not a row is skipped", () => {
    const { records, skipped } = parseJsonl('{"hello":"world"}');
    expect(records.length).toBe(0);
    expect(skipped).toBe(1);
  });

  test("blank lines are not defects", () => {
    const text = `\n${JSON.stringify(sweep())}\n\n`;
    const { records, skipped } = parseJsonl(text);
    expect(records.length).toBe(1);
    expect(skipped).toBe(0);
  });

  test("an empty file is an empty dataset, not an error", () => {
    expect(parseJsonl("")).toEqual({ records: [], skipped: 0 });
  });
});
