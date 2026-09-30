/**
 * `doctor` — everything that must be true before a single token is spent.
 *
 * The original study's failures were nearly all of this kind: a model id that
 * had silently changed, a patch format the harness would never accept, a quota
 * that ran out mid-arm, a sampling parameter that was never set. None of those
 * are visible in a result file; all of them are visible here, in seconds, for
 * free.
 *
 * Every check prints PASS, FAIL or SKIP with the evidence. A FAIL on a gate
 * check exits non-zero, because a sweep launched over a broken gate produces
 * data that looks real and is not.
 */

import { loadConfig, keyStatus, type Config, type ProviderConfig } from "@rb/core";
import { toPatch, toUnifiedDiff, patchTargets } from "./edits/toPatch.ts";
import { checkApply, withScratchRepo, applyAndRead } from "./verify/apply.ts";
import { GeminiProvider, OpenAICompatProvider } from "./providers/index.ts";
import { BudgetLedger, LEDGER_PATH } from "./providers/budget.ts";

type Status = "PASS" | "FAIL" | "SKIP" | "WARN";

interface Check {
  name: string;
  status: Status;
  detail: string;
  /** A failing gate stops the run; a failing non-gate is reported and tolerated. */
  gate: boolean;
}

const checks: Check[] = [];
const record = (c: Check) => {
  checks.push(c);
  const mark = { PASS: "PASS", FAIL: "FAIL", SKIP: "SKIP", WARN: "WARN" }[c.status];
  console.log(`  ${mark}  ${c.name}`);
  for (const line of c.detail.split("\n")) {
    if (line.trim()) console.log(`        ${line}`);
  }
};

// ══════════════════════════════════════════════════ gate 1 · the patch format

/**
 * **The step-1 gate.** Prove `git apply` accepts what jsdiff emits.
 *
 * This is the single assumption the whole fairness retrofit rests on: the model
 * hands us SEARCH/REPLACE blocks, we compute the unified diff, and git must take
 * it. If jsdiff's header shape or hunk arithmetic disagreed with git's parser,
 * every APPLY_FAIL in the results would be our bug masquerading as a model
 * limitation — the exact confound the thesis criticises elsewhere.
 *
 * Tested on a file with the properties that actually break diff generation:
 * two hunks far apart, a trailing newline, an indentation-only line, and a
 * non-ASCII character.
 */
