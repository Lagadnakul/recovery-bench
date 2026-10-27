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
import type { TermKey } from "@/model/glossary";

/**
 * Screen 1 -- the overview.
 *
 * The question is NOT "what did we find" -- the other screens answer that.
 * It is "did this experiment measure what it set out to measure", which is the
 * first thing an examiner asks and the thing a dashboard usually hides behind
 * four cards of green numbers.
 *
 * So the KPI strip reports the shape of the run including the parts that did
 * not work, and the honesty block sits above the results rather than below
 * them. A reader should finish this screen knowing exactly what the console is
 * allowed to claim before they see a single claim.
 */

const TERMS: TermKey[] = [
  "cell",
  "arm",
  "task",
  "applied",
  "applyRate",
  "byDesign",
  "hole",
  "providerError",
  "round",
  "repeat",
];

export type OverviewData = {
  totals: {
    rows: number;
    calls: number;
    tokens: number;
    arms: number;
    models: number;
    tasks: number;
    byDesign: number;
    real: number;
    starved: number;
    cascade: number;
  };
  holes: number;
  arms: {
    arm: string;
    label: string;
    question: string;
    rows: number;
    tasks: number;
    models: string[];
    applied: number;
    malformed: number;
    byDesign: number;
    realErrors: number;
    calls: number;
    maxRound: number;
  }[];
  provenance: { commit: string | null; rows: number };
};

/** One cell of the divided strip. Not a card: no border, no shadow, no icon. */
function Stat({
  label,
  value,
  unit,
  note,
  tone = "default",
}: {
  label: string;
  value: number | string | null;
  unit?: string;
  note: string;
  tone?: "default" | "measure" | "muted";
}) {
  return (
    <div className="border-rule flex-1 px-4 py-3 first:pl-0 sm:border-l sm:first:border-l-0">
      <p className="text-ink-muted text-label">{label}</p>
      <Figure
        value={value}
        unit={unit}
        tone={tone}
        align="left"
        className="text-h1 mt-0.5 block"
      />
      <p className="text-ink-muted mt-1 text-label">{note}</p>
    </div>
  );
}

