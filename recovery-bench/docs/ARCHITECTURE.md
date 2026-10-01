# Architecture

Read `DECISIONS.md` first — this document assumes its decisions, especially
**D6 (no Docker)**, **D9 (conditions are data)** and **D10 (TypeScript on Bun)**.

---

## 0. What changed, and why

Two things changed after the first draft.

**D10 changed the language to TypeScript on Bun.** Python had been chosen for the
SWE-bench harness, `datasets` and `difflib` — and D6 removed the first, while the
other two turned out to have direct equivalents. The layers below are unchanged
by this; only the file extensions and two type signatures are.

**D6 removed Docker permanently.** That one is not a deployment detail: it
changes what the system is allowed to claim, so it changes the shape.

| | Before | Now |
| --- | --- | --- |
| Stage 5 | **Evaluate** — run the repo's test suite in a container | **Verify** — `git apply --check` against a real checkout |
| Needs | Docker, ~40 GB, x86 emulation on Apple Silicon | plain `git` |
| Per task | minutes | milliseconds |
| Produces | FAIL_TO_PASS / PASS_TO_PASS / `resolved` | `applied` / `malformed` / `apply_fail` |
| New resolve rates | yes | **no** |
| Practical task ceiling | ~20 | **all 300 of SWE-bench Lite** |

The trade is narrower claims for two orders of magnitude more coverage. Since
the thesis's headline finding — *format-class failures recover, logic-class
failures do not* — is **an apply-layer result**, the cheap layer is the one that
carries the contribution.

The second consequence is structural. Resolve rates still exist in this system,
but only as **history**: they come from the 73 archived `report.json` files via
`replay`. So the pipeline now has two data origins that must never blur, and
that constraint is what the analysis layer is built around.

---

## 1. The whole system

```
                          ┌───────────────────────────────┐
                          │          cli.ts               │
                          │  doctor · sweep · replay      │
                          │  report · serve               │
                          └───────────────┬───────────────┘
                                          │
    ┌─────────────────────────────────────▼──────────────────────────────────┐
    │                              MATRIX                                     │
    │   grid.ts   enumerate every cell from config, up front                  │
    │   queue.ts  persist state; every cell ends with an outcome + reason     │
    └─────────────────────────────────────┬──────────────────────────────────┘
                                          │  one cell at a time
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
┌───────────────┐   ┌─────────────────────────────┐   ┌─────────────────────┐
│  1  TASKS     │   │  2  STRATEGIES              │   │  3  PROVIDERS       │
│  dataset      │──▶│  L0 baseline                │──▶│  openai_compat      │
│  checkout     │   │  L1 blind retry             │   │    ├ nvidia         │
│  localize     │   │  L2 reflection              │   │    └ qwencloud      │
│  context ✂    │   │  L2.5 diagnose + revise     │   │  gemini             │
│               │   │  L3 constrained             │   │  budget ledger      │
│               │   │  L4 tool-grounded           │   │  key pool           │
└───────────────┘   └─────────────────────────────┘   └──────────┬──────────┘
                                                                  │ raw text
                    ┌─────────────────────────────────────────────▼─────────┐
                    │  4  EDITS                                             │
                    │  search_replace.ts  parse blocks, match against source│
                    │  unified.ts         raw-diff mode (the ablation)      │
                    │  to_patch.ts        jsdiff → unified diff             │
                    └─────────────────────────────┬─────────────────────────┘
                                                  ▼
                    ┌───────────────────────────────────────────────────────┐
                    │  5  VERIFY            (no Docker — plain git)         │
                    │  apply.ts          git apply --check                  │
                    │  contamination.ts  similarity vs gold patch           │
                    └─────────────────────────────┬─────────────────────────┘
                                                  ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  6  ANALYSIS                                                              │
  │  load.ts    runs/ + archive/legacy_runs/ → one frame                      │
  │             every row tagged  verification ∈ {test, apply}                │
  │  tables.ts  guard: resolve rate over apply-only rows → hard error         │
  │  figures.ts regenerates every Chapter 5 figure                            │
  └─────────────────────────────────┬─────────────────────────────────────────┘
                                    ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  7  PRESENT — one static HTML file, no Node, opens over file://           │
  └───────────────────────────────────────────────────────────────────────────┘
```

