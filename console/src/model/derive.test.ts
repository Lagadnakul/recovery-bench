import { describe, expect, test } from "bun:test";
import { loadRows, loadProvenance, ARMS } from "./rows";
import {
  applyRateByFormat,
  armSummary,
  belief,
  classify,
  holes,
  malformedByReason,
  mcNemar,
  outcomeKinds,
  refusalKind,
  reflectionHarm,
  REJECTION_FLOOR,
  roundSeries,
  shouldRetry,
  splitProviderError,
  thetaFor,
  totals,
} from "./derive";

/**
 * These tests are the audit of every number the console shows.
 *
 * They assert against CONSOLE.md §3, which was itself verified against
 * recovery-bench/data/sweep_rows.jsonl. If a figure on a screen ever disagrees
 * with the paper, one of these fails.
 */

const rows = loadRows();

describe("the snapshot", () => {
  test("parses, and is the size the paper claims", () => {
    expect(rows).toHaveLength(1604);
    expect(loadProvenance().rows).toBe(1604);
  });

  test("R1 cannot quietly stop being true", () => {
    // Every screen showing an apply rate carries "APPLIED is not RESOLVED".
    // If a future sweep ever runs under Docker, this fails and the claim has to
    // be revisited deliberately rather than silently becoming wrong.
    for (const row of rows) {
      expect(row.evidenceSource).toBe("none");
      expect(row.verification).toBe("apply");
    }
  });

  test("all six arms are present", () => {
    expect(new Set(rows.map((r) => r.arm)).size).toBe(ARMS.length);
  });

  test("no duplicate cell keys", () => {
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });
});

describe("totals", () => {
  const t = totals(rows);

  test("match the paper exactly", () => {
    expect(t.rows).toBe(1604);
    expect(t.calls).toBe(1428);
    expect(t.tokens).toBe(18102295);
    expect(t.arms).toBe(6);
    expect(t.models).toBe(5);
  });

  test("a call is a row with usage, and nothing else", () => {
    expect(rows.filter((r) => r.usage !== null)).toHaveLength(t.calls);
    // The 176 rows with no usage are exactly the provider errors: no call was
    // made, so there is nothing to count.
    expect(rows.filter((r) => r.usage === null)).toHaveLength(176);
    for (const row of rows) {
      if (row.usage === null) expect(row.outcome.kind).toBe("PROVIDER_ERROR");
    }
  });
});

describe("R2 — the provider-error split", () => {
  const split = splitProviderError(rows);

  test("176 rows are three different things", () => {
    expect(split.starved).toBe(98);
    expect(split.cascade).toBe(32);
    expect(split.real).toBe(46);
    expect(split.byDesign).toBe(130);
    expect(split.total).toBe(176);
  });

  test("status is NOT a usable discriminator", () => {
    // The trap this split exists to avoid. 145 rows have a null status, so
    // splitting on status would report 145 by-design refusals instead of 130 --
    // over-reporting by the 15 timeouts, which are real failures.
    const nullStatus = rows.filter(
      (r) =>
        r.outcome.kind === "PROVIDER_ERROR" &&
        (r.outcome.status === null || r.outcome.status === undefined),
    );
    expect(nullStatus).toHaveLength(145);
    expect(nullStatus.length).not.toBe(split.byDesign);
  });

  test("the cascade is D36's per-arm tally", () => {
    const byArm = new Map<string, number>();
    for (const row of rows) {
      if (refusalKind(row) === "CASCADE") {
        byArm.set(row.arm, (byArm.get(row.arm) ?? 0) + 1);
      }
    }
    expect(byArm.get("a1_replication")).toBe(4);
    expect(byArm.get("a2_workhorse")).toBe(8);
    expect(byArm.get("a4_reasoning")).toBe(20);
    expect([...byArm.values()].reduce((a, b) => a + b, 0)).toBe(32);
  });

  test("starvation hits only diagnose+revise", () => {
    for (const row of rows) {
      if (refusalKind(row) === "STARVED") {
        expect(row.cell.strategy).toBe("l2_5_diagnose_revise");
      }
    }
    expect(splitProviderError(rows).starved).toBe(98);
  });
});

describe("R3 — the holes", () => {
  test("32 cells, each with a reason", () => {
    const h = holes(rows);
    expect(h).toHaveLength(32);
    for (const hole of h) expect(hole.reason).toContain("needs a previous attempt");
  });

  test("they are a subset of the by-design refusals, not a separate count", () => {
    // Counting 130 refusals AND 32 holes independently double-counts these 32.
    const split = splitProviderError(rows);
    expect(holes(rows).length).toBe(split.cascade);
    expect(split.byDesign).toBe(split.starved + holes(rows).length);
  });
});

