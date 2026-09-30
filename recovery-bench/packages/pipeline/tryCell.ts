/**
 * `bun run try` — one cell, end to end, with everything printed.
 *
 * Step 6 builds the queue that runs the whole grid. This is the single-cell
 * version that exists first, for two reasons.
 *
 * It is how step 5 gets verified against reality rather than against mocks: a
 * real task, a real prompt built from the original template, a real model call
 * charged to the real ledger, and a real `git apply`. And it is how a reader
 * inspects one cell in full — the prompt that was sent, the response that came
 * back, the patch that was derived, git's verdict — which is exactly what the
 * original study could not show for any of its cells.
 *
 *   bun run try                                   first pool task, blind retry
 *   bun run try -- --task django__django-11039
 *   bun run try -- --strategy l2_reflection --round 2
 *   bun run try -- --model nemotron_ultra --show-prompt
 *   bun run try -- --dry-run                      build the prompt, call nothing
 */

import { loadConfig, type Config } from "../core/config.ts";
import type { Cell } from "../core/types.ts";
import { BudgetLedger, LEDGER_PATH } from "./providers/budget.ts";
import { buildRegistry } from "./providers/index.ts";
import { loadDataset, resolveTaskSet } from "./tasks/dataset.ts";
import { getTaskFile } from "./tasks/files.ts";
import { localise } from "./tasks/localise.ts";
import { getStrategy } from "./strategies/conditions.ts";
import { resolveEvidence } from "./strategies/evidence.ts";
import { runCell } from "./strategies/runCell.ts";
import type { Attempt } from "./strategies/types.ts";

export interface TryOptions {
  configPath: string;
  taskId?: string;
  strategy: string;
  model: string;
  round: number;
  showPrompt: boolean;
  dryRun: boolean;
  allowNetwork: boolean;
}

const rule = (s: string) => `\n${"─".repeat(72)}\n${s}\n`;

