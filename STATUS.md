# STATUS — where the project stands and what is left

**Author:** Lagad Nakul Kiran (2503032340022, M.Tech AI & DS, PIET / Parul University)
**Last updated:** 31 October 2026, end of day
**Target:** standalone Scopus-indexed journal paper, submitted November 2026

> Open this file first in any new session. It is the single answer to "what is
> done and what is pending". The reasoning behind every decision lives in
> `recovery-bench/docs/DECISIONS.md` (D0–D44).

---

## 1. One-line answer

**The implementation is complete and closeable. One sweep is 65% through and
resumes with a single command. Everything else that remains is writing.**

---

## 2. Evidence on disk, right now

```
data/sweep_rows.jsonl      3,351 rows
bun run verify             8/8 gates green
bun test                   596 pass, 0 fail, 6,159 assertions, 30 files
```

| arm | rows | tasks | what it measures | state |
|---|---:|---:|---|---|
| `a1_replication` | 28 | 4 | reproduces the pilot's inability to conclude | done |
| `a2_workhorse` | 260 | 4 | recovery on the 30B — a null | done |
| `a3_capability` | 180 | 4 | recovery on the 550B — **reflection harms** | done |
| `a4_reasoning` | 360 | 4 | reasoning model — floor effect, format result | done |
| `a5_format_at_scale` | 720 | 60 | edit format decides whether a patch applies | done |
| `a6_qwencloud` | 56 | 4 | second provider, cross-check | done |
| `a7_format_full_benchmark` | 960 | 240 | **C1 over all 300 SWE-bench Lite instances** | done |
| `p2_ultra_recovery` | 540 | 12 | a3 replicated on 13 *measured* tasks | done |
| `p2_muse_recovery` | 247 | 9 | a2's null widened from 4 tasks to 10 | **158 cells left** |

> **Phase 2 already changed a finding.** Adding its deep trajectories took C4's
> LOST count from 6 to **33** and its distinct tasks from 2 to **11**. The old
> clean `6–0` was a small-sample artefact; blind retry fires too. What survives
> is a **rate** difference at matched exposure — which is the stronger and more
> honest claim, and it no longer rests on two tasks. (D45)

### Two counting traps — do not select data by arm

1. **The 300-task C1 result spans `a5` + `a7`.** They have zero task overlap and
   union to exactly 300. Filtering `arm == "a7"` silently gives 240 of 300. (D42)
2. **Both phase 2 arms are one task short on paper.** `django__django-11564` was
   left in both pools by mistake; its 45 cells already existed under `a3`
   (ultra) and `a2` (muse), so resume correctly skipped them. The pools really
   are 13 and 10. **Select by task id and model, never by arm.** (D44)

### The five findings

| | claim | status |
|---|---|---|
| **C1** | Edit format decides whether a patch applies | **300 instances**, `b=490 c=5` of 587 pairs, **p = 4.79e-138** |
| **C2** | Reflection helps once, then harms | a3 `b=19 c=0`, p = 3.8e-6 — widening now from 4 tasks to 13 |
| **C3** | Triage runs with **zero model calls** | 1,417 FORMAT / 209 BROKEN / 33 LOST over all 3,351 rows, 300 tasks |
| **C4** | LOST fires far more on reflection, at matched exposure | **25.0% vs 10.8%**, 92 vs 93 eligible, RR **2.33×**, Fisher p = 0.013 — second independent measure backing C2 |
| **C5** | The pilot was underpowered and could never have rejected | N=150 gives H1 only 4.6–23.5% power |

---

## 3. The only unfinished measurement

```
p2_muse_recovery    450 planned    247 rows + 45 already in a2    158 CELLS TO RUN
```

**Resume command** — run from `D:\VS CODE\Nakul-Research-paper\recovery-bench`:

```powershell
bun --env-file ../.env.local packages/pipeline/cli.ts sweep --config configs/phase2.yaml --arm p2_muse_recovery --run --yes
```

- `--env-file ../.env.local` is **mandatory**. Without it the projector sees one
  key, computes the ceiling as 8M, and refuses with `170% EXCEEDS`.
- **~1.9M tokens** against **13.37M** headroom. Quota is not the constraint.
- **~2–4 hours.** Keys 1–4 are spent (99.6%), so traffic runs on keys 5–7 and
  NVIDIA's queue sits near the 300s timeout. Slow is expected, not broken.
- The 158 cells sit in six tasks: `sympy-16792`, `sympy-20590`, `sympy-23191`
  (baselines only, 40 recovery rounds each missing), `sympy-13895` (24),
  `sphinx-8474` and `sympy-13146` (7 each).
- `data/sweep.lock` holds a dead pid. **Leave it** — a stale lock is taken over
  automatically.
- **Never run two sweeps at once.** That is how `a2` once got 419 rows for 260
  cells and had to be discarded.

When it finishes, check `written == planned` in the VERIFY block. A row count is
not proof of completeness; the MISSING list is.

---

## 4. Pending — ranked

### Blocking the paper

