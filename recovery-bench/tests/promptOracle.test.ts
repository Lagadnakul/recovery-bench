/**
 * THE ORACLE for step 5.
 *
 * The prompts are the experiment. If this reimplementation renders them even
 * slightly differently from the original Python, new runs are not comparable
 * with Chapter 5 — and no other test in the suite would detect it, because
 * every other check would still pass on a subtly different prompt.
 *
 * Two layers:
 *
 *   1. The rendered TypeScript prompt must equal the committed template with
 *      its placeholders substituted. Always runs.
 *   2. The committed template must still equal what is in the original Python.
 *      Skipped when `Dissertation-main/` is absent (it is gitignored, 94 MB),
 *      which is the same pattern as step 3's archive-dependent tests.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import {
  buildPrompt,
  loadPrompts,
  render,
  PROMPT_CONDITIONS,
  type PromptVars,
} from "../packages/pipeline/strategies/prompt.ts";

const VARS: PromptVars = {
  repo: "django/django",
  problemStatement: "sqlmigrate wraps its output in BEGIN/COMMIT even if...",
  filePath: "django/core/management/commands/sqlmigrate.py",
  fileContent: "class Command(BaseCommand):\n    pass\n",
  previousAttempt: "EXPLANATION:\nI changed the wrong thing.\n",
  evidence: "REAL TEST OUTPUT...\nFAILED tests/test_x.py::test_y\n",
};

describe("prompt oracle — the committed templates", () => {
  test("all three conditions have a template with source provenance", async () => {
    const p = await loadPrompts();
    for (const cond of PROMPT_CONDITIONS) {
      const rec = p.prompts[cond];
      expect(rec, `missing template for ${cond}`).toBeDefined();
      // Provenance is not decoration: it is how a reader checks the claim.
      expect(rec!.source_file).toMatch(/^06_Methodology\/code\/day1[12].*\.py$/);
      expect(rec!.source_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(rec!.template.length).toBeGreaterThan(500);
    }
  });

  test("the three conditions differ by exactly their extra inputs", async () => {
    const p = await loadPrompts();
    const ph = (c: string) => new Set(p.prompts[c]!.placeholders);

    const l1 = ph("l1_blind_retry");
    const l2 = ph("l2_reflection");
    const l25 = ph("l2_5_diagnose_revise");

    // L2 = L1 + the previous attempt.
    expect([...l2].filter((x) => !l1.has(x)).sort()).toEqual([
      "previous_attempt_content",
    ]);
    // L2.5 = L2 + real evidence. This single placeholder IS the manipulated
    // variable of the entire study.
    expect([...l25].filter((x) => !l2.has(x)).sort()).toEqual(["real_evidence"]);
  });

  test("rendering substitutes every placeholder and leaves no template syntax", async () => {
    for (const cond of PROMPT_CONDITIONS) {
      const { prompt } = await buildPrompt(cond, VARS);
      expect(prompt).not.toContain("{task[");
      expect(prompt).not.toContain("{file_path}");
      expect(prompt).not.toContain("{real_content}");
      expect(prompt).not.toContain("{previous_attempt_content}");
      expect(prompt).not.toContain("{real_evidence}");
      expect(prompt).toContain(VARS.repo);
      expect(prompt).toContain(VARS.filePath);
      expect(prompt).toContain(VARS.fileContent);
    }
  });

  test("rendered prompt equals the template with values substituted", async () => {
    const p = await loadPrompts();
    for (const cond of PROMPT_CONDITIONS) {
      const expected = p.prompts[cond]!.template
        .split("{task['repo']}").join(VARS.repo)
        .split("{task['problem_statement']}").join(VARS.problemStatement)
        .split("{file_path}").join(VARS.filePath)
        .split("{real_content}").join(VARS.fileContent)
        .split("{previous_attempt_content}").join(VARS.previousAttempt!)
        .split("{real_evidence}").join(VARS.evidence!);
      const { prompt } = await buildPrompt(cond, VARS);
      expect(prompt).toBe(expected);
    }
  });

  test("each condition demands its own response format", async () => {
    const l1 = (await buildPrompt("l1_blind_retry", VARS)).prompt;
    const l2 = (await buildPrompt("l2_reflection", VARS)).prompt;
    const l25 = (await buildPrompt("l2_5_diagnose_revise", VARS)).prompt;

    expect(l1).toContain("EXPLANATION:");
    expect(l1).not.toContain("REFLECTION:");
    expect(l1).not.toContain("DIAGNOSIS:");

    expect(l2).toContain("REFLECTION:");
    expect(l2).not.toContain("DIAGNOSIS:");

    expect(l25).toContain("DIAGNOSIS:");
    expect(l25).not.toContain("REFLECTION:");

    // All three demand SEARCH/REPLACE and explicitly forbid a diff — the
    // retrofit that produced the format finding (D14).
    for (const p of [l1, l2, l25]) {
      expect(p).toContain("SEARCH/REPLACE blocks - NOT a diff, NO line numbers");
      expect(p).toContain("<<<<<<< SEARCH");
      expect(p).toContain(">>>>>>> REPLACE");
    }
  });

  test("l2.5 tells the model the evidence is ground truth", async () => {
    const { prompt } = await buildPrompt("l2_5_diagnose_revise", VARS);
    // This sentence is why evidence provenance has to be tracked (D22): the
    // prompt makes a factual claim to the model about what it contains.
    expect(prompt).toContain(
      "the REAL, ACTUAL result of running your previous patch against the real test suite (ground truth, not a guess)",
    );
  });

  test("a missing required value throws rather than rendering an empty block", async () => {
    // An l2.5 prompt with an empty evidence section would tell the model it is
    // receiving ground truth and then show it nothing.
    const { prompts } = await loadPrompts();
    const t = prompts.l2_5_diagnose_revise!.template;
    // The key is omitted, not set to undefined: `exactOptionalPropertyTypes`
    // distinguishes the two, and "absent" is what a caller actually does wrong.
    const { evidence: _dropped, ...noEvidence } = VARS;
    expect(() => render(t, noEvidence)).toThrow(/needs \{real_evidence\}/);
  });

  test("an unknown placeholder is an error, not a silent pass-through", () => {
    expect(() => render("hello {unknown_thing}", VARS)).toThrow(
      /unrecognised placeholder/,
    );
  });

  test("file content containing braces is not rescanned as a placeholder", () => {
    // Python source is full of braces; dict literals and f-strings especially.
    const nasty = "d = {'real_evidence': 1}\nf\"{file_path}\"\n";
    const out = render("FILE:\n{real_content}\nEND", {
      ...VARS,
      fileContent: nasty,
    });
    expect(out).toBe(`FILE:\n${nasty}\nEND`);
  });
});

// ───────────────────────────────────────────────────────────── layer 2
const ORIGINAL_DIR = "../Dissertation-main/06_Methodology/code";
const haveOriginals = existsSync(ORIGINAL_DIR);

describe.skipIf(!haveOriginals)(
  "prompt oracle — committed templates still match the original Python",
  () => {
    test("each source file hashes to the recorded SHA-256", async () => {
      const p = await loadPrompts();
      for (const cond of PROMPT_CONDITIONS) {
        const rec = p.prompts[cond]!;
        const path = `../Dissertation-main/${rec.source_file}`;
        const bytes = readFileSync(path);
        const actual = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
        expect(actual, `${rec.source_file} changed since extraction`).toBe(
          rec.source_sha256,
        );
      }
    });

    test("the template appears verbatim in its source file", async () => {
      const p = await loadPrompts();
      for (const cond of PROMPT_CONDITIONS) {
        const rec = p.prompts[cond]!;
        const src = readFileSync(`../Dissertation-main/${rec.source_file}`, "utf8");
        // Byte-for-byte containment. Not a fuzzy match, not a normalised
        // comparison — the prompt is the experiment.
        expect(
          src.includes(rec.template),
          `${cond}: committed template is not a verbatim substring of ${rec.source_file}`,
        ).toBe(true);
      }
    });
  },
);
