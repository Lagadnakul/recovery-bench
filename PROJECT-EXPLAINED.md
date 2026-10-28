# The whole project, explained simply


**Project:** Self-Reflection and Failure Recovery in Agentic AI Coding Systems
**Author:** Lagad Nakul Kiran (2503032340022) · M.Tech, AI & Data Science · PIET, Parul University
**This file written:** 28 October 2026
**What this file is:** everything about this project in plain language — what it is,
why it exists, what it found, what it does not show, and how to talk about it.

---

## How to use this file

**If you are Nakul, or anyone who wants to understand the project:**
read it top to bottom once. It assumes you know nothing. Every number in it was
checked against the real data files, not copied from older documents.

**If you are an AI assistant and someone pasted this file in:**
this is the complete context for the project. Treat every figure here as
verified. Follow the rules in the last section — especially the three honesty
rules — because this project's entire credibility rests on them. Do not soften
the limitations, and do not say "resolved" where the data only says "applied".

---

## 1. The project in one paragraph

An AI coding agent is given a real bug and asked to write a patch that fixes it.
Sometimes the patch fails. Today, every agent that exists just **tries again** —
and keeps trying until it runs out of attempts or money. Nobody has studied the
question underneath that: **after a failure, is one more try actually worth it,
or should the agent stop and ask a human?** This project ran a large experiment
on real bugs to find out when retrying helps and when it hurts, and then proposed
a small mathematical rule that decides, failure by failure, whether to retry or
stop. The experiment is finished. The rule is proposed but not yet fully tested —
and the project says so clearly, on purpose.

---

## 2. The words you need

These are the only terms you have to know. Everything else is ordinary English.

| Word | What it actually means |
|---|---|
| **Agent** | An AI that doesn't just answer — it takes actions. Here: reads a bug report, writes a code change. |
| **Patch** | A code change, written as "delete these lines, add these lines". |
| **Applied** | The repository accepted the patch — the edit went in cleanly. **This does not mean the bug is fixed.** |
| **Resolved** | The bug is actually fixed, proven by running the project's tests. **This study never measured this.** |
| **Retry** | After a failure, ask the model to try again. |
| **Reflection** | Before retrying, tell the model *why* it failed and let it think about its own mistake first. |
| **Escalate** | Stop retrying and hand the problem to a human. |
| **Edit format** | *How* the model is asked to write its change. Two ways were tested — see finding 1. |
| **Failure class** | What kind of failure it was. Four kinds, see section 6. |
| **Round / attempt (k)** | 1st try, 2nd try, 3rd try. The study went up to 4. |
| **Cell** | One single experimental data point: this bug × this model × this strategy × this round. There are 1,604 of them. |
| **Arm** | One batch of the experiment, designed to answer one question. There are 6. |
| **McNemar test** | A statistical test for "did A beat B on the same items?" See section 7. |
| **SWE-bench Lite** | A standard public set of real bugs from real open-source Python projects. The bugs here are real, not invented. |

---

## 3. The question, and why nobody had answered it

Give an AI agent a bug. It writes a patch. The patch fails. What now?

Every coding agent shipping today answers this the same way: **retry, blindly,
until the attempt budget runs out.** Some of them also "reflect" first. None of
them ever asks whether this particular failure is the kind that a retry can fix.

That turns out to matter a lot, because failures are not all the same:

- If the patch was **malformed** — the model wrote the edit in the wrong shape and
  the repository rejected it — a retry has a real chance. Nothing was wrong with
  the idea; only the handwriting.
- If the patch **applied cleanly but the bug is still there** — the model's
  understanding of the problem was wrong — a retry asks the same model the same
  question and will usually get the same wrong answer.

So retrying is sometimes almost free money and sometimes pure waste. **Nobody had
measured which is which, and no agent decides between them.** That gap is the
project.

**The research question, in one sentence:**

> When an AI coding agent's patch fails, how should it decide whether to retry
> or to stop and ask a human?

---

## 4. What was actually built

Three things, all real and all runnable.

### a. The engine — `recovery-bench/`

The experiment itself. TypeScript running on Bun. It can:

- take a real bug, build the prompt, call a model, get a patch back, try to apply it
- repeat that for N rounds with different retry strategies
- record every single attempt to a file, permanently
- re-compute all the published results from scratch, as a check

It has **433 tests across 23 files**. One of those checks matters more than the
others: the engine reproduces the originally submitted dissertation results
**exactly**, through a completely independent code path. If it ever stops
matching, the build fails.

