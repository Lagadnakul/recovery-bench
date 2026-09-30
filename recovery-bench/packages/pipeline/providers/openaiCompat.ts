/**
 * NVIDIA NIM and Qwen Cloud. Same wire format, different quirks.
 *
 * Both were measured before this file was written (D17):
 *
 *   - NVIDIA folds reasoning tokens into `completion_tokens` and discloses the
 *     text in a non-standard `message.reasoning_content` field.
 *   - Qwen itemises them in `completion_tokens_details.reasoning_tokens` — the
 *     probe returned 24 reasoning tokens of 28 completion tokens to answer
 *     "ok".
 *
 * Either way the *billed* figure is `completion_tokens`, so that is what the
 * ledger charges. Reading only visible output would have understated the cost
 * of `muse_30b` by two orders of magnitude.
 */

import type { ProviderConfig } from "../../core/config.ts";
import {
  normaliseFinish,
  pickReasoningTokens,
  ProviderError,
  type ProviderClient,
  type ProviderRequest,
  type ProviderResult,
} from "./types.ts";

interface ChatChoice {
  message?: { content?: string | null; reasoning_content?: string | null };
  finish_reason?: string | null;
}

interface ChatResponse {
  choices?: ChatChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    reasoning_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number } | null;
  } | null;
}

/** A key pool. Holds names and reads values lazily; never stores a value. */
export class KeyPool {
  private index = 0;

  constructor(readonly names: readonly string[]) {}

  /** Names whose env var is actually set. */
  available(): string[] {
    return this.names.filter((n) => (process.env[n] ?? "").length > 0);
  }

  current(): string {
    const set = this.available();
    if (set.length === 0) {
      throw new ProviderError(
        `no key set; tried ${this.names.join(", ")}`,
        null,
        0,
        false,
      );
    }
    return set[this.index % set.length]!;
  }

  /** Called on 429 — this key is rate-limited, try the next one. */
  rotate(): void {
    this.index++;
  }

  get size(): number {
    return this.available().length;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class OpenAICompatProvider implements ProviderClient {
  private readonly pool: KeyPool;

  constructor(
    readonly id: string,
    private readonly cfg: ProviderConfig,
    /** Injected so tests can drive retry logic without real sockets. */
    private readonly fetchImpl: typeof fetch = fetch,
    /** Overridden in tests to keep backoff from making the suite slow. */
    private readonly backoffMs: (attempt: number) => number = (a) =>
      Math.min(30_000, 500 * 2 ** a),
  ) {
    if (cfg.kind !== "openai_compat") {
      throw new Error(`OpenAICompatProvider given provider of kind ${cfg.kind}`);
    }
    this.pool = new KeyPool(cfg.apiKeyEnv);
  }

  get keyNames(): readonly string[] {
    return this.pool.names;
  }

  async call(req: ProviderRequest): Promise<ProviderResult> {
    let retries = 0;
    let lastError: ProviderError | null = null;

    for (;;) {
      const keyName = this.pool.current();
      const started = Bun.nanoseconds();

      try {
        const res = await this.fetchImpl(`${this.cfg.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${process.env[keyName]}`,
          },
          body: JSON.stringify({
            model: req.model,
            messages: [
              ...(req.system ? [{ role: "system", content: req.system }] : []),
              { role: "user", content: req.prompt },
            ],
            temperature: req.temperature,
            top_p: req.topP,
            max_tokens: req.maxTokens,
            // Measured (D19): without this the vendor default applies, which
            // is thinking ON. `nemotron_nano` and `nemotron_ultra` honour it
            // and drop to zero reasoning tokens; `muse_30b` does not, and
            // `doctor` reports that as the validity threat it is.
            chat_template_kwargs: { enable_thinking: req.thinking },
          }),
          signal: AbortSignal.timeout(this.cfg.timeoutS * 1000),
        });

        if (!res.ok) {
          // The body can echo the key on some gateways, so it is truncated and
          // scrubbed before it ever reaches a log or the ledger.
          const body = scrub((await res.text()).slice(0, 300));
          const retryable = res.status === 429 || res.status >= 500;
          if (res.status === 429) this.pool.rotate();
          lastError = new ProviderError(
            `HTTP ${res.status} — ${body}`,
            res.status,
            retries,
            retryable,
          );
          if (!retryable || retries >= this.cfg.maxRetries) throw lastError;
          retries++;
          await sleep(this.backoffMs(retries));
          continue;
        }

        const json = (await res.json()) as ChatResponse;
        const latencyMs = (Bun.nanoseconds() - started) / 1e6;
        const choice = json.choices?.[0];

        if (!choice) {
          lastError = new ProviderError("response had no choices", res.status, retries, true);
          if (retries >= this.cfg.maxRetries) throw lastError;
          retries++;
          await sleep(this.backoffMs(retries));
          continue;
        }

        const u = json.usage ?? {};
        return {
          // `content: null` is a real response, not an absence — it is what
          // muse_30b returns when reasoning exhausts the ceiling.
          content: choice.message?.content ?? "",
          reasoning: choice.message?.reasoning_content ?? null,
          finishReason: normaliseFinish(choice.finish_reason),
          keyName,
          retries,
          usage: {
            promptTokens: u.prompt_tokens ?? 0,
            completionTokens: u.completion_tokens ?? 0,
            reasoningTokens: pickReasoningTokens(u),
            latencyMs,
          },
        };
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        // AbortError and socket failures land here.
        const msg = scrub(e instanceof Error ? e.message : String(e));
        lastError = new ProviderError(msg, null, retries, true);
        if (retries >= this.cfg.maxRetries) throw lastError;
        retries++;
        await sleep(this.backoffMs(retries));
      }
    }
  }