Only **layer 3** touches the network. Only **layer 5** touches the filesystem
outside `runs/`. Layers 1, 2 and 4 are pure functions and fully unit-testable —
which is what makes a live demo safe: 1→4 runs on a projector in seconds.

---

## 2. The cell — the one idea that matters

### The failure mode being designed out

In the original code each condition is a script. When a script finds a patch
inapplicable it prints `Not applied` and writes nothing — so the cell does not
become a negative result, it **ceases to exist**. `PLAN.md` D2 records the
damage: 8 of 24 cells vanished, and those vanished cells were *the most frequent
single outcome in the study*.

### The replacement

A **cell** is the unit of work:

```ts
interface Cell {
  taskId: string; strategy: StrategyId; model: ModelId;
  editFormat: "search_replace" | "unified_diff";
  thinking: boolean; round: number; repeat: number;
}
```

The grid is enumerated from config **before any work starts** and written to
`runs/<id>/queue.json`. Each cell walks a state machine and **must** terminate:

```
  pending ──▶ prompted ──▶ generated ──▶ parsed ──▶ applied ──▶ done
     │            │            │            │          │
     └────────────┴────────────┴────────────┴──────────┴──▶ terminal(reason)
```

Terminal outcomes — the taxonomy, no-Docker version:

| Outcome | Meaning |
| --- | --- |
| `NO_OUTPUT` | provider returned nothing usable |
| `NO_PATCH` | response contained no parseable edit |
| `MALFORMED` | the edit could not be turned into a patch — carries a `reason` (below) |
| `APPLY_FAIL` | patch generated but `git apply --check` rejected it |
| `APPLIED` | applies cleanly to the repository at `base_commit` |
| `CONTAMINATED` | applies **and** matches the gold patch above threshold |
| `PROVIDER_ERROR` | 4xx/5xx, timeout, safety block (e.g. RECITATION) |
| `BUDGET_STOP` | token ceiling reached before the cell ran |

`MALFORMED` alone is a dead end in a results table: a model that got one space of
indentation wrong scores identically to one that invented a function. So it carries
a reason, and the two become separable at analysis time:

| Reason | Path | Meaning |
| --- | --- | --- |
| `search_not_found` | SEARCH/REPLACE | the quoted text is not in the file |
| `search_not_found_whitespace` | SEARCH/REPLACE | it *would* match if whitespace were normalised — logic right, spacing wrong |
| `search_ambiguous` | SEARCH/REPLACE | more than one match; refuse rather than guess |
| `search_empty` | SEARCH/REPLACE | empty SEARCH body |
| `block_unterminated` | SEARCH/REPLACE | `<<<<<<<` with no `=======` or `>>>>>>>` |
| `no_file_header` | unified diff | no `--- a/path`, so git cannot know the target |
| `hunk_count_mismatch` | unified diff | declared `@@ ,n` counts disagree with the body |
| `hunk_header_unparseable` | unified diff | malformed `@@` line |

The first three mirror the legacy statuses in `apply_log_v2.json`, so archived and
new rows share one vocabulary.

`RESOLVED` / `UNRESOLVED` are **absent by construction** — they exist only on
replayed historical rows.

Three properties follow:

1. **Nothing disappears.** A cell that produces no usable patch is a recorded
   outcome with a reason. `tests/test_grid_no_holes.ts` asserts that the set of
   cells in the queue equals the set enumerated from config.
2. **Resumable.** The queue is on disk; an interrupted sweep continues.
3. **Pre-registered.** The grid is fixed before the first API call, so the
   comparison cannot be reshaped by what the results turn out to be.

---

## 3. Layer notes

### 1 · Tasks

- `dataset.ts` — reads the committed `data/swebench_lite.jsonl` (exported once
  from the HuggingFace datasets server; no `datasets` library, no Python)
- `checkout.ts` — **replaces Docker.** Shallow-clones each repo once into
  `data/cache/repos/`, then checks out `base_commit` per task into a scratch
  worktree. Plain git; a few hundred MB per repo.
