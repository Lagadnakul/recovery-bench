/**
 * Google Generative Language — `generateContent`.
 *
 * A separate file because almost nothing lines up with the OpenAI shape:
 * `contents[].parts[].text` instead of `messages[].content`,
 * `generationConfig.maxOutputTokens` instead of `max_tokens`, `usageMetadata`
 * with `candidatesTokenCount` instead of `usage.completion_tokens`, and
 * `finishReason` in SCREAMING_CASE.
 *
 * It also has a failure mode the others do not: `RECITATION`, a stop because
 * the output resembled training data. That is not a malformed patch and must
 * not be counted as one — the archive's `astropy__astropy-14182` is exactly
 * this case, and the dissertation already excludes it from the recovery
 * denominator. `normaliseFinish` maps it to `filtered`.
 *
 * Until now `doctor --live` reported `probe not implemented for kind gemini`.
 */

import type { ProviderConfig } from "../../core/config.ts";
import {
  normaliseFinish,
  ProviderError,
  type ProviderClient,
  type ProviderRequest,
  type ProviderResult,
} from "./types.ts";
import { KeyPool, scrub } from "./openaiCompat.ts";

const DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
  promptFeedback?: { blockReason?: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GeminiProvider implements ProviderClient {
  private readonly pool: KeyPool;
  private readonly baseUrl: string;

  constructor(
    readonly id: string,
    private readonly cfg: ProviderConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly backoffMs: (attempt: number) => number = (a) =>
      Math.min(30_000, 500 * 2 ** a),
  ) {
    this.pool = new KeyPool(cfg.apiKeyEnv);
    this.baseUrl = cfg.baseUrl ?? DEFAULT_BASE;
  }

  get keyNames(): readonly string[] {
    return this.pool.names;
  }

  nextKey(): string {
    return this.pool.next();
  }

  configuredKeys(): string[] {
    return this.pool.configured();
  }

  excludeKey(name: string): void {
    this.pool.exclude(name);
  }

  async call(req: ProviderRequest, pinned?: string): Promise<ProviderResult> {
    let retries = 0;
    let rotated = false;

    for (;;) {
      const keyName = pinned && !rotated ? pinned : this.pool.current();
      const started = Bun.nanoseconds();

      try {
        const res = await this.fetchImpl(
          `${this.baseUrl}/models/${req.model}:generateContent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              // Header rather than a query parameter: a key in a URL ends up
              // in logs and proxy traces.
              "x-goog-api-key": process.env[keyName] ?? "",
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: req.prompt }] }],
              ...(req.system
                ? { systemInstruction: { parts: [{ text: req.system }] } }
                : {}),
              generationConfig: {
                temperature: req.temperature,
                topP: req.topP,
                maxOutputTokens: req.maxTokens,
                // Gemini's equivalent of `enable_thinking` (D19). A budget of
                // 0 disables reasoning; omitting it entirely lets the model
                // think, which is how a `thinking: false` config came to bill
                // 93 thought tokens for a one-word answer.
                thinkingConfig: { thinkingBudget: req.thinking ? -1 : 0 },
              },
            }),
            signal: AbortSignal.timeout(this.cfg.timeoutS * 1000),
          },
        );

        if (!res.ok) {
          const body = scrub((await res.text()).slice(0, 300));
          const retryable = res.status === 429 || res.status >= 500;
          if (res.status === 429) {
            this.pool.rotate();
            rotated = true;
          }
          const err = new ProviderError(
            `HTTP ${res.status} — ${body}`,
            res.status,
            retries,
            retryable,
          );
          if (!retryable || retries >= this.cfg.maxRetries) throw err;
          retries++;
          await sleep(this.backoffMs(retries));
          continue;
        }

        const json = (await res.json()) as GeminiResponse;
        const latencyMs = (Bun.nanoseconds() - started) / 1e6;

        // A prompt-level block returns no candidates at all.
        if (json.promptFeedback?.blockReason && !json.candidates?.length) {
          throw new ProviderError(
            `blocked before generation: ${json.promptFeedback.blockReason}`,
            res.status,
            retries,
            false,
          );
        }

        const cand = json.candidates?.[0];
        const parts = cand?.content?.parts ?? [];
        // Gemini marks disclosed chain-of-thought with `thought: true` and
        // mixes it into the same parts array.
        const content = parts
          .filter((p) => p.thought !== true && typeof p.text === "string")
          .map((p) => p.text)
          .join("");
        const thoughts = parts
          .filter((p) => p.thought === true && typeof p.text === "string")
          .map((p) => p.text)
          .join("");

        const um = json.usageMetadata ?? {};
        return {
          content,
          reasoning: thoughts.length > 0 ? thoughts : null,
          finishReason: normaliseFinish(cand?.finishReason),
          keyName,
          retries,
          usage: {
            promptTokens: um.promptTokenCount ?? 0,
            // `candidatesTokenCount` excludes thoughts, which are billed
            // separately as `thoughtsTokenCount`. Charge both.
            completionTokens:
              (um.candidatesTokenCount ?? 0) + (um.thoughtsTokenCount ?? 0),
            reasoningTokens: um.thoughtsTokenCount ?? null,
            latencyMs,
          },
        };
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        const msg = scrub(e instanceof Error ? e.message : String(e));
        const err = new ProviderError(msg, null, retries, true);
        if (retries >= this.cfg.maxRetries) throw err;
        retries++;
        await sleep(this.backoffMs(retries));
      }
    }
  }

  /**
   * Gemini has no streaming TTFT path here on purpose: `streamGenerateContent`
   * uses a different transport again, and the probe's job is to report honest
   * numbers, not to report a number for its own sake. Total latency is
   * measured; TTFT is reported as unavailable rather than guessed.
   */
  async probe(req: ProviderRequest): Promise<{
    ttftMs: null;
    tps: number | null;
    totalMs: number;
    completionTokens: number | null;
    reasoningTokens: number | null;
    contentChars: number;
    sawContent: boolean;
    finishReason: string | null;
    keyName: string;
  }> {
    const started = Bun.nanoseconds();
    const r = await this.call(req);
    const totalMs = (Bun.nanoseconds() - started) / 1e6;
    return {
      ttftMs: null,
      tps:
        r.usage.completionTokens > 0
          ? r.usage.completionTokens / (Math.max(totalMs, 1) / 1000)
          : null,
      totalMs,
      completionTokens: r.usage.completionTokens,
      reasoningTokens: r.usage.reasoningTokens,
      contentChars: r.content.length,
      sawContent: r.content.length > 0,
      finishReason: r.finishReason,
      keyName: r.keyName,
    };
  }
}
