# Decision Log — recovery-bench

**Project:** rebuild of the experiment behind *Self-Reflection and Failure Recovery in
Agentic AI Coding Systems* (L. N. Kiran, M.Tech AI&DS, PIET, Parul University)
**Owner:** Aayush · **Thesis author:** Nakul
**Status of the thesis:** Chapters 1–6, references, figures and front matter are
**complete and submitted**. Nothing in this repository changes the submitted document.

This file records every decision taken, with the evidence behind it. It is the
document the other three (`ARCHITECTURE.md`, `CONFIG.md`, `BUDGET.md`) depend on.

---

## D0 — Why a new repository instead of cleaning the old one

The original working folder (`Dissertation-main/`) produced a real thesis and is
kept. It is not a program, and no amount of tidying makes it one.

Evidence gathered by direct inspection:

| Finding | Evidence |
| --- | --- |
| 30 scripts named by calendar day | `day2_step1…day15_step1`, flat in one folder |
| No entry point, no dependency manifest | no `pyproject.toml`, no `requirements.txt` anywhere |
| Model id hardcoded 17 times | `grep -c gemini-3.6-flash *.py` |
| Task ids inline in source | `TARGET_IDS = [...]` in `day15_step1_round2_all_conditions.py` |
| **Sampling never pinned** | `grep -n "temperature\|seed" *.py` → **zero hits** |
| Evaluation never scripted | no `swebench` or `docker` reference in any script |
| Source files fetched live at runtime | `raw.githubusercontent.com` inside the generation loop |
| ~~Code never version-controlled~~ | **Retracted — this was wrong.** The `git ls-files` check that produced "0 tracked files" ran against the enclosing home-directory repo, which tracks nothing at all. The code *is* version-controlled: `Lagadnakul/Dissertation` holds all 30 scripts and all 427 log files. History is 4 commits, 3 of them titled `push`, so it is thin — but it exists, and this row must not be used as evidence. |
| **Pipeline inputs lost** | `.gitignore` excluded `attempts/`; `day15` reads from it; the directory no longer exists |
| Three copies of the research diary | `01_Review_Diary/` is byte-identical to 9 files in `01_Research_Diary/`; `Reaserch_Diary/` is a third, misspelled |
| Empty files presented as notes | both files in `Category 1/` are **0 bytes** |
| Folder numbering skips 05 | `01, 01, 02, 03, 04, 06` |

**Decision.** Build `recovery-bench/` from zero. Keep `archive/` as a local
working copy of the submitted artifacts — read-only, never read at runtime — but
**do not commit it.** Step 0 established that every one of its 495 files already
exists in `Lagadnakul/Dissertation`, so the canonical provenance record is an
upstream commit, not a duplicate:

```
Lagadnakul/Dissertation @ c8872d070fb0b098394796dfbc68bcf67c3bd957   (2026-08-31)
```

An immutable upstream sha is stronger provenance than a copy, and it keeps this
repository at a few megabytes instead of thirteen. `archive/MANIFEST.md` records
the mapping and is committed; the payload is not.

**Consequence that must be disclosed.** Because `attempts/` is gone, the Round-2
Reflection condition **cannot be regenerated**. Historical numbers are available
by replay only. `LIMITATIONS.md` will say this in plain words.

---

## D1 — Scope: replicate *and* extend

Chosen from three options.

- (a) clean reproduction only — verifiable, modest
- (b) extension only — impressive, unverifiable against the thesis
- **(c) both — `replay` proves the submitted numbers, `sweep` goes beyond them** ✅

`replay` is the credibility anchor: every table and figure in Chapter 5
regenerated from committed logs, offline, with no API key. `sweep` is the
contribution.

---

## D2 — The build spec already exists: PLAN.md §8

`PLAN.md` §0 descoped seven items *for the writing phase only*, and §8 writes
them up as future work — which means Chapter 6 promises them **in print**.
Building them is executing the thesis's own stated next step, not inventing scope.

| §8 | Item | Status in this design |
| --- | --- | --- |
| 1 | OpenAI-compatible endpoint, 40+ RPM, no card | ✅ NVIDIA + QwenCloud |
| 2 | n ≥ 5 per cell, temperature and seed pinned, report variance | ✅ core of the grid |
| 3 | Stratified sampling across all 12 repos | ✅ `tasks/sampling.ts` |
| 4 | SWE-bench Verified | ⚠️ needs test execution — **out of scope**, see D6 |
| 5 | Multi-model | ✅ four arms |
| 6 | Strategy ladder L3–L7 | ◐ L3 and L4 only |
| 7 | Cost-aware metrics, Verified Recovery Rate with effort | ✅ token ledger |

