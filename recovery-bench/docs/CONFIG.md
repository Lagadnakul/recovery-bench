# Configuration Schema

Every experimental variable lives in YAML. **No parameter is hardcoded in source.**
That is the rule the original code broke in 17 places, and it is why the grid
below can be read by an examiner without opening a single `.ts` file.

Configs are validated by **zod** and **hashed** — the hash goes into every run
manifest, so a result is always traceable to the exact configuration that
produced it.

YAML keys stay `snake_case`; the zod schema maps them to `camelCase` at the
boundary, so the config file reads as configuration and the TypeScript reads as
TypeScript.

---

## 1. Schema

### `run`

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `name` | string | required | becomes `data/runs/<date>_<name>/` |
| `seed` | number | `20260926` | pinned — the original never set one |
| `resume` | boolean | `true` | continue an existing queue rather than restart |
| `dry_run` | boolean | `false` | enumerate the grid and estimate tokens, make no calls |

### `providers`

| Key | Type | Notes |
| --- | --- | --- |
| `<id>.kind` | `openai_compat` \| `gemini` | two adapters total |
| `<id>.base_url` | string | omitted for `gemini` |
| `<id>.api_key_env` | string \| string[] | **env var names only**, never values; a list enables the key pool |
| `<id>.timeout_s` | number | default `300` |
| `<id>.max_retries` | number | default `4`, exponential backoff on 429/5xx |

### `models`

| Key | Type | Notes |
| --- | --- | --- |
| `<id>.provider` | string | key from `providers` |
| `<id>.model` | string | exact provider model id |
| `<id>.temperature` | number | **pinned** |
| `<id>.top_p` | number | **pinned** |
| `<id>.max_tokens` | number | |
| `<id>.thinking` | boolean | D5 — `false` for all comparison arms |
| `<id>.reasoning_budget` | int \| null | permitted when the model's own `thinking` is true **or** some enabled arm sets `thinking: true` for it (that is how A4 works). A budget nothing ever thinks with is rejected as dead config. |
| `<id>.supports_tools` | boolean | gates L4 |

### `tasks`

| Key | Type | Notes |
| --- | --- | --- |
| `dataset` | string | `princeton-nlp/SWE-bench_Lite`, read from the committed JSONL |
| `split` | string | `test` |
| `selection` | `explicit` \| `stratified` \| `all` | |
| `ids` | string[] | when `selection: explicit` |
| `stratified.n` | number | total tasks drawn |
| `stratified.per_repo_min` | number | fixes `PLAN.md` D5 (12 of 20 were Django) |
| `context.mode` | `whole_file` \| `symbol` | D7 |
| `context.padding_lines` | number | default `50` |

### strategies — *removed from the schema in step 1*

An earlier draft had a top-level `strategies:` list **and** a `strategies:` key on
every grid arm. Two places to say the same thing is exactly the drift the project
exists to avoid, so the top-level list is gone: **the arms are authoritative.**
The legal rung ids are `l0_baseline`, `l1_blind_retry`, `l2_reflection`,
`l2_5_diagnose_revise`, `l3_constrained`, `l4_tool_grounded`, enforced by
`STRATEGY_IDS` in `packages/core/types.ts`.

### `edit`

| Key | Type | Notes |
| --- | --- | --- |
| `formats` | list of `search_replace` \| `unified_diff` | listing both runs the ablation |
| `fuzzy_match` | boolean | default `false` — exact SEARCH matching only. **Diagnosis is always on and is unaffected by this flag:** a failed match is retried with whitespace normalised purely to *classify* it as `search_not_found_whitespace`, never to apply it. Application stays byte-exact. |

### `budget`

| Key | Type | Notes |
| --- | --- | --- |
| `<provider>.max_tokens` | number | hard ceiling; a sweep that cannot finish **refuses to start** |
| `<provider>.max_calls` | number | |

Provider ceilings are **flat sibling keys** (`budget.nvidia.max_tokens`), not
nested under `budget.providers`.

⚠️ **Write `8000000`, never `8_000_000`.** YAML 1.2 has no digit separator, so an
underscored numeral parses as a *string* and a token ceiling silently becomes
meaningless. This was a live defect in `base.yaml`; `doctor` now rejects it and
`tests/config.test.ts` keeps it rejected.
| `estimate_before_run` | boolean | default `true` |
| `stop_on_exhaustion` | `halt` \| `skip_arm` | |

