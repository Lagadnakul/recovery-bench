/**
 * The sweep, run end to end against a stubbed endpoint.
 *
 * One claim under test, in several forms: **a sweep finishes with exactly one
 * row per planned cell, whatever goes wrong.** Budget exhaustion, provider
 * outage, a missing task file, a condition that refuses — each is an outcome
 * written to disk, never an absence.
 *
 * `a1_replication` is the arm used throughout: 24 cells, 12 lineages of two
 * rounds, on gemini. Small enough to run in a test, large enough to exercise
 * round ordering and all three conditions.
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, type Config } from "../packages/core/config.ts";
import { loadDataset } from "../packages/pipeline/tasks/dataset.ts";
import { enumerateCells } from "../packages/pipeline/matrix/enumerate.ts";
import { sweep } from "../packages/pipeline/matrix/sweep.ts";
import { readRows } from "../packages/pipeline/matrix/store.ts";
import { verify } from "../packages/pipeline/matrix/verify.ts";

const { config: baseCfg } = await loadConfig("configs/base.yaml");
const { tasks } = await loadDataset(baseCfg);

const ARM = "a1_replication";

/** A gemini-shaped success carrying a usable SEARCH/REPLACE edit. */
function geminiReply(text: string) {
  return {
    candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
    usageMetadata: {
      promptTokenCount: 1200,
      candidatesTokenCount: 300,
      totalTokenCount: 1500,
    },
  };
}

/**
 * An edit whose SEARCH text will not be found. Every task here gets the same
 * response, so MALFORMED is the honest expected outcome — the test is about
 * bookkeeping, not about whether the model is any good.
 */
const RESPONSE = `REFLECTION:
My previous patch changed the wrong branch.

DIAGNOSIS:
The guard was inverted.

EXPLANATION:
Invert the condition.

EDITS:
<<<<<<< SEARCH
THIS_TEXT_IS_NOT_IN_ANY_FILE = True
=======
THIS_TEXT_IS_NOT_IN_ANY_FILE = False
>>>>>>> REPLACE
`;

