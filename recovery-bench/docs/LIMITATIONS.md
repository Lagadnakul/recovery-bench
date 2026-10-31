# Limitations

Every figure here was re-derived from `data/sweep_rows.jsonl` and `data/ccos.json`, not
copied from prose. Where a number in another document disagrees with one here, this file
is the one that was checked last.

This document exists so that a reviewer does not have to find these themselves. Nothing
below was discovered by a reviewer; all of it was found by the authors and is stated
before it is asked for.

---

## 1. The headline limitation: nothing here measures whether a bug was fixed

Every one of the 1,604 live attempts was verified by asking **"did the repository accept
this patch?"** and never **"did the test pass afterwards?"**

```
verification   "apply"   on every live row, with no exceptions
evidenceSource "none"    on every live row, with no exceptions
```

This is not an oversight in reporting; it is what the run could do. Running the
projects' test suites needs a container runtime the run did not have access to.

**Consequences that follow, and which must not be softened:**

- The word *resolved* cannot be used of any live result. A patch that applies cleanly and
  fixes nothing counts here as a success.
- The `LOGIC` failure class — *the patch applied and the test still failed* — is
  **structurally unreachable** in this data. Classifying all 1,604 attempts yields
  `FORMAT 710`, `BROKEN 46`, **`LOGIC 0`, `LOST 0`**. The two zeros are absences, not
  measurements, and any chart that draws them as bars at zero is lying with a true
  number.
- Because `LOGIC` is the class the stopping rule most depends on, the policy in §4
  cannot be fitted on the new data at all. It rests on 31 older trials.

**What would fix it:** run each project's test suite after applying the patch. That is a
practical obstacle, not a conceptual one.

---

## 2. Three counts that are routinely merged, and must not be

Of 176 `PROVIDER_ERROR` outcomes:

| Count | What it is |
|---:|---|
| **98** | the harness refused because the condition needed real error evidence it could not collect |
| **32** | the harness refused because an earlier attempt in the same chain had already died |
| **46** | a genuine failure of the service |
| **130** | = 98 + 32, *refused by design* — a property of the experiment, not of any model |

Two errors are easy to make here and both have been made in drafts of this work:

1. **Reporting "176 errors".** That triples the real error count and makes every model
   look worse than it was.
2. **Reporting "130 refused by design" alongside "32 cells never ran".** The 32 are a
   **subset** of the 130, not a separate population. Adding them double-counts 32 cells.

`outcome.status === null` is **not** a usable discriminator for this split. It matches
145 rows, not 130, because timeouts also carry a null status. The split must be made on
`outcome.reason`.

---

## 3. The two headline results have opposite shapes, and only one travels

### The edit-format result is broad

**Now measured over every instance in SWE-bench Lite.** `search_replace` **96.1%**
against `unified_diff` **13.6%**, paired on the same bug, model and prompt. Exact
McNemar on **495 discordant of 587 pairs**, p = 4.79e-138, across **all 300 tasks**.

The 60-task figure it replaces was `b = 301, c = 1` of 360 pairs, p = 7.44e-89. Going
to the full benchmark did not soften the effect, it sharpened it.

| format | model | applied | rate |
|---|---|---:|---:|
| `search_replace` | `muse_30b` | 283 / 293 | 96.6% |
| `search_replace` | `nemotron_ultra` | 286 / 299 | 95.7% |
| `unified_diff` | `muse_30b` | 74 / 293 | 25.3% |
| `unified_diff` | `nemotron_ultra` | 6 / 296 | **2.0%** |

One caution specific to how this is queried: the result spans **two arms**. a7's resume
correctly skipped the 240 cells a5 had already measured in exactly the same shape, so
filtering rows on `arm == "a7_format_full_benchmark"` returns 240 of the 300 tasks. The
unit is the cell shape (`l0_baseline`, `repeat 0`, both formats, both models), not the
arm label. See **D42**.

This is the one result in the study with breadth. The main caution is §1: it measures
which format *applies*, not which format is *correct*.

### The reflection result is deep and narrow

Blind retry 75 / 75 / 80 / 75 across rounds 1–4; reflection **90 / 45 / 40 / 50**. Exact
McNemar on rounds 2–4: **b = 19, c = 0** of 60 pairs, p = 3.8e-6.