  /**
   * Streaming probe used by `doctor --live`.
   *
   * The distinction from `call()` is time-to-first-token, and getting it right
   * required fixing two defects in the previous implementation (D17):
   *
   *   1. TTFT latched only on `delta.content`. Reasoning models emit a long
   *      `reasoning_content` stream first, so for `muse_30b` and
   *      `nemotron_nano` the latch never fired, TTFT stayed null — and the
   *      model was still reported `ok`. It now latches on the first token of
   *      *any* kind and reports whether visible content ever arrived.
   *
   *   2. Throughput divided tokens by `end - ttft`. When the final content
   *      delta lands at the close of a reasoning stream that window collapses
   *      toward zero, which is how `nemotron_ultra` came to be reported at
   *      **94,094 tok/s**. Throughput is now measured over the whole
   *      generation window.
   */
  async probe(req: ProviderRequest): Promise<{
    ttftMs: number | null;
    tps: number | null;
    totalMs: number;
    completionTokens: number | null;
    reasoningTokens: number | null;
    contentChars: number;
    sawContent: boolean;
    finishReason: string | null;
    keyName: string;
  }> {
    const keyName = this.pool.current();
    const started = Bun.nanoseconds();
    let firstToken: number | null = null;
    let contentChars = 0;
    let sawContent = false;
    let deltas = 0;
    let finishReason: string | null = null;
    let usage: ChatResponse["usage"] = null;

    const res = await this.fetchImpl(`${this.cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env[keyName]}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: [{ role: "user", content: req.prompt }],
        temperature: req.temperature,
        top_p: req.topP,
        max_tokens: req.maxTokens,
        chat_template_kwargs: { enable_thinking: req.thinking },
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: AbortSignal.timeout(this.cfg.timeoutS * 1000),
    });

    if (!res.ok) {
      const body = scrub((await res.text()).slice(0, 200));
      throw new ProviderError(`HTTP ${res.status} — ${body}`, res.status, 0, false);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "" || payload === "[DONE]") continue;
        let chunk: {
          choices?: { delta?: { content?: string | null; reasoning_content?: string | null }; finish_reason?: string | null }[];
          usage?: ChatResponse["usage"];
        };
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }
        const delta = chunk.choices?.[0]?.delta;
        const text = delta?.content ?? "";
        const think = delta?.reasoning_content ?? "";
        // Latch on ANY token, reasoning included — defect 1 above.
        if (text.length > 0 || think.length > 0) deltas++;
        if (firstToken === null && (text.length > 0 || think.length > 0)) {
          firstToken = Bun.nanoseconds();
        }
        if (text.length > 0) {
          sawContent = true;
          contentChars += text.length;
        }
        if (chunk.choices?.[0]?.finish_reason) {
          finishReason = chunk.choices[0]!.finish_reason!;
        }
        if (chunk.usage) usage = chunk.usage;
      }
    }

    const totalMs = (Bun.nanoseconds() - started) / 1e6;

    /**
     * An HTTP 200 carrying an empty stream is an infrastructure failure, not a
     * silent model. Measured under concurrency: probing four NVIDIA models at
     * once returns 200 with a zero-delta body for some of them — sometimes
     * alongside `503 ResourceExhausted: Worker local total request limit
     * reached (16/16)` on a sibling request (D20). Sequentially the same
     * models answer in under half a second.
     *
     * Reporting this as "the model produced nothing" would blame the model for
     * a capacity limit, and in a sweep it would be recorded as NO_OUTPUT.
     */
    if (deltas === 0 && usage === null) {
      throw new ProviderError(
        "HTTP 200 with an empty stream — provider capacity, not model output " +
          "(retry sequentially)",
        200,
        0,
        true,
      );
    }

    const ttftMs = firstToken === null ? null : (firstToken - started) / 1e6;
    const completion = usage?.completion_tokens ?? null;

    /**
     * Throughput, or null when the sample cannot support the claim.
     *
     * The generation window is the time after the first token. For a reply of
     * two or three tokens that window is near zero, and dividing by it
     * manufactures a number: flooring it at 1ms turned a 3-token answer into
     * "3000 tok/s", which is the same class of falsehood as the 94,094 tok/s
     * this rewrite set out to remove (D17).
     *
     * So the thresholds below are honesty thresholds, not tuning. Below them
     * there is no measurement, and `null` says so.
     */
    const MIN_TOKENS_FOR_TPS = 12;
    const MIN_WINDOW_MS = 40;
    const genMs = ttftMs === null ? totalMs : totalMs - ttftMs;
    const measurable =
      completion !== null && completion >= MIN_TOKENS_FOR_TPS && genMs >= MIN_WINDOW_MS;

    return {
      ttftMs,
      tps: measurable ? completion! / (genMs / 1000) : null,
      totalMs,
      completionTokens: completion,
      reasoningTokens: usage ? pickReasoningTokens(usage) : null,
      contentChars,
      sawContent,
      finishReason,
      keyName,
    };
  }
}

/**
 * Removes anything key-shaped from a provider message.
 *
 * Gateways sometimes echo the offending credential in an error body. One such
 * echo written to the committed ledger would publish a live key, so the scrub
 * happens at the boundary rather than at every call site.
 */
export function scrub(s: string): string {
  let out = s;
  for (const name of Object.keys(process.env)) {
    if (!/KEY|TOKEN|SECRET|API/i.test(name)) continue;
    const value = process.env[name];
    if (value && value.length >= 8) out = out.split(value).join("<redacted>");
  }
  // Belt and braces: vendor-prefixed key shapes, whether or not they are ours.
  return out.replace(/\b(nvapi|sk|gsk|AIza)[-_A-Za-z0-9]{12,}/g, "<redacted>");
}