- `localize.ts` — oracle target file from gold-patch metadata, as the thesis did
- `context.ts` — **D7.** Extracts the target function or class ±50 lines instead
  of pasting the whole file. This is what makes n=5 affordable.
- `sampling.ts` — stratified draw across all 12 repos (§8.3), replacing the
  first-20-alphabetical sample (`PLAN.md` D5: 12 of 20 were Django)

Source files come from the local checkout, **never** fetched from
`raw.githubusercontent.com` mid-run as the original did. `checkout.ts` shells out
to `git` via `Bun.spawn`.

### 2 · Strategies

One module per rung, one method:

```ts
buildPrompt(task: Task, evidence: Evidence): Message[]
```

They differ **only** in what evidence enters the prompt. Prompt bodies live in
`prompts/*.md`, versioned, because wording is an experimental variable.

```
L0    baseline            issue + code
L1    blind_retry         + "try again"
L2    reflection          + the model's own critique of attempt 1
L2.5  diagnose_revise     + test-failure evidence
L3    constrained         + schema / prefix-completion enforcement of edit format
L4    tool_grounded       function-calling loop: read_file, search, propose_edit
L5–L7                     registered, unimplemented (D11)
```

### 3 · Providers

```ts
interface Provider {
  complete(req: {
    messages: Message[]; temperature: number; topP: number; seed: number;
    maxTokens: number; thinking: boolean; tools?: ToolDef[];
  }): Promise<Completion>;   // Completion carries usage incl. reasoningTokens
}
```

- `openaiCompat.ts` — one class, parameterised by `base_url`; serves **both**
  NVIDIA and QwenCloud
- `gemini.ts` — `@google/genai`, replication arm only
- `keyPool.ts` — round-robin over `NVIDIA_KEY_1/2/3`, 429 backoff
- `budget.ts` — **not a rate limiter.** A token ledger: estimates a grid's cost
  before it starts, enforces a per-provider ceiling, refuses to begin a sweep it
  cannot finish, and records prompt / completion / **reasoning** tokens separately

Every call writes request, response, token counts and latency to `runs/<id>/calls/`.

### 4 · Edits

The thesis's actual finding lives here, so it gets the heaviest tests.

```
model text ──▶ search_replace.parse()  ──▶ blocks
                       │
                       ▼ exact match against the checked-out file
               apply_blocks() ──▶ new file content
                       │
                       ▼
               to_patch.diff()  ──▶ jsdiff.createTwoFilesPatch  ──▶ .patch
```

`unified.ts` keeps the **raw unified-diff** path so the 0→6 ablation is
reproducible by flipping one config field (`edit_format`).

**The fairness rule, and it is load-bearing.** Both formats must be extracted from
the raw response with the *same* tolerance — fences, prose before, prose after,
CRLF, missing trailing newline. If the SEARCH/REPLACE parser forgave a wrapper the
diff extractor refused, arm A5 would measure our parsing rather than the models,
which is exactly the confound this thesis criticises in other work.
`tests/editsSymmetry.test.ts` asserts it directly, and it has already earned its
place: it caught trailing prose being absorbed into the diff body and counted as
context lines, which would have biased A5 against `unified_diff` by a defect the
models never committed.

**`validateDiff` is a pre-check, not a verdict.** `git apply` stays the authority.
Only the three defects D13 measured as fatal stop a cell here; everything else is
handed to git, because a validator that pre-empted git would substitute our
judgement for the measurement.

### 5 · Verify

```
git apply --check <patch>      →  APPLIED | APPLY_FAIL
similarity(patch, gold_patch)  →  CONTAMINATED above threshold
```

That is the whole layer. It needs no containers, no Python environment for the
target repo, and no network.

### 6 · Analysis — where the integrity rule is enforced

```ts
type Verification = "test" | "apply";

interface Row<V extends Verification> {
  cell: Cell;
  verification: V;
  outcome: Outcome;
  resolved: V extends "test" ? boolean : null;   // absent unless test-verified
}

const rows = load({ runs: "data/runs/", legacy: "archive/legacy_runs/" });
```

