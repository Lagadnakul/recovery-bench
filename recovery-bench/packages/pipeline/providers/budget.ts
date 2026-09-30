/**
 * The budget ledger.
 *
 * The original had a ceiling written as `max_tokens: 8_000_000`. YAML 1.2 has
 * no underscore separator, so it parsed as the *string* `"8_000_000"` and every
 * comparison against it was meaningless — the limit was decoration (D3).
 *
 * This ledger is the opposite: the check happens *before* dispatch, and a cell
 * that would exceed the ceiling terminates `BUDGET_STOP` without a request
 * being sent. Refusing to spend is the only behaviour that makes a ceiling real.
 *
 * Two properties are less obvious and both are tested:
 *
 *   1. **Reserve, then commit.** A call's true cost is unknown until it
 *      returns, so the worst case (`maxTokens` plus the prompt) is reserved up
 *      front and reconciled afterwards. Without reservation, N concurrent cells
 *      each see room for one more and collectively overrun.
 *
 *   2. **Resumable.** `run.resume: true` must not restart the budget at zero,
 *      or a resumed run silently spends the ceiling twice. State is rebuilt by
 *      replaying the ledger file.
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Config } from "../../core/config.ts";
import type { Usage } from "../../core/types.ts";

export const LEDGER_PATH = "data/ledger.jsonl";

/**
 * One line per call attempt, append-only.
 *
 * Deliberately absent: key values, key names, prompt text, completion text.
 * The ledger is committed to git — see D17 — so it carries counts and nothing
 * that could be a secret or a leak of task content.
 */
export interface LedgerRecord {
  ts: string;
  provider: string;
  model: string;
  /** `cellKey()` output, or a free label for out-of-grid calls like `doctor`. */
  cell: string;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number | null;
  totalTokens: number;
  latencyMs: number;
  status: number | null;
  retries: number;
  outcome: "ok" | "error" | "truncated";
}

export interface ProviderSpend {
  tokens: number;
  calls: number;
  /** Currently reserved but not yet committed. */
  reserved: number;
}

export interface BudgetVerdict {
  allowed: boolean;
  /** Set when `allowed` is false; the reason a cell records BUDGET_STOP. */
  reason: string | null;
  tokensUsed: number;
  ceiling: number;
}

export class BudgetExceeded extends Error {
  constructor(
    readonly provider: string,
    readonly tokensUsed: number,
    readonly ceiling: number,
    message: string,
  ) {
    super(message);
    this.name = "BudgetExceeded";
  }
}

/** A reservation handle. Exactly one of `commit` / `release` must be called. */
export interface Reservation {
  provider: string;
  amount: number;
  settled: boolean;
}

export class BudgetLedger {
  private spend = new Map<string, ProviderSpend>();

  private constructor(
    private readonly ceilings: Config["budget"]["providers"],
    private readonly path: string | null,
  ) {}

  /**
   * Builds a ledger with no history. Used by tests and by any run that has
   * deliberately discarded its ledger.
   */
  static empty(
    ceilings: Config["budget"]["providers"],
    path: string | null = null,
  ): BudgetLedger {
    return new BudgetLedger(ceilings, path);
  }

