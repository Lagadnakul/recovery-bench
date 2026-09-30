/**
 * The four conditions, their response parsing, and the evidence rule.
 *
 * The evidence tests are the important ones. Diagnose+Revise is defined by
 * receiving real test output, this pipeline cannot run tests (D6), and the
 * tempting shortcut — quietly substituting git's apply error and still calling
 * it Diagnose+Revise — would make the study's manipulated variable mean two
 * different things depending on the task. These tests exist to make that
 * shortcut fail.
 */

import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyErrorEvidence,
  archivedEvidence,
  resolveEvidence,
  truncate,
  EVIDENCE_MAX,
  NO_EVIDENCE,
  TRIM_PREFIX,
} from "../packages/pipeline/strategies/evidence.ts";
import {
  editText,
  honouredCondition,
  parseResponse,
} from "../packages/pipeline/strategies/parse.ts";
import {
  STRATEGIES,
  getStrategy,
} from "../packages/pipeline/strategies/conditions.ts";
import type { Attempt, StrategyContext } from "../packages/pipeline/strategies/types.ts";
import type { Cell, Task } from "../packages/core/types.ts";

// ───────────────────────────────────────────────────────────── fixtures
const task: Task = {
  instanceId: "django__django-11039",
  repo: "django/django",
  baseCommit: "abc",
  environmentSetupCommit: "abc",
  problemStatement: "sqlmigrate wraps output in BEGIN/COMMIT",
  patch: "--- a/django/core/management/commands/sqlmigrate.py\n+++ b/x\n",
  testPatch: "",
  failToPass: ["t"],
  passToPass: [],
  version: "3.0",
};

const cell = (strategy: string, round = 1): Cell => ({
  taskId: task.instanceId,
  strategy: strategy as Cell["strategy"],
  model: "muse_30b",
  editFormat: "search_replace",
  thinking: false,
  round,
  repeat: 0,
});

const attempt = (over: Partial<Attempt> = {}): Attempt => ({
  response: "EXPLANATION:\nI tried X.\n\nEDITS:\n<<<<<<< SEARCH\na\n=======\nb\n>>>>>>> REPLACE\n",
  patch: "--- a/f.py\n",
  outcome: { kind: "APPLY_FAIL", patch: "p", gitStderr: "error: patch failed" },
  gitStderr: "error: patch failed",
  ...over,
});

const ctx = (over: Partial<StrategyContext> = {}): StrategyContext => ({
  cell: cell("l1_blind_retry"),
  task,
  filePath: "django/core/management/commands/sqlmigrate.py",
  fileContent: "class Command:\n    pass\n",
  history: [],
  evidence: NO_EVIDENCE,
  ...over,
});

