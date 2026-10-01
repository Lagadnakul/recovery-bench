# Dissertation Completion Plan — Phase II Submission

**Student:** Lagad Nakul Kiran (2503032340022) · M.Tech AI & DS, PIET, Parul University
**Thesis:** Self-Reflection and Failure Recovery in Agentic AI Coding Systems
**Plan owner:** Aayush (support) · **Author:** Nakul
**Created:** 2026-09-25

---

## 0. Scope of this phase

**In scope — this is all Nakul wants to submit now:**

1. Chapter 4 — Methodology (19 sub-sections, currently 0 words)
2. Chapter 5 — Results and Discussion (13 sub-sections, currently 0 words)
3. Chapter 6 — Conclusion and Future Work (7 sub-sections, currently 0 words)
4. References (35 entries, currently missing entirely)
5. Dissertation Review Card + Compliance Report
6. All figures and tables, as editable `.drawio` files
7. Front-matter corrections in `Self.docx`

**Explicitly out of scope for now:**

- Re-running or refactoring the experiment code
- Migrating to NVIDIA NIM
- Expanding the task set beyond the existing 20
- Adding new recovery strategies (L3–L7)

Those are all documented in §8 as *future work* — which is exactly where they
belong in Chapter 6 anyway. Writing them up as planned extensions costs nothing
and strengthens the thesis.

---

## 1. One boundary, stated once

The chapters will describe **what the code actually does**. Where the current
draft claims something the implementation does not support, the fix is to
change the claim, not to write around it.

There are exactly three of these, and all three are cheap to fix:

| Current claim | What the code does | Fix |
| --- | --- | --- |
| "agentic AI coding system" | one stateless API call, no tools | call it single-shot LLM patch generation |
| "identical outcomes across the failure pool" | 8 of 24 cells never evaluated | report 16 evaluated, 8 dropped |
| "reproducible evaluation pipeline" | no temperature/seed set | state the limitation, publish the code |

None of these weaken the thesis. The corrected version is a *better* result
(see §2). This is the only place where I will not just write what is asked —
everywhere else, the plan is to write it as strongly as the evidence allows.

---

## 2. Decision log — what we established

Findings from reading `Self.docx`, the 14-page systematic review, and the full
`Dissertation-main` repository (30 scripts, 12 prediction files, 18 evaluation
runs).

### D1 — The headline finding is real, and it is not the one in the abstract

The abstract reports a flat null. The logs contain a sharper result:

```
django-11019    baseline (unified diff)   0/16 sub-tests   +33 tests broken
                Blind Retry               6/16              0 broken
                Reflection-only           6/16              0 broken
                Diagnose+Revise           6/16              0 broken
```

All three strategies land on **exactly 6**. The 0→6 jump came from the
SEARCH/REPLACE retrofit. The thesis accidentally ran a clean ablation.

> **Thesis claim to build Chapter 5 around:** changing how the edit is
> *expressed* moved the result; changing what the model was *told about its
> failure* did not.

This is defensible, quotable, and already in the data.

### D2 — The comparison matrix has holes, and they must be reported

8 of 24 condition-task cells produced no evaluable patch. In Round 1,
Reflection-only produced an applicable patch for **1 of 4** tasks. The script
prints "Not applied" and writes nothing, so the cell disappears.

Those dropped cells are the **most frequent single outcome in the study** and
are currently invisible. They become an outcome category in §4.14.

### D3 — The quota, not scientific judgement, shaped the experiment

- `master_results_table.md` says "skipped to save quota" in 4 cells, verbatim
- every script has a hard-coded `time.sleep(60)`
- Gemini free tier for `gemini-3.6-flash` is ~20 requests/day
- one clean sweep = 24 calls = more than a day's quota

This is an honest and rather good limitation to write up. It explains the
pilot's size, and it motivates the future work cleanly.

### D4 — Diagnosis made one case actively worse