  /**
   * Rebuilds spend by replaying the ledger file. A missing file is not an
   * error — it is a first run.
   *
   * A malformed line is skipped rather than fatal, and counted, because the
   * file is append-only and a torn final write is the expected failure mode
   * after a crash. Losing one record understates spend by one call; refusing
   * to start would strand the run entirely.
   */
  static async load(
    ceilings: Config["budget"]["providers"],
    path: string = LEDGER_PATH,
  ): Promise<{ ledger: BudgetLedger; records: number; skipped: number }> {
    const ledger = new BudgetLedger(ceilings, path);
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch {
      return { ledger, records: 0, skipped: 0 };
    }

    let records = 0;
    let skipped = 0;
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      let rec: LedgerRecord;
      try {
        rec = JSON.parse(trimmed) as LedgerRecord;
      } catch {
        skipped++;
        continue;
      }
      if (typeof rec.totalTokens !== "number" || typeof rec.provider !== "string") {
        skipped++;
        continue;
      }
      ledger.bump(rec.provider, rec.totalTokens, 1);
      records++;
    }
    return { ledger, records, skipped };
  }

  private bump(provider: string, tokens: number, calls: number): void {
    const cur = this.spend.get(provider) ?? { tokens: 0, calls: 0, reserved: 0 };
    cur.tokens += tokens;
    cur.calls += calls;
    this.spend.set(provider, cur);
  }

  private get(provider: string): ProviderSpend {
    return this.spend.get(provider) ?? { tokens: 0, calls: 0, reserved: 0 };
  }

  spendOf(provider: string): ProviderSpend {
    const s = this.get(provider);
    return { ...s };
  }

  ceilingOf(provider: string): { maxTokens: number; maxCalls: number } | null {
    return this.ceilings[provider] ?? null;
  }

  /**
   * The pre-flight check. `worstCase` is what the call could cost if the model
   * runs to its token limit — never an average, because a budget that holds
   * only on average is not a budget.
   *
   * A provider with no configured ceiling is refused rather than waved through.
   * An unbudgeted provider is a config mistake, and the failure mode of
   * guessing is an unbounded spend.
   */
  check(provider: string, worstCase: number): BudgetVerdict {
    const ceiling = this.ceilings[provider];
    const s = this.get(provider);
    const committed = s.tokens + s.reserved;

    if (!ceiling) {
      return {
        allowed: false,
        reason: `provider ${provider} has no budget entry; refusing to spend`,
        tokensUsed: committed,
        ceiling: 0,
      };
    }
    if (s.calls + 1 > ceiling.maxCalls) {
      return {
        allowed: false,
        reason: `call ceiling reached for ${provider}: ${s.calls}/${ceiling.maxCalls}`,
        tokensUsed: committed,
        ceiling: ceiling.maxTokens,
      };
    }
    if (committed + worstCase > ceiling.maxTokens) {
      return {
        allowed: false,
        reason:
          `token ceiling would be exceeded for ${provider}: ` +
          `${committed} spent + ${worstCase} worst case > ${ceiling.maxTokens}`,
        tokensUsed: committed,
        ceiling: ceiling.maxTokens,
      };
    }
    return {
      allowed: true,
      reason: null,
      tokensUsed: committed,
      ceiling: ceiling.maxTokens,
    };
  }

  /** Throws `BudgetExceeded` rather than returning a verdict. */
  reserve(provider: string, worstCase: number): Reservation {
    const verdict = this.check(provider, worstCase);
    if (!verdict.allowed) {
      throw new BudgetExceeded(
        provider,
        verdict.tokensUsed,
        verdict.ceiling,
        verdict.reason ?? "budget refused",
      );
    }
    const s = this.get(provider);
    s.reserved += worstCase;
    this.spend.set(provider, s);
    return { provider, amount: worstCase, settled: false };
  }

  /**
   * Replaces a reservation with the measured cost and appends the record.
   *
   * Actual spend routinely *exceeds* the reservation: the reservation covers
   * completion tokens, and the prompt is only counted once the provider reports
   * it. So this commits `usage.total`, not `min(actual, reserved)`.
   */
  async commit(
    r: Reservation,
    rec: Omit<LedgerRecord, "ts" | "totalTokens">,
    usage: Usage,
  ): Promise<LedgerRecord> {
    if (r.settled) throw new Error("reservation already settled");
    r.settled = true;

    const s = this.get(r.provider);
    s.reserved = Math.max(0, s.reserved - r.amount);
    this.spend.set(r.provider, s);

    const total = usage.promptTokens + usage.completionTokens;
    this.bump(r.provider, total, 1);

    const full: LedgerRecord = {
      ts: new Date().toISOString(),
      ...rec,
      totalTokens: total,
    };
    await this.append(full);
    return full;
  }

  /**
   * Drops a reservation for a call that never happened or failed before
   * billing. Counted as a call, because a refused request still consumes rate
   * limit, but costs no tokens.
   */
  async release(
    r: Reservation,
    rec: Omit<LedgerRecord, "ts" | "totalTokens"> | null = null,
  ): Promise<void> {
    if (r.settled) throw new Error("reservation already settled");
    r.settled = true;
    const s = this.get(r.provider);
    s.reserved = Math.max(0, s.reserved - r.amount);
    s.calls += 1;
    this.spend.set(r.provider, s);
    if (rec) await this.append({ ts: new Date().toISOString(), ...rec, totalTokens: 0 });
  }

  private async append(rec: LedgerRecord): Promise<void> {
    if (this.path === null) return;
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(rec)}\n`, "utf8");
  }

  /** Human-readable spend summary, for `doctor` and the sweep footer. */
  summary(): string[] {
    const out: string[] = [];
    for (const [provider, ceiling] of Object.entries(this.ceilings)) {
      const s = this.get(provider);
      const pct = ceiling.maxTokens === 0 ? 0 : (s.tokens / ceiling.maxTokens) * 100;
      out.push(
        `${provider.padEnd(11)} ${s.tokens.toLocaleString()}/${ceiling.maxTokens.toLocaleString()} tokens ` +
          `(${pct.toFixed(2)}%)  ${s.calls}/${ceiling.maxCalls} calls`,
      );
    }
    return out;
  }
}

/**
 * Worst-case cost of a request, in tokens.
 *
 * The prompt term is an estimate and is documented as such: tokenizers
 * disagree by a factor of nearly three on identical input — the same probe
 * prompt billed 63 prompt tokens on `muse_30b` and 23 on `nemotron_ultra`
 * (D17). So this over-estimates deliberately, at ~3 characters per token, and
 * the ledger corrects it with the provider's own count on commit.
 */
export function worstCaseTokens(promptChars: number, maxTokens: number): number {
  return Math.ceil(promptChars / 3) + maxTokens;
}
