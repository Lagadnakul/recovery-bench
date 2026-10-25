/**
 * Resume must rebuild a lineage's history, not just skip its cells.
 *
 * The defect this pins, found 25 Oct 2026: `runLineage` skipped an
 * already-completed cell with a bare `continue`, never feeding that cell's
 * attempt forward. `history` is seeded with the round-0 baseline, so the
 * symptom is NOT a refusal — the condition still runs. It is quieter and
 * worse: the cell reflects on the **baseline** instead of on the round
 * immediately before it. A resumed round 4 of `a2` would have been a round-1
 * cell wearing a round-4 label, and `a2`/`a3`/`a4` use `rounds: 4` precisely
 * because Phase 2 proved LOST is unreachable below K=4. Depth was the thing
 * it silently destroyed.
 *
 * Testing that needs responses that can be told apart. An earlier version of
 * this file gave every call the same body, so a prompt quoting the baseline
 * looked identical to one quoting round 1, and the test passed with the fix
 * reverted — it asserted nothing. Each call here carries a unique marker.
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, type Config } from "../packages/core/config.ts";
import { loadDataset } from "../packages/pipeline/tasks/dataset.ts";
import { sweep } from "../packages/pipeline/matrix/sweep.ts";
import { readRows } from "../packages/pipeline/matrix/store.ts";

const { config: baseCfg } = await loadConfig("configs/base.yaml");
const { tasks } = await loadDataset(baseCfg);

const ARM = "a1_replication";

/** `a1` runs rounds 1 and 2, so round 2's correct prior is round 1. */
const LATER_ROUND = "|r2|";
const EARLIER_ROUND = "|r1|";

function body(marker: string) {
  return `REFLECTION:
${marker} — my previous patch changed the wrong branch.

DIAGNOSIS:
The guard was inverted.

EXPLANATION:
Invert the condition.

EDITS:
<<<<<<< SEARCH
THIS_TEXT_IS_NOT_IN_ANY_FILE = True
=======
THIS_TEXT_IS_NOT_IN_ANY_FILE = False
>>>>>>> REPLACE
`;
}

function geminiReply(text: string) {
  return {
    candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
    usageMetadata: {
      promptTokenCount: 1200,
      candidatesTokenCount: 300,
      totalTokenCount: 1500,
    },
  };
}

/**
 * Every call gets a distinct marker, and every prompt is captured. Without
 * distinct markers this whole file is vacuous.
 */