- rows from `archive/legacy_runs/` → `Row<"test">`, carrying `resolved`, F2P and P2P
- rows from new sweeps → `Row<"apply">`, where `resolved` is `null` **by type**

```ts
resolveRate(rows: Row<"test">[]): number
```

Passing apply-verified rows is a **compile error**, not a runtime guard. In the
Python draft this rule needed a test; here the type system carries it, which is
one of the three reasons D10 changed language.

### 7 · Present

**Vite + React + TypeScript + Tailwind**, built to static assets (D11). Not
Next.js: there is no routing, no server rendering and no data fetching here, so
Next would add toolchain for capabilities this page never uses. **Built** — see
`DASHBOARD.md` for the full design contract and the four places the rendered page
disagreed with it.

No charting library: every rule below fights a library's defaults, and the
drawing amounts to two bar rows, one SVG pipeline and one CSS-grid matrix (D29).

The decisive property is that the dashboard imports its types from
`packages/core` — the same `Outcome` union and `Row<V>` type the pipeline
writes. A change to the outcome taxonomy breaks the dashboard **build**, rather
than producing a silently wrong chart.

Six views:

| View | Data's job | Form |
| --- | --- | --- |
| Headline — 3/3 format-class vs 0/4 logic-class | one number | **stat tiles, not a chart** |
| Pipeline | sequence | six stages lighting up as a task flows through |
| The grid | state | matrix over every cell, **status palette** |
| Apply rate by edit format (A5) | magnitude, 2 series | bar |
| Sub-tests — `django-11019` 6/16 (replay) | magnitude vs a whole | bar with dashed full-scale track |
| The retrofit — `django-11620` | identity | side-by-side diff, no chart |

View 6 is the five-second version of the thesis: the malformed unified diff
(`APPLY_FAIL`) beside the SEARCH/REPLACE block (`APPLIED`).

Charting rules, binding on every view:

- the **nine** outcome states use a **reserved status palette**, never the
  chrome hues, and always carry a label — **never colour alone**. Built as two
  channels: hue says what the cell tells you, saturation says whether it tells
  you anything about the model at all, so the three `isInstrumentLimit` outcomes
  are grey and hatched rather than coloured as failure (D30)
- **one axis, always**; no dual-axis charts anywhere
- the palette is **validated by script** in light and dark mode before any chart
  ships, never judged by eye — `scripts/check_contrast.ts`, 127 checks, failing
  the build. It was itself broken once, checking dark mode twice (D31)
- dark mode is stepped deliberately from the same ramps, not an automatic inversion
- every chart has a table view
- a zero value draws **no bar**; a dashed full-scale track shows the denominator.
  This exact bug was found and fixed once already, in thesis Figure 5.2

The thesis figures are greyscale because print demanded it. The dashboard is on
screen, so it uses full colour while keeping the same typographic and shape
language — the two read as one project.

---

## 4. Repository layout

Bun workspaces. Three packages, one language, one lockfile.

```
recovery-bench/
├── package.json                   # workspaces: core, pipeline, dashboard
├── bun.lock
├── tsconfig.base.json             # strict: true
├── .env.example                   # names only, never values
├── .gitignore                     # .env + data/cache ONLY — never inputs
│
├── configs/                       # see CONFIG.md
├── prompts/                       # versioned prompt bodies
│
├── packages/
│   ├── core/                      # shared by the other two — the contract
│   │   ├── types.ts               # Cell · Outcome · Row<V> · Verification
│   │   ├── config.ts              # zod schema + config hashing
│   │   └── index.ts
│   │
│   ├── pipeline/
│   │   ├── tasks/       dataset · checkout · localize · context · sampling
│   │   ├── strategies/  registry · l0 … l4
│   │   ├── providers/   openaiCompat · gemini · keyPool · budget · accounting
│   │   ├── edits/       searchReplace · unified · toPatch
│   │   ├── verify/      apply · contamination
│   │   ├── matrix/      grid · queue
│   │   ├── analysis/    load · tables · figures
│   │   └── cli.ts                 # doctor · sweep · replay · report · serve
│   │
│   └── dashboard/                 # Vite + React + Tailwind
│       ├── index.html
│       ├── vite.config.ts         # base: "./" so the build is portable
│       └── src/
│
├── data/
│   ├── swebench_lite.jsonl        # committed — freezes the dataset revision
│   ├── cache/                     # repo clones (gitignored, rebuildable)
│   └── runs/<date>_<config>/
│       ├── manifest.json          # config hash · git commit · model · seed
│       ├── queue.json             # every cell + terminal outcome + reason
│       ├── calls/                 # request + response + tokens + latency
│       ├── patches/
│       └── verify/
│
├── archive/                       # frozen originals
│   └── legacy_runs/               # 73 report.json + 18 run.json, gzipped logs
│
├── tests/                         # bun test
│   ├── searchReplace.test.ts
│   ├── toPatch.test.ts            # asserts `git apply` accepts jsdiff output
│   ├── gridNoHoles.test.ts
│   └── noMixedVerification.test.ts
│
└── docs/  DECISIONS · ARCHITECTURE · CONFIG · BUDGET · LIMITATIONS
```

