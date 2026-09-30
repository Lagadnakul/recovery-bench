/**
 * Evidence for Diagnose+Revise, and the honest accounting of where it came
 * from.
 *
 * This is the hardest design problem in step 5, so the reasoning is written
 * out rather than assumed.
 *
 * Diagnose+Revise is *defined* by what it adds to Reflection-only: the real
 * output of running the previous patch against the real test suite. The
 * original prompt says so to the model in as many words —
 * *"the REAL, ACTUAL result of running your previous patch against the real
 * test suite (ground truth, not a guess)"*.
 *
 * This pipeline cannot run tests. D6 forbids Docker, permanently and for good
 * reasons. So for any newly attempted task, the strongest evidence obtainable
 * is `git`'s refusal of the patch — real, but categorically weaker than test
 * output, and available only when the patch failed to apply at all.
 *
 * There are three ways to handle that and only one is defensible.
 *
 *   1. Synthesise plausible test output. Fabrication. Never.
 *   2. Quietly substitute the apply error and still call it Diagnose+Revise.
 *      This is the tempting one, and it is what makes a result unfalsifiable:
 *      the condition would silently mean two different things depending on the
 *      task, and no reader could tell which.
 *   3. Record the provenance as data, and let the analysis refuse to pool
 *      incomparable cells.
 *
 * Option 3. `EvidenceSource` travels with the cell, exactly as
 * `Row<"test">` versus `Row<"apply">` travels with a verification (step 1).
 * A reader can always ask which kind of evidence a Diagnose+Revise cell
 * actually received, and the answer is in the data rather than in a footnote.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Where a piece of evidence came from. Ordered strongest first.
 *
 * `archived_test` is faithful to Chapter 5 and exists only for tasks the
 * original study already evaluated in Docker — those results are in the
 * archive and cannot be regenerated (D6). `apply_error` is what a new run can
 * produce. `none` means the condition cannot be run at all for this cell.
 */
export type EvidenceSource = "archived_test" | "apply_error" | "none";

export interface Evidence {
  source: EvidenceSource;
  /** The text placed in the prompt. Empty when `source` is "none". */
  text: string;
  /** Where it was read from, for audit. */
  origin: string;
  /** True when this evidence is equivalent to what Chapter 5's L2.5 received. */
  comparableToChapter5: boolean;
}

/**
 * The original's truncation, preserved exactly.
 *
 * `day15_step0_collect_round2_evidence.py`:
 *   - the apply error is taken as `content[idx : idx + 800]`
 *   - the whole evidence string is trimmed to its last 3000 characters,
 *     prefixed with "...[earlier output trimmed]...\n"
 *
 * These are part of the prompt, so they are part of the experiment. Changing
 * them would change what the model sees.
 */
export const APPLY_ERROR_WINDOW = 800;
export const EVIDENCE_MAX = 3000;
export const TRIM_PREFIX = "...[earlier output trimmed]...\n";

export function truncate(text: string): string {
  if (text.length <= EVIDENCE_MAX) return text;
  return TRIM_PREFIX + text.slice(-EVIDENCE_MAX);
}

const TEST_PREFIX = "REAL TEST OUTPUT from Round 1's revised patch:\n";
const APPLY_PREFIX = "REAL PATCH-APPLY ERROR from Round 1's revised patch:\n";

/** The markers the original searched for in an evaluation log. */
const APPLY_FAIL_MARKERS = [
  ">>>>> Patch Apply Failed",
  "Patch Apply Failed",
  "patch: ****",
];

export const ARCHIVE_ROOT = "archive/legacy_runs";

/**
 * Evidence from the archive: the real Docker test output for a task the
 * original study evaluated.
 *
 * This is the only source that reproduces Chapter 5's condition, and it is
 * available only for cells the original already ran. It is read, never
 * regenerated — there is no path by which this pipeline could produce more of
 * it.
 */
export async function archivedEvidence(
  runId: string,
  conditionDir: string,
  instanceId: string,
  root = ARCHIVE_ROOT,
): Promise<Evidence | null> {
  const logPath = join(root, runId, conditionDir, instanceId, "run_instance.log");
  let log: string;
  try {
    log = await readFile(logPath, "utf8");
  } catch {
    return null;
  }

  // An apply failure in the archive is still archived evidence, but it is an
  // apply error, not test output, and it is labelled as such. The distinction
  // is the whole point of this module.
  for (const marker of APPLY_FAIL_MARKERS) {
    const idx = log.indexOf(marker);
    if (idx !== -1) {
      return {
        source: "apply_error",
        text: truncate(APPLY_PREFIX + log.slice(idx, idx + APPLY_ERROR_WINDOW)),
        origin: logPath,
        comparableToChapter5: false,
      };
    }
  }

  return {
    source: "archived_test",
    text: truncate(TEST_PREFIX + log),
    origin: logPath,
    comparableToChapter5: true,
  };
}

/**
 * Evidence from a live attempt: git's own rejection.
 *
 * Real and useful — a model that misquoted source text is told precisely that.
 * But it is not test output, so `comparableToChapter5` is false and a cell
 * carrying it must not be pooled with Chapter 5's Diagnose+Revise results.
 */
export function applyErrorEvidence(gitStderr: string): Evidence {
  return {
    source: "apply_error",
    text: truncate(APPLY_PREFIX + gitStderr.slice(0, APPLY_ERROR_WINDOW)),
    origin: "git apply (this run)",
    comparableToChapter5: false,
  };
}

export const NO_EVIDENCE: Evidence = {
  source: "none",
  text: "",
  origin: "",
  comparableToChapter5: false,
};

/**
 * Resolves the best available evidence for a Diagnose+Revise cell.
 *
 * Deliberately returns `none` rather than falling back to something weaker
 * than it claims. A caller that receives `none` must record the cell as
 * unrunnable in this condition — not run it as Reflection-only and label it
 * Diagnose+Revise, which would make the manipulated variable meaningless.
 */
export async function resolveEvidence(opts: {
  instanceId: string;
  /** Set when replaying an archived cell. */
  archive?: { runId: string; conditionDir: string; root?: string };
  /** Set when the previous live attempt was rejected by git. */
  gitStderr?: string;
}): Promise<Evidence> {
  if (opts.archive) {
    const found = await archivedEvidence(
      opts.archive.runId,
      opts.archive.conditionDir,
      opts.instanceId,
      opts.archive.root ?? ARCHIVE_ROOT,
    );
    if (found) return found;
  }
  if (opts.gitStderr && opts.gitStderr.trim() !== "") {
    return applyErrorEvidence(opts.gitStderr);
  }
  return NO_EVIDENCE;
}
