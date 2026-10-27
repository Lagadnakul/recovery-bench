"use client";

import { useMemo, useState } from "react";
import { DecisionPlane, type Lane } from "@/components/marks/DecisionPlane";
import { Figure } from "@/components/primitives/Figure";
import { Finding } from "@/components/primitives/Finding";
import { Illustrative, Note } from "@/components/primitives/Note";
import { Panel } from "@/components/primitives/Panel";
import { Rule } from "@/components/primitives/Rule";
import { Slider } from "@/components/primitives/Slider";
import {
  Plain,
  Receipt,
  ReadThis,
  Term,
  TermList,
} from "@/components/primitives/Plain";
import { Shell } from "@/components/shell/Rail";
import type { TermKey } from "@/model/glossary";
import type { Arm, Decision, Payoffs } from "@/model/ccos";
import { finiteHorizon, myopicDecision, type ClassInput } from "@/model/policy";

/**
 * Screen 6 -- the instrument.
 *
 * The one interactive screen, and the literal answer to "where is the
 * algorithm?". Drag G, r or h and every threshold moves, every verdict
 * recomputes, and the FORMAT lane flips.
 *
 * The honest framing, which is also the more interesting one: the rule's
 * answer depends entirely on three numbers nobody has measured yet. At the
 * committed payoffs it says ask a human about FORMAT -- the one class that
 * actually recovered in the pilot -- and the finite-horizon form disagrees with
 * it. That disagreement is the finding, not an embarrassment.
 */

export type StoppingRuleData = {
  payoffs: Payoffs;
  lambdaUsed: number;
  lambdaEstimate: number;
  lambdaInterval: { lo: number; hi: number };
  lambdaIsMeasured: boolean;
  classes: (ClassInput & { priorOnly: boolean; prescribed: string })[];
  horizonClasses: string[];
  horizonK: number;
  arms: Arm[];
  survivorship: { successes: number; retriedAfterSuccess: number };
  totalTrials: number;
};

const FORMULA = "RETRY  ⟺  p(c,k) > θ_c          θ_c = q_c − (h − r) / G";

const TERMS: TermKey[] = [
  "stoppingRule",
  "failureClass",
  "belief",
  "theta",
  "payoffG",
  "payoffR",
  "payoffH",
  "payoffQ",
  "lambda",
  "myopic",
  "finiteHorizon",
  "prior",
  "survivorship",
];