On `django-11283`, Diagnose+Revise broke **8 previously-passing tests**; Blind
Retry broke none. This matches the established finding that LLM self-correction
can degrade performance. Goes in §5.7 and §5.11.

### D5 — The sample is not random

The 20 "pilot" tasks are the first 20 alphabetically — astropy and django only,
2 of the 11 repositories in SWE-bench Lite. 12 of 20 are Django. Must be
disclosed in §4.4 and §5.12.

### D6 — Benchmark validity is the biggest external threat

Human screening of SWE-bench filtered out **68.3%** of samples as
underspecified or unfairly tested (38.3% underspecified, 61.1% unfair tests).
`django-11283` fails because the test calls the patched function with `None`.
Four tasks need a solvability audit; the result goes in §5.12.

### D7 — Missing literature that strengthens the argument

Not in the 35-paper table, all directly supportive:

- Huang et al., *LLMs Cannot Self-Correct Reasoning Yet* (ICLR 2024) — the
  closest prior work; makes the Reflection-only null a **replication**
- Kamoi et al., *When Can LLMs Actually Correct Their Own Mistakes?* (TACL 2024)
- TRACEPROBE / *What Resolve Rate Hides* — the partial-credit argument, already
  cited in Nakul's own `research_gap_final.md` but never applied to his results
- SREGym's independent JEV evaluation — 40%→48%, n=50, honestly reported as
  not significant. A directly comparable honest-null.

### D8 — Cost was never measured

| Measured from the repo | Value |
| --- | --- |
| `astropy/wcs/wcs.py` pasted whole into every prompt | 31,098 tokens |
| Diagnose+Revise input vs. Blind Retry | ~3× |
| Hard-coded throttle per call | 60 s |
| Evidence kept from a 1.7 MB test log | last 3,000 chars (0.2%) |

Field standard is **Verified Recovery Rate** (recovered ÷ eligible failures)
reported *with* recovery effort. Under that pair the result reads: *0% recovery
at 3× token cost* — much stronger than a bare null.

### D9 — Front-matter defects found in `Self.docx`

| # | Defect | Where |
| --- | --- | --- |
| 1 | List of Figures/Tables contains **Split CIFAR-100** and "Meta-Continual Framework" from a different thesis | front matter |
| 2 | 35 citations used, **no reference list** | end |
| 3 | Three different thesis titles across four certificates | front matter |
| 4 | Cover says "System" (singular) | cover |
| 5 | Supervisor "Ramirzaja" vs "Ramizraja" in submitted Elsevier manuscript | review PDF |
| 6 | Publication certificate says "has published/accepted"; it is only submitted | front matter |
| 7 | TOC page numbers are placeholders (13, 13, 13, 14…) | TOC |
| 8 | Ch 1 defines RQ1–RQ4; Ch 2 defines a different RQ1–RQ5 | Ch 1, Ch 2 |
| 9 | Ch 1 section titles don't match TOC (1.4, 1.6) | Ch 1 |
| 10 | Figure 3.2 referenced nowhere; figure numbering inconsistent | Ch 1, Ch 3 |
| 11 | Duplicate "Tool and Execution Failures" box in taxonomy figure | Ch 3 figure |
| 12 | Positioning figure is the same diagram pasted twice side by side | Ch 3 figure |
| 13 | `astropy-14182` dropped for RECITATION (model safety block = memorised training data) — undisclosed | not written |

---

## 3. Deliverables checklist

**Status: complete and submitted.** `Self.docx` — 26,768 words, 981 paragraphs,
16 tables, 17 figures, 37 references.

- [x] Ch 4 — Methodology (19 sub-sections)
- [x] Ch 5 — Results & Discussion (13 sub-sections)
- [x] Ch 6 — Conclusion & Future Work (7 sub-sections)
- [x] References — 37 entries
- [x] Dissertation Review Card
- [x] Compliance Report of previous exam comments
- [x] 11 figures as `.drawio` + PNG (§6)
- [x] 16 tables (§6)
- [x] Front-matter fixes — all 13 items in D9
- [x] Appendices: prompt templates, per-task results, config table

