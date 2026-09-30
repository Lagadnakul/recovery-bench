/**
 * The task layer: what a cell is run against.
 *
 * The dataset is frozen and revision-pinned (step 0); the file a task edits is
 * localised from the gold patch, which is the study's declared method; and the
 * file content is cached so a prompt is byte-reproducible offline.
 */

export { loadDataset, loadMeta, resolveTaskSet, DatasetError } from "./dataset.ts";
export type { DatasetMeta } from "./dataset.ts";
export { localise, tryLocalise, targetFiles, LocalisationError } from "./localise.ts";
export { getFile, getTaskFile, cacheStats, cacheKey, CACHE_DIR, INDEX_PATH, FetchError } from "./files.ts";
export type { CachedFile } from "./files.ts";
