/**
 * A single-writer lock for the sweep.
 *
 * Two sweeps appending to `data/sweep_rows.jsonl` is not the race it looks
 * like. The danger is not a torn line — an append of one line is atomic
 * enough for that. It is that each process loads its OWN resume snapshot at
 * startup, so both consider the same cells outstanding and both write a row
 * for every one of them.
 *
 * On 25 Oct 2026 that happened to `a2_workhorse`: a sweep launched under
 * `nohup` outlived the shell that was stopped, a second sweep started, and the
 * arm ended with 419 rows for 260 cells — 159 duplicates, 74 of whose pairs
 * disagreed about the outcome, because they were independent model calls. The
 * arm had to be discarded. A lock is cheap; re-running an arm is not.
 *
 * Deliberately a plain file, not an OS mutex: it must survive being inspected
 * by a human, and `data/` is where the rest of the run state already lives.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const LOCK_PATH = "data/sweep.lock";

interface LockFile {
  pid: number;
  startedAt: string;
  argv: string;
}

/**
 * Whether a pid is still running.
 *
 * `process.kill(pid, 0)` sends no signal and only tests reachability. `EPERM`
 * means the process exists but belongs to someone else — still alive, so it
 * must count as held rather than stale.
 */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export class SweepLocked extends Error {
  constructor(public readonly held: LockFile, public readonly path: string) {
    super(
      `a sweep is already running (pid ${held.pid}, started ${held.startedAt}).\n` +
        `  Its command was: sweep ${held.argv}\n\n` +
        `  Two sweeps each load their own resume snapshot, so both would run\n` +
        `  every remaining cell and write a duplicate row for each. That is how\n` +
        `  a2 came to have 419 rows for 260 cells on 25 Oct 2026.\n\n` +
        `  Stop that process, or delete ${path} if you are certain it is gone.`,
    );
    this.name = "SweepLocked";
  }
}

/**
 * Takes the lock, returning the function that releases it.
 *
 * A lock whose owning process is gone is stale and is taken over: the common
 * cause is a hard kill, and refusing forever after a crash would be worse than
 * the race it guards against.
 */
export function acquireSweepLock(
  path: string = LOCK_PATH,
  onStale?: (held: LockFile | null) => void,
): () => void {
  mkdirSync(dirname(path), { recursive: true });

  if (existsSync(path)) {
    let held: LockFile | null = null;
    try {
      held = JSON.parse(readFileSync(path, "utf8")) as LockFile;
    } catch {
      // An unreadable lock cannot name its owner, so it cannot be honoured.
      held = null;
    }
    if (held !== null && typeof held.pid === "number" && alive(held.pid)) {
      throw new SweepLocked(held, path);
    }
    onStale?.(held);
  }

  const mine: LockFile = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    argv: process.argv.slice(2).join(" "),
  };
  writeFileSync(path, `${JSON.stringify(mine, null, 2)}\n`, "utf8");

  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      // Only remove it if it is still ours. A stale-takeover by another
      // process means that lock is theirs now, and deleting it would hand a
      // third process the door.
      const now = JSON.parse(readFileSync(path, "utf8")) as LockFile;
      if (now.pid === process.pid) unlinkSync(path);
    } catch {
      // Already gone, or unreadable. Either way there is nothing to release.
    }
  };
}
