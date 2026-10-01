/**
 * The small shared pieces. Nothing here knows about the experiment.
 *
 * `Track` is the one carrying a rule: a zero value draws no fill, and the
 * dashed border showing the denominator is always present. ARCHITECTURE §7
 * requires both, after thesis figure 5.2 shipped once without the second.
 */

import type { ReactNode } from "react";
import { GLOSSARY } from "../model/narrative.ts";

/**
 * A panel with a tinted header, a title and a plain-language note.
 *
 * `note` is not optional by accident. Every panel in the first build carried a
 * terse label and nothing else, and a reader had to already know the project to
 * tell what they were looking at.
 */
export function Panel({
  title,
  note,
  right,
  children,
  id,
}: {
  title: string;
  note: string;
  right?: ReactNode;
  children: ReactNode;
  id: string;
}) {
  return (
    <section className="panel" aria-labelledby={`${id}-h`} id={id}>
      <header className="panel__head">
        <h2 id={`${id}-h`} className="t-section">
          {title}
        </h2>
        {right !== undefined && <div className="ml-auto">{right}</div>}
        <p className="t-caption m-0 w-full max-w-[86ch] basis-full">{note}</p>
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}

/**
 * A working term with its definition attached.
 *
 * Underlined, focusable, and carrying the definition as a `title` so it is
 * reachable by keyboard and by pointer. Jargon is allowed on screen only
 * through this component — if a word is not in the glossary it should not be
 * one of this project's private words.
 */
export function Term({ children, of }: { children: ReactNode; of: keyof typeof GLOSSARY | string }) {
  const def = GLOSSARY[of];
  if (def === undefined) return <>{children}</>;
  return (
    <button
      type="button"
      title={def}
      aria-label={`${String(of)}: ${def}`}
      className="cursor-help border-0 bg-transparent p-0 font-[inherit] text-[inherit] underline decoration-dotted decoration-from-font underline-offset-2"
      style={{ textDecorationColor: "var(--edge)" }}
    >
      {children}
    </button>
  );
}

/**
 * A bar with a visible denominator.
 *
 * `value === 0` renders no fill at all, deliberately — a 1px stub reads as "a
 * small amount" when the truth is "none", and that misreading is exactly what
 * figure 5.2 had to be corrected for.
 */
export function Track({
  value,
  total,
  fill = "var(--accent)",
  label,
}: {
  value: number;
  total: number;
  fill?: string;
  label: string;
}) {
  const pct = total <= 0 ? 0 : Math.max(0, Math.min(1, value / total)) * 100;
  return (
    <div
      className="track"
      role="img"
      aria-label={`${label}: ${value} of ${total}`}
      style={{ ["--bar-fill" as string]: fill }}
    >
      {value > 0 && <div className="track__fill" style={{ width: `${pct}%` }} />}
    </div>
  );
}

/** Light/dark/system, persisted. Three states, because "system" is a real answer. */
export type Theme = "system" | "light" | "dark";

export function ThemeToggle({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (t: Theme) => void;
}) {
  const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
  const label: Record<Theme, string> = {
    system: "Theme: follows your system",
    light: "Theme: light",
    dark: "Theme: dark",
  };
  const glyph: Record<Theme, string> = { system: "◐", light: "○", dark: "●" };
  return (
    <button
      type="button"
      onClick={() => onChange(next[theme])}
      title={label[theme]}
      aria-label={label[theme]}
      className="grid h-9 w-9 cursor-pointer place-items-center rounded-control border border-edge bg-surface text-ink"
    >
      <span aria-hidden="true">{glyph[theme]}</span>
    </button>
  );
}

/**
 * Chart / table switch.
 *
 * Every chart in this dashboard has a table view. Not a nicety: a bar is not
 * readable by a screen reader or by anyone who needs the exact number, and
 * ARCHITECTURE §7 makes it non-negotiable.
 */
export function ViewSwitch({
  view,
  onChange,
  idBase,
}: {
  view: "chart" | "table";
  onChange: (v: "chart" | "table") => void;
  idBase: string;
}) {
  return (
    <div
      className="flex gap-0.5 rounded-control border border-edge p-0.5"
      role="group"
      aria-label="How to show this data"
    >
      {(["chart", "table"] as const).map((v) => (
        <button
          key={v}
          type="button"
          id={`${idBase}-${v}`}
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={`cursor-pointer rounded-[4px] px-2.5 py-1 text-[12px] font-semibold ${
            view === v ? "bg-accent text-on-accent" : "bg-transparent text-ink-soft"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/**
 * What a view shows when its data is not there.
 *
 * Takes the command that would fill it. An empty screen is an invitation to
 * act — and, more to the point here, showing a zero instead would be a lie
 * about a cell that was never run.
 */
export function Empty({
  heading,
  detail,
  command,
}: {
  heading: string;
  detail: string;
  command?: string;
}) {
  return (
    <div className="rounded-panel border border-dashed border-edge px-5 py-8 text-center">
      <p className="m-0 text-[15px] font-bold">{heading}</p>
      <p className="t-caption mx-auto mt-1.5 mb-0 max-w-[52ch]">{detail}</p>
      {command !== undefined && (
        <code className="mt-4 inline-block rounded-control bg-surface-2 px-3 py-1.5 text-[13px]">
          {command}
        </code>
      )}
    </div>
  );
}

export function Pill({
  children,
  tone = "soft",
}: {
  children: ReactNode;
  tone?: "soft" | "format" | "logic" | "accent";
}) {
  const cls =
    tone === "format"
      ? "bg-format-soft text-format-ink"
      : tone === "logic"
        ? "bg-logic-soft text-logic-ink"
        : tone === "accent"
          ? "bg-accent-soft text-accent-ink"
          : "bg-surface-2 text-ink-soft";
  return (
    <span className={`inline-block rounded-chip px-2 py-0.5 text-[12px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

/**
 * A fact stated at a size that matches its importance.
 *
 * Used where a number would otherwise be lost in a caption — the count of
 * attempts that measured nothing, for instance, which in the first build was
 * 74% of the view and rendered in 11px grey.
 */
export function Callout({
  tone,
  children,
}: {
  tone: "neutral" | "warn";
  children: ReactNode;
}) {
  return (
    <p
      className="m-0 rounded-control px-3 py-2 text-[13px] leading-snug"
      style={
        tone === "warn"
          ? { background: "var(--format-soft)", color: "var(--format-ink)" }
          : { background: "var(--surface-2)", color: "var(--ink-soft)" }
      }
    >
      {children}
    </p>
  );
}
