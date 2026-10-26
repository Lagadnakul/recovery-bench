# BUILD — paper and implementation, by 30 November 2026

**Author:** Lagad Nakul Kiran (2503032340022) · M.Tech AI & DS, PIET, Parul University
**Written:** 24 October 2026
**Deadline that does not move:** MSR 2027 abstract **13 November**, Stage 1 report **20 November**

This document is the executable version of [`WORKFLOW.md`](WORKFLOW.md). WORKFLOW.md
decides *what* and *why*; this decides *what you type, on which day*. Where the two
disagree, WORKFLOW.md wins on strategy and this one wins on sequence.

---

## 0. Read this part first — three corrections

### 0.1 The stack is not MERN

There is no MongoDB, no Express, and no Node backend anywhere in this project. A grep of
every `package.json` for `express|mongoose|mongodb|fastify|Bun.serve|createServer` returns
**zero hits**. What exists is:

| Layer | What it actually is |
|---|---|
| Engine | A **Bun CLI** — `packages/pipeline`, 40 TypeScript files, no server |
| Data | Flat files — `data/swebench_lite.jsonl`, `report.json`, `replay_rows.json` |
| Dashboard | **Vite + React 19 + Tailwind v4**, client-only, `base: "./"` so it opens from `file://` |

Write it in the paper as **"TypeScript on Bun; a client-only React dashboard over a
file-based ledger."** Do not add Express or Mongo to make the word MERN true. The dashboard
has to open from a folder on an examiner's machine with no server running
(`packages/dashboard/vite.config.ts` says so deliberately) — a backend would break the one
property that matters and add nothing a reviewer values.

### 0.2 One vocabulary, chosen now

`proposal/index.html` says **CARELESS / CONFUSED / BROKEN / LOST**. `WORKFLOW.md`,
`reports/data/master_table.md` and all of `recovery-bench` say **FORMAT / LOGIC / BROKEN /
LOST**. Same four classes, two names.

**Decision: FORMAT / LOGIC / BROKEN / LOST in all code, tables and paper text.** It already
matches the evidence files, so nothing has to be regenerated. Keep careless/confused as the
spoken analogy for the professor and the viva — it is a good analogy, it is just not a
variable name.

### 0.3 Three conflicts between the proposal and the built code

`proposal/index.html` was written 19 October against different constraints than
`recovery-bench` was built under. Before any of it reaches the paper:

| Topic | `proposal/index.html` | Built reality | Use |
|---|---|---|---|
| Engine | Python + mini-SWE-agent (`:822`, `:825`) | **TypeScript on Bun** (D10, a documented reversal) | **TypeScript** until Docker is actually needed |
| Docker | Required, phase 00 (`:868`) | **"No Docker. Anywhere."** (D6) | **No Docker before 20 November** |
| Dashboard | Next 16 + shadcn + framer-motion + **recharts** (`:840`) | Vite + React, **no charting library** (D11, D29) | **Vite + React, own SVG marks** |

The proposal is a forward-looking document for the *post-acceptance* build (Feb–Sep 2027),
where Docker does become necessary. That is a different phase and a different stack
decision. Do not let the November paper inherit it.

### 0.4 The language decision — TypeScript for both

**Engine: TypeScript on Bun. Dashboard: TypeScript + React 19 + Vite + Tailwind v4. One
language for the whole project.** Four reasons, in order of weight:

1. **It is already built.** `packages/pipeline` is 40 TypeScript files with 420 tests under a
   maximally strict `tsconfig` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
   `verbatimModuleSyntax`), and `bun.lock` is committed. With a 20 November deadline, a
   rewrite is pure loss.
2. **D10 already decided it, as a reversal.** Python was chosen originally *because of Docker*;
   D6 removed Docker and the choice was re-derived. That reasoning still holds.
3. **Every model you have is an OpenAI-compatible HTTP endpoint** — see §1.1. There is already
   a `providers/openaiCompat.ts`. Six new models is six config entries plus one thinking
   adapter per provider. The models exert **zero** pressure toward Python.
4. **The dashboard must open from `file://`** on an examiner's machine (`base: "./"` in
   `vite.config.ts`). That rules out Next.js — which the proposal suggested at `:840` — because
   Next needs a server. Vite's static build is the requirement, not a preference.

**The one place Python stays, and it is not negotiable either:** the SWE-bench evaluation
harness. `swebench.harness.run_evaluation` is Python + Docker and it *is* the field's ground
truth for resolved/unresolved. Do not reimplement it in TypeScript — your pass/fail numbers
would stop being comparable to every prior paper, and that is a rejection, not a style note.
When Docker enters in February 2027, the TypeScript engine shells out to the official Python
harness and reads its JSON.

That is a **subprocess boundary, not a second codebase**: TypeScript for everything you write,
Python only as a thin shell around the one tool you must not rewrite.

---

## 1. What "paper and implementation by end of November" actually means

A Registered Report Stage 1 is **judged on the plan, before any data exists**
(`WORKFLOW.md:38`). That is the whole reason this venue was chosen: the pilot's 0-of-4 logic
result would be rejected as underpowered in a normal submission, and here it becomes the
thing you are licensed to go and confirm properly.

So the November deliverable splits cleanly in two, and neither half needs Docker, a Gemini
key, or a single new API call:

**Half one — the paper.** Six pages plus one of references. IMRaD down to Method only.
Results and Discussion are deliberately absent; they are Stage 2, due 30 September 2027.

**Half two — the implementation.** Three programs over existing committed data, plus the
dashboard:

| # | Program | Input | Why the paper needs it |
|---|---|---|---|
| 1 | **Power analysis** | `master_table.md` effect sizes | Determines N. N determines budget. Budget determines feasibility. Reviewers check this first. |
| 2 | **Triage feasibility** | the 42 evaluation records | Proves FORMAT/LOGIC separates **deterministically, with no model call**. The paper's positive control. |
| 3 | **CC-OS simulator** | `replay_rows.json` | Shows the stopping rule computes and yields real θ_c values. Not a result — a demonstration that the method is implementable. |
| 4 | **Dashboard** | all of the above | The artifact for the professor, and the Data Availability statement for the reviewers. |

**The rule for the dashboard, and it is not negotiable:** it may display the *design* and the
*pilot evidence*. It may **never** display a simulated outcome styled as a measurement. The
proposal already gets this right — its Pareto figure is captioned *"Expected shape, drawn to
illustrate the claim — not measured data."* Carry that caption discipline into every view. A
professor who catches one fabricated number stops trusting all of them, and `ccos-study` has
a hard-coded refusal to write synthetic data into its paper directory for exactly this reason.

### 1.1 The API keys and the six models

Set the keys up the way [`SETUP.md`](SETUP.md) already documents — **`.env.local` in the
project root, gitignored, never pasted into a chat or any other file**:

```sh
cp recovery-bench/.env.example .env.local   # then fill in values
cd recovery-bench && bun run doctor
```

`.env.example` names the variables: `NVIDIA_KEY_1`…`_3` (a list enables the key pool),
`qwen_api_key`, `gemini_api_key`.

**None of this changes November.** The critical path above is deliberately offline —
`doctor`, `test`, `replay` and `report` all run with no key, and `WORKFLOW.md:401` is explicit:
*"No new API calls. No Docker. No sweep."* The models matter from **February 2027**, Stage 2.

#### What the six candidate models actually are

Checked against the vendor pages on 24 October 2026. All six are **OpenAI-compatible HTTP
endpoints**, which is why they cost no language change (§0.4):

| Model | Host / base URL | Model ID | Thinking control | In / Out per 1M |
|---|---|---|---|---|
| MiniMax M3.1 Flash | `integrate.api.nvidia.com/v1` | `minimaxai/minimax-m3.1-flash` | `reasoning_effort` — **5 levels** (low…max) | trial credits |
| Nemotron 3.5 Super VL 120B A12B | `integrate.api.nvidia.com/v1` | `nvidia/nemotron-3.5-super-vl-120b-a12b` | `chat_template_kwargs.enable_thinking` (bool) | trial credits |
| DeepSeek V4.1 Flash | `ap-southeast-1.maas.qwencloudapi.com/compatible-mode/v1` | `deepseek-v4.1-flash` | not documented | **$0.15 / $0.60** |
| Qwen3.8-2.4T-A95B | same | `qwen3.8-2.4t-a95b` | `extra_body.enable_thinking` (bool) | $2 / $6 |
| Qwen3.8-Max | same | `qwen3.8-max` | `extra_body.enable_thinking` (bool) | $2 / $6 |
| Kimi K3 | same | `kimi-k3` | no toggle documented; `reasoning_content` in response | **$3 / $15** |

#### Four corrections to "these are all free tier"

1. **Only the two NVIDIA models are plausibly free.** They run under the *NVIDIA API Trial
   Terms* — trial credits, not an unlimited free tier. **All four Qwen Cloud models are priced
   per token and document no free tier at all.** Verify your actual credit balance and regional
   allowance in each console before planning N. This is the same trap as **D3**, where *quota,
   not scientific judgement, shaped the experiment* — except now overrunning costs money rather
   than days.
2. **Cost swings by 20× on model choice.** D25 measured the committed grid at **14.56M tokens**.
   At an 80/20 input/output split that is roughly **$3.50 on DeepSeek V4.1 Flash**, **~$40 on
   Qwen3.8-Max**, and **~$78 on Kimi K3**. DeepSeek Flash is 13× cheaper on input and 25×
   cheaper on output than Kimi K3. If a paid workhorse arm is needed, it is DeepSeek Flash.
   Kimi K3 is the worst possible sweep model — recovery work is output-heavy, and output is
   where it costs $15.
3. **Do not use Nemotron 3.5 Super VL for this.** The "VL" is vision-language — it takes text,
   images and video. Code repair from issue text and source needs no vision; a multimodal model
   adds cost and a confound for capability you will never exercise. Use a text model.
4. **D19 is worse than recorded, not better.** The decision log found that `thinking: false` was
   never sent on the wire and that `muse_30b` ignored it. The table above shows the real reason:
   **there is no single flag.** Three incompatible control surfaces appear across four
   providers — a graded `reasoning_effort` with five levels, `chat_template_kwargs.enable_thinking`,
   `extra_body.enable_thinking` — and Kimi K3 documents no toggle whatsoever, only
   `reasoning_content` coming back in the response. A config field shaped `thinking: boolean`
   **cannot express this**, so arm `a4_reasoning`, which manipulates exactly that variable,
   is not currently expressible for these models.

#### Consequences for the design