**`Self.docx` is final. It is not edited again** — not for the findings in §11
below, not for anything.

---

## 4. Writing order

Dependency-ordered. Each session produces something finished. **Do not reorder**
— later sessions consume decisions fixed in earlier ones.

### Session 1 — Foundation (no prose)

Lock the facts everything else cites.

1. Build the **master data table** from `report.json` files: per task, per
   condition, per round → `resolved`, FAIL_TO_PASS n/m, PASS_TO_PASS broken,
   apply-status
2. Write the **config table**: model ID, SDK, temperature (unset — record as
   such), context sizes, throttle, date of run
3. Reconcile **RQ1–RQ5** into one canonical set (keep Ch 2's five; make Ch 1
   point to them)
4. Lock the **outcome taxonomy** (5 categories, §4.14)

*Output:* `reports/data/master_table.md`, `reports/data/config.md`, `reports/data/rq_canonical.md`

### Session 2 — Chapter 4, first half (4.1–4.9)

Setup and infrastructure. Nothing here depends on results.

- 4.1 Experimental Overview → **Fig 4.1**
- 4.2 Research Questions and Evaluation Design
- 4.3 Dataset and Benchmark
- 4.4 Task Selection → disclose D5 (alphabetical, not random)
- 4.5 Model and Access Configuration → the config table; disclose D3 (quota)
- 4.6 Repository Context and Task Preparation → **Fig 4.2**, the 31k-token point
- 4.7 Oracle-Based File Localization → frame as *strengthening* the null
- 4.8 Patch Representation and Application → **Fig 4.3**
- 4.9 Evaluation Infrastructure → SWE-bench harness, Docker, WSL

### Session 3 — Chapter 4, second half (4.10–4.19)

The three conditions and the controls.

- 4.10 Baseline Evaluation
- 4.11 / 4.12 / 4.13 the three strategies → **Fig 4.4** (information-flow
  comparison — the single most important figure in the thesis)
- 4.14 Metrics and Outcome Classification → **Fig 4.5**; add the dropped-patch
  category (D2); add sub-test scoring (D1)
- 4.15 Fairness Retrofit → **Fig 4.6**
- 4.16 Second Recovery Round
- 4.17 Reproducibility and Experimental Controls → honest: temperature unset
- 4.18 Ethical and Practical Considerations → quota, cost, RECITATION (D9-13)
- 4.19 Chapter Summary

### Session 4 — Chapter 5, first half (5.1–5.6)

Pure reporting. No interpretation yet.

- 5.1 Baseline Results → **Table 5.1**, **Fig 5.1**
- 5.2 Baseline Failure Classification
- 5.3 The Patch-Formatting Confound → the discovery narrative
- 5.4 Results After the Fairness Retrofit → **Fig 5.2** (the 0→6 jump, D1)
- 5.5 Round 1 → **Table 5.2** with holes marked (D2)
- 5.6 Round 2 → **Table 5.3** with holes marked

### Session 5 — Chapter 5, second half (5.7–5.13)

Interpretation. This is where the marks are.

- 5.7 Cross-Strategy Comparison → **Fig 5.3**; include D4 (the 8 regressions)
- 5.8 Interpretation of the Null Result
- 5.9 Formatting Reliability vs. Reasoning Correctness → **the D1 thesis claim**
- 5.10 Methodological Findings
- 5.11 Comparison with Literature → Huang et al. as replication (D7); SREGym
- 5.12 Threats to Validity → D5, D6, D3, small n, single model
- 5.13 Chapter Summary

### Session 6 — Chapter 6 + References

- 6.1–6.7, answering each canonical RQ explicitly
- 6.6 Future Work absorbs everything from §0 "out of scope": NVIDIA migration
  for throughput, n≥5 per condition, stratified sampling, SWE-bench Verified,
  strategies L3–L7, cost-aware metrics
