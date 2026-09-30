/**
 * The recovery conditions of Chapter 5, as code.
 *
 * `runCell` is the only entry point that spends money. Everything else here is
 * pure: prompt construction, response parsing, evidence resolution.
 */

export * from "./types.ts";
export { STRATEGIES, getStrategy, baseline, blindRetry, reflection, diagnoseRevise } from "./conditions.ts";
export type { ImplementedStrategyId } from "./conditions.ts";
export { runCell, toAttempt } from "./runCell.ts";
export {
  buildPrompt,
  loadPrompts,
  render,
  resetPromptCache,
  hasPrompt,
  PROMPTS_PATH,
  PROMPT_CONDITIONS,
} from "./prompt.ts";
export type { PromptCondition, PromptVars } from "./prompt.ts";
export {
  parseResponse,
  editText,
  honouredCondition,
} from "./parse.ts";
export type { ParsedResponse, Section } from "./parse.ts";
export {
  resolveEvidence,
  archivedEvidence,
  applyErrorEvidence,
  truncate,
  NO_EVIDENCE,
  APPLY_ERROR_WINDOW,
  EVIDENCE_MAX,
  TRIM_PREFIX,
  ARCHIVE_ROOT,
} from "./evidence.ts";
export type { Evidence, EvidenceSource } from "./evidence.ts";
