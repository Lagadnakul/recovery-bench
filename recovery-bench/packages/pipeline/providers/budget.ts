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
  /**
   * Which env var supplied the key — a NAME, never a value.
   *
   * Names are not secrets: `configs/base.yaml` lists them openly and `doctor`
   * prints them. Omitting them was over-caution, and it made per-key spend
   * invisible, which matters when the keys are separate accounts (D28).
   */
  keyName: string | null;
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
  /** The account the reservation is held against — see `accountOf`. */
  account: string;
  amount: number;
  settled: boolean;
}

export class BudgetLedger {
  /**
   * Spend by account, where an "account" is the provider id when its budget is
   * shared and `provider/KEY_NAME` when `per_key` is set.
   *
   * One map rather than two, so there is exactly one place a ceiling is
   * compared against a total.
   */
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
      ledger.bump(
        ledger.accountOf(rec.provider, rec.keyName ?? null),
        rec.totalTokens,
        1,
      );
      records++;
    }
    return { ledger, records, skipped };
  }

  /**
   * The key a ceiling is enforced against.
   *
   * With `per_key: false` this is just the provider, so behaviour is unchanged.
   * With `per_key: true` each key gets its own account, and a call that does
   * not name a key falls back to the provider bucket rather than being
   * uncounted — an uncounted call is the failure mode this whole file exists to
   * prevent.
   */
  accountOf(provider: string, keyName: string | null): string {
    const ceiling = this.ceilings[provider];
    if (!ceiling?.perKey || keyName === null) return provider;
    return `${provider}/${keyName}`;
  }

  private bump(account: string, tokens: number, calls: number): void {
    const cur = this.spend.get(account) ?? { tokens: 0, calls: 0, reserved: 0 };
    cur.tokens += tokens;
    cur.calls += calls;
    this.spend.set(account, cur);
  }

  private get(provider: string): ProviderSpend {
    return this.spend.get(provider) ?? { tokens: 0, calls: 0, reserved: 0 };
  }

  /**
   * Spend for one account. `keyName` is required when the provider is
   * `per_key`; omitting it reads the shared bucket, which will be empty.
   */
  spendOf(provider: string, keyName: string | null = null): ProviderSpend {
    return { ...this.get(this.accountOf(provider, keyName)) };
  }

  /** Total across every key of a provider — what a report wants to show. */
  spendOfProvider(provider: string): ProviderSpend {
    const total: ProviderSpend = { tokens: 0, calls: 0, reserved: 0 };
    for (const [account, s] of this.spend) {
      if (account === provider || account.startsWith(`${provider}/`)) {
        total.tokens += s.tokens;
        total.calls += s.calls;
        total.reserved += s.reserved;
      }
    }
    return total;
  }

  /** The accounts seen so far for a provider, in name order. */
  accountsOf(provider: string): string[] {
    return [...this.spend.keys()]
      .filter((a) => a === provider || a.startsWith(`${provider}/`))
      .sort();
  }

  ceilingOf(
    provider: string,
  ): { maxTokens: number; maxCalls: number; perKey: boolean } | null {
    return this.ceilings[provider] ?? null;
  }

  /**
   * Total capacity for a provider, given how many keys it actually has set.
   *
   * With `per_key: true` and three keys this is 3 x max_tokens. The multiplier
   * is derived from keys that are present, not from the config's optimism: two
   * keys set means twice the ceiling, not three times.
   */
  capacityOf(provider: string, keysSet: number): { tokens: number; calls: number } {
    const c = this.ceilings[provider];
    if (!c) return { tokens: 0, calls: 0 };
    const n = c.perKey ? Math.max(keysSet, 0) : 1;
    return { tokens: c.maxTokens * n, calls: c.maxCalls * n };
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
  check(
    provider: string,
    worstCase: number,
    keyName: string | null = null,
  ): BudgetVerdict {
    const ceiling = this.ceilings[provider];
    const account = this.accountOf(provider, keyName);
    const s = this.get(account);
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
        reason: `call ceiling reached for ${account}: ${s.calls}/${ceiling.maxCalls}`,
        tokensUsed: committed,
        ceiling: ceiling.maxTokens,
      };
    }
    if (committed + worstCase > ceiling.maxTokens) {
      return {
        allowed: false,
        reason:
          `token ceiling would be exceeded for ${account}: ` +
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
  reserve(
    provider: string,
    worstCase: number,
    keyName: string | null = null,
  ): Reservation {
    const verdict = this.check(provider, worstCase, keyName);
    if (!verdict.allowed) {
      throw new BudgetExceeded(
        provider,
        verdict.tokensUsed,
        verdict.ceiling,
        verdict.reason ?? "budget refused",
      );
    }
    const account = this.accountOf(provider, keyName);
    const s = this.get(account);
    s.reserved += worstCase;
    this.spend.set(account, s);
    return { provider, account, amount: worstCase, settled: false };
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

    const s = this.get(r.account);
    s.reserved = Math.max(0, s.reserved - r.amount);
    this.spend.set(r.account, s);

    const total = usage.promptTokens + usage.completionTokens;
    this.bump(r.account, total, 1);

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
    const s = this.get(r.account);
    s.reserved = Math.max(0, s.reserved - r.amount);
    s.calls += 1;
    this.spend.set(r.account, s);
    if (rec) await this.append({ ts: new Date().toISOString(), ...rec, totalTokens: 0 });
  }

  private async append(rec: LedgerRecord): Promise<void> {
    if (this.path === null) return;
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(rec)}\n`, "utf8");
  }

  /**
   * Human-readable spend summary, for `doctor` and the sweep footer.
   *
   * `keysSet` maps a provider to how many of its keys actually have values, so
   * a per-key provider reports its real capacity rather than a single
   * ceiling. Without it, three separate 8M accounts would print as "8M" and
   * look 178% over when they are comfortably inside.
   */
  summary(keysSet: Record<string, number> = {}): string[] {
    const out: string[] = [];
    for (const [provider, ceiling] of Object.entries(this.ceilings)) {
      const n = ceiling.perKey ? (keysSet[provider] ?? 1) : 1;
      const cap = this.capacityOf(provider, n);
      const total = this.spendOfProvider(provider);
      const pct = cap.tokens === 0 ? 0 : (total.tokens / cap.tokens) * 100;

      out.push(
        `${provider.padEnd(11)} ${total.tokens.toLocaleString()}/${cap.tokens.toLocaleString()} tokens ` +
          `(${pct.toFixed(2)}%)  ${total.calls}/${cap.calls} calls` +
          (ceiling.perKey ? `   [${n} key(s) x ${ceiling.maxTokens.toLocaleString()}]` : ""),
      );

      // Per-key breakdown, so an unevenly spent pool is visible rather than
      // hidden inside a healthy-looking total.
      if (ceiling.perKey) {
        for (const account of this.accountsOf(provider)) {
          if (account === provider) continue;
          const s = this.get(account);
          const kpct = (s.tokens / ceiling.maxTokens) * 100;
          out.push(
            `  ${account.slice(provider.length + 1).padEnd(20)} ` +
              `${s.tokens.toLocaleString()}/${ceiling.maxTokens.toLocaleString()} ` +
              `(${kpct.toFixed(2)}%)  ${s.calls} calls`,
          );
        }
      }
    }
    return out;
  }

  /**
   * Keys whose own ceiling leaves no room for another call of this size.
   *
   * The sweep uses this to exclude a spent key from the pool, so the remaining
   * keys carry on instead of the whole provider stopping at the first
   * exhausted account.
   */
  exhaustedKeys(
    provider: string,
    keyNames: readonly string[],
    worstCase: number,
  ): string[] {
    return keyNames.filter((k) => !this.check(provider, worstCase, k).allowed);
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
