import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The persistent instrument rail: navigation, context, and a slot.
 *
 * The slot is why the rail is a component rather than a layout file. The
 * G/r/h sliders live in it on the stopping-rule screen and NOWHERE else,
 * because the other five screens show measured data that no cost parameter can
 * move. A rail with live-looking sliders on a screen where they change nothing
 * is a control that lies about the instrument -- the same species of lie R1-R3
 * exist to prevent. Real instruments change their control panel with the mode.
 */

export type ScreenId =
  | "overview"
  | "recovery"
  | "edit-format"
  | "failure-classes"
  | "cells"
  | "stopping-rule";

/**
 * `typedRoutes` is on, so href is Link's own href type rather than a string --
 * a route that does not exist is a build error, which is what we want from a
 * nav that must never walk a reader into a blank page.
 */
type Href = React.ComponentProps<typeof Link>["href"];
type Entry = { id: ScreenId; label: string; href: Href; built: boolean };

/**
 * `built: false` renders as a disabled item rather than a link. A static export
 * has no 404 handler worth the name, and a nav that walks a professor into a
 * blank page costs more trust than an obviously unfinished one.
 */
export const SCREENS: Entry[] = [
  { id: "overview", label: "Overview", href: "/", built: true },
  { id: "recovery", label: "Recovery", href: "/recovery", built: true },
  { id: "edit-format", label: "Edit format", href: "/edit-format", built: true },
  {
    id: "failure-classes",
    label: "Failure classes",
    href: "/failure-classes",
    built: true,
  },
  { id: "cells", label: "Cells", href: "/cells", built: true },
  {
    id: "stopping-rule",
    label: "Stopping rule",
    href: "/stopping-rule",
    built: true,
  },
];

export function Rail({
  current,
  children,
}: {
  current: ScreenId;
  /** The screen-aware control slot. Omitted on screens with nothing to control. */
  children?: React.ReactNode;
}) {
  return (
    <nav
      aria-label="Screens"
      className="border-rule bg-surface flex w-full shrink-0 flex-col gap-6 border-b px-4 py-4 lg:h-dvh lg:w-60 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-4 lg:py-5"
    >
      <div>
        <p className="text-ink text-h2">Recovery console</p>
        <p
          className="text-ink-muted mt-0.5 text-label"
          style={{ fontVariationSettings: '"wdth" 85' }}
        >
          When should an agent stop retrying?
        </p>
      </div>

      <ol className="flex flex-wrap gap-x-4 gap-y-1 lg:flex-col lg:gap-x-0">
        {SCREENS.map((entry) => {
          const active = entry.id === current;
          const className = cn(
            "flex items-baseline gap-2 py-1 text-small",
            active ? "text-ink font-medium" : "text-ink-muted",
            !entry.built && "cursor-not-allowed",
          );
          return (
            <li key={entry.id}>
              {entry.built ? (
                <Link
                  href={entry.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(className, "hover:text-ink rounded-control")}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-1 w-1 shrink-0",
                      active ? "bg-measure" : "bg-transparent",
                    )}
                  />
                  {entry.label}
                </Link>
              ) : (
                <span className={className} aria-disabled>
                  <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0" />
                  {entry.label}
                  <span className="text-ink-muted text-label">not built</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {children ? (
        <div className="border-rule flex flex-col gap-5 border-t pt-5">
          {children}
        </div>
      ) : null}
    </nav>
  );
}

/** The page frame. Rail beside a single scrolling canvas. */
export function Shell({
  current,
  rail,
  children,
}: {
  current: ScreenId;
  rail?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/*
       * The skip link. Six screens share a rail of six links, so a keyboard
       * reader otherwise tabs through the same six before reaching the content
       * on every single screen. Visually hidden until focused, then it lands
       * on top of the rail rather than shifting the layout.
       */}
      <a
        href="#content"
        className="bg-surface border-rule-strong text-ink rounded-control sr-only z-50 border px-3 py-2 text-small focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
      >
        Skip to the screen
      </a>
      <Rail current={current}>{rail}</Rail>
      <main
        id="content"
        // Focusable so the skip link actually moves focus, not just the
        // viewport: -1 keeps it out of the tab order otherwise.
        tabIndex={-1}
        className="min-w-0 flex-1 px-4 py-8 focus-visible:outline-none lg:px-10 lg:py-10"
      >
        {/*
         * Capped for the room, not the phone. This is shown on a laptop and
         * through a projector, so the floor is fine -- the grids all use
         * minmax(0,…) and collapse to one column under 1280. The ceiling is
         * the real risk: on a 27" monitor an uncapped two-column grid gives
         * each panel 1,100px, and a chart that wide reads as decoration.
         */}
        <div className="mx-auto w-full max-w-[96rem]">{children}</div>
      </main>
    </div>
  );
}