---

## D3 — Providers and key mapping

Three providers, five keys, all in `.env.local` (never read into this repo's
history; only names are referenced).

| Provider | Base URL | Key | Role |
| --- | --- | --- | --- |
| **NVIDIA** | `https://integrate.api.nvidia.com/v1` | `NVIDIA_KEY_1/2/3` | **primary** — free trial, 3 keys, fastest model measured |
| **QwenCloud** | `https://maas.qwencloudapi.com/compatible-mode/v1` | `qwen_api_key` | held in reserve — 1M free tokens per model, then paid |
| **Google** | `google-genai` SDK | `gemini_api_key` | replication only — ~20 req/day |

NVIDIA and QwenCloud are both OpenAI-compatible, so **one adapter serves both**;
only `base_url` and the key differ. Gemini needs its own adapter. Two adapters total.

**Disclosure.** NVIDIA's pages read *"NVIDIA API Trial Terms of Service"* and state
that usage is logged. SWE-bench is public data so there is no confidentiality
issue, but any write-up must record that generation ran on a **trial** endpoint
with no availability guarantee.

---

## D4 — Model selection, from measured throughput

Measured on the NVIDIA playground (single `hi` call each — indicative, not a
benchmark; the spread is too wide to be noise):

| Model | TPS | TTFT | Decision |
| --- | --- | --- | --- |
| `nvidia/nemotron-3-ultra-550b-a55b` | **164.33** | **1.65 s** | ✅ capability arm |
| `z-ai/glm-5-3` | 79.14 | 1.22 s | ◐ optional third family |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | 48.93 | 1.27 s | ✅ reasoning arm |
| `meta/muse-glimmer-30b` | 29.46 | 2.12 s | ✅ workhorse |
| `z-ai/glm-5-3-flash` | 13.24 | 23.99 s | ❌ dropped |
| `nvidia/nemotron-3.5-lightning-30b-a3b` | 9.61 / 3.22 | 65.07 s / 34.74 s | ❌ dropped — two samples disagree 2× |
| `happyhorse-1.1-t2v` | — | — | ❌ text-to-video, not applicable |

**The names are misleading.** "Flash" is 6× slower than the 550B model;
"Lightning" has a 65-second time-to-first-token. Published names are not
evidence — `doctor` measures every endpoint before a grid is committed.

**Workhorse capability constraint.** A study of failure *recovery* needs
failures to recover from. If the baseline model resolves everything, there is no
failure pool and no study. The workhorse must therefore be
capability-comparable to `gemini-3.6-flash`, which is why a 30B model holds that
role and the 550B sits in a separate arm.

---

## D5 — Thinking must be off for the comparison arms

Several NVIDIA models accept `extra_body={"chat_template_kwargs":{"enable_thinking": true},
"reasoning_budget": 16384}`.

Two independent reasons this matters.

1. **Cost.** Reasoning tokens are output tokens. A 16k reasoning budget can
   consume a 1M free quota in roughly 60 calls.
2. **Validity — the serious one.** Nakul's `gemini-3.6-flash` run was
   non-reasoning. With thinking on, the model reflects on its own failure
   *internally*, which is precisely the variable the Reflection-only condition
   manipulates. Enabling it silently destroys the comparison.

**Decision.** `thinking: off` for the replication, workhorse and capability arms.
Then make it an arm of its own: *does a model's built-in reasoning substitute for
an explicit reflection prompt?* — same model, same tasks, thinking ON vs OFF,
strategy held constant. Not measured by anyone in Nakul's reference list.

---

## D6 — No Docker. Anywhere.

**User decision, taken deliberately.** It removes test execution from the system
permanently, and the design must be honest about exactly what that costs.

### What it costs

Docker exists in a SWE-bench pipeline for one job: running each repository's real
test suite to decide FAIL_TO_PASS and PASS_TO_PASS. Without it, **no new claim
about whether a patch fixes a bug is possible.**

### What survives — more than expected

Nakul's headline finding is:

> 3 of 3 **format-class** failures recovered · 0 of 4 **logic-class** failures recovered

A format-class failure is a patch that **never applied**. Detecting that needs
`git apply --check` against a repository checked out at `base_commit` — plain
git, no containers. **The thesis's central result is verifiable at the apply layer.**

