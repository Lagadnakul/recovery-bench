/**
 * Provider behaviour on the paths that matter — which are the failure paths.
 *
 * Every fixture below is a payload shape actually observed from NVIDIA, Qwen or
 * Gemini during the step-4 probe (D17), not an invention. The reasoning-token
 * placements in particular differ per vendor and were read off real responses.
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GeminiProvider,
  KeyPool,
  OpenAICompatProvider,
  ProviderError,
  pickReasoningTokens,
  normaliseFinish,
  scrub,
} from "../packages/pipeline/providers/index.ts";
import { FakeProvider } from "../packages/pipeline/providers/fake.ts";
import { BudgetLedger } from "../packages/pipeline/providers/budget.ts";
import { callCell, buildRegistry } from "../packages/pipeline/providers/index.ts";
import { loadConfig } from "../packages/core/config.ts";
import type { Cell } from "../packages/core/types.ts";
import type { ProviderConfig } from "../packages/core/config.ts";

const NO_BACKOFF = () => 0;

const provCfg = (over: Partial<ProviderConfig> = {}): ProviderConfig =>
  ({
    kind: "openai_compat",
    baseUrl: "https://example.invalid/v1",
    apiKeyEnv: ["TEST_KEY_A", "TEST_KEY_B"],
    timeoutS: 5,
    maxRetries: 2,
    ...over,
  }) as ProviderConfig;

const req = {
  model: "test/model",
  prompt: "hello",
  temperature: 0,
  topP: 1,
  maxTokens: 64,
  thinking: false,
};

/** Builds a fetch stub that replays a queue of responses. */
function stubFetch(queue: (() => Response | Promise<Response>)[]) {
  const seen: { url: string; auth: string | null; body: unknown }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seen.push({
      url: String(url),
      auth: headers.get("authorization") ?? headers.get("x-goog-api-key"),
      body: JSON.parse(String(init?.body ?? "null")),
    });
    const next = queue.shift();
    if (!next) throw new Error("stubFetch: queue exhausted");
    return next();
  }) as unknown as typeof fetch;
  return { impl, seen };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

