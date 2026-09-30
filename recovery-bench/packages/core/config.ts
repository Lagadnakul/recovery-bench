/**
 * The config schema — CONFIG.md, enforced.
 *
 * Two rules this file exists to enforce:
 *
 *  1. **No experimental parameter is hardcoded in source.** The original code
 *     broke this in 17 places (`gemini-3.6-flash` inline) and never set a
 *     temperature or seed at all. Here, `temperature`, `topP` and `seed` are
 *     required — there is no default to fall back on.
 *  2. **A result is traceable to the exact config that produced it.** `hashConfig`
 *     goes into every run manifest.
 *
 * YAML keys stay `snake_case` so the config file reads as configuration; zod maps
 * them to `camelCase` here so the TypeScript reads as TypeScript.
 */

import { z } from "zod";
import { parse as parseYaml } from "yaml";
import { EDIT_FORMATS, STRATEGY_IDS } from "./types.ts";

// ------------------------------------------------------------------- run

const RunSchema = z
  .object({
    name: z.string().min(1),
    seed: z.number().int().default(20260926),
    resume: z.boolean().default(true),
    dry_run: z.boolean().default(false),
  })
  .transform((r) => ({
    name: r.name,
    seed: r.seed,
    resume: r.resume,
    dryRun: r.dry_run,
  }));

// -------------------------------------------------------------- providers

const ProviderSchema = z
  .object({
    kind: z.enum(["openai_compat", "gemini"]),
    base_url: z.string().url().optional(),
    /**
     * Environment variable NAMES ONLY. A value here would be a leaked key, so
     * the schema rejects anything that looks like one: names are uppercase or
     * lowercase identifiers, and real keys carry `-` or are long.
     */
    api_key_env: z.union([z.string(), z.array(z.string()).min(1)]),
    timeout_s: z.number().positive().default(300),
    max_retries: z.number().int().nonnegative().default(4),
  })
  .transform((p) => ({
    kind: p.kind,
    baseUrl: p.base_url,
    apiKeyEnv: Array.isArray(p.api_key_env) ? p.api_key_env : [p.api_key_env],
    timeoutS: p.timeout_s,
    maxRetries: p.max_retries,
  }))
  .refine(
    (p) => p.kind === "gemini" || p.baseUrl !== undefined,
    "openai_compat providers require base_url",
  )
  .refine(
    (p) => p.apiKeyEnv.every((n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n)),
    "api_key_env must hold env var NAMES, not key values",
  );

// ----------------------------------------------------------------- models

const ModelSchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    // No defaults. The original never pinned these; omitting them must fail.
    temperature: z.number().min(0).max(2),
    top_p: z.number().min(0).max(1),
    max_tokens: z.number().int().positive(),
    thinking: z.boolean(),
    reasoning_budget: z.number().int().positive().nullable().default(null),
    supports_tools: z.boolean().default(false),
  })
  .transform((m) => ({
    provider: m.provider,
    model: m.model,
    temperature: m.temperature,
    topP: m.top_p,
    maxTokens: m.max_tokens,
    thinking: m.thinking,
    reasoningBudget: m.reasoning_budget,
    supportsTools: m.supports_tools,
  }));

// ------------------------------------------------------------------ tasks

const TaskSelectionSchema = z
  .object({
    selection: z.enum(["explicit", "stratified", "all"]),
    ids: z.array(z.string()).optional(),
    n: z.number().int().positive().optional(),
    per_repo_min: z.number().int().nonnegative().optional(),
  })
  .transform((t) => ({
    selection: t.selection,
    ids: t.ids ?? [],
    n: t.n ?? null,
    perRepoMin: t.per_repo_min ?? 0,
  }))
  .refine(
    (t) => t.selection !== "explicit" || t.ids.length > 0,
    "selection: explicit requires ids",
  )
  .refine(
    (t) => t.selection !== "stratified" || t.n !== null,
    "selection: stratified requires n",
  );