```sh
cd recovery-bench
bun run verify     # every offline check in one command, ~22 seconds
```

### b. The console — `console/`

A website that presents the finished experiment. Next.js, deployed as static
files. Seven screens (see section 11). It is not a product dashboard — the
reference is **laboratory instrumentation**: every mark on the screen stands for
a real number, and nothing decorative is drawn.

### c. The explainer — `console/src/app/how-it-works`

The whole study as six animated acts with a play button. Press play and the
argument tells itself in order, one step at a time. This is the demo: it runs
about 90 seconds and Nakul talks over it instead of scrolling through tables.

| Act | Title | What it shows |
|---|---|---|
| 1 | An agent that never stops | One agent retrying four times, burning 3,956 tokens, fixing nothing |
| 2 | The question nobody asked | The closed gate — the single limitation everything else descends from |
| 3 | How you ask decides what you get | 96.4% vs 13.1%, from one word in the prompt |
| 4 | Thinking about the mistake makes it worse | Reflection helping once, then collapsing |
| 5 | When should it stop? | The stopping rule, as a dot and a moving line |
| 6 | What it still needs | The honest ledger: 2 of 7 quantities measured |

---

## 5. What the experiment actually did

This is the scale, and these numbers are exact.

```
62      real bugs, from real open-source projects (SWE-bench Lite)
1,604   attempts recorded
1,428   of those were real paid model calls
18.1M   tokens spent (18,102,295)
5       different models
6       experiment arms, all completed
```

The five models: `muse_30b`, `nemotron_ultra` (550B), `nemotron_nano`,
`qwen_max`, `gemini_flash`.

### The six arms

| Arm | Attempts | Bugs | Question it answers |
|---|---:|---:|---|
| `a5_format_at_scale` | 720 | **60** | Does the edit format change the result? |
| `a4_reasoning` | 360 | 4 | Does turning on "thinking" help? |
| `a2_workhorse` | 260 | 4 | Does reflection help on a small model? |
| `a3_capability` | 180 | 4 | Does reflection help on a big model? |
| `a6_qwencloud` | 56 | 4 | Does this hold on a fourth vendor? |
| `a1_replication` | 28 | 4 | Re-run the original pilot. Could it ever have worked? |

**One shape of the experiment matters and must never be hidden:** the edit-format
result spans **60 bugs** — it is broad. Every recovery result spans **4 bugs with
5 repeats each** — it is deep but narrow. So "reflection poisons retries" is a
strong signal observed on a small number of bugs. Say that out loud before anyone
asks.

### What happened to those 1,604 attempts

```
APPLIED          718     the repository accepted the patch
MALFORMED        572     the model wrote the edit in a shape that could not be used
PROVIDER_ERROR   176     → 130 refused by design + 46 real failures
NO_PATCH         102     the model produced no patch at all
APPLY_FAIL        17
TRUNCATED         13
NO_OUTPUT         6
```

That `176` line is a trap, and section 9 explains why.

---

## 6. The four failure classes

The whole stopping rule depends on this: **sort the failure first, then decide.**

| Class | Plain meaning | Can a retry help? | Trials behind it |
|---|---|---|---|
| **FORMAT** | The patch was written in the wrong shape and never applied | Yes, often | **10** |
| **LOGIC** | The patch applied, but the bug was still there — the idea was wrong | Almost never | **21** |
| **BROKEN** | The environment itself is broken; no patch can succeed | No — abort | **0** |
| **LOST** | The model lost the thread of what it was doing | Unknown | **0** |

**BROKEN and LOST have zero trials.** They are not measured as zero. They are
**not measured at all** — which is a different and more honest statement. The
console draws them differently from everything else for exactly this reason.

---

## 7. The five findings

Each one has the number, the plain meaning, and a line you can say out loud.

### Finding 1 — How you ask the model to write the edit decides almost everything

Same bugs. Same models. Same instructions. One difference: the model was asked
to write its change in one of two shapes.

| Shape | Plain description | Patches accepted |
|---|---|---|
| `search_replace` | "Quote the lines you want to change, then write the new ones" | **96.4%** |
| `unified_diff` | "Write it the way Git does" — which means counting line numbers | **13.1%** |

That is **7.4× more often**, from the format alone, on 60 bugs.

