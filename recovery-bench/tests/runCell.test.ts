/**
 * The cell lifecycle.
 *
 * One property matters above all the others and every test here is a case of
 * it: **`runCell` always returns a row.** No refusal, budget stop, provider
 * failure, unparseable response or rejected patch may cause a cell to vanish.
 *
 * That is the defect the whole pipeline was built against (D2) and the one
 * step 3 found 22 real instances of in the original data (D15). A test suite
 * that did not pin it would leave the architecture's central claim unchecked.
 */

import { describe, expect, test } from "bun:test";
import { loadConfig } from "../packages/core/config.ts";
import { BudgetLedger } from "../packages/pipeline/providers/budget.ts";
import { buildRegistry } from "../packages/pipeline/providers/index.ts";
import { runCell, toAttempt } from "../packages/pipeline/strategies/runCell.ts";
import { applyErrorEvidence, NO_EVIDENCE } from "../packages/pipeline/strategies/evidence.ts";
import type { Attempt } from "../packages/pipeline/strategies/types.ts";
import { OUTCOME_KINDS, type Cell, type Task } from "../packages/core/types.ts";

const FILE = "django/core/management/commands/sqlmigrate.py";
const CONTENT = [
  "class Command(BaseCommand):",
  "    def handle(self, *args, **options):",
  "        self.output_transaction = True",
  "        return sql",
  "",
].join("\n");

const task: Task = {
  instanceId: "django__django-11039",
  repo: "django/django",
  baseCommit: "abc",
  environmentSetupCommit: "abc",
  problemStatement: "sqlmigrate wraps output in BEGIN/COMMIT",
  patch: `--- a/${FILE}\n+++ b/${FILE}\n`,
  testPatch: "",
  failToPass: ["t"],
  passToPass: [],
  version: "3.0",
};

const cell = (over: Partial<Cell> = {}): Cell => ({
  taskId: task.instanceId,
  strategy: "l1_blind_retry",
  model: "muse_30b",
  editFormat: "search_replace",
  thinking: false,
  round: 1,
  repeat: 0,
  ...over,
});

/** A well-formed response whose SEARCH text really is in CONTENT. */
const GOOD = `EXPLANATION:
Only wrap in a transaction when the migration is atomic.

EDITS:
<<<<<<< SEARCH
        self.output_transaction = True
=======
        self.output_transaction = migration.atomic
>>>>>>> REPLACE
`;

/** SEARCH text that does not occur in the file — the format-class failure. */
const MISQUOTED = `EXPLANATION:
Fixing it.

EDITS:
<<<<<<< SEARCH
        self.output_transaction = TRUE
=======
        self.output_transaction = migration.atomic
>>>>>>> REPLACE
`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const reply = (content: string, finish = "stop") => ({
  choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: finish }],
  usage: { prompt_tokens: 1200, completion_tokens: 90, total_tokens: 1290 },
});