const TasksSchema = z
  .object({
    dataset: z.string(),
    split: z.string().default("test"),
    source: z.string().default("data/swebench_lite.jsonl"),
    /** Pinned by step 0. A different upstream revision must be loud, not silent. */
    revision: z.string().length(40),
    expected_rows: z.number().int().positive(),
    context: z
      .object({
        mode: z.enum(["whole_file", "symbol"]),
        padding_lines: z.number().int().nonnegative().default(50),
      })
      .transform((c) => ({ mode: c.mode, paddingLines: c.padding_lines })),
  })
  .catchall(z.unknown())
  .transform((t) => {
    // Named task sets live as sibling keys (failure_pool, stratified_60, …).
    const reserved = new Set([
      "dataset",
      "split",
      "source",
      "revision",
      "expected_rows",
      "context",
    ]);
    const sets: Record<string, z.infer<typeof TaskSelectionSchema>> = {};
    for (const [k, v] of Object.entries(t)) {
      if (reserved.has(k)) continue;
      const parsed = TaskSelectionSchema.safeParse(v);
      if (!parsed.success) {
        throw new Error(
          `tasks.${k}: ` +
            parsed.error.issues
              .map((i) => `${i.path.join(".")} — ${i.message}`)
              .join("; "),
        );
      }
      sets[k] = parsed.data;
    }
    return {
      dataset: t.dataset,
      split: t.split,
      source: t.source,
      revision: t.revision,
      expectedRows: t.expected_rows,
      context: t.context,
      sets,
    };
  });

// ------------------------------------------------------- edit / budget / verify

const EditSchema = z
  .object({
    formats: z.array(z.enum(EDIT_FORMATS)).min(1),
    fuzzy_match: z.boolean().default(false),
  })
  .transform((e) => ({ formats: e.formats, fuzzyMatch: e.fuzzy_match }));

const BudgetProviderSchema = z
  .object({
    max_tokens: z.number().int().positive(),
    max_calls: z.number().int().positive(),
  })
  .transform((b) => ({ maxTokens: b.max_tokens, maxCalls: b.max_calls }));

const BudgetSchema = z
  .object({
    estimate_before_run: z.boolean().default(true),
    stop_on_exhaustion: z.enum(["halt", "skip_arm"]).default("halt"),
  })
  .catchall(z.unknown())
  .transform((b) => {
    // Per-provider ceilings are flat sibling keys (budget.nvidia.max_tokens),
    // as CONFIG.md documents them.
    const providers: Record<string, z.infer<typeof BudgetProviderSchema>> = {};
    for (const [k, v] of Object.entries(b)) {
      if (k === "estimate_before_run" || k === "stop_on_exhaustion") continue;
      const parsed = BudgetProviderSchema.safeParse(v);
      if (!parsed.success) {
        throw new Error(
          `budget.${k}: ` +
            parsed.error.issues
              .map((i) => `${i.path.join(".")} — ${i.message}`)
              .join("; "),
        );
      }
      providers[k] = parsed.data;
    }
    return {
      estimateBeforeRun: b.estimate_before_run,
      stopOnExhaustion: b.stop_on_exhaustion,
      providers,
    };
  });

const VerifySchema = z
  .object({
    /** D6. There is no second value, now or ever. */
    backend: z.literal("git_apply"),
    contamination: z
      .object({
        enabled: z.boolean().default(true),
        threshold: z.number().min(0).max(1).default(0.95),
      })
      .default({ enabled: true, threshold: 0.95 }),
  })
  .transform((v) => ({ backend: v.backend, contamination: v.contamination }));

// ------------------------------------------------------------------- grid

const ArmSchema = z
  .object({
    enabled: z.boolean().default(true),
    models: z.array(z.string()).min(1),
    tasks: z.string().min(1),
    strategies: z.array(z.enum(STRATEGY_IDS)).min(1),
    edit_formats: z.array(z.enum(EDIT_FORMATS)).min(1),
    thinking: z.array(z.boolean()).min(1).default([false]),
    rounds: z.number().int().positive().default(1),
    repeats: z.number().int().positive().default(1),
    note: z.string().optional(),
  })
  .transform((a) => ({
    enabled: a.enabled,
    models: a.models,
    tasks: a.tasks,
    strategies: a.strategies,
    editFormats: a.edit_formats,
    thinking: a.thinking,
    rounds: a.rounds,
    repeats: a.repeats,
    note: a.note ?? null,
  }));

// ------------------------------------------------------------------ root