| Capability | Available without Docker |
| --- | --- |
| Replay every Chapter 5 number and figure | ✅ |
| Live demo: generate → apply → show the retrofit | ✅ |
| Format-class vs logic-class finding | ✅ |
| Apply-rate across many tasks and models | ✅ |
| Token / cost / latency measurement (§8.7) | ✅ |
| Contamination check against gold patches | ✅ |
| Any new resolve-rate number | ❌ |
| SWE-bench Verified re-run (§8.4) | ❌ |

### The reframe this forces, and why it is a good one

Test execution is expensive; apply-checking is **free and instant**. So the new
work stops chasing resolve rates and instead does what no-Docker makes cheap:
**scale the format finding**. Nakul tested 4 tasks on 1 model. Apply-verification
can cover **all 300 SWE-bench Lite instances across four models** at a cost the
free tiers absorb.

That turns a four-task observation into a large-scale replication. It is a
narrower claim than resolve rate and a much better supported one.

### The integrity rule this creates

Two data sources now coexist and **must never be silently mixed**:

- **historical** — test-verified, from the archived `report.json` files
- **new** — apply-verified only

Every analysis row carries `verification: test | apply`. The analysis layer
**refuses to compute a resolve rate over apply-only rows**. This is enforced in
code, not by convention.

---

## D7 — Context compression is what buys the error bars

From `PLAN.md` D8: `astropy/wcs/wcs.py` is pasted **whole** into every prompt for
that task — **31,098 tokens per call**.

Sending only the target function or class ±50 lines brings that to roughly 3k.
Average call drops from ~17k to ~8k tokens, which is what makes n=5 repeats fit
inside the free quotas.

**Therefore §8.7 (cost-aware metrics) and §8.2 (statistical power) are the same
engineering problem.** Compression is not an optimisation; it is the thing that
makes variance measurable. It is also independently reportable.

---

## D8 — Contamination becomes a first-class outcome

Nakul already hit a RECITATION safety block on `astropy-14182` with a *small*
model — disclosed in the thesis at our recommendation.

The models now in play are far larger (550B active-55B; 2.4T and 2.8T on
QwenCloud) and trained well after SWE-bench Lite became a standard benchmark. If
one emits the gold patch verbatim that is memorisation, not repair.

**Decision.** Compare every generated patch against the gold patch; flag exact
and near-exact matches as a reported outcome category, never a silent pass.
Measuring it strengthens the work; omitting it would quietly invalidate it.

---

## D9 — Conditions are data, not scripts

The single structural decision.

In the original code each condition **is a script**, which is why six
near-duplicate files exist and why cells vanish: when a script finds a patch
inapplicable it prints `Not applied` and writes nothing, so the cell ceases to
exist. `PLAN.md` D2 records that **8 of 24 cells** disappeared this way — and
that those dropped cells were *the most frequent single outcome in the study*.

**Decision.** The unit of work is a **cell**:
`(task, strategy, model, edit_format, thinking, round, repeat)`.
The full grid is enumerated up front, written to disk as a queue, and every cell
terminates in a recorded outcome **with a reason**. Nothing can silently vanish.
A test asserts it: `tests/test_grid_no_holes.py`.

---

## D10 — Language and stack: TypeScript on Bun

**Revised.** An earlier version of this decision chose Python. That choice was
made *before* D6 removed Docker, and was not re-derived afterwards. Docker was
the thing that made Python necessary.

### What Python was actually carrying, and what survives D6

| Python dependency | Survives? |
| --- | --- |
| `swebench` harness — test execution | ❌ removed by D6. **This was the only hard anchor.** |
| `datasets` — load SWE-bench Lite | ❌ the dataset is plain JSON over HTTP (verified below) |
| `difflib.unified_diff` | ❌ `jsdiff` emits unified diffs `git apply` accepts |
| pandas / matplotlib | ❌ ~125 JSON files grouped and counted; figures render in the dashboard, which is already JS |
| `google-genai` | ❌ `@google/genai` |
| `openai` | ❌ the npm client is first-class |
| git operations | ❌ subprocess either way |

The dataset claim was verified, not assumed:

```
GET datasets-server.huggingface.co/rows?dataset=princeton-nlp/SWE-bench_Lite…
num_rows_total: 300
fields: repo · instance_id · base_commit · patch · test_patch ·
        problem_statement · hints_text · created_at · version ·
        FAIL_TO_PASS · PASS_TO_PASS · environment_setup_commit
```

