"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, PanelEmpty } from "@/components/primitives/Panel";
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
import { Table } from "@/components/motion/table";
import type { SortState, TableColumn } from "@/components/motion/table/types";
import { CodeBlock } from "@/components/agents/code-block";
import { cn } from "@/lib/utils";
import { fetchCells, fetchPatches, type Cell } from "@/model/cells";
import {
  ARM_LABEL,
  STRATEGY_LABEL,
  type Arm,
  type Strategy,
} from "@/model/rows";
import type { TermKey } from "@/model/glossary";

/**
 * Screen 5 -- every attempt, as a list beside a detail pane.
 *
 * It was an inline-expanding full-width table and that was the wrong shape.
 * The row grid was `2fr 1fr 3rem 3rem 1fr 5rem`, so on a laptop the Bug column
 * alone was ~650px holding ~180px of text, and the reply length sat ~470px of
 * empty space away at the right edge. Connecting a row to its own number meant
 * crossing that gap by eye, and opening a row shoved 1,600 rows up and down
 * the page.
 *
 * Master-detail fixes all three at once: the list is narrow so nothing is
 * stranded, the far-right column is gone because reply length belongs beside
 * the patch it describes, and selecting a row changes only the pane.
 *
 * The table is @beui/table -- virtualised through @tanstack/react-virtual,
 * with sorting, column resize and reorder. Two of its props (`onRowClick`,
 * `activeRowId`) are a local addition; see its `types.ts`.
 *
 * What is deliberately NOT enabled: `editable`, `onInsertRow`, `onDeleteRow`,
 * `onColumnRename`. They are all opt-in, and a finished experiment that looks
 * editable implies the data can be changed. It cannot.
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

const ROW_HEIGHT = 34;
const TABLE_HEIGHT = 560;

const KIND_LABEL: Record<string, string> = {
  APPLIED: "Accepted",
  MALFORMED: "Unusable",
  APPLY_FAIL: "Rejected",
  TRUNCATED: "Cut off",
  NO_PATCH: "No edit",
  NO_OUTPUT: "Empty",
  PROVIDER_ERROR: "No answer",
};

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

export type CellsSnapshot = {
  /**
   * Row count from the build-time snapshot, so the heading is right before the
   * fetch resolves and does not hardcode 1,604.
   */
  rows: number;
  commit: string | null;
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
        className="border-rule-strong rounded-control bg-surface text-ink focus-visible:ring-ring hover:border-ink-muted h-8 cursor-pointer border px-2 text-small focus-visible:ring-2 focus-visible:outline-none"
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

/** One labelled fact in the detail pane. */
function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-rule flex items-baseline justify-between gap-3 border-b py-1.5">
      <span className="text-ink-muted shrink-0 text-label">{label}</span>
      <span className="text-ink text-right text-small">{children}</span>
    </div>
  );
}

