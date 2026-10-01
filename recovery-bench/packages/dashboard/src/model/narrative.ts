/**
 * What the numbers mean, in English.
 *
 * The first build of this dashboard showed `3/3` and `0/4` under four-word
 * labels and never stated the finding those two numbers are. A reader who did
 * not already know the study could not have told you what it concluded.
 *
 * So the sentences live here, derived from the committed figures rather than
 * typed in — if the data changes, the prose changes with it, and a claim can
 * never drift away from the number beside it.
 *
 * The glossary exists for the same reason. "Cell", "lineage", "arm", "round",
 * "format-class" and "instrument limit" are this project's working vocabulary,
 * not English, and every one of them was on screen with no explanation.
 */

import type { Figures } from "./load.ts";

export interface Headline {
  question: string;
  answer: string;
  detail: string;
}

/**
 * The study's question and its answer, built from `headline` in the figures.
 *
 * `recoveredFormat.length === formatTasksEvaluable.length` and
 * `recoveredLogic.length === 0` are the actual result, so the strong wording is
 * guarded by both: if a future run recovers one logic-class task, the sentence
 * stops saying "none" without anyone having to remember to edit it.
 */
export function headline(figures: Figures): Headline {
  const h = figures.headline;
  const fmt = h.recoveredFormat.length;
  const fmtOf = h.formatTasksEvaluable.length;
  const log = h.recoveredLogic.length;
  const logOf = h.logicTasks.length;

  const all = fmtOf > 0 && fmt === fmtOf;
  const none = log === 0;

  const answer =
    all && none
      ? "It fixed every formatting failure, and none of the reasoning failures."
      : `It fixed ${fmt} of ${fmtOf} formatting failures and ${log} of ${logOf} reasoning failures.`;

  return {
    question: "When an AI coding agent fails, can it fix its own mistake?",
    answer,
    detail:
      `${h.baselineResolved} of ${h.baselineN} tasks were solved on the first try. ` +
      `Of the ${h.poolSize} that failed, ${h.evaluable} could be retried` +
      (h.excluded.length > 0
        ? `, and ${h.excluded.length} could not — the provider stopped mid-answer, so nothing about recovery was measured there.`
        : ".") +
      " Each was given three more attempts under three different kinds of help.",
  };
}

/**
 * The two failure classes, explained without the words "format" and "logic".
 *
 * This distinction is the whole thesis, and it is not self-evident from the
 * labels. A reader has to be told that one of these failures was never even
 * tested.
 */
export const FAILURE_CLASS = {
  format: {
    name: "The paperwork was wrong",
    short: "formatting failures",
    detail:
      "The edit was written in a shape the tools rejected, so it never reached the code. Nobody ever found out whether the idea was any good.",
  },
  logic: {
    name: "The thinking was wrong",
    short: "reasoning failures",
    detail:
      "The edit applied cleanly to the code. The tests still failed. The agent understood the format and misunderstood the problem.",
  },
} as const;

/** One line per panel, saying what a reader should take from it. */
export const PANEL_NOTE = {
  pipeline:
    "Every attempt passes through six stages. A drop between two of them is the number of attempts that stage ended.",
  grid: "One line per attempt chain. Each square is one try; colour is how it ended.",
  formats:
    "The same models, asked to write their edits two different ways. This is the comparison the retrofit was built to make.",
  subtests:
    "Not every fix is all-or-nothing. This is how many individual tests moved on one task that was never fully solved.",
  retrofit:
    "The clearest single case: one task, one model, the same three recovery conditions, and only the edit format changed.",
  detail: "Everything recorded about one attempt, including why it ended the way it did.",
} as const;

/** Working vocabulary, defined where it is used. */
export const GLOSSARY: Record<string, string> = {
  cell: "One attempt: one task, one model, one condition, one round.",
  lineage: "A chain of attempts at the same task under the same condition — round 0, then 1, then 2.",
  round: "Which attempt in the chain. Round 0 is the agent's first try; 1 and 2 are retries.",
  arm: "A named group of attempts configured to answer one question.",
  "format-class": FAILURE_CLASS.format.detail,
  "logic-class": FAILURE_CLASS.logic.detail,
  "instrument limit":
    "The attempt ended because of our own budget, token ceiling or a provider error. It measured nothing about the model and is excluded from every rate here.",
  "apply-verified":
    "We checked the edit could be applied to the code. We did not run the tests, so whether it actually fixed the bug is unknown.",
  "test-verified": "The tests were run, so this row knows whether the task was solved.",
  comparable:
    "This attempt was produced the same way as the submitted study's, so the two can be pooled.",
  baseline: "The agent's first attempt, before any help. Everything else is measured against it.",
};

/**
 * Describes a dataset in a sentence, so the replay/sweep switch is not two
 * unexplained words.
 */
export const SOURCE_NOTE = {
  replay: {
    title: "The submitted study",
    note: "Replayed from the archive. The tests were run, so these rows know whether a task was solved.",
  },
  sweep: {
    title: "New runs",
    note: "Fresh attempts on this machine. The edits were applied but no tests were run, so whether they fixed anything is unknown.",
  },
} as const;