**It rests on 4 tasks**, 5 repeats each, one model. And the 19 discordant pairs are not
19 independent observations — they cluster:

```
django__django-11019   10 of 19
django__django-11283    5
astropy__astropy-7746   2
django__django-11564    2
```

One task supplies **more than half the signal**. The effective sample is nearer 4 than
19 and the result should be read that way.

**It also does not replicate across models.** Three arms, three different answers,
reported as three rather than averaged into one that describes none of them:

| Arm | Model | Result |
|---|---|---|
| `a3_capability` | 550B | b = 19, c = 0 — the result |
| `a2_workhorse` | 30B | b = 4, c = 4, p = 1.000 — null |
| `a4_reasoning` | reasoning | b = 5, c = 9, p = 0.42 — leans the *other* way |

One analysis note that matters for anyone re-running this: `a4_reasoning` crosses the
`thinking` dimension within the arm, so a pair key that omits it produces two rows per
side and **drops all 60 pairs**, returning `n = 0`. An `n = 0` rendered as "no effect
found" when it means "no pairs formed" is a reporting failure, not a null result.

---

## 4. The stopping rule is a proposal, not a result

It is fitted on **31 hand-triaged archive trials**, because §1 means the 1,604 new
attempts cannot contribute a single observation to it.

```
FORMAT   10 trials,  5 successes
LOGIC    21 trials,  0 successes
BROKEN    0 trials  — prior only
LOST      0 trials  — prior only
```

**Four separate things in the policy are assumed rather than measured.**

### 4.1 λ is not measured

The fit ran and returned λ̂ ≈ **0.724**, but its 95% likelihood-ratio interval is
**[0.121, 1.000]**. It reaches 1, so it **cannot rule out no decay at all**. Therefore
`excludesNoDecay` is false, `isMeasured` is false, `reportedLambda` returns `null`, and
**the committed policy ran at λ = 1** — the belief is flat in the attempt index.

Two computed reasons, not arguments: **3 of the 5 observation cells sit at a rate of
exactly 0 or 1** (partial separation), and 31 trials is too few to separate decay from
noise.

Context rot is the mechanism this work is built on. **On this data it is not visible.**
`BUILD.md` carries a design instruction reading *"λ is measured, not tuned"*; that was
the plan, and this is the outcome. `analysis/ccos.ts` states the same conclusion in its
own header.

### 4.2 `q` was never measured

`q` is how often a human resolves a given failure class once the agent gives up. It is
`0.9` for FORMAT, `0.7` for LOGIC, `0.6` for LOST, `0` for BROKEN — **all assumed**.
Every threshold and every verdict inherits them, because θ_c = q_c − (h − r)/G.

### 4.3 Two of the four classes have no evidence *in the archive*

In the fitted CC-OS model, `BROKEN` and `LOST` have **zero trials**. Their beliefs sit at
the 0.5 prior because nothing moved them, not because anything was observed. Any line
drawn for them there is an assumption rendered as a chart.

**Both now have live evidence, and it did not come from re-analysis.** `bun run
live-triage` classifies the sweep with the same `triageAttempt` function:

| | archive (51 records) | live sweep (1,989 rows) |
|---|---:|---:|
| `BROKEN` | 0 | **202** |
| `LOST` | 0 — unreachable | **6 of 216 trajectories** |

`LOST`'s archive zero was never a statement about model behaviour. `lostAt` needs a
window of 3 consecutive attempts, so the class needs a *fourth* attempt to exist before
it can fire once — and `runs.ts:19` declares `RoundId = "R0" | "R1" | "R2"`. **The class
was unfalsifiable because the archive's round identifier could not count past two.** The
live rows run `r0 … r4`. See **D39**, and `docs/live_triage.md` for the full table.

Two cautions travel with that, and neither is optional:

1. **`LOGIC` is now the unobservable one.** It requires `resolved === false`, which
   requires test verification, which requires Docker (D6). `tsc` rejected the branch that
   would have read it — `SweepRecord.verification` is the literal `"apply"`, so the type
   system refuses to let a live row be treated as test-verified. The archive's 25 `LOGIC`
   records remain the only evidence for that class, at n = 51. **The two datasets are
   complementary, not substitutes: neither is a superset of the other.**
2. **The 6 `LOST` firings come from 2 distinct tasks** across repeats, so they are not 6
   independent observations — the same clustering §3 records for the McNemar result.