export function StoppingRule({ data }: { data: StoppingRuleData }) {
  const [payoffs, setPayoffs] = useState<Payoffs>(data.payoffs);
  const set = (key: keyof Payoffs) => (value: number) =>
    setPayoffs((prev) => ({ ...prev, [key]: value }));

  // The evidence behind the FORMAT lane, so the panel below can state it from
  // the data instead of asserting it. This replaces a hardcoded "3 of 3" that
  // came from the original pilot matrix and contradicted the belief drawn
  // beside it -- ccos.json's FORMAT class has 10 trials and 5 successes, which
  // is why p-hat is 0.500 and not 1.0.
  const formatEvidence = data.classes.find(
    (c) => c.cls === "FORMAT" && !c.priorOnly,
  );

  const lanes: Lane[] = useMemo(
    () =>
      data.classes.map((input) => {
        const myopic = myopicDecision(input, payoffs, data.lambdaUsed);
        let horizonDecision: Decision | null = null;
        if (data.horizonClasses.includes(input.cls)) {
          horizonDecision =
            finiteHorizon(input, payoffs, data.lambdaUsed, data.horizonK)
              .decisions[0] ?? null;
        }
        return {
          cls: input.cls,
          p: myopic.p,
          theta: myopic.theta,
          decision: myopic.decision,
          horizonDecision,
          trials: input.trials,
          successes: input.successes,
          priorOnly: input.priorOnly,
        };
      }),
    [data, payoffs],
  );

  const disagreements = lanes.filter(
    (lane) => lane.horizonDecision && lane.horizonDecision !== lane.decision,
  );
  const atDefault =
    payoffs.G === data.payoffs.G &&
    payoffs.r === data.payoffs.r &&
    payoffs.h === data.payoffs.h;

  const rail = (
    <>
      <div className="flex flex-col gap-4">
        <Slider
          id="payoff-G"
          label="G"
          description="worth of a fix"
          value={payoffs.G}
          onValueChange={set("G")}
          min={0.1}
          max={3}
          step={0.1}
          ticks={[0.1, 1, 3]}
          format={(v) => v.toFixed(2)}
        />
        <Slider
          id="payoff-r"
          label="r"
          description="cost of one retry"
          value={payoffs.r}
          onValueChange={set("r")}
          min={0}
          max={1}
          step={0.01}
          ticks={[0, 0.5, 1]}
          format={(v) => v.toFixed(2)}
        />
        <Slider
          id="payoff-h"
          label="h"
          description="cost of asking a human"
          value={payoffs.h}
          onValueChange={set("h")}
          min={0}
          max={1}
          step={0.01}
          ticks={[0, 0.5, 1]}
          format={(v) => v.toFixed(2)}
        />
      </div>

      <div>
        <p className="text-ink-muted font-mono text-[10px] leading-relaxed">
          θ = q − (h − r) / G
        </p>
        {!atDefault ? (
          <button
            type="button"
            onClick={() => setPayoffs(data.payoffs)}
            className="text-measure rounded-control mt-2 text-small underline underline-offset-2"
          >
            Reset to the committed values
          </button>
        ) : (
          <p className="text-ink-muted mt-2 text-label">
            At the committed values.
          </p>
        )}
      </div>
    </>
  );

  return (
    <Shell current="stopping-rule" rail={rail}>
      <h1 className="text-display text-ink">The stopping rule</h1>

      <Finding className="mt-3">
        <strong>
          Keep trying while the chance of success is better than the break-even
          point. Otherwise stop and ask a person.
        </strong>{" "}
        That is the whole rule. The break-even point is not a number somebody
        chose — it falls out of three costs: what a fix is worth, what another
        try costs, and what interrupting a human costs.{" "}
        <strong>
          Change any of those three and the answer changes
        </strong>{" "}
        — which is the point of the sliders, and also the problem, because none
        of the three has been measured yet.
      </Finding>

      <ReadThis question="When should a coding agent give up and ask a person for help?">
        <p>
          Four kinds of failure are shown side by side. For each one, the dot is
          the <Term k="belief" /> — how likely one more attempt is to work,
          based on how often attempts like it have worked before. The line is
          the <Term k="theta" />.
        </p>
        <p>
          <strong>Dot above the line, keep trying. Dot below it, ask a
          person.</strong>{" "}
          Drag the three sliders on the left and watch the lines move. Nothing
          about the model changes — only what you have decided things are worth.
        </p>
      </ReadThis>

      <Receipt className="mt-3">
        {`θ_c = q_c − (h − r) / G · G ${payoffs.G.toFixed(2)} r ${payoffs.r.toFixed(2)} h ${payoffs.h.toFixed(2)}`}
      </Receipt>

      <Panel
        className="mt-8"
        title="Four classes, one algorithm"
        aside={`${data.totalTrials} archive trials`}
      >
        <DecisionPlane lanes={lanes} />
        <Illustrative className="mt-3" />
      </Panel>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Two ways of deciding, and where they disagree">
          <Plain className="mb-3">
            There are two ways to work out whether another try is worth it. The{" "}
            <Term k="myopic" /> asks only about the very next attempt. The{" "}
            <Term k="finiteHorizon" /> remembers that a failed cheap try still
            leaves you the attempts after it.
          </Plain>
          {disagreements.length ? (
            <>
              <p className="text-ink max-w-prose text-body">
                On{" "}
                <strong>
                  {disagreements.map((d) => d.cls.toLowerCase()).join(" and ")}
                </strong>{" "}
                the two disagree. Looking one step ahead says ask a person;
                counting the remaining attempts says try again. The second is
                right, because failing a cheap retry costs almost nothing and
                you still have the other tries left.
              </p>
              <p className="text-ink-muted mt-3 max-w-prose text-small">
                {formatEvidence
                  ? `Format is the class that actually recovered in the pilot — ${formatEvidence.successes} of ${formatEvidence.trials} times. `
                  : ""}
                The one-step rule gives up on it. That is a real argument for
                using the look-ahead form, and it is only visible because both
                were worked out rather than one.
              </p>
            </>
          ) : (
            <p className="text-ink max-w-prose text-body">
              At these costs both ways of deciding agree on every class. Make a
              retry cheaper and the look-ahead form starts preferring to keep
              going where the one-step rule would stop and ask.
            </p>
          )}
          <Rule
            className="mt-4"
            label="classes where they differ"
            value={`${disagreements.length} of ${lanes.length}`}
          />
        </Panel>

        <Panel title="Every other approach is this rule in disguise">
          <Plain className="mb-3">
            The agents people build today all behave like this one rule with the
            break-even point set to an extreme. An agent that never gives up has
            set it to minus infinity. One that always asks has set it to plus
            infinity. Saying so is a structural claim, not an opinion — the
            thresholds below produce exactly those behaviours.
          </Plain>
          <dl className="mt-4 space-y-3">
            {data.arms.map((arm) => (
              <div key={arm.id}>
                <dt className="text-ink text-small font-medium">{arm.label}</dt>
                <dd className="text-ink-muted mt-0.5 text-small">
                  {arm.represents}
                  <span className="text-ink-muted ml-1.5 font-mono text-label">
                    {arm.id === "A_stubborn"
                      ? "θ = −∞"
                      : arm.id === "B_needy"
                        ? "θ = +∞"
                        : arm.id === "C_random"
                          ? "θ ignores the class"
                          : "θ = θ_c"}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <section className="mt-10 space-y-3">
        <h2 className="text-h2 text-ink">What this does not yet show</h2>
        <Plain className="text-ink-muted">
          Five limits. Each one is a place where the rule is running on an
          assumption rather than a measurement.
        </Plain>

        <Note>
          <strong>The fading factor was never actually measured.</strong> λ is fitted at{" "}
          <Figure value={data.lambdaEstimate.toFixed(3)} className="text-inherit" />{" "}
          but its interval reaches{" "}
          <Figure value={data.lambdaInterval.hi.toFixed(2)} className="text-inherit" />
          , so the fit cannot rule out no decay at all — and the policy above
          runs with λ = {data.lambdaUsed}. The belief is therefore flat in the
          attempt index. Context rot is the mechanism this work is built on, and
          on {data.totalTrials} trials it is not yet visible.
        </Note>

        <Note>
          <strong>How often a person succeeds is a guess.</strong> Nobody
          measured how often a human actually fixes each kind of failure once
          the agent gives up. The numbers used are the ones proposed in the
          plan, and every verdict on this screen inherits them.
        </Note>

        <Note>
          <strong>Two of the four kinds have no evidence at all.</strong>{" "}
          Broken and Lost were never once observed, so their dots sit at 50%
          purely because that is where they started. Nothing has moved them.
          They are a <Term k="prior" />, drawn as a line on a chart.
        </Note>

        <Note>
          <strong>Nothing was ever retried after it worked.</strong>{" "}
          {data.survivorship.successes} cells succeeded and{" "}
          {data.survivorship.retriedAfterSuccess} were retried afterwards, so
          the data never observes what retrying after a success would do.
        </Note>

        <Note>
          <strong>
            This screen uses {data.totalTrials} old trials, not the 1,604 new
            ones.
          </strong>{" "}
          To know whether a retry worked you have to run the project&rsquo;s
          tests. The big run never did — it only checked whether the edit was
          accepted. So none of the 1,604 attempts can contribute anything to
          this screen, and the rule rests on {data.totalTrials} hand-checked
          trials from the earlier pilot.
        </Note>
      </section>

      <Receipt className="mt-8">{FORMULA}</Receipt>

      <TermList keys={TERMS} />
    </Shell>
  );
}
