# How to write and submit this research paper

**For:** Aayush + Nakul · first research paper
**Target:** written by end of November 2026, submitted, accepted before June 2027
**Status:** plan. Nothing here is built yet.

---

## The one thing to understand before anything else

You think the order is:

```
   build the code  →  run it  →  get results  →  write the paper
```

**For what we are doing, the order is the opposite:**

```
   write the plan  →  get it APPROVED  →  then build the code  →  then run it
```

This is called a **Registered Report**, and it is the single most important
decision in this document. Everything below depends on it.

### Why

A normal paper is judged on its *results*. Reviewers see the numbers first. If
the numbers are boring, or if there were only 4 of them, they reject it.

Nakul's pilot found **0 out of 4** logic failures recovered. That is an honest
and correct result. It is also, in a normal submission, a near-certain rejection,
because empirical software engineering has a written rule for it:

> *"A negative result due primarily to lack of statistical power (small samples)
> is not a negative result, rather a poorly designed experiment."*

A Registered Report is judged on the *plan*, before any data exists. Reviewers
look at the research questions, the method, and the sample size. If the design
is sound they give **In-Principle Acceptance** — a written promise to publish
whatever the study finds, including nothing.

**So the null result stops being a liability and becomes the thing you are
allowed to go and confirm properly.**

---

## 1. What a research paper actually is

Neither of you has written one. So, plainly: a research paper is an argument
with evidence, in a fixed shape. The shape is called **IMRaD**.

| Section | The question it answers | Roughly |
|---|---|---|
| **Abstract** | What did you do and what did you find? | 200 words |
| **Introduction** | Why should anyone care? | 1 page |
| **Related Work** | What do we already know, and what is missing? | 1 page |
| **Method** | Exactly what will you do? | 2 pages |
| **Results** | What happened? | — *(Stage 2)* |
| **Discussion** | What does it mean? | — *(Stage 2)* |
| **Threats to Validity** | How could you be wrong? | half a page |
| **Conclusion** | So what? | short |

A Registered Report Stage 1 is **only the top half** — everything up to and
including Method. Results and Discussion come later, after you run the study.

**Six pages plus one page of references.** That is the entire November deliverable.

### The one rule that governs all of it

Every sentence is one of three things:

1. Something **you did** — say it plainly and precisely enough to repeat.
2. Something **someone else found** — cite it.
3. Something **you are claiming** — show the evidence in the same paragraph.

A sentence that is none of those three gets deleted. That single rule will
carry you through most of the writing.

---

## 2. Where we are submitting

### Primary: MSR 2027 Registered Reports

Mining Software Repositories, co-located with ICSE 2027 in Dublin. IEEE/ACM
proceedings. Scopus indexed. One of the main venues in the field.

| | Date |
|---|---|
| Abstract due | **13 November 2026** |
| Report due | **20 November 2026** |
| Reviews come back | 23 December 2026 |
| Revision due | 15 January 2027 |
| **Decision (In-Principle Acceptance)** | **4 February 2027** |
| Preprint | 28 February 2027 |
| Full paper to the journal | 30 September 2027 |

Stage 2 is published in **Empirical Software Engineering (Springer)** — a Scopus
Q1 journal.

**One submission. Two publications. A conference paper and a journal article.**

Acceptance lands 4 February — four months earlier than the "before June" target.

### If that fails, in order

1. **MSR Industry Track** — 18 December 2026
2. **MSR Mining Challenge** — 23 December 2026
3. **EASE 2027** — abstract 15 January, paper 22 January 2027
4. A fast Scopus journal (*JKSU-CIS* and similar: 5–8 weeks to first decision)
   — no deadline, submit any time

A rejection in December still returns detailed expert feedback on the design in
time to use it for option 3. **There is no path here where the work is wasted.**

### Before anything else: confirm with the supervisor

One email, this week:

> *"Sir, we plan to submit to MSR 2027 (IEEE/ACM, Scopus, co-located with ICSE),
> Registered Reports track. Stage 1 is a 6-page protocol due 20 November; Stage 2
> is published in Empirical Software Engineering (Springer, Scopus Q1). Does this
> satisfy the publication requirement?"*

It will. Get it in writing before spending three weeks.

---

## 3. The paper

### Topic — unchanged

Nakul's dissertation title stays. Working title:

> **Self-Reflection and Failure Recovery in Agentic AI Coding Systems:
> A Registered Report on Failure-Class-Conditioned Recovery in LLM Coding Agents**

Same subject, same three strategies, same benchmark family. What is added is
**scale**, **cost**, and **a decision rule**.

### Research questions and hypotheses

A Registered Report needs these fixed, in writing, before any data.

| | Hypothesis | Where it comes from |
|---|---|---|
| **H1** | Diagnose+Revise does not improve recovery over Blind Retry on **logic-class** failures | the pilot null — now properly powered |
| **H2** | Recovery success depends on the **failure class**, not on the strategy | the format/logic separation, slide 11 |
| **H3** | Strategies with **identical outcomes differ significantly in cost** | §4.18.4 of the dissertation |
| **H4** | A **class-conditioned stopping rule** achieves equal recovery at lower cost | "recovery triggering" — the review, §V-C |

H1–H3 come entirely from work already done. **H4 is the new contribution**, and
it is the direct answer to the professor's question about the algorithm.

### Why this is continuous, not a change of direction

This matters for how it is presented. Three quotes, all from Nakul's own
documents:

**From the systematic review, §V-C:**
> *"further studies should be devoted to creating adaptive recovery techniques
> that could balance between execution robustness and computational efficiency,
> providing reflection optimization, **recovery triggering**, planning depth, and
> resource-efficient reasoning."*

**Also §V-C, on metrics:**
> *"...incorporate numerical metrics of recovery performance, including recovery
> accuracy, cause identification, adaptation, planning, execution efficiency,
> error avoidance, **computational cost**, and learning."*

**From the dissertation, §4.18.4:**
> *"Effectiveness is reported together with cost, since a strategy returning an
> identical outcome at three times the input volume is a finding that an
> effectiveness measure alone does not express."*

He published the research agenda. This paper executes it. The opening line of
the paper writes itself:

> *"In our prior systematic review [ref], we identified adaptive recovery
> triggering and recovery cost as open problems. This paper addresses both."*

---

## 4. The algorithm — how to answer the professor

This is the question that went badly last time. Here is the answer, at three
depths. **Use them in order, and stop when he is satisfied.**

### Depth 1 — one sentence

> *"The algorithm is a stopping rule: it decides, after each failed repair
> attempt, whether another attempt is worth making or whether the agent should
> stop and ask a human."*

### Depth 2 — give it a home in the literature

> *"It belongs to the optimal stopping family — the same class of problem as
> Wald's sequential probability ratio test. We are instantiating it for agentic
> program repair."*

Naming an established family is what converts "a few if-statements" into "an
algorithm" in a reviewer's mind. It is also true.

### Depth 3 — the whiteboard version

Four steps. Nakul should be able to write this from memory.

**Step 1 — Observe what kind of failure it was.** Not predict. *Observe.*

```
  patch would not apply          →  FORMAT   (careless)
  patch applied, test still red  →  LOGIC    (misunderstood)
  container or network died      →  BROKEN   (measured nothing)
  no progress for 3 steps        →  LOST     (going in circles)
```

> **Say this out loud:** *"This is not a classifier. It reads exit codes.
> `git apply` either rejected the patch or it did not. There is no prediction
> and therefore no error rate and no confound."*

**Step 2 — Hold a belief about whether retrying will work.**

```
              α_c
  p(c, k) =  ───────  ×  λᵏ
            α_c + β_c
```

- `α, β` — successes and failures seen so far for that failure class
- `k` — how many attempts have already been spent
- `λ` — decay, because each failed attempt is added to the conversation and
  makes the model worse. Published work measures this at a 20–40% drop.

