/**
 * Every technical term the console uses, with a plain-English definition.
 *
 * One central record rather than a definition written beside each use, because
 * the failure this prevents is a term meaning one thing on screen 2 and a
 * slightly different thing on screen 6. A reader who has to reconcile two
 * definitions stops trusting both.
 *
 * The editorial rule for the whole console: **plain language first, notation
 * second, never notation alone.** `b = 19, c = 0, p = 3.8e-6` is a complete
 * statement to a statistician and an empty one to everybody else, including the
 * examiner. So every figure carries a sentence that says what it means, and the
 * notation stays underneath as the receipt — the thing a reviewer checks, not
 * the thing a reader is expected to decode.
 *
 * `plain` must be a complete sentence, must not use another glossary symbol to
 * explain this one, and must avoid "simply", "just" and "merely". Writing a
 * definition that needs a second definition is how a glossary becomes decoration.
 */

export type Entry = {
  /** The plain-English name. This is what appears in body text. */
  term: string;
  /** The notation, if the field has one. Shown after the name, never instead. */
  symbol?: string;
  /** One sentence. No symbols, no other glossary terms. */
  plain: string;
  /** Where a reader meets it. Used to build each screen's term list. */
  group: "experiment" | "test" | "policy" | "outcome";
};

const ENTRIES = {
  // ── the experiment ───────────────────────────────────────────────────────
  cell: {
    term: "cell",
    plain:
      "One attempt by one model at one bug, under one set of settings. The experiment ran 1,604 of them.",
    group: "experiment",
  },
  arm: {
    term: "arm",
    plain:
      "One block of the experiment, with its own model and its own question. There are six, and they were run separately rather than pooled.",
    group: "experiment",
  },
  task: {
    term: "task",
    plain:
      "One real bug from a real open-source project, taken from a standard benchmark so the results can be compared with other people's.",
    group: "experiment",
  },
  round: {
    term: "round",
    plain:
      "How many tries in. Round 1 is the model's first attempt at fixing the bug; round 2 is its first retry after being told the first one failed.",
    group: "experiment",
  },
  repeat: {
    term: "repeat",
    plain:
      "The same cell run again from scratch. Models give different answers each time, so every condition was run five times and the results averaged.",
    group: "experiment",
  },
  applied: {
    term: "applied",
    plain:
      "The model's patch was well-formed enough that the repository accepted it. It does NOT mean the bug was fixed — no test was ever run.",
    group: "experiment",
  },
  applyRate: {
    term: "apply rate",
    plain:
      "Out of every patch the model wrote, the share the repository was able to accept.",
    group: "experiment",
  },
  blindRetry: {
    term: "blind retry",
    plain:
      "Tell the model its patch failed and ask it to try again, without showing it what went wrong.",
    group: "experiment",
  },
  reflection: {
    term: "reflection",
    plain:
      "Ask the model to first explain why its last patch failed, then write a new one. The popular fix, and the thing this experiment tests.",
    group: "experiment",
  },
  searchReplace: {
    term: "find-and-replace format",
    symbol: "search_replace",
    plain:
      "The model quotes the exact lines it wants to change and the lines to put in their place.",
    group: "experiment",
  },
  unifiedDiff: {
    term: "diff format",
    symbol: "unified_diff",
    plain:
      "The model writes its change in the format Git uses, which requires it to count line numbers correctly.",
    group: "experiment",
  },
  hole: {
    term: "hole",
    plain:
      "A cell that was planned but never actually ran. It is not a zero and not a failure — nothing is known about it, and the console draws it as blank.",
    group: "experiment",
  },

  // ── the statistics ───────────────────────────────────────────────────────
  pairedTest: {
    term: "paired comparison",
    plain:
      "Compare the two methods on the very same bug, by the same model, on the same try — so anything that makes one bug harder than another cancels out.",
    group: "test",
  },
  discordant: {
    term: "pairs that disagreed",
    plain:
      "The paired attempts where one method worked and the other did not. These are the only ones that carry any information about which method is better.",
    group: "test",
  },
  concordant: {
    term: "pairs that agreed",
    plain:
      "The paired attempts where both methods did the same thing — both worked, or both failed. The test throws these away, because they say nothing about which is better.",
    group: "test",
  },
  bCount: {
    term: "wins for the first method",
    symbol: "b",
    plain:
      "How many disagreeing pairs went in favour of the first method.",
    group: "test",
  },
  cCount: {
    term: "wins for the second method",
    symbol: "c",
    plain:
      "How many disagreeing pairs went in favour of the second method.",
    group: "test",
  },
  mcNemar: {
    term: "exact McNemar test",
    plain:
      "The standard way to ask whether a lopsided set of disagreements is real or luck. It is a coin-flip test: if the two methods were equally good, each disagreement should fall either way with equal chance.",
    group: "test",
  },
  pValue: {
    term: "chance result",
    symbol: "p",
    plain:
      "How often pure luck would produce a result at least this lopsided if the two methods were really equally good. Small means luck is a poor explanation.",
    group: "test",
  },
  rejectionFloor: {
    term: "minimum pairs needed",
    plain:
      "Below six disagreeing pairs this test cannot return a significant answer no matter how lopsided they are, because even a perfect sweep is within easy reach of luck. Under six, the experiment had no chance of detecting anything.",
    group: "test",
  },
  clustering: {
    term: "clustering",
    plain:
      "When most of a result comes from a handful of cases rather than being spread evenly, so the evidence is weaker than the raw count of observations suggests.",
    group: "test",
  },
  survivorship: {
    term: "survivorship gap",
    plain:
      "Nothing was ever retried after it succeeded, so the data cannot say what retrying a success would do. The estimate has to assume it.",
    group: "test",
  },

  // ── the stopping rule ────────────────────────────────────────────────────
  stoppingRule: {
    term: "stopping rule",
    plain:
      "A rule that decides, before each retry, whether trying again is worth it or whether the agent should stop and ask a person.",
    group: "policy",
  },
  belief: {
    term: "chance of success",
    symbol: "p̂",
    plain:
      "The rule's current estimate that one more try will work, based on how often tries like this one have worked before.",
    group: "policy",
  },
  theta: {
    term: "retry threshold",
    symbol: "θ",
    plain:
      "The break-even point. If the chance of success is above it, trying again is worth the cost; if below, it is not.",
    group: "policy",
  },
  failureClass: {
    term: "failure class",
    plain:
      "What kind of thing went wrong. The whole idea is that different kinds of failure deserve different answers — a formatting slip is worth retrying, a wrong idea is not.",
    group: "policy",
  },
  payoffG: {
    term: "value of a fix",
    symbol: "G",
    plain: "What a working fix is worth, in whatever units you like.",
    group: "policy",
  },
  payoffR: {
    term: "cost of a retry",
    symbol: "r",
    plain: "What one more attempt costs — tokens, time, money.",
    group: "policy",
  },
  payoffH: {
    term: "cost of asking a person",
    symbol: "h",
    plain:
      "What it costs to stop and hand the problem to a human, including their time.",
    group: "policy",
  },
  payoffQ: {
    term: "a person's success rate",
    symbol: "q",
    plain:
      "How often a human actually fixes it once the agent gives up and asks. This was never measured; it is assumed.",
    group: "policy",
  },
  lambda: {
    term: "fading factor",
    symbol: "λ",
    plain:
      "How quickly the chance of success drops with each extra attempt. At 1 it does not drop at all, which is what the run actually used.",
    group: "policy",
  },
  myopic: {
    term: "one-step rule",
    plain:
      "Decide by looking only at the very next attempt, as if it were the last one allowed.",
    group: "policy",
  },
  finiteHorizon: {
    term: "look-ahead rule",
    plain:
      "Decide by counting all the attempts still allowed, not only the next one. A failed cheap retry still leaves the others, which can make it worth taking.",
    group: "policy",
  },
  prior: {
    term: "starting guess",
    plain:
      "What the rule assumes before it has seen any evidence at all. Where there were no trials, the line on screen is this guess and nothing more.",
    group: "policy",
  },

  // ── outcomes ─────────────────────────────────────────────────────────────
  malformed: {
    term: "unusable patch",
    symbol: "MALFORMED",
    plain:
      "The model wrote something, but it was not a valid edit — the repository could not even attempt it.",
    group: "outcome",
  },
  applyFail: {
    term: "rejected patch",
    symbol: "APPLY_FAIL",
    plain:
      "The edit was valid but did not fit the file, so the repository refused it.",
    group: "outcome",
  },
  noPatch: {
    term: "no edit offered",
    symbol: "NO_PATCH",
    plain: "The model replied but did not propose any change to any file.",
    group: "outcome",
  },
  noOutput: {
    term: "empty reply",
    symbol: "NO_OUTPUT",
    plain: "The model returned nothing at all.",
    group: "outcome",
  },
  truncated: {
    term: "cut off",
    symbol: "TRUNCATED",
    plain:
      "The model ran out of room mid-answer, so the edit was incomplete through no fault of its reasoning.",
    group: "outcome",
  },
  providerError: {
    term: "no answer",
    symbol: "PROVIDER_ERROR",
    plain:
      "No usable reply came back. Most of these are the harness refusing to make the call on purpose, not the service breaking.",
    group: "outcome",
  },
  byDesign: {
    term: "refused on purpose",
    plain:
      "The harness declined to make the call because the conditions for it were not met. These are a designed property of the experiment, not failures of the model.",
    group: "outcome",
  },
} as const satisfies Record<string, Entry>;