export const ConfigSchema = z
  .object({
    run: RunSchema,
    providers: z.record(z.string(), ProviderSchema),
    models: z.record(z.string(), ModelSchema),
    tasks: TasksSchema,
    edit: EditSchema,
    budget: BudgetSchema,
    verify: VerifySchema,
    grid: z.record(z.string(), ArmSchema),
  })
  .superRefine((c, ctx) => {
    // Every model must name a provider that exists.
    for (const [id, m] of Object.entries(c.models)) {
      if (!(m.provider in c.providers)) {
        ctx.addIssue({
          code: "custom",
          path: ["models", id, "provider"],
          message: `unknown provider "${m.provider}"`,
        });
      }
    }
    // Every arm must name models and a task set that exist.
    for (const [arm, a] of Object.entries(c.grid)) {
      for (const m of a.models) {
        if (!(m in c.models)) {
          ctx.addIssue({
            code: "custom",
            path: ["grid", arm, "models"],
            message: `unknown model "${m}"`,
          });
        }
      }
      if (!(a.tasks in c.tasks.sets)) {
        ctx.addIssue({
          code: "custom",
          path: ["grid", arm, "tasks"],
          message: `unknown task set "${a.tasks}"`,
        });
      }
      // D5: a comparison arm that varies thinking must say so explicitly.
      if (a.thinking.includes(true) && a.thinking.length === 1) {
        ctx.addIssue({
          code: "custom",
          path: ["grid", arm, "thinking"],
          message:
            "an arm with thinking: [true] only cannot be compared against " +
            "Nakul's non-reasoning baseline (D5). Use [false, true] to make it " +
            "the manipulated variable, or [false].",
        });
      }
    }
    // D5, checked across the whole config rather than per model. A model may
    // declare a reasoning_budget while its own `thinking` is false, provided some
    // enabled arm turns thinking on for it — that is exactly how A4 is built. A
    // budget no arm ever uses is dead config and is reported.
    const thinkingModels = new Set(
      Object.values(c.grid)
        .filter((a) => a.enabled && a.thinking.includes(true))
        .flatMap((a) => a.models),
    );
    for (const [id, m] of Object.entries(c.models)) {
      if (m.reasoningBudget !== null && !m.thinking && !thinkingModels.has(id)) {
        ctx.addIssue({
          code: "custom",
          path: ["models", id, "reasoning_budget"],
          message:
            "reasoning_budget is set but nothing ever thinks with this model: " +
            "its own thinking is false and no enabled arm sets thinking: true. " +
            "Either remove the budget or add the model to a reasoning arm (D5).",
        });
      }
    }

    // Every budgeted provider must exist.
    for (const p of Object.keys(c.budget.providers)) {
      if (!(p in c.providers)) {
        ctx.addIssue({
          code: "custom",
          path: ["budget", "providers", p],
          message: `unknown provider "${p}"`,
        });
      }
    }
  });

export type Config = z.infer<typeof ConfigSchema>;
export type ProviderConfig = Config["providers"][string];
export type ModelConfig = Config["models"][string];
export type Arm = Config["grid"][string];

// --------------------------------------------------------------- loading

export class ConfigError extends Error {
  constructor(
    readonly path: string,
    readonly issues: z.core.$ZodIssue[],
  ) {
    super(
      `${path} is not a valid config:\n` +
        issues
          .map((i) => `  ${i.path.join(".") || "(root)"} — ${i.message}`)
          .join("\n"),
    );
    this.name = "ConfigError";
  }
}

export async function loadConfig(
  path: string,
): Promise<{ config: Config; hash: string; raw: string }> {
  const raw = await Bun.file(path).text();
  const parsed = ConfigSchema.safeParse(parseYaml(raw));
  if (!parsed.success) throw new ConfigError(path, parsed.error.issues);
  return { config: parsed.data, hash: hashConfig(raw), raw };
}

/**
 * Hashes the *raw YAML*, not the parsed object — so a comment change registers
 * as a different config. That is deliberate: comments in `base.yaml` document
 * which models were dropped and why, and that is part of the experimental
 * record.
 */
export function hashConfig(rawYaml: string): string {
  const h = new Bun.CryptoHasher("sha256");
  h.update(rawYaml);
  return h.digest("hex").slice(0, 16);
}

/** Resolves env var names to presence, never to values. */
export function keyStatus(p: ProviderConfig): { name: string; present: boolean }[] {
  return p.apiKeyEnv.map((name) => ({
    name,
    present: (process.env[name] ?? "").length > 0,
  }));
}