**Step 3 — Compare the two options.**

Let `G` = value of fixing the bug, `r` = cost of one more attempt,
`h` = cost of interrupting a human, `q` = chance the human unblocks it.

```
  E[retry]    =  p(c,k) · G  −  r
  E[escalate] =  q      · G  −  h

  RETRY  ⟺  p(c,k)  >  θ_c       θ_c = q_c − (h − r)/G
```

**One inequality. That is the decision.**

**Step 4 — the sentence that ends the question.**

> *"Nobody hard-codes 'retry formatting errors'. The algorithm learns that
> p(FORMAT) is high and p(LOGIC) is near zero from the data, and the inequality
> produces the correct behaviour by itself. If the model changes, the
> probabilities change and the policy changes with them — with no code edit.
> That is the difference between an algorithm and a heuristic."*

### And the elegant part, which examiners like

All four experimental conditions are **the same algorithm at different values of
one number**:

| Condition | θ | Behaviour |
|---|---|---|
| Blind Retry | −∞ | never stops asking for retries |
| Always-ask | +∞ | escalates immediately |
| Random | ignores class | the control |
| **Ours** | **θ_c** | class-conditioned |

The baselines are not separate programs. They are special cases. That means the
comparison is controlled by a single scalar and nothing else differs.

---

## 5. How Nakul should explain the topic

His other problem. The fix is to prepare three versions and never improvise.

### 10 seconds

> *"When an AI writes code and gets it wrong, should it try again, or stop and
> ask a human? We are building the rule that decides."*

### 60 seconds

> *"Think of a junior developer. He writes a fix, the test fails. A senior
> engineer asks one question before anything else: was he careless, or does he
> not understand?*
>
> *If he was careless — wrong file, broken formatting — 'try again' works, in
> thirty seconds. If he does not understand the bug, 'try again' is useless. He
> will produce the same wrong idea in tidier handwriting.*
>
> *A human makes that call instantly. No AI coding agent makes it at all. They
> all retry, every time, whether retrying can work or not. My earlier study
> showed this: retry fixed every formatting failure and zero reasoning failures.*
>
> *So this work builds the missing piece — a rule that reads which kind of
> failure just happened and decides whether to retry or to stop and ask."*

### 3 minutes — add the evidence

Three facts, in this order:

1. **It costs money.** 50,000–200,000 tokens per resolved issue. On the issues
   it cannot resolve, it spends the same and gets nothing.
2. **It makes the agent worse.** Every failure is appended to the conversation.
   Accuracy measurably falls as context grows — 13.9% to 85% in published
   measurements. The loop is self-defeating.
3. **The agent cannot tell it is stuck.** Frontier models score 75–89% with
   complete information and **4–24%** when something is missing and they must
   decide whether to ask. One model family says out loud that it is stuck and
   then submits anyway, in 45% of its failures.

### Three rules for the viva

- **Lead with the problem, never with the method.** If the first thing out of
  his mouth is "SWE-bench" or "Diagnose+Revise", he has already lost them.
- **When he does not know, say so, then redirect to what he does know.**
  *"That's in our threats to validity — what we did control is X, and here is
  why."* Guessing in a viva is how a small question becomes a big one.
- **Never explain more than was asked.** Depth 1. Stop. Wait.

### Practise it

Aayush: ask him the question cold, three times a week, until the 60-second
version comes out the same every time. That is the whole fix. Nakul does not
have a knowledge problem, he has a rehearsal problem.

---

## 6. The schedule

Today is 22 October. The abstract is due 13 November. **Three weeks.**

### Week 1 — 22 to 29 October · decide and calculate

| | Task | Who | Time |
|---|---|---|---|
| ☐ | Email the supervisor, confirm MSR/EMSE counts | Nakul | 10 min |
| ☐ | Create the MSR submission account, read the CFP | Nakul | 30 min |
| ☐ | Download the IEEE conference template | Aayush | 15 min |
| ☐ | **Compute the power analysis** | Claude + Aayush | 1 day |
| ☐ | Fix the four hypotheses in writing | both | 2 hours |
| ☐ | Decide authorship order + affiliations | Nakul + supervisor | — |

