/**
 * The validator against real model output.
 *
 * Synthetic fixtures prove the validator does what it was written to do. These
 * prove it survives contact with 61 patches a real model actually produced —
 * which is a different and harder claim.
 *
 * Two layers, deliberately:
 *
 *  - `data/legacy_patch_audit.json` is **committed**, so the finding is checked on
 *    any machine, including CI with no archive. The archive payload is gitignored
 *    (every file already exists upstream at `Lagadnakul/Dissertation@c8872d0`), so
 *    without this the number would be unverifiable.
 *  - the live re-audit runs only when the payload is present, and asserts the
 *    committed JSON still matches what the current validator produces. That is
 *    what catches a validator regression silently changing a published figure.
 */

import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { validateDiff } from "../packages/pipeline/edits/unified.ts";

const AUDIT = "data/legacy_patch_audit.json";
const PRED_DIR = "archive/legacy_predictions";

const audit = (await Bun.file(AUDIT).json()) as {
  totals: {
    patches: number;
    by_era: Record<string, { patches: number; clean: number; cleanPct: number; reasonCounts: Record<string, number> }>;
  };
  warnings: string[];
  rows: { instanceId: string; era: string; reasons: string[] }[];
};

describe("the committed audit", () => {
  test("covers all 61 archived patches", () => {
    expect(audit.totals.patches).toBe(61);
    expect(audit.rows).toHaveLength(61);
  });

  test("carries no warnings", () => {
    // The script warns if difflib-generated patches show defects, which would mean
    // the validator is wrong rather than the patches.
    expect(audit.warnings).toEqual([]);
  });

  test("THE FINDING: model-written diffs are 30/51 structurally clean", () => {
    const ud = audit.totals.by_era.unified_diff!;
    expect(ud.patches).toBe(51);
    expect(ud.clean).toBe(30);
    expect(ud.cleanPct).toBeCloseTo(58.8, 1);
  });

  test("THE CONTROL: programmatically generated diffs are 10/10 clean", () => {
    // Not a lucky result — difflib cannot miscount, which is the entire point of
    // the retrofit. A defect here would mean the validator had regressed.
    const sr = audit.totals.by_era.search_replace!;
    expect(sr.patches).toBe(10);
    expect(sr.clean).toBe(10);
    expect(sr.cleanPct).toBe(100);
  });

  test("the defect breakdown is what the write-up cites", () => {
    const counts = audit.totals.by_era.unified_diff!.reasonCounts;
    expect(counts.hunk_count_mismatch).toBe(16);
    expect(counts.no_file_header).toBe(6);
    // Prose before the header is deliberately NOT a defect: D13 measured that git
    // tolerates it, and the validator must not be stricter than the authority.
    expect(counts.junk_before_header).toBeUndefined();
  });

  test("every recorded reason is one the type system allows", () => {
    const legal = new Set([
      "search_not_found",
      "search_not_found_whitespace",
      "search_ambiguous",
      "search_empty",
      "block_unterminated",
      "no_file_header",
      "hunk_count_mismatch",
      "hunk_header_unparseable",
    ]);
    for (const row of audit.rows) {
      for (const reason of row.reasons) expect(legal.has(reason), reason).toBe(true);
    }
  });

  test("no SEARCH-path reason appears on a diff-path patch", () => {
    // A SEARCH/REPLACE reason here would mean the eras were misclassified.
    const searchPathReasons = ["search_not_found", "search_ambiguous", "search_empty", "block_unterminated"];
    const leaked = audit.rows.filter((r) => r.reasons.some((x) => searchPathReasons.includes(x)));
    expect(leaked).toEqual([]);
  });
});

const hasArchive = existsSync(PRED_DIR);

describe.skipIf(!hasArchive)("re-audit against the live archive", () => {
  test("the current validator still produces the committed numbers", async () => {
    const files = (await readdir(PRED_DIR)).filter((f) => f.endsWith(".json")).sort();
    let total = 0;
    const clean = { unified_diff: 0, search_replace: 0 };
    const seen = { unified_diff: 0, search_replace: 0 };

    for (const file of files) {
      const entries = (await Bun.file(join(PRED_DIR, file)).json()) as {
        model_patch: string;
        model_name_or_path: string;
      }[];
      for (const e of entries) {
        total += 1;
        const era = e.model_name_or_path.includes("searchreplace") ? "search_replace" : "unified_diff";
        seen[era] += 1;
        if (validateDiff(e.model_patch).length === 0) clean[era] += 1;
      }
    }

    expect(total).toBe(audit.totals.patches);
    expect(seen.unified_diff).toBe(audit.totals.by_era.unified_diff!.patches);
    expect(clean.unified_diff).toBe(audit.totals.by_era.unified_diff!.clean);
    expect(seen.search_replace).toBe(audit.totals.by_era.search_replace!.patches);
    expect(clean.search_replace).toBe(audit.totals.by_era.search_replace!.clean);
  });

  test("REGRESSION: a newline-terminated patch is not flagged", async () => {
    // The off-by-one that made the first analysis report 3/51 instead of 30/51
    // counted the trailing "" from split("\n") as a body line, flagging every
    // patch. Assert against a real difflib-generated patch, which cannot be wrong.
    const sr = (await Bun.file(join(PRED_DIR, "predictions_diagnoserevise_v2.json")).json()) as {
      model_patch: string;
    }[];
    expect(sr.length).toBeGreaterThan(0);
    for (const e of sr) {
      expect(e.model_patch.endsWith("\n")).toBe(true);
      expect(validateDiff(e.model_patch)).toEqual([]);
    }
  });
});
