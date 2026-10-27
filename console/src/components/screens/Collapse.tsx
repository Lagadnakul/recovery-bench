import { Panel } from "@/components/primitives/Panel";
import { Figure } from "@/components/primitives/Figure";
import { Finding } from "@/components/primitives/Finding";
import { Note } from "@/components/primitives/Note";
import { Shell } from "@/components/shell/Rail";
import { SlopeChart, type Series } from "@/components/marks/SlopeChart";
import { PairStrip, PairStripLegend, type PairTest } from "@/components/marks/PairStrip";

/**
 * Screen 2 -- the collapse.
 *
 * One question: does asking a model to reflect on its failure make the next
 * attempt better? The answer is that it helps exactly once and then does
 * measurable harm, and the screen has to carry both halves or it is propaganda.
 *
 * No "use client" and no sliders. Every number here is measured and nothing a
 * reader could drag would move any of them, so there is nothing to hydrate --
 * the whole screen ships as HTML. The rail's control slot stays empty, which is
 * the convention Rail.tsx exists to enforce.
 */

export type CollapseData = {
  arm: string;
  model: string;
  tasks: number;
  repeats: number;
  fromRound: number;
  series: Series[];
  baseline: { rate: number; label: string } | null;
  tests: PairTest[];
  byTask: { taskId: string; b: number; c: number; n: number }[];
  tokens: {
    label: string;
    tone: "measure" | "muted";
    points: { round: number; meanCompletion: number | null; calls: number }[];
  }[];
  malformed: {
    label: string;
    total: number;
    reasons: { label: string; count: number }[];
  }[];
};

