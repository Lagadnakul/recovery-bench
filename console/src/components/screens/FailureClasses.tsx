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
import {
  ClassMarkDefs,
  classColor,
  type FailureClass,
} from "@/components/primitives/ClassMark";
import type { TermKey } from "@/model/glossary";

/**
 * Screen 4 -- the failure classes.
 *
 * The screen that was hardest to build honestly, and the one most worth
 * reading because of it.
 *
 * The stopping rule sorts failures into four kinds and treats each one
 * differently. The live sweep can only ever produce TWO of them: LOGIC means
 * "the patch applied and the test still failed", and no live row ever ran a
 * test. So the class the whole policy hinges on is structurally unreachable in
 * the new data, and its evidence comes entirely from the 31 hand-triaged
 * archive trials.
 *
 * A screen that drew four bars from the sweep would be inventing two of them.
 * This one draws the two it has, says what is missing, and puts the archive
 * evidence in its own panel clearly labelled as a different and much smaller
 * dataset.
 */

const TERMS: TermKey[] = [
  "failureClass",
  "malformed",
  "applyFail",
  "noPatch",
  "noOutput",
  "truncated",
  "providerError",
  "byDesign",
  "applied",
  "hole",
];

export type FailureClassesData = {
  /** What the classifier produced on the live sweep, including the zeros. */
  live: { cls: FailureClass; label: string; plain: string; count: number }[];
  liveTotal: number;
  /** Outcome kinds as the engine recorded them, before classification. */
  kinds: { kind: string; label: string; plain: string; count: number }[];
  /** The 572 unusable patches, by the engine's own reason. */
  reasons: { label: string; raw: string; count: number; share: number }[];
  /** The hand-triaged archive, the only source of the LOGIC class. */
  archive: { cls: FailureClass; trials: number; successes: number }[];
  archiveTotal: number;
  relabelled: { raw: string; label: string; count: number };
};

const CLASS_ORDER: FailureClass[] = ["FORMAT", "LOGIC", "BROKEN", "LOST"];

