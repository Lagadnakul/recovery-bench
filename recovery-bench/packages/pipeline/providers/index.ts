/**
 * The registry, and the only sanctioned path to a model call.
 *
 * `callCell` is where the budget becomes real: it reserves before dispatch,
 * commits the provider's own token counts afterwards, and converts every
 * terminal state into an `Outcome`. No caller can spend without passing
 * through it, which is the structural reason the ceiling cannot be forgotten.
 */

import type { Config, ProviderConfig } from "../../core/config.ts";
import type { Cell, Outcome, Usage } from "../../core/types.ts";
import { cellKey } from "../../core/types.ts";
import { BudgetLedger, worstCaseTokens, BudgetExceeded } from "./budget.ts";
import { GeminiProvider } from "./gemini.ts";
import { OpenAICompatProvider } from "./openaiCompat.ts";
import { ProviderError, type ProviderClient, type ProviderRequest } from "./types.ts";

export * from "./types.ts";
export { BudgetLedger, LEDGER_PATH, worstCaseTokens } from "./budget.ts";
export { FakeProvider } from "./fake.ts";
export { KeyPool, OpenAICompatProvider, scrub } from "./openaiCompat.ts";
export { GeminiProvider } from "./gemini.ts";

export function makeClient(
  id: string,
  cfg: ProviderConfig,
  fetchImpl: typeof fetch = fetch,
): ProviderClient {
  switch (cfg.kind) {
    case "openai_compat":
      return new OpenAICompatProvider(id, cfg, fetchImpl);
    case "gemini":
      return new GeminiProvider(id, cfg, fetchImpl);
    default: {
      const exhaustive: never = cfg.kind;
      throw new Error(`unknown provider kind ${String(exhaustive)}`);
    }
  }
}

export interface Registry {
  /** Provider id → client. */
  clients: Map<string, ProviderClient>;
  /** Model id (config key) → provider id. */
  providerOf: Map<string, string>;
}

export function buildRegistry(
  cfg: Config,
  fetchImpl: typeof fetch = fetch,
): Registry {
  const clients = new Map<string, ProviderClient>();
  for (const [id, p] of Object.entries(cfg.providers)) {
    clients.set(id, makeClient(id, p, fetchImpl));
  }
  const providerOf = new Map<string, string>();
  for (const [id, m] of Object.entries(cfg.models)) {
    providerOf.set(id, m.provider);
  }
  return { clients, providerOf };
}

export interface CellCallResult {
  /**
   * The terminal outcome, or `null` when the call succeeded and classification
   * is the edit layer's to make.
   *
   * `null` is the honest encoding: this function genuinely does not know
   * whether usable content is a patch, a malformed patch or prose, and faking
   * an outcome here would put the format-class decision in the provider layer
   * where a vendor change could move it.
   */
  outcome: Outcome | null;
  usage: Usage | null;
  /** Raw visible text, for the edit layer to parse. Empty when there is none. */
  content: string;
  keyName: string | null;
}

/**
 * Executes one cell's model call under the budget.
 *
 * The outcome mapping is the substance of this function:
 *
 *   - refused by the ledger → `BUDGET_STOP`, **no request sent**
 *   - `finish_reason: length` → `TRUNCATED` (D18), never `NO_OUTPUT`
 *   - empty content, stopped cleanly → `NO_OUTPUT`
 *   - transport or HTTP failure → `PROVIDER_ERROR` with the retry count
 *   - otherwise the content is returned for the edit layer to classify
 *
 * Note what is *not* here: nothing decides whether a patch is malformed or
 * applies. That belongs to `edits/` and `verify/`, and keeping it out means a
 * provider change can never move the format-class number.
 */
export async function callCell(
  cell: Cell,
  cfg: Config,
  registry: Registry,
  ledger: BudgetLedger,
  prompt: string,
  system?: string,
): Promise<CellCallResult> {
  const model = cfg.models[cell.model];
  if (!model) throw new Error(`cell names unknown model ${cell.model}`);
  const providerId = model.provider;
  const client = registry.clients.get(providerId);
  if (!client) throw new Error(`no client for provider ${providerId}`);

  const req: ProviderRequest = {
    model: model.model,
    prompt,
    // Spread rather than assign: `exactOptionalPropertyTypes` distinguishes an
    // absent system prompt from one explicitly set to undefined.
    ...(system === undefined ? {} : { system }),
    temperature: model.temperature,
    topP: model.topP,
    maxTokens: model.maxTokens,
    thinking: cell.thinking,
    reasoningBudget: model.reasoningBudget,
  };

  const worstCase = worstCaseTokens(prompt.length + (system?.length ?? 0), model.maxTokens);
  const key = cellKey(cell);

  // ---------------------------------------------------------- pre-flight
  let reservation;
  try {
    reservation = ledger.reserve(providerId, worstCase);
  } catch (e) {
    if (e instanceof BudgetExceeded) {
      return {
        outcome: { kind: "BUDGET_STOP", tokensUsed: e.tokensUsed, ceiling: e.ceiling },
        usage: null,
        content: "",
        keyName: null,
      };
    }
    throw e;
  }

  // ---------------------------------------------------------------- call
  try {
    const r = await client.call(req);

    const truncated = r.finishReason === "length";
    await ledger.commit(
      reservation,
      {
        provider: providerId,
        model: model.model,
        cell: key,
        promptTokens: r.usage.promptTokens,
        completionTokens: r.usage.completionTokens,
        reasoningTokens: r.usage.reasoningTokens,
        latencyMs: Math.round(r.usage.latencyMs),
        status: 200,
        retries: r.retries,
        outcome: truncated ? "truncated" : "ok",
      },
      r.usage,
    );

    if (truncated) {
      return {
        outcome: {
          kind: "TRUNCATED",
          finishReason: r.finishReason,
          completionTokens: r.usage.completionTokens,
          maxTokens: model.maxTokens,
          contentChars: r.content.length,
        },
        usage: r.usage,
        content: r.content,
        keyName: r.keyName,
      };
    }

    if (r.content.trim() === "") {
      return {
        outcome: {
          kind: "NO_OUTPUT",
          detail: `finish_reason=${r.finishReason}, ${r.usage.completionTokens} completion tokens billed`,
        },
        usage: r.usage,
        content: "",
        keyName: r.keyName,
      };
    }

    // Content in hand and nothing went wrong: the edit layer classifies it.
    return { outcome: null, usage: r.usage, content: r.content, keyName: r.keyName };
  } catch (e) {
    const err =
      e instanceof ProviderError ? e : new ProviderError(String(e), null, 0, false);
    await ledger.release(reservation, {
      provider: providerId,
      model: model.model,
      cell: key,
      promptTokens: 0,
      completionTokens: 0,
      reasoningTokens: null,
      latencyMs: 0,
      status: err.status,
      retries: err.retries,
      outcome: "error",
    });
    return {
      outcome: {
        kind: "PROVIDER_ERROR",
        status: err.status,
        reason: err.message,
        retries: err.retries,
      },
      usage: null,
      content: "",
      keyName: null,
    };
  }
}
