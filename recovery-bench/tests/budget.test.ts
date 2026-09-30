/**
 * The ceiling must refuse to spend. Everything else in step 4 is plumbing.
 *
 * The original's ceiling was the string `"8_000_000"` and every comparison
 * against it was vacuous (D3). These tests exist so that cannot recur quietly:
 * each one fails if the ledger lets a call through that it should have stopped.
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BudgetExceeded,
  BudgetLedger,
  worstCaseTokens,
  type LedgerRecord,
} from "../packages/pipeline/providers/budget.ts";
import type { Usage } from "../packages/core/types.ts";

const CEILINGS = {
  nvidia: { maxTokens: 1_000, maxCalls: 5 },
  qwencloud: { maxTokens: 500, maxCalls: 2 },
};

const usage = (p: number, c: number): Usage => ({
  promptTokens: p,
  completionTokens: c,
  reasoningTokens: null,
  latencyMs: 1,
});

const rec = (provider: string): Omit<LedgerRecord, "ts" | "totalTokens"> => ({
  provider,
  model: "test/model",
  cell: "t|s|m|f|nothink|r0|n0",
  promptTokens: 0,
  completionTokens: 0,
  reasoningTokens: null,
  latencyMs: 1,
  status: 200,
  retries: 0,
  outcome: "ok",
});

describe("budget — the pre-flight refusal", () => {
  test("allows a call that fits", () => {
    const l = BudgetLedger.empty(CEILINGS);
    expect(l.check("nvidia", 900).allowed).toBe(true);
  });

  test("refuses a call whose worst case would exceed the ceiling", () => {
    const l = BudgetLedger.empty(CEILINGS);
    const v = l.check("nvidia", 1_001);
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("token ceiling would be exceeded");
  });

  test("the boundary is inclusive — exactly the ceiling is allowed", () => {
    const l = BudgetLedger.empty(CEILINGS);
    expect(l.check("nvidia", 1_000).allowed).toBe(true);
    expect(l.check("nvidia", 1_001).allowed).toBe(false);
  });

  test("judges the WORST case, not the average", () => {
    // A call that will probably cost 10 tokens but could cost 900 is refused
    // when only 500 remain. A budget that holds only on average is not one.
    const l = BudgetLedger.empty(CEILINGS);
    const r = l.reserve("nvidia", 600);
    expect(l.check("nvidia", 900).allowed).toBe(false);
    expect(r.settled).toBe(false);
  });

  test("an unbudgeted provider is refused, not waved through", () => {
    const l = BudgetLedger.empty(CEILINGS);
    const v = l.check("openai", 1);
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("no budget entry");
  });

  test("the call ceiling bites independently of the token ceiling", async () => {
    const l = BudgetLedger.empty(CEILINGS);
    for (let i = 0; i < 2; i++) {
      const r = l.reserve("qwencloud", 1);
      await l.commit(r, rec("qwencloud"), usage(1, 0));
    }
    const v = l.check("qwencloud", 1);
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("call ceiling reached");
  });

  test("reserve throws BudgetExceeded carrying the numbers a BUDGET_STOP needs", () => {
    const l = BudgetLedger.empty(CEILINGS);
    try {
      l.reserve("nvidia", 5_000);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(BudgetExceeded);
      const b = e as BudgetExceeded;
      expect(b.ceiling).toBe(1_000);
      expect(b.tokensUsed).toBe(0);
    }
  });
});

describe("budget — reserve and commit", () => {
  test("reservations accumulate, so concurrent cells cannot both fit", () => {
    const l = BudgetLedger.empty(CEILINGS);
    l.reserve("nvidia", 600);
    // Without reservation accounting this second cell would also see room.
    expect(l.check("nvidia", 600).allowed).toBe(false);
    expect(l.spendOf("nvidia").reserved).toBe(600);
  });

  test("commit replaces the reservation with the measured cost", async () => {
    const l = BudgetLedger.empty(CEILINGS);
    const r = l.reserve("nvidia", 800);
    await l.commit(r, rec("nvidia"), usage(20, 30));
    const s = l.spendOf("nvidia");
    expect(s.reserved).toBe(0);
    expect(s.tokens).toBe(50);
    expect(s.calls).toBe(1);
    // The 800 reservation is gone, so a second call now fits.
    expect(l.check("nvidia", 900).allowed).toBe(true);
  });

  test("commit charges actual spend even when it exceeds the reservation", async () => {
    // Reservations cover completion tokens; the prompt is only counted once
    // the provider reports it, so actual > reserved is normal.
    const l = BudgetLedger.empty(CEILINGS);
    const r = l.reserve("nvidia", 10);
    await l.commit(r, rec("nvidia"), usage(200, 100));
    expect(l.spendOf("nvidia").tokens).toBe(300);
  });

  test("release frees the reservation but still counts the call", async () => {
    const l = BudgetLedger.empty(CEILINGS);
    const r = l.reserve("nvidia", 900);
    await l.release(r);
    const s = l.spendOf("nvidia");
    expect(s.reserved).toBe(0);
    expect(s.tokens).toBe(0);
    // A refused request consumes rate limit even though it cost no tokens.
    expect(s.calls).toBe(1);
  });

  test("a reservation cannot be settled twice", async () => {
    const l = BudgetLedger.empty(CEILINGS);
    const r = l.reserve("nvidia", 10);
    await l.commit(r, rec("nvidia"), usage(1, 1));
    await expect(l.commit(r, rec("nvidia"), usage(1, 1))).rejects.toThrow(
      "already settled",
    );
  });
});

describe("budget — persistence and resume", () => {
  test("a missing ledger file is a first run, not an error", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-ledger-"));
    const { ledger, records, skipped } = await BudgetLedger.load(
      CEILINGS,
      join(dir, "absent.jsonl"),
    );
    expect(records).toBe(0);
    expect(skipped).toBe(0);
    expect(ledger.spendOf("nvidia").tokens).toBe(0);
  });

  test("resuming does NOT restart the budget at zero", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-ledger-"));
    const path = join(dir, "ledger.jsonl");

    const first = BudgetLedger.empty(CEILINGS, path);
    const r = first.reserve("nvidia", 500);
    await first.commit(r, rec("nvidia"), usage(300, 400));
    expect(first.spendOf("nvidia").tokens).toBe(700);

    // This is the defect being guarded: a resumed run that forgets its spend
    // would happily spend the ceiling a second time.
    const { ledger: resumed, records } = await BudgetLedger.load(CEILINGS, path);
    expect(records).toBe(1);
    expect(resumed.spendOf("nvidia").tokens).toBe(700);
    expect(resumed.check("nvidia", 400).allowed).toBe(false);
  });

  test("a torn final line is skipped, not fatal", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-ledger-"));
    const path = join(dir, "ledger.jsonl");
    const good = JSON.stringify({ ...rec("nvidia"), ts: "t", totalTokens: 100 });
    // Append-only files lose their tail on a crash; refusing to start would
    // strand the run for the sake of one lost record.
    await writeFile(path, `${good}\n{"provider":"nvi`, "utf8");
    const { ledger, records, skipped } = await BudgetLedger.load(CEILINGS, path);
    expect(records).toBe(1);
    expect(skipped).toBe(1);
    expect(ledger.spendOf("nvidia").tokens).toBe(100);
  });

  test("the ledger records counts and never prompt or completion text", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rb-ledger-"));
    const path = join(dir, "ledger.jsonl");
    const l = BudgetLedger.empty(CEILINGS, path);
    const r = l.reserve("nvidia", 10);
    await l.commit(r, rec("nvidia"), usage(5, 6));

    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw.trim()) as LedgerRecord;
    expect(parsed.totalTokens).toBe(11);
    expect(Object.keys(parsed).sort()).toEqual(
      [
        "cell",
        "completionTokens",
        "latencyMs",
        "model",
        "outcome",
        "promptTokens",
        "provider",
        "reasoningTokens",
        "retries",
        "status",
        "totalTokens",
        "ts",
      ].sort(),
    );
    // No field carries text that could be a secret or task content.
    expect(raw).not.toContain("prompt:");
    expect(raw).not.toContain("content");
  });
});

describe("worstCaseTokens", () => {
  test("over-estimates the prompt deliberately", () => {
    // Tokenizers disagree by ~3x on identical input (D17): the same probe
    // prompt billed 63 tokens on muse_30b and 23 on nemotron_ultra. A low
    // estimate would let a run slip past its ceiling.
    expect(worstCaseTokens(300, 1_000)).toBe(1_100);
  });

  test("is dominated by max_tokens, which is the part we control", () => {
    expect(worstCaseTokens(0, 8_192)).toBe(8_192);
  });
});
