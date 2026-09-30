/**
 * Oracle file localisation.
 *
 * The target file is parsed out of the gold patch. That is the original
 * study's declared method, not an accident of this reimplementation — the
 * dissertation describes its own system as *"single-shot, oracle-localised,
 * single-file patch generation"* and its configuration table records
 * *"File localisation | Oracle — target path parsed from the gold patch"*.
 * Reproducing Chapter 5 therefore requires reproducing this exactly.
 *
 * The original (`day12_step1_blindretry_searchreplace.py`):
 *
 *     def extract_target_files(gold_patch):
 *         paths = re.findall(r"^--- a/(.+)$", gold_patch, re.MULTILINE)
 *     target_files = extract_target_files(task["patch"])
 *     file_path = target_files[0]
 *
 * Two properties are worth stating because they are easy to get wrong.
 *
 * **Only the path crosses this boundary, never the patch body.** The model is
 * told which file to edit; it is never shown the reference solution. This
 * module returns a string, so there is no route by which the gold diff could
 * reach a prompt — and a test asserts the gold text is absent from every
 * rendered request.
 *
 * **`[0]` discards nothing.** Measured across the frozen export: all 300
 * SWE-bench Lite instances have single-file gold patches (D21). So the
 * single-file restriction belongs to the benchmark, not to the study's design.
 * This module asserts that rather than assuming it — a multi-file task becomes
 * a loud failure instead of a silently dropped edit.
 */

import type { Task } from "../../core/types.ts";

export class LocalisationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalisationError";
  }
}

/**
 * Every `--- a/<path>` header in a unified diff, in order.
 *
 * `/dev/null` is filtered: a patch that creates a file has no original to
 * quote, so there is nothing for a SEARCH block to match and the task cannot
 * be attempted in this format.
 */
export function targetFiles(goldPatch: string): string[] {
  const out: string[] = [];
  for (const line of goldPatch.split("\n")) {
    if (!line.startsWith("--- ")) continue;
    const rest = line.slice(4).trim();
    if (rest === "/dev/null") continue;
    // Strip the a/ prefix git writes at -p1, and any trailing tab-separated
    // timestamp that some diff producers append.
    const path = rest.replace(/^a\//, "").split("\t")[0]!;
    if (path.length > 0) out.push(path);
  }
  return out;
}

/**
 * The single file this task edits.
 *
 * Throws when there is not exactly one. The original took `[0]` silently; here
 * the count is checked, because the measured invariant (all 300 single-file) is
 * the justification for taking the first, and an unchecked assumption that
 * happens to hold is one step from an assumption that quietly stops holding.
 */
export function localise(task: Task): string {
  const files = targetFiles(task.patch);

  if (files.length === 0) {
    throw new LocalisationError(
      `${task.instanceId}: gold patch has no \`--- a/\` header, so no target ` +
        `file can be identified`,
    );
  }
  if (files.length > 1) {
    throw new LocalisationError(
      `${task.instanceId}: gold patch touches ${files.length} files ` +
        `(${files.join(", ")}). The prompt format embeds one file, so this task ` +
        `cannot be attempted single-file. All 300 instances of the frozen ` +
        `export are single-file (D21); this one is not, so the dataset changed.`,
    );
  }
  return files[0]!;
}

/**
 * Localises without throwing, for callers enumerating a grid.
 *
 * A cell whose task cannot be localised must still terminate in a recorded
 * outcome rather than vanish — the defect the whole pipeline is built against
 * (D2, D15). The sweep records the reason; it does not skip the cell.
 */
export function tryLocalise(
  task: Task,
): { ok: true; path: string } | { ok: false; reason: string } {
  try {
    return { ok: true, path: localise(task) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