export function Collapse({ data }: { data: CollapseData }) {
  const headline = data.tests[0];
  const maxTokens = Math.max(
    1,
    ...data.tokens.flatMap((s) =>
      s.points.map((p) => p.meanCompletion ?? 0),
    ),
  );
  const topTask = data.byTask[0];

  return (
    <Shell current="recovery">
      <header className="max-w-prose">
        <p className="text-ink-muted text-label">Screen 2</p>
        <h1 className="text-ink text-h1 mt-0.5">The collapse</h1>
        <Finding
          className="mt-3"
          stat={
            headline && headline.n > 0
              ? `b = ${headline.b}, c = ${headline.c}, exact McNemar p = ${headline.p.toExponential(1)}`
              : undefined
          }
        >
          Asking the model to reflect on its own failure{" "}
          <strong>helps once and then poisons every attempt after it</strong>.
          Reflection beats blind retry at the first recovery round and loses at
          every round that follows, with no reversal in any task — so the
          prescription is not &ldquo;reflect better&rdquo;, it is{" "}
          <strong>K&nbsp;=&nbsp;1</strong>.
        </Finding>
      </header>

      <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel
          title="Apply rate per recovery round"
          aside={`${data.arm} · ${data.model}`}
        >
          <SlopeChart
            series={data.series}
            reference={data.baseline ?? undefined}
            annotate={{
              seriesId: "l2_reflection",
              toRound: 2,
              label:
                "the inversion. Reflection's second attempt is worse than its first, and worse than retrying blind — the model now has its own failed patch in the prompt and anchors on it instead of on the file.",
            }}
          />
          <p className="text-ink-muted mt-3 max-w-prose text-small">
            The dashed line is blind retry, the control. The dotted horizontal
            rule is the round-1 baseline rate. Both axes are fixed: the vertical
            scale runs 0 to 100 whatever the data does, so a collapse has to
            earn its shape.
          </p>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel
            title="The paired test"
            aside={`rounds ${data.fromRound} and up`}
          >
            <div className="flex flex-col gap-4">
              {data.tests.map((test) => (
                <PairStrip key={test.label} test={test} />
              ))}
            </div>
            <div className="border-rule mt-4 border-t pt-3">
              <PairStripLegend />
            </div>
          </Panel>

          <Panel title="Where the signal comes from" aside="per task">
            <table className="w-full text-small">
              <thead>
                <tr className="text-ink-muted text-label">
                  <th className="pb-1 text-left font-normal">Task</th>
                  <th className="pb-1 text-right font-normal">b</th>
                  <th className="pb-1 text-right font-normal">c</th>
                  <th className="pb-1 text-right font-normal">Discordant</th>
                </tr>
              </thead>
              <tbody>
                {data.byTask.map((task) => (
                  <tr key={task.taskId} className="border-rule border-t">
                    <td className="text-ink py-1 font-mono text-label">
                      {task.taskId}
                    </td>
                    <td className="py-1 text-right">
                      <Figure value={task.b} className="text-small" />
                    </td>
                    <td className="py-1 text-right">
                      <Figure value={task.c} className="text-small" />
                    </td>
                    <td className="py-1 text-right">
                      <Figure
                        value={task.n}
                        tone="measure"
                        className="text-small"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topTask && headline ? (
              <Note className="mt-3">
                Every task runs the same direction — c = 0 in all{" "}
                {data.byTask.length} — but the pairs are not independent.{" "}
                <span className="font-mono">{topTask.taskId}</span> supplies{" "}
                {topTask.n} of the {headline.n} discordant pairs on its own, so
                the effective sample is nearer {data.tasks} than {headline.n}.
              </Note>
            ) : null}
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Why it collapses" aside="mean completion tokens">
          <div className="flex flex-col gap-3">
            {data.tokens.map((s) => (
              <div key={s.label}>
                <p className="text-ink text-small">{s.label}</p>
                <div className="mt-1 flex items-end gap-1">
                  {s.points.map((p) => (
                    <div key={p.round} className="flex-1">
                      <div
                        className={
                          s.tone === "measure" ? "bg-measure" : "bg-rule-strong"
                        }
                        style={{
                          height: `${((p.meanCompletion ?? 0) / maxTokens) * 56}px`,
                        }}
                      />
                      <Figure
                        value={
                          p.meanCompletion === null
                            ? null
                            : Math.round(p.meanCompletion)
                        }
                        align="left"
                        tone="muted"
                        className="mt-1 block text-label"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-ink-muted mt-3 max-w-prose text-small">
            Reflection writes roughly twice as much and climbs every round.
            Blind retry climbs too — it is not flat — but it starts far lower
            and never carries a previous patch forward.
          </p>
        </Panel>

        <Panel title="How it fails" aside={`malformed patches, rounds ${data.fromRound}+`}>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.malformed.map((group) => (
              <div key={group.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-ink text-small">{group.label}</p>
                  <Figure
                    value={group.total}
                    tone="measure"
                    className="text-small"
                  />
                </div>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {group.reasons.length === 0 ? (
                    <li className="text-ink-muted text-small">
                      No malformed patches.
                    </li>
                  ) : (
                    group.reasons.map((reason) => (
                      <li
                        key={reason.label}
                        className="border-rule flex items-baseline justify-between gap-2 border-t pt-1"
                      >
                        <span className="text-ink-muted text-label">
                          {reason.label}
                        </span>
                        <Figure value={reason.count} className="text-label" />
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-ink-muted mt-3 max-w-prose text-small">
            This is the mechanism, not a correlate. Every malformed patch
            reflection produced after round 1 failed the same way — the search
            text it asked the engine to find was not in the file. It was
            quoting its own last attempt.
          </p>
        </Panel>
      </div>

      <section className="mt-8 flex max-w-prose flex-col gap-3">
        <h2 className="text-ink text-h2">What this result does not support</h2>
        <Note>
          <strong>Narrow and deep.</strong> {data.tasks} tasks, {data.repeats}{" "}
          repeats, one model. The edit-format result on screen 3 spans 60 tasks;
          this one does not, and pairs cluster within task. It is strong evidence
          that reflection harms <em>this</em> model on <em>these</em> tasks and
          weak evidence about anything else.
        </Note>
        <Note>
          <strong>It does not replicate across models.</strong> The 30B arm is
          flat and null, and the reasoning arm leans the other way without
          reaching significance. Three arms, three different answers — reported
          as three, not averaged into one.
        </Note>
        <Note>
          <strong>Applied is not resolved.</strong> Every rate on this screen is
          the rate at which a patch <em>applied to the repository</em>. No test
          was run, so none of it measures whether a bug was fixed. A reflection
          round that produced a clean patch for the wrong reason counts here as a
          success.
        </Note>
        <Note>
          <strong>Round 1 is excluded from the test, deliberately.</strong>{" "}
          Reflection wins round 1. Pooling all four rounds averages that win
          against the later losses and reports nothing, which is why the test
          starts at round {data.fromRound} — and why the chart shows round 1
          anyway.
        </Note>
      </section>
    </Shell>
  );
}