- References: 35 existing + 4 from D7, IEEE style

### Session 7 — Figures, tables, front matter

- Generate all 11 `.drawio` files (§6), export PNG at 300 dpi
- Rebuild List of Figures and List of Tables from scratch (kills D9-1)
- Apply all 13 front-matter fixes
- Regenerate TOC (F9 in Word)
- Assemble appendices

---

## 5. Figure manifest

All produced as editable `.drawio`, exported to PNG. Numbering is continuous
with Chapters 1–3, which already use Figures 1.1–1.3 and 3.1–3.3.

| ID | Title | Section | What it must show |
| --- | --- | --- | --- |
| 4.1 | Experimental Pipeline Overview | 4.1 | End-to-end: task → context → generate → apply → evaluate → classify. The honest architecture. |
| 4.2 | Repository Context Preparation | 4.6 | Gold patch → target file → whole-file paste. Annotate 31,098 tokens. |
| 4.3 | Patch Representation and Application | 4.8 | SEARCH/REPLACE → match → programmatic diff. Include the three failure exits. |
| 4.4 | **Information Available to Each Strategy** | 4.11–4.13 | Three columns. What enters the prompt at L0 / L1 / L2. **Most important figure in the thesis.** |
| 4.5 | Outcome Classification State Machine | 4.14 | 5 terminal states incl. dropped-patch (D2). |
| 4.6 | Fairness Retrofit — Before and After | 4.15 | Unified diff pipeline vs. SEARCH/REPLACE pipeline. |
| 5.1 | Baseline Outcome Breakdown | 5.1 | 12 pass / 4 logic fail / 4 malformed, of 20. |
| 5.2 | Sub-Test Recovery, django-11019 | 5.4 | The 0→6 jump + 33→0 regressions. **The money figure.** |
| 5.3 | Cross-Strategy Comparison Matrix | 5.7 | 4 tasks × 3 strategies × 2 rounds, holes marked as holes. |
| 5.4 | Recovery Cost by Strategy | 5.7 | Token cost per attempt vs. outcome (D8). |
| 6.1 | The Recovery Ladder | 6.6 | L0–L2 evaluated, L3–L7 as future work. |

**Replaces from Ch 3:** Fig 3.1 (duplicate box, D9-11) and Fig 3.3 (double
paste, D9-12) get redrawn in the same pass.

### Table manifest

| ID | Title | Section |
| --- | --- | --- |
| 4.1 | Task Selection — 20 Pilot Instances | 4.4 |
| 4.2 | Model and Access Configuration | 4.5 |
| 4.3 | Recovery Strategy Definitions | 4.11–4.13 |
| 4.4 | Outcome Categories | 4.14 |
| 5.1 | Baseline Results, All 20 Tasks | 5.1 |
| 5.2 | Round 1 Recovery Outcomes | 5.5 |
| 5.3 | Round 2 Recovery Outcomes | 5.6 |
| 5.4 | Sub-Test Scores by Condition | 5.7 |
| 5.5 | Threats to Validity Summary | 5.12 |

---

## 6. draw.io workflow

### Install fix needed first

The repo was cloned one level too deep. Claude Code looks for
`~/.claude/skills/drawio-skill/SKILL.md`, but it is currently at
`~/.claude/skills/drawio-skill/skills/drawio-skill/SKILL.md`, so the skill will
not be discovered by name.

```
# move the inner skill folder up one level
mv ~/.claude/skills/drawio-skill ~/.claude/skills/_drawio-tmp
mv ~/.claude/skills/_drawio-tmp/skills/drawio-skill ~/.claude/skills/drawio-skill
rm -rf ~/.claude/skills/_drawio-tmp
```

Verified working either way — scripts run fine by absolute path.

### Toolchain status