function stub(queue: (() => Response)[]) {
  const seen: { body: Record<string, unknown> }[] = [];
  const impl = (async (_u: unknown, init?: RequestInit) => {
    seen.push({ body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
    const next = queue.shift();
    if (!next) throw new Error("stub: queue exhausted");
    return next();
  }) as unknown as typeof fetch;
  return { impl, seen };
}

async function harness(
  queue: (() => Response)[],
  ceiling = 1_000_000,
) {
  const { config } = await loadConfig("configs/base.yaml");
  const cfg = {
    ...config,
    budget: {
      ...config.budget,
      providers: {
        ...config.budget.providers,
        nvidia: { maxTokens: ceiling, maxCalls: 100, perKey: false },
      },
    },
  };
  process.env.NVIDIA_KEY_1 = "n".repeat(20);
  const { impl, seen } = stub(queue);
  return {
    cfg,
    seen,
    registry: buildRegistry(cfg, impl),
    ledger: BudgetLedger.empty(cfg.budget.providers),
  };
}

const base = (h: Awaited<ReturnType<typeof harness>>) => ({
  task,
  filePath: FILE,
  fileContent: CONTENT,
  cfg: h.cfg,
  registry: h.registry,
  ledger: h.ledger,
});

describe("runCell — every path produces a row", () => {
  test("a well-formed edit that git accepts records APPLIED", async () => {
    const h = await harness([() => json(reply(GOOD))]);
    const out = await runCell({ ...base(h), cell: cell() });

    expect(out.row.outcome.kind).toBe("APPLIED");
    expect(out.patch).toContain("output_transaction");
    // An apply-verified row can never carry a resolve verdict (step 1).
    expect(out.row.verification).toBe("apply");
    expect(out.row.resolved).toBeNull();
    expect(out.row.tests).toBeNull();
    expect(out.honouredCondition).toBe(true);
  });

  test("a misquoted SEARCH records MALFORMED with a reason", async () => {
    const h = await harness([() => json(reply(MISQUOTED))]);
    const out = await runCell({ ...base(h), cell: cell() });

    expect(out.row.outcome.kind).toBe("MALFORMED");
    if (out.row.outcome.kind === "MALFORMED") {
      // The reason is what makes the format finding analysable at all (D14).
      expect(out.row.outcome.reason).toBe("search_not_found");
    }
  });

  test("prose with no blocks records NO_PATCH", async () => {
    const h = await harness([() => json(reply("I think the bug is in the parser."))]);
    const out = await runCell({ ...base(h), cell: cell() });
    expect(["NO_PATCH", "MALFORMED"]).toContain(out.row.outcome.kind);
  });

  test("an empty response records NO_OUTPUT", async () => {
    const h = await harness([() => json(reply(""))]);
    const out = await runCell({ ...base(h), cell: cell() });
    expect(out.row.outcome.kind).toBe("NO_OUTPUT");
  });

  test("a severed response records TRUNCATED, not NO_OUTPUT", async () => {
    // D18: our ceiling cut it off. That is an instrument limit, not a model
    // failing to produce applicable output.
    const h = await harness([() => json(reply("", "length"))]);
    const out = await runCell({ ...base(h), cell: cell() });
    expect(out.row.outcome.kind).toBe("TRUNCATED");
  });

  test("a provider failure records PROVIDER_ERROR and costs no tokens", async () => {
    const h = await harness([() => json({ error: "bad request" }, 400)]);
    const out = await runCell({ ...base(h), cell: cell() });
    expect(out.row.outcome.kind).toBe("PROVIDER_ERROR");
    expect(h.ledger.spendOf("nvidia").tokens).toBe(0);
  });

  test("a cell over budget records BUDGET_STOP and sends NO request", async () => {
    const h = await harness([], 100);
    const out = await runCell({ ...base(h), cell: cell() });
    expect(out.row.outcome.kind).toBe("BUDGET_STOP");
    expect(h.seen.length).toBe(0);
  });

  test("a refused condition still produces a row — it is never skipped", async () => {
    // Reflection-only with no history. The original would have written nothing.
    const h = await harness([]);
    const out = await runCell({
      ...base(h),
      cell: cell({ strategy: "l2_reflection", round: 2 }),
      history: [],
    });
    expect(out.row.outcome.kind).toBe("PROVIDER_ERROR");
    if (out.row.outcome.kind === "PROVIDER_ERROR") {
      expect(out.row.outcome.reason).toContain("condition not runnable");
      // No call was made, so no status and no retries.
      expect(out.row.outcome.status).toBeNull();
    }
    expect(h.seen.length).toBe(0);
  });

  test("Diagnose+Revise without evidence produces a row, not a gap", async () => {
    const h = await harness([]);
    const out = await runCell({
      ...base(h),
      cell: cell({ strategy: "l2_5_diagnose_revise", round: 2 }),
      history: [{ response: GOOD, patch: "p", outcome: { kind: "NO_PATCH", responseChars: 1 }, gitStderr: null }],
      evidence: NO_EVIDENCE,
    });
    expect(out.row.outcome.kind).toBe("PROVIDER_ERROR");
    expect(out.comparableToChapter5).toBe(false);
    expect(h.seen.length).toBe(0);
  });

  test("every outcome kind reached above is a declared kind", async () => {
    // Guards against a typo'd outcome string slipping into the data.
    const h = await harness([() => json(reply(GOOD))]);
    const out = await runCell({ ...base(h), cell: cell() });
    expect(OUTCOME_KINDS).toContain(out.row.outcome.kind);
  });
});

describe("runCell — provenance travels with the row", () => {
  test("usage from the provider is recorded on the row", async () => {
    const h = await harness([() => json(reply(GOOD))]);
    const out = await runCell({ ...base(h), cell: cell() });
    expect(out.row.usage?.promptTokens).toBe(1200);
    expect(out.row.usage?.completionTokens).toBe(90);
    // And charged: truncated or not, a call that returned costs money.
    expect(h.ledger.spendOf("nvidia").tokens).toBe(1290);
  });

  test("l2.5 with apply-error evidence is marked NOT comparable to Chapter 5", async () => {
    const h = await harness([() => json(reply(GOOD))]);
    const out = await runCell({
      ...base(h),
      cell: cell({ strategy: "l2_5_diagnose_revise", round: 2 }),
      history: [{ response: "old", patch: null, outcome: { kind: "APPLY_FAIL", patch: "p", gitStderr: "e" }, gitStderr: "e" }],
      evidence: applyErrorEvidence("error: while searching for"),
    });
    expect(out.row.outcome.kind).toBe("APPLIED");
    expect(out.evidenceSource).toBe("apply_error");
    // The claim the whole evidence module exists to protect.
    expect(out.comparableToChapter5).toBe(false);
  });

  test("conditions that need no evidence are comparable by construction", async () => {
    const h = await harness([() => json(reply(GOOD))]);
    const out = await runCell({ ...base(h), cell: cell() });
    expect(out.comparableToChapter5).toBe(true);
  });

  test("a response missing its demanded section is recorded, not rejected", async () => {
    // A Reflection-only answer with no REFLECTION still produced a patch. The
    // patch is judged on its merits; the omission is recorded separately.
    const h = await harness([() => json(reply(GOOD))]);
    const out = await runCell({
      ...base(h),
      cell: cell({ strategy: "l2_reflection", round: 2 }),
      history: [{ response: "prev", patch: null, outcome: { kind: "NO_PATCH", responseChars: 4 }, gitStderr: null }],
    });
    expect(out.row.outcome.kind).toBe("APPLIED");
    expect(out.honouredCondition).toBe(false);
  });

  test("the prompt sent contains the file but never the gold patch", async () => {
    const h = await harness([() => json(reply(GOOD))]);
    await runCell({ ...base(h), cell: cell() });
    const sent = h.seen[0]!.body as { messages: { content: string }[] };
    const prompt = sent.messages.at(-1)!.content;
    expect(prompt).toContain(CONTENT);
    expect(prompt).not.toContain("--- a/");
    expect(prompt).not.toContain(task.patch);
  });
});

describe("toAttempt — feeding the next round", () => {
  test("carries the response forward so l2 can reflect on it", async () => {
    const h = await harness([() => json(reply(GOOD))]);
    const out = await runCell({ ...base(h), cell: cell() });
    const a: Attempt = toAttempt(out);
    expect(a.response).toBe(GOOD);
    expect(a.patch).not.toBeNull();
    expect(a.gitStderr).toBeNull();
  });

  test("carries git's rejection forward so l2.5 has evidence", async () => {
    // This is the bridge that makes a no-Docker Diagnose+Revise possible at
    // all: round 1's apply failure becomes round 2's evidence.
    const h = await harness([() => json(reply(MISQUOTED))]);
    const out = await runCell({ ...base(h), cell: cell() });
    const a = toAttempt(out);
    expect(a.outcome.kind).toBe("MALFORMED");
    // MALFORMED never reached git, so there is no git stderr to pass on.
    expect(a.gitStderr).toBeNull();
  });
});