The statistics are overwhelming: **about 1 in 10 followed by 88 zeros** that
chance alone would produce this (exact McNemar on 360 paired attempts). Even
after throwing away every ambiguous failure, it holds.

**Why it happens:** the biggest single cause of failure in the losing format is
`hunk_count_mismatch` — the model **miscounting how many lines its own change
touches.** That is arithmetic, not comprehension. The model understood the bug
fine; it could not count.

> **Say it like this:** "The largest effect in the entire study has nothing to do
> with how clever the model is. It is a clerical problem. And benchmarks that
> score models on fixing bugs usually fix one format and never report which one —
> so if the format alone moves the result seven times over, two published scores
> are not comparable unless they used the same format."

This finding is the one with the broadest evidence and the most value to other
researchers.

### Finding 2 — Reflection helps once, then poisons

On the 550B model (`nemotron_ultra`), across four rounds:

| Round | Blind retry | Reflection |
|---|---:|---:|
| 1 | 75% | **90%** |
| 2 | 75% | **45%** |
| 3 | 80% | **40%** |
| 4 | 75% | **50%** |

Round 1, reflection wins. From round 2 on, it **collapses to roughly half** and
never recovers.

On rounds 2–4 there were **19 cases where blind retry worked and reflection did
not, and 0 the other way.** Zero reversals in any of the four bugs. The chance of
that pattern arising from luck alone is about **1 in 260,000**.

**Why it happens — and this is a real mechanism, not a guess:**

1. **The model starts reading itself instead of the file.** Of the malformed
   patches after round 1, **all 28** were `search_not_found` — the model quoting
   lines that do not exist in the file, because it is anchoring on its own earlier
   output. Blind retry produced **1**.
2. **It gets more expensive while getting worse.** Average completion tokens with
   reflection climb every round: **1,407 → 1,448 → 1,463 → 1,594**, and run about
   1.8× blind retry's (**799 → 946 → 1,119 → 1,092**).

On the smaller 30B model the effect is **exactly nothing** (4 vs 4, pure chance).
So this is a large-model phenomenon.

> **The prescription: K = 1.** Reflect once. Never twice.

> **Say it like this:** "Telling a large model why it failed makes its first retry
> better and every retry after that worse — it starts correcting its own previous
> answer instead of re-reading the actual code, and it pays more tokens to do it."

### Finding 3 — Capability runs backwards

In three independent places, the **smaller** model beat the bigger one. The
sharpest case: on the hard edit format, the 30B model applied **25.6%** of its
patches and the 550B model applied **0.6%**.

> **Say it like this:** "Bigger is not better at this. The thing being tested is
> careful mechanical compliance, and more reasoning capacity does not buy that."

### Finding 4 — The original pilot could never have worked, and that is now proven

The dissertation's pilot used a small number of bugs. Arm `a1` re-ran exactly that
design and produced **0 discordant pairs** — zero cases where the two strategies
disagreed.

This matters because of how the statistical test works. The exact McNemar test
only looks at the cases where the two strategies **disagree**. Below **6**
disagreeing pairs it is mathematically impossible to reach significance, at *any*
sample size. The floor is 6 and the pilot produced 0.

**This is not low power. It is zero power.** A proper analysis says that
**460–765 bugs** are needed for 80% power. The pre-registered N = 150 gives
between 4.6% and 23.5%.

> **Say it like this:** "The null result in the pilot was not a finding about
> reflection. It was a finding about the experiment. And this is precisely why the
> next paper is a Registered Report — the design gets reviewed *before* the data
> exists, so an honest negative result is publishable instead of being blamed on
> sample size."

### Finding 5 — One of the three strategies never ran at all

The study had three retry strategies: **Blind Retry**, **Reflection-only**, and
**Diagnose+Revise**. The third one needs to know *what actually went wrong* —
which means it needs the project's test output.

The test output was never available (section 9, R1). So Diagnose+Revise was
scheduled **104 times and ran 0 times**. It refused 80 out of 80 in one arm and
16 out of 16 in another, on a different vendor, which confirms it was structural
and not a bug.

**Refusing was the correct engineering decision.** Running it without real error
evidence would have made it behave identically to Reflection-only, and the study
would have reported a third strategy that was secretly the second one.

> **Say it like this:** "The same missing piece that cost us the main measurement
> also starved an entire experimental condition. One cause, and we report both
> consequences."

---

## 8. The contribution: the stopping rule

Everything above is measurement. **This is the new idea**, and it is what makes
this a dissertation rather than a report.