// ───────────────────────────────────────────────────── response parsing
describe("response parsing", () => {
  test("splits all four sections", () => {
    const r = parseResponse(
      "REFLECTION:\nI misread the flag.\n\nEXPLANATION:\nGuard on output.\n\nEDITS:\n<<<<<<< SEARCH\na\n=======\nb\n>>>>>>> REPLACE\n",
    );
    expect(r.reflection).toBe("I misread the flag.");
    expect(r.explanation).toBe("Guard on output.");
    expect(r.edits).toContain("<<<<<<< SEARCH");
    expect(r.found).toEqual(["REFLECTION", "EXPLANATION", "EDITS"]);
  });

  test("DIAGNOSIS is read for l2.5", () => {
    const r = parseResponse("DIAGNOSIS:\nThe root cause is X.\n\nEDITS:\nblocks\n");
    expect(r.diagnosis).toBe("The root cause is X.");
    expect(r.reflection).toBeNull();
  });

  test("everything after EDITS: is edit body, headers included", () => {
    // A patch may legitimately contain the word EXPLANATION: in a docstring.
    // Scanning the whole response for headers would truncate it.
    const r = parseResponse(
      'EDITS:\n<<<<<<< SEARCH\n"""EXPLANATION: see docs"""\n=======\n"""ok"""\n>>>>>>> REPLACE\n',
    );
    expect(r.edits).toContain('"""EXPLANATION: see docs"""');
    expect(r.explanation).toBeNull();
  });

  test("a ======= inside a REPLACE body survives parsing", () => {
    // The defect recorded against the original applier.
    const r = parseResponse(
      "EDITS:\n<<<<<<< SEARCH\nold\n=======\nheader\n=======\nnew\n>>>>>>> REPLACE\n",
    );
    expect(r.edits).toContain("header\n=======\nnew");
  });

  test("an indented EDITS: is code, not a header", () => {
    const r = parseResponse("EXPLANATION:\nx\n\n    EDITS:\nnot a header\n");
    expect(r.missingEditsHeader).toBe(true);
  });

  test("a missing EDITS: header still hands the whole response to the edit layer", () => {
    // The blocks are often present without the header. Recording NO_PATCH for
    // that would misattribute a formatting slip as a failure to propose an edit.
    const raw = "<<<<<<< SEARCH\na\n=======\nb\n>>>>>>> REPLACE\n";
    const r = parseResponse(raw);
    expect(r.missingEditsHeader).toBe(true);
    expect(editText(r, raw)).toBe(raw);
  });

  test("CRLF responses parse identically", () => {
    const r = parseResponse("REFLECTION:\r\nwrapped\r\n\r\nEDITS:\r\nblocks\r\n");
    expect(r.reflection).toBe("wrapped");
    expect(r.edits).toContain("blocks");
  });

  test("honouredCondition records whether the demanded section exists", () => {
    const withRefl = parseResponse("REFLECTION:\nx\n\nEDITS:\ny\n");
    const without = parseResponse("EXPLANATION:\nx\n\nEDITS:\ny\n");

    // A Reflection-only cell with no REFLECTION did not run the condition it
    // claims to — and the original code could not tell.
    expect(honouredCondition(withRefl, "l2_reflection")).toBe(true);
    expect(honouredCondition(without, "l2_reflection")).toBe(false);

    // Blind Retry asks for no reasoning section, so it always honours.
    expect(honouredCondition(without, "l1_blind_retry")).toBe(true);

    expect(
      honouredCondition(parseResponse("DIAGNOSIS:\nz\n\nEDITS:\ny\n"), "l2_5_diagnose_revise"),
    ).toBe(true);
    expect(honouredCondition(withRefl, "l2_5_diagnose_revise")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────── evidence
describe("evidence provenance — the L2.5 honesty rule", () => {
  test("an apply error is real evidence but NOT comparable to Chapter 5", () => {
    const e = applyErrorEvidence("error: corrupt patch at line 4");
    expect(e.source).toBe("apply_error");
    expect(e.text).toContain("error: corrupt patch at line 4");
    // The load-bearing assertion of the whole module.
    expect(e.comparableToChapter5).toBe(false);
  });

  test("archived test output IS comparable to Chapter 5", async () => {
    const root = await mkdtemp(join(tmpdir(), "rb-ev-"));
    const dir = join(root, "day11b_tes", "cond", task.instanceId);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "run_instance.log"),
      "FAILED tests/test_sqlmigrate.py::test_transaction - AssertionError\n",
      "utf8",
    );
    const e = await archivedEvidence("day11b_tes", "cond", task.instanceId, root);
    expect(e).not.toBeNull();
    expect(e!.source).toBe("archived_test");
    expect(e!.comparableToChapter5).toBe(true);
    expect(e!.text).toContain("REAL TEST OUTPUT");
  });

  test("an archived APPLY FAILURE is labelled apply_error, not archived_test", async () => {
    // Being in the archive does not make it test output. This is the exact
    // conflation that would inflate the comparable-cell count.
    const root = await mkdtemp(join(tmpdir(), "rb-ev-"));
    const dir = join(root, "run", "cond", task.instanceId);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "run_instance.log"),
      "setup ok\n>>>>> Patch Apply Failed\npatch: **** Only garbage was found\n",
      "utf8",
    );
    const e = await archivedEvidence("run", "cond", task.instanceId, root);
    expect(e!.source).toBe("apply_error");
    expect(e!.comparableToChapter5).toBe(false);
    expect(e!.text).toContain("REAL PATCH-APPLY ERROR");
  });

  test("no log and no apply error yields none, never a fabrication", async () => {
    const e = await resolveEvidence({ instanceId: "absent" });
    expect(e.source).toBe("none");
    expect(e.text).toBe("");
  });

  test("truncation preserves the original's 3000-char tail and prefix", () => {
    const long = "x".repeat(EVIDENCE_MAX + 500);
    const t = truncate(long);
    expect(t.startsWith(TRIM_PREFIX)).toBe(true);
    expect(t.length).toBe(TRIM_PREFIX.length + EVIDENCE_MAX);
    // The tail is kept, not the head: the failure is at the end of a log.
    expect(t.endsWith("x".repeat(10))).toBe(true);
  });

  test("short evidence is passed through untouched", () => {
    expect(truncate("brief")).toBe("brief");
  });
});

// ─────────────────────────────────────────────────────────── conditions
describe("the four conditions", () => {
  test("all four are registered, and L3/L4 are not", () => {
    expect(Object.keys(STRATEGIES).sort()).toEqual([
      "l0_baseline",
      "l1_blind_retry",
      // "l2_5" sorts before "l2_r": '5' < 'r'.
      "l2_5_diagnose_revise",
      "l2_reflection",
    ]);
    expect(() => getStrategy("l3_constrained")).toThrow(/step 8/);
  });

  test("Baseline is replay-only and says why", async () => {
    const plan = await STRATEGIES.l0_baseline.plan(ctx());
    expect(plan.runnable).toBe(false);
    if (!plan.runnable) expect(plan.reason).toContain("replay-only");
  });

  test("Blind Retry runs with no history — it is shown nothing new", async () => {
    const plan = await STRATEGIES.l1_blind_retry.plan(ctx({ history: [] }));
    expect(plan.runnable).toBe(true);
    if (plan.runnable) {
      // "Blind" means the previous attempt is absent from the prompt entirely.
      expect(plan.prompt).not.toContain("PREVIOUS ATTEMPT");
      expect(plan.prompt).toContain(task.problemStatement);
    }
  });

  test("Reflection-only refuses without a previous attempt", async () => {
    // Its prompt asserts the previous attempt failed. Running L1's prompt and
    // labelling it L2 would collapse the two conditions being compared.
    const plan = await STRATEGIES.l2_reflection.plan(ctx({ history: [] }));
    expect(plan.runnable).toBe(false);
    if (!plan.runnable) expect(plan.reason).toContain("needs a previous attempt");
  });

  test("Reflection-only shows the previous attempt but no evidence", async () => {
    const a = attempt();
    const plan = await STRATEGIES.l2_reflection.plan(ctx({ history: [a] }));
    expect(plan.runnable).toBe(true);
    if (plan.runnable) {
      expect(plan.prompt).toContain(a.response);
      expect(plan.prompt).toContain("PREVIOUS ATTEMPT");
      // The single difference from l2.5.
      expect(plan.prompt).not.toContain("REAL, ACTUAL result");
    }
  });

  test("Diagnose+Revise REFUSES when evidence is none", async () => {
    // The central rule. Without this the condition silently degrades into
    // Reflection-only while still being reported as Diagnose+Revise.
    const plan = await STRATEGIES.l2_5_diagnose_revise.plan(
      ctx({ history: [attempt()], evidence: NO_EVIDENCE }),
    );
    expect(plan.runnable).toBe(false);
    if (!plan.runnable) {
      expect(plan.reason).toContain("needs real evidence");
      expect(plan.reason).toContain("D22");
    }
  });

  test("Diagnose+Revise runs with apply-error evidence and includes it", async () => {
    const e = applyErrorEvidence("error: while searching for: def handle");
    const plan = await STRATEGIES.l2_5_diagnose_revise.plan(
      ctx({ history: [attempt()], evidence: e }),
    );
    expect(plan.runnable).toBe(true);
    if (plan.runnable) {
      expect(plan.prompt).toContain("error: while searching for: def handle");
      expect(plan.prompt).toContain("REAL, ACTUAL result");
    }
  });

  test("every condition carries its template's provenance onto the plan", async () => {
    const plan = await STRATEGIES.l1_blind_retry.plan(ctx());
    expect(plan.runnable).toBe(true);
    if (plan.runnable) {
      expect(plan.promptSource).toContain("day12_step1_blindretry_searchreplace.py");
      expect(plan.promptSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("the only prompt difference between l2 and l2.5 is the evidence block", async () => {
    const a = attempt();
    const e = applyErrorEvidence("git said no");
    const l2 = await STRATEGIES.l2_reflection.plan(ctx({ history: [a] }));
    const l25 = await STRATEGIES.l2_5_diagnose_revise.plan(
      ctx({ history: [a], evidence: e }),
    );
    expect(l2.runnable && l25.runnable).toBe(true);
    if (l2.runnable && l25.runnable) {
      // Both contain the problem, the file and the previous attempt.
      for (const shared of [task.problemStatement, a.response]) {
        expect(l2.prompt).toContain(shared);
        expect(l25.prompt).toContain(shared);
      }
      // Only l2.5 contains the evidence.
      expect(l25.prompt).toContain("git said no");
      expect(l2.prompt).not.toContain("git said no");
    }
  });
});
