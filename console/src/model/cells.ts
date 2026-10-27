import { z } from "zod";
import { OUTCOME_KINDS, ARMS, STRATEGIES, EDIT_FORMATS } from "./rows";

/**
 * The table's row, as it travels to the browser.
 *
 * This is the one place the console ships raw rows to the client, because
 * screen 5's whole purpose is to let a reader sort and filter all 1,604 of them
 * and that cannot be done on a static server. It is fetched rather than inlined
 * -- 781 KB, 47 KB gzipped, and only for the reader who opens that screen.
 *
 * Validated on arrival for the same reason rows.json is: a bad snapshot should
 * produce a stated error inside the panel, not a table full of `undefined`.
 */
export const Cell = z.object({
  key: z.string(),
  arm: z.enum(ARMS),
  taskId: z.string(),
  model: z.string(),
  strategy: z.enum(STRATEGIES),
  editFormat: z.enum(EDIT_FORMATS),
  thinking: z.boolean(),
  round: z.number().int().nonnegative(),
  repeat: z.number().int().nonnegative(),
  kind: z.enum(OUTCOME_KINDS),
  reason: z.string().nullable(),
  detail: z.string().nullable(),
  searchText: z.string().nullable(),
  gitStderr: z.string().nullable(),
  /** HTTP status, or null for a refusal that never reached the network. */
  status: z.number().nullable(),
  completionTokens: z.number().nullable(),
  latencyMs: z.number().nullable(),
});

export type Cell = z.infer<typeof Cell>;

export const Cells = z.array(Cell);

/**
 * Absolute, not relative. `trailingSlash` is on, so the cells screen is served
 * at `/cells/` and a relative `./cells.json` would resolve to
 * `/cells/cells.json` -- a 404 that only appears in the production export and
 * not in dev. If this is ever deployed under a subpath, set `basePath` in
 * next.config.ts and prefix both URLs here.
 */
export async function fetchCells(signal?: AbortSignal): Promise<Cell[]> {
  const response = await fetch("/cells.json", { signal });
  if (!response.ok) {
    throw new Error(
      `cells.json returned ${response.status}. The snapshot may not have been published.`,
    );
  }
  const parsed = Cells.safeParse(await response.json());
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      `cells.json failed validation at ${first?.path.join(".")}: ${first?.message}`,
    );
  }
  return parsed.data;
}

/**
 * The whole patch map, fetched once and cached by the caller.
 *
 * 862 KB for one patch looks wasteful, and it is on the first expansion --
 * after that it is in the HTTP cache and every later expansion is free. The
 * alternative is 735 separate files, which is worse for a static export and
 * much worse for anyone who wants to archive the site.
 */
export async function fetchPatches(
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  const response = await fetch("/patches.json", { signal });
  if (!response.ok) {
    throw new Error(`patches.json returned ${response.status}.`);
  }
  return (await response.json()) as Record<string, string>;
}
