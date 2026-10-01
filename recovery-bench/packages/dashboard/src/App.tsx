/**
 * The shell.
 *
 * Reading order is the argument: the question and its answer first, then the
 * two numbers that are the answer, then — for anyone who wants to check it —
 * the attempts those numbers came from. The controls sit beside the evidence,
 * not above the finding, because a reader who has not been told what the study
 * found has no reason to filter anything.
 *
 * Two datasets, switched rather than merged. `replay_rows.json` is the
 * submitted study: test-verified, committed, always present. `sweep_rows.jsonl`
 * is new output, apply-verified, and gitignored, so on a fresh clone it is
 * simply not there. The switch makes that a visible state instead of a silent
 * difference in what the numbers mean.
 *
 * Derived data is computed during render. No effect writes filtered rows into
 * state — the one `vercel-react-best-practices` rule with real teeth here,
 * since a filter change would otherwise render twice and could render stale
 * rows in between.
 */

import { useEffect, useMemo, useState } from "react";
import { apply, EMPTY_FILTER, type Filter } from "./model/filter.ts";
import { loadDataset, type Dataset } from "./model/load.ts";
import { PANEL_NOTE, SOURCE_NOTE } from "./model/narrative.ts";
import { countByOutcome, type ViewRow } from "./model/rows.ts";
import { Empty, Panel, ThemeToggle, type Theme } from "./ui/primitives.tsx";
import { Detail } from "./views/Detail.tsx";
import { FilterRail } from "./views/FilterRail.tsx";
import { FormatBars } from "./views/FormatBars.tsx";
import { GridView } from "./views/GridView.tsx";
import { Hero } from "./views/Hero.tsx";
import { Legend } from "./views/Legend.tsx";
import { Pipeline } from "./views/Pipeline.tsx";
import { Retrofit } from "./views/Retrofit.tsx";
import { SubTests } from "./views/SubTests.tsx";

type SourceKey = "replay" | "sweep";

const THEME_KEY = "rb-theme";

function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    // localStorage throws in a private window and can come back empty. A
    // remembered theme is a convenience, so every read is guarded and the page
    // renders correctly without it.
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === "light" || v === "dark" ? v : "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      if (theme === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Blocked site data. The attribute above still applied for this session.
    }
  }, [theme]);

  return [theme, setTheme];
}

