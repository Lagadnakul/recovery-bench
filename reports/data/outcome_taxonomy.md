# Outcome Taxonomy

> The classification scheme used in Chapter 4 §4.14 and applied throughout Chapter 5.
> Every cell in `master_table.md` resolves to exactly one of these five categories.
> The categories are mutually exclusive and jointly exhaustive, and each is decided by
> an artefact on disk rather than by judgement.

---

## The five categories

### C1 — RESOLVED
**Definition.** The patch applied, every FAIL_TO_PASS test passed, and no PASS_TO_PASS
test regressed.
**Decision rule.** `report.json` → `resolved == true`.
**Occurrences.** 12 at baseline; 3 in recovery (`django__django-11039`,
`django__django-11583`, `django__django-11620`).

### C2 — PARTIAL
**Definition.** The patch applied and moved at least one FAIL_TO_PASS test from failing
to passing, but not all of them; or it fixed tests while breaking others.
**Decision rule.** `resolved == false` **and** `len(FAIL_TO_PASS.success) > 0`.
**Occurrences.** `django__django-11019` under all six evaluated recovery cells (6 of 16
FAIL_TO_PASS passing).

> **Why this category must exist.** SWE-bench's binary `resolved` flag records
> `django__django-11019` as a failure at baseline and a failure after recovery,
> concealing a move from 0/16 with 33 regressions to 6/16 with none. The single most
> substantial change measured in this study is invisible to the headline metric.
> Introducing C2 is what allows Chapter 5 to report it, and is itself a methodological
> contribution (Objective 8).

### C3 — NO_PROGRESS
**Definition.** The patch applied cleanly, but no FAIL_TO_PASS test changed state.
**Decision rule.** `resolved == false`, `patch_successfully_applied == true`, and
`len(FAIL_TO_PASS.success) == 0`.
**Occurrences.** `astropy__astropy-7746`, `django__django-11283`, `django__django-11564`
across their evaluated cells.

### C4 — REGRESSION
**Definition.** The patch applied and broke tests that were previously passing.
**Decision rule.** `len(PASS_TO_PASS.failure) > 0`.
**Occurrences.** `django__django-11019` at baseline (33 broken);
`django__django-11283` under Diagnose+Revise R1 (8 broken).

> C4 overlaps C2 and C3 by construction — a cell can both make no progress and cause
> regressions. **Resolution rule:** C4 takes precedence in the narrative, and the
> regression count is always reported alongside the primary category. Chapter 5 should
> render these cells as, for example, "C3/NO_PROGRESS with 8 regressions".

### C5 — NOT_APPLIED
**Definition.** No valid patch reached the evaluation harness.
**Decision rule.** No `report.json` exists for the cell, **or**
`patch_successfully_applied == false`.
**Sub-categories, because the causes are methodologically different:**

| Sub-category | Cause | Artefact | Occurrences |
|---|---|---|---|
| **C5a — malformed patch** | model emitted an unusable unified diff | `error_ids` in the run summary | 4 at baseline |
| **C5b — applicator rejection** | SEARCH string absent or ambiguous | `search_not_found` / `search_ambiguous` / `no_blocks_found` printed to console; nothing written | contributes to the 8 missing cells in Table B |
| **C5c — generation blocked** | provider refused to generate | `RECITATION` finish reason | `astropy__astropy-14182`, all three conditions |
| **C5d — never attempted** | daily request ceiling reached | `"skipped to save quota"` in `master_results_table.md` | 4 cells |

---

## Decision procedure

Apply in order; the first matching rule wins.

```
1. No report.json, or patch_successfully_applied == false   → C5 (assign sub-category)
2. resolved == true                                         → C1
3. len(PASS_TO_PASS.failure) > 0                            → C4  (also record C2/C3)
4. len(FAIL_TO_PASS.success) > 0                            → C2
5. otherwise                                                → C3
```

This procedure is implemented in `build_master_table.py` and can be re-run against the
logs at any time.

---

## Failure class assigned at baseline

Distinct from the outcome categories above. The **outcome category** describes what
happened in a given cell; the **failure class** describes why the task entered the
failure pool at all, and is fixed once, at baseline.

| Failure class | Baseline outcome category | Tasks |
|---|---|---|
| **Logic-class** | C3 or C4 — patch applied, tests failed | `astropy__astropy-7746`, `django__django-11019`, `django__django-11283`, `django__django-11564` |
| **Format-class** | C5a — patch never applied | `astropy__astropy-14182`, `django__django-11039`, `django__django-11583`, `django__django-11620` |

**This distinction carries the main result.** Stratifying recovery outcomes by failure
class gives 3/3 recovery for evaluable format-class failures and 0/4 for logic-class
failures. Pooling them gives an uninformative 3/7 that mixes a mechanical fix with a
reasoning test. RQ4 is answered by the stratification, not by the pooled figure.

---

## Reporting conventions for Chapter 5

1. **Never report a pooled recovery rate without its stratification.** Aggregating
   across failure classes attributes a patch-format repair to improved reasoning.
2. **Always report the regression count** beside any effectiveness figure. A patch that
   fixes 6 tests and breaks 33 is not a partial success.
3. **Never treat an unevaluated cell as a null result.** Tables must distinguish
   "not evaluated" from "evaluated, no progress". `master_table.md` already does.
4. **Report coverage with every consistency claim.** "Identical across both rounds"
   must be followed by "in all 16 of 24 cells evaluated".
5. **Pair every effectiveness statement with its cost.** Reflection-only ≈ 2× and
   Diagnose+Revise ≈ 3× the input tokens of Blind Retry (`config.md` §7). An identical
   outcome at triple the cost is a finding, not a non-result.

---

## Disclosure: the RECITATION exclusion

`astropy__astropy-14182` was excluded from all three recovery conditions because the
provider terminated generation with finish reason `RECITATION` — the safety filter that
fires when output too closely reproduces memorised training data. Recorded verbatim in
`master_results_table.md` as `EXCLUDED (permanently blocked - RECITATION)`.

**This is disclosed in the thesis, in Chapter 4 §4.18, for three reasons.**

*First, it is a benchmark-contamination signal.* SWE-bench Lite is drawn from public
GitHub repositories whose commit history predates the model's training cut-off. A
refusal on the grounds that the output reproduces memorised text is direct evidence
that at least one gold patch in the benchmark is present in the model's training data.
Recent work — TRACEPROBE, *Beyond Resolution Rates* — treats contamination as a primary
threat to SWE-bench validity, and most studies can only speculate about it. This study
observed a provider-side signal of it. That is a genuine contribution, not an
embarrassment.

*Second, it strengthens every other result.* If some tasks are partly solved from
memory, the 60% baseline resolve rate is an upper bound. A study that acknowledges this
is reporting more carefully than one that does not.

*Third, concealing it is the higher-risk option.* The string `RECITATION` appears in
three files in the published repository. An examiner who opens the logs will find it,
and an undisclosed exclusion discovered in the viva is far more damaging than a
disclosed one explained in the methodology.

**Chapter 4 §4.18 should therefore state:** the task, the exact finish reason, that all
three conditions were affected identically so no strategy is advantaged, the resulting
change in denominator (pool of 8 → 7 evaluable), and the contamination implication.
**Chapter 5 §5.10** should carry the contamination point into interpretation, and
**Chapter 6 §6.6** should list systematic contamination screening as future work.