It is called **CC-OS — Class-Conditioned Optimal Stopping.**

### The idea in one sentence

> Sort the failure into its class first, then compare the chance a retry works
> against the chance a human succeeds — adjusted for what each one costs.

### The five numbers it needs

| Symbol | Plain meaning |
|---|---|
| **p** | The chance *this* retry works, given the class of failure and which attempt we are on |
| **q** | The chance a human succeeds instead |
| **G** | What a fix is worth |
| **r** | What one more retry costs |
| **h** | What asking a human costs |

### The rule

Compare what each choice is worth:

```
value of retrying    =  p × G − r
value of escalating  =  q × G − h
```

Retry when the first is bigger. Rearranged, that is the whole rule:

```
RETRY  if   p  >  θ
                    where  θ = q − (h − r) / G
```

**In words:** retry while the chance it works is above a line. The line sits at
"how good a human is", pulled *down* by how much cheaper a retry is than a human.
A cheap retry lowers the bar. An expensive human lowers it further.

**And θ is different for each class.** That is the whole contribution — one line
per kind of failure, not one line for everything.

### What it says with the committed costs

At `G = 1, r = 0.02, h = 0.3`:

| Class | Chance a retry works (p) | The line (θ) | Verdict |
|---|---:|---:|---|
| **FORMAT** | 0.500 | 0.62 | Escalate — *but see below* |
| **LOGIC** | 0.023 | 0.42 | **Escalate** |
| **BROKEN** | (no data) | −0.28 | **Abort** — nothing can work |
| **LOST** | (no data) | 0.32 | (no basis to decide) |

LOGIC is the clean case: a 2.3% chance against a 42% bar. Don't retry. Ask a human.

### The part that is genuinely interesting

For FORMAT, the simple rule above says escalate — but the **full** rule disagrees
and says **retry.**

The simple version asks "is this one retry worth it?" The full version asks "is
this retry worth it, *given that I still have more attempts after it*?" Because a
retry here is almost free (r = 0.02) and there are attempts left, the option to
keep trying has value of its own. That flips the decision.

> **Say it like this:** "The rule has to look at the whole remaining budget, not
> just the next attempt — and the data shows exactly where that distinction
> changes the answer."

This is solved by **backward induction over the remaining attempts**, which
computes in O(K) — fast enough to run inside a real agent.

### Why there are four "arms" and why they are the same algorithm

This is the cleanest part of the design, and a professor will like it.

| Arm | What it is | How it is implemented |
|---|---|---|
| **A · Stubborn** | Every agent shipping today | the same rule, with θ set to −∞ (always retry) |
| **B · Needy** | The naive "just add a human" answer | the same rule, with θ set to +∞ (always escalate) |
| **C · Random** | The control that makes it science | the same rule, ignoring the class |
| **D · CC-OS** | The contribution | the same rule, with the real θ per class |

**There is one `decide()` function.** The four arms are four different values
handed to it. So the comparison is not "my system vs their systems" — it is one
algorithm at four settings, which removes the usual objection that the baselines
were implemented badly on purpose.

### How sensitive is it?

Very — and the console lets you see it. The decision for FORMAT flips when the
"how good is a human" number passes **0.78**. For LOGIC it flips at **0.30**.
Neither of those numbers has been measured. Drag the sliders on screen 6 and the
verdicts change in front of you. That is deliberate: it shows the honest shape of
the contribution rather than hiding it.

---

## 9. The three honesty rules

These are the most important part of this document. They are not disclaimers —
they are design constraints, and they are also the project's **strongest feature**,
because a reviewer who finds an unstated limitation discounts everything else.

### R1 — "Applied" is not "Resolved"

To check whether a bug is really fixed, you have to run the project's tests, which
needs a container (Docker). That was ruled out early for sound reasons. So across
all 1,604 attempts, the study asked **"did the repository accept this patch?"** and
**never once** asked **"did the test pass afterwards?"**

**A patch that applies perfectly and fixes nothing counts here as a success.**

Every screen that shows an apply rate says this in the body text, not in a
footnote. This is why the console never uses the word *resolved*.

> **Say it like this, before anyone asks:** "This study measures whether patches
> apply, not whether bugs get fixed. That is a stated limitation, it is the same
> limitation on every figure, and section 10 says exactly what it cost us."

### R2 — 130 refusals are not 46 errors

