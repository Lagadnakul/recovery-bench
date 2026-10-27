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
bun run verify          # every offline gate in one command, ~22s
```

`bun run verify` replaced the six commands this section used to list. It runs typecheck,
the suite, `doctor`, the `master_table.md` oracle check, `power` and the 127 palette checks,
prints only failures, and exits with the number of failed gates. `--fast` drops the two slow
ones and `--list` shows them. It resolves the Bun binary through `process.execPath` rather
than the string `"bun"`, because a spawned process on Windows does not reliably inherit a
PATH containing it.

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

## 3. Phase 1 — the power analysis · DONE 24 October

`WORKFLOW.md` called this **"the critical item"**. It earned the label: the answer changes the
protocol.

Built: `packages/pipeline/analysis/power.ts`, `tests/power.test.ts` (31 tests), `bun run power`,
emitting `reports/data/power.md` and `recovery-bench/data/power.json`. Suite is **464 pass,
0 fail**; `doctor` green; `master_table.md` still byte-identical.

**Exact, not simulated.** Discordant pairs are multinomial and the exact McNemar p-value is a
two-sided binomial test at p = 1/2, so power is a finite O(n²) double sum. No RNG, no seed, no
Monte-Carlo error — the digits the paper quotes are reproducible forever. At matched n the
values agree with `ccos-study/docs/analysis_plan.md` §7 to within 0.01 (n=40: 11.3/28.2/36.4
against its simulated 0.11/0.28/0.37), which validates both.

### Finding 1 — the pilot's null was arithmetic, not evidence

The exact test **cannot reach α = 0.05 on fewer than 6 discordant pairs**, whatever n is: the
most extreme split of m pairs gives p = 2·(1/2)^m, which is 0.0625 at m=5 and 0.03125 at m=6.
Below that the rejection region is empty — power is not low, it is **zero**.

**The pilot had 4 logic-class failures.** Had all four favoured one strategy, p = 0.125. It
could not have produced a significant result on any data whatsoever.

This is the strongest sentence available for Threats to Validity, and the cleanest possible
justification for the Registered Report: the 0-of-4 result was not weak evidence of no effect,
it was *no evidence either way*, guaranteed before collection began.

### Finding 2 — N = 150 gives H1 almost no power, and §7 was measuring the wrong pool

`analysis_plan.md` §7 tabulates the **whole failure pool** (0.4 × N). But **H1 is logic-class
only**, and logic is half the pool: **0.2 × N**. Its table is correct about a quantity H1 does
not use.

| Tasks | Failure pool | **H1 logic pool** | small | medium | large |
|---|---|---|---|---|---|
| **150** | 60 | **30** | **4.6%** | **15.3%** | **23.5%** |
| 220 | 88 | 44 | 14.5% | 33.1% | 41.1% |
| 300 | 120 | 60 | 28.1% | 50.4% | 58.1% |
| 450 | 180 | 90 | 50.2% | 73.9% | **79.2%** |
| 600 | 240 | 120 | 67.1% | **87.1%** | **90.4%** |

At 80% power, H1 needs:

| Effect | paired n | **tasks to attempt** |
|---|---|---|
| small (0.10/0.02) | 153 | **765** |
| medium (0.15/0.03) | 102 | **510** |
| large (0.20/0.05) | 92 | **460** |

**The pre-registered N = 150 would have given the primary hypothesis 4.6–23.5% power.** Running
it would have reproduced the pilot's problem at ten times the cost.

### Phase 1b — partial credit was checked, and it does not work

The obvious escape from Finding 2 is partial credit: score each task by how many FAIL_TO_PASS
sub-tests it fixes rather than whether it fixed all of them, and use a paired rank test.
`django-11019` carries 16 sub-tests, so the idea looks strong from that one example.

Built: `packages/pipeline/analysis/subtest.ts`, `tests/subtest.test.ts` (18 tests), folded into
`bun run power`. **Two independent measurements say no.**

**1. There is almost no partial credit available.** FAIL_TO_PASS counts across all 300
SWE-bench Lite instances:

| Sub-tests | Instances | Share |
|---|---|---|
| **exactly 1** | **192** | **64.0%** |
| 2 | 74 | 24.7% |
| 3–5 | 21 | 7.0% |
| 6–9 | 5 | 1.7% |
| 10 or more | 8 | 2.7% |

Median **1**, q75 2, q90 3. **For 64% of instances the sub-test score *is* the binary
outcome** — there is nothing to extract. Only 4.4% have six or more, so `django-11019` is the
least representative instance in the benchmark, not the typical one.

**2. Every paired difference that exists is exactly zero.** Blind Retry and Diagnose+Revise
return *identical sub-test scores* on all four logic-class tasks — 0/1, 6/16, 0/1, 0/2. A
Wilcoxon signed-rank test discards zero differences before ranking, exactly as McNemar discards
concordant pairs, so the informative sample is not smaller than the binary one: **it is empty.
0 informative pairs against a floor of 6.**

That is a sharper statement of the pilot finding than the binary table can make, and it belongs
in the paper: the strategies did not merely reach the same verdict, they fixed the same tests.

### What the data does support: PASS_TO_PASS regressions

**98% of instances carry at least one PASS_TO_PASS test** (median 44, mean 82), and unlike F2P
this outcome **did** separate the strategies in the pilot:

| Task | Strategy | Tests broken |
|---|---|---|
| `django-11019` | baseline | **33** |
| `django-11283` | Diagnose+Revise | **8** |
| `django-11283` | Blind Retry | **0** |

This is D4's counter-signal, and it is the only outcome available with both the cardinality and
the observed variance to support a test. It measures a different question from recovery —
whether richer failure information does *harm* — so it is a candidate for a **new hypothesis**,
not a replacement for H1.

### The decision, with Phase 1b settled

460 tasks × 3 strategies × up to 3 rounds is far beyond the budget: D25 already found the
*existing* 1,308-cell grid needs 14.56M tokens against an 8M ceiling. With partial credit ruled
out, three options remain:

1. **Reframe H1 as non-inferiority / equivalence.** The pilot does not merely fail to find a
   difference — it finds *exact equality*, on verdicts and on sub-test scores. "No difference
   detected at this sample size" is a weak claim; "equivalent within a margin" is a real one,
   and it is the honest framing when the expected result is a null. Already how `ccos-study`
   frames H4 (margin 0.05). **Recommended.**
2. **N = 450–600 for a superiority test.** Reaches 80% power for medium and large effects.
   Requires solving the token budget first, and is the only option whose feasibility is in
   genuine doubt.
3. **Add a harm hypothesis on P2P regressions.** High cardinality, 98% availability, observed
   variance. Strengthens the paper rather than rescuing H1. **Recommended alongside 1.**

**Recommendation: 1 + 3.** Equivalence framing for H1, a new harm hypothesis on P2P
regressions, and the binary McNemar reported as the pre-registered secondary with its
460–765-task requirement stated in Threats to Validity. A reviewer who checks the power will
find that number; finding it already stated is a strength, not an admission.

**Still open: the equivalence margin.** That is a scientific judgement, not a computation —
it has to be defended in the protocol and ideally agreed with the supervisors. `ccos-study`
uses 5 percentage points. Phase 1c is the power curve once the margin is fixed.

### The four hypotheses, locked

Verbatim from `WORKFLOW.md:146-153`:

- **H1** — Diagnose+Revise does not improve recovery over Blind Retry on logic-class failures
- **H2** — Recovery success depends on the **failure class**, not the strategy
- **H3** — Strategies with identical outcomes differ significantly in **cost**
- **H4** — A class-conditioned stopping rule achieves equal recovery at lower cost
  — **H4 is the new contribution**

**Milestone M1 → recorded.**

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

  > **This was the instruction. The outcome was different, and the outcome is what a
  > reader of this document needs.** The fit ran and returned λ̂ ≈ 0.724, but its 95%
  > likelihood-ratio interval is **[0.121, 1.000]** — it reaches 1, so it cannot rule out
  > *no decay at all*. `reportedLambda` therefore returns `null`, `isMeasured` is
  > `false`, and **the committed policy ran at λ = 1**, meaning the belief is flat in the
  > attempt index. On 31 trials context rot is not visible.
  >
  > The pipeline is honest about this on its own terms — `analysis/ccos.ts` says in its
  > header that *"the pilot provides no evidence that context rot exists at all"*, and
  > the null-return is a deliberate safeguard against a sampling artefact setting θ_c.
  > The bullet above is a design instruction written before the fit was run, and quoting
  > it as a result would overstate what the run established. Screen 6 of the console
  > states the limitation on screen.

Feed it `replay_rows.json`. The output is θ_c per class and the decision trace — **a
demonstration that the method is implementable, labelled as such.** Not a finding.

### 4.3 Phase 2 as built — 24 October 2026

`analysis/triage.ts` (29 tests) and `analysis/ccos.ts` (48 tests), both behind `bun run ccos`,
writing `reports/data/ccos.md` and `recovery-bench/data/ccos.json`. Added as the seventh
`bun run verify` gate. Suite: **559 pass, 0 fail across 27 files.**

**The feasibility claim holds, exactly as the proposal states it.** All **51** archived records
are classified with **0 model calls** — 9 FORMAT, 25 LOGIC, 17 resolved — and every record
prints the field that decided it. Triage agrees with `classify.ts` on every baseline row, so
the four-class taxonomy and the two-class split the submitted tables rest on are the same
derivation. `FORMAT` is wired to `@rb/core`'s `isFormatClass` rather than redefined, so there
is one definition in the codebase.

**Five findings, each of which changes the Stage-1 protocol.**

1. **The proposal's triage precedence is wrong, and its signature is not implementable.**
   `BROKEN` must be tested *before* `FORMAT` — an instrument limit measured nothing, and
   checking `apply_failed` first scores our own token ceiling as the model's bad formatting
   (D18). And `triage(attempt)` cannot return `LOST`: three classes are properties of one
   attempt, `LOST` is a property of a sequence. The signature splits in two.

2. **The novelty score in the proposal does not merely fail — it inverts.** It specifies
   Jaccard over *files touched*. SWE-bench Lite gold patches are single-file (D21), so the file
   set is a constant of the *task*: file-level novelty is **exactly 0 on 21 of 26** scoreable
   retries, and **all 5 non-zero values come from a patch with no readable file header**
   (10 of 95 archived patches have none). The only attempts it calls novel are the ones too
   malformed to name a file. Replaced with Jaccard over *edited lines*, whitespace-normalised,
   which has real spread on the same data (0.000–1.000, mean 0.46) and ranks near-repetition
   below genuine re-attempts.

3. **LOST could not have fired, and that is provable rather than observed.** The first
   attempt's novelty is 1 by definition. A trajectory of exactly `window` attempts therefore
   has one window, that window contains attempt 1, and its mean is at least `1/window`
   whatever the data — so with ε = 0.2 < 1/3, LOST is unreachable at depth 3 **for any
   data**. Every scoreable trajectory in the archive has exactly 3. The same shape as the
   power finding: arithmetic, not evidence.

4. **λ is fitted, converges to an interior λ̂ ≈ 0.72 — and still does not evidence context
   rot.** The 95% likelihood-ratio interval reaches **1.000**, which is no decay at all. Two
   reasons, both computed: 3 of 5 observation cells sit at a rate of exactly 0 or 1 (a
   Bernoulli rate with no interior value constrains the level, not the slope), and **0 of 10
   successes were ever retried** — so every later-round denominator is conditioned on
   earlier-round failure and λ̂ confounds context rot with difficulty selection, biased
   *downwards*. `reportedLambda` returns `null` and θ_c is computed at λ = 1, the stated null.
   That is the difference between *"λ is measured"* and *"λ was typed in"*.

5. **The finite-horizon rule does not dominate the myopic one unconditionally.** The first
   draft of `ccos.ts` asserted it did; `tests/ccos.test.ts` refuted it. The horizon threshold
   is ≤ the myopic θ **exactly when the continuation value is non-negative**, and strictly
   above it when q·G < h — asking is then net-negative, so a failed retry leaves a liability
   rather than an option. That regime also exposes a gap in the published rule: with both
   options negative there is **no abandon action**, so the policy keeps spending on the
   less-bad one. One line in Threats to Validity.

**The structural claim is proved, not asserted.** There is one `decide` function; the four arms
are four `thetaFor` functions handed to it — Stubborn −∞, Needy +∞, Random ±∞ on a seeded
coin, CC-OS θ_c. The tests enumerate a 72-point decision space and check that Stubborn retries
everywhere, Needy escalates everywhere, Random's decisions are independent of the class, and
**CC-OS with one q for every class reduces exactly to a class-blind threshold policy** — which
is what makes class-conditioning the only difference between arm D and a fixed-threshold
baseline.

**What is assumed rather than measured, stated once.** `q_c` — the probability a human unblocks
a failure of class c — is an assumption (`ASSUMED_Q`), because no human was ever interrupted in
this study and no reanalysis will fill it in. Under the assumed values the derived policy
contradicts the thesis on FORMAT (it escalates; the thesis says retry). That is **not** a
contradiction yet — it is a constraint, and the report prints it as one: the rule reproduces the
prescription for **q_FORMAT < 0.78**, against an assumed 0.9 and an observed retry success of
p = 0.5 over 10 retries. Elicit q below that figure and the derived policy agrees with no code
change, which is the behaviour the thesis claims. The gate deliberately does **not** fail on
this, because failing it would pressure a future reader into editing `ASSUMED_Q` until the test
passes — the exact opposite of *"the policy is derived, not written"*.

**One design requirement comes out of 3 and 4 together: K ≥ 4 attempt rounds, run
unconditionally on a subsample.** Three is the minimum at which LOST can fire at all, and
retrying tasks that already succeeded is the only way to separate decay from selection. It is a
change to *depth*, not breadth — which matters against a grid already 178% over its token
ceiling (D25).

**Still open and unchanged:** the equivalence margin (§3), and N.

**Milestone M2 → written to memory.**

---

## 4.5 The live sweep — a5 ran 25 October, and it rejected

Everything above §4.4 is design and pilot evidence. This section is the first thing in the
project that is **a measurement**. Read the distinction carefully, because the dashboard
rules in §5 depend on it: the `ccos` output is a demonstration, a5 is data.

### Step 0 — what had to be fixed first

Seven keys now exist: `NVIDIA_KEY_1..4`, `qwen_api_key`, `gemini_api_key`,
`gemini_api_key1`. Wiring them exposed four defects, three of which only a *live* run
could reveal:

| | defect | consequence had it shipped |
|---|---|---|
| 1 | `bun run sweep` was the only script without `--env-file ../.env.local` | a live sweep would authenticate with **no keys at all**, and `--project-only` would count `keysSet = 0` and re-print D25's 178% overrun as though the pool did not exist |
| 2 | `doctor`'s exhaustion check used `spendOf(provider)` | for a `per_key` provider that reads the **always-empty shared bucket**, so NVIDIA could sit at 32M spent and the gate would still say healthy |
| 3 | `ledger.summary()` called without `keysSet` | printed `[1 key(s) x 8,000,000]` for a four-key pool — understating capacity 4x, the exact shape of how D25 came to read 178% |
| 4 | `tryCell` had defect 2 twice | `try` printed `0 → 0 tokens` after really spending 31k |

**The pattern worth naming:** for a `per_key` provider the provider-level question is
`spendOfProvider`, **never** `spendOf`. It was wrong in three places.

`a6_qwencloud` was enabled at **2 repeats, not 3** — at 3 it projected 1.03M tokens against
a 0.90M ceiling set deliberately under Qwen's 1M free quota, so the overflow was real: cut
breadth, not the ceiling (D3). And `a2`/`a3`/`a4` went to **`rounds: 4`**, satisfying §4.3's
K ≥ 4 requirement. That was affordable because rounds make lineages *deeper*, not more
numerous — the lineage count is unchanged — which is precisely what the fourth NVIDIA key
bought. **`a1` stays at rounds 2: the pilot ran 2, and a replication that changes depth is
not a replication.**

Grid as it now stands: **1,844 cells in 1,076 lineages, 22.18M tokens**, every provider
inside its ceiling. Two of the four `failure_pool` tasks are also in `stratified_60`, which
merges 12 lineages across arms — checked and benign, since exhaustion is scoped by provider
and each cell records its own arm.

### D20 is handled, and that is a scientific fact not an operational one

NVIDIA signals capacity exhaustion with **HTTP 200 and an empty body** rather than a 429.
Observed again on 25 October from `nemotron_nano` on a *single sequential probe with no
concurrent load*, then fine on re-probe — so it is provider-side capacity, not only the
16/16 worker limit, and it can strike at concurrency 1.

`res.ok` is true for a 200, so the `!res.ok` branch never sees it. What catches it is
`res.json()` **throwing** on an empty body, landing in the generic catch as retryable — up
to `max_retries`, then `PROVIDER_ERROR`.

| outcome | means | triage | measures the model? |
|---|---|---|---|
| `PROVIDER_ERROR` | the instrument was unavailable | BROKEN | **no** |
| `NO_OUTPUT` | the model returned nothing | BROKEN | yes — asserts a real empty completion |

An empty body becomes the first, never the second. Five tests in `tests/providers.test.ts`
pin that boundary, including the other side: `muse_30b`'s genuinely empty *content* when
reasoning exhausts its ceiling stays `NO_OUTPUT` and is not retried away. **So raising
concurrency risks wasted retries and holes in the matrix, not corrupted data.** Documented
but not changed: `pool.rotate()` fires only on 429, so an empty body retries the *same* key.

### a5 — 720 cells, 127.8 minutes, 8.608M tokens

Projected 8.32M, spent 8.608M — **3.5% over, so the projector is trustworthy**. Zero
`PROVIDER_ERROR`, zero `BUDGET_STOP`, zero empty bodies in 720 live calls at concurrency 4.
`--verify`: COMPLETE, every planned cell has exactly one row.

| format | APPLIED | rate |
|---|---|---|
| `search_replace` | 347 / 360 | **96.4%** |
| `unified_diff` | 47 / 360 | **13.1%** |

**360 complete paired comparisons within (task, model, repeat), 0 incomplete.** Both
applied 46 · search_replace-only **301** · unified_diff-only **1** · neither 12.

> Discordant pairs **302** against a rejection floor of 6. **Exact McNemar p = 7.44e-89.**

Set that against §3: the pilot had 4 logic failures against a floor of 6, so its best
attainable p was 0.125. This arm has 302 discordant pairs.

**It survives the obvious attack.** The prompt — from `day7_step1_generate_full_pilot.py`,
the study's own code — states in capitals that hunk counts must match, but never literally
asks for a `--- a/ +++ b/` header. Discard **every** `no_file_header` failure and 280 pairs
remain with b = 222, c = 1, **p = 3.32e-65**.

**The mechanism is arithmetic, not coding.** `hunk_count_mismatch` is 206 of 304 FORMAT
rows. A header `@@ -A,B +C,D @@` requires the model to count the lines in its own hunk and
state the count; `search_replace` requires no counting at all, and its 10 failures are a
different mechanism entirely (`search_not_found` — hallucinated context).

### The surprise: capability ran backwards

| model | `search_replace` | `unified_diff` |
|---|---|---|
| `muse_30b` (30B) | 97.8% | **25.6%** (46/180) |
| `nemotron_ultra` (550B) | 95.0% | **0.6%** (1/180) |

The 550B model produced **one** valid unified diff in 180 attempts — 40x worse than the
30B. Checked for a systematic style artefact: there is none. Its failures are the same mix,
uniformly worse (`hunk_count_mismatch` 112 vs 94, `no_file_header` 48 vs 32, `APPLY_FAIL`
15 vs 2), so it fails at every stage rather than in one odd way.

**Caveat that must travel with it:** n = 2 models cannot establish a capability trend, and
`nemotron_ultra` has `max_tokens` 16384 against muse's 8192. An observation, not a law.

Triage handled the new rows unmodified — FORMAT 304 vs 10, and the 12 `TRUNCATED` rows
became BROKEN with `measuresModel: false`, correctly excluded. 708 measure the model, 12 do
not.

### State the claim narrowly, or a reviewer will state it for you

**`APPLIED` is not `RESOLVED`.** Under D6 there is no Docker, so `resolved` is null by
type. a5 measures **whether a model's edit can be applied at all** — not bug-fixing
ability. And `fuzzy_match: false`, so the claim is "under strict application"; a lenient
applier would repair many of these. Say so rather than letting it be found.

Stated that narrowly it is still the only arm in the grid with the power to reject
anything, which is why §3's recommendation stands: **make this the primary hypothesis and
the equivalence claim secondary.**

### The data is now committed

`data/sweep_rows.jsonl` (3.2 MB) was gitignored by a rule written when sweep rows were
hypothetical per-run noise. It is now the paper's **primary dataset** — 128 minutes and
8.6M tokens that cannot be cheaply reproduced. Verified free of secrets (0 key-shaped
strings, 0 of the 7 real key values) and committed. The Data Availability statement points
at it.

**Milestone M3 → written to memory.**

---

## 4.6 The full sweep — COMPLETE 26 October 2026

All six arms have now run. **1,604 rows, 1,428 real calls, 18.1M tokens, zero duplicate
keys.**

| arm | rows | APPLIED | MALF | refused | real err | calls | tokens | wall |
|---|---|---|---|---|---|---|---|---|
| `a1_replication` | 28 | 12 | 0 | 10 | 1 | 17 | 0.16M | 4 min |
| `a2_workhorse` | 260 | 123 | 5 | 84 | 10 | 166 | 2.06M | 103 min |
| `a3_capability` | 180 | 122 | 31 | 0 | 0 | 180 | 2.30M | 16 min |
| `a4_reasoning` | 360 | 30 | 236 | 20 | 35 | 305 | 4.52M | 124 min |
| `a5_format_at_scale` | 720 | 394 | 297 | 0 | 0 | 720 | 8.58M | 128 min |
| `a6_qwencloud` | 56 | 37 | 3 | 16 | 0 | 40 | 0.49M | 6 min |
| **TOTAL** | **1,604** | **718** | **572** | **130** | **46** | **1,428** | **18.1M** | |

### The headline result: reflection helps once, then poisons

`a3` is the strongest new finding in the project.

| | r1 | r2 | r3 | r4 |
|---|---|---|---|---|
| 550B, `l1_blind_retry` | 75% | 75% | 80% | 75% |
| 550B, `l2_reflection` | **90%** | 45% | 40% | 50% |
| 30B, `l2_reflection` (a2) | 76% | 72% | 68% | 74% |

Paired exact McNemar on apply success, rounds 2–4, same task / round / repeat:

```
a3, 550B:  b=19  c=0   n=60   p = 3.8e-6     perfectly one-sided
a2,  30B:  b=4   c=4   n=60   p = 1.000      exactly null
```

Nineteen cells where blind retry applied and reflection did not, and **not one** the other
way. It holds in **all four tasks** with no reversals — astropy 2–0, django-11019 10–0,
django-11283 5–0, django-11564 2–0 — so it is not one task carrying it.

**The mechanism is observed, not inferred.** 29 of 30 MALFORMED rows are
`search_not_found`: the SEARCH anchor the model writes is absent from the file. Median
completion tokens climb monotonically with reflection depth — 1125, 1284, 1317, 1397 —
while blind retry sits flat near 740. The model writes more each round and anchors on its
own prior output instead of on the file.

**This is the CC-OS stopping argument made by an experiment: for this model the optimal
stop is K = 1.** Continue past it and you destroy work you already had.

### a4 is a floor, not a recovery curve

`l0_baseline` applied **0 of 15** paired cells. You cannot measure recovery from a model
that never succeeded — every later round re-measures first-attempt capability. **Report a4
as a format-capability result, not a reasoning one.**

What it does measure is exact: 181 `block_unterminated` rows, of which **164 do write
`>>>>>>> REPLACE` and only 2 contain a `=======` divider.** The model dumps the whole
function between the markers without ever saying where the old text stops — one example
ran 142 undivided lines. The parser was checked first and is correct; it normalises CRLF
and strips fences before matching. `thinking` did not rescue it: MALFORMED 77% off against
78% on.

### a1 replicates the pilot's inability to conclude

```
usable pairs n=4    b=0   c=0    discordant = 0    floor = 6    p = 1.0000
```

Arithmetically incapable of reaching p < 0.05 whichever way the data fall. That reproduces
the pilot's central limitation exactly and is the **empirical ground for the Stage 1
sample-size argument**. A replication that reproduces the original's inability to conclude
has replicated the thing that mattered.

### a6 confirms D34 from outside NVIDIA

`l2_5_diagnose_revise` refused **16 of 16** on a fourth vendor's hardware, after refusing
**80 of 80** in a2. The starvation is a property of the design under D6, not of one
model's unusually high apply rate. D34 dropped it from a3/a4; it is reported as a
*conditional* condition grounded in the archive's 73 test-verified rows. `qwen_max`
otherwise sat at the top of the range — baseline 8/8, and only 3 `search_not_found`
failures in the whole arm.

### What had to be fixed to make the sweep trustworthy

Three defects, each with a test that fails when the fix is reverted:

1. **Two sweeps ran at once.** `a2`'s first attempt produced **419 rows for 260 cells** —
   159 duplicates, 74 of whose pairs disagreed because they were independent model calls.
   That attempt was discarded and `matrix/lock.ts` added. The final sweep has **zero**
   duplicate keys across 1,604 rows.
2. **Resume destroyed lineage depth.** A skipped cell used to `continue` without feeding
   its attempt forward, so a resumed round 4 silently reflected on the round-0 baseline.
   Nothing in the output showed it. The first version of the test for this **passed with
   the fix reverted** and had to be rewritten with a unique marker per call.
3. **`timeout_s` was guessed, then measured.** 180 s was tried and refuted — 4 of the
   first 10 cells timed out against 0 of a5's 720 at 300 s. An 899-token prompt took as
   long as a 29,555-token one, so it is free-tier queueing, not prompt size.

### What the sweep cost that the table does not show

**32 condition cells were never run** — a1 lost 4, a2 lost 8, a4 lost 20 — because a round
killed by a 503 leaves every later round in its lineage with nothing to reflect on (D36).
The refusal is correct; reflecting on an HTTP 503 is a different condition wearing the
same name. The serial lineage is the cost, and a lineage truncated by infrastructure is
missing-not-at-random with respect to difficulty. **Say so in Threats to Validity.**

### The caveat that travels with every result above

`APPLIED` is **patch-apply success, not a test pass**. `evidenceSource` is `none` on all
1,604 live rows because D6 put Docker permanently out of reach. The recovery arms use four
tasks, so pairs cluster within task. State all three before a reviewer does.

**Milestone M3b → written to memory.**

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
| **3 · Pilot evidence** | 12 PASS / 4 FAIL / 4 ERROR; the recovery matrix with its 8 unrun cells | The real result you already own: 0/4 logic, 3/3 format — **20-task pilot matrix**, not the 31-trial archive the stopping rule is fitted on (there: 0/21 logic, 5/10 format) |
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
   format-class recovered 3/3 **in the 20-task pilot matrix**, and the 0→6 sub-test jump
   on `django-11019` came from the retrofit, not from the strategy. The 31-trial archive
   that `ccos.json` fits the policy on puts the same class at **5 of 10**; cite whichever
   you mean by name, never `3/3` beside a belief of `0.500`.

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
| 24 Oct | 1 · power | **DONE.** `power.ts` + 31 tests · `subtest.ts` + 18 tests · `bun run power` · `bun run verify` · N deferred pending the §3 decision |
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
- [x] **M1** — 24 Oct 2026. `power.ts` + 31 tests + `bun run power`. Exact McNemar power.
      Two findings: the pilot could never have rejected (4 logic failures against a floor of 6
      discordant pairs, best attainable p = 0.125), and **N = 150 gives H1 only 4.6-23.5%
      power** because H1's sample is 0.2xN, not the 0.4xN pool `analysis_plan.md` §7 tabulated.
      80% power needs 460-765 tasks. **N is not yet chosen** — §3 sets out the four options and
      recommends an equivalence framing plus a new harm hypothesis.
- [x] **M1b** — 24 Oct 2026. `subtest.ts` + 18 tests. Partial credit **ruled out** on two
      independent measurements: 64% of SWE-bench Lite instances have exactly one FAIL_TO_PASS
      test, and every paired sub-test difference in the pilot is exactly 0 (0 informative pairs
      against a floor of 6). Found instead that **P2P regressions do discriminate** (98%
      availability; Diagnose+Revise broke 8 tests where Blind Retry broke none) — a candidate
      new hypothesis. Open: the equivalence margin.
- [x] **M2** — 24 Oct 2026. Triage classifies 51/51 records with **0 model calls**; the
      proposal's novelty score inverts; LOST cannot fire at K=3 (design requirement K ≥ 4);
      lambda shows no context rot, but is survivorship-confounded.
- [x] **M3b** — 26 Oct 2026. **The live sweep is COMPLETE**: all six arms, 1,604 rows,
      1,428 calls, 18.1M tokens, zero duplicate keys (§4.6). Headline: reflection helps the
      550B model once then poisons it, **19–0, p = 3.8e-6**, against **exactly null** on the
      30B. a1 reproduced the pilot's zero power (0 discordant against a floor of 6). a6
      confirmed D34 on a fourth vendor. Open: a4 is a floor not a recovery curve; 32 cells
      lost to the D36 cascade; the equivalence margin still unchosen.
- [ ] **M3** — dashboard v1 shipped, contrast green
- [ ] **M4** — abstract submitted (13 Nov)
- [ ] **M5** — Stage 1 submitted
- [ ] **M6** — dashboard v2, `LIMITATIONS.md`, Zenodo DOI

---

## 10. The short version

Write a six-page protocol. The four small TypeScript programs are built and the live
sweep is **done** — 1,604 rows across six arms. Make one genuinely good dashboard that
shows the design and the data honestly. Touch no Docker: every live row measures
`APPLIED`, not `RESOLVED`, and that limit is stated rather than hidden.

The hard part is no longer the code, and it is no longer only the power analysis. It is
**saying narrowly what the data supports**: reflection's benefit is capability-dependent
and reverses with depth (a3, p = 3.8e-6), edit format decides whether a patch applies at
all (a5, p = 7.44e-89), and the pilot design has zero power (a1, demonstrated). Everything
else — a4's floor, the 32 cells lost to the cascade, `APPLIED` not being `RESOLVED` — goes
in Threats to Validity, in your own words, before a reviewer finds it.