function recordingStub(tag: string) {
  const prompts: string[] = [];
  let n = 0;
  const impl = (async (_url: string, init?: RequestInit) => {
    prompts.push(typeof init?.body === "string" ? init.body : "");
    n++;
    return new Response(JSON.stringify(geminiReply(body(`${tag}-CALL-${n}`))), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, prompts };
}

async function harness() {
  const dir = await mkdtemp(join(tmpdir(), "rb-resume-"));
  process.env.gemini_api_key = "g".repeat(20);
  const cfg: Config = {
    ...baseCfg,
    budget: {
      ...baseCfg.budget,
      providers: {
        ...baseCfg.budget.providers,
        gemini: { maxTokens: 10_000_000, maxCalls: 10_000, perKey: false },
      },
    },
    run: {
      ...baseCfg.run,
      concurrency: { ...baseCfg.run.concurrency, gemini: 1 },
    },
  };
  return {
    cfg,
    rowsPath: join(dir, "rows.jsonl"),
    ledgerPath: join(dir, "ledger.jsonl"),
  };
}

/** Rewrites the rows file to keep only the given keys. */
async function keepOnly(path: string, keys: Set<string>) {
  const text = await readFile(path, "utf8");
  const lines = text
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .filter((l) => keys.has((JSON.parse(l) as { key: string }).key));
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");
}

describe("sweep resume — a skipped cell still feeds its attempt forward", () => {
  test("a resumed round reflects on the round before it, not on the baseline", async () => {
    const h = await harness();

    // 1. A complete run. Each call's response carries its own marker.
    const first = recordingStub("RUN1");
    await sweep({
      cfg: h.cfg,
      tasks,
      arms: [ARM],
      rowsPath: h.rowsPath,
      ledgerPath: h.ledgerPath,
      fetchImpl: first.impl,
      verifyApply: false,
    });

    const { records: all } = await readRows(h.rowsPath);

    // Pick one reflection lineage and name its two rounds explicitly.
    const laterKey = all.find(
      (r) => r.key.includes(LATER_ROUND) && r.key.includes("|l2_reflection|"),
    )?.key;
    expect(laterKey).toBeDefined();
    const earlierKey = laterKey!.replace(LATER_ROUND, EARLIER_ROUND);
    const earlier = all.find((r) => r.key === earlierKey);
    expect(earlier).toBeDefined();

    // The marker the earlier round actually produced. This is what the later
    // round's prompt must quote.
    const earlierMarker = /RUN1-CALL-\d+/.exec(earlier!.response ?? "")?.[0];
    expect(earlierMarker).toBeDefined();

    // 2. Drop every later-round row — the shape an interruption leaves.
    const kept = all.filter((r) => !r.key.includes(LATER_ROUND));
    await keepOnly(h.rowsPath, new Set(kept.map((r) => r.key)));

    // 3. Resume, with a different tag so run 1's and run 2's bodies cannot be
    //    confused for one another.
    const second = recordingStub("RUN2");
    const res = await sweep({
      cfg: h.cfg,
      tasks,
      arms: [ARM],
      rowsPath: h.rowsPath,
      ledgerPath: h.ledgerPath,
      fetchImpl: second.impl,
      verifyApply: false,
    });
    expect(res.skippedResumed).toBe(kept.length);

    // The claim: some resumed prompt quotes the EARLIER ROUND's response.
    //
    // With the fix reverted this fails, because `history` holds only the
    // round-0 baseline and the prompt quotes that instead — the cell runs, and
    // measures the wrong thing.
    const quotingEarlier = second.prompts.filter((p) =>
      p.includes(earlierMarker!),
    );
    expect(quotingEarlier.length).toBeGreaterThan(0);
  });

  test("the resumed prompt does not silently substitute the baseline", async () => {
    // The inverse of the above, stated directly: the baseline's marker must
    // not be the ONLY prior a resumed later round can see. Asserting both
    // directions is what stops a future change from satisfying one by
    // breaking the other.
    const h = await harness();

    const first = recordingStub("RUN1");
    await sweep({
      cfg: h.cfg,
      tasks,
      arms: [ARM],
      rowsPath: h.rowsPath,
      ledgerPath: h.ledgerPath,
      fetchImpl: first.impl,
      verifyApply: false,
    });

    const { records: all } = await readRows(h.rowsPath);
    const laterKey = all.find(
      (r) => r.key.includes(LATER_ROUND) && r.key.includes("|l2_reflection|"),
    )!.key;
    const earlierKey = laterKey.replace(LATER_ROUND, EARLIER_ROUND);
    const earlierMarker = /RUN1-CALL-\d+/.exec(
      all.find((r) => r.key === earlierKey)!.response ?? "",
    )![0];

    await keepOnly(
      h.rowsPath,
      new Set(all.filter((r) => !r.key.includes(LATER_ROUND)).map((r) => r.key)),
    );

    const second = recordingStub("RUN2");
    await sweep({
      cfg: h.cfg,
      tasks,
      arms: [ARM],
      rowsPath: h.rowsPath,
      ledgerPath: h.ledgerPath,
      fetchImpl: second.impl,
      verifyApply: false,
    });

    // Every prompt that mentions a RUN1 marker at all must include the
    // earlier round's, not merely some older attempt's.
    const withAnyPrior = second.prompts.filter((p) => /RUN1-CALL-\d+/.test(p));
    expect(withAnyPrior.length).toBeGreaterThan(0);
    expect(withAnyPrior.some((p) => p.includes(earlierMarker))).toBe(true);
  });
});
