## Triage feasibility

Every one of the 51 archived records below is classified by `triageAttempt`, which reads the outcome field and nothing else. **Model calls required: 0.** That is the feasibility claim.

| Class | Records | Correct response | Measures the model |
|---|---:|---|---|
| FORMAT | 9 | retry | yes |
| LOGIC | 25 | escalate | yes |
| BROKEN | 0 | abort | no |
| LOST | 0 | escalate | yes |
| _(resolved — no class)_ | 17 | — | yes |
| _(apply-verified only)_ | 0 | — | not yet |

51 records measure the model; 0 measure the instrument and are reported outside the failure classes rather than folded into one.

**BROKEN has no records, and that is itself a result about the instrument.** Every instrument limit in this study removed the cell from disk instead of recording itself: the provider refusal left no directory to read, and the quota exhaustion left no directory either. So the class that exists to keep unmeasured attempts out of the failure counts has nothing to hold, while the holes table below has seven entries. A pipeline that writes a row before it calls the model (ARCHITECTURE §2) converts those holes into BROKEN records; until the sweep runs, the class is implemented and unexercised.

### LOST: the detector is implementable, and barely exercised here

The detector averages novelty over 3 attempts, so a trajectory needs at least 3 of them. One round contributes one attempt — the pre-retrofit unified-diff runs are the same attempt re-expressed, not further attempts, so they are excluded and listed as superseded.

On that basis the deepest trajectory in the archive is **3** (baseline + 2 recovery rounds), **9 of 24** trajectories are long enough to score at all, and the detector fires on **0** of them at ε = 0.2.

**It could not have fired, and that is provable rather than observed.** The first attempt's novelty is 1 by definition — there is nothing yet to repeat. A trajectory of exactly 3 attempts therefore has exactly one window, that window contains attempt 1, and its mean is at least 1/3 = 0.333 whatever the other attempts did. Since ε = 0.2 < 0.333, LOST is unreachable on a 3-attempt trajectory for *any* data — and every scoreable trajectory in this archive has exactly 3.

So the 0 above is arithmetic, not evidence, in the same way the pilot's null on H1 was arithmetic (see the power analysis). **Design requirement: K >= 4 attempt rounds**, one more than the window, so that at least one window excludes the first attempt. Below that the detector is a decoration: it runs, it returns, and it cannot say yes.

### The proposal's novelty score does not work, and the replacement is measured

| Novelty level | Retries scored | min | mean | max | Usable |
|---|---:|---:|---:|---:|---|
| files touched (as proposed) | 26 | 0.000 | 0.192 | 1.000 | **no** |
| edited lines (replacement) | 26 | 0.000 | 0.459 | 1.000 | yes |

SWE-bench Lite gold patches are single-file (D21), and every attempt at a task edits that same file — so the set of files touched is a property of the *task*, not of the *attempt*. Measured over the archive: **file-level novelty is exactly 0 on 21 of 26 retries**, and all 5 non-zero values come from a patch with no readable file header on one side of the comparison (5 of 5 confirmed; 10 of 95 archived patches have no `--- a/` or `+++ b/` line at all).

So the score does not merely fail to discriminate — it **inverts**. The only attempts it calls novel are the ones too malformed to name a file, which are precisely the attempts a circuit breaker should treat as worthless. Jaccard over the set of edited lines, whitespace-normalised, has real spread and ranks near-repetition below genuine re-attempts.

| Task | Condition | Attempts | Line novelty per retry | LOST at | Superseded |
|---|---|---:|---|---:|---|
| `astropy__astropy-14182` | Blind Retry | 1 | _no retry_ | — | — |
| `astropy__astropy-14182` | Reflection-only | 1 | _no retry_ | — | — |
| `astropy__astropy-14182` | Diagnose+Revise | 1 | _no retry_ | — | — |
| `astropy__astropy-7746` | Blind Retry | 3 | 0.400, 0.529 | — | — |
| `astropy__astropy-7746` | Reflection-only | 3 | 0.429, 0.444 | — | — |
| `astropy__astropy-7746` | Diagnose+Revise | 3 | 0.250, 0.300 | — | — |
| `django__django-11019` | Blind Retry | 3 | 0.645, 0.622 | — | day9_test |
| `django__django-11019` | Reflection-only | 3 | 0.310, 0.244 | — | day10_test |
| `django__django-11019` | Diagnose+Revise | 3 | 0.247, 0.176 | — | — |
| `django__django-11039` | Blind Retry | 2 | 0.000 | — | — |
| `django__django-11039` | Reflection-only | 1 | _no retry_ | — | — |
| `django__django-11039` | Diagnose+Revise | 1 | _no retry_ | — | — |
| `django__django-11283` | Blind Retry | 3 | 0.167, 0.667 | — | — |
| `django__django-11283` | Reflection-only | 3 | 1.000, 0.417 | — | — |
| `django__django-11283` | Diagnose+Revise | 2 | 0.960 | — | — |
| `django__django-11564` | Blind Retry | 2 | 1.000 | — | day9_test |
| `django__django-11564` | Reflection-only | 2 | 1.000 | — | — |
| `django__django-11564` | Diagnose+Revise | 3 | 1.000, 0.533 | — | — |
| `django__django-11583` | Blind Retry | 2 | 0.000 | — | — |
| `django__django-11583` | Reflection-only | 1 | _no retry_ | — | — |
| `django__django-11583` | Diagnose+Revise | 1 | _no retry_ | — | — |
| `django__django-11620` | Blind Retry | 2 | 0.000 | — | day9_test |
| `django__django-11620` | Reflection-only | 2 | 0.250 | — | day10_test |
| `django__django-11620` | Diagnose+Revise | 2 | 0.333 | — | — |

