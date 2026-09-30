# Canonical Research Questions

> **Problem this file solves.** The dissertation currently states research questions
> twice, and the two statements disagree. Chapter 1 §1.8 lists **four** RQs; Chapter 2
> §2.3 lists **five**, differently worded and differently ordered. An examiner who
> notices this will ask which set the thesis actually answers.
>
> **Resolution.** Chapter 2 §2.3 becomes the canonical set, unchanged. Chapter 1 §1.8 is
> rewritten to point at it. Chapters 4, 5 and 6 cite only the canonical numbering below.

---

## The canonical set (Chapter 2 §2.3, retained verbatim)

### RQ1 — Review
> What failure-recovery mechanisms have been investigated in existing research on
> agentic AI coding systems?

**Type:** systematic review. **Answered in:** Chapter 3.
**Evidence:** the 35-paper synthesis table, extended with the four 2026 sources listed
in `PLAN.md` §D7.

---

### RQ2 — Strategy characterisation
> How do Blind Retry, Reflection-only, and Diagnose+Revise differ in their approach to
> recovering from failed repository-level coding attempts?

**Type:** design/descriptive. **Answered in:** Chapter 4 §4.10–4.13.
**Evidence:** the information-availability matrix in `config.md` §7, rendered as
Figure 4.4. This is the study's independent variable; the figure *is* the answer.

---

### RQ3 — Recovery effectiveness
> Does the availability of reflection or execution-grounded diagnostic information
> improve recovery from failed coding attempts?

**Type:** empirical, primary. **Answered in:** Chapter 5 §5.4–5.8.
**Evidence:** Tables B and E of `master_table.md`.
**Answer the data supports:** No. Across every evaluated logic-class cell, neither
reflection nor execution-grounded diagnosis resolved a task that blind retry did not.
On `django__django-11019` all three strategies returned an identical 6/16 sub-test
score in both rounds, at approximately 2× and 3× the input cost respectively. On
`django__django-11283`, Diagnose+Revise additionally broke 8 PASS_TO_PASS tests where
Blind Retry broke none.

> *Absorbs Chapter 1's former RQ1 (recovery effectiveness) and RQ2 (role of
> self-reflection). Both are answered by the same comparison; splitting them implied
> two independent tests where only one exists.*

---

### RQ4 — Failure-type separation
> To what extent can observed recovery failures be attributed to reasoning limitations
> rather than patch-formatting or patch-application mechanisms?

**Type:** empirical, methodological. **Answered in:** Chapter 5 §5.9–5.11.
**Evidence:** Tables A, C and E of `master_table.md`.
**Answer the data supports:** The two are cleanly separable, and separating them
changes the conclusion. Of 8 baseline failures, 4 were format-class (patch never
applied) and 4 logic-class (patch applied, tests failed). After the patch
representation was repaired, **3 of 3 evaluable format-class failures were resolved,
and 0 of 4 logic-class failures were** — 100% against 0%. A study that reported only
the aggregate resolve rate would have attributed a purely mechanical gain to improved
reasoning.

> *This is the strongest result in the dissertation and should be positioned as such.
> Corresponds to Chapter 1's former RQ3.*

---

### RQ5 — Robustness across rounds
> Are the observed recovery behaviours consistent across repeated evaluation rounds
> under controlled experimental conditions?

**Type:** empirical, robustness check. **Answered in:** Chapter 5 §5.12–5.13.
**Evidence:** Table B coverage block of `master_table.md`.
**Answer the data supports, stated with its limits:** Where a cell was evaluated in
both rounds, the outcome was identical — including sub-test scores, not merely the
binary flag. However, **16 of 24 logic-class cells were evaluated; 8 were never run**,
for the quota and patch-discard reasons documented in `config.md` §4–5. The claim the
thesis can defend is therefore *consistency across all evaluated cells*, with coverage
stated. It cannot claim consistency across the full pool.

> *Corresponds to Chapter 1's former RQ4.*

---

## Mapping table

Reproduce this in Chapter 1 §1.8 so the renumbering is transparent to the examiner.

| Canonical (Ch. 2 §2.3) | Former Ch. 1 §1.8 | Answered in | Primary evidence |
|---|---|---|---|
| RQ1 Review | *(no equivalent)* | Chapter 3 | 35-paper synthesis + 4 additions |
| RQ2 Strategy characterisation | *(no equivalent)* | Ch. 4 §4.10–4.13 | Figure 4.4 |
| RQ3 Recovery effectiveness | RQ1 + RQ2 | Ch. 5 §5.4–5.8 | `master_table.md` Tables B, E |
| RQ4 Failure-type separation | RQ3 | Ch. 5 §5.9–5.11 | `master_table.md` Tables A, C, E |
| RQ5 Robustness | RQ4 | Ch. 5 §5.12–5.13 | Table B coverage block |

---

## Objective-to-RQ mapping

Chapter 2 §2.2 lists eight objectives. Chapter 6 must confirm each was met; this is
the mapping it should use.

| Objective | Canonical RQ | Status | Where demonstrated |
|---|---|---|---|
| O1 Examine existing research | RQ1 | met | Ch. 3 |
| O2 Role of self-reflection in existing systems | RQ1 | met | Ch. 3 |
| O3 Characterise recovery mechanisms | RQ1, RQ2 | met | Ch. 3, Ch. 4 §4.10–4.13 |
| O4 Design controlled framework | RQ2 | met | Ch. 4 §4.1–4.9 |
| O5 Compare the three strategies | RQ3 | met | Ch. 5 §5.4–5.8 |
| O6 Separate reasoning from patch failures | RQ4 | met — **strongest result** | Ch. 5 §5.9–5.11 |
| O7 Robustness across rounds | RQ5 | **partially met** — 16/24 cells | Ch. 5 §5.12–5.13 |
| O8 Derive methodological implications | RQ3, RQ4, RQ5 | met | Ch. 6 §6.3–6.5 |

> **On O7.** Report it as partially met, with the coverage figure and the reason. A
> partially-met objective that is honestly scoped is routine in a dissertation and
> costs nothing. An objective claimed as fully met that the logs contradict is a viva
> problem. Chapter 6 should state the limitation and carry the full sweep into future
> work.

---

## Wording changes required in Chapter 1

Three claims in the existing Chapter 1 are not supported by the code as written. Each
is cheaper to correct than to defend, and the corrected version is the stronger claim.

| Location | Current wording | Replace with | Why |
|---|---|---|---|
| §1.3, §1.8 framing | "autonomous coding agent" / "agentic AI coding system" applied to the system built | "single-shot, oracle-localised patch generation" when referring to *this* study's system; retain "agentic" only when describing prior work | The implementation makes one stateless API call per cell: no tools, no repository navigation, no execution loop (`config.md` §3) |
| §1.9.1 | "reproducible failure-recovery evaluation pipeline" | "a fully scripted and openly published pipeline"; state separately that temperature and seed were not fixed | No sampling parameters are set anywhere (`config.md` §1). The pipeline is scripted and auditable, which is the defensible claim |
| §1.9.4 / abstract | "identical outcomes across the failure pool in two independent rounds" | "identical outcomes across all 16 evaluated cells of 24; 8 cells were not evaluated owing to the free-tier request ceiling" | Table B coverage block |

All three corrections are already reflected in the RQ answers above.
