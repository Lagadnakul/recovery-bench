/**
 * `bun run sweep` — the grid, with the cost shown before anything is spent.
 *
 * Defaults are deliberately cautious: with no flags it projects and stops. A
 * sweep that spent hours and millions of tokens because someone typed a bare
 * command would be a poor default, and the projection is the thing most worth
 * looking at anyway.
 */

import { loadConfig } from "../core/config.ts";
import { loadDataset } from "./tasks/dataset.ts";
import {
  enumerateCells,
  summarise,
  project,
  formatProjection,
  sweep,
  verify,
  formatVerify,
} from "./matrix/index.ts";

export interface RunSweepOptions {
  configPath: string;
  arms: string[];
  projectOnly: boolean;
  verifyOnly: boolean;
  force: boolean;
  yes: boolean;
}

const rule = (s: string) => `\n${"─".repeat(72)}\n${s}\n`;

export async function runSweep(opts: RunSweepOptions): Promise<number> {
  const { config: cfg } = await loadConfig(opts.configPath);
  const { tasks } = await loadDataset(cfg);

  // ─────────────────────────────────────────────────────────── verify only
  if (opts.verifyOnly) {
    const v = await verify(cfg, tasks, { arms: opts.arms });
    console.log(rule("VERIFY — every planned cell must have exactly one row"));
    for (const line of formatVerify(v)) console.log(`  ${line}`);
    console.log("");
    return v.complete ? 0 : 1;
  }

  const cells = enumerateCells(cfg, tasks);
  const selected =
    opts.arms.length > 0 ? cells.filter((c) => opts.arms.includes(c.arm)) : cells;

  if (selected.length === 0) {
    console.error(
      `no cells selected. Enabled arms: ` +
        Object.entries(cfg.grid)
          .filter(([, a]) => a.enabled)
          .map(([n]) => n)
          .join(", "),
    );
    return 2;
  }

  const grid = summarise(cfg, selected);
  console.log(rule("GRID"));
  console.log(`  ${grid.totalCells} cells in ${grid.lineages} lineages`);
  for (const [arm, n] of Object.entries(grid.byArm)) {
    console.log(`    ${arm.padEnd(20)} ${String(n).padStart(5)}`);
  }
  if (grid.disabledArms.length > 0) {
    console.log(`  disabled: ${grid.disabledArms.join(", ")}`);
  }

  // ───────────────────────────────────────────────────────────── projection
  const proj = await project(cfg, selected, tasks);
  console.log(rule("PROJECTED COST"));
  for (const line of formatProjection(proj)) console.log(`  ${line}`);

  if (!proj.fits) {
    console.log(rule("REFUSING TO START"));
    console.log(
      `  This grid does not fit its budget. The arms contributing most to the\n` +
        `  overflowing provider(s), largest first:\n`,
    );
    for (const arm of proj.worstArms.slice(0, 3)) {
      const a = proj.byArm.find((x) => x.arm === arm);
      console.log(
        `    ${arm.padEnd(20)} ${((a?.tokens ?? 0) / 1e6).toFixed(2)}M tokens`,
      );
    }
    console.log(
      `\n  Options: run fewer arms with --arm <name>, reduce repeats in the\n` +
        `  config, or raise the ceiling only if the real allowance supports it.\n` +
        `  A ceiling raised to silence this warning is not a ceiling (D3).\n`,
    );
    if (!opts.force) return 1;
    console.log("  --force given: proceeding anyway.\n");
  }

  if (opts.projectOnly) {
    console.log(rule("PROJECTION ONLY"));
    console.log("  Nothing was sent. Pass --run to execute.\n");
    return 0;
  }

  if (!opts.yes) {
    console.log(rule("NOT RUNNING"));
    console.log(
      `  This would spend up to ${(proj.totalTokens / 1e6).toFixed(2)}M tokens ` +
        `across ${selected.length} cells.\n  Add --yes to confirm.\n`,
    );
    return 0;
  }

  // ─────────────────────────────────────────────────────────────── execute
  console.log(rule("SWEEP"));
  const started = Date.now();
  const res = await sweep({
    cfg,
    tasks,
    arms: opts.arms,
    onCell: (r) => {
      const pct = ((r.index / r.total) * 100).toFixed(1);
      console.log(
        `  [${String(r.index).padStart(5)}/${r.total}  ${pct.padStart(5)}%]  ` +
          `${r.outcome.padEnd(15)} ${r.key}`,
      );
    },
  });
  const mins = ((Date.now() - started) / 60_000).toFixed(1);

  console.log(rule("DONE"));
  console.log(`  ${res.ran} cell(s) run, ${res.skippedResumed} resumed, ${mins} min`);
  console.log(`  ${(res.tokensSpent / 1e6).toFixed(3)}M tokens spent`);
  for (const [kind, n] of Object.entries(res.byOutcome).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${kind.padEnd(16)} ${n}`);
  }
  if (res.armsSkipped.length > 0) {
    console.log(`  arms stopped on exhausted budget: ${res.armsSkipped.join(", ")}`);
  }

  // The no-holes check runs automatically. A sweep that claims success without
  // it would be asserting the one property it exists to guarantee.
  const v = await verify(cfg, tasks, { arms: opts.arms });
  console.log(rule("VERIFY"));
  for (const line of formatVerify(v)) console.log(`  ${line}`);
  console.log("");
  return v.complete ? 0 : 1;
}
