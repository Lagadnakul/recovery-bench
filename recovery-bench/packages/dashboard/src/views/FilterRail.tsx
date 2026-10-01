/**
 * The filter rail.
 *
 * Facets are derived from the rows actually loaded, not hardcoded — a sweep
 * that ran one arm shows one arm, and a model nobody ran never appears as a
 * dead checkbox.
 *
 * Every control is a real `<input>` or `<button>` with a visible label. A
 * placeholder is not a label, and an icon-only filter button would be
 * unlabelled for a screen reader.
 */

import type { OutcomeKind } from "@rb/core";
import { EMPTY_FILTER, facet, isActive, toggle, type Filter } from "../model/filter.ts";
import type { ViewRow } from "../model/rows.ts";
import { ORDERED_KINDS, statusOf } from "../model/status.ts";

function Group({
  legend,
  children,
}: {
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="t-micro mb-1.5 p-0">{legend}</legend>
      <div className="flex flex-col gap-0.5">{children}</div>
    </fieldset>
  );
}

function Check({
  checked,
  onChange,
  label,
  count,
  swatch,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count: number;
  swatch?: string;
}) {
  return (
    <label className="flex min-h-[26px] cursor-pointer items-center gap-2 text-[13px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 cursor-pointer accent-[var(--accent)]"
      />
      {swatch !== undefined && (
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-chip"
          style={{ background: swatch }}
        />
      )}
      <span className="truncate" title={label}>
        {label}
      </span>
      <span className="ml-auto text-[12px] font-semibold text-ink-faint tabular-nums">{count}</span>
    </label>
  );
}

export function FilterRail({
  all,
  filter,
  onChange,
}: {
  /** Unfiltered rows — facet counts are of what exists, not of what survives. */
  all: readonly ViewRow[];
  filter: Filter;
  onChange: (f: Filter) => void;
}) {
  const arms = facet(all, (r) => r.arm);
  const models = facet(all, (r) => r.model);
  const conditions = facet(all, (r) => r.conditionLabel);
  const formats = facet(all, (r) => r.editFormat);
  const outcomeCounts = facet(all, (r) => r.outcomeKind as OutcomeKind);
  const incomparable = all.filter((r) => !r.comparableToChapter5).length;

  const countOf = (list: { value: string; count: number }[], v: string): number =>
    list.find((x) => x.value === v)?.count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <h2 className="t-section text-[15px]">Narrow it down</h2>
        {isActive(filter) && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTER)}
            className="ml-auto cursor-pointer rounded-control border border-edge bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink-soft"
          >
            Clear all
          </button>
        )}
      </div>

      <div>
        <label htmlFor="task-filter" className="t-micro mb-1.5 block">
          Task
        </label>
        <input
          id="task-filter"
          type="search"
          value={filter.task}
          onChange={(e) => onChange({ ...filter, task: e.target.value })}
          placeholder="django-11620"
          className="mono w-full rounded-control border border-edge bg-surface px-2.5 py-1.5 text-[13px] text-ink"
        />
      </div>

      <Group legend="Outcome">
        {ORDERED_KINDS.filter((k) => countOf(outcomeCounts, k) > 0).map((kind) => {
          const s = statusOf(kind);
          return (
            <Check
              key={kind}
              checked={filter.outcomes.has(kind)}
              onChange={() => onChange({ ...filter, outcomes: toggle(filter.outcomes, kind) })}
              label={s.label}
              count={countOf(outcomeCounts, kind)}
              swatch={`var(${s.token})`}
            />
          );
        })}
      </Group>

      {conditions.length > 1 && (
        <Group legend="Condition">
          {conditions.map((c) => (
            <Check
              key={c.value}
              checked={filter.conditions.has(c.value)}
              onChange={() =>
                onChange({ ...filter, conditions: toggle(filter.conditions, c.value) })
              }
              label={c.value}
              count={c.count}
            />
          ))}
        </Group>
      )}

      {models.length > 1 && (
        <Group legend="Model">
          {models.map((m) => (
            <Check
              key={m.value}
              checked={filter.models.has(m.value)}
              onChange={() => onChange({ ...filter, models: toggle(filter.models, m.value) })}
              label={m.value}
              count={m.count}
            />
          ))}
        </Group>
      )}

      {formats.length > 1 && (
        <Group legend="Edit format">
          {formats.map((f) => (
            <Check
              key={f.value}
              checked={filter.formats.has(f.value)}
              onChange={() => onChange({ ...filter, formats: toggle(filter.formats, f.value) })}
              label={f.value}
              count={f.count}
            />
          ))}
        </Group>
      )}

      {arms.length > 1 && (
        <Group legend="Arm">
          {arms.map((a) => (
            <Check
              key={a.value}
              checked={filter.arms.has(a.value)}
              onChange={() => onChange({ ...filter, arms: toggle(filter.arms, a.value) })}
              label={a.value}
              count={a.count}
            />
          ))}
        </Group>
      )}

      {incomparable > 0 && (
        <Group legend="Comparability">
          <Check
            checked={filter.onlyIncomparable}
            onChange={() => onChange({ ...filter, onlyIncomparable: !filter.onlyIncomparable })}
            label="Not comparable to the study"
            count={incomparable}
          />
        </Group>
      )}
    </div>
  );
}
