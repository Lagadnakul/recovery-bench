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

---

## D21 — Oracle localisation is faithful, and it costs nothing

The original picks the file to edit out of the gold patch:

```python
def extract_target_files(gold_patch):
    paths = re.findall(r"^--- a/(.+)$", gold_patch, re.MULTILINE)
target_files = extract_target_files(task["patch"])
file_path = target_files[0]
```

This is **declared method, not an oversight.** The dissertation describes its
own system as *"single-shot, oracle-localised, single-file patch generation"* and
its configuration table records *"File localisation | Oracle — target path
parsed from the gold patch"*, noting the term of art. Reproducing Chapter 5
therefore requires reproducing this exactly, so `tasks/localise.ts` does.

Two things were checked rather than assumed.

**Only the path crosses the boundary.** `localise()` returns a string. There is
no route by which the gold diff could reach a prompt, and
`tests/tasksLayer.test.ts` asserts directly that a rendered prompt contains the
current file content but not the reference solution — including the case where
the gold patch's replacement text would be a giveaway.

**`[0]` discards nothing.** The original silently takes the first target. I
measured every instance in the frozen export: **all 300 SWE-bench Lite gold
patches touch exactly one file.** So the single-file restriction belongs to the
benchmark, not to the study's design, and the study loses no task to it. The
test asserts this across all 300, and `localise()` now *refuses* a multi-file
patch instead of quietly dropping edits — the measured invariant is the
justification for taking the first, and an unchecked assumption that happens to
hold is one dataset revision away from silent data loss.

---

## D22 — Diagnose+Revise cannot always be honoured, so provenance became data

This is the hardest problem in step 5 and the reasoning matters more than the
code.

Diagnose+Revise is *defined* by what it adds to Reflection-only: the real result
of running the previous patch against the real test suite. Its prompt says so to
the model in as many words —

> *"Here is the REAL, ACTUAL result of running your previous patch against the
> real test suite (ground truth, not a guess)"*

That single placeholder, `{real_evidence}`, is the manipulated variable of the
entire study. `tests/promptOracle.test.ts` proves it is the only difference
between the L2 and L2.5 templates.

**This pipeline cannot run tests.** D6 forbids Docker, permanently. So for a
newly attempted task the strongest available evidence is `git`'s refusal of the
patch: real, but categorically weaker than test output, and available only when
the patch failed to apply at all.

Three ways to handle that, and only one is defensible:

1. **Synthesise plausible test output.** Fabrication. Never.
2. **Quietly substitute the apply error and still call it Diagnose+Revise.**
   This is the tempting one and it is the worst, because the condition would
   silently mean two different things depending on the task and no reader could
   tell which. It would make the result unfalsifiable.
3. **Record the provenance and let the analysis refuse to pool incomparable
   cells.**

Option 3. `EvidenceSource` is `"archived_test" | "apply_error" | "none"`, and it
travels with the cell exactly as `Row<"test">` versus `Row<"apply">` travels
with a verification (step 1). Every row carries `comparableToChapter5`.

Consequences, all deliberate:

- **`archived_test` exists only for cells the original already evaluated.** Those
  Docker results are in the archive and cannot be regenerated. This pipeline can
  read that evidence; it can never produce more of it.
- **An archived *apply failure* is labelled `apply_error`, not
  `archived_test`.** Being in the archive does not make it test output. Getting
  this wrong would inflate the count of comparable cells, so it is tested.
- **`none` refuses the cell.** A Diagnose+Revise prompt with an empty evidence
  block tells the model it is receiving ground truth and then shows it nothing.
  The strategy declines and the row records why — it is not run as
  Reflection-only under an L2.5 label.

The original's truncation is preserved exactly — an 800-character window on the
apply error, a 3000-character tail on the whole block, with the
`...[earlier output trimmed]...` prefix — because those are part of the prompt
and therefore part of the experiment.

---

## D23 — Exact Round 2 replication is impossible, and new Round 2 is not

Round 2 fed the model its **round-1 raw response**:

```python
with open(f"attempts/{instance_id}_diagnoserevise_v2_raw.txt") as f:
    round1_diagnose = f.read()
```

`attempts/` is gone (D0). The `predictions*.json` files preserve the 61
*patches* (D14), but a patch is not the response: the prose — the REFLECTION,
the DIAGNOSIS, the EXPLANATION — is what round 2 was shown, and it was never
archived anywhere.

So **Chapter 5's Round 2 cannot be reproduced cell-for-cell, and this is
permanent.** No amount of engineering recovers deleted text. The archived R2
results in `master_table.md` remain the record, and step 3 regenerates them
byte-identically from the evaluation logs.

**New multi-round runs are unaffected.** This pipeline keeps each round's full
response in the `Attempt` it hands forward, so round 2 gets exactly what the
original's round 2 got. The capability is intact going forward; only the
backward replication of those specific cells is lost.

