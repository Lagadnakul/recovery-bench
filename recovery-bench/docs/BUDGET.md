# Token Budget

The binding constraint on this project is **tokens**, not time and not money.
This document does the arithmetic before any code is written, because a sweep
that runs out of quota halfway through produces exactly the defect the rebuild
exists to eliminate: missing cells.

`budget.estimate_before_run: true` makes the system perform this calculation
itself and **refuse to start an arm it cannot finish**.

---

## 1. What changed from the original study

| | Original (Gemini free tier) | Now |
| --- | --- | --- |
| Constraint shape | **~20 requests / day** | **total tokens** |
| Throttle | hard-coded `time.sleep(60)` in every script | none — backoff on 429 only |
| One 24-cell sweep | > 1 day | **minutes** |
| Consequence | 8 of 24 cells never ran (`PLAN.md` D2, D3) | budget ledger, cells cannot vanish |

Time stopped being the constraint. Tokens became it.

---

## 2. Per-call estimates

Derived from `PLAN.md` D8, which measured the original prompts directly.

### The compression effect (D7)

| Context mode | Input tokens, target file | Source |
| --- | --- | --- |
| `whole_file` | **31,098** for `astropy/wcs/wcs.py` | measured, `PLAN.md` D8 |
| `symbol` (±50 lines) | **~3,000** | design target |

### Estimated tokens per call, `context.mode: symbol`

| Strategy | Input | Output | Total |
| --- | ---: | ---: | ---: |
| `l0_baseline` | 3,500 | 1,500 | **5,000** |
| `l1_blind_retry` | 4,000 | 1,500 | **5,500** |
| `l2_reflection` | 5,500 | 1,500 | **7,000** |
| `l2_5_diagnose_revise` | 8,000 | 1,500 | **9,500** |
| *any, `thinking: true`* | — | +3,000 | **+3,000** |

Diagnose+Revise is ~2× Blind Retry here; `PLAN.md` D8 measured ~3× in the
original because the whole test log fragment rode along with a whole file.

**Recovery-strategy average: ~7,500 tokens/call.**

---

## 3. Per-arm budget

| Arm | Cells | Tokens/cell | **Arm total** | Provider |
| --- | ---: | ---: | ---: | --- |
| A1 replication | 24 | 7,500 | **180 K** | Gemini |
| A2 workhorse | 120 | 7,500 | **900 K** | NVIDIA |
| A3 capability | 120 | 7,500 | **900 K** | NVIDIA |
| A4 reasoning — thinking off | 120 | 7,500 | **900 K** | NVIDIA |
| A4 reasoning — thinking on | 120 | 10,500 | **1.26 M** | NVIDIA |
| A5 format at scale | 720 | 5,000 | **3.60 M** | NVIDIA |
| A6 QwenCloud *(optional)* | 72 | 7,500 | **540 K** | QwenCloud |

---

## 4. Against each provider's ceiling

### NVIDIA — primary

```
A2  0.90 M
A3  0.90 M
A4  2.16 M
A5  3.60 M
    ───────
    7.56 M tokens · 1,200 calls      config ceiling: 8.0 M / 1,500 calls
```

**Headroom is only 6%.** NVIDIA's trial ceiling is credit-based and not
published, so this is the one number `doctor` must establish empirically before
A5 runs.

**Fallback, pre-agreed:** drop A5 `repeats` from 3 to 2 → 480 cells → **2.40 M**,
taking the NVIDIA total to **6.36 M** (20% headroom). Statistical power on A5
barely moves because its n is large already.

### QwenCloud — reserve

```
A6  540 K tokens            free quota: 1 M per model
                            config ceiling: 900 K  (deliberately under)
```
Fits with 46% margin. Disabled by default — it spends a finite, non-renewing
allowance, so it is opt-in.

### Gemini — replication only

```
A1  180 K tokens · 24 calls     free tier: ~20 requests/day
```
Two days of wall-clock at the free ceiling. This arm is small on purpose; the
20/day limit is the reason this whole rebuild exists.

---

## 5. What this would cost if every free tier vanished

Using QwenCloud's cheapest published rate (`deepseek-v4.1-flash`, off-peak
$0.15/M input, $0.60/M output), the **entire 7.56 M-token programme**:

```
6.0 M input  × $0.15/M = $0.90
1.5 M output × $0.60/M = $0.90
                         ─────
                         $1.80
```

On `qwen3.8-max` ($2/$6) the same programme is ≈ **$21**; on `kimi-k3` ($3/$15)
≈ **$41**.

**Budget is not a constraint on this project.** The grid should therefore be
designed for what is scientifically right, not for what is cheap — which is why
A5 carries 720 cells.

---

## 6. Why compression is load-bearing

The same grid with `context.mode: whole_file`:

| Arm | `symbol` | `whole_file` |
| --- | ---: | ---: |
| A2 | 0.90 M | 2.34 M |
| A3 | 0.90 M | 2.34 M |
| A4 | 2.16 M | 5.04 M |
| A5 | 3.60 M | 12.24 M |
| **NVIDIA total** | **7.56 M** | **21.96 M** |

**2.9× more tokens, for identical science.** The whole-file version does not fit
in any ceiling available, which means the n=5 repeats — and therefore
`PLAN.md` §8.2's means and variance — would be impossible.

This is the concrete form of the claim in `DECISIONS.md` D7: **§8.7 (cost-aware
metrics) and §8.2 (statistical power) are the same engineering problem.**
Compression is not an optimisation. It is what buys the error bars, and it is
independently reportable as a result.

---

## 7. Enforcement

1. **Estimate.** `sweep` prices the enumerated grid before the first call and
   prints a per-arm table.
2. **Refuse.** An arm whose estimate exceeds its provider ceiling does not start.
   With `stop_on_exhaustion: skip_arm` the remaining arms still run.
3. **Ledger.** Every call records prompt, completion and **reasoning** tokens
   separately into `runs/<id>/calls/`.
4. **Terminal state.** A cell stopped by the ceiling ends as `BUDGET_STOP` — a
   recorded outcome with a reason, never a silent disappearance.
5. **Report.** Actual against estimated tokens is a figure in the dashboard, and
   it is the raw material for the Verified-Recovery-Rate-with-effort metric that
   `PLAN.md` D8 says the original study never measured.