Three deliberate choices:

- **`packages/core` exists so the contract is shared, not duplicated.** The
  pipeline writes `Outcome`; the dashboard renders it; neither can drift.
- **`prompts/` holds files, not template literals** — wording is an experimental
  variable and belongs in version control.
- **`.gitignore` excludes only secrets and rebuildable caches.** The original
  excluded `attempts/`, which is precisely why those inputs are now lost (D0).

---

## 5. Provenance

Every run writes `manifest.json`: config hash, git commit, model id, temperature,
top_p, seed, thinking flag, dataset revision, timestamps, and per-call token
counts including reasoning tokens.

A number in a table traces to a call; a call traces to a config; a config traces
to a commit. That chain — not tidiness — is what "research-grade" means here.

---

## 6. Build order

| # | Step | Milestone |
| --- | --- | --- |
| 0 | Archive originals; copy out the 73 `report.json`; export `swebench_lite.jsonl` | ✅ provenance safe, dataset frozen |
| 1 | ✅ Workspaces, `core/types.ts`, zod config, `doctor` | `doctor` probes every endpoint, measures real TPS, checks key names, and **proves `git apply` accepts jsdiff output** — fails loudly before anything expensive |
| 2 | `edits/` + tests | ✅ the core claim, pure functions — 138 tests; the format finding measured at 30/51 vs 10/10 (D14) |
| 3 | ✅ `analysis/` + `replay` | **every Chapter 5 number and figure, offline, no key** — `master_table.md` regenerates byte-identically; 22 cells the original could not see recovered (D15); `FAILURE_CLASS` derived and matching (D16) |
| 4 | ✅ `providers/` + budget ledger | ceiling **refuses before dispatch**, usage captured per cell, all 3 providers live — and four defects found by making the first call (D17–D20), including `thinking: false` never being sent on the wire (D19) |
| 5 | ✅ `strategies/` L0–L2.5 + `tasks/` | prompts byte-verified against the originals (D21); evidence provenance recorded rather than assumed (D22); one real cell run end to end to APPLIED |
| 6 | ✅ `matrix/` + the sweep | 1,308 cells enumerated up front, projected against real file sizes before spending (D25), run two-phase so the recovery conditions have a baseline to read (D26), resumable, and verified by code that shares nothing with the runner |
| 7 | `dashboard/` | the visual |
| 8 | `context.ts`, L3, L4, variance runs | the §8 extensions |

**Step 1 carries a gate that did not exist in the Python design.** `jsdiff`'s
unified-diff output must be accepted by `git apply` — that format is what the
entire thesis finding rests on, so it is proven against a known-good gold patch
before any other code is written.

**Step 3 is done, and it is the milestone that mattered.** The repository now
does something the original cannot: regenerate the whole of Chapter 5 with one
command — no API key, no network, no Docker.

```sh
bun run replay    # archive -> 51 cells -> data/replay_rows.json
bun run report    # -> master_table.md (byte-identical) + data/chapter5_figures.json
```

It also reads 22 evaluations the original pipeline could not see at all, because
a patch that never applied produces no `report.json` to glob for (D15).
