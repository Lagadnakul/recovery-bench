import { Panel } from "@/components/primitives/Panel";
import { Figure } from "@/components/primitives/Figure";
import { Finding } from "@/components/primitives/Finding";
import { Note } from "@/components/primitives/Note";
import {
  Plain,
  Receipt,
  ReadThis,
  Term,
  TermList,
} from "@/components/primitives/Plain";
import { Shell } from "@/components/shell/Rail";
import { SlopeChart, type Series } from "@/components/marks/SlopeChart";
import {
  PairStrip,
  PairStripLegend,
  type PairTest,
} from "@/components/marks/PairStrip";
import { chanceInWords, type TermKey } from "@/model/glossary";

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

const TERMS: TermKey[] = [
  "reflection",
  "blindRetry",
  "applied",
  "applyRate",
  "round",
  "repeat",
  "pairedTest",
  "discordant",
  "concordant",
  "pValue",
  "mcNemar",
  "rejectionFloor",
  "clustering",
  "malformed",
];

export type CollapseData = {
  arm: string;
  model: string;
  tasks: number;
  repeats: number;
  fromRound: number;
  /** The same test with attempt 1 included -- what excluding it is worth. */
  pooledP: number;
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
    ...data.tokens.flatMap((s) => s.points.map((p) => p.meanCompletion ?? 0)),
  );
  const topTask = data.byTask[0];
  const reflect = data.series.find((s) => s.id === "l2_reflection");
  const blind = data.series.find((s) => s.id === "l1_blind_retry");
  const pct = (n: number | undefined) =>
    n === undefined ? "—" : `${Math.round(n * 100)}%`;

  return (
    <Shell current="recovery">
      <header className="max-w-prose">
        <p className="text-ink-muted text-label">Screen 2</p>
        <h1 className="text-ink text-h1 mt-0.5">The collapse</h1>
        <Finding className="mt-3">
          Asking the model to explain its own mistake before trying again{" "}
          <strong>helps the first time and hurts every time after that</strong>.
          There was no task where it came out the other way — so the advice is
          not &ldquo;reflect better&rdquo;, it is{" "}
          <strong>let it reflect once, then stop</strong>.
        </Finding>
      </header>

      <ReadThis question="If a coding agent gets a bug fix wrong, does asking it to think about why help it do better next time?">
        <p>
          Two ways of retrying are compared head to head. In{" "}
          <Term k="blindRetry" />, the model is told only that it failed. In{" "}
          <Term k="reflection" />, it is asked to explain the failure first and
          then try again. Everything else is held the same.
        </p>
        <p>
          The chart shows how often each one produced a patch the repository
          could accept, at each attempt. Higher is better. The thing to look for
          is the point where the two lines cross — that is the whole result.
        </p>
      </ReadThis>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel
          title="How often the patch was accepted, by attempt"
          aside={`${data.model}`}
        >
          <SlopeChart
            series={data.series}
            reference={data.baseline ?? undefined}
            annotate={{
              seriesId: "l2_reflection",
              toRound: 2,
              label:
                "is where it turns. The model's second attempt is worse than its first, and worse than not thinking about it at all — because its own failed patch is now in front of it, and it starts copying from that instead of from the file.",
            }}
          />
          <Plain className="mt-4">
            On the first attempt, reflection is ahead:{" "}
            <strong>{pct(reflect?.points[0]?.rate)}</strong> of its patches were
            accepted against <strong>{pct(blind?.points[0]?.rate)}</strong> for
            retrying blind. On the second attempt it falls to{" "}
            <strong>{pct(reflect?.points[1]?.rate)}</strong> while blind retry
            stays flat, and it never recovers.
          </Plain>
          <p className="text-ink-muted mt-2 max-w-prose text-small">
            The dashed line is blind retry, the comparison. The dotted
            horizontal line marks where the first attempt started. The vertical
            scale always runs from 0 to 100, whatever the numbers do, so a drop
            on this chart is a real drop and not a stretched axis.
          </p>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel
            title="Is this real, or is it luck?"
            aside={`attempt ${data.fromRound} onward`}
          >
            <Plain className="mb-4">
              Each attempt by reflection is matched against blind retry on the{" "}
              <em>same bug, same model, same attempt number</em>, so anything
              that makes one bug harder than another cancels out. Only the pairs
              that disagreed carry information.
            </Plain>
            <div className="flex flex-col gap-5">
              {data.tests.map((test) => (
                <PairStrip key={test.label} test={test} />
              ))}
            </div>
            <div className="border-rule mt-4 border-t pt-3">
              <PairStripLegend
                methodA="blind retry"
                methodB="reflection"
              />
            </div>
            {headline && headline.n > 0 ? (
              <Receipt>
                exact McNemar, two-sided binomial at p=½ · b={headline.b} c=
                {headline.c} n={headline.n} · p={headline.p.toExponential(2)}
              </Receipt>
            ) : null}
          </Panel>

          <Panel title="Where the result comes from" aside="each bug separately">
            <Plain className="mb-3">
              The same comparison, run inside each bug on its own. If one bug
              were driving everything, this is where it would show.
            </Plain>
            <table className="w-full text-small">
              <thead>
                <tr className="text-ink-muted text-label">
                  <th className="pb-1 text-left font-normal">Bug</th>
                  <th className="pb-1 text-right font-normal">
                    Blind retry won
                  </th>
                  <th className="pb-1 text-right font-normal">
                    Reflection won
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.byTask.map((task) => (
                  <tr key={task.taskId} className="border-rule border-t">
                    <td className="text-ink py-1.5 font-mono text-label">
                      {task.taskId}
                    </td>
                    <td className="py-1.5 text-right">
                      <Figure
                        value={task.b}
                        tone="measure"
                        className="text-small"
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      <Figure value={task.c} className="text-small" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topTask && headline ? (
              <Note className="mt-3">
                Every bug points the same way — reflection never won a single
                disagreement on any of them. But they are not equally
                informative:{" "}
                <span className="font-mono">{topTask.taskId}</span> accounts for{" "}
                {topTask.n} of the {headline.n} disagreements by itself. So this
                is closer to {data.byTask.length} pieces of evidence than{" "}
                {headline.n}, and should be read that way.
              </Note>
            ) : null}
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Why it happens" aside="average length of the reply">
          <Plain className="mb-4">
            Reflection makes the model write roughly twice as much, and it
            writes more with every attempt. The longer the answer, the more of
            it is the model talking about its own last try rather than reading
            the file.
          </Plain>
          <div className="flex flex-col gap-4">
            {data.tokens.map((s) => (
              <div key={s.label}>
                <p className="text-ink text-small">{s.label}</p>
                <div className="mt-1.5 flex items-end gap-2">
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
                      <span className="text-ink-muted block text-label">
                        try {p.round}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Receipt>mean completion tokens per round, calls only</Receipt>
        </Panel>

        <Panel
          title="How it fails"
          aside={`unusable patches, attempt ${data.fromRound} onward`}
        >
          <Plain className="mb-4">
            This is the mechanism, not a coincidence. Every single unusable
            patch reflection produced after the first attempt failed for the
            same reason: it asked the repository to find a piece of text that
            was not in the file. It was quoting its own previous attempt.
          </Plain>
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
                      No unusable patches at all.
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
        </Panel>
      </div>

      <section className="mt-10 flex max-w-prose flex-col gap-3">
        <h2 className="text-ink text-h2">What this does not prove</h2>
        <Plain className="text-ink-muted">
          Four limits, stated here rather than left for a reader to find.
        </Plain>
        <Note>
          <strong>It is narrow.</strong> {data.tasks} bugs, {data.repeats} runs
          each, one model. The edit-format result on the next screen covers 60
          bugs; this one does not. It is strong evidence that reflection hurts{" "}
          <em>this</em> model on <em>these</em> bugs, and weak evidence about
          anything else.
        </Note>
        <Note>
          <strong>It did not happen to every model.</strong> The smaller model
          shows no difference at all, and the reasoning model leans very
          slightly the other way without being convincing either. Three models,
          three different answers — reported as three rather than averaged into
          one number that describes none of them.
        </Note>
        <Note>
          <strong>&ldquo;Accepted&rdquo; is not &ldquo;fixed&rdquo;.</strong>{" "}
          Every number on this screen counts patches the repository was willing
          to apply. No test was ever run against them, so none of this measures
          whether a bug was actually fixed. A tidy patch that fixes nothing
          counts here as a success.
        </Note>
        <Note>
          <strong>The first attempt is left out of the test on purpose.</strong>{" "}
          Reflection wins the first attempt. Including it averages that win
          against the later losses and the result disappears — which is why the
          test starts at attempt {data.fromRound}, and why the chart still shows
          attempt 1 instead of quietly cropping it.
          {headline
            ? ` Including it weakens the result from ${chanceInWords(headline.p)} to ${chanceInWords(data.pooledP)}.`
            : ""}
        </Note>
      </section>

      <TermList keys={TERMS} />
    </Shell>
  );
}