All 300 instances, every field the pipeline needs, no Python. The loader is
replaced by a **one-time export to a committed `data/swebench_lite.jsonl`**,
which is strictly better: it freezes the dataset revision into the repository
instead of re-fetching it per run.

### Why TypeScript is a better fit here, not merely an equal one

Three parts of this design are typed structures, and TypeScript checks them at
compile time where Python could only check them at runtime.

1. **The outcome taxonomy is a discriminated union.** Eight terminal states, each
   carrying a different payload. Adding a ninth without handling it everywhere
   becomes a build error.

   ```ts
   type Outcome =
     | { kind: "APPLIED";      patch: string }
     | { kind: "MALFORMED";    block: number; nearest: string }
     | { kind: "APPLY_FAIL";   gitStderr: string }
     | { kind: "CONTAMINATED"; similarity: number }
     | { kind: "BUDGET_STOP";  provider: string; spent: number }
     // …
   ```

2. **D6's integrity rule stops being a convention.** A resolve rate must never be
   computed over apply-only rows. In TypeScript that is a type, not a guard:

   ```ts
   resolveRate(rows: Row<"test">[]): number   // apply-rows will not compile
   ```

3. **One language end-to-end.** The dashboard was always HTML/JS. Python meant two
   toolchains, a virtualenv, and a language boundary inside a repository whose
   stated goal is being readable in ten minutes.

### The stack

| Concern | Choice |
| --- | --- |
| Runtime, package manager, test runner | **Bun** (1.3.14 present) |
| Language | **TypeScript**, `strict: true` |
| Config validation | **Zod** — replaces pydantic; same role, same hashing |
| API clients | **openai** (NVIDIA + QwenCloud), **@google/genai** (Gemini) |
| Unified diffs | **jsdiff** `createTwoFilesPatch` |
| Dataset | one-time export → committed `data/swebench_lite.jsonl` |
| Repo checkout | `Bun.spawn` → plain `git` |
| Tests | `bun test`, built in |
| Repo shape | **Bun workspaces** — `core` / `pipeline` / `dashboard` |

### The two real costs, accepted

1. **Re-adding test execution gets harder.** The SWE-bench harness is Python; a
   future Docker-based evaluator would have to be shelled out to. D6 is a
   deliberate decision rather than a temporary constraint, so this is acceptable
   — but it is the one door this closes.
2. **Python is the expected language for an AI dissertation artifact.** Weighed
   low: what lands with a reader is the design and the demo, and a single
   polished TypeScript repository presents better than a Python pipeline with a
   bolted-on JavaScript frontend.

### One thing to prove at step 1, not assume

**`jsdiff`'s unified-diff output must be accepted by `git apply`.** That format is
what the entire thesis finding rests on. `doctor` verifies it against a known-good
gold patch before anything else runs. If it fails, the fallback is small — emit
the diff directly, it is a well-specified format — but it must be proven, not hoped.

---

## D11 — Dashboard: Vite + React, not Next.js

The dashboard must look genuinely professional; it is the artifact a reader sees
first. That makes the framework question worth answering properly.

### Next.js is the wrong tool for this particular job

Next.js earns its weight through routing, server rendering, server components,
data fetching and image optimisation. This dashboard has **none of those needs**:
it is a local, offline, single-view page that reads JSON files produced by the
pipeline. Everything Next.js adds here is toolchain without benefit, and it
introduces a dev server between the reader and the demo.

**The framework does not determine how professional it looks.** The design system
does. Next.js and Vite render identical output given identical components.

### The choice

| Option | Verdict |
| --- | --- |
| Static HTML + vanilla JS | too little — no component model, the grid view alone justifies React |
| **Vite + React + TypeScript + Tailwind** | ✅ static build, shares types with the pipeline, no server |
| Next.js static export | works, but heavier toolchain for capabilities this page never uses |

Chosen: **Vite + React + TypeScript + Tailwind**, built to static assets, served
locally with `bun run serve`. If Next.js is preferred later the component code
transfers unchanged — the decision is reversible.

The decisive advantage is shared types. `packages/core` exports the `Outcome`
union and the `Row<V>` type; the pipeline **writes** them and the dashboard
**renders** them. A change to the outcome taxonomy breaks the dashboard build
immediately rather than producing a silently wrong chart.

### Visual and charting rules

