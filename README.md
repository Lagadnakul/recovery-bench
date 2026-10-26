# Self-Reflection and Failure Recovery in Agentic AI Coding Systems

M.Tech dissertation — **Lagad Nakul Kiran** (2503032340022)
Artificial Intelligence & Data Science, PIET, Parul University

When an AI coding agent's patch fails, what should it do next? This repository
holds the dissertation, the evidence behind every number in it, a working
re-implementation of the whole pipeline, and the plan for the semester-4
research paper.

---

## The finding so far

A 20-task pilot on real SWE-bench Lite bugs compared three recovery strategies —
Blind Retry, Reflection-only, and Diagnose+Revise:

| Failure kind | What went wrong | Recovered |
|---|---|---|
| **Format** | The patch was malformed and never applied | **3 of 3** |
| **Logic** | The patch applied cleanly; the test still failed | **0 of 4** |

All three strategies produced identical outcomes, across two independent rounds.
Telling the model *why* it failed changed nothing. Changing *how the edit was
expressed* — unified diff to SEARCH/REPLACE — changed everything.

---

## What is here

| Path | Contents |
|---|---|
| [`Documents/`](Documents/) | The dissertation (`Self.docx` submitted master, `REPORT.pdf`), the systematic review, the Phase-1 review deck, and the weekly report template |
| [`recovery-bench/`](recovery-bench/) | The implementation — TypeScript on Bun, 433 tests across 23 files, plus 127 palette checks (`bun run contrast`) |
| [`reports/`](reports/) | Generated figures, chapter data, and the master results table |
| [`explainer/`](explainer/) | A plain-language walkthrough of the build, phase by phase. Open `index.html` |
| [`proposal/`](proposal/) | The semester-4 proposal — the problem, the stopping-rule algorithm, the build plan. Open `index.html` |
| [`PLAN.md`](PLAN.md) | The Phase II completion plan and its own decision log D1–D9 |
| [`recovery-bench/docs/DECISIONS.md`](recovery-bench/docs/DECISIONS.md) | The implementation decision log, D0–D33 — every decision with its reason and evidence |
| [`WORKFLOW.md`](WORKFLOW.md) | How the research paper gets written and submitted — venue, dates, and what to build when |
| [`BUILD.md`](BUILD.md) | The executable version of `WORKFLOW.md` — what to do on which day, phase by phase |

**Start with** [`explainer/index.html`](explainer/index.html) to understand the
work, or [`WORKFLOW.md`](WORKFLOW.md) to see what happens next.

---

## The implementation

`recovery-bench/` is a Bun workspace with three packages:

| Package | Role |
|---|---|
| `core` | Shared types, scrubbing, provider adapters |
| `pipeline` | The CLI — `try`, `replay`, `sweep`, `report`, `doctor` |
| `dashboard` | Vite + React + Tailwind results viewer |

**Stack:** TypeScript on Bun · zod · openai + @google/genai · jsdiff · plain git.
No charting library — the dashboard draws its own marks.

Design documents live in [`recovery-bench/docs/`](recovery-bench/docs/) and are
meant to be read in order: `DECISIONS.md` (every decision with the reason and
the evidence), then `ARCHITECTURE.md`, then `DASHBOARD.md`.

### Run it

```sh
cd recovery-bench
bun install
bun run doctor          # every gate, offline, no API key
bun test                # 433 tests
bun run report          # regenerates every Chapter 5 table
```

The key check — the re-implementation reproduces the submitted results exactly,
from a completely independent code path:

```sh
diff <(bun run report --stdout) ../reports/data/master_table.md   # must be empty
```

### The dashboard

```sh
cd recovery-bench/packages/dashboard
bun run dev
```

---

## Setup

See [`SETUP.md`](SETUP.md) for API keys and the shared agent skills.

**API keys are never committed.** `recovery-bench/.env.example` lists the
variable names; copy it to `.env.local` in the project root and fill in values
there. Nothing in this repository reads a key value except the provider adapter.

---

## Where the work is going

Semester 4 builds the part that is missing from every coding agent today: a rule
that decides, after a failure, whether another attempt is worth making or
whether the agent should stop and ask a human. The target is a Registered Report
at **MSR 2027** (abstract 13 November 2026), with Stage 2 in *Empirical Software
Engineering*.

The full plan, with dates and the algorithm, is in [`WORKFLOW.md`](WORKFLOW.md)
and [`proposal/index.html`](proposal/index.html).