async function gatePatchFormat(): Promise<void> {
  const path = "astropy/modeling/separable.py";

  const before = [
    "import numpy as np",
    "",
    "",
    "def _coord_matrix(model, pos, noutp):",
    '    """Compute the coordinate matrix — see § separability."""',
    "    if isinstance(model, Mapping):",
    "        axes = []",
    "        for i in model.mapping:",
    "            axis = np.zeros((model.n_inputs,))",
    "            axis[i] = 1",
    "            axes.append(axis)",
    "        m = np.vstack(axes)",
    "        mat = np.zeros((noutp, model.n_inputs))",
    "        if pos == 'left':",
    "            mat[: model.n_outputs, : model.n_inputs] = m",
    "        else:",
    "            mat[-model.n_outputs :, -model.n_inputs :] = m",
    "        return mat",
    "    if not model.separable:",
    "        mat = np.zeros((noutp, model.n_inputs))",
    "        if pos == 'left':",
    "            mat[: model.n_outputs, : model.n_inputs] = 1",
    "        else:",
    "            mat[-model.n_outputs :, -model.n_inputs :] = 1",
    "    else:",
    "        mat = np.zeros((noutp, model.n_inputs))",
    "        for i in range(model.n_inputs):",
    "            mat[i, i] = 1",
    "        if pos == 'right':",
    "            mat = np.roll(mat, (noutp - model.n_outputs))",
    "    return mat",
    "",
    "",
    "def _cstack(left, right):",
    "    noutp = _compute_n_outputs(left, right)",
    "    if isinstance(left, Model):",
    "        cleft = _coord_matrix(left, 'left', noutp)",
    "    else:",
    "        cleft = np.zeros((noutp, left.shape[1]))",
    "        cleft[: left.shape[0], : left.shape[1]] = left",
    "    if isinstance(right, Model):",
    "        cright = _coord_matrix(right, 'right', noutp)",
    "    else:",
    "        cright = np.zeros((noutp, right.shape[1]))",
    "        cright[-right.shape[0] :, -right.shape[1] :] = 1",
    "    return np.hstack([cleft, cright])",
    "",
  ].join("\n");

  // Two changes, ~30 lines apart, so jsdiff must emit two separate @@ hunks.
  const after = before
    .replace("        return mat\n    if not model.separable:", "        return mat\n\n    if not model.separable:")
    .replace(
      "        cright[-right.shape[0] :, -right.shape[1] :] = 1",
      "        cright[-right.shape[0] :, -right.shape[1] :] = right",
    );

  if (after === before) {
    record({
      name: "jsdiff → git apply",
      status: "FAIL",
      detail: "the gate's own fixture failed to change; the test is broken",
      gate: true,
    });
    return;
  }

  const patch = toPatch([{ path, before, after }]);
  const hunks = (patch.match(/^@@ /gm) ?? []).length;
  const targets = patchTargets(patch);

  const result = await withScratchRepo({ [path]: before }, async (dir) => {
    const check = await checkApply(dir, patch);
    if (!check.ok) return { check, applied: null };
    const applied = await applyAndRead(dir, patch, path);
    return { check, applied };
  });

  if (!result.check.ok) {
    record({
      name: "jsdiff → git apply",
      status: "FAIL",
      detail:
        `git apply --check REJECTED a diff we generated. The fairness retrofit\n` +
        `cannot proceed — every APPLY_FAIL would be our bug, not the model's.\n` +
        `git said: ${result.check.stderr}\n` +
        `patch head:\n${patch.split("\n").slice(0, 6).join("\n")}`,
      gate: true,
    });
    return;
  }

  // Applying cleanly is not enough — it must produce the intended content.
  if (result.applied?.content !== after) {
    record({
      name: "jsdiff → git apply",
      status: "FAIL",
      detail:
        "the patch applied but the result does not equal the intended file.\n" +
        "A diff that applies to the wrong thing is worse than one that fails.",
      gate: true,
    });
    return;
  }

  record({
    name: "jsdiff → git apply",
    status: "PASS",
    detail:
      `${hunks} hunks across ${targets.length} file; applied clean and byte-exact\n` +
      `target resolved as ${targets[0]} (a/ b/ prefixes accepted at -p1)`,
    gate: true,
  });

  // A one-line change is the common case and has its own edge: a hunk at EOF.
  const eofPatch = toUnifiedDiff({
    path,
    before,
    after: before.replace("import numpy as np", "import numpy as np  # noqa"),
  });
  const eofOk = await withScratchRepo({ [path]: before }, (dir) =>
    checkApply(dir, eofPatch),
  );
  record({
    name: "jsdiff → git apply (single-hunk, file start)",
    status: eofOk.ok ? "PASS" : "FAIL",
    detail: eofOk.ok ? "accepted" : eofOk.stderr,
    gate: true,
  });
}

// ══════════════════════════════════════════════════ gate 2 · the frozen dataset

async function gateDataset(cfg: Config): Promise<void> {
  const metaPath = "data/swebench_lite.meta.json";
  const meta = await Bun.file(metaPath)
    .json()
    .catch(() => null);

  if (!meta) {
    record({
      name: "frozen dataset",
      status: "FAIL",
      detail: `${metaPath} missing — run: bun scripts/export_dataset.ts`,
      gate: true,
    });
    return;
  }

  const text = await Bun.file(cfg.tasks.source).text();
  const lines = text.split("\n").filter((l) => l.length > 0);
  const ids = new Set<string>();
  for (const l of lines) ids.add(JSON.parse(l).instance_id as string);

  const problems: string[] = [];
  if (lines.length !== cfg.tasks.expectedRows) {
    problems.push(`${lines.length} rows, config expects ${cfg.tasks.expectedRows}`);
  }
  if (ids.size !== lines.length) {
    problems.push(`${lines.length - ids.size} duplicate instance_id`);
  }
  if (meta.revision !== cfg.tasks.revision) {
    problems.push(
      `revision drift — file is ${meta.revision}, config pins ${cfg.tasks.revision}`,
    );
  }

  record({
    name: "frozen dataset",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail:
      problems.length === 0
        ? `${lines.length} instances, revision ${String(meta.revision).slice(0, 12)}…`
        : problems.join("\n"),
    gate: true,
  });

  // Every task the grid names must exist in the frozen file.
  const missing: string[] = [];
  for (const [name, set] of Object.entries(cfg.tasks.sets)) {
    for (const id of set.ids) if (!ids.has(id)) missing.push(`${name}: ${id}`);
  }
  record({
    name: "task sets resolve",
    status: missing.length === 0 ? "PASS" : "FAIL",
    detail:
      missing.length === 0
        ? `${Object.keys(cfg.tasks.sets).length} sets, all ids present`
        : `not in the dataset:\n${missing.join("\n")}`,
    gate: true,
  });
}

