"use client";

import { useState } from "react";
import { Panel, PanelEmpty } from "@/components/primitives/Panel";
import { Figure } from "@/components/primitives/Figure";
import { Rule } from "@/components/primitives/Rule";
import { Finding } from "@/components/primitives/Finding";
import { Note, Illustrative } from "@/components/primitives/Note";
import { Slider } from "@/components/primitives/Slider";
import {
  ClassMark,
  ClassMarkDefs,
  FAILURE_CLASSES,
  CLASS_MEANING,
  classFill,
  classStroke,
} from "@/components/primitives/ClassMark";

/**
 * The seven primitives, on one screen, with real values from the sweep.
 *
 * This page is the Phase 1 acceptance test and it stays in the app afterwards:
 * when a screen looks wrong later, the question is always whether the primitive
 * is wrong or the usage is, and that is only answerable if the primitives are
 * visible somewhere on their own.
 */
export default function Primitives() {
  const [h, setH] = useState(12);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      <ClassMarkDefs />

      <h1 className="text-display text-ink">Primitives</h1>
      <p className="text-ink-muted mt-2 max-w-prose text-body">
        Seven components and nothing else. Every screen in the console is built
        from these, so anything that cannot be said with them is either a new
        primitive or a sign the screen is trying to do too much.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {/* ── Figure ─────────────────────────────────────────────── */}
        <Panel title="Figure" aside="the only way a number renders">
          <dl data-figures className="space-y-1.5">
            {(
              [
                ["Cells", 1604, undefined],
                ["Calls", 1428, undefined],
                ["Tokens", 18102295, undefined],
                ["Apply rate, search_replace", "96.4", "%"],
                ["Apply rate, unified_diff", "13.1", "%"],
                ["Resolved", null, undefined],
              ] as const
            ).map(([label, value, unit]) => (
              <div key={label} className="flex items-baseline justify-between gap-4">
                <dt className="text-small text-ink-muted">{label}</dt>
                <dd>
                  <Figure value={value} unit={unit} />
                </dd>
              </div>
            ))}
          </dl>
          <Note className="mt-4">
            Resolved is a dash, not a zero. Nothing in the live sweep measured
            whether a bug was fixed — only whether a patch applied.
          </Note>
        </Panel>

        {/* ── Rule ───────────────────────────────────────────────── */}
        <Panel title="Rule" aside="a hairline that carries a value">
          <div className="space-y-4 py-2">
            <Rule label="discordant pairs" value={19} />
            <Rule label="rejection floor" value={6} variant="reference" />
            <Rule label="θ logic" value="0.08" />
          </div>
          <p className="text-ink-muted mt-3 max-w-prose text-small">
            A divider between two blocks is a border. This is for a line that
            marks a number — a scale, a baseline, a floor the data has to clear.
          </p>
        </Panel>

        {/* ── ClassMark ──────────────────────────────────────────── */}
        <Panel
          title="ClassMark"
          aside="value + texture, never hue"
          className="sm:col-span-2"
        >
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {FAILURE_CLASSES.map((cls) => (
              <div key={cls} className="flex items-baseline gap-2">
                <ClassMark cls={cls} />
                <span className="text-ink-muted text-small">
                  {CLASS_MEANING[cls]}
                </span>
              </div>
            ))}
          </div>

          {/* The marks at the size the cell grid will draw them. */}
          <svg
            className="mt-5"
            width="100%"
            height={56}
            role="img"
            aria-label="The four class marks at grid size"
            style={{ shapeRendering: "crispEdges" }}
          >
            {FAILURE_CLASSES.map((cls, i) => (
              <rect
                key={cls}
                x={i * 68}
                y={0}
                width={60}
                height={56}
                fill={classFill(cls)}
                stroke={classStroke(cls)}
                strokeWidth={1}
              />
            ))}
          </svg>

          <Note className="mt-4">
            Broken is greyscale on purpose. It measures the instrument rather
            than the model, and a mark in the accent hue would invite it to be
            counted as a failure of the condition.
          </Note>
        </Panel>

        {/* ── Finding ────────────────────────────────────────────── */}
        <Panel title="Finding" aside="the screen's conclusion" className="sm:col-span-2">
          <Finding stat="b = 19 · c = 0 · n = 60 · p = 3.8e-6">
            <strong>Reflection helps once, then poisons.</strong> There are 19
            cells where blind retry applied and reflection did not, and none the
            other way, across all four tasks with no reversals.
          </Finding>
        </Panel>

        {/* ── Slider ─────────────────────────────────────────────── */}
        <Panel title="Slider" aside="screen 6 only">
          <Slider
            id="demo-h"
            label="h"
            description="cost of asking a human"
            value={h}
            onValueChange={setH}
            min={0}
            max={40}
            ticks={[0, 20, 40]}
          />
          <p className="text-ink-muted mt-4 max-w-prose text-small">
            Drag it, or focus it and use the arrow keys. On the five screens that
            show measured data there is nothing for this to move, so it is not
            there.
          </p>
        </Panel>

        {/* ── Panel, empty + Illustrative ────────────────────────── */}
        <div className="space-y-6">
          <Panel title="Panel, empty" aside="0 records">
            <PanelEmpty>
              Broken has no records. Every instrument limit in this study removed
              the cell from disk instead of recording itself, so the class that
              exists to keep unmeasured attempts out of the failure counts has
              nothing to hold.
            </PanelEmpty>
          </Panel>

          <Panel title="Illustrative">
            <div
              aria-hidden
              className="bg-surface-sunk border-rule h-16 border"
            />
            <Illustrative className="mt-2" />
          </Panel>
        </div>
      </div>

      <Rule className="mt-12" label="phase 1" value="tokens and primitives" />
    </main>
  );
}
