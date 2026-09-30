/**
 * The grid: enumeration, projection, the row store, and the no-holes oracle.
 *
 * The oracle tests are the ones that matter. Everything else in step 6 is
 * machinery for running cells; `verify` is the claim that none of them went
 * missing, which is the defect the whole project was built against (D2, D15).
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, type Config } from "../packages/core/config.ts";
import { cellKey, type Cell } from "../packages/core/types.ts";
import { loadDataset } from "../packages/pipeline/tasks/dataset.ts";
import {
  baselineGroupId,
  enumerateCells,
  lineageId,
  summarise,
  toLineages,
} from "../packages/pipeline/matrix/enumerate.ts";
import { project, estimateCell } from "../packages/pipeline/matrix/project.ts";
import { RowStore, readRows, toRecord } from "../packages/pipeline/matrix/store.ts";
import { verify } from "../packages/pipeline/matrix/verify.ts";
import type { CellOutcome } from "../packages/pipeline/strategies/types.ts";

const { config: cfg } = await loadConfig("configs/base.yaml");
const { tasks } = await loadDataset(cfg);

const cell = (over: Partial<Cell> = {}): Cell => ({
  taskId: "django__django-11019",
  strategy: "l1_blind_retry",
  model: "muse_30b",
  editFormat: "search_replace",
  thinking: false,
  round: 1,
  repeat: 0,
  ...over,
});

const outcome = (c: Cell): CellOutcome => ({
  row: {
    cell: c,
    verification: "apply",
    outcome: { kind: "APPLIED", patch: "p", filesChanged: ["f.py"] },
    resolved: null,
    tests: null,
    usage: { promptTokens: 10, completionTokens: 20, reasoningTokens: null, latencyMs: 5 },
    runId: "test",
    timestamp: new Date().toISOString(),
  },
  response: "r",
  patch: "p",
  usage: { promptTokens: 10, completionTokens: 20, reasoningTokens: null, latencyMs: 5 },
  evidenceSource: "none",
  comparableToChapter5: true,
  honouredCondition: true,
});

// ───────────────────────────────────────────────────────────── enumeration
describe("enumeration", () => {
  test("the committed grid is 1,308 cells in 1,044 lineages", () => {
    // 1,224 condition cells plus 84 round-0 baselines — one per group, which
    // the recovery conditions read (D26). Before those existed, 2 of the 3
    // conditions could never run.
    const cells = enumerateCells(cfg, tasks);
    expect(cells.length).toBe(1308);
    expect(toLineages(cells).length).toBe(1044);
  });

  test("a baseline is inserted per group, not per condition", () => {
    const cells = enumerateCells(cfg, tasks);
    const baselines = cells.filter(
      (c) => c.cell.strategy === "l0_baseline" && c.cell.round === 0,
    );
    // a1: 4 tasks x 1 repeat = 4. a2, a3: 4 x 5 = 20 each.
    // a4: 4 x 2 thinking x 5 = 40. a5 needs none — it is already l0 at round 1.
    expect(baselines.length).toBe(84);
    expect(baselines.filter((b) => b.arm === "a1_replication").length).toBe(4);
    expect(baselines.filter((b) => b.arm === "a4_reasoning").length).toBe(40);
    expect(baselines.filter((b) => b.arm === "a5_format_at_scale").length).toBe(0);

    // One baseline shared by all three conditions of a group — as in the
    // original, where one day8_test attempt fed all three. A per-condition
    // baseline would give each a different failure to recover from.
    const groups = new Set(baselines.map((b) => baselineGroupId(b.cell)));
    expect(groups.size).toBe(baselines.length);
  });

  test("disabled arms contribute nothing", () => {
    const cells = enumerateCells(cfg, tasks);
    expect(cells.some((c) => c.arm === "a6_qwencloud")).toBe(false);
    expect(summarise(cfg, cells).disabledArms).toContain("a6_qwencloud");
  });

  test("enumeration is deterministic — same config, same order", () => {
    const a = enumerateCells(cfg, tasks).map((c) => cellKey(c.cell));
    const b = enumerateCells(cfg, tasks).map((c) => cellKey(c.cell));
    // Order decides which cells run before a budget runs out, so a
    // non-reproducible order would make two runs of one config incomparable.
    expect(a).toEqual(b);
  });

  test("every cell key is unique", () => {
    const cells = enumerateCells(cfg, tasks);
    const keys = new Set(cells.map((c) => cellKey(c.cell)));
    // A collision would let one result overwrite another, and the no-holes
    // check would still pass.
    expect(keys.size).toBe(cells.length);
  });

  test("arm cell counts match the config's own comments", () => {
    const by = summarise(cfg, enumerateCells(cfg, tasks)).byArm;
    // Config comments give the condition cells; baselines are added on top.
    expect(by.a1_replication).toBe(24 + 4);
    expect(by.a2_workhorse).toBe(120 + 20);
    expect(by.a3_capability).toBe(120 + 20);
    expect(by.a4_reasoning).toBe(240 + 40);
    expect(by.a5_format_at_scale).toBe(720);
  });

  test("a lineage is everything but the round, in round order", () => {
    const cells = enumerateCells(cfg, tasks).filter((c) => c.arm === "a2_workhorse");
    const lineages = toLineages(cells);
    // 60 condition lineages of 2 rounds, plus 20 baseline lineages of 1.
    expect(lineages.length).toBe(80);

    const conditions = lineages.filter((l) => l.cells[0]!.cell.strategy !== "l0_baseline");
    expect(conditions.length).toBe(60);
    for (const l of conditions) {
      expect(l.cells.map((c) => c.cell.round)).toEqual([1, 2]);
    }
    const baselines = lineages.filter((l) => l.cells[0]!.cell.strategy === "l0_baseline");
    expect(baselines.length).toBe(20);
    for (const l of baselines) {
      expect(l.cells.map((c) => c.cell.round)).toEqual([0]);
    }
  });

  test("the round is what lineageId drops, and nothing else", () => {
    const r1 = cell({ round: 1 });
    const r2 = cell({ round: 2 });
    expect(lineageId(r1)).toBe(lineageId(r2));
    // Anything else must separate lineages, or round 2 would be fed the wrong
    // round 1.
    expect(lineageId(r1)).not.toBe(lineageId(cell({ repeat: 1 })));
    expect(lineageId(r1)).not.toBe(lineageId(cell({ thinking: true })));
    expect(lineageId(r1)).not.toBe(lineageId(cell({ model: "nemotron_nano" })));
    expect(lineageId(r1)).not.toBe(lineageId(cell({ editFormat: "unified_diff" })));
  });

  test("an arm naming an unknown model fails loudly", () => {
    const bad: Config = {
      ...cfg,
      grid: {
        ...cfg.grid,
        broken: { ...cfg.grid.a1_replication!, models: ["no_such_model"] },
      },
    };
    expect(() => enumerateCells(bad, tasks)).toThrow(/unknown model/);
  });
});

// ───────────────────────────────────────────────────────────── projection
describe("projection", () => {
  test("the full grid fits across three separate accounts (D28)", async () => {
    // Three keys, three accounts, so capacity is 3 x 8M. Measured 14.27M.
    process.env.NVIDIA_KEY_1 = "a".repeat(20);
    process.env.NVIDIA_KEY_2 = "b".repeat(20);
    process.env.NVIDIA_KEY_3 = "c".repeat(20);
    const p = await project(cfg, enumerateCells(cfg, tasks), tasks);
    const nvidia = p.byProvider.find((x) => x.provider === "nvidia")!;
    expect(nvidia.keysSet).toBe(3);
    expect(nvidia.capacityTokens).toBe(24_000_000);
    expect(nvidia.fits).toBe(true);
    expect(p.fits).toBe(true);
  });

  test("with ONE key the same grid does not fit, and a5 is named", async () => {
    // The measurement that made this step necessary: 14.27M against a single
    // 8M account is 178% (D25).
    process.env.NVIDIA_KEY_1 = "a".repeat(20);
    delete process.env.NVIDIA_KEY_2;
    delete process.env.NVIDIA_KEY_3;
    const p = await project(cfg, enumerateCells(cfg, tasks), tasks);
    const nvidia = p.byProvider.find((x) => x.provider === "nvidia")!;
    expect(nvidia.capacityTokens).toBe(8_000_000);
    expect(nvidia.fits).toBe(false);
    expect(p.fits).toBe(false);
    // A refusal that does not say which arm to cut is not useful.
    expect(p.worstArms[0]).toBe("a5_format_at_scale");

    process.env.NVIDIA_KEY_2 = "b".repeat(20);
    process.env.NVIDIA_KEY_3 = "c".repeat(20);
  });

  test("a5 alone is the largest arm, and it is the whole problem", async () => {
    const p = await project(cfg, enumerateCells(cfg, tasks), tasks);
    expect(p.byArm[0]!.arm).toBe("a5_format_at_scale");
    // Over 8M by itself: a single account could not run it at all.
    expect(p.byArm[0]!.tokens).toBeGreaterThan(8_000_000);
  });

  test("the reflection conditions cost more, because their prompts are longer", () => {
    const task = tasks.get("django__django-11019")!;
    const plain = estimateCell(
      cfg,
      { arm: "x", provider: "nvidia", cell: cell() },
      task,
      1000,
    );
    const refl = estimateCell(
      cfg,
      { arm: "x", provider: "nvidia", cell: cell({ strategy: "l2_reflection" }) },
      task,
      1000,
    );
    const diag = estimateCell(
      cfg,
      { arm: "x", provider: "nvidia", cell: cell({ strategy: "l2_5_diagnose_revise" }) },
      task,
      1000,
    );
    expect(refl.promptTokens).toBeGreaterThan(plain.promptTokens);
    expect(diag.promptTokens).toBeGreaterThan(refl.promptTokens);
  });

  test("file size dominates the estimate, which is why whole-file context is costly", () => {
    const task = tasks.get("astropy__astropy-7746")!;
    const small = estimateCell(cfg, { arm: "x", provider: "nvidia", cell: cell() }, task, 2_000);
    const big = estimateCell(cfg, { arm: "x", provider: "nvidia", cell: cell() }, task, 140_000);
    // wcs.py is ~140 KB. D7's 31k-token figure is this effect.
    expect(big.promptTokens).toBeGreaterThan(small.promptTokens * 10);
  });
});

// ──────────────────────────────────────────────────────────── the row store
describe("row store", () => {
  test("a missing file is an empty store, not an error", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-rows-"));
    const { store, loaded } = await RowStore.open(join(dir, "absent.jsonl"));
    expect(loaded.records.length).toBe(0);
    expect(store.completed).toBe(0);
  });

  test("resume skips a completed cell", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-rows-"));
    const path = join(dir, "rows.jsonl");
    const c = cell();

    const first = await RowStore.open(path);
    await first.store.append("a2_workhorse", outcome(c));
    expect(first.store.has(c)).toBe(true);

    // The defect being guarded: a restart that forgets what it did would
    // re-spend every completed cell.
    const second = await RowStore.open(path);
    expect(second.store.has(c)).toBe(true);
    expect(second.store.completed).toBe(1);
    expect(second.store.has(cell({ round: 2 }))).toBe(false);
  });

  test("a torn final line is skipped and counted, not fatal", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-rows-"));
    const path = join(dir, "rows.jsonl");
    const good = JSON.stringify(toRecord("a2_workhorse", outcome(cell())));
    await writeFile(path, `${good}\n{"key":"trunc`, "utf8");
    const loaded = await readRows(path);
    expect(loaded.records.length).toBe(1);
    expect(loaded.skipped).toBe(1);
  });

  test("duplicate keys are detected rather than silently overwriting", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-rows-"));
    const path = join(dir, "rows.jsonl");
    const rec = JSON.stringify(toRecord("a2_workhorse", outcome(cell())));
    await writeFile(path, `${rec}\n${rec}\n`, "utf8");
    const loaded = await readRows(path);
    expect(loaded.duplicates.length).toBe(1);
  });

  test("the record keeps the response but not the prompt", async () => {
    const rec = toRecord("a2_workhorse", outcome(cell()));
    expect(rec.evidenceSource).toBe("none");
    expect(rec.comparableToChapter5).toBe(true);
    expect(rec.honouredCondition).toBe(true);
    expect(rec.patch).toBe("p");
    // The response is REQUIRED input, not audit bulk: a later round is shown it
    // verbatim, so a resumed sweep reads it back instead of re-paying for the
    // earlier round.
    expect(rec.response).toBe("r");
    // The prompt is reconstructible from the template plus the cached file.
    expect(Object.keys(rec)).not.toContain("prompt");
  });
});

// ─────────────────────────────────────────────────── THE ORACLE: no holes
describe("verify — the no-holes oracle", () => {
  /** Writes a row for every planned cell of one arm. */
  async function fillArm(path: string, arm: string): Promise<string[]> {
    const planned = enumerateCells(cfg, tasks).filter((c) => c.arm === arm);
    const { store } = await RowStore.open(path);
    for (const p of planned) await store.append(arm, outcome(p.cell));
    return planned.map((p) => cellKey(p.cell));
  }

  test("a fully written arm verifies COMPLETE", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-v-"));
    const path = join(dir, "rows.jsonl");
    await fillArm(path, "a1_replication");

    const v = await verify(cfg, tasks, { path, arms: ["a1_replication"] });
    expect(v.planned).toBe(28);
    expect(v.written).toBe(28);
    expect(v.missing).toEqual([]);
    expect(v.complete).toBe(true);
  });

  test("ONE deleted row is detected — this is the whole point", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-v-"));
    const path = join(dir, "rows.jsonl");
    await fillArm(path, "a1_replication");

    // Drop a single line, as a crash or a swallowed exception would.
    const lines = (await Bun.file(path).text()).trim().split("\n");
    const removed = JSON.parse(lines[5]!) as { key: string };
    lines.splice(5, 1);
    await writeFile(path, `${lines.join("\n")}\n`, "utf8");

    const v = await verify(cfg, tasks, { path, arms: ["a1_replication"] });
    expect(v.complete).toBe(false);
    expect(v.missing).toEqual([removed.key]);
  });

  test("an empty row file reports every planned cell missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-v-"));
    const v = await verify(cfg, tasks, {
      path: join(dir, "nothing.jsonl"),
      arms: ["a1_replication"],
    });
    expect(v.missing.length).toBe(28);
    expect(v.complete).toBe(false);
  });

  test("a duplicated row fails verification", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-v-"));
    const path = join(dir, "rows.jsonl");
    await fillArm(path, "a1_replication");
    const lines = (await Bun.file(path).text()).trim().split("\n");
    await writeFile(path, `${lines.join("\n")}\n${lines[0]}\n`, "utf8");

    const v = await verify(cfg, tasks, { path, arms: ["a1_replication"] });
    // One cell, one outcome. Two rows means one of them is wrong.
    expect(v.duplicates.length).toBe(1);
    expect(v.complete).toBe(false);
  });

  test("a torn line fails verification rather than being tolerated", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-v-"));
    const path = join(dir, "rows.jsonl");
    await fillArm(path, "a1_replication");
    await writeFile(path, `${(await Bun.file(path).text())}{"key":"tor`, "utf8");

    const v = await verify(cfg, tasks, { path, arms: ["a1_replication"] });
    // The store tolerates a torn line so a run can continue; verification
    // does not, because the cell it described is now unaccounted for.
    expect(v.skipped).toBe(1);
    expect(v.complete).toBe(false);
  });

  test("rows outside the current grid are reported, not counted as missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-v-"));
    const path = join(dir, "rows.jsonl");
    await fillArm(path, "a1_replication");

    const { store } = await RowStore.open(path);
    await store.append("a1_replication", outcome(cell({ taskId: "not__in-grid" })));

    const v = await verify(cfg, tasks, { path, arms: ["a1_replication"] });
    expect(v.unexpected.length).toBe(1);
    // Still complete: every PLANNED cell has a row. A stale extra row is worth
    // reporting but is not a hole.
    expect(v.missing).toEqual([]);
    expect(v.complete).toBe(true);
  });

  test("outcomes are counted, so what happened is visible at a glance", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-v-"));
    const path = join(dir, "rows.jsonl");
    await fillArm(path, "a1_replication");
    const v = await verify(cfg, tasks, { path, arms: ["a1_replication"] });
    expect(v.byOutcome.APPLIED).toBe(28);
  });
});
