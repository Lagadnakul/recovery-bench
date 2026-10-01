/**
 * The hero: the question, the answer, and the two numbers that are the answer.
 *
 * This did not exist in the first build, and its absence was the single biggest
 * problem with it. A reader arrived at a toolbar, four small numbers and six
 * grey panels, and nothing anywhere said what the study asked or what it found.
 *
 * The two cards are filled with the hue of the class they report. That is the
 * one place a status colour is allowed to be a field rather than a chip,
 * because here the colour and the claim are the same thing: ochre *is*
 * format-class, and this card is about format-class.
 *
 * The denominators are different (3 and 4) and both are shown. One is not a
 * percentage of the other, and 3/3 beside 0/4 is only honest with its
 * denominator attached.
 */

import type { Figures } from "../model/load.ts";
import { FAILURE_CLASS, headline } from "../model/narrative.ts";

function Card({
  value,
  of,
  title,
  sub,
  detail,
  fill,
  ink,
  border,
}: {
  value: number;
  of: number;
  title: string;
  sub: string;
  detail: string;
  fill: string;
  ink: string;
  border: string;
}) {
  return (
    <div
      className="card-fill flex flex-col gap-1"
      style={{ background: `var(${fill})`, borderColor: `var(${border})` }}
    >
      <p className="t-micro m-0" style={{ color: `var(${ink})` }}>
        {sub}
      </p>
      <p className="t-stat m-0" style={{ color: `var(${ink})` }}>
        {value}
        <span className="text-[0.46em] font-bold opacity-60">/{of}</span>
      </p>
      <p className="m-0 text-[15px] font-bold" style={{ color: `var(${ink})` }}>
        {title}
      </p>
      <p className="m-0 max-w-[42ch] text-[13px] leading-snug" style={{ color: `var(${ink})` }}>
        {detail}
      </p>
    </div>
  );
}

export function Hero({ figures }: { figures: Figures }) {
  const h = headline(figures);
  const d = figures.headline;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="hero-q">
      <div className="hero px-6 py-7 sm:px-8 sm:py-9">
        <p className="t-micro m-0" style={{ color: "var(--on-hero-soft)" }}>
          Self-reflection and failure recovery in agentic AI coding systems
        </p>
        <h1 id="hero-q" className="t-hero mt-2 max-w-[22ch]">
          {h.question}
        </h1>
        <p
          className="mt-4 mb-0 max-w-[46ch] text-[17px] font-semibold"
          style={{ color: "var(--on-hero)" }}
        >
          {h.answer}
        </p>
        <p
          className="mt-3 mb-0 max-w-[62ch] text-[14px]"
          style={{ color: "var(--on-hero-soft)" }}
        >
          {h.detail}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          value={d.recoveredFormat.length}
          of={d.formatTasksEvaluable.length}
          sub="recovered"
          title={FAILURE_CLASS.format.name}
          detail={FAILURE_CLASS.format.detail}
          fill="--format-soft"
          ink="--format-ink"
          border="--format"
        />
        <Card
          value={d.recoveredLogic.length}
          of={d.logicTasks.length}
          sub="recovered"
          title={FAILURE_CLASS.logic.name}
          detail={FAILURE_CLASS.logic.detail}
          fill="--logic-soft"
          ink="--logic-ink"
          border="--logic"
        />
      </div>
    </section>
  );
}