Recorded because it is a viva-relevant limitation that a reader might otherwise
mistake for an implementation gap.

---

## D24 — Symbol-mode context compression is deferred, and why

`configs/base.yaml` declares `tasks.context.mode: symbol` with
`padding_lines: 50`. D7 explains the motive: `astropy/wcs/wcs.py` is 3300 lines
and pasting it whole costs **31,098 tokens per call**, which is what makes n=5
repeats unaffordable. The warm-cache run confirms the file size.

Step 5 implements `whole_file` only, and the reason is methodological rather
than practical.

To send only the relevant function or class, something must decide which one.
The honest sources are the problem statement, which is unreliable, or the gold
patch's hunk headers — **which is strictly more oracle information than the file
path alone.** Oracle localisation is already declared method (D21); oracle
*symbol* selection would be a further concession, changing what the system is
and what its results mean. That deserves its own decision and its own
disclosure, not a quiet default.

So `whole_file` is what the replication arms use, because it is what Chapter 5
used. Symbol mode stays declared and unimplemented until the localisation
question is settled deliberately. A prompt built under a different context mode
is a different prompt, so the mode belongs on the row alongside evidence
provenance whenever it is added.

---

## D25 — The committed grid exceeded its own budget by 178%, unnoticed

`budget.estimate_before_run: true` has been in the config since step 1 with
nothing implementing it. Step 6 implemented it, and the first run of the
projection found the enabled grid needed **14.56M tokens against an 8M
ceiling**:

```
a5_format_at_scale     720 cells  8.32M
a4_reasoning           240 cells  2.97M
a2_workhorse           120 cells  1.49M
a3_capability          120 cells  1.49M
a1_replication          24 cells  0.30M

nvidia   14.27M / 8.00M tokens (178%)   <<< EXCEEDS
```

`a5_format_at_scale` alone exceeds the whole ceiling, because it runs 60
stratified tasks through whole-file context, in two formats, three times each —
and those tasks include `matplotlib/figure.py` at 3,444 lines and
`astropy/wcs/wcs.py` at 3,300.

This is the `max_tokens: 8_000_000` defect in a new form (D3). There, a declared
ceiling was never compared against anything because YAML read it as a string.
Here, a declared ceiling was never compared against the declared *grid*. In both
cases the configuration looked complete and nothing checked it.

**The projection refuses to start rather than truncating**, and names the arms
responsible so the choice is the operator's. The estimate is built from real
cached file sizes, never an average: a grid affordable on average is not
affordable.

**The obvious wrong fix is to raise the ceiling.** It is one line, and it would
make the warning disappear without changing anything real. The ceiling is only
meaningful as a claim about the actual allowance — see D28 for the one case
where raising it was legitimate, and why it had to be declared rather than
multiplied.

---

## D26 — Reversed: the baseline must be runnable, or two of three conditions cannot run

Step 5 made `l0_baseline` replay-only, reasoning that Chapter 5's baseline
numbers are already definitive — 12/20 resolved, Docker-verified, regenerated
byte-identically by step 3 — so re-running it could only produce a weaker
measurement.

That reasoning was correct about *replication* and wrong about everything else.
The first live sweep proved it: of 24 cells in `a1_replication`, **16 refused**.

```
  8  l2_reflection needs a previous attempt to reflect on, and no earlier round produced a response
  8  l2_5_diagnose_revise needs a previous attempt to diagnose, and no earlier round produced a response
```

The recovery conditions are *defined* by looking back at a failure. In the
original that prior was the baseline: `day8_test` is round **R0**, and every
condition's R1 reflected on it. A grid with no round 0 therefore makes
Reflection-only and Diagnose+Revise structurally unreachable — two thirds of the
recovery design, silently unrunnable.

So the decision is reversed. `l0_baseline` now runs, with prompts taken from the
study itself and keyed by edit format:

| format | template | shape |
| --- | --- | --- |
| `unified_diff` | `day7_step1_generate_full_pilot.py` | `PATCH:` section, asks for a diff |
| `search_replace` | `day12_step1_blindretry_searchreplace.py` | `EDITS:` section, SEARCH/REPLACE |

The second is the same file as `l1_blind_retry`, deliberately: that prompt shows
the problem and the file and *no history*, so it already is a first-attempt
prompt.

**What stays replay-only is the claim, not the code.** A baseline run here
cannot say "resolved" — no Docker (D6) — so it is a new measurement, not a
reproduction of 12/20. `bun run replay` remains the source of the submitted
numbers.

Two structural consequences:

**One baseline per group, shared by all three conditions.** The group is
(task, model, format, thinking, repeat) — deliberately *not* including the
strategy. A per-condition baseline would give each condition a different failure
to recover from, and the comparison between them would stop being about the
condition. This mirrors the original, where one `day8_test` attempt fed all
three.