describe("armSummary", () => {
  const summaries = armSummary(rows);
  const bySlug = new Map(summaries.map((s) => [s.arm, s]));

  test("reproduces CONSOLE.md §3 row for row", () => {
    const expected: [string, number, number, number, number][] = [
      // arm, rows, tasks, models, maxRound
      ["a5_format_at_scale", 720, 60, 2, 1],
      ["a4_reasoning", 360, 4, 1, 4],
      ["a2_workhorse", 260, 4, 1, 4],
      ["a3_capability", 180, 4, 1, 4],
      ["a6_qwencloud", 56, 4, 1, 2],
      ["a1_replication", 28, 4, 1, 2],
    ];
    for (const [arm, n, tasks, models, maxRound] of expected) {
      const s = bySlug.get(arm as never);
      expect(s, arm).toBeDefined();
      expect(s!.rows, `${arm} rows`).toBe(n);
      expect(s!.tasks, `${arm} tasks`).toBe(tasks);
      expect(s!.models.length, `${arm} models`).toBe(models);
      expect(s!.maxRound, `${arm} maxRound`).toBe(maxRound);
    }
  });

  test("per-arm counts sum to the totals", () => {
    const sum = (pick: (s: (typeof summaries)[number]) => number) =>
      summaries.reduce((n, s) => n + pick(s), 0);
    expect(sum((s) => s.rows)).toBe(1604);
    expect(sum((s) => s.calls)).toBe(1428);
    expect(sum((s) => s.tokens)).toBe(18102295);
    expect(sum((s) => s.starved)).toBe(98);
    expect(sum((s) => s.cascade)).toBe(32);
    expect(sum((s) => s.realErrors)).toBe(46);
  });

  test("every outcome is accounted for in some bucket", () => {
    const kinds = outcomeKinds(rows);
    expect(kinds.reduce((n, k) => n + k.count, 0)).toBe(1604);
    const map = new Map(kinds.map((k) => [k.kind, k.count]));
    expect(map.get("APPLIED")).toBe(718);
    expect(map.get("MALFORMED")).toBe(572);
    expect(map.get("PROVIDER_ERROR")).toBe(176);
    expect(map.get("NO_PATCH")).toBe(102);
    expect(map.get("APPLY_FAIL")).toBe(17);
    expect(map.get("TRUNCATED")).toBe(13);
    expect(map.get("NO_OUTPUT")).toBe(6);
  });
});

describe("exact McNemar", () => {
  test("the rejection floor is 6, and it is arithmetic", () => {
    // 2 * (1/2)^m for the most extreme split: m=5 gives 0.0625 > 0.05.
    expect(mcNemar(5, 0).p).toBeCloseTo(0.0625, 6);
    expect(mcNemar(5, 0).canReject).toBe(false);
    expect(mcNemar(6, 0).p).toBeCloseTo(0.03125, 6);
    expect(mcNemar(6, 0).canReject).toBe(true);
    expect(REJECTION_FLOOR).toBe(6);
  });

  test("no discordant pairs is p = 1, not an error", () => {
    expect(mcNemar(0, 0).p).toBe(1);
    expect(mcNemar(0, 0).canReject).toBe(false);
  });

  test("a perfectly balanced split is p = 1", () => {
    expect(mcNemar(4, 4).p).toBe(1);
  });

  test("agrees with the engine on the reflection-harm result", () => {
    // ENGINE.md: a3 b=19, c=0, p = 3.8e-6
    const m = mcNemar(19, 0);
    expect(m.p).toBeLessThan(4e-6);
    expect(m.p).toBeGreaterThan(3.5e-6);
  });

  test("agrees with the engine on the a2 null", () => {
    // ENGINE.md: a2 b=4, c=4, p = 1.000
    expect(mcNemar(4, 4).p).toBeCloseTo(1, 6);
  });

  test("is symmetric", () => {
    expect(mcNemar(7, 3).p).toBeCloseTo(mcNemar(3, 7).p, 12);
  });
});

describe("finding 1 — edit format", () => {
  const result = applyRateByFormat(rows, "a5_format_at_scale");

  test("the rates match the paper", () => {
    expect(result.searchReplace.rows).toBe(360);
    expect(result.unifiedDiff.rows).toBe(360);
    expect(result.searchReplace.rate * 100).toBeCloseTo(96.4, 1);
    expect(result.unifiedDiff.rate * 100).toBeCloseTo(13.1, 1);
  });

  test("360 pairs, none dropped, 301-1", () => {
    expect(result.test.b).toBe(301);
    expect(result.test.c).toBe(1);
    expect(result.test.n).toBe(302);
    expect(result.test.concordant).toBe(58);
    expect(result.test.n + result.test.concordant).toBe(360);
    expect(result.test.dropped).toBe(0);
  });

  test("p reproduces ENGINE.md to three significant figures", () => {
    // 7.44e-89. Far above double precision's smallest normal (~2.2e-308), so
    // it is a real value and screen 3 can print it rather than a "< 0.001".
    expect(result.test.p).toBeGreaterThan(0);
    expect(result.test.p.toExponential(2)).toBe("7.44e-89");
  });
});

