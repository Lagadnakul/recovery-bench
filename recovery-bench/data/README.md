# data/

| Path | Committed | What it is |
| --- | --- | --- |
| `swebench_lite.jsonl` | ✅ yes | the frozen task set — 300 instances, one JSON object per line, sorted by `instance_id` |
| `swebench_lite.meta.json` | ✅ yes | the upstream revision sha, row count, field list, per-repo counts, export timestamp |
| `legacy_patch_audit.json` | ✅ yes | the 61 archived model patches, validated structurally — 30/51 vs 10/10 (D14) |
| `replay_rows.json` | ✅ yes | all 51 archived cells, including the 22 that produce no `report.json` (D15) |
| `chapter5_figures.json` | ✅ yes | the datasets behind figures 5.1–5.4, derived rather than typed (D16) |
| `cache/` | ❌ no | fetched repo source files, keyed by `repo@commit:path` |
| `runs/` | ❌ no | `<date>_<config>/` — one directory per sweep, the cell ledger and row output |

## Why the task set is committed

`swebench_lite.jsonl` is 3.5M of text and it is **the independent variable of
the whole study**. Committing it freezes the exact 300 problems to one file
whose hash can be checked, instead of re-fetching a dataset that may have been
revised upstream between runs. `swebench_lite.meta.json` records the revision it
came from:

```
princeton-nlp/SWE-bench_Lite  default/test
revision 6ec7bb89b9342f664a54a6e0a6ea6501d3437cc2
```

Regenerate with:

```sh
bun scripts/export_dataset.ts
```

The script refuses to write unless upstream reports exactly 300 rows and all
nine required fields are present, so a silent upstream change becomes a loud
failure.

## Composition

300 instances across **12 repositories** — not 11, which is what the design docs
said before this export measured it:

| n | repo |
| --- | --- |
| 114 | django/django |
| 77 | sympy/sympy |
| 23 | matplotlib/matplotlib |
| 23 | scikit-learn/scikit-learn |
| 17 | pytest-dev/pytest |
| 16 | sphinx-doc/sphinx |
| 6 | astropy/astropy |
| 6 | psf/requests |
| 6 | pylint-dev/pylint |
| 5 | pydata/xarray |
| 4 | mwaskom/seaborn |
| 3 | pallets/flask |

This distribution is why stratified sampling (§8.3) matters: django alone is 38%
of the benchmark, and Nakul's original 20-task pilot drew only django and
astropy. A uniform random 60 would still be django-dominated. The `≥3 per repo`
floor in `configs/base.yaml` is set against the smallest repo here — flask, with
3 — so every repo is representable without oversampling.


## Why the derived files are committed

`archive/legacy_runs/` and `archive/legacy_predictions/` are gitignored — every
file in them already exists upstream at `Lagadnakul/Dissertation@c8872d0`, so the
local copy is convenience rather than record. That makes anything computed from
them **lost unless it is committed**.

So the three derived files above are checked in, and the test suite reads them
directly. On a machine with no archive the numbers are still verified; where the
archive *is* present, the tests additionally re-derive everything and assert it
still matches, which is what catches a regression silently changing a published
figure.

```sh
bun run audit-legacy    # -> legacy_patch_audit.json
bun run replay          # -> replay_rows.json
bun run report          # -> chapter5_figures.json, and checks master_table.md
```

`bun run report` regenerates `reports/data/master_table.md` and compares it with
the committed copy. It is the oracle for the whole analysis: an independent
implementation reproducing the submitted tables byte-for-byte, or saying loudly
that it cannot.

## `ledger.jsonl` — not committed, deliberately

Append-only, one JSON record per model call: provider, model, cell key, prompt /
completion / reasoning tokens, latency, HTTP status, retries, outcome. Written
by `packages/pipeline/providers/budget.ts`.

It is **gitignored**, unlike the other derived files here. The rest cannot be
rebuilt without the archive payload, so committing them is the only way to keep
them. The ledger is the opposite: it is per-machine spend state. Committing it
would make a fresh clone believe it had already spent this machine's diagnostic
tokens, and every run would conflict with every other.

It carries counts only — no key names, no key values, no prompt text, no
completion text. `doctor` reads it to report remaining headroom, and
`BudgetLedger.load()` replays it so a resumed run does not restart its budget at
zero. A torn final line, the expected result of a crash mid-append, is skipped
and counted rather than treated as fatal.
