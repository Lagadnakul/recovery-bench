"use client";

import { Act } from "@/components/explain/Act";
import {
  LoopScene,
  buildLoop,
  type LoopData,
} from "@/components/explain/scenes/Loop";
import {
  GateScene,
  buildGate,
  type GateData,
} from "@/components/explain/scenes/Gate";
import {
  FormatScene,
  buildFormat,
  type FormatData,
} from "@/components/explain/scenes/Format";
import {
  CollapseScene,
  buildCollapseAct,
  type CollapseActData,
} from "@/components/explain/scenes/Collapse";
import {
  RuleScene,
  buildRule,
  type RuleData,
} from "@/components/explain/scenes/Rule";
import { Shell } from "@/components/shell/Rail";

/**
 * The explainer. Six acts, scrubbed to scroll, each one pinned while it plays.
 *
 * It exists because the other six screens answer questions a reader already
 * knows to ask. This one is for the reader who does not: it builds the problem,
 * then the two findings, then the rule, in the order the argument actually
 * runs. Scrolling it end to end is also the viva demo -- the argument tells
 * itself in sequence, and the examiner controls the pace.
 */

export type HowItWorksData = {
  loop: LoopData;
  gate: GateData;
  format: FormatData;
  collapse: CollapseActData;
  rule: RuleData;
};

export function HowItWorks({ data }: { data: HowItWorksData }) {
  return (
    <Shell current="how-it-works">
      <header className="max-w-prose">
        <h1 className="text-ink text-display">How it works</h1>
        <p className="text-ink mt-3 text-body">
          The whole study, in six scenes. Press play on each one and it runs
          itself, step by step. The numbered buttons jump straight to a step.
        </p>
        <p className="text-ink-muted mt-2 text-small">
          No prior knowledge needed. Every number comes from the measured data;
          the diagrams are labelled where they are only drawings.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-6">
      <Act
        id="act-loop"
        title="An agent that never stops"
        lede="Give an AI agent a bug to fix. When its fix fails, it tries again — and nothing tells it when to give up."
        build={buildLoop}
      >
        <LoopScene data={data.loop} />
      </Act>

      <Act
        id="act-gate"
        title="The question nobody asked"
        lede="The experiment checked one thing about every attempt — and the thing it did not check is why every later screen has to be careful."
        build={buildGate}
      >
        <GateScene data={data.gate} />
      </Act>

      <Act
        id="act-format"
        title="How you ask decides what you get"
        lede="The first finding, and the largest effect anywhere in the study. Nothing about the model changed — only the shape of the answer it was asked for."
        build={buildFormat}
      >
        <FormatScene data={data.format} />
      </Act>

      <Act
        id="act-collapse"
        title="Thinking about the mistake makes it worse"
        lede="The second finding, and the one that contradicts standard advice. Asking a model to explain its failure helps exactly once."
        build={buildCollapseAct}
      >
        <CollapseScene data={data.collapse} />
      </Act>

      <Act
        id="act-rule"
        title="When should it stop?"
        lede="The contribution. A dot, a line, and the claim that every agent shipping today is already this rule with the line jammed at one end."
        build={buildRule}
      >
        <RuleScene data={data.rule} />
      </Act>
      </div>

      <section className="border-rule mt-10 border-t pt-6">
        <p className="text-ink-muted max-w-prose text-small">
          Act 6 is next: what the rule still needs before it is a result.
        </p>
      </section>
    </Shell>
  );
}
