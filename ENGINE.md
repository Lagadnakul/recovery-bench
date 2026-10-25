# What is actually built, and what it has actually measured

**For:** Lagad Nakul Kiran · **Written:** 25 October 2026 · **Companion to:** `BUILD.md` (the plan), `recovery-bench/docs/DECISIONS.md` (the full decision log, D0–D33)

You asked a direct question and it deserves a direct answer before anything else.

---

## 1. The direct answer: no, I have not spent a single API call

**I have never used your API keys. Not once.** Everything I have built and every number I have reported comes from data that already existed on your disk.

Here is the proof, checked in the repository rather than asserted:

| Check | Result | What it means |
|---|---|---|
| `.env.local` exists | yes, at the project root | You created it; it is gitignored and I have never read a value out of it |
| `recovery-bench/data/runs/` | **does not exist** | A live sweep writes here. It has never run |
| `recovery-bench/data/sweep_rows.jsonl` | **does not exist** | Live sweep results. None |
| `recovery-bench/data/ledger.jsonl` | **does not exist** | Token spend ledger. Nothing has been spent |
| `recovery-bench/data/cache/` | **does not exist** | Live response cache. Empty |
| Any key-shaped string in git history | **none** | `sk-`, `nvapi-`, `AIza` — zero matches |
| `archive/legacy_runs/` | **427 files** | This is the real data. See below |

The two commands that *would* read your keys are wired but have not been run in any phase:

```sh
bun run doctor:live   # loads ../.env.local, probes endpoints   -- NOT RUN
bun run try           # loads ../.env.local, runs ONE cell      -- NOT RUN
```

The gate I actually run, `bun run verify`, calls plain `doctor` — the offline variant. Seven gates, no network, no Docker, no keys, 14 seconds.

### So where do the numbers come from?

**From the pilot study you already ran.** This is the important distinction, and it is good news for the paper:

```
Aug–Sep 2026   YOU ran the real experiment.
               Real Gemini API calls, real SWE-bench Docker test harness.
               Produced 95 instance directories, 73 report.json files.
                      |
                      |  committed to Lagadnakul/Dissertation @ c8872d07
                      v
Sep 2026       The engine was built around that data (recovery-bench).
                      |
                      v
Oct 2026       I restored the archive, verified it byte-for-byte,
               and analysed it. Zero new API calls.
```

So the measurements are real — they were made with real keys against real models and verified by real Docker test runs. They were just made **before** this phase of work, by you, not by me. What I added is the machinery that reads them correctly and the analysis that says what they can and cannot support.

### Is that a problem for the paper?

**No — and this is the single most important thing to understand about your submission.**

You are writing a **Registered Report** for MSR 2027. A Stage 1 Registered Report is reviewed **before the data exists**. The deadline on 20 November is for a *protocol*: the hypotheses, the method, the analysis plan, and the evidence that the method is feasible. Reviewers judge whether the study is worth running — not what it found.

That means the correct state of the project in November is exactly this one:

- a **pilot** with real measurements (you have it: 20 tasks, 12 resolved, Docker-verified),
- an **engine** that provably works offline and is ready to run (you have it: 559 tests),
- a **power analysis** proving the design can answer the question (built, Phase 1),
- a **feasibility demonstration** that the method is implementable (built, Phase 2),
- and **no Stage 2 data at all**, because collecting it before in-principle acceptance is pointless.

The live sweep belongs **after** 4 February 2027, when MSR tells you the protocol is accepted. Spending your free-tier quota now would buy you nothing a reviewer wants to see.

**One thing to be careful about, and it is the reason I keep labelling things.** The dashboard and the paper must never show a simulated number styled as a measurement. The Phase 2 output says so on its own first line — *"This section demonstrates that the method is implementable. It is not a result."* Keep that discipline and no examiner can accuse you of overclaiming.

---

## 2. What the archive actually contains

This is your real data, and it is worth knowing its shape because every finding traces back to it.

