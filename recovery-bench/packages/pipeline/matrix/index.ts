/**
 * The grid: enumeration, projection, execution, and the no-holes check.
 *
 * `verify` shares no code with `sweep` on purpose — a bug in the runner must
 * not be able to hide itself in the check that validates the runner.
 */

export {
  enumerateCells,
  toLineages,
  lineageId,
  summarise,
} from "./enumerate.ts";
export type { PlannedCell, Lineage, GridSummary } from "./enumerate.ts";
export {
  project,
  formatProjection,
  estimateCell,
  CHARS_PER_TOKEN,
  COMPLETION_TOKENS,
} from "./project.ts";
export type { Projection, ProviderProjection, CellEstimate } from "./project.ts";
export { RowStore, readRows, toRecord, toRow, SWEEP_ROWS } from "./store.ts";
export type { SweepRecord, LoadedRows } from "./store.ts";
export { sweep } from "./sweep.ts";
export type { SweepOptions, SweepResult } from "./sweep.ts";
export { verify, formatVerify } from "./verify.ts";
export type { VerifyResult } from "./verify.ts";