// ══════════════════════════════════════════════════════════ keys and providers

/** Reports presence only. A key value is never read, printed or logged. */
function checkKeys(cfg: Config): void {
  const lines: string[] = [];
  let anyMissing = false;
  for (const [id, p] of Object.entries(cfg.providers)) {
    for (const { name, present } of keyStatus(p)) {
      lines.push(`${present ? "set  " : "UNSET"}  ${name}  → provider ${id}`);
      if (!present) anyMissing = true;
    }
  }
  record({
    name: "API key env vars",
    status: anyMissing ? "WARN" : "PASS",
    detail:
      lines.join("\n") +
      (anyMissing
        ? "\nunset names are skipped when probing; load .env.local first"
        : ""),
    gate: false,
  });
}

interface Probe {
  model: string;
  ok: boolean;
  ttftMs: number | null;
  tps: number | null;
  completionTokens: number | null;
  reasoningTokens: number | null;
  /** False when the stream produced reasoning but never visible output. */
  sawContent: boolean;
  finishReason: string | null;
  error: string | null;
}

/**
 * Measures each endpoint rather than trusting its name.
 *
 * This check exists because the model names lie. In the screenshots that set the
 * model choice, "Flash" measured 13 tokens/s with a 24-second time-to-first-token
 * while a 550B model managed 164 tokens/s at 1.65s, and "Lightning" took 65
 * seconds to start with two samples disagreeing by 2×. Any budget or runtime
 * estimate built on the names would be wrong by an order of magnitude.
 */
/**
 * Measures each endpoint rather than trusting its name.
 *
 * This check exists because the model names lie. In the screenshots that set the
 * model choice, "Flash" measured 13 tokens/s with a 24-second time-to-first-token
 * while a 550B model managed 164 tokens/s at 1.65s, and "Lightning" took 65
 * seconds to start with two samples disagreeing by 2x. Any budget or runtime
 * estimate built on the names would be wrong by an order of magnitude.
 *
 * Rewritten in step 4 after live measurement showed this check was itself
 * reporting three falsehoods (D17):
 *
 *   1. `muse_30b` and `nemotron_nano` were reported `ok` having produced no
 *      visible content at all — the 16-token probe ceiling was consumed
 *      entirely by undisclosed reasoning.
 *   2. `nemotron_ultra` was reported at **94,094 tok/s**.
 *   3. Gemini was never probed: `probe not implemented for kind gemini`.
 *
 * The probe now delegates to the provider layer, asks for enough tokens to
 * reach content, and reports "no content" as a warning rather than a pass.
 */