The 11 `.drawio` thesis figures are greyscale because print demanded it. The
dashboard is on screen and carries no such constraint, so it uses full colour —
while keeping the same typographic and shape language so the two read as one
project.

Data jobs, and the form each one takes:

| View | Data's job | Form |
| --- | --- | --- |
| Headline — 3/3 format-class vs 0/4 logic-class | a single number | **stat tiles, not a chart** |
| The grid — every cell by outcome | state | **matrix, status palette** |
| Apply rate by edit format (A5) | magnitude, 2 series | **bar** |
| Sub-tests, `django-11019` 6/16 (replay) | magnitude against a whole | **bar with full-scale track** |
| Tokens per strategy | magnitude | **bar** |
| The retrofit, `django-11620` | identity | **side-by-side diff, no chart** |

Binding rules for every chart in this project:

- the eight outcome states use a **reserved status palette** (good / warning /
  serious / critical), never the categorical series hues, and always ship with a
  label — **never colour alone**
- **one axis, always.** No dual-axis charts anywhere
- the palette is **validated by script**, never by eye, in both light and dark
  mode before any chart ships
- dark mode is chosen deliberately from the same ramps, not an automatic inversion
- a table view exists for every chart
- a zero value draws **no bar** — a dashed full-scale track shows the denominator
  instead. This bug was already found and fixed once, in thesis Figure 5.2
## D12 — What is deliberately not built

| Not built | Why |
| --- | --- |
| Test execution / resolve rates on new runs | D6 — no Docker |
| SWE-bench Verified re-run (§8.4) | requires test execution |
| L5 checkpoint/rollback, L6 circuit breaker, L7 failure memory | registered in the strategy registry, unimplemented; a second project |
| Re-running Nakul's exact Round-2 Reflection | D0 — `attempts/` is lost |
| Any edit to `Self.docx` | the thesis is submitted and final |

---

## D13 — What actually makes a hand-written unified diff fail

**Measured in step 1, not assumed.** The thesis's mechanism claim is that weaker
models fail on unified diff because they cannot compute `@@` line numbers. Step 1
put that claim on a bench, and it is *too coarse*. `git apply` was given the same
correct edit five times, varying one defect at a time:

| Defect | `git apply --check` | Evidence |
| --- | --- | --- |
| start line wildly wrong — `-999,3` for a hunk at line 21 | **ACCEPTED** | git rescans the file for the context block |
| start line wrong but nearby — `-1,3` for a hunk at line 21 | rejected | `error: patch failed: f.py:1` |
| hunk **length counts** wrong — `-21,9` over a 3-line body | rejected | `error: corrupt patch at line 8` |
| a **context** line's text misquoted | rejected | `error: f.py: patch does not apply` |
| a **deleted** line's text misquoted | rejected | `error: f.py: patch does not apply` |

So the fatal defects are, in order of how likely a model is to commit them:

1. **Misquoting the surrounding source.** The model must reproduce context and
   deleted lines byte-exactly — whitespace, quote style, trailing commas and all.
   This is a *recall* problem, not an arithmetic one.
2. **Inconsistent hunk lengths.** The `,n` counts must agree with the number of
   body lines. This *is* arithmetic, and it is unforgiving.
3. The start line is the part git is most willing to forgive.

**Why this matters more than a footnote.** It sharpens what arm A5 measures. The
comparison is still `unified_diff` against `search_replace`, and SEARCH/REPLACE
still removes both fatal defect classes at once — no counts to compute, and the
search text is matched by us with a clear `MALFORMED` diagnosis rather than
swallowed by git. But the *explanation* in the write-up changes: the retrofit
works because it removes the need to **reproduce source text exactly inside a
counted envelope**, not merely because it removes line arithmetic.

It also changes how an `APPLY_FAIL` is read. Since git tolerates a badly wrong
start line, an `APPLY_FAIL` on a `unified_diff` cell is strong evidence that the
model got the *source text* wrong — which is a more interesting finding than a
counting error, and one that the `gitStderr` field on the outcome now preserves
per cell so the two causes can be separated at analysis time.

`tests/toPatch.test.ts` pins all five rows. If a future git tightens or loosens
this behaviour, the suite says so, because the interpretation of every
`unified_diff` result depends on it.

---

## D14 — The format finding, measured offline from the archive