export function FailureClasses({ data }: { data: FailureClassesData }) {
  const maxLive = Math.max(1, ...data.live.map((c) => c.count));
  const maxKind = Math.max(1, ...data.kinds.map((k) => k.count));
  const unreachable = data.live.filter((c) => c.count === 0);

  return (
    <Shell current="failure-classes">
      <ClassMarkDefs />

      <header className="max-w-prose">
        <p className="text-ink-muted text-label">Screen 4</p>
        <h1 className="text-ink text-h1 mt-0.5">What actually goes wrong</h1>
        <Finding className="mt-3">
          Almost everything that fails, fails for a{" "}
          <strong>boring, mechanical reason</strong> — the model wrote something
          the repository could not read. Very little of it is the model being
          wrong about the bug.{" "}
          <strong>
            And the experiment could not have detected the interesting kind of
            failure even if it happened.
          </strong>
        </Finding>
      </header>

      <ReadThis question="When a fix attempt fails, what kind of failure is it — and does the experiment even distinguish them?">
        <p>
          The stopping rule only works if different kinds of failure can be told
          apart, because it treats them differently: a formatting slip is worth
          retrying, a wrong idea is not. There are four kinds it cares about.
        </p>
        <p>
          The honest answer on this screen is that the live run can only produce
          two of them, and the two it cannot produce include the most important
          one. That is a limitation of the experiment, shown here rather than
          left out.
        </p>
      </ReadThis>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel
          title="The four kinds, as the live run saw them"
          aside={`${data.liveTotal.toLocaleString("en-US")} failures classified`}
        >
          <ul className="flex flex-col gap-4">
            {CLASS_ORDER.map((cls) => {
              const entry = data.live.find((c) => c.cls === cls);
              if (!entry) return null;
              const empty = entry.count === 0;
              return (
                <li key={cls}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <p className="text-ink text-body">{entry.label}</p>
                      <p className="text-ink-muted mt-0.5 max-w-prose text-small">
                        {entry.plain}
                      </p>
                    </div>
                    <Figure
                      value={empty ? null : entry.count}
                      tone="measure"
                      className="text-h2 shrink-0"
                    />
                  </div>
                  <div className="border-rule mt-1.5 h-3 w-full border">
                    {empty ? null : (
                      <div
                        className="h-full"
                        style={{
                          width: `${(entry.count / maxLive) * 100}%`,
                          background: classColor(cls),
                        }}
                      />
                    )}
                  </div>
                  {empty ? (
                    <p className="text-ink-muted mt-1 text-small">
                      Not zero — <strong>not measurable</strong>. Nothing in
                      this run could have produced this class.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Note className="mt-5">
            <strong>
              Two of the four classes are blank, and that is the finding.
            </strong>{" "}
            To see that a patch is logically wrong you have to run the
            project&rsquo;s tests. This run never did — it only checked whether
            the edit applied. So &ldquo;wrong idea&rdquo; cannot appear in the
            data no matter how often it happened. A bar chart showing it at zero
            would be a lie told with a true number.
          </Note>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel
            title="Before classifying: what the engine recorded"
            aside={`${data.kinds.reduce((n, k) => n + k.count, 0).toLocaleString("en-US")} attempts`}
          >
            <Plain className="mb-4">
              The raw outcome of every attempt, in the engine&rsquo;s own
              categories. The classes above are built from these.
            </Plain>
            <ul className="flex flex-col gap-2.5">
              {data.kinds.map((kind) => (
                <li key={kind.kind}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ink text-small">{kind.label}</span>
                    <Figure value={kind.count} className="text-small" />
                  </div>
                  <div className="bg-surface-sunk mt-1 h-1.5 w-full">
                    <div
                      className="bg-measure h-full"
                      style={{ width: `${(kind.count / maxKind) * 100}%` }}
                    />
                  </div>
                  <p className="text-ink-muted mt-0.5 text-label">
                    {kind.plain}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel
        className="mt-4"
        title="The unusable patches, by reason"
        aside={`${data.reasons.reduce((n, r) => n + r.count, 0).toLocaleString("en-US")} patches`}
      >
        <Plain className="mb-4">
          This is the biggest single category of failure in the whole
          experiment, and it breaks down into a handful of specific, fixable
          mistakes. None of them is about understanding the bug.
        </Plain>
        <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {data.reasons.map((reason) => (
            <li key={reason.raw}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ink text-small">{reason.label}</span>
                <span className="shrink-0">
                  <Figure value={reason.count} className="text-small" />
                  <span className="text-ink-muted ml-1.5 text-label">
                    {(reason.share * 100).toFixed(0)}%
                  </span>
                </span>
              </div>
              <div className="bg-surface-sunk mt-1 h-1.5 w-full">
                <div
                  className="bg-class-format h-full"
                  style={{ width: `${reason.share * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <Note className="mt-5">
          <strong>One of these labels is wrong in the engine.</strong>{" "}
          {data.relabelled.count} patches are recorded as{" "}
          <span className="font-mono">{data.relabelled.raw}</span>, which says
          the model never closed its edit block. On inspection it mostly did
          close it — what it left out was the divider in the middle. The console
          shows it as &ldquo;{data.relabelled.label}&rdquo; and leaves the
          stored value untouched, so the data still matches the engine and the
          archive. Rename it in the engine before the paper quotes it.
        </Note>
      </Panel>

      <Panel
        className="mt-4"
        title="Where the missing class comes from instead"
        aside={`${data.archiveTotal} hand-checked trials`}
        sunk
      >
        <Plain className="mb-4">
          Because the live run cannot see logic failures, the stopping rule is
          built on a much smaller set of trials from the earlier pilot, where
          the tests <em>were</em> run and each outcome was checked by hand. This
          is a different and far smaller dataset, and it is the reason the
          stopping rule on the next screen is a proposal rather than a result.
        </Plain>
        {data.archive.length === 0 ? (
          <PanelEmpty>
            No triaged trials in the snapshot — the stopping rule has no
            evidence base to draw.
          </PanelEmpty>
        ) : (
          <table className="w-full text-small">
            <thead>
              <tr className="text-ink-muted border-rule border-b text-label">
                <th className="pb-1.5 text-left font-normal">Kind of failure</th>
                <th className="pb-1.5 text-right font-normal">Times seen</th>
                <th className="pb-1.5 text-right font-normal">
                  Retry worked
                </th>
                <th className="pb-1.5 text-right font-normal">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.archive.map((row) => (
                <tr key={row.cls} className="border-rule border-b">
                  <td className="text-ink py-2">
                    <span
                      aria-hidden
                      className="mr-2 inline-block h-2.5 w-2.5 align-middle"
                      style={{ background: classColor(row.cls) }}
                    />
                    {row.cls}
                  </td>
                  <td className="py-2 text-right">
                    <Figure value={row.trials} className="text-small" />
                  </td>
                  <td className="py-2 text-right">
                    <Figure
                      value={row.successes}
                      tone="measure"
                      className="text-small"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <Figure
                      value={
                        row.trials
                          ? `${Math.round((row.successes / row.trials) * 100)}%`
                          : null
                      }
                      className="text-small"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Receipt>
          hand-triaged archive, {data.archiveTotal} trials · the only source of
          the LOGIC class anywhere in this console
        </Receipt>
        <Note className="mt-4">
          <strong>{data.archiveTotal} trials is not a lot.</strong> Two of the
          four classes have no trials at all even here, so wherever the next
          screen draws a line for them it is drawing an assumption, not a
          measurement, and it says so.
        </Note>
      </Panel>

      {unreachable.length > 0 ? (
        <section className="mt-10 flex max-w-prose flex-col gap-3">
          <h2 className="text-ink text-h2">What would fix this</h2>
          <Plain>
            One change: run the project&rsquo;s tests after applying the patch.
            That turns &ldquo;the edit was accepted&rdquo; into &ldquo;the bug
            was fixed&rdquo;, and it makes the{" "}
            {unreachable.map((c) => c.label).join(" and ")}{" "}
            {unreachable.length === 1 ? "class" : "classes"} measurable for the
            first time. It needs a container runtime the run did not have
            access to, which is a practical obstacle rather than a conceptual
            one.
          </Plain>
        </section>
      ) : null}

      <TermList keys={TERMS} />
    </Shell>
  );
}