**The good news, and it is genuinely good.** `proposal/index.html` §08 lists *"second model as
a robustness check"* as still open. Six models across four families (MiniMax, Nemotron,
Qwen/DeepSeek, Moonshot) turns that open question into a cheap, strong robustness arm — *does
the class-conditioned finding hold across model families?* For a Registered Report that is a
real strengthening of the protocol, and it costs you only config.

**The constraint that must not be broken.** `a1_replication` **stays on `gemini-3.6-flash`.**
H1 is a *replication* of the pilot null, and a replication arm that changes the model is not a
replication. The six new models are **generalization** arms — `a2`–`a6` — and the config
already has that shape. Say so explicitly in the Method section, or a reviewer will read the
model swap as a confound.

**Three things to build before the first live call**, all of them Phase 2 work at the latest:

- A **per-provider thinking adapter** that normalises the three control surfaces behind one
  config field, and *verifies from the response* that the setting was honoured. D19's lesson is
  that an unverified flag silently produces an arm that is not the arm you configured.
- The **budget guard** D25 found missing. 14.56M against an 8M ceiling with nothing checking is
  now a bill, not just an overrun.
- A **recorded rate-limit and credit-balance check** per provider, written into the manifest the
  way `ccos-study` does it, so the paper can state what the quota actually was.

---

## 2. Phase 0 — unblock the machine · 24–27 October

Nothing below works until these are done. None take long.

### 2.1 The three decisions — taken 24 October 2026

`WORKFLOW.md:117-126` wanted a supervisor email before anything else. That email is **not
being sent**; the three questions it carried are decided here instead, by the author.

- **Venue: MSR 2027 only.** Registered Report Stage 1 on 20 November, Stage 2 to *Empirical
  Software Engineering* on 30 September 2027. `ccos-study` is **not** a separate submission —
  it becomes the Stage-2 execution engine after in-principle acceptance (§7). This closes the
  one strategic conflict in the project.
- **Authorship: sole author.** Lagad Nakul Kiran, PIET, Parul University. Corresponding author
  and ORCID are his. No co-author on the MSR submission.
- **Prompts:** `ccos/prompts.py` wording is superseded by `recovery-bench`'s committed
  templates, which carry source provenance and are hash-checked against the originals.

**One assumption is now unverified, and it is worth naming once.** `WORKFLOW.md:126` warned
*"Get it in writing before spending three weeks"* about whether MSR 2027 + EMSE satisfies the
degree's publication requirement. Without that confirmation the paper is still worth writing —
it is a Scopus-indexed IEEE/ACM venue with a Q1 journal stage — but if the department later
requires something different, three weeks of writing may target the wrong venue. The fallback
ladder in `WORKFLOW.md:108-112` (MSR Industry Track 18 Dec → Mining Challenge 23 Dec → EASE
2027 → JKSU-CIS, no deadline) exists precisely for that case, and the Stage-1 protocol text
transfers to any of them. Proceeding on that basis.

Two consequences of sole authorship that are infrastructure, not paperwork:

- **The repository is on another account.** `origin` is `AAYUSH412/Nakul-Research-paper`
  (private, author has WRITE, not ADMIN). Zenodo archiving is authorized by the repo *owner*,
  and e-Informatica requires a DOI while MSR expects a reachable artifact. Before the Data
  Availability statement is written, this repo needs to live under `Lagadnakul` — a transfer
  keeps all history and leaves a redirect. Settle it before the repo goes public, because
  transferring after the URL is cited breaks the citation.
- **`SETUP.md`'s collaboration section** (Overleaf, Live Share, "working together without
  pushing constantly") and its `git clone git@github.com:AAYUSH412/…` line both describe a
  two-person setup that no longer applies. Harmless, but update them when the repo moves.

### 2.2 Install Bun

`bun` is **not on this machine's PATH**. Your own test suite cannot run.

```sh
powershell -c "irm bun.sh/install.ps1 | iex"
```

Then, in a new terminal:

```sh
cd "D:\VS CODE\Nakul-Research-paper\recovery-bench"
bun install
bun run doctor          # every gate, offline, no API key
bun test
```

`bun.lock` is committed, so the install is reproducible. `node_modules/` is absent from this
checkout — expected, and `bun install` fixes it.

### 2.3 Install the paper skills

`academic-research-skills/` is cloned and correctly gitignored, but `.claude/skills/` does not
exist, so **Claude Code cannot see any of it yet.** On Windows, junctions avoid the symlink
problem. Run in PowerShell from the project root:

```powershell
New-Item -ItemType Directory -Force .claude\skills
$ars = "D:\VS CODE\Nakul-Research-paper\academic-research-skills"
foreach ($s in 'academic-paper','academic-paper-reviewer','deep-research','sr-screener') {
  New-Item -ItemType Junction -Path ".claude\skills\$s" -Target "$ars\$s" -Force
}
Get-ChildItem .agents\skills -Directory | ForEach-Object {
  New-Item -ItemType Junction -Path ".claude\skills\$($_.Name)" -Target $_.FullName -Force
}
```

Note the deliberate omission: **`academic-pipeline` is not installed.** See §6.

### 2.4 Fix the stale pointers before they reach a reviewer

Five minutes total, and each one is a factual error in a repository you are about to cite as
an artifact:

| Where | Says | Truth |
|---|---|---|
| `README.md:39` | decision log D0–D33 is in `PLAN.md` | it is in `recovery-bench/docs/DECISIONS.md`; `PLAN.md` has its own D1–D9 |
| `PLAN.md:471` | "(D0–D28)" | the file now runs to **D33** |
| `PLAN.md` §10 | documents at repo root, `Dissertation-main/` exists | they are in `Documents/`; `Dissertation-main/` is absent from this checkout |
| `PLAN.md` §11 | finding numbers | **skips 14** — 16 findings under 17 numbers |
| `reports/week05.json` | "1,296 conditions, 7.56M tokens vs 8M" | D25/D26: **1,308 cells, 14.56M against 8M** — the week-05 figure predates both |

**The "433 tests" figure is correct — do not "fix" it.** A static grep finds only 420 `test()`
calls across the 23 files, which looks like an error but is not.
`tests/editsSymmetry.test.ts` generates tests inside two loops — 10 `WRAPPERS` and 5 `cases` —
so the runtime count is 420 − 2 + 15 = **433**, matching the recorded output in
`explainer/run-it.html:96`. The separate **127 palette checks** come from
`bun run contrast`, not from `bun test`; `recovery-bench/docs/DASHBOARD.md:9` is right that 59
dashboard tests sit *inside* the 433.

Also: `docs/LIMITATIONS.md` is referenced from several documents and **has never been written**
(`PLAN.md:642`). A Registered Report has a mandatory Threats to Validity section — write that
section first and let `LIMITATIONS.md` be its by-product.

One more, outside this repo: `ccos-study` has **no git remote**. Six commits exist in one
folder on one laptop, and its `.gitignore` deliberately *tracks* `data/`, `runs/` and
`results/` because they are the evidence for claims C1–C10. Give it a remote this week
regardless of what §7 decides.

### 2.5 The CRLF defect — found and fixed 24 October

The first run of `bun test` on this machine gave **18 failures** and `bun run doctor` failed
its load-bearing gate:

```
FAIL  jsdiff → git apply
      the patch applied but the result does not equal the intended file.
```

That is the gate whose own test file says: *"If this file goes red, no result the pipeline has
ever produced can be trusted: an APPLY_FAIL would no longer mean 'the model produced an
uninstallable patch', it would mean 'we produced one'."*

**One root cause, three symptoms.** Git for Windows defaults to `core.autocrlf=true`, and this
repository had no `.gitattributes`. `git ls-files --eol` showed `i/lf w/crlf attr/` — index LF,
working tree CRLF, no attributes governing it. That broke:

| Symptom | Mechanism |
|---|---|
| 11 failures in `toPatch.test.ts` | `withScratchRepo` runs `git init` in a temp dir, which inherits the machine's global config. An LF patch applied and then read back as CRLF, so `applied.content === after` was false. |
| 2 failures in `matrix.test.ts` | `data/file_cache` verifies each blob's content hash on every read against a recorded `sha256` (`tasks/files.ts:108` — *"a cache that can silently rot is worse than no cache"*). CRLF changed the bytes, so every read threw `cache corrupt`. File sizes vanished from the token projection and arm `a5` came out at 1.5M tokens instead of >8M. |
| 5 failures in `sweepRun.test.ts` | the same failed cache reads — the sweep ran 0 of 28 planned cells and made 0 calls. |

(The blob *filename* is `sha256(cache key)`, not the content hash, so comparing a blob's
filename to `sha256sum` of its contents proves nothing either way — the content hash lives in
the cache index.)

**Two fixes, both committed:**

1. **`packages/pipeline/verify/apply.ts`** — `withScratchRepo` now sets `core.autocrlf=false`
   and `core.eol=lf` on the scratch repo alongside `user.name`/`user.email`. This is the real
   bug: the verification layer was not hermetic against ambient git config, so on any
   default-configured Windows machine it measured git's line-ending conversion rather than the
   model's patch.
2. **`.gitattributes`** at the repository root — `* text=auto eol=lf`, with `-text` on the
   content-addressed `data/file_cache/blobs/**` and on `swebench_lite.jsonl`, and explicit
   `binary` for the Office and image formats. This also protects any fresh checkout.

After both: **395 pass, 38 skip, 0 fail** across 433 tests, and `doctor` reports *"all gates
pass, 1 warning(s) — safe to sweep"*, exit 0. The one warning is the unset API keys, which is
correct until `.env.local` exists.

Worth noting for Threats to Validity: this is the **same hazard** that `ccos-study` documents
as having corrupted its Phase-1 results, and the reason that project refuses to run on native
Windows at all. Here it is fixed rather than refused — but it means any result produced on a
Windows machine *before* this fix should be treated as suspect.

If the working tree is ever checked out again with the old setting, re-normalise with:

```sh
git config core.autocrlf false
rm -rf recovery-bench/data/file_cache && git checkout -- recovery-bench/data/file_cache
```

### 2.6 The archive — restored 24 October, and a provenance commit that nearly vanished

`bun test` skipped 38 tests, all gated on `existsSync("archive/legacy_runs")`
(`analysis/load.ts:40`). That payload is 495 files, gitignored, and was absent. Among the
skips was `master_table.md regenerates BYTE-IDENTICALLY` — exactly the claim `README.md:77`
advertises as *"the key check — the re-implementation reproduces the submitted results
exactly, from a completely independent code path."* It was not failing; it was not running.

