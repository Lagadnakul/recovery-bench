# Experimental Configuration — Source of Truth

> Every configuration value quoted in Chapter 4 must match this file.
> Each row records what the code **actually does**, verified against the scripts in
> `Dissertation-main/06_Methodology/code/`. Where a setting was never specified, the
> row says so explicitly rather than reporting a default that was never chosen.

---

## 1. Model and generation settings

| Setting | Value | Verified in |
|---|---|---|
| Model identifier | `gemini-3.6-flash` | 17 occurrences of `model="gemini-3.6-flash"` across `day*.py` |
| SDK | `google-genai` (`from google import genai`) | all generation scripts |
| Client construction | `genai.Client(api_key=API_KEY)` | `day15_step1_round2_all_conditions.py:*` |
| API key source | `.env` via `load_dotenv(find_dotenv())` | all generation scripts |
| Access tier | Google AI Studio free tier | `Day7_README.md` (quota error transcript) |
| **Temperature** | **not set** — SDK default applied implicitly | no `temperature=` anywhere in the 30 scripts |
| **Top-p / top-k** | **not set** | no `top_p=` / `top_k=` anywhere |
| **Random seed** | **not set** | no seed parameter anywhere |
| **`GenerateContentConfig`** | **never constructed** | no occurrence in any script |
| Max output tokens | not set | — |
| Calls per cell | 1 (single `generate_content`, no internal loop) | all generation scripts |

**Methodological consequence.** Because no temperature or seed was fixed, each
generation is a single draw from an unpinned sampling distribution. Repeating a run
is not guaranteed to reproduce a cell. Chapter 4 must state this as a limitation and
Chapter 5 must not describe any single-run outcome as deterministic. The observed
stability on `django__django-11019` (identical 6/16 across six independent cells) is
therefore an *empirical* observation, not a guaranteed property — and, because it
held across six unpinned draws, it is arguably stronger evidence than a seeded run
would have been.

---

## 2. Benchmark and evaluation harness

| Setting | Value | Verified in |
|---|---|---|
| Dataset | `SWE-bench/SWE-bench_Lite` | `--dataset_name` in the run commands |
| Dataset loader | HuggingFace `datasets.load_dataset` | `from datasets import load_dataset` |
| Tasks sampled | first 20 instances | `day7_step1_generate_full_pilot.py` |
| Repositories covered | 2 — `astropy`, `django` | Table A of `master_table.md` |
| Evaluation harness | `python -m swebench.harness.run_evaluation` | `Day7_README.md` |
| Parallelism | `--max_workers 2` | run commands |
| Container runtime | Docker Desktop with WSL 2 integration | `Day5`, `Day7` READMEs |
| Host platform | Windows + WSL 2 | `Day5` README (CRLF fix) |
| Success criterion | SWE-bench `resolved` — all FAIL_TO_PASS pass **and** no PASS_TO_PASS regressions | `report.json` schema |

---

## 3. Task context construction

| Setting | Value | Verified in |
|---|---|---|
| File localisation | **Oracle** — target path parsed from the gold patch | `re.findall(r"^--- a/(.+)$", gold_patch, re.MULTILINE)` |
| File retrieval | raw GitHub fetch at `task["base_commit"]` | `fetch_file(task["repo"], task["base_commit"], file_path)` |
| Context supplied | the **entire** target file, verbatim | `{real_content}` interpolated whole into the prompt |
| Retrieval / search step | none | no retrieval code in any script |
| Tool use during generation | none | no function-calling or tool declarations |
| Repository navigation | none | single file only |

**Methodological consequence.** Oracle localisation removes the file-identification
sub-problem entirely. This is a deliberate and defensible control — it isolates the
repair step — but it means the system evaluated here is **not** an autonomous agent in
the sense used by SWE-agent or OpenHands. Chapter 4 should name it precisely:
*single-shot, oracle-localised, single-file patch generation*. Chapter 1's framing
should be aligned to match.

### Context cost

| Task | Target file | Characters | Approx. tokens |
|---|---|---|---|
| `astropy__astropy-7746` | `astropy/wcs/wcs.py` | 124,394 | ≈ 31,100 |

Every call re-sends the whole file. With no caching, a three-condition sweep over one
task re-transmits the same file three times.

---

## 4. Patch representation — the retrofit

Two representations were used. They are **not** comparable and must never be pooled.

| | Phase 1 (superseded) | Phase 2 (retrofitted) |
|---|---|---|
| Model asked to emit | a unified diff | `<<<<<<< SEARCH / ======= / >>>>>>> REPLACE` blocks |
| Diff construction | by the model | by `difflib.unified_diff` on the edited file |
| Applied in | `day9`, `day10` runs | `day11b`, `day12`, `day15` runs |
| Failure mode | malformed hunk headers, wrong line offsets | search string absent or ambiguous |

Applicator logic (`apply_search_replace`), verbatim behaviour:

| Occurrences of search string | Status returned | Outcome |
|---|---|---|
| exactly 1 | `ok` | replacement applied |
| 0 | `search_not_found` | **prediction discarded** |
| more than 1 | `search_ambiguous` | **prediction discarded** |
| no blocks parsed | `no_blocks_found` | **prediction discarded** |