async function probeModel(
  modelId: string,
  cfg: Config,
  ledger: BudgetLedger | null = null,
): Promise<Probe> {
  const m = cfg.models[modelId]!;
  const p: ProviderConfig = cfg.providers[m.provider]!;

  const base: Probe = {
    model: modelId,
    ok: false,
    ttftMs: null,
    tps: null,
    completionTokens: null,
    reasoningTokens: null,
    sawContent: false,
    finishReason: null,
    error: null,
  };

  const anyKey = p.apiKeyEnv.some((n) => (process.env[n] ?? "").length > 0);
  if (!anyKey) return { ...base, error: `no key set (${p.apiKeyEnv.join(", ")})` };

  const client =
    p.kind === "gemini"
      ? new GeminiProvider(m.provider, p)
      : new OpenAICompatProvider(m.provider, p);

  // 256, not 16. A reasoning model needs room to reach visible output; the old
  // ceiling guaranteed a truncated answer and then called it a pass.
  const PROBE_MAX_TOKENS = 256;

  /**
   * Long enough to measure, small enough to be free.
   *
   * "Reply with exactly: ok" costs 2-3 tokens once thinking is actually
   * disabled (D19), and throughput cannot be measured from three tokens. This
   * prompt produces a few dozen deterministic tokens instead, so TTFT and
   * tokens/s are real measurements rather than artefacts of a tiny sample.
   */
  const PROBE_PROMPT =
    "Count from 1 to 40. Output only the numbers, one per line, nothing else.";

  try {
    const r = await client.probe({
      model: m.model,
      prompt: PROBE_PROMPT,
      temperature: m.temperature,
      topP: m.topP,
      maxTokens: PROBE_MAX_TOKENS,
      // Probe with what the config declares, so a model that ignores the flag
      // is caught here rather than discovered in the results (D19).
      thinking: m.thinking,
    });
    // A live probe spends real tokens. Recording them is not bookkeeping
    // pedantry: a ledger that omits its own diagnostics understates spend, and
    // an understated ledger is the thing this project refuses to ship.
    if (ledger !== null && r.completionTokens !== null) {
      const usage = {
        promptTokens: 0,
        completionTokens: r.completionTokens,
        reasoningTokens: r.reasoningTokens,
        latencyMs: Math.round(r.totalMs),
      };
      try {
        const reservation = ledger.reserve(m.provider, r.completionTokens, r.keyName);
        await ledger.commit(
          reservation,
          {
            provider: m.provider,
            keyName: r.keyName,
            model: m.model,
            cell: `doctor:probe:${modelId}`,
            promptTokens: 0,
            completionTokens: r.completionTokens,
            reasoningTokens: r.reasoningTokens,
            latencyMs: Math.round(r.totalMs),
            status: 200,
            retries: 0,
            outcome: r.finishReason === "length" ? "truncated" : "ok",
          },
          usage,
        );
      } catch {
        // A probe that cannot be charged is still a valid probe; the budget
        // gate above has already reported the exhaustion.
      }
    }

    return {
      model: modelId,
      ok: true,
      ttftMs: r.ttftMs,
      tps: r.tps,
      completionTokens: r.completionTokens,
      reasoningTokens: r.reasoningTokens,
      sawContent: r.sawContent,
      finishReason: r.finishReason,
      error: null,
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Reports the budget before it is spent, not after.
 *
 * The ceiling in the original config was the string `"8_000_000"`, so nothing
 * ever compared against it (D3). Here the remaining headroom is read from the
 * committed ledger and printed, and a provider already at its ceiling is a
 * warning rather than a surprise 400 mid-sweep.
 */
async function checkBudget(cfg: Config): Promise<BudgetLedger> {
  const { ledger, records, skipped } = await BudgetLedger.load(
    cfg.budget.providers,
    LEDGER_PATH,
  );

  const exhausted: string[] = [];
  for (const [provider, ceiling] of Object.entries(cfg.budget.providers)) {
    const spend = ledger.spendOf(provider);
    if (spend.tokens >= ceiling.maxTokens || spend.calls >= ceiling.maxCalls) {
      exhausted.push(provider);
    }
  }

  const detail = [
    records === 0
      ? `no ledger at ${LEDGER_PATH} — nothing spent yet`
      : `${records} call(s) in the ledger${skipped > 0 ? `, ${skipped} unreadable line(s)` : ""}`,
    ...ledger.summary(),
    `stop_on_exhaustion: ${cfg.budget.stopOnExhaustion}`,
  ].join("\n");

  record({
    name: "budget ledger",
    status: exhausted.length > 0 ? "WARN" : "PASS",
    detail:
      exhausted.length > 0
        ? `${detail}\nAT CEILING: ${exhausted.join(", ")} — cells will record BUDGET_STOP`
        : detail,
    gate: false,
  });

  return ledger;
}

async function checkProviders(
  cfg: Config,
  live: boolean,
  ledger: BudgetLedger | null,
): Promise<void> {
  const modelIds = [
    ...new Set(
      Object.values(cfg.grid)
        .filter((a) => a.enabled)
        .flatMap((a) => a.models),
    ),
  ].sort();

  if (!live) {
    record({
      name: "endpoint probe",
      status: "SKIP",
      detail:
        `${modelIds.length} models in enabled arms; pass --live to measure them.\n` +
        `Names are not evidence: TPS and TTFT must be measured, not assumed.`,
      gate: false,
    });
    return;
  }

  /**
   * Sequential, deliberately (D20).
   *
   * `Promise.all` over four NVIDIA models made the endpoint return HTTP 200
   * with an empty body for two of them, which this check then reported as
   * models producing no output. A pre-flight gate that creates its own failures
   * is worse than no gate. Latency here is irrelevant — correctness is not.
   */
  const probes: Probe[] = [];
  for (const id of modelIds) {
    let p = await probeModel(id, cfg, ledger);
    // One retry after a pause. The empty-stream failure is a transient
    // capacity limit, and back-to-back probing provokes it even in sequence.
    if (!p.ok && /empty stream/.test(p.error ?? "")) {
      await new Promise((r) => setTimeout(r, 3_000));
      p = await probeModel(id, cfg, ledger);
    }
    probes.push(p);
    await new Promise((r) => setTimeout(r, 1_000));
  }
  const lines = probes.map((p) => {
    if (!p.ok) return `FAIL  ${p.model}  ${p.error}`;
    const ttft = p.ttftMs === null ? "  n/a" : `${(p.ttftMs / 1000).toFixed(2)}s`;
    const tps = p.tps === null ? " n/a" : p.tps.toFixed(1);
    const think =
      p.reasoningTokens === null
        ? ""
        : `  billed ${p.reasoningTokens} reasoning tokens`;
    // A model that answered with nothing visible is not "ok". It was reported
    // as ok before step 4, which is how two of five models passed this gate
    // while producing no output (D17).
    const tag = p.sawContent ? "ok   " : "WARN ";
    const empty = p.sawContent
      ? ""
      : `  no visible content (finish_reason=${p.finishReason ?? "?"})`;
    return `${tag} ${p.model.padEnd(22)} ttft ${ttft}  ${tps} tok/s${think}${empty}`;
  });

  const silent = probes.filter((p) => p.ok && !p.sawContent);

  // D5: a model configured thinking:false that still bills reasoning tokens is a
  // validity threat, not a cost surprise — it silently breaks the comparison.
  const leaking = probes.filter(
    (p) => p.ok && (p.reasoningTokens ?? 0) > 0 && !cfg.models[p.model]!.thinking,
  );
  if (leaking.length > 0) {
    lines.push(
      "",
      "D5 VIOLATION: these models bill reasoning tokens despite thinking: false —",
      "the Reflection-only comparison is not valid against them:",
      ...leaking.map((p) => `  ${p.model}`),
    );
  }

  const failed = probes.filter((p) => !p.ok).length;
  record({
    name: "endpoint probe",
    status:
      leaking.length > 0
        ? "FAIL"
        : failed > 0 || silent.length > 0
          ? "WARN"
          : "PASS",
    detail: lines.join("\n"),
    gate: leaking.length > 0,
  });
}

// ══════════════════════════════════════════════════════════════ sampling pins

function checkSamplingPins(cfg: Config): void {
  const lines = Object.entries(cfg.models).map(
    ([id, m]) =>
      `${id.padEnd(22)} temp ${m.temperature}  top_p ${m.topP}  ` +
      `thinking ${m.thinking}  max_tokens ${m.maxTokens}`,
  );
  record({
    name: "sampling pinned",
    status: "PASS",
    detail:
      `seed ${cfg.run.seed}\n` +
      lines.join("\n") +
      `\nzod requires temperature and top_p — there is no default, so the ` +
      `original's\nunpinned sampling cannot recur silently.`,
    gate: false,
  });
}

// ══════════════════════════════════════════════════════════════════════ main

export async function doctor(configPath: string, live: boolean): Promise<number> {
  console.log(`\nrecovery-bench doctor`);
  console.log(`config  ${configPath}${live ? "   (live probes enabled)" : ""}\n`);

  let cfg: Config;
  let hash: string;
  try {
    const loaded = await loadConfig(configPath);
    cfg = loaded.config;
    hash = loaded.hash;
  } catch (e) {
    console.log(`  FAIL  config\n        ${e instanceof Error ? e.message : e}\n`);
    return 1;
  }
  record({
    name: "config",
    status: "PASS",
    detail:
      `hash ${hash}  ·  run "${cfg.run.name}"  ·  verify ${cfg.verify.backend}\n` +
      `${Object.keys(cfg.models).length} models, ` +
      `${Object.keys(cfg.grid).length} arms ` +
      `(${Object.values(cfg.grid).filter((a) => a.enabled).length} enabled)`,
    gate: true,
  });

  await gatePatchFormat();
  await gateDataset(cfg);
  checkSamplingPins(cfg);
  checkKeys(cfg);
  const ledger = await checkBudget(cfg);
  await checkProviders(cfg, live, live ? ledger : null);

  const failedGates = checks.filter((c) => c.gate && c.status === "FAIL");
  const warns = checks.filter((c) => c.status === "WARN").length;

  console.log("");
  if (failedGates.length > 0) {
    console.log(
      `${failedGates.length} gate check(s) FAILED — a sweep launched now would ` +
        `produce data that looks real and is not:`,
    );
    for (const c of failedGates) console.log(`  · ${c.name}`);
    console.log("");
    return 1;
  }
  console.log(
    `all gates pass${warns > 0 ? `, ${warns} warning(s)` : ""} — safe to sweep.`,
  );
  console.log("");
  return 0;
}