export function Overview({ data }: { data: OverviewData }) {
  const { totals } = data;
  const millions = (totals.tokens / 1_000_000).toFixed(1);

  return (
    <Shell current="overview">
      <header className="max-w-prose">
        <p className="text-ink-muted text-label">Screen 1</p>
        <h1 className="text-ink text-h1 mt-0.5">What was measured</h1>
        <Finding className="mt-3">
          An AI model was asked to fix {totals.tasks} real bugs from real
          open-source projects, {totals.rows.toLocaleString("en-US")} times
          over, under conditions that were varied one at a time.{" "}
          <strong>
            Everything here measures whether its patch could be applied — not
            whether the bug was fixed.
          </strong>{" "}
          That limit is the single most important thing to carry into every
          other screen.
        </Finding>
      </header>

      <ReadThis question="Did this experiment actually measure what it set out to measure?">
        <p>
          Before any result is worth reading, you need to know what the run
          covered and where it fell short. The strip below is the whole
          experiment in six numbers, including the parts that did not produce
          data.
        </p>
        <p>
          The table underneath splits it into the six blocks it was run in. They
          were deliberately not pooled: each one used a different model or asked
          a different question, so averaging them would describe none of them.
        </p>
      </ReadThis>

      <section className="border-rule bg-surface rounded-panel mt-6 flex flex-col border sm:flex-row">
        <Stat
          label="Attempts"
          value={totals.rows}
          note="one model, one bug, one setting"
        />
        <Stat
          label="Calls actually made"
          value={totals.calls}
          note={`${totals.rows - totals.calls} never reached a model`}
        />
        <Stat
          label="Words processed"
          value={millions}
          unit="M"
          note="prompt and reply, in tokens"
        />
        <Stat
          label="Blocks completed"
          value={`${totals.arms} of ${totals.arms}`}
          note="all planned blocks finished"
        />
        <Stat
          label="Refused on purpose"
          value={totals.byDesign}
          tone="muted"
          note="conditions not met — by design"
        />
        <Stat
          label="Genuine errors"
          value={totals.real}
          tone="muted"
          note="the service actually failed"
        />
      </section>

      <Plain className="mt-4">
        The last two numbers are usually collapsed into one and reported as{" "}
        <strong>{totals.byDesign + totals.real} failures</strong>. They are not
        the same thing. {totals.byDesign} of them are the harness refusing to
        make a call because the setup for it was not met — a designed property
        of the experiment. Only {totals.real} are the service breaking.
      </Plain>
      <Receipt>
        PROVIDER_ERROR {totals.byDesign + totals.real} = starved{" "}
        {totals.starved} + cascade {totals.cascade} + real {totals.real}
      </Receipt>

      <Note className="mt-4">
        <strong>Do not add {data.holes} to that.</strong> {data.holes} of the
        attempts never ran at all, because an earlier attempt in the same chain
        had already died. Those {data.holes} are counted inside the{" "}
        {totals.byDesign} above, not alongside them — reporting both separately
        counts the same cells twice, and it is an easy mistake to make.
      </Note>

      <Panel
        className="mt-8"
        title="The six blocks"
        aside="run separately, reported separately"
      >
        <Plain className="mb-4">
          Each block answers its own question with its own model. Notice the
          shape difference: one block covers{" "}
          {data.arms.reduce((most, a) => Math.max(most, a.tasks), 0)} bugs, the
          rest cover 4 each with repeats. That makes one result broad
          and the others deep but narrow, and the console says so wherever it
          matters.
        </Plain>
        {data.arms.length === 0 ? (
          <PanelEmpty>
            The snapshot holds no completed blocks. Nothing has been measured
            yet — this is not a run of zeros.
          </PanelEmpty>
        ) : (
        <div className="-mx-3 overflow-x-auto px-3">
          <table className="w-full min-w-[46rem] text-small">
            <thead>
              <tr className="text-ink-muted border-rule border-b text-label">
                <th className="pb-1.5 text-left font-normal">Block</th>
                <th className="pb-1.5 text-left font-normal">What it asks</th>
                <th className="pb-1.5 text-right font-normal">Attempts</th>
                <th className="pb-1.5 text-right font-normal">Bugs</th>
                <th className="pb-1.5 text-right font-normal">Accepted</th>
                <th className="pb-1.5 text-right font-normal">Unusable</th>
                <th className="pb-1.5 text-right font-normal">Refused</th>
              </tr>
            </thead>
            <tbody>
              {data.arms.map((arm) => (
                <tr key={arm.arm} className="border-rule border-b">
                  <td className="py-2 align-top">
                    <span className="text-ink block">{arm.label}</span>
                    <span className="text-ink-muted font-mono text-label">
                      {arm.models.join(", ")}
                    </span>
                  </td>
                  <td className="text-ink-muted max-w-[18rem] py-2 align-top">
                    {arm.question}
                  </td>
                  <td className="py-2 text-right align-top">
                    <Figure value={arm.rows} className="text-small" />
                  </td>
                  <td className="py-2 text-right align-top">
                    <Figure value={arm.tasks} className="text-small" />
                  </td>
                  <td className="py-2 text-right align-top">
                    <Figure
                      value={arm.applied}
                      tone="measure"
                      className="text-small"
                    />
                  </td>
                  <td className="py-2 text-right align-top">
                    <Figure value={arm.malformed} className="text-small" />
                  </td>
                  <td className="py-2 text-right align-top">
                    <Figure
                      value={arm.byDesign}
                      tone="muted"
                      className="text-small"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </Panel>

      <section className="mt-10 flex max-w-prose flex-col gap-3">
        <h2 className="text-ink text-h2">Three rules this console follows</h2>
        <Plain className="text-ink-muted">
          Stated up front, because each one is a place where a dashboard would
          normally flatter the result.
        </Plain>
        <Note>
          <strong>
            A patch that applied is not a bug that was fixed.
          </strong>{" "}
          The experiment checked whether the repository would accept the edit.
          It never ran the project&rsquo;s tests, so it cannot tell you whether
          anything works. Wherever you see &ldquo;accepted&rdquo;, read it
          literally.
        </Note>
        <Note>
          <strong>Refused on purpose is not an error.</strong> {totals.byDesign}{" "}
          calls were never made because their conditions were not met. Counting
          them as model failures would make every model look worse than it is;
          hiding them would make the run look more complete than it was. They
          are shown as their own category.
        </Note>
        <Note>
          <strong>A cell that never ran is blank, not zero.</strong> {data.holes}{" "}
          attempts have no result. A zero would say the model tried and failed.
          Nothing was tried, so the console draws a grey dash and says so.
        </Note>
      </section>

      <Receipt className="mt-8">
        snapshot of {data.provenance.rows.toLocaleString("en-US")} rows from
        commit {data.provenance.commit?.slice(0, 7) ?? "unknown"}
      </Receipt>

      <TermList keys={TERMS} />
    </Shell>
  );
}