**The sweep runs in two phases.** Baselines first, then the conditions that read
them. Running them interleaved would either serialise every condition behind one
lineage or hand round 1 an empty history.

Grid size goes from 1,224 cells to **1,308** — 84 baselines, one per group.

---

## D27 — Reflecting on nothing is a refusal, not a prompt

A cell whose condition was refused, whose budget was spent, or whose provider
failed still records an attempt. That is the no-holes guarantee and it is not
negotiable. But such an attempt has an **empty response**, and the conditions
that look backwards read the *response*.

Left alone, that produced a prompt announcing

> *Here was your PREVIOUS ATTEMPT, which did not successfully fix the bug:*
> *---*
> *---*

above nothing at all. The prompt would be asserting something false to the
model, which is the same defect as an empty evidence block (D22).

So `lastRealAttempt` scans backwards for the most recent round that actually
said something, and the condition refuses when there is none. Scanning rather
than taking the last also means a transient provider failure in round 2 does not
destroy round 3's ability to reflect on round 1.

Found while preparing the first live sweep, not by a test — which is why it now
has four.

---

## D28 — Three keys are three accounts, so the ceiling is per key

The NVIDIA ceiling is 8M tokens. The three keys in `api_key_env` were each
created from a **separate** build.nvidia.com account, so each has its own
allowance and effective capacity is 3 × 8M.

That fact cannot be measured from outside. Probing all three keys returns no
quota headers at all:

```
=== KEY_1   HTTP/2 200
=== KEY_2   HTTP/2 200
=== KEY_3   HTTP/2 200
```

No `x-ratelimit-remaining`, no credit balance. Three keys on *one* account would
share a pool and look identical from here. So the arrangement is **declared in
config** rather than inferred:

```yaml
budget:
  nvidia:
    per_key: true
    max_tokens: 8000000
```

Declaring it is the point. Multiplying `max_tokens` to 24M would have produced
the same arithmetic while hiding the claim; `per_key: true` states it, so a
reader can see what is being asserted and contradict it. And capacity is
computed from the keys that are actually **set**, not from the config's optimism
— two keys present means twice the ceiling, not three times.

Two changes were needed to make the extra capacity real.

**The ledger accounts per key.** It tracked spend per *provider*, and
`LedgerRecord` did not even record which key paid — key material was kept out,
but that was over-applied: key *names* are not secrets, `configs/base.yaml`
lists them openly and `doctor` prints them. Without the name, three separate
allowances were tracked as one pot and the sweep would still have stopped at 8M.

**The key pool distributes deliberately.** `KeyPool` rotated only on a 429, so
it was sticky: all 14.27M would have piled onto `NVIDIA_KEY_1` and exhausted one
account while the other two sat idle. `next()` round-robins; `current()` stays
sticky, which is still correct for one call and its retries. A key whose own
ceiling is reached is excluded from the pool but still counted as configured, so
`doctor` can report "1 of 3 exhausted" rather than silently shrinking.

With that, the full 1,308-cell grid fits: **14.27M against 24M, 59%**.

---

## D29 — No charting library in the dashboard

**Decision.** `packages/dashboard/` draws its three bar views with inline SVG and
CSS grid. Recharts, visx and the shadcn chart block were all considered and none
was added.

**Why.** Every charting rule `ARCHITECTURE.md` §7 imposes is a fight against a
library's defaults:

| Rule | What a library does |
| --- | --- |
| a zero value draws **no bar** | Recharts draws a 1px stub |
| a **dashed full-scale track** shows the denominator | no built-in equivalent |
| every chart has a **table view** | must be built anyway |
| **no dual axes**, ever | offered, and easy to reach for |

The first of those is not hypothetical. Thesis figure 5.2 shipped once with a
zero rendered as a visible stub, which reads as *a small amount* when the truth
is *none*. Across the six views the actual drawing is two bar rows, one SVG
pipeline, one CSS-grid matrix and three non-charts — less code than configuring
a library to stop doing things, and about 110 KB lighter.

**Not a rejection of shadcn/ui.** Its Radix-based primitives are a genuine
improvement over hand-rolled controls and remain available for the chrome. The
decision is about charts specifically.

**Reversible.** If a later view needs real axes, ticks and a time scale,
Recharts goes in for that view alone.

---

## D30 — Two colour systems, kept apart by rule

**Decision.** The dashboard runs two palettes that never borrow from each other:

- **chrome** — teal and slate. Hero, panel headers, controls, focus. Means
  nothing about the experiment.
- **status** — the nine outcome colours plus the two failure classes. Every one
  carries a finding.