### `verify`

| Key | Type | Notes |
| --- | --- | --- |
| `backend` | `git_apply` | **the only value.** D6 — no Docker, ever |
| `contamination.enabled` | boolean | default `true` |
| `contamination.threshold` | number | similarity vs gold patch, default `0.95` |

### `grid`

The arms. Each arm is a full cross-product; cells are enumerated from it before
any call is made.

| Key | Type |
| --- | --- |
| `<arm>.models` / `.tasks` / `.strategies` / `.edit_formats` / `.thinking` | lists |
| `<arm>.rounds` | number |
| `<arm>.repeats` | number |
| `<arm>.enabled` | boolean |

---

## 2. The grid, written out

Cell identity: `(task, strategy, model, edit_format, thinking, round, repeat)`.

### A1 · replication — *does the submitted result reproduce?*

```
model        gemini-3.6-flash              (gemini_api_key)
tasks        4 failure-pool ids
strategies   blind_retry · reflection · diagnose_revise
edit_format  search_replace
thinking     n/a
rounds       2      repeats  1
```
**4 × 3 × 2 × 1 = 24 cells.** Matches the thesis grid exactly — including the
8 cells it never filled. Those 8 must now come back with a *reason*.

### A2 · workhorse — *variance, with the model held near gemini-flash capability*

```
model        meta/muse-glimmer-30b         (NVIDIA)   thinking off
tasks        4 failure-pool ids
strategies   blind_retry · reflection · diagnose_revise
edit_format  search_replace
rounds       2      repeats  5
```
**4 × 3 × 2 × 5 = 120 cells.** Delivers `PLAN.md` §8.2 — means and variance
instead of a single unpinned sample.

### A3 · capability — *does frontier scale dissolve the null?*

```
model        nvidia/nemotron-3-ultra-550b-a55b  (NVIDIA)  thinking off
                                              164 TPS · 1.65 s TTFT
same shape as A2
```
**120 cells.** Answers a different question on its own axis (D4), so capability
never contaminates the strategy comparison.

### A4 · reasoning — *does built-in reasoning substitute for explicit reflection?*

```
model        nvidia/nemotron-3-nano-omni-30b-a3b-reasoning   (NVIDIA)
thinking     [false, true]         reasoning_budget 4096 when true
same shape as A2
```
**4 × 3 × 2 × 2 × 5 = 240 cells.** Not measured by anyone in Nakul's reference
list. Only valid because every other arm pins `thinking: false` (D5).

### A5 · format at scale — *the no-Docker contribution*

```
models       meta/muse-glimmer-30b · nvidia/nemotron-3-ultra-550b-a55b
tasks        stratified 60, ≥3 per repo, all 12 repos
strategies   l0_baseline
edit_formats [unified_diff, search_replace]
repeats      3
```
**60 × 2 × 2 × 3 = 720 cells.** Apply-verification is free and instant (D6), so
Nakul's four-task observation becomes a 60-task, two-model, stratified
replication. This is the arm that justifies dropping Docker rather than
apologising for it.

### A6 · QwenCloud confirmation *(optional — spends finite free quota)*

```
model        qwen3.8-max                   (qwen_api_key)  thinking off
same shape as A2, repeats 3
```
**72 cells.**

### Totals

| Arm | Cells | Provider |
| --- | --- | --- |
| A1 replication | 24 | Gemini |
| A2 workhorse | 120 | NVIDIA |
| A3 capability | 120 | NVIDIA |
| A4 reasoning | 240 | NVIDIA |
| A5 format at scale | 720 | NVIDIA |
| A6 QwenCloud *(optional)* | 72 | QwenCloud |
| **Total** | **1,296** | |

Against the original study's 24 cells, 8 of which silently vanished.

---

## 3. Worked example

`configs/base.yaml` in this repository is the full version of the above. The
four things to notice in it:

1. `api_key_env` holds **names**, never values
2. every model pins `temperature`, `top_p` and `thinking`
3. `verify.backend` has exactly one legal value
4. each arm carries `enabled`, so arms run one at a time under a budget ceiling