```
python 3.14.5   ok
drawio          /opt/homebrew/bin/drawio      ✅
graphviz (dot)  /opt/homebrew/bin/dot         ✅
capabilities    xml_generation · semantic_ir · sync
                native_export · auto_layout   all true
```

### Approach per figure

- **Fig 4.4, 4.5, 4.6, 5.3** — hand-authored XML. Precise styling matters and
  node counts are low.
- **Fig 4.1, 4.3** — hand-authored XML with explicit swimlanes.
- **Fig 5.1, 5.2, 5.4** — data figures. Generate from the master table so the
  numbers cannot drift from Chapter 5's prose.
- **Fig 6.1** — ladder layout, hand-authored.
- **Fig 3.1 redraw** — `autolayout.py` if it exceeds 15 nodes.

### Conventions to fix before drawing

One style file applied to all 11, so the thesis looks like one document:

- Greyscale-safe (examiners print in B&W) — never encode meaning in colour alone
- One font, one size scale
- Evaluated vs. not-evaluated distinguished by **line style**, not colour
- Every figure captioned `Figure N.M — Title` and referenced in the body text
- Export at 300 dpi PNG; keep the `.drawio` alongside for later edits

---

## 7. Source-of-truth data

Chapters must cite these, not re-derive them. All verified from the repo.

**Baseline (20 tasks):** 12 PASS · 4 genuine logic FAIL · 4 malformed-patch ERROR

**The 4 genuine logic failures:**
`astropy__astropy-7746` · `django__django-11019` · `django__django-11283` · `django__django-11564`

**Round 1 evaluated cells:** Blind Retry 2/4 · Reflection-only 1/4 · Diagnose+Revise 4/4
**Round 2 evaluated cells:** Blind Retry 3/4 · Reflection-only 3/4 · Diagnose+Revise 3/4
**Total:** 16 of 24 evaluated, 8 dropped

**Sub-test scores (FAIL_TO_PASS):**

| Task | Baseline | All three strategies |
| --- | --- | --- |
| astropy-7746 | 0/1 | 0/1 |
| django-11019 | 0/16 (+33 broken) | 6/16 (0 broken) |
| django-11283 | 0/1 | 0/1 (Diagnose: +8 broken) |
| django-11564 | 0/2 | 0/2 |

**Config:** `gemini-3.6-flash` · google-genai SDK · temperature **unset** ·
top_p **unset** · seed **unset** · 60 s throttle · `princeton-nlp/SWE-bench_Lite`
test split · oracle file localization from gold patch · single file per prompt

**Excluded:** `astropy-14182` (RECITATION safety block) ·
`django-11039`, `django-11583` (resolved under old tooling, not retrofitted) ·
`django-11620` (recovered by all three — the one success)

---

## 8. Future work bank (for §6.6)

Everything descoped in §0, written up as planned extensions:

1. **Throughput** — migrate to an OpenAI-compatible endpoint with 40+ RPM
   (NVIDIA NIM free tier, no card) to remove the ~20 req/day ceiling that
   constrained this pilot
2. **Statistical power** — n≥5 runs per condition per task with temperature and
   seed pinned; report means and variance
3. **Sampling** — stratified random draw across all 11 repositories rather than
   the first 20 alphabetically
4. **Benchmark validity** — re-run on SWE-bench Verified (human-screened)
5. **Multi-model** — Qwen / DeepSeek / Llama families; turns "single model" from
   a limitation into a generalizability claim
6. **Strategy ladder** — L3 constrained decoding, L4 tool-grounded loop,
   L5 checkpoint/rollback, L6 circuit breaker, L7 failure memory
7. **Cost-aware metrics** — Verified Recovery Rate reported with recovery effort