### The holes, printed as holes

**7 of 24 condition-task cells have no record of any kind.** A blank cell in a results table reads as a measured zero, so they are enumerated:

| Task | Condition | Why the cell is empty |
|---|---|---|
| `astropy__astropy-14182` | Blind Retry | provider refused to generate (RECITATION) — no patch ever existed |
| `astropy__astropy-14182` | Reflection-only | provider refused to generate (RECITATION) — no patch ever existed |
| `astropy__astropy-14182` | Diagnose+Revise | provider refused to generate (RECITATION) — no patch ever existed |
| `django__django-11039` | Reflection-only | never run — free-tier quota exhausted (D3) |
| `django__django-11039` | Diagnose+Revise | never run — free-tier quota exhausted (D3) |
| `django__django-11583` | Reflection-only | never run — free-tier quota exhausted (D3) |
| `django__django-11583` | Diagnose+Revise | never run — free-tier quota exhausted (D3) |

### Every record and the field that classified it

| Task | Run | Condition | Rd | Fmt | Class | Evidence field | Value |
|---|---|---|---|---|---|---|---|
| `astropy__astropy-12907` | day8_test | Baseline | R0 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `astropy__astropy-14182` | day8_test | Baseline | R0 | diff | FORMAT | `outcome.gitStderr` | patch: **** malformed patch at line 14: -        lines = [lines[1]] + lines + [lines[1]] |
| `astropy__astropy-14365` | day8_test | Baseline | R0 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `astropy__astropy-14995` | day8_test | Baseline | R0 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `astropy__astropy-6938` | day8_test | Baseline | R0 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `astropy__astropy-7746` | day10_test | Reflection-only | R1 | diff | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `astropy__astropy-7746` | day11b_tes | Diagnose+Revise | R1 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `astropy__astropy-7746` | day15_blindretry | Blind Retry | R2 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `astropy__astropy-7746` | day15_diagnose | Diagnose+Revise | R2 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `astropy__astropy-7746` | day15_reflection | Reflection-only | R2 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `astropy__astropy-7746` | day8_test | Baseline | R0 | diff | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `astropy__astropy-7746` | day9_test | Blind Retry | R1 | diff | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-10914` | day8_test | Baseline | R0 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `django__django-10924` | day8_test | Baseline | R0 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `django__django-11001` | day8_test | Baseline | R0 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `django__django-11019` | day10_test | Reflection-only | R1 | diff | FORMAT | `outcome.gitStderr` | patch: **** malformed patch at line 27: -        return js |
| `django__django-11019` | day11b_tes | Diagnose+Revise | R1 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11019` | day12_blindretry_test | Blind Retry | R1 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11019` | day12_reflection_test | Reflection-only | R1 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11019` | day15_blindretry | Blind Retry | R2 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11019` | day15_diagnose | Diagnose+Revise | R2 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11019` | day15_reflection | Reflection-only | R2 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11019` | day8_test | Baseline | R0 | diff | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11019` | day9_test | Blind Retry | R1 | diff | FORMAT | `outcome.gitStderr` | patch: **** malformed patch at line 28:      def render(self): |
| `django__django-11039` | day8_test | Baseline | R0 | diff | FORMAT | `outcome.gitStderr` | patch: **** Only garbage was found in the patch input. |
| `django__django-11039` | day9_test | Blind Retry | R1 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `django__django-11049` | day8_test | Baseline | R0 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `django__django-11099` | day8_test | Baseline | R0 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `django__django-11133` | day8_test | Baseline | R0 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `django__django-11179` | day8_test | Baseline | R0 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `django__django-11283` | day10_test | Reflection-only | R1 | diff | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11283` | day11b_tes | Diagnose+Revise | R1 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11283` | day15_blindretry | Blind Retry | R2 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11283` | day15_reflection | Reflection-only | R2 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11283` | day8_test | Baseline | R0 | diff | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11283` | day9_test | Blind Retry | R1 | diff | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11422` | day8_test | Baseline | R0 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `django__django-11564` | day10_test | Reflection-only | R1 | diff | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11564` | day11b_tes | Diagnose+Revise | R1 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11564` | day12_blindretry_test | Blind Retry | R1 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11564` | day15_diagnose | Diagnose+Revise | R2 | sr | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11564` | day8_test | Baseline | R0 | diff | LOGIC | `resolved` | false — patch applied, FAIL_TO_PASS still failing |
| `django__django-11564` | day9_test | Blind Retry | R1 | diff | FORMAT | `outcome.gitStderr` | patch: **** Only garbage was found in the patch input. |
| `django__django-11583` | day8_test | Baseline | R0 | diff | FORMAT | `outcome.gitStderr` | patch: **** Only garbage was found in the patch input. |
| `django__django-11583` | day9_test | Blind Retry | R1 | diff | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `django__django-11620` | day10_test | Reflection-only | R1 | diff | FORMAT | `outcome.gitStderr` | patch: **** Only garbage was found in the patch input. |
| `django__django-11620` | day11b_tes | Diagnose+Revise | R1 | sr | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `django__django-11620` | day12_blindretry_test | Blind Retry | R1 | sr | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `django__django-11620` | day12_reflection_test | Reflection-only | R1 | sr | _none_ | `resolved` | true — FAIL_TO_PASS passed |
| `django__django-11620` | day8_test | Baseline | R0 | diff | FORMAT | `outcome.gitStderr` | patch: **** Only garbage was found in the patch input. |
| `django__django-11620` | day9_test | Blind Retry | R1 | diff | FORMAT | `outcome.gitStderr` | patch: **** Only garbage was found in the patch input. |