export default function App() {
  const [theme, setTheme] = useTheme();
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<SourceKey>("replay");
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [selected, setSelected] = useState<ViewRow | null>(null);

  useEffect(() => {
    let live = true;
    loadDataset()
      .then((d) => {
        if (!live) return;
        setData(d);
        if (d.sweepPresent && d.sweep.length > 0) setSource("sweep");
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      live = false;
    };
  }, []);

  const all = useMemo<ViewRow[]>(
    () => (data === null ? [] : source === "sweep" ? data.sweep : data.replay),
    [data, source],
  );
  const rows = useMemo(() => apply(all, filter), [all, filter]);
  const counts = useMemo(() => countByOutcome(rows), [rows]);

  // A selection from the other dataset would be a row no longer on screen.
  useEffect(() => {
    setSelected(null);
    setFilter(EMPTY_FILTER);
  }, [source]);

  if (error !== null) {
    return (
      <main className="mx-auto max-w-[70ch] p-6">
        <h1 className="t-section mb-3">recovery-bench</h1>
        <Empty
          heading="The committed data could not be read"
          detail={`${error}. The data files are copied into the dashboard by its sync step, which runs automatically before dev and build.`}
          command="bun run sync"
        />
      </main>
    );
  }

  if (data === null) {
    return (
      <main className="mx-auto max-w-[70ch] p-6">
        <p className="t-caption">Reading the committed rows…</p>
      </main>
    );
  }

  const sweepEmpty = source === "sweep" && data.sweep.length === 0;
  const note = SOURCE_NOTE[source];

  return (
    <div className="mx-auto max-w-[var(--page-max)] px-4 pb-10 sm:px-6">
      {/* The question and the answer. Before any control. */}
      <div className="pt-5 pb-6">
        <Hero figures={data.figures} />
      </div>

      {/* Everything below is the evidence, and says so. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-rule pt-5">
        <div>
          <h2 className="t-section">The attempts behind those numbers</h2>
          <p className="t-caption m-0 max-w-[62ch]">{note.note}</p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex gap-0.5 rounded-control border border-edge p-0.5" role="group" aria-label="Which set of attempts to show">
            {(
              [
                ["replay", SOURCE_NOTE.replay.title, data.replay.length],
                ["sweep", SOURCE_NOTE.sweep.title, data.sweep.length],
              ] as const
            ).map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                aria-pressed={source === key}
                onClick={() => setSource(key)}
                className={`cursor-pointer rounded-[4px] px-3 py-1.5 text-[13px] font-semibold ${
                  source === key
                    ? "bg-accent text-on-accent"
                    : "bg-transparent text-ink-soft"
                }`}
              >
                {label}
                <span className="ml-2 opacity-70">{n.toLocaleString()}</span>
              </button>
            ))}
          </div>
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
      </div>

      {data.sweepSkipped > 0 && (
        <p
          className="mb-4 rounded-control px-3 py-2 text-[13px]"
          style={{ background: "var(--format-soft)", color: "var(--format-ink)" }}
        >
          {data.sweepSkipped} {data.sweepSkipped === 1 ? "line" : "lines"} of the sweep
          file would not parse and {data.sweepSkipped === 1 ? "was" : "were"} skipped. A
          torn final line is the expected result of stopping a sweep mid-write.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[var(--rail)_minmax(0,1fr)]">
        <aside className="panel h-max lg:sticky lg:top-4">
          <div className="panel__body">
            <FilterRail all={all} filter={filter} onChange={setFilter} />
            <hr className="my-5 border-0 border-t border-rule" />
            <h3 className="t-section mb-1 text-[15px]">How an attempt ended</h3>
            <p className="t-caption mb-3">
              Nine outcomes, grouped by what each one tells you.
            </p>
            <Legend counts={counts} />
          </div>
        </aside>

        <main className="flex min-w-0 flex-col gap-5">
          {sweepEmpty ? (
            <Panel
              title="No new runs on this machine"
              note="Sweep results are per-run experimental output, so they are not committed."
              id="no-sweep"
            >
              <Empty
                heading="Nothing has been swept here yet"
                detail="A fresh clone has no sweep results — they are not committed, because they are new output rather than a derived record. This is not zero attempts: it is no attempts. The submitted study beside it is always present."
                command="bun run sweep --run --yes"
              />
            </Panel>
          ) : (
            <>
              <Panel
                title="Where attempts stop"
                note={
                  selected === null
                    ? PANEL_NOTE.pipeline
                    : "The single attempt selected in the grid, and how far it got."
                }
                id="pipeline"
              >
                <Pipeline rows={rows} selected={selected} />
              </Panel>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
                <Panel title="Every attempt" note={PANEL_NOTE.grid} id="grid">
                  <GridView
                    rows={rows}
                    selectedId={selected?.id ?? null}
                    onSelect={setSelected}
                  />
                </Panel>

                <Panel
                  title={selected === null ? "One attempt in full" : selected.taskLabel}
                  note={PANEL_NOTE.detail}
                  id="detail"
                >
                  {selected === null ? (
                    <Empty
                      heading="Nothing selected"
                      detail="Choose a square in the grid to see how that attempt ended, what evidence it was given, and the patch or response it produced."
                    />
                  ) : (
                    <Detail row={selected} onClose={() => setSelected(null)} />
                  )}
                </Panel>
              </div>

              <Panel
                title="Does the edit format change the outcome?"
                note={PANEL_NOTE.formats}
                id="formats"
              >
                <FormatBars rows={rows} />
              </Panel>
            </>
          )}

          <Panel
            title="How much moved on a task nobody solved"
            note={PANEL_NOTE.subtests}
            id="subtests"
          >
            <SubTests figures={data.figures} />
          </Panel>

          <Panel title="The clearest case" note={PANEL_NOTE.retrofit} id="retrofit">
            <Retrofit audit={data.audit} />
          </Panel>

          <footer className="t-caption px-1">
            <p className="m-0 max-w-[80ch]">
              Every number here is read from a committed file; nothing is computed in the
              browser beyond counting and filtering. The submitted study's rows were
              test-verified and carry FAIL_TO_PASS results. New runs were verified by
              applying the patch only, so whether they actually fixed anything is
              unknown — and is never guessed at.
            </p>
            {data.syncedAt !== null && (
              <p className="mt-1.5 mb-0">
                Data synced {new Date(data.syncedAt).toLocaleString()}.
              </p>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}