Step 2 found something nobody had noticed: `archive/legacy_predictions/*.json`
holds **61 real model patches** — the `model_patch` field per instance. Since
`attempts/` is gone (D0), these are the only surviving trace of what the models
actually wrote, and they are enough to quantify the format finding with **no API
call, no network and no Docker**.

Running the tested validator (`packages/pipeline/edits/unified.ts`) over all 61:

| Era | Patches | Structurally clean |
| --- | --- | --- |
| **the model wrote the diff** | 51 | **30 (58.8%)** |
| **`difflib` wrote the diff** (post-retrofit) | 10 | **10 (100%)** |

Defects, counted once per patch:

| Reason | Patches |
| --- | --- |
| `hunk_count_mismatch` | 16 |
| `no_file_header` | 6 |

**41% of model-written diffs are invalid before the source file is even
consulted.** The retrofit takes that to zero — not by luck but by construction,
because `difflib` cannot miscount and cannot omit a header.

Two details worth keeping.

**Six patches have no file header at all** — they begin directly at `@@`. That is
not an arithmetic error; git has no way to know which file to patch. It is a
failure mode the thesis's "cannot compute line numbers" framing does not describe,
and it is 12% of the diff-era sample.

**Prose before the header is not counted as a defect.** Two patches begin
`valid unified diff\n--- a/…` — a fragment of the prompt echoed back. D13 measured
that git tolerates leading junk, so flagging it would make the validator stricter
than the authority and inflate the defect count.

### The miscount that nearly published the wrong number

The first pass at this reported **3/51 clean, and 0/10 for the difflib era**. Both
were wrong. `text.split("\n")` leaves a trailing `""` for a newline-terminated
patch, and counting it as a context line inflates every hunk body by exactly one —
which is why the defect list was dominated by `decl 7,7 vs body 8,8`.

The give-away was the control: `difflib`-generated patches are valid by
construction and several are recorded as having applied, so a 0% clean rate could
only mean the analysis was broken. **The control caught the error, not review.**

Two consequences, both now permanent:

1. The logic lives in `validateDiff` with `tests/unified.test.ts` around it,
   including an explicit regression test for the trailing newline.
2. `scripts/audit_legacy_patches.ts` **refuses to present a number** if any
   difflib-era patch shows a defect, writing a warning into the output instead.
   `tests/legacyPatches.test.ts` asserts the warning list is empty.

The result is committed to `data/legacy_patch_audit.json` — 28 KB, per-patch
reasons plus era totals — because the archive payload is gitignored, so the
derived figure must be committed or it is lost with it.

---

## D15 — Twenty-two evaluations left a patch and a log but no result

**Decision.** Replay walks instance *directories* and treats a missing
`report.json` as evidence, not as absence.

The archive holds 95 evaluated instance directories, 73 `report.json` files and
95 `patch.diff` files. The 22-file gap is not corruption. The SWE-bench harness
raises before writing its report when `git apply` refuses the patch:

```
swebench.harness.utils.EvaluationError: Error in evaluation for
django__django-11039: >>>>> Patch Apply Failed:
patch: **** Only garbage was found in the patch input.
```

`reports/data/build_master_table.py` globs for `report.json`, so those 22 cells
are invisible to every table it produces.

**This is the defect ARCHITECTURE §2 was written against, found in the wild.** A
failed cell left no record, which is exactly how "8 of 24 cells ceased to exist"
in the original write-up. It is also why `Row<V>` carries its verification in the
type: 9 of the 22 fall inside registered runs and are now first-class rows, and
none of them can ever be counted into a resolve rate, because `resolveRate` does
not accept `Row<"apply">`.

The git messages are the D13/D14 defect classes seen from the other side —
20 report `Only garbage was found in the patch input` (a diff with no usable file
header) and the rest `malformed patch at line N` (declared hunk counts
disagreeing with the body). Two independent measurements of the same mechanism.

**Also recorded:** `build_master_table.py` drops unclassified runs with
`if run in IGNORE or run not in RUNS: continue`, collapsing "deliberately
excluded smoke test" with "run nobody classified". `day11_test`, `day4_test` and
`day4_test2` are the second kind — 7 directories, none with a report. Replay
reports them as `unregistered` rather than discarding them silently.

---

## D16 — The failure class is derived, and it matches

**Decision.** `FAILURE_CLASS` is computed from outcomes and compared against the
hand-written dict, rather than imported from it.

`build_master_table.py` opens with *"Nothing in this script invents a number.
Every cell is read from a report.json."* That holds for 38 of its 42 records. The
other four are a literal:

```python
for t in ["astropy__astropy-14182", "django__django-11039",
          "django__django-11583", "django__django-11620"]:
    w(f"| {n} | `{t}` | **no** | ERROR (malformed patch) | n/a | n/a |")
w("- Patch never applied (format-class failure): **4/20**")
```

and `FAILURE_CLASS` — the logic/format split the whole thesis turns on — is a dict
somebody typed. It could not have been derived there: an apply failure produces
no `report.json`, and the script reads nothing else. The evidence was sitting in
`run_instance.log` the whole time (D15).

**The result: the derived map equals the hand-written one exactly.** All 8 pool
tasks, both classes, no missing and no unexpected entries. The derived failure
pool matches `failure_pool.json`, which is a third independent copy. The
submitted document is correct.

What changes is its status. A constant that nothing could contradict is now a
claim with a test attached — `tests/analysisClassify.test.ts`. If a future change
breaks it, either the dissertation's central classification is wrong or the
pipeline is, and the suite says so rather than quietly agreeing with itself.

**The same applies to `master_table.md` as a whole.** A second, independent
implementation regenerates it byte-for-byte (`tests/replayOracle.test.ts`). Every
Chapter 5 figure dataset is likewise derived and pinned against the literals in
`make_figures.py`, which types its numbers straight into draw.io shapes
(`("Resolved&#xa;12", 12, ...)`).

**The one thing not derived** is the 1x/2x/3x cost multiplier in figure 5.4. The
archive holds no usage records — the original never captured them, which is why
`Usage` is nullable on every replayed row. It is carried as a labelled input from
`reports/data/config.md` rather than presented as something this pipeline
measured. Step 4's budget ledger is what fixes that going forward.

**Not done, deliberately:** the `.drawio` sources and their PNG exports are not
regenerated. They are already embedded in `Self.docx`, which is final and cannot
be re-exported, so rewriting them could only introduce drift between the
repository and the submitted document. Making the numbers checkable was the
missing part; making them re-renderable was not.

---

## D17 — `doctor --live` was reporting three falsehoods

Step 4's first act was to call the endpoints. That immediately invalidated the
output of the gate written to measure them:

```
ok    muse_30b               ttft   n/a   n/a tok/s
ok    nemotron_nano          ttft   n/a   n/a tok/s
ok    nemotron_ultra         ttft 1.69s  94094.4 tok/s
```

Three separate defects, all in the direction of false confidence.

**1. Two models were reported `ok` having produced no output at all.** The probe
asked for `max_tokens: 16`, and these are reasoning models: all sixteen tokens
went to undisclosed chain-of-thought, `content` came back `null`,
`finish_reason` was `length`. TTFT latched only on `delta.content`, so it never
fired — and the code read a null TTFT as "unmeasured" rather than "nothing was
said". A gate that passes a model which answered nothing is worse than no gate.

**2. `nemotron_ultra` was reported at 94,094 tokens per second.** Throughput was
computed as `completion_tokens / (end - ttft)`. When the visible content arrives
in one burst at the close of a long reasoning stream, that window collapses
toward zero and the quotient explodes. The number was not a measurement of
anything.

**3. Gemini was never probed at all** — `probe not implemented for kind gemini`
had been sitting in the output as a tolerated warning.

Fixed by delegating to the new provider layer: TTFT latches on the first token
of *any* kind, throughput is measured over the whole generation window, a model
that produces no visible content reports `WARN` rather than `ok`, and Gemini has
a real implementation.

**Throughput is also reported as `null` when the sample cannot support it.**
Once thinking is genuinely disabled (D19) a "reply with ok" probe costs two or
three tokens, and dividing by a sub-millisecond window turned that into
"3000.0 tok/s" — the same falsehood in a smaller costume. Below twelve
completion tokens or a forty-millisecond window there is no measurement, and
`null` says so. The probe now asks for forty lines of counting instead, which is
long enough to measure and still free.

**A caution that survives the fix:** consecutive probes of `muse_30b` measured
**266.7** and **39.3** tok/s, a factor of 6.8. Single-sample throughput is not a
basis for a runtime estimate, which is the same lesson the original model-choice
screenshots taught and the reason this gate exists at all.

---

## D18 — `TRUNCATED` is a ninth outcome, and it is not format-class

The measurement in D17 has no name in the eight-outcome taxonomy. A response
severed by our own token ceiling is:

- not `NO_OUTPUT` — the model was producing text when we cut it off
- not `MALFORMED` — nothing about it was malformed
- not `APPLY_FAIL` — no patch was ever offered to `git`

So `TRUNCATED` is added, carrying `finishReason`, `completionTokens`,
`maxTokens` and `contentChars`.

**The consequential half is what it is excluded from.** `isFormatClass` carries
the thesis's central measurement — the claim that patches fail because of edit
format rather than reasoning. Counting a response *we* truncated as a
format-class failure would inflate that number with our own configuration. It is
precisely the category error of scoring a baseline over only the tasks that
happened to produce a report file, which is the defect D15 found in the original
analysis.

`TRUNCATED`, `BUDGET_STOP` and `PROVIDER_ERROR` are therefore grouped by a new
predicate, `isInstrumentLimit`: outcomes that measured nothing about the model
and must be reported separately rather than folded into either failure class.
The archive already contained one such case — `astropy__astropy-14182` stopped
for Gemini `RECITATION` and is excluded from the recovery denominator — so this
generalises an existing precedent instead of inventing a rule.

**Found by mutation testing, not by design.** Adding `TRUNCATED` to
`isFormatClass` broke **nothing** in a 237-test suite: the predicate that
carries the headline number had no test of its own. `tests/outcomeClass.test.ts`
now pins both sets exhaustively, asserts they are disjoint, and fails if a tenth
outcome is added without being classified. The same mutation now kills three
tests.

---

## D19 — `thinking: false` was never sent on the wire

The config has declared `thinking: false` for every model since step 1. The
request never mentioned it. So every call ever made by this project — and every
call made by the original study — ran with the vendor default, which is thinking
**on**.

The control is `chat_template_kwargs: {"enable_thinking": <bool>}` for the
OpenAI-compatible providers and `generationConfig.thinkingConfig.thinkingBudget`
for Gemini. Measured, one key per model, on "Reply with exactly: ok":

| model | no kwargs (what we sent) | `enable_thinking: false` | `enable_thinking: true` |
| --- | --- | --- | --- |
| `nemotron_ultra` | 153 reasoning chars · 38 tokens | **0 chars · 2 tokens** | 115 chars · 31 tokens |
| `nemotron_nano` | 503 capacity error | **0 chars · 3 tokens** | 185 chars · 49 tokens |
| `muse_30b` | 313 chars · 84 tokens | 120 chars · **41 tokens** | 313 chars · 84 tokens |
| `gemini_flash` | 93 thought tokens | **0 thought tokens** | — |

Three consequences.

**The flag works, and it is worth 16–19x.** `nemotron_ultra` costs 38 completion
tokens to say "ok" with the vendor default and 2 with thinking off.

**`muse_30b` does not honour it.** Reasoning drops from 313 characters to 120
but never reaches zero. That is a D5 validity threat with a name: an arm
configured `thinking: false` against `muse_30b` is not actually a no-thinking
arm, and a Reflection-only comparison drawn against it measures something else.
`doctor` reports it rather than letting it pass.

**This is the `8_000_000` defect again** (D3), in a different field: a setting
that existed in configuration, was believed to be in force, and was never
transmitted. Both are now regression-tested — `tests/providers.test.ts` asserts
the flag appears in the request body, and removing it kills three tests.

---

## D20 — NVIDIA answers HTTP 200 with an empty body under concurrency

Probing four NVIDIA models with `Promise.all` returned, for two of them, an
HTTP **200** whose SSE stream contained zero deltas and no usage block. A
sibling request in the same batch returned the honest version of the same
condition:

```
503 ResourceExhausted: Worker local total request limit reached (16/16)
```

Run sequentially, the same two models answer in under half a second.

This matters more than a flaky gate. A 200 with an empty body reaching the sweep
would be recorded as the model producing nothing — `NO_OUTPUT`, attributed to
the model, in a results table. A capacity limit on the provider's side would
have been written down as a finding about model behaviour.

Two fixes. The probe treats zero deltas *and* no usage as a `ProviderError`
naming provider capacity, retryable, rather than as an empty answer. And
`doctor` probes sequentially with a pause and one retry, because a pre-flight
check that manufactures its own failures is worse than none — latency in a gate
is irrelevant, correctness is not.

**Both halves were needed.** Sequential probing alone still tripped the empty
stream on back-to-back requests; the retry alone would have masked a real
outage. Together the gate passes honestly, and when it fails it says why.
