# Archive manifest

Provenance record for the numbers reported in the submitted dissertation.
**Read-only. Nothing in `recovery-bench/` reads this directory at runtime** (D0).

Created by build-order step 0 on 2026-09-26.

## Source — and why the payload is not committed

Everything here was copied out of the local folder:

```
Nakul research paper/Dissertation-main/06_Methodology/code/
```

which was **left in place and unmodified** — it is the submitted record.

All 495 files also exist upstream, which step 0 confirmed by counting the remote
tree:

| Artifact | here | `Lagadnakul/Dissertation` |
| --- | --- | --- |
| `day*.py` scripts | 30 | 30 |
| `report.json` | 73 | 73 |
| `run.json` | 18 | 18 |
| `test_output.txt` | 73 | 73 |
| `predictions*.json` | 12 | 20 paths matching `predictions` |
| paths under `logs/` | 427 | 427 |

So the **canonical provenance record is an upstream commit, not this copy**:

```
Lagadnakul/Dissertation @ c8872d070fb0b098394796dfbc68bcf67c3bd957
2026-08-31T09:00:57Z
```

An immutable sha beats a duplicate. The four `legacy_*/` payload directories are
therefore **gitignored**; this manifest and `SHA256SUMS` are committed, so the
copy can be rebuilt and verified but never inflates the repository.

To rebuild it on another machine:

