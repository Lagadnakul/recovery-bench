/**
 * The provider seam.
 *
 * Everything above this file — strategies, the sweep, the analysis — sees
 * `ProviderResult` and nothing else. No vendor field name escapes upward.
 *
 * This matters because the three providers disagree about almost everything:
 * NVIDIA and Qwen speak OpenAI's chat shape, Gemini speaks `generateContent`;
 * Qwen itemises reasoning tokens, NVIDIA folds them into the completion count;
 * Gemini calls the whole thing `usageMetadata`. Measured, not assumed — see
 * DECISIONS.md D17.
 */

import type { Usage } from "../../core/types.ts";

export interface ProviderRequest {
  /** The vendor's own model string, e.g. `meta/muse-glimmer-30b`. */
  model: string;
  prompt: string;
  /** System instruction, when the strategy supplies one. */
  system?: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  /**
   * Whether the model is asked to reason before answering.
   *
   * Until step 4 this was declared in config and never transmitted, so every
   * call ran with the vendor default — thinking ON — while the config claimed
   * `thinking: false` (D19). Sending it changes cost by more than an order of
   * magnitude: `nemotron_ultra` bills 38 completion tokens to answer "ok" with
   * the vendor default and 2 with thinking explicitly off.
   */
  thinking: boolean;
  /** Null when the model has no separate reasoning budget (D5). */
  reasoningBudget?: number | null;
}

/**
 * Why a call ended, in the provider's own words, normalised.
 *
 * `length` is the one that matters: it means our ceiling severed the response.
 * A severed response is not an empty one and is not a malformed one — see D18
 * for why that distinction is load-bearing rather than pedantic.
 */
export type FinishReason = "stop" | "length" | "filtered" | "other";

export interface ProviderResult {
  /** Visible assistant output. Empty string is a legal, meaningful value. */
  content: string;
  /**
   * Chain-of-thought the vendor chose to disclose. Recorded because it is
   * *billed* — `muse_30b` spent 103 completion tokens to emit the single
   * visible token "ok". Never fed back into a later turn.
   */
  reasoning: string | null;
  finishReason: FinishReason;
  usage: Usage;
  /** Which env var name supplied the key. A NAME only, never a value. */
  keyName: string;
  /** Retries consumed before this result. 0 on a first-attempt success. */
  retries: number;
}

/** A call that never produced a result. Carries no key material. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retries: number,
    /** True when retrying could plausibly succeed: 429, 5xx, timeouts. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface ProviderClient {
  readonly id: string;
  /** Resolved at construction from `api_key_env`; names only. */
  readonly keyNames: readonly string[];
  /**
   * The key this client would use next, advancing the round-robin.
   *
   * Exists so a caller can charge the right account *before* spending: with
   * per-key budgets the ceiling belongs to a key, and reserving against the
   * provider would let one key overrun while others sat idle (D28).
   */
  nextKey(): string;
  /** Key names that actually have a value set, whether excluded or not. */
  configuredKeys(): string[];
  /** Stop handing out a key — used when its own budget is spent. */
  excludeKey(name: string): void;
  call(req: ProviderRequest, keyName?: string): Promise<ProviderResult>;
}

/**
 * Providers put reasoning-token counts in three different places, and Gemini
 * in a fourth. Read every shape rather than the one we happened to test.
 */
export function pickReasoningTokens(u: {
  reasoning_tokens?: unknown;
  completion_tokens_details?: { reasoning_tokens?: unknown } | null;
  output_tokens_details?: { reasoning_tokens?: unknown } | null;
}): number | null {
  const candidates = [
    u.completion_tokens_details?.reasoning_tokens,
    u.output_tokens_details?.reasoning_tokens,
    u.reasoning_tokens,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
  }
  return null;
}

export function normaliseFinish(raw: unknown): FinishReason {
  switch (raw) {
    case "stop":
    case "STOP":
    case "end_turn":
      return "stop";
    case "length":
    case "MAX_TOKENS":
    case "max_tokens":
      return "length";
    case "content_filter":
    case "SAFETY":
    case "RECITATION":
      return "filtered";
    default:
      return "other";
  }
}