**The power analysis is the critical item.** It determines the sample size,
which determines the budget, which determines whether the study is feasible at
all. If the required N turns out to be unaffordable, we must know that in
October, not in March.

### Week 2 — 30 October to 6 November · draft

| | Section | Source | Pages |
|---|---|---|---|
| ☐ | Introduction | review §I, compressed | 0.75 |
| ☐ | Related Work | the review's 35 studies | 1 |
| ☐ | Gap + contribution | review §V-C, quoted | 0.25 |
| ☐ | Pilot results | dissertation Ch. 5 | 0.5 |
| ☐ | Hypotheses + rationale | **new** | 0.75 |

### Week 3 — 7 to 13 November · method and submit the abstract

| | Section | Pages |
|---|---|---|
| ☐ | Variables and operationalisation | 0.5 |
| ☐ | Dataset and sampling + power analysis | 0.5 |
| ☐ | Execution plan | 1 |
| ☐ | Analysis plan + outcome-neutral tests | 0.5 |
| ☐ | Threats to validity | 0.5 |
| ☐ | Structured abstract, 200 words | — |
| ☐ | **SUBMIT ABSTRACT — 13 November** | |

### Week 4 — 14 to 20 November · review and submit

| | Task |
|---|---|
| ☐ | Run `academic-paper-reviewer` — the 5-seat simulated panel |
| ☐ | Fix everything it finds |
| ☐ | Run `/ars-citation-check` on every reference |
| ☐ | Supervisor reads it |
| ☐ | Similarity / plagiarism check |
| ☐ | Formatting: 6 pages + 1 reference page, IEEE format |
| ☐ | **SUBMIT — 20 November** |

Then stop. Reviews arrive 23 December.

---

## 7. What code to build, and when

The answer that will surprise you: **almost none before submission.**

### Before 20 November — two days of work, total

| | What | Why | Time |
|---|---|---|---|
| ☐ | **Power analysis script** | the sample size goes in the paper | 1 day |
| ☐ | Triage feasibility check | one table proving FORMAT/LOGIC separates cleanly on existing data | half a day |
| ☐ | Tidy `recovery-bench` for citation | reviewers respond well to a protocol backed by working code | half a day |

Both use data that already exists — `replay_rows.json`, `master_table.md`,
`legacy_patch_audit.json`. **No new API calls. No Docker. No sweep.**

### After 4 February, once accepted — seven months

| Phase | What | When |
|---|---|---|
| 0 | Docker + mini-SWE-agent on one real bug | February |
| 1 | The ledger — every event recorded, including crashes | February |
| 2 | Triage, belief update, stopping rule, all four arms | March |
| 3 | The simulated human oracle | March |
| 4 | **Run the experiment** at the planned sample size | April–May |
| 5 | Dashboard and analysis | June |
| 6 | Write Stage 2 | July–August |
| | **Submit to EMSE** | **30 September 2027** |

### Why this order is better

- You are not building against a guess. The protocol is reviewed first, so you
  build the thing reviewers already agreed to.
- If a reviewer says in December *"your sample size is wrong"*, you have changed
  one number in a document instead of re-running a month of experiments.
- Publication is secured in February. Everything after that is execution.

---

## 8. Using the skills

`academic-research-skills` is installed. Five skills, and the ones that matter:

| Skill | Use it for | When |
|---|---|---|
| `academic-paper` | drafting sections, IEEE formatting, structured abstract | weeks 2–3 |
| **`academic-paper-reviewer`** | **5-seat simulated peer review before submitting** | **week 4** |
| `/ars-citation-check` | verifying every reference is real and correctly formatted | week 4 |
| `/ars-abstract` | the 200-word structured abstract | week 3 |
| `/ars-disclosure` | the AI-use disclosure statement | week 4 |
| `deep-research` | only if a reviewer asks for more literature | December |

