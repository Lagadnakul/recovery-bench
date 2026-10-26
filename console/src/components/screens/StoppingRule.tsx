"use client";

import { useMemo, useState } from "react";
import { DecisionPlane, type Lane } from "@/components/marks/DecisionPlane";
import { Figure } from "@/components/primitives/Figure";
import { Finding } from "@/components/primitives/Finding";
import { Illustrative, Note } from "@/components/primitives/Note";
import { Panel } from "@/components/primitives/Panel";
import { Rule } from "@/components/primitives/Rule";
import { Slider } from "@/components/primitives/Slider";
import { Shell } from "@/components/shell/Rail";
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

export function StoppingRule({ data }: { data: StoppingRuleData }) {
  const [payoffs, setPayoffs] = useState<Payoffs>(data.payoffs);
  const set = (key: keyof Payoffs) => (value: number) =>
    setPayoffs((prev) => ({ ...prev, [key]: value }));

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

      <Finding
        className="mt-3"
        stat={`θ_c = q_c − (h − r) / G   ·   G ${payoffs.G.toFixed(2)}  r ${payoffs.r.toFixed(2)}  h ${payoffs.h.toFixed(2)}`}
      >
        <strong>
          The algorithm is a threshold on a belief, and the threshold is made of
          costs.
        </strong>{" "}
        Retry while the chance this attempt works is better than what a human
        would get, discounted by what each option costs. Move any of the three
        costs and the policy changes — which is the point, and also the problem:
        none of the three has been measured yet.
      </Finding>

      <Panel
        className="mt-8"
        title="Four classes, one algorithm"
        aside={`${data.totalTrials} archive trials`}
      >
        <DecisionPlane lanes={lanes} />
        <Illustrative className="mt-3" />
      </Panel>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Where the myopic rule gets it wrong">
          {disagreements.length ? (
            <>
              <p className="text-ink max-w-prose text-body">
                On{" "}
                <strong>
                  {disagreements.map((d) => d.cls.toLowerCase()).join(" and ")}
                </strong>{" "}
                the one-step rule and the finite-horizon rule disagree. A failed
                retry does not end the episode — it leaves the agent with its
                remaining attempts — so a cheap retry is worth taking even when
                its own expected value looks worse than asking.
              </p>
              <p className="text-ink-muted mt-3 max-w-prose text-small">
                Format is the class that actually recovered in the pilot, 3 of 3.
                The myopic rule escalates it. That is an argument for the
                horizon form, and it is only visible because both were computed.
              </p>
            </>
          ) : (
            <p className="text-ink max-w-prose text-body">
              At these costs the one-step rule and the finite-horizon rule agree
              on every class. Lower the cost of a retry and the horizon form
              starts preferring to continue where the myopic rule would ask.
            </p>
          )}
          <Rule
            className="mt-4"
            label="classes where they differ"
            value={`${disagreements.length} of ${lanes.length}`}
          />
        </Panel>

        <Panel title="The four arms are the same rule">
          <p className="text-ink-muted max-w-prose text-small">
            Every baseline in the literature is this algorithm at a different
            threshold, which is a structural claim rather than an asserted one.
          </p>
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

        <Note>
          <strong>The decay term is not measured.</strong> λ is fitted at{" "}
          <Figure value={data.lambdaEstimate.toFixed(3)} className="text-inherit" />{" "}
          but its interval reaches{" "}
          <Figure value={data.lambdaInterval.hi.toFixed(2)} className="text-inherit" />
          , so the fit cannot rule out no decay at all — and the policy above
          runs with λ = {data.lambdaUsed}. The belief is therefore flat in the
          attempt index. Context rot is the mechanism this work is built on, and
          on {data.totalTrials} trials it is not yet visible.
        </Note>

        <Note>
          <strong>q is an assumption, not a measurement.</strong> How often a
          human resolves a given failure class was never measured here; the
          values are the proposal&apos;s. Every verdict above inherits them.
        </Note>

        <Note>
          <strong>Two classes have no data.</strong> Broken and Lost are the
          prior alone — zero trials — so their marks show a belief of 0.5
          because nothing has moved it, not because anything was observed.
        </Note>

        <Note>
          <strong>The retry evidence is survivorship-confounded.</strong>{" "}
          {data.survivorship.successes} cells succeeded and{" "}
          {data.survivorship.retriedAfterSuccess} were retried afterwards, so
          the data never observes what retrying after a success would do.
        </Note>

        <Note>
          <strong>These are {data.totalTrials} archive trials, not the sweep.</strong>{" "}
          A class belief needs to know whether a retry succeeded, and no row in
          the live sweep ran a test — it measured only whether a patch applied.
          The 1,604 swept cells cannot contribute to this screen.
        </Note>
      </section>

      <p className="text-ink-muted mt-8 font-mono text-label">{FORMULA}</p>
    </Shell>
  );
}