describe("finding 2 — reflection helps once, then poisons", () => {
  test("the round-by-round rates match ENGINE.md", () => {
    const blind = roundSeries(rows, "a3_capability", "l1_blind_retry");
    const reflect = roundSeries(rows, "a3_capability", "l2_reflection");

    expect(blind.map((p) => Math.round(p.rate * 100))).toEqual([75, 75, 80, 75]);
    expect(reflect.map((p) => Math.round(p.rate * 100))).toEqual([
      90, 45, 40, 50,
    ]);
    for (const point of [...blind, ...reflect]) expect(point.rows).toBe(20);
  });

  test("the paired test on rounds 2-4 is 19-0", () => {
    const harm = reflectionHarm(rows, "a3_capability");
    expect(harm.b).toBe(19);
    expect(harm.c).toBe(0);
    expect(harm.n).toBe(19);
    expect(harm.p).toBeLessThan(4e-6);
    expect(harm.canReject).toBe(true);
  });

  test("the 30B workhorse is exactly null", () => {
    const harm = reflectionHarm(rows, "a2_workhorse");
    expect(harm.b).toBe(4);
    expect(harm.c).toBe(4);
    expect(harm.p).toBeCloseTo(1, 6);
  });

  test("pooling round 1 would hide the harm, which is why it is excluded", () => {
    const fromRound1 = reflectionHarm(rows, "a3_capability", 1);
    const fromRound2 = reflectionHarm(rows, "a3_capability", 2);
    // Round 1 is where reflection WINS, so including it adds pairs on the
    // other side and weakens the result.
    expect(fromRound1.c).toBeGreaterThan(fromRound2.c);
    expect(fromRound1.p).toBeGreaterThan(fromRound2.p);
  });

  test("a3 rests on only 4 tasks — the clustering limitation, asserted", () => {
    const a3 = rows.filter((r) => r.arm === "a3_capability");
    expect(new Set(a3.map((r) => r.cell.taskId)).size).toBe(4);
    expect(new Set(a3.map((r) => r.cell.repeat)).size).toBe(5);
  });
});

describe("malformed reasons", () => {
  const reasons = malformedByReason(rows);

  test("match the paper, and sum to 572", () => {
    const map = new Map(reasons.map((r) => [r.reason, r.count]));
    expect(map.get("hunk_count_mismatch")).toBe(206);
    expect(map.get("block_unterminated")).toBe(182);
    expect(map.get("search_not_found")).toBe(86);
    expect(map.get("no_file_header")).toBe(80);
    expect(map.get("search_not_found_whitespace")).toBe(17);
    expect(map.get("hunk_header_unparseable")).toBe(1);
    expect(reasons.reduce((n, r) => n + r.count, 0)).toBe(572);
  });

  test("block_unterminated is relabelled for display only", () => {
    const row = reasons.find((r) => r.reason === "block_unterminated");
    expect(row?.label).toBe("Divider missing");
    // The underlying value is untouched, so it still matches the engine.
    expect(row?.reason).toBe("block_unterminated");
  });

  test("sorted by count, descending", () => {
    const counts = reasons.map((r) => r.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });
});

describe("classification", () => {
  test("APPLIED has no class — it is not a success either", () => {
    const applied = rows.find((r) => r.outcome.kind === "APPLIED")!;
    expect(classify(applied)).toBeNull();
  });

  test("a real provider failure is BROKEN, a by-design refusal is not", () => {
    const real = rows.find((r) => refusalKind(r) === "REAL")!;
    const starved = rows.find((r) => refusalKind(r) === "STARVED")!;
    expect(classify(real)).toBe("BROKEN");
    // D18: an instrument limit must never be folded into a failure rate.
    expect(classify(starved)).toBeNull();
  });

  test("BROKEN count equals the real-error count, and nothing else", () => {
    const broken = rows.filter((r) => classify(r) === "BROKEN").length;
    expect(broken).toBe(splitProviderError(rows).real);
    expect(broken).toBe(46);
  });

  test("no live row can be LOGIC, because no live row ran a test", () => {
    // R1 as a property of the classifier, not a caption.
    expect(rows.filter((r) => classify(r) === "LOGIC")).toHaveLength(0);
  });
});

describe("the stopping rule", () => {
  test("theta is q when retry and escalation cost the same", () => {
    expect(thetaFor(10, 2, 2, 0.8)).toBeCloseTo(0.8, 12);
  });

  test("cheaper human asking lowers the bar for escalating", () => {
    const expensive = thetaFor(10, 1, 9, 0.8);
    const cheap = thetaFor(10, 1, 2, 0.8);
    expect(cheap).toBeGreaterThan(expensive);
  });

  test("belief decays with attempt index", () => {
    const p0 = belief(3, 1, 0.7, 0);
    const p1 = belief(3, 1, 0.7, 1);
    const p2 = belief(3, 1, 0.7, 2);
    expect(p0).toBeCloseTo(0.75, 12);
    expect(p1).toBeLessThan(p0);
    expect(p2).toBeLessThan(p1);
  });

  test("the four arms are one policy at different thresholds", () => {
    // The structural claim, as a test rather than an assertion in prose.
    expect(shouldRetry(0.001, Number.NEGATIVE_INFINITY)).toBe(true);
    expect(shouldRetry(0.999, Number.POSITIVE_INFINITY)).toBe(false);
    const theta = thetaFor(10, 1, 4, 0.5);
    expect(shouldRetry(theta + 0.01, theta)).toBe(true);
    expect(shouldRetry(theta - 0.01, theta)).toBe(false);
  });
});