What they do support is a *second, independent* line of evidence for §3's reflection
finding, on a measure that never looks at whether a patch applied:

| Strategy | Eligible trajectories | `LOST` fires |
|---|---:|---:|
| `l1_blind_retry` | 38 | **0** |
| `l2_reflection` | 36 | **6** |

Exposure is matched; the outcome is not. Jaccard novelty over patch content and exact
McNemar over apply outcomes point the same way, and the mechanism in §8 item 2 — the
model quoting its own previous attempt — predicts exactly this signature.

### 4.4 The retry evidence is survivorship-confounded

**10 attempts succeeded and 0 were retried afterwards.** The data has therefore never
once observed what retrying something that already worked does, and the model has to
assume it.

### 4.5 The costs are not measured either

`G = 1, r = 0.02, h = 0.3` are stipulated. The verdict is **entirely cost-driven**: at
these values the rule says *ask a human* about FORMAT, and raising `h` past **0.42**
flips it to *retry*. A policy whose output turns on three unmeasured numbers is a
framework, not a finding.

### 4.6 The one-step and look-ahead forms disagree

At the committed payoffs the myopic rule and the finite-horizon rule give **different
answers for FORMAT** — the one class that ever recovered. This is reported as a finding
in favour of the horizon form rather than hidden, but it does mean a reader who
implements the myopic version gets a different policy.

---

## 5. The pilot design had zero power, and this was demonstrated

The exact test **cannot reach α = 0.05 on fewer than 6 discordant pairs**, whatever the
sample size: the most extreme split of *m* pairs gives p = 2 × (½)^m. Below 6 the
rejection region is empty, so power is not low — **it is zero**.

`a1_replication` re-ran the original pilot design and produced **1 discordant pair**.
Against a floor of 6, that design could not have detected anything.

For the registered study: 80% power on the logic pool needs **460–765 tasks** depending
on effect size. The pre-registered **N = 150** gives H1 between **4.6% and 23.5%**.

---

## 6. Scope

- **62 tasks**, all from SWE-bench Lite, all Python. No other language, ecosystem or
  repository style is represented.
- **5 models**, chosen by what was reachable and affordable, not by sampling a defined
  population.
- **1,428 of 1,604** attempts actually reached a model; the remaining 176 are §2.
- **18,102,295 tokens.** Cost shaped the design: the recovery arms are 4 tasks deep
  rather than broad because breadth was unaffordable.
- The arms are **deliberately not pooled.** Each used a different model or asked a
  different question, so an average across them would describe none of them.

---

## 7. Known defects in the record itself

- **`block_unterminated` is a misleading engine label.** 182 patches carry it, which
  says the model never closed its edit block. On inspection it mostly did — what was
  missing was the `=======` divider. The console relabels it for display and leaves the
  stored value untouched. **Rename it in the engine before the paper quotes it.**
- **Two datasets are easily confused.** The 20-task pilot matrix reports Format
  recovering **3 of 3**; the 31-trial archive the stopping rule is fitted on reports the
  same class at **5 of 10**. Both are correct and they are different evidence. Cited
  side by side without labels they read as a contradiction. Always name the dataset.
- **Some derived JSON carries a generation timestamp**, so it differs on every run even
  when no value changed. That makes it undiffable and eventually gets a timestamp
  committed as if it were a result.

---

## 8. What this work does establish

Stated plainly, so the limitations above are not mistaken for a retraction:

1. **The edit format decides whether a patch applies**, by a margin large enough that
   benchmarks reporting bug-fix ability without stating their format are not comparable
   with each other.
2. **Reflection helps once and then harms**, on one model, on four tasks, with the
   mechanism identified: after round 1, **every** malformed patch reflection produced
   failed because the search text it quoted was not in the file — it was quoting its own
   previous attempt — against exactly **1** such failure for blind retry.
3. **The pilot design could not have worked**, demonstrated by re-running it rather than
   argued from power curves.
4. **A class-conditioned stopping rule is implementable**, with its four thresholds
   derived from one parameterised policy — a structural claim, checked by enumeration,
   not an assertion.

Items 1–3 are empirical results within the scope of §6. Item 4 is a method
demonstration, and §4 is the list of what it still needs before it is a result.