**Why.** `explainer/style.css` already teaches a reader that ochre means
*format-class failure* and slate-blue means *logic-class failure*. An ochre
button would then say "failure" on a control that means nothing of the sort.
The `ui-ux-pro-max` design system proposed `#1E40AF` blue with a `#D97706` amber
accent; amber is close enough to the format-class ochre to be read as a claim,
so it was rejected and the chrome moved to teal.

The single exception is the two headline cards, which are filled with the hue of
the class they report. There the colour and the claim are the same thing.

**Consequence.** Three tokens had to be added that the explainer does not have:

- `--edge`, because `--rule-strong` sits at **1.80:1** — fine for a divider,
  a WCAG 1.4.11 failure for the border of something clickable.
- `--on-status-ink`, because one glyph colour cannot serve every fill: white
  clears 4.5:1 on the dark end of the ramp and reaches only **3.53:1** on the
  lightest ochre step. Each status now names which glyph colour it uses, and
  the gate checks the pair the grid actually draws.
- `--surface-3`, for the inside of a tinted panel header.

---

## D31 — The contrast gate was green while checking dark mode twice

**What happened.** `scripts/check_contrast.ts` was written to read `tokens.css`
and verify every pair in both themes. It reported **82 checks pass** and was
wrong: it had never checked light mode at all.

`parseBlock(css, ":root {")` took the selector with its brace already attached,
then searched for `{` *after* the end of that string — which landed on the
*next* block's brace. The "light" run was reading the `@media
(prefers-color-scheme: dark)` block. Both themes pass, so the duplicate run
stayed green and the bug was invisible.

**Found by** `tests/dashboardPalette.test.ts`, which parsed a small fixture with
known values rather than the real file. The fixture's light `--paper` came back
as the dark one.

**What it was hiding.** Five genuine light-mode failures:

```
--ink-faint on --paper        4.04:1   (need 4.5)
--ink-faint on --surface      4.42:1
--ink-faint on --surface-2    3.78:1
--on-status on --st-format-1  3.53:1
--on-status on --st-limit     3.69:1
```

**Fixed** by locating the brace with a whitespace-only scan and rejecting a
match where anything else intervenes — which also handles `:root` being a prefix
of `:root[data-theme="dark"]`. Tokens adjusted; the gate now runs **127 checks**
and covers the hero at both gradient stops, the filled cards and the tinted
headers.

**The general point.** A validator that cannot fail is worse than no validator,
because it is believed. This is the third instance of the same shape in this
project — `max_tokens: 8_000_000` parsed as a string (D5), `thinking: false`
never transmitted (D19), and now a gate checking one theme twice. Each was a
declared safeguard with nothing behind it.

---

## D32 — The dashboard states its finding in prose, derived from the data

**Decision.** `src/model/narrative.ts` holds the study's question and answer as
sentences built from `chapter5_figures.json`, not typed into the markup.

**Why.** The first build rendered `3/3` and `0/4` under four-word labels and
never said what they meant. A reader who did not already know the study could
not have told you what it concluded — which makes a dashboard that only
confirms what its author already knows.

The strong wording is guarded by the data:

```ts
const all  = fmtOf > 0 && fmt === fmtOf;
const none = log === 0;
answer = all && none
  ? "It fixed every formatting failure, and none of the reasoning failures."
  : `It fixed ${fmt} of ${fmtOf} formatting failures and ${log} of ${logOf} reasoning failures.`;
```

If a later run recovers one logic-class task, the sentence stops saying "none"
without anyone remembering to edit it. A claim and the number beside it cannot
drift apart.

**Same module** carries the glossary. `cell`, `lineage`, `arm`, `round`,
`format-class` and `instrument limit` are this project's working vocabulary, not
English, and every one of them was on screen unexplained. They now appear only
through a `<Term>` component that attaches the definition.

---

## D33 — Two problems only the rendered page could show

Both were found by looking at screenshots of the running dashboard, not by any
test, and neither was a code defect — the arithmetic was right in both cases.

**1. A single bar claiming to be a comparison.** "Apply rate by edit format"
drew one bar and still printed *"drawn to the largest group so the two bars are
comparable"*. The sweep had only ever produced `search_replace` rows. The panel
now detects a single format and says there is nothing to compare yet, naming the
arm that would produce the other series.

**2. The denominator was the finding, and it was a footnote.** The same panel
showed **5/8 applied** in large type and *"23 set aside"* in 11px grey. Those 23
were three-quarters of everything in view — Gemini's free quota ran out
mid-sweep. The honest headline was never 63%; it was *most of this measured
nothing*. When set-aside exceeds measured, it now leads the panel.

Both are the D18 category error reappearing at the presentation layer: an
instrument limit folded into a rate, or made small enough to miss. Excluding
those cells from the arithmetic was necessary and was not sufficient — the
exclusion has to be as visible as the number it changes.