> **The recipe below replaced an earlier one that no longer works.** Corrected
> 24 October 2026. `Lagadnakul/Dissertation` has since been **replaced** —
> commit `236484c` ("Replace the repository with the dissertation, its evidence
> and the implementation") wiped `06_Methodology/` from `main`, which now holds a
> copy of this project instead. `main` is two commits deep and does **not**
> contain the payload, so the old `--depth 1` clone silently restored the wrong
> tree. `c8872d07` survives only as a **dangling commit**: the GitHub API still
> resolves it, and `git fetch origin <sha>` still retrieves it, but no branch or
> tag points at it.
>
> **This is a live risk to the dissertation's evidence chain.** Unreachable
> objects are eligible for garbage collection. Until a tag or branch points at
> `c8872d07`, the provenance baseline for every number in Chapters 4 and 5 can
> disappear without warning:
>
> ```sh
> gh api repos/Lagadnakul/Dissertation/git/refs -f ref=refs/tags/provenance-phase1 >        -f sha=c8872d070fb0b098394796dfbc68bcf67c3bd957
> ```

```sh
# 1. Fetch the dangling provenance commit by sha. A plain clone will NOT get it.
#    core.longpaths is required: the deepest log paths exceed Windows MAX_PATH.
mkdir /d/_diss && cd /d/_diss && git init
git config core.longpaths true && git config core.autocrlf false
git remote add origin https://github.com/Lagadnakul/Dissertation.git
git fetch origin c8872d070fb0b098394796dfbc68bcf67c3bd957
git checkout --detach FETCH_HEAD        # 495 files under 06_Methodology/code

# 2. Re-run the step 0 copy into archive/, then gzip the 73 test outputs:
#    legacy_runs/        <- logs/run_evaluation/.        (427)
#    legacy_predictions/ <- predictions*.json            (12)
#    legacy_code/        <- day*.py + Day7_README.md     (31)
#    legacy_aggregates/  <- everything else at top level (25)
find legacy_runs -name test_output.txt -exec gzip -9 -n {} +

# 3. Verify. SHA256SUMS must be LF — with CRLF, every filename gains a  and
#    all 495 checks fail with "No such file or directory".
cd archive && sha256sum -c SHA256SUMS --quiet
```

**Expected verification result: 422 of 495 match; the 73 `test_output.txt.gz`
do not.** That is correct, not corruption. gzip's compressed bytes depend on the
zlib build, so the `.gz` files cannot be byte-reproduced on a different machine —
neither `gzip -9` nor `gzip -9 -n` reproduces the recorded hashes. What is
verifiable, and what was checked on restore, is that all 73 **decompress to bytes
identical to the provenance commit**:

```sh
gunzip -c legacy_runs/<run>/<cond>/<inst>/test_output.txt.gz | sha256sum
# equals sha256sum of 06_Methodology/code/logs/run_evaluation/<run>/<cond>/<inst>/test_output.txt
```

Nothing in `packages/` reads the `.gz` files; the archive layer reads
`run_instance.log` and `report.json`. The compression is for storage only.

`tests/promptOracle.test.ts` additionally needs the original tree itself at
`../Dissertation-main/06_Methodology/code` — it hashes four `day*.py` files to
prove the committed prompt templates still match the Python they came from. That
directory is gitignored for the same reason the payload is.

## What is here

| Directory | Files | Size | Contents |
| --- | --- | --- | --- |
| `legacy_runs/` | 427 | 8.6M | the SWE-bench harness output tree, `logs/run_evaluation/` verbatim: 73 `report.json`, 18 `run.json`, 95 `patch.diff`, 95 `run_instance.log`, 73 `eval.sh`, 73 `test_output.txt.gz` |
| `legacy_predictions/` | 12 | 128K | `predictions*.json` — the **model outputs**, one `model_patch` per instance |
| `legacy_aggregates/` | 25 | 352K | `master_results.json`, `failure_pool.json`, `apply_log_v2.json`, `skipped_pilot20.json`, `master_results_table.md`, 18 per-run SWE-bench eval summaries, the 2 original figures |
| `legacy_code/` | 31 | 152K | the 30 `day*_step*.py` generation scripts + `Day7_README.md` |

`test_output.txt` was gzipped (`gzip -9`), taking the tree from 92M to 8.6M.
Nothing else was altered. `SHA256SUMS` covers all 495 files and verifies clean.

```
shasum -a 256 -c SHA256SUMS --quiet     # → silence means all 495 match
```

## The 18 archived runs

| Run id | Condition | Resolved |
| --- | --- | --- |
| `day4_test`, `day4_test2` | baseline attempt 1 | *(no per-instance reports)* |
| `day5_test` | baseline attempt 2 | 0/1 |
| `day5_wsl_test` | baseline attempt 2 (WSL) | 1/1 |
| `day6_test` | blind retry attempt 1 | 3/3 |
| `day6_test2` | blind retry attempt 1 | 4/4 |
| `day7_test` | blind retry attempt 1 | 10/11 |
| `day7_test2` | blind retry attempt 1 | 10/11 |
| `day8_test` | blind retry attempt 1 | 12/16 |
| `day9_test` | blind retry attempt 2 | 2/4 |
| `day10_test` | reflection-only attempt 3 | 0/3 |
| `day11_test` | diagnose-revise attempt 4 | *(no per-instance reports)* |
| `day11b_tes` | diagnose-revise, SEARCH/REPLACE | 1/5 |
| `day12_blindretry_test` | blind retry, SEARCH/REPLACE | 1/3 |
| `day12_reflection_test` | reflection-only, SEARCH/REPLACE | 1/2 |
| `day15_blindretry` | blind retry, round 2 | 0/3 |
| `day15_diagnose` | diagnose-revise, round 2 | 0/3 |
| `day15_reflection` | reflection, round 2 | 0/3 |

**73 `report.json` rows in total; 45 resolved, 28 unresolved; 19 distinct
instances test-verified.** Every one of these is a `Row<"test">` — the only
test-verified data the project will ever hold, since D6 removes Docker.

`day4_test`, `day4_test2` and `day11_test` produced a run-level summary but no
per-instance report directories; their numbers survive only in
`legacy_aggregates/`.

## Cross-checks run at archive time

| Check | Result |
| --- | --- |
| every predicted `instance_id` exists in the frozen dataset | ✅ 20/20 |
| every test-verified `instance_id` exists in the frozen dataset | ✅ 19/19 |
| duplicate `instance_id` within the dataset | ✅ none |
| `SHA256SUMS` verification | ✅ 495/495 |

## Three corrections this step forced on the design docs

1. **`report.json` count.** The docs said 125. That was the count of *all* JSON
   files under `Dissertation-main/` (73 `report.json` + 18 `run.json` + 34 in
   `code/` = 125). The number of `report.json` files is **73**. Corrected in
   `ARCHITECTURE.md`.
2. **Script count.** D0 said 33 scripts. `ls *.py | wc -l` gives **30**.
   Corrected in `DECISIONS.md`.
3. **"Code never version-controlled" — retracted.** D0 cited `git ls-files` over
   `code/` returning 0 tracked files. That check ran against the enclosing
   *home-directory* repo, which tracks nothing at all, so it proved nothing about
   the code. The code is version-controlled upstream. The row is struck through
   in `DECISIONS.md` rather than deleted, so the record shows what was claimed
   and why it was withdrawn.

## What is confirmed lost

`attempts/` was excluded by `.gitignore` and no longer exists.
`day15_step1_round2_all_conditions.py` reads from it, so **the Round-2
Reflection condition cannot be regenerated** — only replayed from the archived
`report.json`.

The `predictions*.json` files partly soften this: they preserve the final
`model_patch` for all 20 touched instances, which is enough to replay the
apply-layer and edit-format analysis. What is gone is the *raw model response*
before patch extraction, and therefore the ability to re-derive a patch from a
transcript. `LIMITATIONS.md` states this in plain words.
