/**
 * A scripted provider. No network, no key, deterministic.
 *
 * Its purpose is to make the failure paths testable. The interesting states —
 * a 429 that should rotate the key, a 500 that should exhaust retries, a
 * response severed by the token ceiling — are exactly the ones that are hard to
 * provoke against a live endpoint and the ones most likely to be wrong.
 *
 * Every scripted response below is shaped after a payload actually observed
 * from NVIDIA, Qwen or Gemini, not invented.
 */

import type { Usage } from "../../core/types.ts";
import {
  ProviderError,
  type FinishReason,
  type ProviderClient,
  type ProviderRequest,
  type ProviderResult,
} from "./types.ts";

export type Script =
  | { kind: "ok"; content: string; reasoning?: string; usage?: Partial<Usage> }
  | { kind: "truncated"; content: string; reasoning?: string; completionTokens?: number }
  | { kind: "empty"; reasoning?: string }
  | { kind: "http"; status: number; body?: string }
  | { kind: "timeout" };

export class FakeProvider implements ProviderClient {
  readonly id: string;
  readonly keyNames: readonly string[];
  /** Every request received, in order. Asserted against in tests. */
  readonly calls: ProviderRequest[] = [];
  /** Key name used per call, in order — proves rotation happened. */
  readonly keysUsed: string[] = [];

  private cursor = 0;
  private keyCursor = 0;
  private pinned: string | undefined;

  constructor(
    private readonly script: Script[],
    opts: { id?: string; keyNames?: string[] } = {},
  ) {
    this.id = opts.id ?? "fake";
    this.keyNames = opts.keyNames ?? ["FAKE_KEY_1"];
  }

  nextKey(): string {
    const name = this.keyNames[this.keyCursor % this.keyNames.length]!;
    this.keyCursor++;
    return name;
  }

  configuredKeys(): string[] {
    return [...this.keyNames];
  }

  excludeKey(name: string): void {
    this.excluded.add(name);
  }

  private excluded = new Set<string>();

  /** Remaining scripted steps — a test that leaves some has not run the path. */
  get remaining(): number {
    return Math.max(0, this.script.length - this.cursor);
  }

  async call(req: ProviderRequest, pinned?: string): Promise<ProviderResult> {
    this.calls.push(req);
    if (pinned) this.pinned = pinned;

    let retries = 0;
    for (;;) {
      const step = this.script[this.cursor];
      if (!step) throw new Error("FakeProvider: script exhausted");
      this.cursor++;

      const keyName =
        this.pinned ?? this.keyNames[this.keyCursor % this.keyNames.length]!;
      this.keysUsed.push(keyName);

      switch (step.kind) {
        case "ok":
          return this.result(req, step.content, step.reasoning ?? null, "stop", keyName, retries, step.usage);

        case "truncated":
          return this.result(
            req,
            step.content,
            step.reasoning ?? null,
            "length",
            keyName,
            retries,
            { completionTokens: step.completionTokens ?? req.maxTokens },
          );

        case "empty":
          // The muse_30b case: reasoning consumed the whole ceiling and no
          // visible content was ever emitted.
          return this.result(req, "", step.reasoning ?? null, "length", keyName, retries, {
            completionTokens: req.maxTokens,
          });

        case "timeout":
          retries++;
          if (retries > 3) throw new ProviderError("timed out", null, retries, true);
          continue;

        case "http": {
          const retryable = step.status === 429 || step.status >= 500;
          // 429 means this key is rate-limited; the next attempt should use a
          // different one. That rotation is the whole reason for a key pool.
          if (step.status === 429) {
            this.keyCursor++;
            this.pinned = undefined;
          }
          retries++;
          if (!retryable || retries > 3) {
            throw new ProviderError(
              `HTTP ${step.status}${step.body ? ` — ${step.body}` : ""}`,
              step.status,
              retries,
              retryable,
            );
          }
          continue;
        }
      }
    }
  }

  private result(
    req: ProviderRequest,
    content: string,
    reasoning: string | null,
    finishReason: FinishReason,
    keyName: string,
    retries: number,
    usage: Partial<Usage> = {},
  ): ProviderResult {
    return {
      content,
      reasoning,
      finishReason,
      keyName,
      retries,
      usage: {
        promptTokens: usage.promptTokens ?? Math.ceil(req.prompt.length / 4),
        completionTokens: usage.completionTokens ?? Math.ceil(content.length / 4),
        reasoningTokens:
          usage.reasoningTokens ?? (reasoning === null ? null : Math.ceil(reasoning.length / 4)),
        latencyMs: usage.latencyMs ?? 1,
      },
    };
  }
}