---

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| Examiner asks "why is this an agent?" | Renamed in §1. Answer prepared. |
| Examiner checks the 4 tasks are solvable | D6 audit in §5.12; state it before being asked. |
| "Why only 20 tasks?" | D3 quota, disclosed in §4.5 — a real constraint, honestly stated. |
| "Why do the tables have gaps?" | D2, reported as an outcome category rather than hidden. |
| Reference list not finished in time | Start it in Session 1 as background work, not Session 6. |
| Figures drift from prose numbers | Generate data figures from the master table (§6). |

---

## 10. Repository layout

The writing phase's material moved under `reports/` on 2026-09-26, so the project
root holds documents and the two working directories, nothing else.

```
Nakul research paper/
├── Self.docx                         the submitted dissertation — FINAL, never edited
├── Self.pdf · MTech_Dissertation_Report.pdf
├── MTech_Weekly_Progress_Report_Format.docx   department template — never edited
├── PLAN.md                           this file
│
├── reports/
│   ├── data/                         the writing phase: 20 build scripts +
│   │                                 master_table.md · config.md ·
│   │                                 rq_canonical.md · outcome_taxonomy.md
│   ├── figures/                      11 .drawio sources + figures/png/ exports
│   ├── fill_report.py                weekly progress report generator
│   ├── week05.json                   one file per week
│   └── MTech_Weekly_Progress_Report_Week05.docx
│
├── recovery-bench/                   the implementation artefact (see §11)
└── Dissertation-main/                the original experiment — read-only provenance
```

**A path note that matters if a script is ever re-run.** Every script in
`reports/data/` derived the project root as its own parent directory. After the
move that would have resolved to `reports/`, so `Self.docx` would not have been
found. They now carry two anchors — `REPORTS` for `figures/`, `ROOT` for the
project root — and `build_master_table.py` was re-run to confirm it: 42 records,
**byte-identical output**, so the move introduced no drift.

The prose strings inside `write_ch*.py` still say `data/config.md` in a few
places. That is deliberate: those scripts are the provenance of the submitted
text, and editing their content would make them no longer match what produced
`Self.docx`. Only path anchors and usage comments were touched.

---

## 11. Current phase — implementation

The document is done. Work moved to `recovery-bench/`, which builds the §8
future-work items as a real program. Full rationale in
`recovery-bench/docs/DECISIONS.md` (D0–D28); the build order is
`ARCHITECTURE.md` §6.

| Step | State |
| --- | --- |
| 0 · archive provenance, freeze the task set | ✅ 495 files checksum-verified; 300 instances, revision-pinned |
| 1 · workspaces, types, config schema, `doctor` | ✅ every gate passes offline |
| 2 · `edits/` + tests | ✅ 138 tests |
| 3 · `analysis/` + `replay` | ✅ Chapter 5 regenerates byte-identically, offline |
| 4 · providers + budget ledger | ✅ 248 tests; ceiling enforced before dispatch, all 5 keys live |
| 5 · strategies + task layer | ✅ 319 tests; prompts byte-verified against the originals, one real cell APPLIED |
| 6 · sweep | ✅ 374 tests; 1,308 cells enumerated, projected, run and verified — no holes |
| 7 · dashboard | ✅ 433 tests + 127 palette checks; six views over the committed rows, no charting library |
| 8 · extensions | next — `l3_constrained`, `l4_tool_grounded` |

Three constraints, decided and fixed: **TypeScript on Bun** (D10), **no Docker
anywhere** (D6), **conditions live in config, not scripts** (D9).

### Findings that post-date the submitted document

Recorded here because they are the reason the implementation was worth building,
and because a viva question may reach them. **None of them change `Self.docx`.**

1. **The format-class finding, quantified** (D14). 61 real model patches survive
   in `Dissertation-main`, inside the `predictions*.json` files — the only trace
   left of what the models wrote, since `attempts/` is gone. Validated
   structurally: **model-written diffs 30/51 clean (58.8%), programmatically
   generated 10/10 (100%)**. 16 count mismatches, 6 with no file header at all.
   Measured offline, no API call.