**It is restored, and the claim now holds.** All 495 files in place, and the headline check
is empty:

```sh
diff <(bun run report --stdout) ../reports/data/master_table.md   # empty
```

**433 pass, 0 fail, 0 skip** — the whole suite live for the first time on this machine.

#### Three things the restore uncovered

**1. The documented rebuild recipe did not work, and the provenance commit is unreachable.**
`archive/MANIFEST.md` said `gh repo clone Lagadnakul/Dissertation --depth 1`. That repo has
since been **replaced**: commit `236484c` ("Replace the repository with the dissertation, its
evidence and the implementation") wiped `06_Methodology/` from `main`, which is now two
commits deep and holds a copy of *this* project. The old recipe would have silently restored
the wrong tree. The canonical commit `c8872d07` survives only as a **dangling commit** — the
API resolves it and `git fetch origin <sha>` retrieves it, but no branch or tag points at it.

> **This is a live risk and it is worth one command to close.** Unreachable git objects are
> eligible for garbage collection. Until a ref points at `c8872d07`, the provenance baseline
> for every number in Chapters 4 and 5 can disappear without warning — and `main` no longer
> has a copy. Nakul has ADMIN on the repo:
>
> ```sh
> gh api repos/Lagadnakul/Dissertation/git/refs -f ref=refs/tags/provenance-phase1 >        -f sha=c8872d070fb0b098394796dfbc68bcf67c3bd957
> ```
>
> Purely additive — it creates a tag and changes nothing else. Do it before anything else in
> this document.

**2. 73 of 495 checksums cannot match, and that is correct.** The `test_output.txt` files were
archived with `gzip -9`, and gzip's compressed bytes depend on the zlib build — neither
`gzip -9` nor `gzip -9 -n` reproduces the recorded hashes. The 422 original-byte files verify
**exactly**. For the 73, what was verified instead is that they **decompress to bytes identical
to the provenance commit** — all 73 match. Nothing in `packages/` reads the `.gz` files anyway;
the archive layer reads `run_instance.log` and `report.json`. Recorded in the manifest so a
future `sha256sum -c` showing 73 failures is not mistaken for corruption.

**3. CRLF again, twice.** `SHA256SUMS` itself had CRLF, so every filename gained a `
` and all
495 checks failed with "No such file or directory" — a verification failure that looked like
total corruption and was nothing of the kind. And `master_table.md` (146 lines) still had CRLF
after §2.5, so the byte-identical test failed on all 146 lines at once. Both fixed by
renormalising the whole working tree, which §2.5 should have done rather than only the file
cache:

```sh
git rm --cached -r . && git reset --hard     # with .gitattributes in place; ignored files untouched
```

`git ls-files --eol` now reports `w/lf` throughout.

#### Also restored: the original tree

`tests/promptOracle.test.ts:159` needs `../Dissertation-main/06_Methodology/code` — it hashes
four `day*.py` files to prove the committed prompt templates still match the Python they were
extracted from. Restored there (93 MB) and added to `.gitignore`, for the same reason as the
payload: a pinned upstream sha beats a duplicate in the repository.

**Milestone M0 → write to memory.**

---

## 3. Phase 1 — the power analysis · 27–31 October

`WORKFLOW.md` calls this **"the critical item"** and it deserves the label. Everything
downstream — N, token budget, days of quota, whether the study is feasible at all — falls out
of this one number. Reviewers of Registered Reports attack it first, because under-powering is
the exact failure the format exists to prevent.

### What you have to work with

From `reports/data/master_table.md` (regenerated from 42 evaluation records across 9 runs):

- Baseline resolved **12/20 = 60%** on first attempt → **failure pool = 8**
- Logic-class recovered **0/4**; format-class recovered **3/3**
- All three strategies land on **exactly 6/16** sub-tests on `django-11019`

From `ccos-study/docs/analysis_plan.md` §7, which has already done this arithmetic honestly
and is worth reading before you redo it:

> With ~40% baseline failures, N = 150 gives a pool of ~60, adequate only for large effects.

Its simulated McNemar power at pool n = 60 is **0.27 / 0.50 / 0.57** across three effect
sizes, and it recommends **N ≥ 220**.

### Build it

```
recovery-bench/packages/pipeline/analysis/power.ts
recovery-bench/tests/power.test.ts
```

A simulated exact-McNemar power curve over N, taking discordance probabilities from the pilot.
TypeScript, no new dependency — `zod` for the config shape, your own binomial. Output a JSON
the dashboard reads and a markdown table the paper cites.

Then write, in the paper, the sentence the reviewer is looking for: *the smallest effect this
design can detect at 80% power, and the N it requires.* If that N is beyond the quota, say so
in Threats to Validity rather than quietly choosing a smaller one. An honest power limitation
is survivable in a Registered Report; a hidden one is not.

### Lock the four hypotheses in writing

Verbatim from `WORKFLOW.md:146-153`:

- **H1** — Diagnose+Revise does not improve recovery over Blind Retry on logic-class failures
- **H2** — Recovery success depends on the **failure class**, not the strategy
- **H3** — Strategies with identical outcomes differ significantly in **cost**
- **H4** — A class-conditioned stopping rule achieves equal recovery at lower cost
  — **H4 is the new contribution**

**Milestone M1 → write to memory.**

---

## 4. Phase 2 — the two programs that make the design credible · 31 Oct–6 November

### 4.1 Triage feasibility

```
recovery-bench/packages/pipeline/analysis/triage.ts
recovery-bench/tests/triage.test.ts
```

The classifier is deterministic and O(1) — the class is **observed, not predicted**, which is
what makes it cheap and reliable. Translated from `proposal/index.html` into the chosen
vocabulary:

```ts
export function triage(a: Attempt): FailureClass {
  if (a.applyFailed) return "FORMAT";
  if (a.infraError)  return "BROKEN";
  if (a.noProgress({ window: 3 })) return "LOST";
  return "LOGIC";   // applied cleanly, test still red
}
```

Run it over all 42 records and produce one table: every record, its class, and the evidence
field that decided it. **Two things this must show**, both already true in your data and both
load-bearing for the paper:

- **The classes separate with zero model calls.** That is the feasibility claim.
- **The holes are visible.** D2: 8 of 24 condition-task cells produced no evaluable patch, and
  dropped cells are *the most frequent single outcome in the study and are currently
  invisible*. D15 found the mechanism — the harness raises before writing `report.json` when
  `git apply` refuses, so `build_master_table.py`'s glob never sees them. **22 evaluations were
  invisible to the original tables.** Print them as holes, never as blanks.

### 4.2 CC-OS simulator

```
recovery-bench/packages/pipeline/analysis/ccos.ts
recovery-bench/tests/ccos.test.ts
```

The rule, from `proposal/index.html:601`:

```
E[retry]    = p(c,k) · G − r
E[escalate] = q_c    · G − h
RETRY  ⟺  p(c,k) > θ_c        where  θ_c = q_c − (h − r)/G
```

with the Beta–Bernoulli belief `p(c,k) = α_c/(α_c+β_c) · λᵏ`, and the finite-horizon form
`V_k = max(p_k·G − r + (1−p_k)·V_{k+1}, q·G − h)` solved once in O(K).

Two properties to prove by test, because both are claims the paper makes:

- **The four arms are one algorithm at different θ.** Stubborn = −∞, Needy = +∞, Random
  ignores class, CC-OS = θ_c. Implement one parameterised policy and derive all four, so the
  claim is structural rather than asserted.
- **λ is measured, not tuned.** It is fitted from observed success rate against attempt index
  — *"a measured property of the run, not a tuned knob, and reporting it is a result in its own
  right."* Write the fit; report the number.

Feed it `replay_rows.json`. The output is θ_c per class and the decision trace — **a
demonstration that the method is implementable, labelled as such.** Not a finding.

**Milestone M2 → write to memory.**

---

## 5. Phase 3 — the dashboard · build 1–13 Nov alongside the paper, polish 21–30 Nov

This is the part you want the professor to see, so it gets a real design brief rather than
"make a dashboard."

### Where it goes

**Extend `recovery-bench/packages/dashboard`.** Do not start a new app. It already has React
19, Tailwind v4 via the CSS-first `@import "tailwindcss"`, self-hosted Geist Mono and Plus
Jakarta Sans, 11 view components, a `src/model/` layer (`load`, `rows`, `filter`, `status`,
`narrative`), a 127-check contrast script, and `base: "./"` so the build is a folder that
opens from `file://`. Reusing it costs nothing and keeps D11 and D29 intact.

```sh
cd recovery-bench/packages/dashboard
bun run dev        # syncs data, then vite
bun run contrast   # 127 palette checks — keep it green
```

### Six views

| View | Shows | Why it lands |
|---|---|---|
| **1 · The decision** | Sliders for G, r, h and per-class q_c; θ_c and the RETRY/ASK boundary recompute live | The thesis made tangible. A professor can *move* the inequality and watch the policy change. Nothing else you build communicates the contribution this fast. |
| **2 · Triage** | All 42 records classified, zero model calls, holes drawn as holes | The feasibility claim, and D2/D15 honesty in one picture |
| **3 · Pilot evidence** | 12 PASS / 4 FAIL / 4 ERROR; the recovery matrix with its 8 unrun cells | The real result you already own: 0/4 logic, 3/3 format |
| **4 · Power** | Power vs N, chosen N marked, the pilot's 0.27–0.57 shown | Pre-empts the reviewer's first attack, in a figure |
| **5 · Cost** | 3× input tokens for identical outcomes; the 31,098-token file; 0.2% evidence retention | H3, and the strongest sentence in the paper: *0% recovery at 3× token cost* |
| **6 · Four arms** | A/B/C/D as one policy; Pareto axes drawn, **explicitly unmeasured** | The design, honestly labelled |

### Design rules

- **No charting library.** D29. The existing views draw their own SVG marks — match them.
  Hand-drawn marks in a consistent system look better than default Recharts anyway.
- **Every synthetic mark carries its caption.** Borrow the proposal's wording: *"Expected
  shape, drawn to illustrate the claim — not measured data."*
- **Keep `bun run contrast` green.** 127 checks, light and dark. It is already a quality gate
  you built; do not let the new views be the ones that break it.
- `.agents/skills/` has **`frontend-design`** and **`ui-ux-pro-max`** committed. Use them here
  — this is exactly what they are for, and they are the versions both machines share.

**Milestone M3 → write to memory.**

---

## 6. Phase 4 — writing the paper · 1–20 November

### Which skill, when

| When | Skill / command | Mode | For |
|---|---|---|---|
| 1 Nov | `academic-paper` | **`plan`** | Socratic chapter plan. Very High oversight — it asks, you decide. Do this before writing a word. |
| 2 Nov | `academic-paper` | **`outline-only`** | Detailed outline + evidence map over 6 pages |
| 3 Nov | `deep-research` | **`three-way-scan`** | Related Work from the review's 35 studies — WHY/HOW/WHAT shortlist + cross-paper synthesis |
| 4–10 Nov | `academic-paper` | **`full`** | The draft, section by section |
| 11 Nov | `/ars-abstract` | — | The 200-word structured abstract |
| **13 Nov** | — | — | **SUBMIT ABSTRACT** |
| 14–16 Nov | `academic-paper-reviewer` | **`full`** | 5 review reports + Editorial Decision + Revision Roadmap — the simulated panel `WORKFLOW.md` wants, Devil's Advocate included |
| 17 Nov | `/ars-citation-check` | — | Every reference verified |
| 17 Nov | `/ars-disclosure` | — | AI-use declaration — MSR requires one |
| 18 Nov | `academic-paper` | **`revision`** | Fix what the panel found |
| **20 Nov** | — | — | **SUBMIT** — aim for the 18th; `WORKFLOW.md:482` says submit two days early |

### Do not run `academic-pipeline`

`WORKFLOW.md:440` already says this and it is correct. It is a 10-stage orchestration with
Very High oversight at every stage, US$3–7 per run, built to carry a paper from vague idea to
finished manuscript. You are not starting from a vague idea — you have a submitted
dissertation, 42 evaluation records, a locked venue and four fixed hypotheses. The pipeline
would re-derive all of it, and its IMRaD structure fights the Stage-1 shape, which stops at
Method on purpose. Use the individual skills.

### Two outcome-neutral tests are mandatory

`WORKFLOW.md:491-494`. A Registered Report must say in advance how it would know its own
manipulation worked, or reviewers assume it cannot fail:

1. **Manipulation check** — Diagnose+Revise actually received evidence. Note D22: it is
   *unrunnable* whenever the prior attempt applied cleanly, because there is no apply error to
   show. Cells must be **refused and recorded**, never silently downgraded.
2. **Positive control** — SEARCH/REPLACE eliminates format failures. You already have this:
   format-class recovered 3/3, and the 0→6 sub-test jump on `django-11019` came from the
   retrofit, not from the strategy.

### Things that are findings, not footnotes

From the decision log, each worth a sentence or a row:

- **D1** — all three strategies hit exactly 6/16 on `django-11019`. *Changing how the edit was
  expressed moved the result; changing what the model was told about its failure did not.*
  H2's evidence and the thesis in one line.
- **D4 / `django-11283`** — Diagnose+Revise broke **8 previously-passing tests** where Blind
  Retry broke none. A counter-signal. `master_table.md` is explicit: *Chapter 5 should report
  this rather than average it away.*
- **D8** — Diagnose+Revise costs ≈**3× the input tokens** for identical outcomes. *0% recovery
  at 3× token cost* is far stronger than a bare null.
- **D19** — `thinking: false` **was never sent on the wire**, in this project or the original
  study. Every call ran with vendor-default thinking on, and `muse_30b` does not honour the
  flag at all. Any arm configured that way is not a no-thinking arm. Disclose it.
- **D5 / D6** — the pilot sample is the first 20 alphabetically, 12 of 20 Django, 2 of 12
  repos; and human screening filtered **68.3%** of SWE-bench as underspecified or unfairly
  tested. Both belong in Threats to Validity.
- **RECITATION** — `astropy-14182` was blocked by a safety filter mid-generation. `PLAN.md`
  calls this a genuine strength; it is a real contamination signal and reviewers find it
  interesting.
- **D21** — all 300 SWE-bench Lite gold patches touch exactly one file, so oracle localisation
  costs nothing. Pre-empts an obvious objection.

### Admin that sinks papers

From `WORKFLOW.md` §9: authorship order **in writing**; exact PIET/Parul affiliation wording;
corresponding author; ORCID for every author; COI; AI-use disclosure; data-availability
statement; funding. Hard **6 + 1 page** limit. IEEE conference template. **Single-blind — do
not anonymise.** Run a similarity check against your own review paper and dissertation —
*self-plagiarism is still plagiarism* (`WORKFLOW.md:480`), and you are reusing a pilot you have
already published on.

**Milestone M4 (abstract) and M5 (submitted) → write to memory.**

---

## 7. `ccos-study` — resolved: parked until Stage 2

`C:\Users\CHAITANYA\Downloads\ccos-study` is a second, complete, **Python** implementation of
the same contribution — CC-OS — written 23 October, targeting **e-Informatica Software
Engineering Journal**, with a different author list (Lagad, **Shethwala**, **Arif**, plus a
co-author placeholder). Its `CHECKLIST.md:31` wants runs started **27 October** for a
mid-December submission, *"with no slack for problems."*

**Decision (§2.1): it is not submitted separately.** The same contribution cannot be published
twice, and MSR 2027 is the chosen venue. `ccos-study` becomes the Stage-2 execution engine
after in-principle acceptance on 4 February 2027. Two housekeeping items follow from that:
delete the co-author placeholder from `paper/main.tex`, and give the repo a git remote — it is
six commits in one folder on one laptop, and its `.gitignore` deliberately *tracks* `data/`,
`runs/` and `results/` because they are the evidence for claims C1–C10.

The rest of this section records why the December plan was never executable, which is also the
Threats-to-Validity material for Stage 2 planning.

**That plan cannot execute on this machine as it stands:**

| Gate | Needs | Reality |
|---|---|---|
| Free disk | **120 GB**, hard-enforced at `ccos/cli.py:67` | **C: has 20 GB.** Docker's VHDX is already 19.3 GB and sits on C: |
| OS | WSL2 Ubuntu, Linux filesystem | `cli.py:85-87` **refuses Windows outright**, no override flag — CRLF corrupted Phase-1 results |
| Docker | daemon reachable | not running; both WSL distros stopped |
| Supervisor approval | `data/approval.json` | **absent** — `select`/`run`/`smoke-llm` exit 4 |
| Gemini key | env var | you have one — but it is not the binding constraint |
| Python deps | scipy, matplotlib, pytest | **missing** |
| Quota | 20 req/day free tier | its own estimate: **~35 days** of runs |

**The 120 GB problem is solvable, and `proposal/index.html` §7 already solved it** — which is
why parking this until February costs nothing. The Epoch AI prebuilt registry is ~30 GB rather
than ~120, pruning between instances keeps steady state under 15 GB, and Modal or sb-cli cloud
evaluation makes it 0 GB. Three months is ample. Deciding it now, under a three-day deadline,
on a drive with 20 GB free, was the only version of this that could fail.

Separately: the IST review paper `INFSOF-D-26-01742` is submitted and awaiting decision, and
`ccos-study/docs/review_paper_fixes.md` catalogues roughly nine in-text citation-numbering
errors in its Sections I–III. Its recommended fix is right — convert every citation to BibTeX
`\cite{}` keys so numbers can never drift again. Independent of November; it can wait for the
reviews.

---

## 8. Calendar

| Dates | Phase | Deliverable |
|---|---|---|
| 24 Oct | 0 · unblock | **CLOSED.** Venue, authorship and `ccos-study` decided (§2.1) · Bun installed · CRLF defect fixed (§2.5) · archive restored, **433 pass / 0 fail / 0 skip**, `doctor` exit 0, byte-identical reproduction verified (§2.6) |
| 27–31 Oct | 1 · power | `power.ts` + tests · N chosen and justified · four hypotheses locked in writing |
| 31 Oct–6 Nov | 2 · feasibility | `triage.ts` + `ccos.ts` + tests · triage table over 42 records · θ_c values · provider thinking adapter + budget guard (§1.1) |
| 1–13 Nov | 3 · dashboard v1 | Views 1–4 on `packages/dashboard` · contrast green |
| 1–11 Nov | 4 · writing | `plan` → `outline-only` → `three-way-scan` → `full` → `/ars-abstract` |
| **13 Nov** | — | **ABSTRACT SUBMITTED** |
| 14–18 Nov | 4 · review | `academic-paper-reviewer full` · `/ars-citation-check` · `/ars-disclosure` · `revision` |
| **18–20 Nov** | — | **STAGE 1 SUBMITTED** — aim for the 18th |
| 21–30 Nov | 3 · dashboard v2 | Views 5–6 · polish · `LIMITATIONS.md` · Zenodo archive · viva deck |
| 23 Dec | — | Reviews arrive. Stop until then. |

Fallbacks if MSR slips, in order: MSR Industry Track (18 Dec) → MSR Mining Challenge (23 Dec)
→ EASE 2027 (abstract 15 Jan) → JKSU-CIS (no deadline, 5–8 weeks to first decision). A
December rejection still returns expert feedback on the design, which is worth having.

---

## 9. Milestones to record in memory

Written to the project memory directory as each completes, per standing instruction:

- [x] **M0** — 24 Oct 2026. Venue fixed to MSR 2027 only, sole author, `ccos-study` parked to
      Stage 2 (§2.1). Bun 1.4.4 installed; 433 tests at 395 pass / 38 skip / 0 fail; `doctor`
      all gates pass, exit 0. The CRLF defect in the apply gate found and fixed (§2.5).
      Archive restored: **433 pass, 0 fail, 0 skip**, and the byte-identical `master_table.md`
      reproduction verified (§2.6). Outstanding, carried forward: **tag `c8872d07` in
      `Lagadnakul/Dissertation` before it is garbage-collected** (§2.6 — do this first), link
      the paper skills (§2.3), and move the repo under `Lagadnakul` before the Data
      Availability statement is written (§2.1).
- [ ] **M1** — power analysis done; N chosen; four hypotheses locked
- [ ] **M2** — triage and CC-OS simulator pass tests over real data
- [ ] **M3** — dashboard v1 shipped, contrast green
- [ ] **M4** — abstract submitted (13 Nov)
- [ ] **M5** — Stage 1 submitted
- [ ] **M6** — dashboard v2, `LIMITATIONS.md`, Zenodo DOI

---

## 10. The short version

Write a six-page protocol. Build four small TypeScript programs over data you already have.
Make one genuinely good dashboard that shows the design honestly. Touch no Docker, spend no
API calls, and get the supervisor's confirmation in writing before you start.

The hard part is not the code. It is the power analysis and the decision in §7.