## CC-OS, implemented

**This section demonstrates that the method is implementable. It is not a result.** No arm was executed against a model, no human was ever interrupted, and nothing below measures whether CC-OS beats the baselines — that is Stage 2.

Payoffs: G = 1, r = 0.02, h = 0.3. θ_c = q_c − (h − r)/G.

### The four arms are one algorithm

| Arm | θ | Represents | FORMAT | LOGIC | BROKEN | LOST |
|---|---|---|---|---|---|---|
| A · Stubborn | −∞ | every agent shipping today | RETRY | RETRY | RETRY | RETRY |
| B · Needy | +∞ | the naive "add a human" answer | ESCALATE | ESCALATE | ESCALATE | ESCALATE |
| C · Random | ±∞, ρ = 0.5 | the control that makes it science | ESCALATE | RETRY | RETRY | ESCALATE |
| D · CC-OS | θ_c | our contribution | ESCALATE | ESCALATE | RETRY | RETRY |

There is one `decide` function in `ccos.ts`. The rows above differ only in the `thetaFor` handed to it, which is what makes *"the baselines are not separate programs"* a structural property rather than a claim — `tests/ccos.test.ts` checks it by enumerating the decision space.

### The policy is derived, not written

| Class | trials | successes | p(c,0) | q_c (assumed) | θ_c | CC-OS decides | thesis prescribes | agrees iff |
|---|---:|---:|---:|---:|---:|---|---|---|
| FORMAT | 10 | 5 | 0.500 | 0.9 | 0.620 | ESCALATE | retry | q_c < 0.780 |
| LOGIC | 21 | 0 | 0.023 | 0.7 | 0.420 | ESCALATE | escalate | q_c > 0.303 |
| BROKEN | 0 | 0 | 0.500 _(prior)_ | 0 | -0.280 | ABORT | abort | n/a — aborted by triage |
| LOST | 0 | 0 | 0.500 _(prior)_ | 0.6 | 0.320 | RETRY | escalate | q_c > 0.780 |

The derived column is the point: nobody wrote *retry formatting errors* anywhere. The inequality is evaluated against the pilot's own observed rates, and the last column gives the condition on the one quantity this study could not observe.

**2 class(es) come out against the thesis's prescription under the assumed q: FORMAT, LOST.** This is reported rather than corrected, and it is not yet a contradiction — it is a constraint on `ASSUMED_Q`:

- **FORMAT** is prescribed *retry*, and the rule prescribes it too for **q_FORMAT < 0.780**. The assumed value is 0.9, against an observed p = 0.500 over 10 retries.
- **LOST** is prescribed *escalate*, and the rule prescribes it too for **q_LOST > 0.780**. The assumed value is 0.6, and p(c,0) here is the Jeffreys prior with no observation behind it, so the row carries no data at all.

