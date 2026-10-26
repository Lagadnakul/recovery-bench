# Power analysis — exact McNemar

Do not edit by hand. Regenerate with `bun run power`.

Exact, not simulated: discordant pairs are multinomial and the exact McNemar p-value is a two-sided binomial test at p = 1/2, so power is a finite double sum. No RNG, so these digits are reproducible.

alpha = 0.05 · target power = 0.8 (two-sided)

## The floor

The exact test cannot reach alpha = 0.05 on fewer than **6 discordant pairs**, whatever n is: the most extreme split of m pairs gives p = 2 x (1/2)^m. Below that the rejection region is empty, so power is not low — it is zero.

**The pilot had 4 logic-class failures.** Had every one favoured one strategy, p would have been 0.125 — above alpha. Its null result was arithmetic before it was evidence, and that is the case for re-testing H1 rather than a weakness in it.

## Tasks are not pairs

From the pilot (8/20 baseline failures, 4 logic-class, 4 format-class, 7/8 with an evaluated attempt):

| Quantity | Per task attempted |
|---|---|
| Baseline failure | 0.4 |
| Logic-class failure (**the H1 sample**) | 0.2 |
| Format-class failure | 0.2 |

H1 compares two strategies on logic-class failures only, so its sample is **0.2 x N**, not the 0.4 x N whole pool.

## Power against the paired n

| paired n | small (0.1/0.02) | medium (0.15/0.03) | large (0.2/0.05) |
|---|---|---|---|
| 10 | 0.0% | 0.1% | 0.5% |
| 20 | 0.8% | 4.3% | 9.5% |
| 30 | 4.6% | 15.3% | 23.5% |
| 40 | 11.3% | 28.2% | 36.4% |
| 60 | 28.1% | 50.4% | 58.1% |
| 90 | 50.2% | 73.9% | 79.2% |
| 120 | 67.1% | 87.1% | 90.4% |
| 150 | 79.2% | 93.8% | 96.0% |
| 200 | 90.5% | 98.4% | 99.2% |

## What 80% power costs

| Effect | p(only A)/p(only B) | paired n | tasks to attempt |
|---|---|---|---|
| small | 0.1/0.02 | 153 | **765** |
| medium | 0.15/0.03 | 102 | **510** |
| large | 0.2/0.05 | 92 | **460** |

## H1 power at candidate task budgets

| Tasks | Failure pool | Logic pool | small | medium | large |
|---|---|---|---|---|---|
| 150 | 60 | 30 | 4.6% | 15.3% | 23.5% |
| 220 | 88 | 44 | 14.5% | 33.1% | 41.1% |
| 300 | 120 | 60 | 28.1% | 50.4% | 58.1% |
| 450 | 180 | 90 | 50.2% | 73.9% | 79.2% |
| 600 | 240 | 120 | 67.1% | 87.1% | 90.4% |

The pre-registered N = 150 gives H1 a logic pool of 30. Every figure in that row is the reason this analysis had to run before the protocol was written, not after.

## Phase 1b — would partial credit help? No.

Scoring each task by how many FAIL_TO_PASS sub-tests it fixes, instead of whether it fixed all of them, is the obvious way to buy power: `django-11019` carries 16 sub-tests. Two independent measurements say it does not work.

### 1. There is almost no partial credit available

FAIL_TO_PASS counts over all 300 SWE-bench Lite instances:

| Sub-tests | Instances | Share |
|---|---|---|
| exactly 1 | 192 | 64.0% |
| 2 | 74 | 24.7% |
| 3-5 | 21 | 7.0% |
| 6-9 | 5 | 1.7% |
| 10 or more | 8 | 2.7% |

min 1 · median **1** · q75 2 · q90 3 · max 355 · mean 3.47

**64.0% of instances have exactly one FAIL_TO_PASS test.** For those the sub-test score *is* the binary outcome — there is no partial credit to extract. Only 4.3% have six or more, so `django-11019` is the least representative instance in the benchmark rather than the typical one.

### 2. The differences that exist are all zero

| Task | Round | F2P total | Blind Retry | Diagnose+Revise | Difference |
|---|---|---|---|---|---|
| `astropy__astropy-7746` | 1 | 1 | 0/1 | 0/1 | **0** |
| `astropy__astropy-7746` | 2 | 1 | 0/1 | 0/1 | **0** |
| `django__django-11019` | 1 | 16 | 6/16 | 6/16 | **0** |
| `django__django-11019` | 2 | 16 | 6/16 | 6/16 | **0** |
| `django__django-11283` | 1 | 1 | 0/1 | 0/1 | **0** |
| `django__django-11564` | 1 | 2 | 0/2 | 0/2 | **0** |

**0 informative (non-tied) pairs**, against a floor of 6. A Wilcoxon signed-rank test discards zero differences before ranking, exactly as McNemar discards concordant pairs, so the informative sample here is not smaller than the binary one — it is empty. The strategies return *identical sub-test scores*, not merely identical verdicts, which is a sharper statement of the pilot finding than the binary table can make.

### What the data does support: PASS_TO_PASS regressions

98.0% of instances carry at least one PASS_TO_PASS test (median 44), and unlike F2P this outcome **did** separate the strategies:

| Task | Strategy | Round | Tests broken |
|---|---|---|---|
| `django__django-11019` | l0_baseline | 0 | 33 |
| `django__django-11283` | l2_5_diagnose_revise | 1 | 8 |

This measures a different question from recovery — whether richer failure information does *harm* — and it is the only outcome available with both the cardinality and the observed variance to support a test. It is a candidate for a new hypothesis, not a replacement for H1.