176 attempts are recorded as `PROVIDER_ERROR`. Printing that number directly says
*"the API failed 176 times"*, which is **false**. It is three different things:

| | Count | What it actually is |
|---|---:|---|
| **STARVED** | 98 | Diagnose+Revise, which could not run on *any* row — a structural limit of the design |
| **CASCADE** | 32 | A reflection round whose earlier attempt had died, so there was nothing to reflect on |
| **REAL** | 46 | Genuine failures: 27 HTTP 503, 15 timeouts, 2 HTTP 404, 2 other |

98 + 32 = **130 by-design refusals**. Plus 46 real = 176.

**And the 32 are a subset of the 130, not a separate group** — so reporting "130
refused" and "32 holes" as two separate figures double-counts them. The code
asserts this relationship in a test so it cannot drift.

### R3 — 32 cells never ran. They are holes, never zeros

An empty cell in a results table reads as a measured zero. These 32 are **absences**
— they are drawn as gaps, with an explicit count and a named reason for each.

**And one more rule:** anything drawn to illustrate a claim rather than to report a
measurement is labelled *"Expected shape, drawn to illustrate the claim — not
measured data."*

---

## 10. What this project does *not* show

The stopping rule needs seven quantities. **Two of them were measured.**

| What the rule needs | Where it came from |
|---|---|
| Chance a retry works — FORMAT | **measured · 10 trials** |
| Chance a retry works — LOGIC | **measured · 21 trials** |
| Chance a retry works — BROKEN and LOST | no evidence · **0 trials** |
| How often a human succeeds instead (q) | chosen, not measured |
| What a fix is worth, and what each option costs (G, r, h) | chosen, not measured |
| How fast the chance fades with each attempt (λ) | **inconclusive** |
| What retrying after a success does | **never observed** |

**2 of 7.** That is why the rule is called a **proposal**, not a result.

### The one worth understanding: λ

The whole thesis rests on the idea that a retry's chance of working **fades** with
each attempt — that is why you should eventually stop. That fading factor is λ.

It was fitted, and came out at **0.724** (fading). But the range it could
plausibly be runs from **0.121 all the way to 1.000** — and λ = 1 means **no
fading at all.** Since the data cannot rule out "no fading", the honest choice was
to run the policy at **λ = 1**, the null.

> **So the central idea of the thesis is not yet visible in its own data.** The
> project states this itself, in the source: *"the pilot provides no evidence that
> context rot exists at all."*

There is also a **survivorship problem** behind it: of 10 successes, **0** were
ever retried afterwards. So later-round numbers are only computed over attempts
that had already failed — which mixes "the chance is fading" together with "the
remaining bugs were the harder ones". The estimate is biased downward and the
project says so.

### The one change that would fix most of it

**Run the project's tests after applying a patch.**

That single change turns "the edit was accepted" into "the bug was fixed", makes
BROKEN and LOST visible for the first time, un-starves Diagnose+Revise, and
replaces 31 hand-checked trials with real evidence at scale.

> **Say it like this:** "One missing piece — test execution — cost this study its
> main measurement, one of its three strategies, and most of the evidence behind
> its rule. It is the same cause each time, and it is the first thing the next
> study fixes."

---

## 11. The console, screen by screen

| Screen | What it answers |
|---|---|
| **How it works** | The whole study as six animated acts with a play button. Start here. |
| **Overview** | The scale, the headline numbers, the strategy that never ran, and the three honesty rules |
| **Recovery** | Finding 2 — reflection helping once then collapsing, with its mechanism |
| **Edit format** | Finding 1 — 96.4% vs 13.1%, and why |
| **Failure classes** | The four classes, with BROKEN and LOST drawn as *not measurable*, not as zero |
| **Cells** | All 1,604 attempts, searchable and sortable, each one openable down to its actual patch |
| **Stopping rule** | The contribution, live — drag the cost sliders and watch the verdicts flip |

Design choices worth knowing if anyone asks:

- **One accent colour**, and it marks measured values only. All other colour is grey
  and means nothing — which is exactly what makes the accent read as loud.
- **Every number is in a monospace font** with aligned digits. Nothing a reader
  might compare to another number is set in the body typeface.
- **Plotted marks have square corners.** A rounded corner on a data mark is a lie
  about precision.
- **Light theme only, on purpose** — the figures get printed, and a design that
  survives greyscale is the same design that survives print.
- **The two failure classes are told apart by texture, not hue** (FORMAT solid,
  LOGIC hatched), so they still work photocopied or for a colour-blind reader.
