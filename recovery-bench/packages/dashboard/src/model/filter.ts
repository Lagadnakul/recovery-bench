/**
 * Filtering, as a pure function over rows.
 *
 * Deliberately not React state-shaped: the filter is a value, `apply` is a
 * function, and the component holds one of each. That is what makes the
 * behaviour testable under `bun test` with no DOM, and it is also the
 * `vercel-react-best-practices` rule about derived data — filtered rows are
 * computed during render, never pushed into state by an effect.
 */

import type { OutcomeKind } from "@rb/core";
import type { ViewRow } from "./rows.ts";

export interface Filter {
  /** Empty set means "all" for every facet, so nothing is hidden by default. */
  arms: ReadonlySet<string>;
  models: ReadonlySet<string>;
  conditions: ReadonlySet<string>;
  formats: ReadonlySet<string>;
  outcomes: ReadonlySet<OutcomeKind>;
  /** Free text over task id. */
  task: string;
  /** When true, only rows flagged not comparable to Chapter 5. */
  onlyIncomparable: boolean;
}

export const EMPTY_FILTER: Filter = {
  arms: new Set(),
  models: new Set(),
  conditions: new Set(),
  formats: new Set(),
  outcomes: new Set(),
  task: "",
  onlyIncomparable: false,
};

function allows<T>(chosen: ReadonlySet<T>, value: T | null): boolean {
  if (chosen.size === 0) return true;
  return value !== null && chosen.has(value);
}

export function apply(rows: readonly ViewRow[], f: Filter): ViewRow[] {
  const needle = f.task.trim().toLowerCase();
  return rows.filter((r) => {
    if (!allows(f.arms, r.arm)) return false;
    if (!allows(f.models, r.model)) return false;
    if (!allows(f.conditions, r.conditionLabel)) return false;
    if (!allows(f.formats, r.editFormat)) return false;
    if (!allows(f.outcomes, r.outcomeKind)) return false;
    if (f.onlyIncomparable && r.comparableToChapter5) return false;
    if (needle !== "" && !r.taskId.toLowerCase().includes(needle)) return false;
    return true;
  });
}

export function isActive(f: Filter): boolean {
  return (
    f.arms.size > 0 ||
    f.models.size > 0 ||
    f.conditions.size > 0 ||
    f.formats.size > 0 ||
    f.outcomes.size > 0 ||
    f.onlyIncomparable ||
    f.task.trim() !== ""
  );
}

/** Immutable toggle, so the caller can hand the result straight to `setState`. */
export function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Facet values present in the data, with counts, sorted for a stable rail. */
export function facet<K extends string>(
  rows: readonly ViewRow[],
  pick: (r: ViewRow) => K | null,
): { value: K; count: number }[] {
  const m = new Map<K, number>();
  for (const r of rows) {
    const v = pick(r);
    if (v === null) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
