/**
 * The prompt templates. These *are* the experiment.
 *
 * The three conditions of Chapter 5 differ only in what their prompt contains,
 * so a single character of drift here makes new runs incomparable with the
 * submitted results — and nothing else in the pipeline would notice. The
 * templates are therefore not retyped: they are loaded from
 * `data/original_prompts.json`, which `scripts/extract_prompts.py` extracts
 * verbatim from the original Python together with the SHA-256 of each source
 * file.
 *
 * What differs between conditions, and nothing else:
 *
 *   l1_blind_retry        problem statement + current file
 *   l2_reflection         + the previous attempt
 *   l2_5_diagnose_revise  + the previous attempt + REAL test evidence
 *
 * That last addition is the manipulated variable of the whole study. See
 * `evidence.ts` for why it cannot always be honoured without Docker, and how
 * the pipeline records that instead of pretending otherwise.
 */

import { readFile } from "node:fs/promises";
import type { StrategyId } from "../../core/types.ts";

export const PROMPTS_PATH = "data/original_prompts.json";

/** Conditions that have an original template. L0 made no recovery call. */
export type PromptCondition =
  | "l0_baseline"
  | "l1_blind_retry"
  | "l2_reflection"
  | "l2_5_diagnose_revise";

/** The three recovery conditions. L0 is the first attempt, not a recovery. */
export const PROMPT_CONDITIONS: readonly PromptCondition[] = [
  "l1_blind_retry",
  "l2_reflection",
  "l2_5_diagnose_revise",
];

export function hasPrompt(id: StrategyId): id is PromptCondition {
  return (PROMPT_CONDITIONS as readonly string[]).includes(id);
}

interface PromptRecord {
  source_file: string;
  source_sha256: string;
  line_range: [number, number];
  placeholders: string[];
  template: string;
}

interface PromptsFile {
  note: string;
  source_repo: string;
  prompts: Record<string, PromptRecord>;
}

let cached: PromptsFile | null = null;

export async function loadPrompts(path = PROMPTS_PATH): Promise<PromptsFile> {
  if (cached) return cached;
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new Error(
      `no prompt templates at ${path}. They are extracted from the original ` +
        `study by \`python3 scripts/extract_prompts.py\`, which needs ` +
        `Dissertation-main/ present. The file is committed, so this should ` +
        `only happen if it was deleted.`,
    );
  }
  cached = JSON.parse(raw) as PromptsFile;
  return cached;
}

/** Test seam — forces the next `loadPrompts` to re-read from disk. */
export function resetPromptCache(): void {
  cached = null;
}

/**
 * The values substituted into a template.
 *
 * Named after the original's f-string expressions so the mapping is checkable
 * by eye against the Python: `{task['repo']}`, `{file_path}`, and so on.
 */
export interface PromptVars {
  repo: string;
  problemStatement: string;
  filePath: string;
  fileContent: string;
  /** l2 and l2.5 only — the model's own previous response, verbatim. */
  previousAttempt?: string;
  /** l2.5 only — real test output or a real apply error. Never synthesised. */
  evidence?: string;
}

/**
 * Substitution, deliberately literal.
 *
 * Python's f-string expressions are replaced by exact string match rather than
 * by a general template engine. A regex-driven renderer would silently tolerate
 * a placeholder that no longer exists; this one throws, so a template change
 * upstream cannot pass unnoticed.
 *
 * Substitution is single-pass over the template: a value that happens to
 * contain `{file_path}` (file content routinely contains braces) is never
 * rescanned, so content cannot inject a placeholder.
 */
export function render(template: string, vars: PromptVars): string {
  const map: Record<string, string | undefined> = {
    "{task['repo']}": vars.repo,
    "{task['problem_statement']}": vars.problemStatement,
    "{file_path}": vars.filePath,
    "{real_content}": vars.fileContent,
    "{previous_attempt_content}": vars.previousAttempt,
    "{real_evidence}": vars.evidence,
  };

  let out = "";
  let i = 0;
  while (i < template.length) {
    if (template[i] === "{") {
      const close = template.indexOf("}", i);
      if (close !== -1) {
        const token = template.slice(i, close + 1);
        if (token in map) {
          const value = map[token];
          if (value === undefined) {
            throw new Error(
              `template needs ${token} but no value was supplied — this ` +
                `condition requires it`,
            );
          }
          out += value;
          i = close + 1;
          continue;
        }
        throw new Error(
          `unrecognised placeholder ${token} in template. The original ` +
            `prompts changed; re-run scripts/extract_prompts.py and update ` +
            `PromptVars rather than guessing a value.`,
        );
      }
    }
    out += template[i];
    i++;
  }
  return out;
}

/** Renders the prompt for one condition. */
/**
 * Renders the prompt for one condition, optionally keyed by edit format.
 *
 * The baseline needs the format: the original asked for a unified diff in a
 * `PATCH:` section (`day7_step1_generate_full_pilot.py`), and the retrofit
 * asked for SEARCH/REPLACE blocks in an `EDITS:` section. Those are different
 * prompts, and a5 compares the two formats, so the pairing has to be exact —
 * `<condition>__<format>` is looked up first and the bare condition is the
 * fallback.
 */
export async function buildPrompt(
  condition: PromptCondition,
  vars: PromptVars,
  editFormat?: string,
): Promise<{ prompt: string; sourceFile: string; sourceSha256: string }> {
  const prompts = await loadPrompts();
  const rec =
    (editFormat ? prompts.prompts[`${condition}__${editFormat}`] : undefined) ??
    prompts.prompts[condition];
  if (!rec) {
    throw new Error(
      `no template for ${condition}` +
        (editFormat ? ` (format ${editFormat})` : "") +
        ` in ${PROMPTS_PATH} — known: ` +
        Object.keys(prompts.prompts).join(", "),
    );
  }
  return {
    prompt: render(rec.template, vars),
    sourceFile: rec.source_file,
    sourceSha256: rec.source_sha256,
  };
}
