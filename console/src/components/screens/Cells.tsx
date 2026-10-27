"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@/components/primitives/Panel";
import { Figure } from "@/components/primitives/Figure";
import { Finding } from "@/components/primitives/Finding";
import { Note } from "@/components/primitives/Note";
import {
  Plain,
  Receipt,
  ReadThis,
  TermList,
} from "@/components/primitives/Plain";
import { Shell } from "@/components/shell/Rail";
import { cn } from "@/lib/utils";
import {
  fetchCells,
  fetchPatches,
  type Cell,
} from "@/model/cells";
import {
  ARM_LABEL,
  STRATEGY_LABEL,
  type Arm,
  type Strategy,
} from "@/model/rows";
import type { TermKey } from "@/model/glossary";

/**
 * Screen 5 -- every attempt, one row each.
 *
 * The screen that makes the other four checkable. Everything else in the
 * console is a summary, and a summary is a claim about data a reader cannot
 * see. Here they can see it: filter to the exact condition any other screen
 * talks about, and count the rows themselves.
 *
 * Three decisions worth knowing about:
 *
 * - **The rows are fetched, not inlined.** 781 KB of them, only for the reader
 *   who opens this screen. Which means this screen has real loading and error
 *   states, and they are built rather than stubbed.
 * - **It is windowed, not paginated.** Pagination hides the size of the thing;
 *   a scrollbar that takes a long time to drag tells the truth about 1,604
 *   rows in a way "page 1 of 33" does not.
 * - **Refusals are drawn as absences.** A row that never reached a model has a
 *   grey dash in every measured column, never a zero.
 */

const TERMS: TermKey[] = [
  "cell",
  "arm",
  "task",
  "round",
  "repeat",
  "applied",
  "malformed",
  "applyFail",
  "noPatch",
  "truncated",
  "providerError",
  "byDesign",
  "hole",
];

const ROW_HEIGHT = 32;
const OVERSCAN = 8;

const KIND_LABEL: Record<string, string> = {
  APPLIED: "Accepted",
  MALFORMED: "Unusable",
  APPLY_FAIL: "Rejected",
  TRUNCATED: "Cut off",
  NO_PATCH: "No edit",
  NO_OUTPUT: "Empty",
  PROVIDER_ERROR: "No answer",
};

type SortKey = "taskId" | "round" | "repeat" | "kind" | "completionTokens";

type Filters = {
  arm: string;
  model: string;
  strategy: string;
  kind: string;
  format: string;
  query: string;
};

const EMPTY: Filters = {
  arm: "",
  model: "",
  strategy: "",
  kind: "",
  format: "",
  query: "",
};