// A real NVIDIA success, trimmed: reasoning folded into completion_tokens.
const NVIDIA_OK = {
  choices: [
    {
      index: 0,
      message: { content: "ok", role: "assistant", reasoning_content: "We need ok." },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 63, completion_tokens: 103, total_tokens: 166 },
};

// The measured truncation: all 16 tokens spent on reasoning, content null.
const NVIDIA_TRUNCATED = {
  choices: [
    {
      index: 0,
      message: { content: null, role: "assistant", reasoning_content: "Reply with the sing" },
      finish_reason: "length",
    },
  ],
  usage: { prompt_tokens: 63, completion_tokens: 16, total_tokens: 79 },
};

// Qwen itemises reasoning tokens.
const QWEN_OK = {
  choices: [
    { index: 0, message: { role: "assistant", content: "ok", reasoning_content: "Think." }, finish_reason: "stop" },
  ],
  usage: {
    prompt_tokens: 68,
    completion_tokens: 28,
    total_tokens: 96,
    completion_tokens_details: { reasoning_tokens: 24, text_tokens: 28 },
  },
};

describe("usage mapping — vendors disagree about reasoning tokens", () => {
  test("NVIDIA discloses no itemisation, so reasoningTokens is null", async () => {
    const { impl } = stubFetch([() => json(200, NVIDIA_OK)]);
    process.env.TEST_KEY_A = "x".repeat(20);
    const p = new OpenAICompatProvider("nvidia", provCfg(), impl, NO_BACKOFF);
    const r = await p.call(req);
    expect(r.usage.completionTokens).toBe(103);
    expect(r.usage.reasoningTokens).toBeNull();
    // The point: 103 billed tokens for one visible token of output.
    expect(r.content).toBe("ok");
  });

  test("Qwen's itemised reasoning tokens are read", async () => {
    const { impl } = stubFetch([() => json(200, QWEN_OK)]);
    process.env.TEST_KEY_A = "x".repeat(20);
    const p = new OpenAICompatProvider("qwencloud", provCfg(), impl, NO_BACKOFF);
    const r = await p.call(req);
    expect(r.usage.completionTokens).toBe(28);
    expect(r.usage.reasoningTokens).toBe(24);
  });

  test("pickReasoningTokens reads all three known placements", () => {
    expect(pickReasoningTokens({ completion_tokens_details: { reasoning_tokens: 7 } })).toBe(7);
    expect(pickReasoningTokens({ output_tokens_details: { reasoning_tokens: 8 } })).toBe(8);
    expect(pickReasoningTokens({ reasoning_tokens: 9 })).toBe(9);
    expect(pickReasoningTokens({})).toBeNull();
  });

  test("normaliseFinish maps every vendor spelling, including RECITATION", () => {
    expect(normaliseFinish("stop")).toBe("stop");
    expect(normaliseFinish("MAX_TOKENS")).toBe("length");
    expect(normaliseFinish("length")).toBe("length");
    // The archive's astropy-14182 exclusion is exactly this case.
    expect(normaliseFinish("RECITATION")).toBe("filtered");
    expect(normaliseFinish("content_filter")).toBe("filtered");
    expect(normaliseFinish("weird")).toBe("other");
  });
});

describe("openai-compat — retries and key rotation", () => {
  test("a 429 rotates to the next key in the pool", async () => {
    process.env.TEST_KEY_A = "a".repeat(20);
    process.env.TEST_KEY_B = "b".repeat(20);
    const { impl, seen } = stubFetch([
      () => json(429, { error: "rate limit" }),
      () => json(200, NVIDIA_OK),
    ]);
    const p = new OpenAICompatProvider("nvidia", provCfg(), impl, NO_BACKOFF);
    const r = await p.call(req);
    expect(r.retries).toBe(1);
    // Rotation is the entire justification for a three-key pool.
    expect(seen[0]!.auth).not.toBe(seen[1]!.auth);
    expect(r.keyName).toBe("TEST_KEY_B");
  });

  test("a 500 is retried up to max_retries then becomes PROVIDER_ERROR", async () => {
    process.env.TEST_KEY_A = "a".repeat(20);
    const { impl } = stubFetch([
      () => json(500, { error: "boom" }),
      () => json(500, { error: "boom" }),
      () => json(500, { error: "boom" }),
    ]);
    const p = new OpenAICompatProvider("nvidia", provCfg({ maxRetries: 2 }), impl, NO_BACKOFF);
    await expect(p.call(req)).rejects.toThrow(ProviderError);
  });

  test("a 400 is NOT retried — retrying a bad request only wastes quota", async () => {
    process.env.TEST_KEY_A = "a".repeat(20);
    const { impl, seen } = stubFetch([() => json(400, { error: "bad model" })]);
    const p = new OpenAICompatProvider("nvidia", provCfg(), impl, NO_BACKOFF);
    await expect(p.call(req)).rejects.toThrow(/HTTP 400/);
    expect(seen.length).toBe(1);
  });

  test("an empty key pool fails before any request is made", async () => {
    delete process.env.TEST_KEY_A;
    delete process.env.TEST_KEY_B;
    const { impl, seen } = stubFetch([]);
    const p = new OpenAICompatProvider("nvidia", provCfg(), impl, NO_BACKOFF);
    await expect(p.call(req)).rejects.toThrow(/no key set/);
    expect(seen.length).toBe(0);
  });
});

describe("KeyPool", () => {
  test("only counts keys whose env var is actually set", () => {
    process.env.TEST_KEY_A = "a".repeat(20);
    delete process.env.TEST_KEY_B;
    const pool = new KeyPool(["TEST_KEY_A", "TEST_KEY_B"]);
    expect(pool.size).toBe(1);
    expect(pool.current()).toBe("TEST_KEY_A");
  });

  test("rotation wraps rather than running off the end", () => {
    process.env.TEST_KEY_A = "a".repeat(20);
    process.env.TEST_KEY_B = "b".repeat(20);
    const pool = new KeyPool(["TEST_KEY_A", "TEST_KEY_B"]);
    expect(pool.current()).toBe("TEST_KEY_A");
    pool.rotate();
    expect(pool.current()).toBe("TEST_KEY_B");
    pool.rotate();
    expect(pool.current()).toBe("TEST_KEY_A");
  });
});

describe("gemini — a different wire shape", () => {
  test("usageMetadata maps, and thoughts are billed as completion", async () => {
    process.env.TEST_GEMINI = "g".repeat(20);
    const { impl, seen } = stubFetch([
      () =>
        json(200, {
          candidates: [
            {
              content: { parts: [{ text: "thinking...", thought: true }, { text: "ok" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 9,
            candidatesTokenCount: 2,
            thoughtsTokenCount: 31,
            totalTokenCount: 42,
          },
        }),
    ]);
    const p = new GeminiProvider(
      "gemini",
      provCfg({ kind: "gemini", apiKeyEnv: ["TEST_GEMINI"], baseUrl: "https://g.invalid/v1beta" }),
      impl,
      NO_BACKOFF,
    );
    const r = await p.call(req);
    expect(r.content).toBe("ok");
    expect(r.reasoning).toBe("thinking...");
    // Thoughts are billed, so they must be charged: 2 + 31, not 2.
    expect(r.usage.completionTokens).toBe(33);
    expect(r.usage.reasoningTokens).toBe(31);
    // The key travels in a header, never in the URL where logs would keep it.
    expect(seen[0]!.url).not.toContain("g".repeat(20));
  });

  test("a prompt-level block is a hard error, not an empty answer", async () => {
    process.env.TEST_GEMINI = "g".repeat(20);
    const { impl } = stubFetch([
      () => json(200, { promptFeedback: { blockReason: "SAFETY" } }),
    ]);
    const p = new GeminiProvider(
      "gemini",
      provCfg({ kind: "gemini", apiKeyEnv: ["TEST_GEMINI"] }),
      impl,
      NO_BACKOFF,
    );
    await expect(p.call(req)).rejects.toThrow(/blocked before generation: SAFETY/);
  });
});

describe("scrub — no key value may reach a log or the ledger", () => {
  test("removes a live env key value echoed by a gateway", () => {
    process.env.TEST_KEY_A = "nvapi-abcdefghijklmnopqrstuvwxyz";
    const echoed = `invalid key: ${process.env.TEST_KEY_A} rejected`;
    const out = scrub(echoed);
    expect(out).not.toContain("nvapi-abcdefghijklmnopqrstuvwxyz");
    expect(out).toContain("<redacted>");
  });

  test("removes vendor-shaped keys that are not ours", () => {
    expect(scrub("token sk-0123456789abcdefghij here")).not.toContain("0123456789abcdef");
    expect(scrub("AIzaSyA0123456789abcdefghij")).toContain("<redacted>");
  });

  test("leaves ordinary error text intact", () => {
    expect(scrub("HTTP 500 — upstream unavailable")).toBe("HTTP 500 — upstream unavailable");
  });
});

// ─────────────────────────────────────────────────── callCell, end to end
const cell: Cell = {
  taskId: "django__django-11039",
  strategy: "l1_blind_retry",
  model: "muse_30b",
  editFormat: "search_replace",
  thinking: false,
  round: 1,
  repeat: 0,
};

async function cfgWithCeiling(maxTokens: number, maxCalls = 100) {
  const { config: cfg } = await loadConfig("configs/base.yaml");
  return {
    ...cfg,
    budget: {
      ...cfg.budget,
      providers: { ...cfg.budget.providers, nvidia: { maxTokens, maxCalls } },
    },
  };
}

describe("callCell — the budget is enforced, not documented", () => {
  test("a cell over the ceiling records BUDGET_STOP and sends NO request", async () => {
    const cfg = await cfgWithCeiling(100);
    const { impl, seen } = stubFetch([]);
    const registry = buildRegistry(cfg, impl);
    const ledger = BudgetLedger.empty(cfg.budget.providers);

    const r = await callCell(cell, cfg, registry, ledger, "please fix the bug");

    expect(r.outcome?.kind).toBe("BUDGET_STOP");
    // The whole point: nothing was spent because nothing was sent.
    expect(seen.length).toBe(0);
    expect(ledger.spendOf("nvidia").tokens).toBe(0);
  });

  test("finish_reason length becomes TRUNCATED, never NO_OUTPUT", async () => {
    process.env.NVIDIA_KEY_1 = "n".repeat(20);
    const cfg = await cfgWithCeiling(1_000_000);
    const dir = await mkdtemp(join(tmpdir(), "rb-cc-"));
    const { impl } = stubFetch([() => json(200, NVIDIA_TRUNCATED)]);
    const registry = buildRegistry(cfg, impl);
    const ledger = BudgetLedger.empty(cfg.budget.providers, join(dir, "l.jsonl"));

    const r = await callCell(cell, cfg, registry, ledger, "fix it");

    expect(r.outcome?.kind).toBe("TRUNCATED");
    if (r.outcome?.kind === "TRUNCATED") {
      // Zero visible characters, yet 16 tokens billed — the exact shape of the
      // measurement that motivated D18.
      expect(r.outcome.contentChars).toBe(0);
      expect(r.outcome.completionTokens).toBe(16);
    }
    // Truncated calls still cost money, so they are still charged.
    expect(ledger.spendOf("nvidia").tokens).toBe(79);
  });

  test("a clean stop with empty content is NO_OUTPUT", async () => {
    process.env.NVIDIA_KEY_1 = "n".repeat(20);
    const cfg = await cfgWithCeiling(1_000_000);
    const { impl } = stubFetch([
      () =>
        json(200, {
          choices: [{ message: { content: "" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 5, completion_tokens: 0 },
        }),
    ]);
    const registry = buildRegistry(cfg, impl);
    const ledger = BudgetLedger.empty(cfg.budget.providers);
    const r = await callCell(cell, cfg, registry, ledger, "fix it");
    expect(r.outcome?.kind).toBe("NO_OUTPUT");
  });

  test("usable content defers classification to the edit layer", async () => {
    process.env.NVIDIA_KEY_1 = "n".repeat(20);
    const cfg = await cfgWithCeiling(1_000_000);
    const { impl } = stubFetch([() => json(200, NVIDIA_OK)]);
    const registry = buildRegistry(cfg, impl);
    const ledger = BudgetLedger.empty(cfg.budget.providers);
    const r = await callCell(cell, cfg, registry, ledger, "fix it");
    // null, not a guessed outcome: nothing here knows if "ok" is a patch.
    expect(r.outcome).toBeNull();
    expect(r.content).toBe("ok");
  });

  test("a failed call records PROVIDER_ERROR and costs no tokens", async () => {
    process.env.NVIDIA_KEY_1 = "n".repeat(20);
    const cfg = await cfgWithCeiling(1_000_000);
    const { impl } = stubFetch([() => json(400, { error: "bad request" })]);
    const registry = buildRegistry(cfg, impl);
    const ledger = BudgetLedger.empty(cfg.budget.providers);

    const r = await callCell(cell, cfg, registry, ledger, "fix it");

    expect(r.outcome?.kind).toBe("PROVIDER_ERROR");
    expect(ledger.spendOf("nvidia").tokens).toBe(0);
    // But it still counted as a call against the rate limit.
    expect(ledger.spendOf("nvidia").calls).toBe(1);
    // And the reservation was released, so the next cell is not blocked.
    expect(ledger.spendOf("nvidia").reserved).toBe(0);
  });

  test("spend accumulates across cells until the ceiling refuses one", async () => {
    process.env.NVIDIA_KEY_1 = "n".repeat(20);
    // Ceiling of 8200 against max_tokens 8192. The first call reserves
    // 8192 + ceil(6/3) = 8194 and fits. It then commits its real cost, 166
    // tokens, leaving 8034 — less than the 8196 the second call could need, so
    // the second is refused before dispatch. Deliberately tight: the margin is
    // where an off-by-one in the check would hide.
    const cfg = await cfgWithCeiling(8_200);
    const { impl, seen } = stubFetch([() => json(200, NVIDIA_OK)]);
    const registry = buildRegistry(cfg, impl);
    const ledger = BudgetLedger.empty(cfg.budget.providers);

    const first = await callCell(cell, cfg, registry, ledger, "fix it");
    expect(first.outcome).toBeNull();

    const second = await callCell(cell, cfg, registry, ledger, "fix it again");
    expect(second.outcome?.kind).toBe("BUDGET_STOP");
    expect(seen.length).toBe(1);
  });
});

describe("FakeProvider — the scripted failure paths", () => {
  test("empty reproduces the muse_30b ceiling case", async () => {
    const p = new FakeProvider([{ kind: "empty", reasoning: "long thoughts" }]);
    const r = await p.call({ ...req, maxTokens: 16 });
    expect(r.content).toBe("");
    expect(r.finishReason).toBe("length");
    expect(r.usage.completionTokens).toBe(16);
  });

  test("429 then ok rotates the key", async () => {
    const p = new FakeProvider(
      [{ kind: "http", status: 429 }, { kind: "ok", content: "done" }],
      { keyNames: ["K1", "K2"] },
    );
    const r = await p.call(req);
    expect(r.content).toBe("done");
    expect(p.keysUsed).toEqual(["K1", "K2"]);
  });

  test("repeated 500s exhaust retries and throw", async () => {
    const p = new FakeProvider([
      { kind: "http", status: 500 },
      { kind: "http", status: 500 },
      { kind: "http", status: 500 },
      { kind: "http", status: 500 },
    ]);
    await expect(p.call(req)).rejects.toThrow(ProviderError);
  });
});

describe("D19 — the thinking flag must reach the wire", () => {
  test("openai-compat sends chat_template_kwargs.enable_thinking", async () => {
    process.env.TEST_KEY_A = "a".repeat(20);
    const { impl, seen } = stubFetch([() => json(200, NVIDIA_OK)]);
    const p = new OpenAICompatProvider("nvidia", provCfg(), impl, NO_BACKOFF);
    await p.call({ ...req, thinking: false });
    // The defect this guards: before step 4 the config declared thinking:false
    // and the request said nothing, so the vendor default (ON) applied and
    // every arm silently ran with reasoning enabled.
    expect((seen[0]!.body as Record<string, unknown>).chat_template_kwargs).toEqual({
      enable_thinking: false,
    });
  });

  test("openai-compat sends enable_thinking true when the arm thinks", async () => {
    process.env.TEST_KEY_A = "a".repeat(20);
    const { impl, seen } = stubFetch([() => json(200, NVIDIA_OK)]);
    const p = new OpenAICompatProvider("nvidia", provCfg(), impl, NO_BACKOFF);
    await p.call({ ...req, thinking: true });
    expect((seen[0]!.body as Record<string, unknown>).chat_template_kwargs).toEqual({
      enable_thinking: true,
    });
  });

  test("gemini sends thinkingBudget 0 when thinking is off", async () => {
    process.env.TEST_GEMINI = "g".repeat(20);
    const { impl, seen } = stubFetch([
      () =>
        json(200, {
          candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
          usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 1 },
        }),
    ]);
    const p = new GeminiProvider(
      "gemini",
      provCfg({ kind: "gemini", apiKeyEnv: ["TEST_GEMINI"] }),
      impl,
      NO_BACKOFF,
    );
    await p.call({ ...req, thinking: false });
    const body = seen[0]!.body as { generationConfig: { thinkingConfig: unknown } };
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  test("callCell takes thinking from the CELL, not the model default", async () => {
    process.env.NVIDIA_KEY_1 = "n".repeat(20);
    const cfg = await cfgWithCeiling(1_000_000);
    const { impl, seen } = stubFetch([() => json(200, NVIDIA_OK)]);
    const registry = buildRegistry(cfg, impl);
    const ledger = BudgetLedger.empty(cfg.budget.providers);
    // The grid varies thinking per arm (D5), so the cell is authoritative.
    await callCell({ ...cell, thinking: true }, cfg, registry, ledger, "fix it");
    expect((seen[0]!.body as Record<string, unknown>).chat_template_kwargs).toEqual({
      enable_thinking: true,
    });
  });
});