2. **The mechanism is not what the prose implies** (D13). `git apply` *forgives*
   a wrong hunk start line — it rescans for the context. What it refuses is an
   inconsistent hunk length count and misquoted source text. So the decisive
   weakness is reproducing surrounding source exactly, not line arithmetic in
   general. SEARCH/REPLACE removes both defects at once, which is a stronger
   account of the same result.

3. **Three defects in the original edit applier**, each now a regression test:
   the non-greedy regex broke on `=======` inside a REPLACE body; `"".count()`
   reported an empty SEARCH as *ambiguous*; an unterminated block was
   indistinguishable from no blocks at all.

4. **Twenty-two evaluations were invisible to the original tables** (D15). The
   archive holds 95 evaluated instance directories but only 73 `report.json`
   files. The SWE-bench harness raises before writing its report when `git apply`
   refuses the patch, and `build_master_table.py` globs for `report.json` — so
   every cell whose patch never applied vanished from the analysis. This is the
   "a failed cell leaves no record" defect, found in the project's own data.

5. **The logic/format split is now derived rather than typed** (D16). In
   `build_master_table.py` it is a hand-written dict, and the four format-class
   rows of Table A are a literal — it could not derive them, because an apply
   failure produces no report to read. Recomputing the split from outcomes gives
   **exactly the hand-written answer**: all 8 pool tasks, both classes, no
   discrepancy. The submitted numbers are correct; what is new is that something
   now checks them. `master_table.md` regenerates byte-for-byte from an
   independent implementation, and every Chapter 5 figure dataset is pinned
   against the literals in `make_figures.py`.

6. **Four defects found by making the first live call** (D17–D20). Building the
   provider layer meant calling the endpoints, which invalidated the gate
   written to measure them. `doctor --live` was reporting two models as `ok`
   having produced no output at all, and `nemotron_ultra` at **94,094
   tokens/second**; Gemini had never been probed. Separately, NVIDIA answers
   HTTP **200 with an empty body** under concurrency rather than a 429 — which,
   reaching a sweep, would have been recorded as the model producing nothing.
   None of this is visible without spending a token, which is why it survived
   three steps of offline work.

7. **`thinking: false` was never sent on the wire** (D19). The config has
   declared it since step 1; the request never mentioned it, so every call —
   this project's and the original study's — ran with the vendor default,
   thinking **on**. The control is `chat_template_kwargs.enable_thinking`.
   Where honoured it cuts cost 16–19x (`nemotron_ultra`: 38 completion tokens
   to answer "ok", versus 2). **`muse_30b` does not honour it** — reasoning
   falls from 313 characters to 120 but never to zero, so an arm configured
   `thinking: false` against that model is not a no-thinking arm. This is the
   `8_000_000` string defect again, in a different field: declared, believed,
   never transmitted.

8. **The reimplementation's prompts are byte-verified against the originals**
   (step 5). The three condition prompts are not retyped: they are extracted
   from the original Python into `data/original_prompts.json` with the SHA-256
   of each source file, and a test proves each committed template is a verbatim
   substring of the script it came from. A second test proves the *only*
   difference between the Reflection-only and Diagnose+Revise templates is the
   `{real_evidence}` placeholder — which is the study's manipulated variable,
   now pinned rather than asserted.

9. **Diagnose+Revise cannot always be honoured without Docker, so provenance
   became data** (D22). The condition is defined by receiving real test output;
   this pipeline cannot run tests. Rather than quietly substituting `git`'s
   apply error and still calling it Diagnose+Revise — which would make the
   condition mean two different things depending on the task — every cell
   records `evidenceSource` and `comparableToChapter5`. A cell with no evidence
   is **refused and recorded**, not silently downgraded.

10. **Oracle localisation costs nothing** (D21). The original picks the target
    file from the gold patch and takes the first — declared method, and the
    dissertation says so. Measured: **all 300 SWE-bench Lite gold patches touch
    exactly one file**, so nothing is lost to `[0]`. The single-file constraint
    belongs to the benchmark, not to the study.

