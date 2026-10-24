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