| # | task | effort | notes |
|---|---|---|---|
| 1 | **Finish `p2_muse_recovery`** | 1 command, ~3h unattended | §3 above |
| 2 | **Re-run McNemar on phase 2** | ~20 min | C2 goes from 4 tasks to 13; select by task id, not arm |
| 3 | **Write the paper** | the real work | §4 and §8 writeable today with zero blockers; §6 and §7 unblocked; §5 narrow until item 1 lands |

### Needed before anyone sees the dashboard

| # | task | notes |
|---|---|---|
| 4 | **Sync the console** | Frozen at **1,604 rows** from commit `e17123f`. Needs `bun install` in `console/`, `bun run sync`, ~9 assertions in `src/model/derive.test.ts`, ~6 hardcoded display numbers, and `live_triage.json` added to the sync list |
| 5 | **Add a LOST view** | C4 has no dashboard representation yet |

> **Hard rule: do not show the guide the dashboard before syncing.** It would
> say 1,604 rows and p=7.44e-89 while the paper says 3,351 and p=4.79e-138.
> **The dashboard may show design and pilot evidence, but must never display a
> simulated outcome styled as a measurement.**

### Analysis still owed

| # | task | notes |
|---|---|---|
| 6 | **Refit λ and the FORMAT policy contradiction** | `decision: ESCALATE` vs `prescribed: retry`, `agrees: false`, on 10 trials — redo on the live rows now §7 is unblocked |
| 7 | **Scopus journal turnaround times and APCs** | Still owed; needed to choose the venue. `WORKFLOW.md:111` names the fallback — JKSU-CIS and similar, 5–8 weeks to first decision |
| 8 | **Decide the equivalence margin, then N** | Blocked on you; needed for the null results to be stated as equivalence rather than absence |

### Learning / defence

| # | task | notes |
|---|---|---|
| 9 | **Floors 4–8 of the ladder** | Floors 0–3 done. 4 = the experiment, 5 = the five findings, 6 = CC-OS, 7 = what it does NOT prove, 8 = research gap + viva defence |

### Housekeeping

| # | task |
|---|---|
| 10 | `git remote remove aayush` |
| 11 | Delete the merged `november-build-plan` branch |
| 12 | Vercel deploy — set Root Directory to `console` (blocked on you) |
| 13 | Zenodo DOI — blocked on moving repo ownership |
| 14 | **Resolve the `ccos-study` / e-Informatica duplicate-publication collision** — one conversation with Shethwala / Arif / Aayush |

### Dropped — do not reopen

- **Docker / RESOLVED verification.** Every live row is `verification: "apply"`.
  The consequence is that **LOGIC is unobservable by type** — `tsc` rejects any
  branch reading a live row as test-verified (TS2367). The archive's 25 LOGIC
  records remain the only evidence, at n = 51. The two datasets are
  complementary; neither is a superset.
- **MSR 2027 Registered Reports.** Stage 1 → IPA → Stage 2 cannot reach a May
  2027 publication deadline. (D37)
- **The `stratified_60` extension.** Refuted by a5's own data before any spend:
  55–58 of 60 tasks apply on every repeat — a ceiling. Replaced by a7.

---

## 5. Known code defects — leave them, write them into Threats to Validity

These are all recorded. None is worth fixing now; each is worth one honest
sentence in the paper.

| defect | consequence |
|---|---|
| **The budget gate ignores its own ledger** | Compares a projection against the 56M ceiling, not the 42.6M already spent. A grid that cannot finish would be greenlit and fail mid-run. (D43) |
| **Resume is outcome-blind** | `RowStore.has` asks whether a row exists, not whether it holds a measurement. A network failure becomes a permanent hole. 17 such rows were deleted by hand on 31 Oct. (D44) |
| **Design refusals share `PROVIDER_ERROR`** | A refused condition and a dead socket are indistinguishable by outcome kind alone. This is why the 31 Oct purge filtered on `usage === null` as well. |
| **`block_unterminated` is mislabelled** | 164 of 181 raw responses *do* write `>>>>>>> REPLACE`. The name describes a cause that is not the cause. |
| **The projector counts refused cells as calls** | Over-reports call volume. |
| **`selection: "all"` is unimplemented** in `resolveTaskSet` | Only `explicit` is honoured. |
| **The projector under-reports ~3×** on a cold cache | Fetch cost is not modelled. |

---

## 6. Non-negotiables

- **API keys live only in `.env.local`**, gitignored. Never paste a key into any
  other file. `configs/base.yaml` holds variable **names** only (`api_key_env`).
  Nothing reads a key value except the provider adapter.
- **`bun run sweep` defaults to `--project-only`.** Running requires *both*
  `--run` and `--yes`, and refuses when the projection exceeds budget unless
  `--force`.
- **Never force-push or wipe `Lagadnakul/Dissertation`** — it holds the only copy
  of the research diaries and the provenance payload.
- **`Lagadnakul/recovery-bench` is canonical.**
- **`triageAttempt` must stay unmodified and `runs.ts` unwidened**, so the 51
  archive numbers stay bit-identical and nobody can claim the classifier was
  tuned to the result.
- **Nothing runs on Azure.** The $9,940 student credit is unspent; the grid is
  entirely free-tier (7 NVIDIA keys, 1 qwencloud, 4 gemini). The constraints are
  free-tier quota and queueing hours, never money. (D38)
- **Sole author: Lagad Nakul Kiran.**