| | |
|---|---|
| Instance directories | **95** |
| With a `report.json` (Docker-verified) | **73** |
| **Without** one | **22** ← this gap is a finding, see §5 |
| Registered runs analysed | 9 (`day8_test` … `day15_diagnose`) |
| Rows the analysis produces | **51** (42 test-verified + 9 apply-verified) |
| Baseline pilot | 20 tasks, **12 resolved**, 4 apply failures |
| Model throughout | `gemini-3.6-flash` |
| Benchmark | SWE-bench Lite, 300 instances, revision `6ec7bb89b934…` |

Per instance directory you have: `patch.diff` (what the model produced), `run_instance.log` (what the harness did), `report.json` (test results, when the patch applied), `test_output.txt.gz`, and `eval.sh`.

The archive is **gitignored on purpose** — every file already lives upstream at `Lagadnakul/Dissertation @ c8872d070fb0b098394796dfbc68bcf67c3bd957`, which I tagged `provenance-phase1` on 24 October when I discovered that commit had become **dangling and unreachable** (main had been replaced by `236484c`). It was one `git gc` away from being gone. `archive/MANIFEST.md` + `SHA256SUMS` are committed, so the copy is verifiable but not the record.

---

## 3. What is completed, phase by phase

| Phase | What it is | State |
|---|---|---|
| **Phase 0** | Unblock the machine — Bun, decisions, CRLF defect, archive restore | **done** |
| **Phase 1** | Exact McNemar power analysis | **done** · M1 |
| **Phase 1b** | Is partial credit (sub-test scoring) a way out? | **done** · M1b |
| **Phase 1c** | Equivalence power curve | **blocked on you** — needs the margin |
| **Phase 2** | Triage + CC-OS: the method is implementable | **done** · M2 |
| **Phase 3** | Dashboard, six views | **not started** |
| **Phase 4** | Writing the Stage 1 protocol | **not started** |
| Stage 2 | The live sweep | **after 4 Feb 2027 IPA** |

Current totals: **559 tests across 27 files, 0 failures, 6,069 assertions.** All **7** `bun run verify` gates green in ~14s.

### How each finished phase was done

**Phase 0 — the part nobody writes down.** Four things had to be true before any analysis could be trusted:

1. **Bun installed** (1.4.4) and the workspace resolving.
2. **Three decisions taken** that `WORKFLOW.md` wanted a supervisor email for: MSR 2027 only, sole authorship, committed prompts supersede `ccos/prompts.py`. You decided not to send the email, so they are recorded as author decisions in `BUILD.md` §2.1.
3. **The CRLF defect found and fixed.** 18 tests were failing and the `doctor` gate was red. One root cause: `core.autocrlf=true` (Git for Windows' default) with no `.gitattributes`. The scratch repo in `verify/apply.ts` inherited the machine's line-ending policy, so an LF patch applied and then read back as CRLF. Fix: the scratch repo now sets its own `core.autocrlf=false` and `core.eol=lf`, plus a project `.gitattributes` with `-text` on the binary blobs. This is in memory as `crlf-hazard` because it will come back on a fresh machine.
4. **The archive restored** — 495 files — taking the suite from 377 pass / 38 skip / 18 fail to **433 pass / 0 skip / 0 fail**, and verifying for the first time that `master_table.md` regenerates **byte-identically** from the raw logs.

**Phase 1 — the power analysis** (`analysis/power.ts`, 31 tests). Exact McNemar computed in closed form: an O(n²) multinomial sum with **no random sampling**, so every figure the paper quotes is exactly reproducible. It agrees with the reference analysis plan to within 0.01 at matched n.

**Phase 1b — partial credit** (`analysis/subtest.ts`, 18 tests). Parsed FAIL_TO_PASS / PASS_TO_PASS counts out of all 300 SWE-bench Lite instances and the pilot's `report.json` files, then computed the paired differences the Wilcoxon test would need.

**Phase 2 — triage and CC-OS** (`analysis/triage.ts` 29 tests, `analysis/ccos.ts` 48 tests). Both behind `bun run ccos`. Described in full in §4.6 and §4.7.

---

## 4. The engine, explained layer by layer

This is the walkthrough you asked for. The whole thing is TypeScript on Bun — **not MERN**; there is no Express, no Mongo, no server at all. It is a batch pipeline plus a static dashboard.

```
recovery-bench/
├── packages/core/            the contract — types only, imports nothing
├── packages/pipeline/        everything that computes
│   ├── cli.ts                one entry point, every subcommand
│   ├── doctor.ts             preconditions
│   ├── tasks/                get the benchmark and the source files
│   ├── edits/                turn model text into a patch
│   ├── verify/               does git accept the patch?
│   ├── providers/            talk to models (unused so far)
│   ├── strategies/           build the prompts, run one cell
│   ├── matrix/               enumerate, cost, run the grid
│   └── analysis/             read the archive, compute every number
├── packages/dashboard/       React 19 + Vite, opens from file://
├── scripts/verify.ts         all seven gates, one command
└── tests/                    559 tests
```

### 4.1 `packages/core` — the contract

Types and constants only; it imports nothing. Both the pipeline (which writes rows) and the dashboard (which draws them) import it, so the two cannot drift — a change here breaks the dashboard *build* rather than producing a silently wrong chart.

Two ideas in here carry most of the project's integrity:

**The cell.** The unit of work is a 7-tuple: `{ taskId, strategy, model, editFormat, thinking, round, repeat }`. The entire grid is enumerated **before any call is made**, so every cell that will ever exist is known up front. That is what makes a missing cell detectable as a hole rather than as an absence.

**Verification is a type, not a convention.**

```ts
export type Verification = "test" | "apply";

export interface Row<V extends Verification> {
  resolved: V extends "test" ? boolean : null;
  …
}

export function resolveRate(rows: Row<"test">[]): number   // no overload for "apply"
```

`"test"` rows came out of the SWE-bench Docker harness and exist **only** in the archive — 73 of them, and there will never be another, because this project does not run Docker (D6). `"apply"` rows are everything the new pipeline produces. Because `resolveRate` has no overload accepting `Row<"apply">`, computing a resolve rate over untested rows **fails to compile**. That mistake cannot be made by accident.

**The outcome taxonomy** is nine kinds, and each one carries the evidence for its own classification:

```
NO_OUTPUT  NO_PATCH  MALFORMED  APPLY_FAIL  APPLIED
CONTAMINATED  PROVIDER_ERROR  BUDGET_STOP  TRUNCATED
```

`MALFORMED` additionally carries *why* — `search_not_found`, `search_ambiguous`, `hunk_count_mismatch`, and five more — because a model that misremembered one space of indentation should not score identically to one that invented a function.

Two predicates on top of it do a lot of work: `isFormatClass` (the patch never reached the repository) and `isInstrumentLimit` (nothing about the model was measured — our token ceiling, a 429, a budget stop). Deliberately, `TRUNCATED` is **excluded** from format-class: a response our own ceiling severed is our limitation, not the model failing.

### 4.2 `tasks/` — getting the benchmark

`dataset.ts` loads the frozen `swebench_lite.jsonl` (300 instances, pinned revision). `files.ts` is a **content-addressed, hash-verified cache**: the filename is `sha256(cache key)` and the content hash is stored separately and checked on read, so a corrupted or swapped file is detected rather than used. `localise.ts` picks which source files a model is shown.

> I got this wrong once and corrected it: I first claimed the blob filenames *were* content hashes and that "0 of 62 match". They are key hashes; the content hash lives beside them and is verified at `files.ts:108`. Corrected in `BUILD.md` §2.4.

### 4.3 `edits/` — turning model text into a patch

Two formats, because the pilot used both and the retrofit from one to the other is itself a variable in the design:

- `unified.ts` — classic `--- a/ +++ b/ @@` diffs, with a validator.
- `searchReplace.ts` — the `<<<<<<< SEARCH / ======= / >>>>>>> REPLACE` block format.
- `toPatch.ts` — converts search/replace blocks into a real unified diff.

`tests/editsSymmetry.test.ts` round-trips them. (A note for your own sanity: that file *generates* tests in two loops, so a static grep undercounts. I briefly "corrected" the README's test count downward and was wrong — reverted, and documented in `BUILD.md` §2.4 so nobody re-breaks it.)

### 4.4 `verify/apply.ts` — does git accept it?

Creates a scratch git repo, writes the source file at the correct `base_commit`, and runs `git apply`. Returns `APPLIED` or `APPLY_FAIL` with git's own stderr kept verbatim. **This is the measurement the whole thesis rests on**, and it is where the CRLF defect lived. It is now hermetic: the scratch repo sets its own line-ending policy instead of inheriting the machine's.

### 4.5 `providers/`, `strategies/`, `matrix/` — built, tested, never fired

This is the part that would use your keys.

- **`providers/`** — `openaiCompat.ts` (NVIDIA, Qwen, DeepSeek, Moonshot all speak this), `gemini.ts`, `fake.ts` (deterministic stub for tests), `budget.ts` (per-key token ceilings), `types.ts`. Tested against a **fetch stub that replays recorded payload shapes** — never a live endpoint.
- **`strategies/`** — `prompt.ts` builds prompts from the study's own committed templates, hash-checked against the originals; `conditions.ts` defines the six strategies (`l0_baseline` … `l4_tool_grounded`); `evidence.ts` assembles what a retry is allowed to see; `runCell.ts` runs one cell end to end.
- **`matrix/`** — `enumerate.ts` lists every cell up front; `project.ts` costs the grid **before** spending; `sweep.ts` executes it; `store.ts` persists rows; `verify.ts` checks every planned cell produced exactly one row.

Safety is deliberate: `bun run sweep` **defaults to `--project-only`**. Actually running requires **both** `--run` and `--yes`, and it refuses to proceed when the projection exceeds the budget unless you also pass `--force`.

Three things remain to be built here before the first live call, and `BUILD.md` §1.1 records them:
1. a **thinking adapter** that verifies from the *response* that the setting was honoured (D19: the flag was never on the wire);
2. the **budget guard** D25 found missing (14.56M tokens projected against an 8M ceiling, with nothing checking);
3. a recorded **rate-limit / credit-balance check** per provider, so the paper can state what the quota actually was.

### 4.6 `analysis/` — where every number in the paper comes from

This is the layer I have been building, and its design principle is: **nothing is a literal.**

| File | What it computes |
|---|---|
| `load.ts` | Walks instance **directories**, not `report.json` globs |
| `classify.ts` | Derives the logic/format split (was a hand-written dict) |
| `runs.ts` | Which archived run is which experimental cell |
| `aggregate.ts` | Every headline quantity in Chapter 5, as a function |
| `tables.ts` | Regenerates `master_table.md` |
| `figures.ts` | Datasets behind figures 5.1–5.4 |
| `replay.ts` | Rebuilds every cell from the archive |
| `power.ts` | Exact McNemar power (Phase 1) |
| `subtest.ts` | Sub-test / partial-credit analysis (Phase 1b) |
| `triage.ts` | Four-class failure triage (Phase 2) |
| `ccos.ts` | The CC-OS policy (Phase 2) |

**`load.ts` is the keystone.** The original Python globbed for `report.json` and found 73 files. The archive holds 95 directories. That 22-file gap is not corruption — the SWE-bench harness **raises before writing `report.json`** when `git apply` refuses:

```
EvaluationError: Error in evaluation for django__django-11039:
>>>>> Patch Apply Failed: patch: **** Only garbage was found in the patch input.
```

So a failed cell left a `patch.diff` and a log and **nothing else**, and the table-builder's glob never saw it. `load.ts` walks directories and reads a missing report as *evidence* rather than as absence. Those 22 recovered cells carry the thesis's central claim, since a patch that never applied is precisely a format-class failure.

### 4.7 Phase 2 in detail

**`triage.ts`** classifies every failure into FORMAT / LOGIC / BROKEN / LOST, with **zero model calls**:

```ts
if (PROVIDER_ERROR | BUDGET_STOP | TRUNCATED | NO_OUTPUT) → BROKEN   // measured nothing
if (isFormatClass)                                        → FORMAT   // patch never landed
if (applied && !resolved)                                 → LOGIC    // reasoning was wrong
// LOST is not a property of one attempt — see below
```

It also implements the circuit breaker: `patchFileSet`, `patchLineSet`, `jaccard`, `noveltyTrace`, `lostAt`.

**`ccos.ts`** implements the stopping rule:

```
E[retry]    = p(c,k) · G − r          p(c,k) = α_c/(α_c+β_c) · λᵏ
E[escalate] = q_c     · G − h
RETRY  ⟺  p(c,k) > θ_c                θ_c = q_c − (h − r)/G
```

plus the finite-horizon form `V_k = max(p_k·G − r + (1−p_k)·V_{k+1}, q·G − h)` solved backwards in O(K), a profile-likelihood fit for λ, and the four experiment arms.

**The four arms are literally one function.** There is one `decide()`, and the arms are four `thetaFor` functions handed to it:

| Arm | `thetaFor` returns | Represents |
|---|---|---|
| A · Stubborn | `−Infinity` | every agent shipping today |
| B · Needy | `+Infinity` | the naive "add a human" answer |
| C · Random | `±Infinity` on a seeded coin at rate ρ | the control that makes it science |
| D · CC-OS | `θ_c` | your contribution |

The tests enumerate a 72-point decision space and check each arm's behaviour. The sharpest one: **CC-OS with a single `q` for every class reduces exactly to a class-blind threshold policy.** That is the proof that class-conditioning is the *only* difference between arm D and a fixed-threshold baseline — which is the first thing an examiner will attack.

### 4.8 `packages/dashboard` — what exists already

React 19, Vite, Tailwind v4 (CSS-first `@import "tailwindcss"`), self-hosted Geist Mono + Plus Jakarta Sans, `base: "./"` so the build is a folder that opens straight from `file://` with no server. A `src/model/` layer (`load`, `rows`, `filter`, `status`, `narrative`) and 11 view components. **No charting library** (D29) — the views draw their own SVG marks. A 127-check contrast script keeps light and dark WCAG-compliant, and it is one of the seven gates.

Phase 3 extends this with the six views in `BUILD.md` §5. Views 1, 2 and 4 now have real data feeds: `data/ccos.json` carries the θ_c sliders, the triage table with its holes, and the λ profile curve.

### 4.9 `scripts/verify.ts` — the command you asked for

```sh
bun run verify        # all seven gates, ~14s, prints ONLY failures
bun run verify --fast # skip typecheck and contrast
bun run verify --list # show the gates
```

| Gate | A failure means |
|---|---|
| `typecheck` | the strict tsconfig is no longer satisfied |
| `test` | a behavioural claim the suite pins is now false |
| `doctor` | a sweep launched now would produce data that looks real and is not |
| `report` | `master_table.md` no longer regenerates byte-identically |
| `power` | the sample-size analysis no longer reaches target power |
| `ccos` | triage can no longer classify every record with zero model calls |
| `contrast` | a dashboard colour pair fails WCAG |

It resolves Bun through `process.execPath`, not the string `"bun"`, because a spawned process on Windows does not reliably inherit a PATH containing it. Exit code is the number of failed gates, so `&&` chains behave. It earned its place immediately: it caught two of my own errors in the session I wrote it.

---

## 5. What was found along the way — "what is in my code"

This is the part you specifically asked for. Each of these was discovered **while building**, not planned, and each one changes something.

### Found in Phase 0 — infrastructure

| # | Finding | Consequence |
|---|---|---|
| 1 | `core.autocrlf=true` + no `.gitattributes` broke 18 tests and the apply gate | Scratch repo made hermetic; `.gitattributes` added |
| 2 | The provenance commit `c8872d07` was **dangling and unreachable** | Tagged `provenance-phase1`. It was one `git gc` from being lost |
| 3 | 73 of 495 archive hashes "mismatched" | Artefact: gzip bytes are zlib-build dependent. Verified **losslessness** instead — all 73 decompress to identical bytes |
| 4 | `SHA256SUMS` reported 845 failures | It had CRLF, so every filename gained a `\r`. True count: 73, all `.gz` |
| 5 | The byte-identical reproduction claim had **never actually been checked** | Checked. It holds |

### Found in Phase 1 — the power analysis

| # | Finding | Consequence |
|---|---|---|
| 6 | **The exact McNemar test cannot reach α=0.05 below 6 discordant pairs.** The most extreme split of *m* gives p = 2(½)^m, which is 0.0625 at m=5 | Your pilot had **4** logic failures. Best attainable p was **0.125**. The null was *arithmetic* — it could not have produced significance on any data |
| 7 | **N=150 gives H1 only 4.6 / 15.3 / 23.5% power.** The reference plan tabulated the whole failure pool (0.4N); H1 is logic-class only (**0.2N**) | 80% power needs **460–765 tasks** |
| 8 | That is against a grid already **178% over its token ceiling** (D25) | N cannot simply be raised. The framing has to change |

### Found in Phase 1b — partial credit

| # | Finding | Consequence |
|---|---|---|
| 9 | **64% of SWE-bench Lite instances have exactly one FAIL_TO_PASS test** (median 1, q75 2, q90 3) | For those, a sub-test score *is* the binary outcome |
| 10 | `django-11019`'s 16 sub-tests put it in the **top 3%** | The example that made the idea look good is the least representative instance available |
| 11 | **Every paired sub-test difference in the pilot is exactly 0** | Wilcoxon discards ties, so the informative sample is not smaller — it is **empty**. 0 pairs against a floor of 6 |
| 12 | The strategies fixed **the same tests**, not merely reached the same verdict | A *sharper* statement of your null than the binary table can make. This sentence belongs in the paper |
| 13 | **PASS_TO_PASS regressions do discriminate.** 98% of instances have ≥1 P2P test (median 44); Diagnose+Revise broke **8** on `django-11283` where Blind Retry broke **0**; baseline broke **33** on `django-11019` | A candidate **new hypothesis about harm** — high cardinality, near-universal availability, observed variance |

### Found in Phase 2 — triage and CC-OS

| # | Finding | Consequence |
|---|---|---|
| 14 | **The proposal's triage precedence is wrong.** It checks `apply_failed` first | BROKEN must be first, or our own token ceiling is scored as the model's bad formatting (D18) |
| 15 | **`triage(attempt)` cannot return LOST.** Three classes are per-attempt; LOST is per-*sequence* | The signature has to split in two. Not implementable as written |
| 16 | **The novelty score inverts.** Gold patches are single-file (D21), so the file set is a constant of the *task*: novelty is exactly 0 on 21 of 26 retries, and all 5 non-zero values come from patches with **no readable file header** | The only attempts it calls novel are the ones too malformed to name a file. Replaced with Jaccard over *edited lines* (mean 0.46, real spread) |
| 17 | **LOST could not have fired, provably.** Attempt 1's novelty is 1 by definition, so a trajectory of exactly 3 attempts has one window containing it, and its mean is ≥ 1/3 whatever the data says. With ε = 0.2 < 1/3 it is unreachable **for any data** | Same shape as finding 6: arithmetic, not evidence. **Design requirement: K ≥ 4 rounds** |
| 18 | **λ fits to an interior 0.72 and still does not evidence context rot** — the 95% interval reaches **1.000** | `reportedLambda()` returns `null`; θ_c uses λ = 1, the stated null |
| 19 | **0 of 10 successes were ever retried** | Later-round denominators are conditioned on earlier-round *failure*, so λ̂ confounds decay with difficulty selection, biased downwards. **Survivorship again** — the same error as scoring a baseline over the cells that happened to produce a report, one level up |
| 20 | **The finite-horizon rule does not dominate the myopic one unconditionally.** My first draft asserted it did; the test refuted it. It holds iff the continuation value is non-negative, reversing when q·G < h | Both branches now pinned |
| 21 | That regime exposes a gap in the published rule: **there is no ABANDON action**, so with both options negative the policy keeps spending on the less-bad one | One line in Threats to Validity |
| 22 | **BROKEN has zero records** — every instrument limit in the pilot deleted its own cell instead of recording itself | A result about the *instrument*. The holes table has 7 entries where BROKEN has 0 |
| 23 | Under assumed `q`, the derived rule **escalates FORMAT** where the thesis says retry | Not a contradiction — a constraint. It agrees for **q_FORMAT < 0.78** (assumed 0.9, observed p = 0.5). The gate deliberately does **not** fail on this, so nobody edits the assumption until a test passes |

### Carried forward from the engine build (D0–D33)

The ones that still shape decisions: **D2** 8 of 24 cells produced no evaluable patch; **D3** the free-tier quota (20 req/day) *shaped the experiment*; **D5** the sample is non-random; **D6** no Docker, ever; **D8** 3× token cost for identical outcomes; **D15** 22 evaluations were invisible to the original tables; **D21** gold patches are single-file; **D25** 178% over the token ceiling; **D26** the baseline must be runnable or two of three conditions are structurally unreachable; **D29** no charting library.

---

## 6. What is **not** done, stated plainly

| | |
|---|---|
| **No live API call has been made** | By design. It belongs after in-principle acceptance |
| **No Docker test run** | D6. The 73 test-verified rows are the archive's, and there will never be another |
| **Phase 1c** | Blocked on the **equivalence margin** — a scientific judgement, not a computation |
| **N is deliberately unchosen** | It follows from the margin |
| **Phase 3 dashboard** | Not started. Six views specified in `BUILD.md` §5 |
| **Phase 4 writing** | Not started |
| Thinking adapter, budget guard, quota record | The three prerequisites before any live call |
| Repo ownership move | `recovery-bench` must sit under `Lagadnakul` before the Data Availability statement |

---

## 7. Running it yourself

```sh
cd recovery-bench
bun install
bun run verify          # all seven gates — this is the one to use

# individual commands
bun run doctor          # preconditions, offline
bun run report          # regenerate master_table.md from the archive
bun run power           # the sample-size analysis
bun run ccos            # triage + CC-OS
bun test                # 559 tests

# these would spend money — not run yet
bun run doctor:live     # probe endpoints with real keys
bun run try             # ONE cell, end to end
bun run sweep           # defaults to --project-only; needs --run --yes
```

`report`, `power` and `ccos` need `archive/legacy_runs/`, which is gitignored. The recipe to restore it is in `recovery-bench/archive/MANIFEST.md`. Their **derived output is committed**, so the results are readable without it.

On this machine Bun is at `~/.bun/bin/bun.exe` and is not on the Bash PATH — use PowerShell or the explicit path.

---

## 8. The shape of the paper, as the evidence now stands

Pulling the findings together, here is what your Stage 1 protocol can honestly claim:

**The contribution** is that the decision to escalate must be conditioned on the observed failure class, and that the class is observable for free. **Phase 2 proves the second half outright**: 51 records classified, 0 model calls, every one printing the field that decided it.

**The pilot's null is not a weak result — it is a precise one.** Finding 6 shows it could not have rejected on any data, and finding 12 shows the strategies fixed the same tests. That is an *equality*, which equivalence testing can state and a significance test cannot.

**My recommendation, unchanged from Phase 1b:** reframe H1 as **non-inferiority / equivalence**, add a **harm hypothesis** on PASS_TO_PASS regressions (finding 13), and report the binary McNemar as pre-registered secondary with the 460–765-task requirement in Threats to Validity.

**And four parts of the proposal would not have worked as written** (findings 14–17). Every one was caught before submission rather than by a reviewer. For a Registered Report that is not embarrassing — it is the entire point of the format, and saying so in the protocol is a strength.

---

## 9. What I need from you

1. **The equivalence margin.** The analogous study uses 5 percentage points. Phase 1c is one command once it is fixed — but it has to be defended in the protocol, so it is worth agreeing with your supervisors.
2. **Then N**, which follows from the margin.
3. **Which next:** Phase 3 (dashboard) or Phase 4 (writing)? Neither is blocked. The dashboard is the thing your professor will *see*; the protocol is the thing with the November deadline.

Memory files carrying all of this: `phase2-ccos-findings`, `power-analysis-finding`, `verify-command`, `crlf-hazard`, `provenance-commit-at-risk`, `repo-layout`, `decisions-locked`, `november-build-plan`, `two-repos-two-venues`, `user-stack-preference`.
