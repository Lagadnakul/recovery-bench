/**
 * THE ORACLE.
 *
 * `reports/data/master_table.md` is the file every number in Chapters 4 and 5
 * cites. It was written by `build_master_table.py` from the same logs this
 * pipeline reads. So a second, independent implementation must reproduce it
 * **byte for byte**, or one of the two is wrong.
 *
 * This is the same control pattern that caught the only two real bugs this
 * project has had — the D14 audit miscount and the `extractDiff` prose bias.
 * Neither was found by reading code. Both were found by a result that could not
 * be wrong by construction colliding with one that could.
 *
 * Two layers, as with `legacyPatches.test.ts`:
 *
 *  - `data/replay_rows.json` is **committed**, so the cell counts are checked on
 *    any machine, including CI with no archive.
 *  - the byte-for-byte regeneration runs only when the gitignored archive is
 *    present.
 */

import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { loadArchive, ARCHIVE_RUNS } from "../packages/pipeline/analysis/load.ts";
import { buildMasterTable } from "../packages/pipeline/analysis/tables.ts";
import { summarise, HARDCODED_FAILURE_CLASS, ORACLE } from "../packages/pipeline/analysis/replay.ts";

const committed = (await Bun.file("data/replay_rows.json").json()) as {
  summary: ReturnType<typeof summarise>;
  failure_class_derived: Record<string, "logic" | "format">;
  rows: { verification: string; outcome: string; resolved: boolean | null; tests: unknown }[];
};

describe("the committed replay", () => {
  test("recovers 51 cells — 42 with a report, 9 without", () => {
    // 42 is what build_master_table.py reports ("Regenerated from 42 evaluation
    // records"). The 9 are cells it could not see at all.
    expect(committed.summary.rows).toBe(51);
    expect(committed.summary.testVerified).toBe(42);
    expect(committed.summary.applyVerified).toBe(9);
    expect(committed.rows).toHaveLength(51);
  });

  test("every apply-verified cell is an apply failure", () => {
    expect(committed.summary.applyFailed).toBe(committed.summary.applyVerified);
  });

  test("THE CLAIM: the derived failure class matches the hand-written dict", () => {
    // This is what step 3 exists to establish. `FAILURE_CLASS` in
    // build_master_table.py is typed by hand; here it is derived from outcomes.
    expect(committed.summary.classMatches).toBe(true);
    expect(committed.summary.classDisagreements).toEqual([]);
    expect(committed.failure_class_derived).toEqual(HARDCODED_FAILURE_CLASS);
  });

  test("the failure pool is derived, not assumed", () => {
    expect(committed.summary.poolMatches).toBe(true);
  });

  test("resolved is null on precisely the apply-verified rows", () => {
    // The integrity rule from types.ts, checked in the serialised output too.
    for (const r of committed.rows) {
      if (r.verification === "apply") {
        expect(r.resolved).toBeNull();
        expect(r.tests).toBeNull();
      } else {
        expect(typeof r.resolved).toBe("boolean");
      }
    }
  });
});

const hasArchive = existsSync(ARCHIVE_RUNS);

describe.skipIf(!hasArchive)("regeneration against the live archive", () => {
  test("master_table.md regenerates BYTE-IDENTICALLY", async () => {
    const { rows } = await loadArchive();
    const regenerated = buildMasterTable(rows);
    const expected = await Bun.file(ORACLE).text();

    // Compared as text so a failure prints the offending line rather than
    // "strings differ".
    expect(regenerated.split("\n")).toEqual(expected.split("\n"));
    expect(regenerated).toBe(expected);
  });

  test("the live archive still produces the committed summary", async () => {
    const load = await loadArchive();
    expect(summarise(load)).toEqual(committed.summary);
  });
});
