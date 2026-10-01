/**
 * Copies the pipeline's data files into `public/data/` so Vite can serve them.
 *
 * Why a copy rather than an import: the dashboard builds to static assets with
 * no server (D11), so it fetches its data at runtime. Bundling `swebench_lite.jsonl`
 * or a long sweep into the JS would make the chunk enormous and would freeze the
 * data at build time, which is wrong for a file that grows as a sweep runs.
 *
 * The important behaviour is what happens when a file is MISSING.
 * `data/sweep_rows.jsonl` is gitignored — correctly, since it is per-run
 * experimental output rather than a derived artifact — so a fresh clone has no
 * sweep at all. That is not an error and must not be reported as one. The
 * manifest records presence per file, and the UI turns absence into an empty
 * state that says what to run.
 *
 * Reporting a missing sweep as zero cells would reproduce in the interface the
 * exact defect this whole project was built against: a cell that left no
 * record (D15).
 */

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const HERE = import.meta.dirname;
const REPO = resolve(HERE, "../../..");
const SRC = resolve(REPO, "data");
const DEST = resolve(HERE, "../public/data");

/** `required` files make the dashboard meaningless if absent; the rest are optional. */
const FILES: { name: string; required: boolean; note: string }[] = [
  {
    name: "replay_rows.json",
    required: true,
    note: "the original study, replayed from the archive — committed",
  },
  {
    name: "chapter5_figures.json",
    required: true,
    note: "the datasets behind figures 5.1-5.4 — committed",
  },
  {
    name: "legacy_patch_audit.json",
    required: true,
    note: "structural defects per legacy patch — committed",
  },
  {
    name: "sweep_rows.jsonl",
    required: false,
    note: "new sweep output — gitignored, absent on a fresh clone",
  },
];

export interface SyncedFile {
  name: string;
  present: boolean;
  bytes: number | null;
  note: string;
}

export interface DataManifest {
  syncedAt: string;
  files: SyncedFile[];
}

async function sizeOf(path: string): Promise<number | null> {
  try {
    const s = await stat(path);
    return s.isFile() ? s.size : null;
  } catch {
    return null;
  }
}

export async function sync(): Promise<DataManifest> {
  await rm(DEST, { recursive: true, force: true });
  await mkdir(DEST, { recursive: true });

  const files: SyncedFile[] = [];
  const missingRequired: string[] = [];

  for (const f of FILES) {
    const from = resolve(SRC, f.name);
    const bytes = await sizeOf(from);
    if (bytes === null) {
      files.push({ name: f.name, present: false, bytes: null, note: f.note });
      if (f.required) missingRequired.push(f.name);
      continue;
    }
    await writeFile(resolve(DEST, basename(f.name)), await readFile(from));
    files.push({ name: f.name, present: true, bytes, note: f.note });
  }

  const manifest: DataManifest = { syncedAt: new Date().toISOString(), files };
  await writeFile(resolve(DEST, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  if (missingRequired.length > 0) {
    throw new Error(
      `missing committed data: ${missingRequired.join(", ")}. These are ` +
        `committed files, so this should only happen if they were deleted. ` +
        `Rebuild them with \`bun run replay\` and \`bun run report\`.`,
    );
  }
  return manifest;
}

if (import.meta.main) {
  const m = await sync();
  for (const f of m.files) {
    const size = f.bytes === null ? "absent" : `${(f.bytes / 1024).toFixed(1)} KB`;
    console.log(`  ${f.present ? "ok     " : "skipped"} ${f.name.padEnd(26)} ${size}`);
  }
  const sweep = m.files.find((f) => f.name === "sweep_rows.jsonl");
  if (sweep && !sweep.present) {
    console.log(
      "\n  No sweep on this machine. The dashboard will open on the replayed\n" +
        "  original study and show the sweep views as empty, which is correct.\n" +
        "  Fill them with: bun run sweep --run --yes",
    );
  }
}