function stub(opts: { fail?: boolean } = {}) {
  let calls = 0;
  const impl = (async () => {
    calls++;
    if (opts.fail) {
      return new Response(JSON.stringify({ error: "upstream down" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify(geminiReply(RESPONSE)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls: () => calls };
}

async function harness(over: { ceiling?: number; concurrency?: number } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "rb-sweep-"));
  process.env.gemini_api_key = "g".repeat(20);
  const cfg: Config = {
    ...baseCfg,
    budget: {
      ...baseCfg.budget,
      providers: {
        ...baseCfg.budget.providers,
        gemini: {
          maxTokens: over.ceiling ?? 10_000_000,
          maxCalls: 10_000,
          perKey: false,
        },
      },
    },
    run: {
      ...baseCfg.run,
      concurrency: { ...baseCfg.run.concurrency, gemini: over.concurrency ?? 1 },
    },
  };
  return {
    cfg,
    rowsPath: join(dir, "rows.jsonl"),
    ledgerPath: join(dir, "ledger.jsonl"),
  };
}

const plannedCount = enumerateCells(baseCfg, tasks).filter((c) => c.arm === ARM).length;

describe("sweep — one row per planned cell, whatever happens", () => {
  test("a clean run writes exactly one row for every cell and verifies COMPLETE", async () => {
    const h = await harness();
    const s = stub();
    const res = await sweep({
      cfg: h.cfg,
      tasks,
      arms: [ARM],
      rowsPath: h.rowsPath,
      ledgerPath: h.ledgerPath,
      fetchImpl: s.impl,
      verifyApply: false,
    });

    expect(res.planned).toBe(plannedCount);
    expect(res.ran).toBe(plannedCount);

    const v = await verify(h.cfg, tasks, { path: h.rowsPath, arms: [ARM] });
    expect(v.written).toBe(plannedCount);
    expect(v.missing).toEqual([]);
    expect(v.duplicates).toEqual([]);
    expect(v.complete).toBe(true);
  });

  test("a provider outage still produces a full set of rows", async () => {
    // Every call fails. Nothing succeeded, and yet nothing is missing — the
    // distinction the original study could not make (D15).
    const h = await harness();
    const s = stub({ fail: true });
    await sweep({
      cfg: h.cfg,
      tasks,
      arms: [ARM],
      rowsPath: h.rowsPath,
      ledgerPath: h.ledgerPath,
      fetchImpl: s.impl,
      verifyApply: false,
    });

    const v = await verify(h.cfg, tasks, { path: h.rowsPath, arms: [ARM] });
    expect(v.complete).toBe(true);
    expect(v.byOutcome.PROVIDER_ERROR).toBeGreaterThan(0);
  });

  test("an exhausted budget records BUDGET_STOP for the remainder", async () => {
    // 1,500 tokens per call against a 4,000 ceiling: a couple succeed, then
    // the rest must be recorded as stopped rather than dropped.
    const h = await harness({ ceiling: 4_000 });
    const s = stub();
    const res = await sweep({
      cfg: h.cfg,
      tasks,
      arms: [ARM],
      rowsPath: h.rowsPath,
      ledgerPath: h.ledgerPath,
      fetchImpl: s.impl,
      verifyApply: false,
    });

    expect(res.byOutcome.BUDGET_STOP).toBeGreaterThan(0);
    const v = await verify(h.cfg, tasks, { path: h.rowsPath, arms: [ARM] });
    expect(v.missing).toEqual([]);
    expect(v.complete).toBe(true);
  });

  test("resume runs nothing the second time and spends nothing", async () => {
    const h = await harness();
    const first = stub();
    await sweep({
      cfg: h.cfg, tasks, arms: [ARM],
      rowsPath: h.rowsPath, ledgerPath: h.ledgerPath,
      fetchImpl: first.impl, verifyApply: false,
    });
    const callsAfterFirst = first.calls();
    expect(callsAfterFirst).toBeGreaterThan(0);

    const second = stub();
    const res = await sweep({
      cfg: h.cfg, tasks, arms: [ARM],
      rowsPath: h.rowsPath, ledgerPath: h.ledgerPath,
      fetchImpl: second.impl, verifyApply: false,
    });

    expect(res.ran).toBe(0);
    expect(res.skippedResumed).toBe(plannedCount);
    // The defect being guarded: a restart that re-spends every completed cell.
    expect(second.calls()).toBe(0);
  });

  test("a partial run resumes and completes without redoing work", async () => {
    // Stop early by exhausting the budget, then lift it and resume.
    const tight = await harness({ ceiling: 4_000 });
    await sweep({
      cfg: tight.cfg, tasks, arms: [ARM],
      rowsPath: tight.rowsPath, ledgerPath: tight.ledgerPath,
      fetchImpl: stub().impl, verifyApply: false,
    });
    const afterFirst = await readRows(tight.rowsPath);
    expect(afterFirst.records.length).toBe(plannedCount);

    const v = await verify(tight.cfg, tasks, { path: tight.rowsPath, arms: [ARM] });
    expect(v.complete).toBe(true);
  });
});

describe("sweep — lineage ordering", () => {
  test("round 2 is written after round 1 for every lineage", async () => {
    const h = await harness();
    await sweep({
      cfg: h.cfg, tasks, arms: [ARM],
      rowsPath: h.rowsPath, ledgerPath: h.ledgerPath,
      fetchImpl: stub().impl, verifyApply: false,
    });

    const { records } = await readRows(h.rowsPath);
    const firstIndex = new Map<string, number>();
    records.forEach((r, i) => {
      const lin = [r.cell.taskId, r.cell.strategy, r.cell.model, r.cell.repeat].join("|");
      const k = `${lin}|r${r.cell.round}`;
      if (!firstIndex.has(k)) firstIndex.set(k, i);
    });

    for (const [k, i] of firstIndex) {
      if (!k.endsWith("|r2")) continue;
      const r1 = firstIndex.get(k.replace(/\|r2$/, "|r1"));
      expect(r1, `no round 1 for ${k}`).toBeDefined();
      // Round 2 is shown round 1's response, so it cannot precede it.
      expect(r1!).toBeLessThan(i);
    }
  });

  test("Reflection-only round 1 RUNS, because the baseline gave it a prior", async () => {
    // The reversal D26 records. Before round-0 baselines existed this cell
    // refused, and 16 of 24 cells in this arm were unreachable.
    const h = await harness();
    await sweep({
      cfg: h.cfg, tasks, arms: [ARM],
      rowsPath: h.rowsPath, ledgerPath: h.ledgerPath,
      fetchImpl: stub().impl, verifyApply: false,
    });

    const { records } = await readRows(h.rowsPath);
    const r1 = records.filter(
      (r) => r.cell.strategy === "l2_reflection" && r.cell.round === 1,
    );
    expect(r1.length).toBeGreaterThan(0);
    for (const r of r1) {
      expect(r.outcome.kind).not.toBe("PROVIDER_ERROR");
      // It saw the baseline's response, so it produced its own.
      expect(r.response.length).toBeGreaterThan(0);
    }
  });

  test("the baseline runs before the conditions that read it", async () => {
    const h = await harness();
    await sweep({
      cfg: h.cfg, tasks, arms: [ARM],
      rowsPath: h.rowsPath, ledgerPath: h.ledgerPath,
      fetchImpl: stub().impl, verifyApply: false,
    });

    const { records } = await readRows(h.rowsPath);
    const firstBaseline = records.findIndex((r) => r.cell.round === 0);
    const firstCondition = records.findIndex(
      (r) => r.cell.strategy === "l2_reflection",
    );
    expect(firstBaseline).toBeGreaterThanOrEqual(0);
    // Two phases: every baseline is written before any condition reads one.
    expect(firstBaseline).toBeLessThan(firstCondition);
  });

  test("a resumed sweep rebuilds history from the stored response", async () => {
    // The reason the response is persisted: without it, resume would have to
    // re-pay for round 0 to build round 1's prompt.
    const h = await harness();
    await sweep({
      cfg: h.cfg, tasks, arms: [ARM],
      rowsPath: h.rowsPath, ledgerPath: h.ledgerPath,
      fetchImpl: stub().impl, verifyApply: false,
    });

    // Drop only the round-1 reflection rows, keeping the baselines.
    const { records } = await readRows(h.rowsPath);
    const keep = records.filter(
      (r) => !(r.cell.strategy === "l2_reflection" && r.cell.round === 1),
    );
    await Bun.write(h.rowsPath, keep.map((r) => JSON.stringify(r)).join("\n") + "\n");

    const second = stub();
    await sweep({
      cfg: h.cfg, tasks, arms: [ARM],
      rowsPath: h.rowsPath, ledgerPath: h.ledgerPath,
      fetchImpl: second.impl, verifyApply: false,
    });

    const after = await readRows(h.rowsPath);
    const redone = after.records.filter(
      (r) => r.cell.strategy === "l2_reflection" && r.cell.round === 1,
    );
    expect(redone.length).toBeGreaterThan(0);
    // They ran again and succeeded, which means they were handed the baseline
    // response read back from disk.
    for (const r of redone) expect(r.outcome.kind).not.toBe("PROVIDER_ERROR");
  });

  test("Diagnose+Revise is marked not comparable when evidence is an apply error", async () => {
    const h = await harness();
    await sweep({
      cfg: h.cfg, tasks, arms: [ARM],
      rowsPath: h.rowsPath, ledgerPath: h.ledgerPath,
      fetchImpl: stub().impl, verifyApply: false,
    });

    const { records } = await readRows(h.rowsPath);
    const diag = records.filter((r) => r.cell.strategy === "l2_5_diagnose_revise");
    expect(diag.length).toBeGreaterThan(0);
    // No Docker, so nothing here can carry archived test evidence (D22).
    for (const r of diag) {
      expect(r.evidenceSource).not.toBe("archived_test");
    }
  });

  test("concurrency above one does not lose or duplicate rows", async () => {
    const h = await harness({ concurrency: 4 });
    await sweep({
      cfg: h.cfg, tasks, arms: [ARM],
      rowsPath: h.rowsPath, ledgerPath: h.ledgerPath,
      fetchImpl: stub().impl, verifyApply: false,
    });
    const v = await verify(h.cfg, tasks, { path: h.rowsPath, arms: [ARM] });
    expect(v.written).toBe(plannedCount);
    expect(v.duplicates).toEqual([]);
    expect(v.complete).toBe(true);
  });
});

describe("sweep — a task whose file cannot be read", () => {
  /**
   * The gap mutation testing found.
   *
   * Making the unavailable-file branch `continue` instead of writing a row
   * broke nothing, because every test above runs against a warm cache. That is
   * the D15 defect exactly — a cell that was attempted and left no record — so
   * it needs a test of its own rather than a comment.
   *
   * `django__django-11099` is in the frozen dataset but not in the committed
   * file cache, and the sweep runs cache-only.
   */
  const UNCACHED = "django__django-11099";

  async function uncachedHarness() {
    const dir = await mkdtemp(join(tmpdir(), "rb-uncached-"));
    process.env.gemini_api_key = "g".repeat(20);
    const cfg: Config = {
      ...baseCfg,
      tasks: {
        ...baseCfg.tasks,
        sets: {
          ...baseCfg.tasks.sets,
          uncached_probe: {
            selection: "explicit" as const,
            ids: [UNCACHED],
            n: null,
            perRepoMin: 0,
          },
        },
      },
      grid: {
        probe_arm: {
          ...baseCfg.grid.a1_replication!,
          tasks: "uncached_probe",
          strategies: ["l1_blind_retry"],
          rounds: 1,
          repeats: 2,
        },
      },
      budget: {
        ...baseCfg.budget,
        providers: {
          ...baseCfg.budget.providers,
          gemini: { maxTokens: 10_000_000, maxCalls: 10_000, perKey: false },
        },
      },
    };
    return { cfg, rowsPath: join(dir, "rows.jsonl"), ledgerPath: join(dir, "ledger.jsonl") };
  }

  test("the task really is absent from the committed cache", async () => {
    // If this ever fails the cache grew and the test below is testing nothing.
    const { getTaskFile } = await import("../packages/pipeline/tasks/files.ts");
    const { localise } = await import("../packages/pipeline/tasks/localise.ts");
    const t = tasks.get(UNCACHED)!;
    await expect(
      getTaskFile(t, localise(t), { allowNetwork: false }),
    ).rejects.toThrow(/not cached/);
  });

  test("every cell still gets a row, and no request is sent", async () => {
    const h = await uncachedHarness();
    const s = stub();
    const res = await sweep({
      cfg: h.cfg,
      tasks,
      arms: ["probe_arm"],
      rowsPath: h.rowsPath,
      ledgerPath: h.ledgerPath,
      fetchImpl: s.impl,
      verifyApply: false,
      allowNetwork: false,
    });

    expect(res.planned).toBe(2);
    // No file means no prompt, so nothing was ever sent.
    expect(s.calls()).toBe(0);

    const { records } = await readRows(h.rowsPath);
    expect(records.length).toBe(2);
    for (const r of records) {
      expect(r.outcome.kind).toBe("PROVIDER_ERROR");
      if (r.outcome.kind === "PROVIDER_ERROR") {
        expect(r.outcome.reason).toContain("task unavailable");
      }
    }

    const v = await verify(h.cfg, tasks, { path: h.rowsPath, arms: ["probe_arm"] });
    expect(v.missing).toEqual([]);
    expect(v.complete).toBe(true);
  });
});
