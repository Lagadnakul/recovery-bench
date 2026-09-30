/**
 * Fetching the file a task edits, at its `base_commit`.
 *
 * The original fetched this over the network on every call:
 *
 *     url = f"https://raw.githubusercontent.com/{repo}/{commit}/{path}"
 *
 * That makes a run depend on GitHub being up and on the commit still being
 * reachable, and it means the prompt is not reproducible from the repository
 * alone. Since the file content is pasted verbatim into the prompt, a change
 * in it is a change in the experiment.
 *
 * So fetches are cached under `data/file_cache/`, keyed by content hash, and
 * **the cache is committed**. The failure pool needs 4 files and the
 * stratified set 60, so the whole cache is small. After the first fetch every
 * prompt is byte-reproducible with no network at all — which is what lets the
 * offline guarantee from steps 0-3 survive into a step that makes live calls.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Task } from "../../core/types.ts";

export const CACHE_DIR = "data/file_cache";
export const INDEX_PATH = join(CACHE_DIR, "index.json");

const RAW_BASE = "https://raw.githubusercontent.com";

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

/** Where a fetched file came from, recorded so a prompt can be audited. */
export interface CachedFile {
  repo: string;
  commit: string;
  path: string;
  /** SHA-256 of the exact bytes pasted into the prompt. */
  sha256: string;
  bytes: number;
  lines: number;
  fetchedAt: string;
}

type Index = Record<string, CachedFile>;

/** Stable cache key. The commit pins the content, so the key is exact. */
export function cacheKey(repo: string, commit: string, path: string): string {
  return `${repo}@${commit}:${path}`;
}

function blobName(key: string): string {
  const hash = new Bun.CryptoHasher("sha256").update(key).digest("hex");
  return join(CACHE_DIR, "blobs", `${hash.slice(0, 2)}`, `${hash}.txt`);
}

async function readIndex(): Promise<Index> {
  try {
    return JSON.parse(await readFile(INDEX_PATH, "utf8")) as Index;
  } catch {
    return {};
  }
}

async function writeIndex(index: Index): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  // Sorted keys so the committed file has a stable diff.
  const sorted: Index = {};
  for (const k of Object.keys(index).sort()) sorted[k] = index[k]!;
  await writeFile(INDEX_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

function sha256(s: string): string {
  return new Bun.CryptoHasher("sha256").update(s).digest("hex");
}

/**
 * Returns the file's content, from cache when present.
 *
 * `allowNetwork: false` makes a cache miss an error rather than a fetch, which
 * is how a run proves it touched no network.
 */
export async function getFile(
  repo: string,
  commit: string,
  path: string,
  opts: { allowNetwork?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<{ content: string; meta: CachedFile; fromCache: boolean }> {
  const allowNetwork = opts.allowNetwork ?? true;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const key = cacheKey(repo, commit, path);
  const index = await readIndex();
  const hit = index[key];

  if (hit) {
    const blob = blobName(key);
    try {
      const content = await readFile(blob, "utf8");
      // The hash is verified on every read, not trusted. A cache that can
      // silently drift is worse than no cache, because the prompt would change
      // without the experiment recording it.
      const actual = sha256(content);
      if (actual !== hit.sha256) {
        throw new FetchError(
          `cache corrupt for ${key}: recorded ${hit.sha256.slice(0, 12)}, ` +
            `file hashes ${actual.slice(0, 12)}`,
          null,
        );
      }
      return { content, meta: hit, fromCache: true };
    } catch (e) {
      if (e instanceof FetchError) throw e;
      // Index entry without a blob — fall through and refetch.
    }
  }

  if (!allowNetwork) {
    throw new FetchError(
      `${key} is not cached and network access is disabled. Run ` +
        `\`bun run warm-cache\` once with network to populate ${CACHE_DIR}.`,
      null,
    );
  }

  const url = `${RAW_BASE}/${repo}/${commit}/${path}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    throw new FetchError(
      `GET ${url} → HTTP ${res.status}. The commit or path may no longer be ` +
        `reachable; the cache is the durable record.`,
      res.status,
    );
  }
  const content = await res.text();

  const meta: CachedFile = {
    repo,
    commit,
    path,
    sha256: sha256(content),
    bytes: Buffer.byteLength(content, "utf8"),
    lines: content.split("\n").length,
    fetchedAt: new Date().toISOString(),
  };

  const blob = blobName(key);
  await mkdir(dirname(blob), { recursive: true });
  await writeFile(blob, content, "utf8");
  index[key] = meta;
  await writeIndex(index);

  return { content, meta, fromCache: false };
}

/** Convenience: the file a task edits, given its already-localised path. */
export async function getTaskFile(
  task: Task,
  path: string,
  opts: { allowNetwork?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<{ content: string; meta: CachedFile; fromCache: boolean }> {
  return getFile(task.repo, task.baseCommit, path, opts);
}

export async function cacheStats(): Promise<{
  entries: number;
  totalBytes: number;
  totalLines: number;
}> {
  const index = await readIndex();
  const vals = Object.values(index);
  return {
    entries: vals.length,
    totalBytes: vals.reduce((a, f) => a + f.bytes, 0),
    totalLines: vals.reduce((a, f) => a + f.lines, 0),
  };
}