11. **The committed grid exceeded its own budget by 178%, and nothing had
    checked** (D25). `budget.estimate_before_run: true` sat in the config from
    step 1 with nothing implementing it. Implemented, it found the enabled grid
    needs **14.56M tokens against an 8M ceiling** — `a5_format_at_scale` alone
    exceeds the whole allowance, because it runs 60 stratified tasks through
    whole-file context in two formats three times each. Same defect as the
    `8_000_000` string: a declared ceiling never compared against the declared
    grid. The sweep now refuses to start and names the arms responsible.

12. **Two of the three recovery conditions were structurally unreachable**
    (D26). The first live sweep refused **16 of 24 cells**: Reflection-only and
    Diagnose+Revise need a previous attempt, and the grid had no round 0. In the
    original that prior was the baseline — `day8_test` is R0 and every
    condition's R1 reflected on it. Step 5's decision to make the baseline
    replay-only was therefore reversed: it now runs, with the study's own
    first-attempt prompts keyed by edit format, one baseline shared per group.
    The grid grew from 1,224 cells to 1,308.

13. **Diagnose+Revise is unrunnable whenever the prior attempt applied cleanly.**
    A sharper statement of D22's limit, found by running it: the condition needs
    real evidence of a failure, an apply error only exists when the patch was
    rejected, and test output needs Docker. So a cleanly-applying baseline leaves
    nothing to diagnose and the cell is refused and recorded rather than
    downgraded. This is a permanent consequence of D6, not a gap.

15. **A validator that could not fail, believed for a day** (D31). The
    dashboard's contrast gate reported 82 passing checks while reading the
    dark-mode block twice and light mode never — its selector string carried its
    own brace, so the scan for the opening brace landed on the following block.
    Both themes pass, so the duplicate run stayed green. It was hiding five
    genuine light-mode failures. This is the third instance of one shape in this
    project: `max_tokens` parsed as a string (D5), `thinking: false` never
    transmitted (D19), and now a gate checking one theme twice — each a declared
    safeguard with nothing behind it.

16. **The dashboard's first build never stated its finding** (D32, D33). It
    rendered `3/3` and `0/4` under four-word labels and spoke in the project's
    private vocabulary throughout — cell, lineage, arm, format-class, instrument
    limit. It also drew a single bar while claiming a comparison, and put "23 set
    aside" in 11px grey when those 23 were three-quarters of everything in view.
    The last is D18's category error reappearing at the presentation layer:
    excluding instrument limits from the arithmetic was necessary and not
    sufficient, because the exclusion has to be as visible as the number it
    changes. The sentences are now derived from the committed figures, so a claim
    cannot drift from the number beside it.

17. **Two corrections to this plan's own evidence.** D0 claimed the code was never
   version-controlled — wrong, the check ran against the enclosing home-directory
   repo; the code is at `Lagadnakul/Dissertation`. And SWE-bench Lite spans **12**
   repositories, not 11 — flask was missing, with 3 instances, which is exactly
   what the `per_repo_min: 3` floor was set against.

---

## 12. Next action

Step 8 — `l3_constrained` and `l4_tool_grounded`. Both are declared in
`configs/base.yaml` and neither is implemented; they are the two recovery
conditions the dissertation names as future work and the only part of the
declared strategy registry still unbuilt.

What exists to build on: the strategy seam from step 5 means a new condition is a
prompt template plus a `StrategyContext` consumer, and `runCell` already
guarantees every cell terminates in a recorded row whatever the condition does.
The grid, the budget ledger and the dashboard all pick up a new strategy without
modification — the dashboard will break its own `tsc` if a new *outcome* is
added, which is the intended behaviour, but a new strategy is just another row.

Also outstanding, smaller: `docs/LIMITATIONS.md` is referenced from several
documents and has never been written.