**Do not run the full `academic-pipeline`.** It is built for starting from
nothing. You are not starting from nothing — you have a submitted review, a
116-page dissertation, a working implementation and a pilot result. Use the
individual skills on individual sections.

The reviewer skill is the valuable one. It runs a panel including a Devil's
Advocate whose job is to attack the core claim. Running it in week 4 means the
first hostile reading of this paper happens in private, with time to fix things.

`reverse-engineer-anything` is for decompiling binaries and APKs. Not relevant
to this project.

---

## 9. The things first-time authors forget

Written down so nobody has to discover them on 19 November.

### Administrative

- ☐ **Authorship order** — agreed with the supervisor, in writing, now. Changing
  it later causes real trouble.
- ☐ **Affiliation** — exact official wording for PIET / Parul University
- ☐ **Corresponding author** — one named person with a stable email
- ☐ **ORCID** — free, takes five minutes, increasingly expected
- ☐ **Conflict of interest statement** — "none declared" is a valid answer but
  it must be present
- ☐ **AI use disclosure** — most venues now require it. Declare that AI
  assistance was used for drafting and analysis. Honest and standard.
- ☐ **Data availability statement** — where the code and data live. `recovery-bench`
  is already a strength here; most submissions have nothing.
- ☐ **Funding statement** — "no funding" is fine, but say it

### Technical

- ☐ **Page limit is hard.** 6 + 1. Over by one line and it can be desk-rejected.
- ☐ **IEEE conference template.** Not Word defaults, not the journal template.
- ☐ **Single-blind** for this track — author names stay in. Do not anonymise.
- ☐ **Every citation checked.** A fabricated or wrong reference is the fastest
  way to lose a reviewer's trust. Run the citation check.
- ☐ **Similarity check** before submitting, especially where text is reused from
  the dissertation. **Self-plagiarism is still plagiarism** — reused passages
  must be rewritten, not pasted.
- ☐ **Submit two days early.** Systems fail on deadline day, every single time.

### Scientific — what reviewers actually look for in a Registered Report

- ☐ **A sample size justification.** The first thing they check. Without it the
  protocol is not reviewable.
- ☐ **Hypotheses that can be proven wrong.** "We will investigate X" is not a
  hypothesis.
- ☐ **Outcome-neutral tests** — mandatory. Checks that work regardless of which
  way the result goes. Ours: a manipulation check that Diagnose+Revise actually
  received evidence, and a positive control that SEARCH/REPLACE eliminates
  format failures.
- ☐ **An analysis plan fixed in advance** — which test, which threshold, how
  multiple comparisons are handled. Decided now, not after seeing the data.
- ☐ **A stated stopping rule for data collection** — when does the experiment
  end, and why.
- ☐ **Threats to validity, honestly.** Nakul is already good at this. The
  `RECITATION` contamination finding — where the provider's own filter confirmed
  benchmark contamination — is a genuine strength and belongs in the paper.

---

## 10. The first three things to do

1. **Email the supervisor.** Confirm MSR/EMSE counts. Today.
2. **Compute the power analysis.** Everything downstream depends on the number
   it produces.
3. **Nakul rehearses the 60-second explanation** until it comes out identical
   three times running.

Everything else follows from those.

---

## Reference — all dates

| Date | What |
|---|---|
| 29 Oct | Power analysis done, hypotheses fixed |
| 6 Nov | Introduction, related work, pilot drafted |
| 13 Nov | **Abstract submitted** |
| 20 Nov | **Report submitted** |
| 23 Dec | Reviews arrive |
| 15 Jan | Revision submitted |
| **4 Feb** | **Decision — In-Principle Acceptance** |
| 28 Feb | Preprint |
| Feb–May | Build and run the experiment |
| 30 Sep | Stage 2 to Empirical Software Engineering |