- **Motion in three places only**, and `prefers-reduced-motion` turns it off.

---

## 12. Likely viva questions, and the answers

**"Where is the algorithm?"**
Screen 6, and it is live. One function, four settings — Stubborn, Needy, Random,
CC-OS. Drag the cost sliders and the decision boundary moves in real time.

**"Did you fix the bugs?"**
No, and that is stated everywhere. The study measures whether a patch *applies*.
Measuring whether a bug is *fixed* requires running the project's tests in a
container, which was out of scope. It is the project's main limitation and the
first thing the next study fixes.

**"Your pilot found nothing. Isn't that a failed experiment?"**
It found that the design had **zero** power — not low power, zero. The exact test
cannot reach significance below 6 disagreeing pairs, and the design produced 0.
That is a real, reportable finding about experimental design, and it is why the
next paper is a Registered Report: the design gets reviewed before the data
exists.

**"Only 4 bugs for the reflection result?"**
Four bugs with five repeats each, across four rounds — 19 to 0 with no reversals
in any bug, plus two independent mechanisms (28 of 28 self-anchoring failures, and
token cost rising every round). It is narrow and it is stated as narrow. The
format result is the broad one, at 60 bugs.

**"What is actually new here?"**
Two things. First, the finding that **reflection depth is harmful past K = 1** on
large models, with a mechanism. Second, the **stopping rule itself** — nobody has
proposed a class-conditioned stopping criterion for agentic retries, and it
reduces to a one-line comparison that a real agent can compute in O(K).

**"How much of the rule is actually measured?"**
Two of the seven quantities. The project says so on its own last screen, and
explains which single change would fix most of it.

**"Is the code trustworthy?"**
433 tests. The engine reproduces the originally submitted results exactly through
an independent code path, and that check runs on every build. All 1,604 raw rows
are committed, so anyone can recompute every figure.

---

## 13. What is left to do

| Item | Status |
|---|---|
| The experiment | **Done.** 1,604 rows, 6 arms, all committed |
| The console, 7 screens | **Done** |
| The animated explainer, 6 acts | **Done** |
| The 90-second demo | **Done** — the explainer *is* the demo |
| Deploy the console publicly | Config is ready; needs the host's root directory set to `console` |
| Archive the data for a permanent DOI | Blocked on where the repository will finally live |
| The sample size and margin for the next study | Needs a decision with supervisors |
| Rename `block_unterminated` in the engine | Optional, but do it before the paper quotes it — 182 patches carry a misleading label (164 of 181 in one arm *did* close the block; what was missing was the divider) |

### Where this is going

Semester 4 builds the thing no coding agent has today: a rule that decides whether
another attempt is worth making. The target is a **Registered Report at MSR 2027**
(abstract due 13 November 2026), with the full results in *Empirical Software
Engineering*.

A Registered Report is reviewed on its **plan**, before any data exists. If the
design is sound, the reviewers promise in writing to publish whatever the study
finds — **including nothing.** That is what turns the pilot's null result from a
liability into something you are allowed to go and confirm properly.

---

## 14. Fact sheet

Every figure below was verified against the data files, not copied from prose.
Quote these; do not re-derive them.