export type TermKey = keyof typeof ENTRIES;

/**
 * Widened to `Entry` on purpose. `as const satisfies` is what checks that every
 * definition is well-formed; exporting the narrowed literal type would mean a
 * consumer reading `.symbol` only compiles for the terms that happen to have
 * one, which makes a generic renderer impossible.
 */
export const GLOSSARY: Record<TermKey, Entry> = ENTRIES;

/**
 * A probability as odds a person can picture.
 *
 * "p = 3.8e-6" is unreadable to most of this console's audience and "highly
 * significant" is worse, because it states a conclusion instead of a fact.
 * "About 1 in 262,000" is the same number, stated so a reader can judge it.
 */
export function chanceInWords(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return "far less than 1 in a million";
  if (p >= 0.999) return "exactly what chance alone would produce";
  if (p >= 0.5) return `about 1 in ${(1 / p).toFixed(1)}`;

  const oneIn = 1 / p;
  // Two significant figures, then grouped -- "1 in 262,000", not "1 in 262,144",
  // which implies a precision the estimate does not have.
  const magnitude = Math.pow(10, Math.floor(Math.log10(oneIn)) - 1);
  const rounded = Math.round(oneIn / magnitude) * magnitude;
  return `about 1 in ${rounded.toLocaleString("en-US")}`;
}

/**
 * How much weight a result deserves, in words rather than stars.
 *
 * Deliberately not "significant" / "not significant". That word has a technical
 * meaning most readers substitute with "important", and the substitution is the
 * single most common way a statistics result gets misread.
 */
export function strengthInWords(p: number, canReject: boolean): string {
  if (!canReject) return "Too few disagreeing pairs for this test to answer";
  if (p < 0.001) return "Luck is a very poor explanation for this";
  if (p < 0.05) return "Luck is an unlikely explanation for this";
  if (p < 0.2) return "Luck explains this about as well as anything else";
  return "This is what chance alone looks like";
}