/** A block of diagnostic text the engine recorded. */
function Diagnostic({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="text-ink-muted text-label">{label}</p>
      <pre className="bg-surface-sunk border-rule text-ink mt-1 max-h-48 overflow-auto border p-2 font-mono text-label whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

export function Cells({ snapshot }: { snapshot: CellsSnapshot }) {
  const [rows, setRows] = useState<Cell[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<SortState | null>({
    key: "taskId",
    direction: "asc",
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [patches, setPatches] = useState<Record<string, string> | null>(null);

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

  // The patch map, fetched on first selection and kept. 862 KB paid once.
  useEffect(() => {
    if (!activeId || patches) return;
    const controller = new AbortController();
    fetchPatches(controller.signal)
      .then(setPatches)
      .catch(() => setPatches({}));
    return () => controller.abort();
  }, [activeId, patches]);

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
    return rows.filter(
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
  }, [rows, filters]);

  const active = useMemo(
    () => visible.find((c) => c.key === activeId) ?? null,
    [visible, activeId],
  );

  const columns = useMemo<TableColumn<Cell>[]>(
    () => [
      {
        key: "taskId",
        header: "Bug",
        sortable: true,
        width: "230px",
        cell: (row) => (
          <span className="text-ink font-mono text-label">{row.taskId}</span>
        ),
      },
      {
        key: "strategy",
        header: "Way of retrying",
        sortable: true,
        width: "150px",
        cell: (row) => (
          <span className="text-ink-muted text-label">
            {STRATEGY_LABEL[row.strategy]}
          </span>
        ),
      },
      {
        key: "round",
        header: "Try",
        sortable: true,
        align: "right",
        width: "54px",
        cell: (row) => <Figure value={row.round} className="text-label" />,
      },
      {
        key: "repeat",
        header: "Run",
        sortable: true,
        align: "right",
        width: "54px",
        cell: (row) => <Figure value={row.repeat} className="text-label" />,
      },
      {
        key: "kind",
        header: "Outcome",
        sortable: true,
        width: "110px",
        cell: (row) => (
          <span
            className={cn(
              "text-label",
              row.kind === "APPLIED" ? "text-measure" : "text-ink-muted",
            )}
          >
            {KIND_LABEL[row.kind] ?? row.kind}
          </span>
        ),
      },
    ],
    [],
  );

  const anyFilter = Object.values(filters).some((v) => v !== "");

  return (
    <Shell current="cells">
      <header className="max-w-prose">
        <p className="text-ink-muted text-label">Screen 5</p>
        <h1 className="text-ink text-h1 mt-0.5">Every attempt</h1>
        <Finding className="mt-3">
          All {(rows?.length ?? snapshot.rows).toLocaleString("en-US")}{" "}
          attempts, one row each, with what happened and why.{" "}
          <strong>
            Every number anywhere else in this console can be checked here
          </strong>{" "}
          by filtering to the same conditions and counting.
        </Finding>
      </header>

      <ReadThis question="Which attempts broke, and what exactly went wrong in each one?">
        <p>
          The other screens summarise. This one does not. Narrow with the
          filters to a block, a model, a way of retrying or a kind of outcome,
          and the count tells you how many attempts match.
        </p>
        <p>
          <strong>Click any row</strong> and everything recorded about it
          appears on the right, including the patch the model actually wrote.
          Drag a column edge to resize it, or a column header to reorder.
        </p>
      </ReadThis>

      <Panel
        className="mt-6"
        title="Filter"
        aside={
          anyFilter ? (
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
            <span className="text-ink-muted text-label">
              Search bug or reason
            </span>
            <input
              type="search"
              value={filters.query}
              placeholder="django, hunk_count…"
              onChange={(e) =>
                setFilters((f) => ({ ...f, query: e.target.value }))
              }
              className="border-rule-strong rounded-control bg-surface text-ink placeholder:text-ink-muted focus-visible:ring-ring hover:border-ink-muted h-8 w-56 border px-2 text-small focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>
        </div>

        <p className="text-ink mt-4 text-body">
          {rows === null && !error ? (
            "Loading the attempts…"
          ) : (
            <>
              Showing <strong>{visible.length.toLocaleString("en-US")}</strong>{" "}
              of {(rows?.length ?? 0).toLocaleString("en-US")} attempts.
            </>
          )}
        </p>
      </Panel>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel title="Attempts" aside={`${visible.length} rows`}>
          {error ? (
            <div className="py-6" role="alert">
              <p className="text-ink max-w-prose text-body">
                The attempts could not be loaded, so this table is empty — not
                because there are no attempts. Every other screen on this site
                is unaffected: they were built from the same snapshot and do
                not need this file.
              </p>
              <p className="text-ink-muted mt-2 max-w-prose text-small">
                The snapshot it is trying to read holds{" "}
                {snapshot.rows.toLocaleString("en-US")} attempts, taken at
                commit{" "}
                <span className="font-mono">
                  {snapshot.commit?.slice(0, 7) ?? "unknown"}
                </span>
                .
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
          ) : (
            <div className="-mx-3 -mb-3">
              <Table
                data={visible}
                columns={columns}
                getRowId={(row) => row.key}
                sort={sort}
                onSortChange={setSort}
                resizable
                reorderable
                rowHeight={ROW_HEIGHT}
                height={TABLE_HEIGHT}
                loading={rows === null}
                skeletonRows={14}
                onRowClick={(_row, id) => setActiveId(id)}
                activeRowId={activeId}
                emptyState={
                  <span className="text-ink-muted text-small">
                    No attempt matches these filters. That is a real empty set —
                    the combination you picked was never run — not a failure to
                    load.
                  </span>
                }
              />
            </div>
          )}
        </Panel>

        <Panel
          className="xl:sticky xl:top-4"
          title={active ? "This attempt" : "Detail"}
          aside={
            active ? (
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="hover:text-ink underline underline-offset-2"
              >
                Close
              </button>
            ) : null
          }
        >
          {!active ? (
            <PanelEmpty>
              Select a row to see everything recorded about that attempt — what
              the engine said went wrong, the diagnostic text it kept, and the
              patch the model actually wrote.
            </PanelEmpty>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-ink font-mono text-small">{active.taskId}</p>
                <p className="text-ink-muted mt-0.5 text-label">
                  {ARM_LABEL[active.arm]} · {STRATEGY_LABEL[active.strategy]}
                </p>
              </div>

              <div>
                <Fact label="Outcome">
                  <span
                    className={
                      active.kind === "APPLIED"
                        ? "text-measure"
                        : "text-ink-muted"
                    }
                  >
                    {KIND_LABEL[active.kind] ?? active.kind}
                  </span>
                </Fact>
                <Fact label="Try / run">
                  <Figure value={active.round} className="text-small" /> /{" "}
                  <Figure value={active.repeat} className="text-small" />
                </Fact>
                <Fact label="Model">
                  <span className="font-mono text-label">{active.model}</span>
                </Fact>
                <Fact label="Edit format">
                  {active.editFormat === "search_replace"
                    ? "quote the lines"
                    : "Git-style diff"}
                </Fact>
                <Fact label="Extended thinking">
                  {active.thinking ? "on" : "off"}
                </Fact>
                <Fact label="Reply length">
                  <Figure
                    value={active.completionTokens}
                    unit="tokens"
                    className="text-small"
                  />
                </Fact>
                <Fact label="Took">
                  <Figure
                    value={
                      active.latencyMs === null
                        ? null
                        : Math.round(active.latencyMs / 1000)
                    }
                    unit="s"
                    className="text-small"
                  />
                </Fact>
              </div>

              {active.reason ? (
                <p className="text-ink max-w-prose text-small">
                  <span className="text-ink-muted">
                    Why it ended this way:{" "}
                  </span>
                  <span className="font-mono text-label">{active.reason}</span>
                </p>
              ) : null}

              {active.status === null && active.kind === "PROVIDER_ERROR" ? (
                <Note>
                  No request was ever sent for this attempt. It is not a failure
                  of the model — the conditions for making the call were not
                  met, so there is nothing here to measure.
                </Note>
              ) : null}

              <Diagnostic label="Detail" value={active.detail} />
              <Diagnostic
                label="Text the model asked for, and could not be found"
                value={active.searchText}
              />
              <Diagnostic
                label="What the repository said"
                value={active.gitStderr}
              />

              <div>
                <p className="text-ink-muted text-label">
                  The patch the model wrote
                </p>
                {patches === null ? (
                  <div className="bg-surface-sunk mt-1 h-24 w-full" />
                ) : patches[active.key] ? (
                  <CodeBlock
                    className="mt-1"
                    code={patches[active.key]!}
                    // `diff` only colours a real unified diff. A search_replace
                    // block is not one, and highlighting it as a diff would
                    // paint arbitrary lines red and green -- inventing
                    // additions and deletions that are not there.
                    language={
                      active.editFormat === "unified_diff" ? "diff" : "text"
                    }
                    showLineNumbers
                    maxHeight={320}
                    copyable
                  />
                ) : (
                  <p className="text-ink-muted mt-1 text-small">
                    No patch was recorded for this attempt.
                  </p>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>

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
          <strong>A grey dash is not a zero.</strong> Where reply length is
          blank, no reply was received — usually because no request was sent.
          Nothing is known about those attempts, and the dash says so.
        </Note>
      </section>

      <TermList keys={TERMS} />
    </Shell>
  );
}