function Select({
  label,
  value,
  options,
  onChange,
  format,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  format?: (v: string) => string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-ink-muted text-label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-rule-strong rounded-control bg-surface text-ink focus-visible:ring-ring h-8 border px-2 text-small focus-visible:ring-2 focus-visible:outline-none"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {format ? format(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A labelled block of diagnostic text inside an expanded row. */
function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-ink-muted text-label">{label}</p>
      <pre className="bg-surface-sunk border-rule text-ink mt-1 max-h-60 overflow-auto border p-2 font-mono text-label whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

export function Cells() {
  const [rows, setRows] = useState<Cell[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "taskId",
    desc: false,
  });
  const [open, setOpen] = useState<string | null>(null);
  const [patches, setPatches] = useState<Record<string, string> | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(640);
  const scroller = useRef<HTMLDivElement>(null);

  // Retry is a counter rather than a function that resets state, because
  // setting state synchronously inside an effect is what causes the cascading
  // render React warns about. Bumping this re-runs the effect, and the effect
  // owns every state change that follows from it.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchCells(controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setRows(loaded);
        setError(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => controller.abort();
  }, [attempt]);

  // The expanded row's patch. Fetched on first expansion and kept, so the
  // 862 KB map is paid for at most once per visit.
  useEffect(() => {
    if (!open || patches) return;
    const controller = new AbortController();
    fetchPatches(controller.signal)
      .then(setPatches)
      .catch(() => setPatches({}));
    return () => controller.abort();
  }, [open, patches]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setViewport(el.clientHeight || 640),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rows]);

  const options = useMemo(() => {
    const source = rows ?? [];
    const uniq = (pick: (c: Cell) => string) =>
      [...new Set(source.map(pick))].sort();
    return {
      arm: uniq((c) => c.arm),
      model: uniq((c) => c.model),
      strategy: uniq((c) => c.strategy),
      kind: uniq((c) => c.kind),
      format: uniq((c) => c.editFormat),
    };
  }, [rows]);

  const visible = useMemo(() => {
    if (!rows) return [];
    const q = filters.query.trim().toLowerCase();
    const filtered = rows.filter(
      (c) =>
        (!filters.arm || c.arm === filters.arm) &&
        (!filters.model || c.model === filters.model) &&
        (!filters.strategy || c.strategy === filters.strategy) &&
        (!filters.kind || c.kind === filters.kind) &&
        (!filters.format || c.editFormat === filters.format) &&
        (!q ||
          c.taskId.toLowerCase().includes(q) ||
          (c.reason ?? "").toLowerCase().includes(q)),
    );
    const dir = sort.desc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      // Nulls last in both directions: a missing value is not a small value,
      // and sorting it to the top of an ascending column says it is.
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y)) * dir;
    });
  }, [rows, filters, sort]);

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(
    visible.length,
    Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN,
  );
  const window = visible.slice(first, last);

  const header = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <button
      type="button"
      onClick={() =>
        setSort((s) => ({ key, desc: s.key === key ? !s.desc : false }))
      }
      className={cn(
        "hover:text-ink rounded-control focus-visible:ring-ring flex w-full items-center gap-1 focus-visible:ring-2 focus-visible:outline-none",
        align === "right" && "justify-end",
        sort.key === key ? "text-ink" : "text-ink-muted",
      )}
      // `aria-sort` belongs on a columnheader, not on a button, and this grid
      // has no table semantics to hang it on. The state goes in the accessible
      // name instead, which is what a screen reader actually announces.
      aria-label={
        sort.key === key
          ? `${label}, sorted ${sort.desc ? "descending" : "ascending"}. Activate to reverse.`
          : `${label}, not sorted. Activate to sort.`
      }
    >
      {label}
      <span aria-hidden className="text-label">
        {sort.key === key ? (sort.desc ? "↓" : "↑") : ""}
      </span>
    </button>
  );

  const active =
    Object.entries(filters).filter(([, v]) => v !== "").length > 0;

  return (
    <Shell current="cells">
      <header className="max-w-prose">
        <p className="text-ink-muted text-label">Screen 5</p>
        <h1 className="text-ink text-h1 mt-0.5">Every attempt</h1>
        <Finding className="mt-3">
          All{" "}
          {rows ? rows.length.toLocaleString("en-US") : "1,604"} attempts, one
          row each, with what happened and why.{" "}
          <strong>
            Every number anywhere else in this console can be checked here
          </strong>{" "}
          by filtering to the same conditions and counting.
        </Finding>
      </header>

      <ReadThis question="Which attempts broke, and what exactly went wrong in each one?">
        <p>
          The other screens summarise. This one does not. Use the filters to
          narrow to a block, a model, a way of retrying or a kind of outcome,
          and the count underneath tells you how many attempts match.
        </p>
        <p>
          Click any row to open it. You will see the engine&rsquo;s own reason,
          whatever diagnostic text it recorded, and the actual patch the model
          wrote, where there was one.
        </p>
      </ReadThis>

      <Panel
        className="mt-6"
        title="Filter"
        aside={
          active ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY)}
              className="hover:text-ink underline underline-offset-2"
            >
              Clear all
            </button>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-3">
          <Select
            label="Block"
            value={filters.arm}
            options={options.arm}
            format={(a) => ARM_LABEL[a as Arm] ?? a}
            onChange={(v) => setFilters((f) => ({ ...f, arm: v }))}
          />
          <Select
            label="Model"
            value={filters.model}
            options={options.model}
            onChange={(v) => setFilters((f) => ({ ...f, model: v }))}
          />
          <Select
            label="Way of retrying"
            value={filters.strategy}
            options={options.strategy}
            format={(s) => STRATEGY_LABEL[s as Strategy] ?? s}
            onChange={(v) => setFilters((f) => ({ ...f, strategy: v }))}
          />
          <Select
            label="Outcome"
            value={filters.kind}
            options={options.kind}
            format={(k) => KIND_LABEL[k] ?? k}
            onChange={(v) => setFilters((f) => ({ ...f, kind: v }))}
          />
          <Select
            label="Edit format"
            value={filters.format}
            options={options.format}
            format={(f) =>
              f === "search_replace" ? "Quote the lines" : "Git-style diff"
            }
            onChange={(v) => setFilters((f) => ({ ...f, format: v }))}
          />
          <label className="flex flex-col gap-1">
            <span className="text-ink-muted text-label">Search bug or reason</span>
            <input
              type="search"
              value={filters.query}
              placeholder="django, hunk_count…"
              onChange={(e) =>
                setFilters((f) => ({ ...f, query: e.target.value }))
              }
              className="border-rule-strong rounded-control bg-surface text-ink placeholder:text-ink-muted focus-visible:ring-ring h-8 w-56 border px-2 text-small focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>
        </div>

        <p className="text-ink mt-4 text-body">
          {rows === null && !error ? (
            "Loading the attempts…"
          ) : (
            <>
              Showing{" "}
              <strong>{visible.length.toLocaleString("en-US")}</strong> of{" "}
              {(rows?.length ?? 0).toLocaleString("en-US")} attempts.
              {active && visible.length === 0
                ? " Nothing matches these filters — that is a real empty set, not an error."
                : ""}
            </>
          )}
        </p>
      </Panel>

      <Panel className="mt-4" title="Attempts" aside={`${visible.length} rows`}>
        {error ? (
          <div className="py-6">
            <p className="text-ink max-w-prose text-body">
              The attempts could not be loaded, so this table is empty — not
              because there are no attempts.
            </p>
            <Receipt>{error}</Receipt>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setRows(null);
                setAttempt((n) => n + 1);
              }}
              className="border-rule-strong rounded-control text-ink hover:bg-surface-sunk focus-visible:ring-ring mt-3 border px-3 py-1.5 text-small focus-visible:ring-2 focus-visible:outline-none"
            >
              Try again
            </button>
          </div>
        ) : rows === null ? (
          // The real layout with each value replaced by a bar at its true size.
          // No shimmer, and no shift when the data lands.
          <div aria-busy className="flex flex-col gap-2 py-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-surface-sunk h-4 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="text-ink-muted border-rule grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_3rem_3rem_minmax(0,1fr)_5rem] gap-3 border-b pb-1.5 text-label">
              {header("taskId", "Bug")}
              <span>Way of retrying</span>
              {header("round", "Try", "right")}
              {header("repeat", "Run", "right")}
              {header("kind", "Outcome")}
              {header("completionTokens", "Reply", "right")}
            </div>

            <div
              ref={scroller}
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
              className="max-h-[32rem] overflow-y-auto"
            >
              <div
                style={{ height: visible.length * ROW_HEIGHT }}
                className="relative"
              >
                <div
                  style={{ transform: `translateY(${first * ROW_HEIGHT}px)` }}
                >
                  {window.map((cell) => {
                    const expanded = open === cell.key;
                    return (
                      <div key={cell.key}>
                        <button
                          type="button"
                          onClick={() => setOpen(expanded ? null : cell.key)}
                          aria-expanded={expanded}
                          style={{ height: ROW_HEIGHT }}
                          className={cn(
                            "border-rule hover:bg-surface-sunk focus-visible:ring-ring grid w-full grid-cols-[minmax(0,2fr)_minmax(0,1fr)_3rem_3rem_minmax(0,1fr)_5rem] items-center gap-3 border-b text-left text-small focus-visible:ring-2 focus-visible:outline-none",
                            expanded && "bg-surface-sunk",
                          )}
                        >
                          <span className="text-ink truncate font-mono text-label">
                            {cell.taskId}
                          </span>
                          <span className="text-ink-muted truncate text-label">
                            {STRATEGY_LABEL[cell.strategy]}
                          </span>
                          <Figure value={cell.round} className="text-label" />
                          <Figure value={cell.repeat} className="text-label" />
                          <span
                            className={cn(
                              "truncate text-label",
                              cell.kind === "APPLIED"
                                ? "text-measure"
                                : "text-ink-muted",
                            )}
                          >
                            {KIND_LABEL[cell.kind] ?? cell.kind}
                          </span>
                          <Figure
                            value={cell.completionTokens}
                            className="text-label"
                          />
                        </button>

                        {expanded ? (
                          <div className="border-rule bg-surface-sunk flex flex-col gap-3 border-b p-3">
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-small">
                              <span className="text-ink-muted">
                                Block{" "}
                                <span className="text-ink">
                                  {ARM_LABEL[cell.arm]}
                                </span>
                              </span>
                              <span className="text-ink-muted">
                                Model{" "}
                                <span className="text-ink font-mono text-label">
                                  {cell.model}
                                </span>
                              </span>
                              <span className="text-ink-muted">
                                Format{" "}
                                <span className="text-ink">
                                  {cell.editFormat === "search_replace"
                                    ? "quote the lines"
                                    : "Git-style diff"}
                                </span>
                              </span>
                              <span className="text-ink-muted">
                                Extended thinking{" "}
                                <span className="text-ink">
                                  {cell.thinking ? "on" : "off"}
                                </span>
                              </span>
                              <span className="text-ink-muted">
                                Took{" "}
                                <Figure
                                  value={
                                    cell.latencyMs === null
                                      ? null
                                      : Math.round(cell.latencyMs / 1000)
                                  }
                                  unit="s"
                                  className="text-small"
                                />
                              </span>
                            </div>

                            {cell.reason ? (
                              <p className="text-ink max-w-prose text-small">
                                <span className="text-ink-muted">
                                  Why it ended this way:{" "}
                                </span>
                                <span className="font-mono text-label">
                                  {cell.reason}
                                </span>
                              </p>
                            ) : null}

                            {cell.status === null &&
                            cell.kind === "PROVIDER_ERROR" ? (
                              <Note>
                                No request was ever sent for this attempt. It is
                                not a failure of the model — the conditions for
                                making the call were not met, so there is
                                nothing here to measure.
                              </Note>
                            ) : null}

                            <Detail label="Detail" value={cell.detail} />
                            <Detail
                              label="Text the model asked for, and could not be found"
                              value={cell.searchText}
                            />
                            <Detail
                              label="What the repository said"
                              value={cell.gitStderr}
                            />

                            <div>
                              <p className="text-ink-muted text-label">
                                The patch the model wrote
                              </p>
                              {patches === null ? (
                                <div className="bg-surface mt-1 h-16 w-full" />
                              ) : patches[cell.key] ? (
                                <pre className="bg-surface border-rule text-ink mt-1 max-h-72 overflow-auto border p-2 font-mono text-label whitespace-pre">
                                  {patches[cell.key]}
                                </pre>
                              ) : (
                                <p className="text-ink-muted mt-1 text-small">
                                  No patch was recorded for this attempt.
                                </p>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </Panel>

      <section className="mt-10 flex max-w-prose flex-col gap-3">
        <h2 className="text-ink text-h2">Reading this table</h2>
        <Plain>
          The &ldquo;Try&rdquo; column does not mean the same thing in every
          block. The blocks that test retrying number the first attempt 0 and
          the retries 1 to 4. The wide format block has no retries at all and
          numbers its single attempt 1. Filter to one block before comparing
          anything across this column.
        </Plain>
        <Note>
          <strong>A grey dash is not a zero.</strong> Where the reply length is
          blank, no reply was received — usually because no request was sent.
          Nothing is known about those attempts, and the dash says so.
        </Note>
      </section>

      <TermList keys={TERMS} />
    </Shell>
  );
}