**Methodological consequence — the missing-cell mechanism.** A discarded prediction is
printed to the console and then dropped; nothing is appended to the predictions file
and no `report.json` is ever produced. The cell simply does not exist. This is one of
two mechanisms producing the 8 unevaluated cells in Table B of `master_table.md`; the
other is the daily quota below. Chapter 4 §4.14 must describe this, and Chapter 5 must
not treat an absent cell as a null result.

---

## 5. Rate limiting and quota

| Setting | Value | Verified in |
|---|---|---|
| Inter-call delay | `time.sleep(60)` — 13 occurrences | generation scripts |
| Secondary delay | `time.sleep(3)` — 7 occurrences | evidence-collection scripts |
| Free-tier daily cap | **20 requests/day** for this model | `429 RESOURCE_EXHAUSTED … quotaValue: '20'` in `Day7_README.md` |
| Calls for one complete sweep | 24 (8 pool tasks × 3 conditions) | derived |

**This is the binding constraint on the entire study.** One complete single-round
sweep of the failure pool requires 24 calls against a 20-call daily ceiling. It is
therefore arithmetically impossible to evaluate every cell in a day. The consequences
are visible verbatim in `master_results_table.md`, which records
`"skipped to save quota"` on four cells. Chapter 4 should present this as a stated
resource constraint of a zero-budget study, and Chapter 5 should report coverage
(16/24) alongside every consistency claim. It is a limitation, not an error — but it
must be disclosed, because an examiner reading the logs will find it.

---

## 6. Evidence supplied to Diagnose+Revise

| Setting | Value | Verified in |
|---|---|---|
| Evidence source | SWE-bench `test_output.txt` from the failed run | `day11_step0`, `day15_step0` |
| Largest raw log observed | ≈ 1.7 MB | `logs/run_evaluation/` |
| Truncation rule | `if len(evidence) > 3000: evidence = "...[earlier output trimmed]...\n" + evidence[-3000:]` | `day15_step0_collect_round2_evidence.py:48-49` |
| Portion retained | **last 3,000 characters** | — |

For a 1.7 MB log this retains roughly **0.2%** of the output, and specifically the
*tail*. Python tracebacks place the exception type and message at the end, so the tail
is a defensible choice — but the assertion diff and the earlier failures in a
multi-test run are discarded. Chapter 5 should note this when interpreting why
execution-grounded diagnosis did not outperform blind retry: the condition was tested
with a deliberately small evidence window.

---

## 7. Information available to each condition

This is the independent variable of the study. It is the content of Figure 4.4.

| Condition | Issue text | Full target file | Own previous patch | Own self-critique | Execution evidence |
|---|---|---|---|---|---|
| **Blind Retry** | yes | yes | no | no | no |
| **Reflection-only** | yes | yes | yes | yes | no |
| **Diagnose+Revise** | yes | yes | yes | yes | yes (3,000-char tail) |

Approximate input cost, taking Blind Retry as the unit: Reflection-only ≈ 2×,
Diagnose+Revise ≈ 3×. Chapter 5's cost discussion should pair every effectiveness
statement with this ratio — a strategy that costs three times as much and returns an
identical sub-test score is a negative result worth stating plainly.

---

## 8. Timeline

| Item | Value | Source |
|---|---|---|
| Day 1 | 6 July 2026 | `01_Research_Diary/Day_01.md` |
| Day 2 | 7 July 2026 | `01_Research_Diary/Day_02.md` |
| Day 4 | 9 July 2026 | `01_Research_Diary/Day-04.md` |
| Day 14–15 | 14 July 2026 | `Day_15.md`, `16-july.md` |
| Implementation window | **≈ 6–20 July 2026** | derived from the diary |

> ⚠️ **Open item for Nakul.** The file modification times in the repository all read
> 31 August 2026, which is the archive extraction date, not the run date. The window
> above is inferred from the research diary. Before Chapter 4 is finalised, confirm the
> per-run dates from the diary and replace this row with exact values.

---

## 9. Configuration table for Chapter 4

Table 4.1 in the thesis should reproduce the following condensed form.

| Parameter | Value |
|---|---|
| Model | `gemini-3.6-flash` (Google AI Studio, free tier) |
| Temperature / top-p / seed | not specified (SDK defaults) |
| Calls per experimental cell | 1 |
| Benchmark | SWE-bench Lite, first 20 instances |
| Repositories | astropy, django |
| File localisation | oracle (from gold patch metadata) |
| Context window supplied | complete target file |
| Patch representation | SEARCH/REPLACE blocks + `difflib.unified_diff` |
| Evaluation harness | `swebench.harness.run_evaluation`, `--max_workers 2` |
| Container runtime | Docker Desktop, WSL 2 |
| Inter-request delay | 60 s |
| Daily request ceiling | 20 (free tier) |
| Diagnostic evidence window | final 3,000 characters of the test log |
| Recovery rounds | 2 |
| Failure pool | 8 tasks |