```
SCALE
rows / attempts            1,604
real model calls           1,428
tokens                     18,102,295
distinct real bugs         62
models                     5
arms                       6  (all completed)

OUTCOMES
APPLIED                    718
MALFORMED                  572
PROVIDER_ERROR             176   = 130 by design + 46 real
NO_PATCH                   102
APPLY_FAIL                 17
TRUNCATED                  13
NO_OUTPUT                  6

PROVIDER_ERROR, split
starved (by design)        98
cascade (by design)        32    <- a SUBSET of the 130, not separate
real failures              46    = 27x503 + 15 timeouts + 2x404 + 2 other

MALFORMED, by reason
hunk_count_mismatch        206
block_unterminated         182   <- mislabelled; show as "divider missing"
search_not_found           86
no_file_header             80
search_not_found_whitespace 17
hunk_header_unparseable    1

STRATEGY TOTALS
l0_baseline                812
l1_blind_retry             344
l2_reflection              344
l2_5_diagnose_revise       104   <- scheduled 104, ran 0

FINDING 1 - edit format
search_replace apply       96.4%   (347 of 360)
unified_diff apply         13.1%   (47 of 360)
ratio                      7.38x
pairs                      360
exact McNemar p            7.44e-89   (3.32e-65 after discarding ambiguous)
bugs                       60
top mechanism              hunk_count_mismatch, 206 of 304 FORMAT rows

FINDING 2 - reflection collapse (nemotron_ultra, 550B)
blind retry, rounds 1-4    75 / 75 / 80 / 75   (%)
reflection, rounds 1-4     90 / 45 / 40 / 50   (%)
rounds 2-4: b=19, c=0      19 discordant of 60 pairs, 0 reversals in 4 bugs
exact McNemar p            3.8e-6
30B model                  b=4, c=4, p=1.000   (exactly null)
reflection tokens          1407 -> 1448 -> 1463 -> 1594
blind retry tokens         799 -> 946 -> 1119 -> 1092   (climbs 37%, NOT flat)
self-anchoring             all 28 post-round-1 MALFORMED are search_not_found
                           (against 1 for blind retry)
prescription               K = 1

FINDING 3 - inverse capability
30B on unified_diff        25.6% apply
550B on unified_diff       0.6% apply

FINDING 4 - power
a1 discordant pairs        0
rejection floor            6     (below this, power is zero at any N)
80% power needs            460-765 bugs
pre-registered N = 150     gives 4.6% to 23.5%

THE STOPPING RULE
payoffs                    G = 1,  r = 0.02,  h = 0.3
rule                       RETRY iff  p > theta,  theta = q - (h-r)/G
FORMAT   q=0.9  theta=0.62  p=0.500   myopic ESCALATE, finite-horizon RETRY
LOGIC    q=0.7  theta=0.42  p=0.023   ESCALATE
BROKEN   q=0.0  theta=-0.28 (no data) ABORT
LOST     q=0.6  theta=0.32  (no data) no basis
flip points              FORMAT at q=0.78,  LOGIC at q=0.303
evidence behind p        FORMAT 5 of 10,  LOGIC 0 of 21  (31 archive trials)
lambda estimate          0.724, 95% interval [0.121, 1.000]
lambda used              1  (no decay) - the stated null
lambda isMeasured        false
survivorship             10 successes, 0 ever retried after -> confounded
```

### The dataset warning

There are **two** correct-but-different evidence sets, and they look like a
contradiction when quoted side by side:

| Set | FORMAT recovery | LOGIC recovery | Used for |
|---|---|---|---|
| The **20-task pilot matrix** | **3 of 3** | 0 of 4 | the dissertation's headline table |
| The **31 hand-triaged archive trials** | **5 of 10** | 0 of 21 | fitting the stopping rule |

Both are right. They are **not the same evidence.** Always name which one a figure
comes from, because `3 of 3` sitting next to a class belief of `0.500` reads as an
error and is not one.

---

## 15. Rules for an AI reading this file

If you are an assistant and this file is your context, follow these:

1. **Never say "resolved", "fixed", or "solved the bug"** about anything in the
   live sweep. Say "the patch applied". R1 is absolute.
2. **Never print "176 provider errors"** as a single figure. Split it: 130 by
   design, 46 real. And remember the 32 cascade cells are inside the 130.
3. **Never render a never-run cell as 0.** 32 cells are holes. BROKEN and LOST
   have zero trials, which means *not measured*, not *measured as zero*.
4. **Never say the fading factor λ is measured.** It is inconclusive, its interval
   reaches 1.000, and the policy ran at λ = 1.
5. **Always name the dataset** when quoting a recovery rate — pilot matrix (3 of 3)
   or archive trials (5 of 10).
6. **Do not call the stopping rule a result.** It is a proposal. 2 of its 7 inputs
   are measured.
7. **Avoid the word "significant"** in prose — readers substitute "important".
   State the chance in plain words instead: "about 1 in 260,000 that chance alone
   would do this."
8. **State limitations before they are asked about.** On this project that is the
   strength, not the weakness. An examiner who finds an unstated limitation
   discounts the whole artifact; one who sees it stated first trusts the rest.
9. **Plain sentence first, notation second.** Write "about 1 in 260,000 that chance
   alone would produce this (19 cases one way, 0 the other)" — never the symbols
   alone.
10. **Never read or print the values in `.env.local`.** It holds live API keys.
    Variable names are fine; values never.
11. **Two files must never be edited:** `Documents/Self.docx` (the submitted
    dissertation) and `reports/data/master_table.md` (the oracle the engine is
    checked against).