function clip(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}\n… (${s.length - n} more characters)`;
}

export async function tryCell(opts: TryOptions): Promise<number> {
  const { config: cfg } = await loadConfig(opts.configPath);

  // ─────────────────────────────────────────────────────── pick the task
  const { tasks } = await loadDataset(cfg);
  const pool = resolveTaskSet("failure_pool", cfg, tasks);
  const task = opts.taskId ? tasks.get(opts.taskId) : pool[0];
  if (!task) {
    console.error(
      `unknown task "${opts.taskId}". The failure pool is:\n` +
        pool.map((t) => `  ${t.instanceId}`).join("\n"),
    );
    return 2;
  }

  if (!cfg.models[opts.model]) {
    console.error(
      `unknown model "${opts.model}". Configured: ${Object.keys(cfg.models).join(", ")}`,
    );
    return 2;
  }

  const cell: Cell = {
    taskId: task.instanceId,
    strategy: opts.strategy as Cell["strategy"],
    model: opts.model,
    editFormat: "search_replace",
    thinking: cfg.models[opts.model]!.thinking,
    round: opts.round,
    repeat: 0,
  };

  // ────────────────────────────────────────── localise and fetch the file
  const filePath = localise(task);
  const file = await getTaskFile(task, filePath, {
    allowNetwork: opts.allowNetwork,
  });

  console.log(rule("CELL"));
  console.log(`  task        ${task.instanceId}  (${task.repo})`);
  console.log(`  strategy    ${cell.strategy}  round ${cell.round}`);
  console.log(`  model       ${cell.model}  thinking=${cell.thinking}`);
  console.log(`  file        ${filePath}`);
  console.log(
    `              ${file.meta.lines} lines, ${file.meta.bytes} bytes, ` +
      `${file.fromCache ? "from cache" : "fetched"}  sha ${file.meta.sha256.slice(0, 12)}`,
  );

  // ───────────────────────────────────────────── history and evidence
  //
  // A single-cell run has no earlier round of its own, so a round-2 condition
  // is given the archived round-1 attempt when one exists. That is replay, not
  // fabrication, and the evidence label records which it was.
  const history: Attempt[] = [];
  const strategy = getStrategy(cell.strategy);

  if (strategy.needsHistory) {
    console.log(
      `\n  ${cell.strategy} needs a previous attempt. A single-cell run has ` +
        `none of its own,\n  so this will refuse unless you run the grid ` +
        `(\`sweep\`, step 6).`,
    );
  }

  const evidence = strategy.needsEvidence
    ? await resolveEvidence({ instanceId: task.instanceId })
    : undefined;

  if (evidence) {
    console.log(
      `  evidence    ${evidence.source}` +
        (evidence.origin ? `  from ${evidence.origin}` : "") +
        `  comparable_to_ch5=${evidence.comparableToChapter5}`,
    );
  }

  // ───────────────────────────────────────────────────── plan the prompt
  const plan = await strategy.plan({
    cell,
    task,
    filePath,
    fileContent: file.content,
    history,
    evidence: evidence ?? {
      source: "none",
      text: "",
      origin: "",
      comparableToChapter5: false,
    },
  });

  if (!plan.runnable) {
    console.log(rule("NOT RUNNABLE"));
    console.log(`  ${plan.reason}\n`);
    console.log(
      "  Note this is a recorded outcome, not a skipped cell: in a sweep the\n" +
        "  row is written with this reason (D2, D15).\n",
    );
    return 0;
  }

  console.log(rule("PROMPT"));
  console.log(
    `  template    ${plan.promptSource}  sha ${plan.promptSha256.slice(0, 12)}`,
  );
  console.log(`  length      ${plan.prompt.length} characters`);
  if (opts.showPrompt) {
    console.log(`\n${plan.prompt}`);
  } else {
    console.log(`\n${clip(plan.prompt, 600)}`);
    console.log("\n  (pass --show-prompt for the whole thing)");
  }

  if (opts.dryRun) {
    console.log(rule("DRY RUN"));
    console.log("  Nothing was sent. Drop --dry-run to make the call.\n");
    return 0;
  }

  // ───────────────────────────────────────────────── spend and evaluate
  const { ledger } = await BudgetLedger.load(cfg.budget.providers, LEDGER_PATH);
  const registry = buildRegistry(cfg, fetch);
  const provider = cfg.models[opts.model]!.provider;

  const before = ledger.spendOf(provider);
  const out = await runCell({
    cell,
    task,
    filePath,
    fileContent: file.content,
    cfg: cfg as Config,
    registry,
    ledger,
    history,
    ...(evidence ? { evidence } : {}),
  });
  const after = ledger.spendOf(provider);

  console.log(rule("RESPONSE"));
  console.log(`  ${out.response.length} characters`);
  console.log(`\n${clip(out.response, 1200)}`);

  console.log(rule("OUTCOME"));
  console.log(`  kind              ${out.row.outcome.kind}`);
  switch (out.row.outcome.kind) {
    case "MALFORMED":
      console.log(`  reason            ${out.row.outcome.reason}`);
      console.log(`  block             ${out.row.outcome.blockIndex}`);
      if (out.row.outcome.nearestLine !== null) {
        console.log(`  nearest line      ${out.row.outcome.nearestLine}`);
      }
      console.log(`  detail            ${out.row.outcome.detail}`);
      break;
    case "APPLY_FAIL":
      console.log(`  git said          ${out.row.outcome.gitStderr}`);
      break;
    case "APPLIED":
      console.log(`  files changed     ${out.row.outcome.filesChanged.join(", ")}`);
      break;
    case "TRUNCATED":
      console.log(
        `  cut off at        ${out.row.outcome.completionTokens}/${out.row.outcome.maxTokens} tokens`,
      );
      console.log(`  visible content   ${out.row.outcome.contentChars} characters`);
      break;
    case "BUDGET_STOP":
      console.log(
        `  spent/ceiling     ${out.row.outcome.tokensUsed}/${out.row.outcome.ceiling}`,
      );
      break;
    case "PROVIDER_ERROR":
      console.log(`  reason            ${out.row.outcome.reason}`);
      break;
  }

  console.log(`  verification      ${out.row.verification}  (resolved is null by type)`);
  console.log(`  condition honoured ${out.honouredCondition}`);
  console.log(`  comparable to ch5  ${out.comparableToChapter5}`);

  if (out.patch) {
    console.log(rule("PATCH"));
    console.log(clip(out.patch, 1500));
  }

  console.log(rule("COST"));
  if (out.usage) {
    console.log(
      `  prompt ${out.usage.promptTokens}  completion ${out.usage.completionTokens}` +
        (out.usage.reasoningTokens === null
          ? ""
          : `  (reasoning ${out.usage.reasoningTokens})`) +
        `  ${Math.round(out.usage.latencyMs)}ms`,
    );
  } else {
    console.log("  no call was billed");
  }
  console.log(
    `  ${provider} ledger  ${before.tokens} → ${after.tokens} tokens, ` +
      `${before.calls} → ${after.calls} calls`,
  );
  console.log("");
  return 0;
}
