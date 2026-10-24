# Supervisor email — the Phase 0 gate

Send this **before 27 October 2026**. It gates three weeks of work, and two of the three
questions in it are things only the supervisors can answer.

Expands the one-line draft at `WORKFLOW.md:121-124`. Three questions, deliberately: the
venue one will almost certainly be yes, and the other two are the ones that actually need
deciding.

---

**To:** Prof. Ramizraja Shethwala · Prof. Mohammad Arif
**Cc:** Aayush
**Subject:** Semester-4 paper — venue confirmation, authorship, and one overlap to resolve

Respected Sir,

I am writing to confirm the plan for my semester-4 research paper before I begin drafting,
and to raise one issue I do not think I should decide alone.

**1. Venue — does this satisfy the publication requirement?**

We plan to submit to **MSR 2027** (Mining Software Repositories, IEEE/ACM, Scopus-indexed,
co-located with ICSE 2027 in Dublin), **Registered Reports track**. Stage 1 is a six-page
protocol, reviewed before any data is collected:

| Milestone | Date |
|---|---|
| Abstract | 13 November 2026 |
| Stage 1 report | 20 November 2026 |
| Reviews | 23 December 2026 |
| In-principle acceptance | 4 February 2027 |
| Stage 2 → *Empirical Software Engineering* (Springer, Scopus Q1) | 30 September 2027 |

One submission produces a conference paper and a journal article. I have chosen this track
deliberately: my Phase-1 pilot found **0 of 4** logic-class failures recovered by any of the
three strategies. In a conventional submission that reads as an underpowered negative result.
Under a Registered Report the protocol is judged before the data exists, so the null becomes a
finding I am licensed to confirm properly at scale.

**Could you confirm in writing that MSR 2027 + EMSE satisfies the publication requirement for
the degree?**

**2. Authorship order and affiliation**

I would like to settle this now rather than in November. Please confirm the author order and
the exact wording of the PIET / Parul University affiliation, the corresponding author, and
whether each author can supply an ORCID. The paper also needs a conflict-of-interest
statement and an AI-use disclosure, both of which MSR requires.

**3. The overlap I need your guidance on**

There are currently two plans for the same contribution — the class-conditioned stopping rule
(CC-OS) — and I do not think both can be submitted:

- **This plan:** MSR 2027 Registered Report, protocol due 20 November, experiment run after
  in-principle acceptance in February.
- **The `ccos-study` plan:** *e-Informatica Software Engineering Journal*, which needs the full
  experiment finished first — roughly 35 days of runs, started by 27 October, for a mid-December
  submission.

I should be honest that the second plan is not currently executable. It requires 120 GB of free
disk space (I have about 20 GB on the system drive), a Linux/WSL2 environment with Docker, and
its own code refuses to run on Windows because line-ending differences corrupted the Phase-1
results. Its own pre-registered analysis plan also states that N = 150 gives a failure pool of
about 60, which is *"adequate only for large effects."*

My recommendation is to proceed with **MSR only**, and to use the `ccos-study` implementation as
the execution engine for Stage 2 after in-principle acceptance. That gives three months to
solve the disk problem — a prebuilt image registry reduces it from ~120 GB to ~30 GB, and cloud
evaluation removes it entirely — and no deadline then depends on something currently impossible.

If you would prefer to pursue both, I think the split has to be real and stated in each paper:
MSR takes the stopping rule (H4), e-Informatica takes the scaled three-strategy comparison
(H1–H3), with each citing the other. I would want your sign-off on that division before writing
either.

**What I am not asking for yet:** no API spending, no experiment, and no compute. Everything
due on 20 November is a written protocol plus analysis over data I already have.

The four hypotheses are fixed and will not change after submission:

- **H1** — Diagnose+Revise does not improve recovery over Blind Retry on logic-class failures
- **H2** — Recovery success depends on the failure class, not the strategy
- **H3** — Strategies with identical outcomes differ significantly in cost
- **H4** — A class-conditioned stopping rule achieves equal recovery at lower cost

H1–H3 come from work already completed. **H4 is the new contribution**, and it answers the
question raised at the Phase-1 review about what the algorithm actually is.

I would be grateful for a reply before 27 October so that I can begin the power analysis, which
determines the sample size and therefore the whole budget.

Thank you, Sir.

Respectfully,

**Lagad Nakul Kiran**
Enrolment 2503032340022
M.Tech, Artificial Intelligence & Data Science
Parul Institute of Engineering & Technology, Parul University

---

## Before you send

- [ ] Confirm both supervisors' correct titles and email addresses
- [ ] Decide whether Aayush is cc'd or named in the authorship paragraph
- [ ] If the IST review paper (`INFSOF-D-26-01742`) decision has arrived, mention it in one line
- [ ] Keep the reply — `ccos-study` has an approval gate enforced in code that needs the
      evidence string (`ccos approve --by "<name>" --evidence "<email of DD Mon 2026>"`)