Pick FORMAT as the worked case. The thesis's argument for retrying a format failure is about *cost* — the agent fixes it itself, instantly — and the inequality already carries that through `h` and `r`. What it cannot carry is a human who is assumed to succeed 90% of the time on a failure the agent itself repairs half the time. Elicit q_FORMAT below the figure above and the derived policy reproduces the prescription with no code change, which is the behaviour the thesis claims.

`q_c` is an **assumption** (`ASSUMED_Q`), not a measurement: no human was ever interrupted in this study, so the archive is silent on it and no amount of reanalysis will fill it in. Every θ_c above is conditional on it, and Stage 2 either elicits these four numbers or reports the policy as a function of them.

LOST rest on the Jeffreys prior alone — zero observations — so their p(c,0) of 0.5 is a statement about the prior and not about any model. They are shown to demonstrate that the policy is total over the taxonomy, not to report a rate.

### λ is fitted, and the fit does not evidence context rot

| | |
|---|---|
| retry trials observed | 31 |
| successes | 5 |
| cells at a rate of exactly 0 or 1 | 3 of 5 |
| profile-likelihood maximum | λ̂ = 0.724, p̄ = 0.187 |
| 95% likelihood-ratio interval | [0.121, 1.000] |
| at a boundary of [0,1] | no |
| interval excludes λ = 1 (any decay at all) | **no** |
| λ propagated into θ_c | 1 — see below |

The fit converges to an interior λ̂ = 0.724, so this is a real maximum-likelihood estimate rather than a tuned constant — which is what the proposal promised. It is also **uninformative**, and both halves have to be said together:

- **The interval reaches 1.000.** λ = 1 is no decay at all, so the pilot does not establish that context rot exists, let alone its rate. A reader handed "λ = 0.724" alone would reasonably believe otherwise, which is why `reportedLambda` returns `null` here and θ_c is computed at λ = 1, the stated null.
- **Partial separation.** 3 of 5 observation cells sit at a rate of exactly 0 or 1 — format-class retries succeeded about half the time, logic-class retries never. A Bernoulli rate with no interior value constrains the level and not the slope, so most of the sample cannot speak about decay even in principle.
- **Successes left the experiment.** 10 sequences resolved, and 0 of them were retried afterwards. Every later-round denominator is therefore conditioned on earlier-round failure, so λ̂ confounds context rot with difficulty selection: the sequence keeps only the tasks that were already losing, which biases λ̂ **downwards**. The same survivorship error as scoring a baseline over the cells that happened to produce a report, one level up.

**Design requirement for Stage 2: K ≥ 4 attempt rounds, run unconditionally on a subsample.** The archive's deepest sequence is 4. Four is also what the LOST detector needs to be able to fire at all (see the triage section), so one change to the grid unblocks both — and it is a change to depth, not to breadth, which matters against a token budget already 178% over its ceiling (D25).

### Finite-horizon form, FORMAT class, K = 5

| k | p(c,k) | V_k | decision | horizon threshold | myopic θ |
|---:|---:|---:|---|---:|---:|
| 0 | 0.500 | 0.9487 | RETRY | -5.080 | 0.620 |
| 1 | 0.500 | 0.9375 | RETRY | -3.471 | 0.620 |
| 2 | 0.500 | 0.9150 | RETRY | -1.923 | 0.620 |
| 3 | 0.500 | 0.8700 | RETRY | -0.727 | 0.620 |
| 4 | 0.500 | 0.7800 | RETRY | 0.050 | 0.620 |

### Finite-horizon form, LOGIC class, K = 5

| k | p(c,k) | V_k | decision | horizon threshold | myopic θ |
|---:|---:|---:|---|---:|---:|
| 0 | 0.023 | 0.4000 | ESCALATE | 0.033 | 0.420 |
| 1 | 0.023 | 0.4000 | ESCALATE | 0.033 | 0.420 |
| 2 | 0.023 | 0.4000 | ESCALATE | 0.033 | 0.420 |
| 3 | 0.023 | 0.4000 | ESCALATE | 0.033 | 0.420 |
| 4 | 0.023 | 0.4000 | ESCALATE | 0.033 | 0.420 |

Solved backwards in O(K) from a terminal value of q·G − h: with no attempts left, asking is the only move, and setting that terminal value to 0 instead would price running out of budget as costless.

The horizon threshold sits **at or below the myopic θ exactly when the continuation value is non-negative** — a retry that fails still leaves attempts in hand, so the option has worth and retrying becomes weakly more attractive than the one-step rule allows. The inequality reverses when q·G < h: asking is then net-negative, a failed retry leaves a liability rather than an option, and the horizon demands *more* of a retry than the myopic rule does. The first draft of this analysis asserted the unconditional version; `tests/ccos.test.ts` refuted it and now pins both branches.

That regime also exposes a gap in the rule as published, worth one line in Threats to Validity: with both options negative there is no **abandon** action, so the policy keeps spending on the less-bad one. A deployment would want a third terminal.
