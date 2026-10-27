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
import {
  PairStrip,
  PairStripLegend,
  type PairTest,
} from "@/components/marks/PairStrip";
import { chanceInWords, type TermKey } from "@/model/glossary";

/**
 * Screen 3 -- the edit format.
 *
 * The strongest result in the thesis and the easiest to tell, so the screen is
 * deliberately the plainest: two bars, one test, one mechanism. No chart that
 * needs a legend.
 *
 * It is also the result most likely to be dismissed as trivial engineering --
 * "of course one format parses better" -- so the screen leads with what the
 * size of the gap actually implies: a measurement that claims to be about model
 * capability is mostly measuring a prompt format.
 */

const TERMS: TermKey[] = [
  "searchReplace",
  "unifiedDiff",
  "applied",
  "applyRate",
  "task",
  "pairedTest",
  "discordant",
  "concordant",
  "pValue",
  "mcNemar",
  "malformed",
];

export type EditFormatData = {
  arm: string;
  tasks: number;
  models: string[];
  searchReplace: { rows: number; applied: number; rate: number };
  unifiedDiff: { rows: number; applied: number; rate: number };
  test: PairTest;
  /** Why the losing format loses, as counts of the engine's own reasons. */
  reasons: { label: string; count: number; share: number }[];
  /** The same comparison across the whole sweep, not just the wide block. */
  overall: { searchReplace: number; unifiedDiff: number };
};

function FormatBar({
  name,
  plain,
  rate,
  applied,
  rows,
  tone,
}: {
  name: string;
  plain: string;
  rate: number;
  applied: number;
  rows: number;
  tone: "measure" | "muted";
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-ink text-body">{name}</p>
          <p className="text-ink-muted mt-0.5 max-w-prose text-small">
            {plain}
          </p>
        </div>
        <Figure
          value={`${(rate * 100).toFixed(1)}%`}
          tone={tone}
          className="text-h1 shrink-0"
        />
      </div>
      <div
        className="border-rule mt-2 h-4 w-full border"
        role="img"
        aria-label={`${(rate * 100).toFixed(1)} percent accepted`}
      >
        <div
          className={tone === "measure" ? "bg-measure h-full" : "bg-rule-strong h-full"}
          style={{ width: `${rate * 100}%` }}
        />
      </div>
      <Receipt>
        {applied.toLocaleString("en-US")} accepted of{" "}
        {rows.toLocaleString("en-US")} attempts
      </Receipt>
    </div>
  );
}

export function EditFormat({ data }: { data: EditFormatData }) {
  const gap = data.searchReplace.rate / Math.max(data.unifiedDiff.rate, 1e-9);

  return (
    <Shell current="edit-format">
      <header className="max-w-prose">
        <p className="text-ink-muted text-label">Screen 3</p>
        <h1 className="text-ink text-h1 mt-0.5">
          How you ask decides what you get
        </h1>
        <Finding className="mt-3">
          The same models, on the same {data.tasks} bugs, succeed{" "}
          <strong>{gap.toFixed(0)} times more often</strong> when they are asked
          to write their edit one way rather than the other. Nothing about the
          model changed — only the shape of the answer it was asked for.
        </Finding>
      </header>

      <ReadThis question="Does the format a model is asked to write its edit in decide whether that edit can be used?">
        <p>
          There are two common ways to ask a model to edit a file. With{" "}
          <Term k="searchReplace" />, it quotes the lines it wants to change.
          With <Term k="unifiedDiff" />, it writes the change the way Git does,
          which means counting line numbers correctly.
        </p>
        <p>
          Both were given the identical bug, the identical model and the
          identical prompt. The only difference is the format. If the format did
          not matter, the two bars below would be the same height.
        </p>
      </ReadThis>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel
          title="How often the edit could be used"
          aside={`${data.tasks} bugs · ${data.models.join(", ")}`}
        >
          <div className="flex flex-col gap-6">
            <FormatBar
              name="Quote the lines to change"
              plain="The model copies the exact text it wants to replace."
              rate={data.searchReplace.rate}
              applied={data.searchReplace.applied}
              rows={data.searchReplace.rows}
              tone="measure"
            />
            <FormatBar
              name="Write it the way Git does"
              plain="The model has to get line numbers and counts right."
              rate={data.unifiedDiff.rate}
              applied={data.unifiedDiff.applied}
              rows={data.unifiedDiff.rows}
              tone="muted"
            />
          </div>
          <Plain className="mt-6">
            This is the largest effect anywhere in the experiment, and it has
            nothing to do with how clever the model is. It is about whether the
            model was asked to do arithmetic it is bad at.
          </Plain>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Is this real, or is it luck?">
            <Plain className="mb-4">
              Every attempt in one format is matched to the attempt on the same
              bug, by the same model, in the other format.
            </Plain>
            <PairStrip test={data.test} />
            <div className="border-rule mt-4 border-t pt-3">
              <PairStripLegend
                methodA="quoting the lines"
                methodB="Git-style diff"
              />
            </div>
            <Plain className="mt-4">
              A result this lopsided would happen by chance{" "}
              {chanceInWords(data.test.p)} — which is to say, never. This is not
              a marginal finding that needs careful statistics to defend. The
              statistics are here because they should be, not because the result
              is close.
            </Plain>
            <Receipt>
              exact McNemar, two-sided binomial at p=½ · b={data.test.b} c=
              {data.test.c} n={data.test.n} · p={data.test.p.toExponential(2)}
            </Receipt>
          </Panel>

          <Panel title="Why the Git format fails" aside="the engine's own reasons">
            <Plain className="mb-3">
              Not a mystery, and not the model being stupid. The single most
              common failure is the model miscounting how many lines its own
              change touches.
            </Plain>
            <ul className="flex flex-col gap-1">
              {data.reasons.map((reason) => (
                <li
                  key={reason.label}
                  className="border-rule border-t pt-1.5 first:border-t-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ink text-small">{reason.label}</span>
                    <Figure value={reason.count} className="text-small" />
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
          </Panel>
        </div>
      </div>

      <section className="mt-10 flex max-w-prose flex-col gap-3">
        <h2 className="text-ink text-h2">Why this matters beyond this thesis</h2>
        <Plain>
          Benchmarks that report how good a model is at fixing bugs usually fix
          one edit format and never mention it. If the format can move the
          result by {gap.toFixed(0)}&times;, then a large part of what those
          benchmarks call &ldquo;capability&rdquo; is the format, and two
          published scores are not comparable unless they used the same one.
        </Plain>
        <Note>
          <strong>&ldquo;Accepted&rdquo; is not &ldquo;fixed&rdquo;.</strong> As
          everywhere in this console, these are patches the repository was
          willing to apply. No test was run. A format that produces applicable
          patches more often is not thereby producing correct ones.
        </Note>
        <Note>
          <strong>This is one block, and it is the wide one.</strong>{" "}
          {data.tasks} bugs, which is why this result travels further than the
          others. Across the entire experiment the same gap holds —{" "}
          {(data.overall.searchReplace * 100).toFixed(1)}% against{" "}
          {(data.overall.unifiedDiff * 100).toFixed(1)}% — but those other
          blocks were not designed to test it and should not be read as
          confirmation.
        </Note>
      </section>

      <TermList keys={TERMS} />
    </Shell>
  );
}
