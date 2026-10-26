/**
 * The single-writer lock.
 *
 * What it prevents is specific. Two sweeps do not tear a line — appending one
 * line is atomic enough. They each load their OWN resume snapshot at startup,
 * so both treat the same cells as outstanding and both write a row for every
 * one. `a2_workhorse` ended 25 Oct 2026 with 419 rows for 260 cells: 159
 * duplicates, 74 of whose pairs disagreed about the outcome because they were
 * independent model calls. The arm was discarded.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireSweepLock, SweepLocked } from "../packages/pipeline/matrix/lock.ts";

async function lockPath() {
  const dir = await mkdtemp(join(tmpdir(), "rb-lock-"));
  return join(dir, "sweep.lock");
}

describe("sweep lock — one writer at a time", () => {
  test("a second acquire is refused while the first is held", async () => {
    const p = await lockPath();
    const release = acquireSweepLock(p);
    expect(existsSync(p)).toBe(true);

    expect(() => acquireSweepLock(p)).toThrow(SweepLocked);

    release();
    expect(existsSync(p)).toBe(false);
  });

  test("the refusal names the holder and its command", async () => {
    // A lock that refuses without saying who holds it sends the next person
    // looking for a process they cannot identify.
    const p = await lockPath();
    const release = acquireSweepLock(p);
    try {
      acquireSweepLock(p);
      throw new Error("expected SweepLocked");
    } catch (e) {
      expect(e).toBeInstanceOf(SweepLocked);
      const msg = (e as SweepLocked).message;
      expect(msg).toContain(String(process.pid));
      expect(msg).toContain(p);
    }
    release();
  });

  test("acquiring again after release succeeds", async () => {
    const p = await lockPath();
    acquireSweepLock(p)();
    const again = acquireSweepLock(p);
    expect(existsSync(p)).toBe(true);
    again();
  });

  test("a lock held by a dead process is stale and is taken over", async () => {
    // The common cause is a hard kill. Refusing forever after a crash would be
    // worse than the race the lock guards against, so a dead holder yields.
    const p = await lockPath();
    // PID 0x7FFFFFFF is not a live process on any platform this runs on.
    writeFileSync(
      p,
      JSON.stringify({
        pid: 0x7fffffff,
        startedAt: new Date().toISOString(),
        argv: "--arm a2_workhorse --run --yes",
      }),
      "utf8",
    );

    // Collected into an array rather than a `let`: TypeScript's control-flow
    // analysis cannot see an assignment made inside a callback, so it narrows
    // the variable to its initialiser's type and the comparison stops
    // typechecking. The array carries the same evidence without the fight.
    const staleSeen: (number | null)[] = [];
    const release = acquireSweepLock(p, (held) => {
      staleSeen.push(held?.pid ?? null);
    });
    expect(staleSeen).toEqual([0x7fffffff]);
    const now = JSON.parse(readFileSync(p, "utf8")) as { pid: number };
    expect(now.pid).toBe(process.pid);
    release();
  });

  test("an unreadable lock cannot be honoured, so it is taken over", async () => {
    const p = await lockPath();
    writeFileSync(p, "this is not json", "utf8");
    const calls: string[] = [];
    const release = acquireSweepLock(p, () => {
      calls.push("stale");
    });
    expect(calls).toEqual(["stale"]);
    release();
  });

  test("release does not delete a lock that now belongs to someone else", async () => {
    // After a stale takeover the file is the new owner's. A late release from
    // the old owner must not hand a third process the door.
    const p = await lockPath();
    const release = acquireSweepLock(p);
    writeFileSync(
      p,
      JSON.stringify({
        pid: process.pid + 1,
        startedAt: new Date().toISOString(),
        argv: "someone else",
      }),
      "utf8",
    );
    release();
    expect(existsSync(p)).toBe(true);
  });
});
