# The console — phase-by-phase build

**For:** Aayush (build) · Nakul (author) · **Written:** 26 October 2026
**Target:** deployed on Vercel, linked from the paper's Data Availability statement
**Window:** 1–13 November 2026, polish 21–30 November

A future session should be able to read this document and build the thing without
re-deriving anything. Every number quoted here was verified against
`recovery-bench/data/sweep_rows.jsonl` on 26 October, not copied from prose.

## Relationship to the other documents

| Document | Owns |
|---|---|
| `BUILD.md` | the paper's schedule. Still authoritative on dates |
| `ENGINE.md` | what the engine measured. The source of truth for findings |
| **this file** | how the console gets built |

The root `DASHBOARD.md` — Nakul's 26 October console spec — **was deleted in the Phase 0
commit.** It specified a Vite package inside the Bun workspace because the build had to
open from `file://`; Vercel removes that constraint, and keeping two live specifications
for one package is how a team builds two half-consoles. Its three honesty rules survive,
restated as R1–R3 in §2, and its screen list survives in §6 Phase 5.

**Not to be confused with `recovery-bench/docs/DASHBOARD.md`**, which is a different and
still-current document: the design contract for the *old* `packages/dashboard` (D11,
D29). It is referenced from three other files and must stay.

---

## 1. What this is, in one paragraph

A six-screen console over a finished experiment. It has two audiences with opposite
instincts: a professor who has fifteen seconds and once asked *"where is the
algorithm?"*, and MSR reviewers who distrust polish laid over thin evidence. The
resolution is to spend all the boldness in **one** place — a live, draggable decision
boundary that re-sorts 1,604 real cells — and keep every other screen austere, dense
and measured. The contrast is what makes the one thing land, and austere-everywhere-else
is what a reviewer trusts.

**It is not a product dashboard.** The reference is laboratory instrumentation: every
structural mark on screen encodes a number. No device that doesn't carry information.

---

## 2. The three rules that decide what gets drawn

Not disclaimers. They are design constraints, and getting them wrong is the one failure
mode that cannot be fixed by restyling.

**R1 — `APPLIED` is not `RESOLVED`.** `evidenceSource` is `"none"` on all 1,604 live
rows. Docker was ruled out (D6), so nothing in the live sweep measured whether a bug was
*fixed* — only whether a patch *applied*. Every screen showing an apply rate carries this
in body text, not a footnote. A reviewer who finds it unstated discounts the whole
artifact.

**R2 — 130 refusals are not 46 errors.** Both wear `outcome.kind === "PROVIDER_ERROR"`.
Rendering the kind directly prints *"the API failed 176 times"*, which is false.

> **Correction to the deleted `DASHBOARD.md`:** it said the two are separable by
> `status: null` plus the reason string. **`status` alone is wrong** — 145 of the 176 have
> a null status, because 15 timeouts do too. Split on the reason prefix:
>
> ```ts
> const isByDesign = o.reason?.startsWith("condition not runnable:");  // exactly 130
> ```
>
> Verified: 98 + 26 + 6 = 130 by-design refusals, 46 real failures (27 HTTP 503,
> 15 timeouts, 2 HTTP 404, 2 other). 130 + 46 = 176.

> **Correction found in Phase 2, and it is the important one.** The 130 are **two
> different things**, and R3's 32 are a **subset of them, not a separate population**:
>
> | | n | Reason prefix | What it is |
> |---|---:|---|---|
> | **STARVED** | 98 | `needs real evidence` | `l2_5_diagnose_revise` needs test evidence, which needs Docker, which D6 ruled out. The condition could not run on *any* row — a structural limit of the design |
> | **CASCADE** | 32 | `needs a previous attempt` | A reflection condition whose earlier round died, so there was nothing to reflect on (D36). a1 lost 4, a2 lost 8, a4 lost 20 |
> | **REAL** | 46 | — | 27 HTTP 503, 15 timeouts, 2 HTTP 404, 2 other |
>
> So the split is three-way, and **reporting "130 refused" alongside "32 holes" as
> separate figures double-counts those 32.** Screen 1's KPI strip must not do that.
> `splitProviderError()` returns all three plus `byDesign = starved + cascade`, and a
> test asserts `byDesign === starved + holes().length`.

**R3 — 32 cells never ran (D36). They are holes, never zeros.** A blank in a results
table reads as a measured zero. Draw them as absences: a gap in the grid, an explicit
count, a named reason. Where set-aside exceeds measured, it leads the panel (D18).

And one more, for anything not measured at all: every synthetic or illustrative mark
carries **"Expected shape, drawn to illustrate the claim — not measured data."**

---

## 3. Verified data facts

Quote these; don't re-derive them.

```
rows            1,604          data/sweep_rows.jsonl
calls           1,428          rows carrying a usage object
tokens          18,102,295     promptTokens + completionTokens
models          5              muse_30b, nemotron_ultra, nemotron_nano, qwen_max, gemini_flash
arms            6              all completed
```

| Arm | Rows | Tasks | Models | Max round |
|---|---:|---:|---:|---:|
| `a5_format_at_scale` | 720 | **60** | 2 | 1 |
| `a4_reasoning` | 360 | 4 | 1 | 4 |
| `a2_workhorse` | 260 | 4 | 1 | 4 |
| `a3_capability` | 180 | 4 | 1 | 4 |
| `a6_qwencloud` | 56 | 4 | 1 | 2 |
| `a1_replication` | 28 | 4 | 1 | 2 |

**The asymmetry matters and the console must not hide it.** `a5` spans 60 tasks; every
recovery arm spans 4 with 5 repeats. So the format result is broad and the
reflection-harm result is deep-but-narrow — pairs cluster within task. Screen 2 states
this in body text.

### Outcome kinds

```
APPLIED          718
MALFORMED        572
PROVIDER_ERROR   176     → 130 by design + 46 real  (see R2)
NO_PATCH         102
APPLY_FAIL        17
TRUNCATED         13
NO_OUTPUT          6
```

### MALFORMED reasons

```
hunk_count_mismatch         206
block_unterminated          182     ← mislabelled, see below
search_not_found             86
no_file_header               80
search_not_found_whitespace  17
hunk_header_unparseable       1
```

> **`block_unterminated` is a misleading label.** In `a4`, 164 of 181 such rows **did**
> close the block — the missing piece was the `=======` divider. Display it as
> **"divider missing"** in the UI and open an issue to rename it in the engine before
> the paper cites it.

### Row schema

```ts
{
  key: string
  arm: "a1_replication" | "a2_workhorse" | "a3_capability"
     | "a4_reasoning" | "a5_format_at_scale" | "a6_qwencloud"
  runId: string
  timestamp: string
  cell: {
    taskId: string              // "astropy__astropy-12907"
    strategy: "l0_baseline" | "l1_blind_retry" | "l2_reflection" | "l2_5_diagnose_revise"
    model: string
    editFormat: "search_replace" | "unified_diff"
    thinking: boolean
    round: number               // 1-based
    repeat: number              // 0-based
  }
  verification: "apply"          // always — this is R1 in the data
  outcome: { kind, status?, reason?, retries?, patch?, ... }
  usage: { promptTokens, completionTokens, reasoningTokens, latencyMs } | null
  evidenceSource: "none"         // always, on live rows
  comparableToChapter5: boolean
  honouredCondition: boolean
}
```

Strategy totals: `l0_baseline` 812 · `l1_blind_retry` 344 · `l2_reflection` 344 ·
`l2_5_diagnose_revise` 104.

### The findings, in the order they should be trusted

1. **Edit format decides whether a patch applies.** `search_replace` 96.4% vs
   `unified_diff` 13.1%. Exact McNemar **p = 7.44e-89** on 360 pairs; **p = 3.32e-65**
   after discarding every ambiguous failure. 60 tasks. Mechanism:
   `hunk_count_mismatch` on 206 of 304 FORMAT rows.
2. **Reflection helps once, then poisons.** `a3_capability`, 550B (`nemotron_ultra`):
   blind retry 75 / 75 / 80 / 75 across rounds 1–4; reflection **90 / 45 / 40 / 50**.
   Paired exact McNemar on rounds 2–4: **b = 19, c = 0, p = 3.8e-6** on 19 discordant of
   **60** pairs, no reversals in any of the 4 tasks. The 30B model is null:
   `b = 4, c = 4, p = 1.000`. Mechanism: mean completion tokens climb monotonically with
   reflection depth (**1407 → 1448 → 1463 → 1594**) and run ~1.8× blind retry's
   (**799 → 946 → 1119 → 1092**), and **all 28** MALFORMED rows after round 1 are
   `search_not_found` against **1** for blind retry — the model anchors on its own prior
   output instead of the file. **The prescription is K = 1.**

   > **Three numbers in this finding were wrong until Phase 4 re-derived them.** The
   > token series read `1125 → 1284 → 1317 → 1397` with blind retry "flat near 740", and
   > the malformed count read "29 of 30". None of the three matches `sweep_rows.jsonl`.
   > The result is unaffected and the mechanism is *sharper* than the old numbers claimed
   > — 28 of 28, not 29 of 30 — but **blind retry is not flat**: it climbs 37% from round
   > 1 to round 3. Do not cite "flat near 740" anywhere. Asserted now in
   > `derive.test.ts`, so it cannot drift back.
3. **Capability runs backwards**, three independent times, including 30B at 25.6% apply
   vs 550B at 0.6% on `unified_diff`.
4. **The pilot design has zero power, demonstrated.** `a1` re-ran it and produced **0
   discordant pairs against a rejection floor of 6**.
5. **Two conditions starve by design.** `l2_5_diagnose_revise` refused 80/80 in a2 and
   16/16 in a6.

Power analysis (`reports/data/power.md`): the exact test cannot reach α = 0.05 below
**6 discordant pairs** at any N. 80% power needs **460–765 tasks**. The pre-registered
N = 150 gives H1 between **4.6% and 23.5%**.

---

## 4. Design system

### Tokens

A sibling of `kuotivo-dashboard`'s system — same discipline, own identity. OKLCH, light
only. Light-only is a real decision, not a shortcut: the figures get printed in a
journal, and a design that survives greyscale is the same design that survives print.

```css
@theme {
  --color-canvas:        oklch(98.8% 0.003 85);   /* warm paper */
  --color-surface:       oklch(100%  0     0);
  --color-rule:          oklch(91%   0.004 85);   /* hairlines, scales, ticks */
  --color-ink:           oklch(19%   0.012 260);  /* text and marks */
  --color-ink-muted:     oklch(47%   0.014 260);  /* AA on canvas */
  --color-measure:       oklch(44%   0.17  232);  /* THE accent */
  --color-measure-wash:  oklch(95.5% 0.025 232);
}
```

**One accent.** It marks measured values and nothing else. All chrome is greyscale and
means nothing — which is exactly why the accent reads as loud.

Verify every pair with a contrast script before building screens, the way
`kuotivo-dashboard` does. Target AA on body, AAA where it's free.

### The two failure classes

They must be distinguishable **in greyscale**, so they cannot be two hues:

```
FORMAT   solid fill,   lighter value    the patch never applied
LOGIC    45° hatch,    darker value     the patch applied, the thinking was wrong
```

Value plus texture. Survives photocopying and colour-blindness, and the hatch carries
meaning — something underneath didn't work.

### Radii

```
4px   controls
6px   panels
0px   anything plotted
```

A data mark with a rounded corner is a lie about precision.

### Type — decided

Two families, sharply distinct in role.

- **Instrument Sans** (Google Fonts) — headings, UI, prose
- **Geist Mono** — every figure, task ID, p-value, token count

**Instrument Sans over Geist, decided 26 October.** Geist was the safe answer and it is
what every shadcn starter ships with, which is the argument against it here. Instrument
Sans also turned out to carry a **`wdth` axis (75–100%)**, verified present in the built
stylesheet as `font-stretch: 75% 100%`. That is not decoration — the rail labels and the
dense table headers run narrowed, which buys real column width in the 1,604-row table and
gives the console a voice no default starter has. Declare it with
`axes: ["wdth"]` or the axis is dropped from the subset.

**The rule that does most of the work: a number is never set in the sans.** Any digit a
reader might compare to another digit is mono and tabular (`font-variant-numeric:
tabular-nums`). On a screen that is almost entirely numbers, this single rule creates
the discipline.

Forbidden, because they are the standard tells: all-caps labels, tracked-out eyebrows
above headings, `A · B · C` meta strings, `→` appended to link text, a lone accented
word in a headline. A section's identity comes from its position and its rule.

### Motion

Three places. Nowhere else.

1. **One load sequence** — the cell field settles into position, 1,604 marks staggered
   over ~450ms, then completely still. Once, on first paint.
2. **The slider response** — cells migrate across θ with spring physics, counts tick.
   Motion answering a hand, which is the only kind always welcome.
3. **Row expansion** — a cell opens to its patch and stderr.

No scroll-triggered fades. No hover-lift on cards. `prefers-reduced-motion` turns 1 and
2 into instant state changes.

### Layout — decided

A single canvas with a **persistent instrument rail** on the left.

**Persistent rail, with screen-aware controls. Decided 26 October.** The rail itself is
always there — navigation, what is loaded, the counts. But the G / r / h sliders appear
**only on screen 6**, where θ actually governs something.

This is a correction to the choice as originally posed. A rail whose sliders are visible
on all six screens would put live-looking controls in front of a professor on four
screens where they change nothing, because screens 1–5 show measured data that no cost
parameter can move. A control that looks active and does nothing is a lie about the
instrument, and it is the exact species of lie R1–R3 exist to prevent. Real instruments
change their control panel with the mode; this one does too.

So: persistent shell, built once in Phase 1. Screen-aware controls. Full impressiveness
on screen 6, no dead sliders anywhere else.

```
┌────────────┬──────────────────────────────────────────────────┐
│            │  Reflection helps once, then poisons             │
│  G  ▁▂▃▄▅  │  19 cells where blind retry applied and          │
│  r  ▁▂▃    │  reflection did not. None the other way.         │
│  h  ▁▂▃▄   │  p = 3.8e-6                                      │
│            │                                                  │
│  θ FORMAT  │  ┌──────────────────────┐  b  19  ┌────────────┐ │
│    0.41    │  │   the collapse       │  c   0  │  lineage   │ │
│  θ LOGIC   │  │                      │  n  60  │  ribbon    │ │
│    0.08    │  └──────────────────────┘  ─────  └────────────┘ │
│            │                            floor 6                │
│  ─────     │                                                  │
│  overview  │  ┌──────────────────────────────────────────────┐ │
│  recovery ●│  │  1,604 cells — every one, sortable          │ │
│  format    │  └──────────────────────────────────────────────┘ │
│  classes   │                                                  │
│  cells     │  APPLIED is patch-apply success, not a test pass. │
│  stopping  │  evidenceSource is none on all 1,604 live rows.   │
└────────────┴──────────────────────────────────────────────────┘
```

Left-aligned, ragged right, no centred prose. **Each screen states its finding in full
sentences under the title**, not in a chart caption.

---

## 5. Stack

```
Next 16  ·  React 19  ·  Tailwind v4  ·  shadcn  ·  framer-motion  ·  TypeScript
```

Everything already in `kuotivo-dashboard/apps/web`. Deployed on Vercel.

**Build it statically anyway.** No route handlers, no server actions, no runtime fetches
— all data resolved at build time. Vercel hosts it either way, and a fully static build
*also* means the folder can be handed over or opened offline for the viva, where there
may be no internet. This costs nothing and removes a risk. Enforce it in Phase 0 by
keeping `output: "export"` working, even though Vercel does not need it.

**No recharts.** Not dogma — the four signature marks (cell field, lineage ribbon, slope
chart, decision boundary) are all non-standard, and fighting library defaults costs more
than drawing them. Hand-drawn marks in one consistent system also look better, which is
part of the brief. Keep recharts in `kuotivo` where the charts are conventional.

### Location

```
console/                    # its own Next app at the repo root
```

Its own app, not a package inside the Bun workspace. The workspace is a CLI pipeline;
mixing a Next app into it complicates both. Vercel's root directory is then just
`console`.

---

## 6. Phases

Each phase ends green and committed. **Do not start a phase before the previous one's
acceptance passes** — the data layer in particular will silently poison every screen if
it is wrong.

### Phase 0 — scaffold and decisions · DONE 26 October

```sh
cd "Nakul research paper"
bunx create-next-app@latest recovery-console \
  --ts --tailwind --app --src-dir --import-alias "@/*" --use-bun --eslint --turbopack --yes
mv recovery-console console
cd console
bunx --bun shadcn@latest init -b radix -p nova --no-monorepo -y
bun add framer-motion zod
```

Installed: Next **16.4.3** · React **19.3.0** · Tailwind **4.3.3** · framer-motion
**14.6.0** · zod **4.6.7** · radix-ui, shadcn, lucide-react, cva, tw-animate-css.

Folder is `console/`, **package name is `recovery-console`** — npm refuses to create a
package called `console` because it is a core module name. The folder name is what
Vercel's root directory points at, so the mismatch is harmless and deliberate.

#### Four things that cost time, so they do not cost it again

1. **`next.config.ts` carries the Tailwind wiring, and overwriting it silently removes
   every utility.** Tailwind v4 runs as a *Turbopack loader*, not a PostCSS plugin —
   there is no `postcss.config.js` in this setup. Without the `turbopack.rules` block the
   build still **succeeds** and still emits a stylesheet; that stylesheet just contains
   the `@font-face` rules and nothing else, because no file is ever scanned for class
   candidates. The page renders completely unstyled with no error anywhere. Always verify
   a utility actually exists in the built CSS rather than trusting a green build:

   ```sh
   C=$(find out/_next/static -name '*.css' | head -1)
   grep -oF .tabular-nums "$C" | wc -l      # must be 1, not 0
   ```

2. **`shadcn init` needs `-b radix -p nova`** or it stops on an interactive preset
   prompt. `--base-color` no longer exists; the flags are `-b` (base, one of
   base/radix/aria) and `-p` (preset, one of nova/vega/maia/lyra/mira/luma/sera/rhea).
   `radix` matches the `radix-ui` package `kuotivo-dashboard` already uses.

3. **The nova preset writes a self-referential `@theme`**: `--font-sans: var(--font-sans)`.
   Name the `next/font` CSS variables `--font-instrument-sans` and `--font-geist-mono`,
   then map them in `@theme inline`. Otherwise neither font loads and the failure is
   invisible.

4. **There is no `next export` command.** It was removed in Next 14. `output: "export"`
   makes `next build` write `out/` directly. Any instruction to run `bun run export` is
   stale.

Also expect editor warnings for `@theme`, `@custom-variant` and `@apply` — the CSS
language server does not know Tailwind v4 at-rules. They are noise, not errors.

**Status:** `bunx tsc --noEmit` clean · `bun run build` clean, no warnings · `out/`
contains `index.html`, `404.html` and a 16.8 KB stylesheet with every utility present and
`font-stretch: 75% 100%` confirming the width axis · `src/app/page.tsx` is a placeholder
that proves both fonts and tabular figures render.

**Still open:** the Vercel project. Root directory `console`, framework Next.js, build
`bun run build`, output `out`. Confirm a deploy of the placeholder *before* writing
screens — do not discover a deploy problem on 12 November.

### Phase 1 — tokens and primitives · DONE 26 October

`src/app/globals.css` holds the `@theme` block from §4. Seven primitives in
`src/components/primitives/`, and **only** these:

```
Panel          surface + 1px rule + 6px radius. No shadow. PanelEmpty keeps the frame
Figure         mono, tabular. The only way a number is rendered. null -> grey dash
Rule           a hairline that CARRIES A VALUE (scale, baseline, floor, threshold)
Finding        the screen's conclusion, in prose, under the title
Note           an R1/R2/R3 statement. No dismiss control, ever. + Illustrative
Slider         G, r, h on Radix. Label, live value in mono, ticks with real values
ClassMark      four classes by value + texture. classFill() / ClassMarkDefs
```

`src/app/primitives/` renders all seven with real sweep values. It stays in the app: when
a screen looks wrong later, the question is whether the primitive or the usage is wrong,
and that is only answerable if the primitives are visible on their own.

#### The contrast gate caught four defects in the tokens as designed

`scripts/contrast.ts` parses the `--color-*` tokens **out of `globals.css` itself** rather
than a duplicated list, converts OKLCH to linear sRGB, and asserts 20 pairs plus an sRGB
gamut check. It is not decoration — on first run it failed four of my own values:

| Token | As designed | Measured | Fix |
|---|---|---|---|
| `measure` | `oklch(44% 0.17 232)` | **outside sRGB** | chroma **0.088**. The gamut boundary at L=44%, h=232 is 0.0910, computed. Above it the browser silently clips to a different colour than the file states |
| `rule-strong` | `84%` | 1.58:1, need 3 | **64%**. It is the boundary of a *control*, which WCAG 1.4.11 does not treat as decorative |
| `class-format` | `72%` | 2.37:1, need 3 | **63%**. A filled mark that carries data must be visible on its own; a mark you cannot see is not a lighter mark |
| `class-logic` | `38%` | passed | **33%**, to hold separation after FORMAT darkened |

The `rule` / `rule-strong` split is the durable lesson: **a divider is decorative and
exempt, a control boundary is not.** Using `rule` on an input border is the mistake the
two tokens exist to prevent.

The gate also checks **greyscale separation** of the two classes as a luminance
difference, not a contrast ratio — a printer sees the former. 0.220 against a 0.18 floor.

#### Three more traps

1. **`@theme` accepts only custom properties and `@keyframes`.** A malformed comment
   inside the block is not reported as a comment error — Tailwind reports *"`@theme` blocks
   must only contain custom properties"* and points at the next declaration, which sends
   you looking at the wrong line.
2. **`tsc --noEmit` fails on a clean tree.** `LayoutProps` and `PageProps` are generated
   into `.next/types` by the build, so typechecking must run **after** `next typegen`.
   The `typecheck` script does that; running bare `tsc` after `rm -rf .next` does not.
3. **`import.meta.dir` is Bun-only** and fails under `tsc`. `fileURLToPath(new
   URL(..., import.meta.url))` works in both.

**Gates:** `bun run check` = contrast, then `next typegen && tsc --noEmit`, then
`next build`. All green. Verified in the built CSS rather than assumed: every token
present, `body` resolving to `--color-canvas`, `prefers-reduced-motion` honoured,
`focus-visible` present, and **zero `prefers-color-scheme` rules** — the light-only
decision holds in the output.

### Phase 2 — the data layer · DONE 26 October

The highest-risk phase, and it earned the label: it found the R2/R3 double-count above
and two schema facts that would each have produced a confidently wrong chart.

```
console/scripts/sync.ts          recovery-bench/data/* -> src/data/* + public/
console/src/data/                committed, so the build is hermetic
console/src/model/rows.ts        zod schema, parsed once at build time
console/src/model/derive.ts      every aggregate. No component computes one
console/src/model/derive.test.ts 40 tests, 3,655 assertions
```

#### What ships, and what does not

The source is **7.6 MB**, and 5 MB of that is `response` — the model's raw unparsed
output. Everything the console says about *why* a cell failed is already in
`outcome.reason`, `detail`, `searchText` and `gitStderr`, so `response` is dropped. The
archival copy stays in `recovery-bench/data/sweep_rows.jsonl`.

`patch` and `outcome.patch` are **byte-identical on all 735 rows** that have one —
checked in the sync script, which exits non-zero if that ever stops being true rather
than silently shipping the wrong patch next to a row.

| Output | Size | How it is loaded |
|---|---:|---|
| `src/data/rows.json` | 1,103 KB | imported by **server** components only, so it is consumed at build time and never reaches the browser |
| `src/data/ccos.json` | 132 KB | same |
| `src/data/power.json` | 8 KB | same |
| `public/patches.json` | 862 KB | fetched on demand when a row is expanded |

**The architectural rule Phase 3 onward must preserve:** aggregates are computed in
server components and prerendered into HTML. A client component that imports `rows.json`
drags 1.1 MB into the first paint. When a client screen needs per-row data, pass it a
**compact projection** computed at build time. Verified after this phase: no row data
appears in any client chunk.

`provenance.json` records the source commit and a SHA-256 per input file — what the Data
Availability statement needs. It deliberately has **no `generated_at`**, for the reason
in §7.

#### Two schema facts that would have produced wrong charts

1. **`round` is not numbered consistently across arms.** The five recovery arms number
   the baseline **0** and recovery rounds 1–4 (92 rows at round 0). `a5` has no recovery
   and numbers its single shot **1** (720 rows). So "round 1" means *first retry* in
   a2/a3/a4/a6/a1 and *the only attempt* in a5. My first schema had
   `round: positive()`, which rejects 0 — the build would have failed, which is the good
   outcome; pooling rounds across arms is the bad one. `roundSeries()` therefore
   **requires** an arm argument rather than defaulting to all.

2. **No live row can ever be `LOGIC`.** LOGIC means "the patch applied and the test
   still failed", and no live row ran a test (R1). `classify()` returns `null` for
   `APPLIED` — which on the sweep is an *unknown*, not a success — and a test asserts
   zero LOGIC rows across all 1,604. **Screen 4 must therefore draw its four classes
   from `ccos.json`'s archive triage** (FORMAT 9, LOGIC 25, BROKEN 0, LOST 0, 17
   resolved, over 51 test-verified records) and keep the live sweep's outcome kinds as a
   separate panel. Mixing them would imply the sweep measured logic failures.

Also: `BROKEN` is exactly the 46 real errors and nothing else. A by-design refusal
classifies as `null`, because D18 forbids folding an instrument limit into a failure
rate.

#### The nine derivations, all tested against CONSOLE.md §3

| Function | Asserted |
|---|---|
| `totals()` | 1,604 rows · 1,428 calls · 18,102,295 tokens · 6 arms · 5 models |
| `armSummary()` | every arm's rows/tasks/models/maxRound, and the per-arm columns summing to the totals |
| `splitProviderError()` | 98 / 32 / 46, **and** that `status === null` gives 145 and is therefore unusable |
| `applyRateByFormat()` | 96.4% vs 13.1%, b=301 c=1 n=302 concordant=58, 0 dropped, **p = 7.44e-89** to three significant figures |
| `roundSeries()` | blind retry 75/75/80/75, reflection 90/45/40/50, n=20 per point |
| `reflectionHarm()` | a3 b=19 c=0 p<4e-6; a2 b=4 c=4 p=1.000 |
| `mcNemar()` | the floor is arithmetic — p=0.0625 at 5 pairs, 0.03125 at 6 |
| `malformedByReason()` | 206/182/86/80/17/1, summing to 572 |
| `holes()` | 32, each with a lineage reason, and `byDesign === starved + holes` |

Two tests exist to stop a claim decaying silently rather than to check a number:
`evidenceSource === "none"` on all 1,604 rows, so **R1 cannot quietly stop being true**;
and zero `LOGIC` rows, so R1 holds as a property of the classifier rather than as a
caption.

One more worth keeping: a test asserts that pooling round 1 into the reflection-harm
test *weakens* it. Round 1 is where reflection wins (90% vs 75%), so a test over all four
rounds averages the help against the harm and reports less. Excluding round 1 is the
finding, not a convenience, and now it is a test.

### Phase 3 — screen 6, the instrument · DONE 26 October

**The hero this phase was specified to build cannot be built, and building it would have
been a fabrication.** The spec said *"the field of 1,604 cells, θ drawn across it … drag
`h` and the cells migrate across the boundary."* Reading `ccos.json` properly killed it:

- The policy is **class-conditioned**. Its input is a class belief `p̂_c`, not a per-cell
  probability. Cells do not each have a `p` to sort by.
- The live sweep has **no LOGIC class at all** (Phase 2). Sorting 1,604 apply-only cells
  by a class-conditioned threshold would have meant inventing the quantity being plotted.

The real evidence is the **31 test-verified archive trials** — FORMAT 10, LOGIC 21. The
1,604 cells belong on screens 1 and 5.

#### What the data says, and it is better than the spec's version

At the committed payoffs `G = 1, r = 0.02, h = 0.3`:

| class | p̂ | θ myopic | myopic | finite-horizon | q | qFlip | trials |
|---|---:|---:|---|---|---:|---:|---:|
| FORMAT | 0.500 | 0.62 | **ask a human** | **retry** | 0.9 | 0.78 | 10 |
| LOGIC | 0.023 | 0.42 | ask a human | ask a human | 0.7 | 0.303 | 21 |
| BROKEN | 0.5 prior | −0.28 | abort | — | 0 | — | 0 |
| LOST | 0.5 prior | 0.32 | retry | — | 0.6 | — | 0 |

**1. The myopic rule and the finite-horizon rule disagree on FORMAT** — the one class
that actually recovered in the pilot, 3 of 3. A failed retry does not end the episode, it
leaves the agent its remaining attempts, so a cheap retry (`r = 0.02`) is worth taking
even when its own one-step value looks worse than asking. *The stopping rule has to be
finite-horizon, not myopic, and the pilot data shows exactly where that matters.* This is
a far stronger screen than "watch the algorithm be right", and it is honest.

**2. The verdict is entirely cost-driven, and no cost has been measured.** Verified
through the same code the UI calls:

```
h=0.10  FORMAT:ESC/RET  LOGIC:ESC/ESC  BROKEN:ABO  LOST:ESC
h=0.42  FORMAT:ESC/RET  LOGIC:ESC/ESC  BROKEN:ABO  LOST:RET
h=0.43  FORMAT:RET/RET  LOGIC:ESC/ESC  BROKEN:ABO  LOST:RET
h=0.80  FORMAT:RET/RET  LOGIC:RET/RET  BROKEN:ABO  LOST:RET
```

FORMAT flips at `h > 0.42`, exactly as the algebra says. And at `h = 0.80` the rule
retries **LOGIC** — a class that never once succeeded in 21 trials. That is not a bug; it
is what the rule means, and a professor can watch it happen.

**3. λ is not measured, and the claim that it is should be corrected elsewhere.**
`isMeasured: false`, interval `[0.121, 1]`, `excludesNoDecay: false`, and the policy ran
with **λ = 1 — no decay at all**, so the belief is flat in the attempt index.
`proposal/index.html`, `BUILD.md` and `ENGINE.md` all state that λ is *"a measured
property of the run, not a tuned knob"*. **It is not yet.** Screen 6 says so; the other
three documents should be corrected before a reviewer does it for them.

Also stated on screen: `q` is an assumption and never was measured; BROKEN and LOST are
the prior alone at zero trials; and `survivorship.confounded = true` — 10 successes, 0
retried afterwards, so the data never observes what retrying after a success does.

#### What got built

| File | Role |
|---|---|
| `src/model/ccos.ts` | zod schema for `ccos.json`'s CC-OS section |
| `src/model/policy.ts` | live recompute — `θ_c`, `qFlip`, myopic decision, and finite-horizon backward induction in O(K) |
| `src/model/policy.test.ts` | 23 tests. **Reproduces `ccos.json` exactly** |
| `src/components/marks/DecisionPlane.tsx` | the hero. Hand-drawn SVG, `crispEdges`, 0 radius on every mark |
| `src/components/shell/Rail.tsx` | `Rail` + `Shell`. Persistent, with the screen-aware control slot |
| `src/components/screens/StoppingRule.tsx` | the screen |
| `src/app/stopping-rule/page.tsx` | server page → compact projection → client |

**The acceptance test is the reason to trust the screen.** `policy.ts` recomputes what
recovery-bench computed once, and the test asserts the two agree at the committed
payoffs — all four `θ`, all four decisions, both `qFlip` values, and the finite-horizon
`V_k` and thresholds **to ten decimal places**. An independent backward-induction
implementation reproducing Nakul's is strong evidence both are right. The professor is
dragging the same algorithm the paper describes, not a lookalike.

Two tests exist to stop a claim decaying rather than to check a number: λ's
`isMeasured === false`, so if a future fit changes that the test fails and the screen's
wording gets revisited deliberately; and `qFlip` actually being where each decision turns
over, checked either side of the boundary.

#### Notes for later phases

- **The rail's nav renders unbuilt screens as disabled, not as links.** A static export
  has no useful 404, and a nav that walks a professor into a blank page costs more trust
  than an obviously unfinished one. Flip `built: true` in `SCREENS` as each lands.
- **`typedRoutes` is on**, so a nav `href` is `Link`'s own href type, not `string`. A
  route that does not exist is a build error — which is the point, but it means the page
  has to exist before the nav can link to it.
- `eslint` is now the fifth gate in `bun run check`.

### Phase 4 — screen 2, the collapse · 1 day — **DONE**

The reflection-harm result, at `/recovery`. One slope chart, two series, straight 2px
segments, no fill, no point markers, 5 faint gridlines, no y-axis line, a 1px dashed
reference at the round-1 baseline. The y-domain is **pinned to 0–1, never fitted** — the
screen's claim is that one series collapses, so it has to be legible against a fixed
scale or it is a drawing trick.

| File | Role |
|---|---|
| `src/components/marks/SlopeChart.tsx` | the hero. Pinned domain, no smoothing, annotated segment |
| `src/components/marks/PairStrip.tsx` | one paired test, scaled by **total** pairs, with the 6-pair floor as a tick |
| `src/components/screens/Collapse.tsx` | the screen. No `"use client"` |
| `src/app/recovery/page.tsx` | server page → projection |
| `src/model/derive.ts` | `+ harmByTask`, `+ tokenSeries`, and a fix to `reflectionHarm` |

**The screen ships zero JavaScript of its own.** Nothing a reader could drag moves any
number on it, so there is nothing to hydrate, and the rail's control slot stays empty —
the convention `Rail.tsx` exists to enforce.

#### A bug in my own Phase 2 derivation

`reflectionHarm`'s pair key was `(task, model, repeat, round)`. **`a4_reasoning` crosses
`thinking` within the arm**, so every group held two rows per side, and `pairOnApplied` —
correctly refusing to half-use a group — dropped **all 60**. The function returned
`n = 0`, which on screen reads as *"no harm found"* when it means *"no pairs formed"*.
That is precisely the R3 failure, produced by my own code.

With `thinking` and `editFormat` in the key: **`b = 5, c = 9, n = 14, p = 0.42`**. The
other four recovery arms are single-valued on both dimensions, so the fix is a no-op
there — asserted, not assumed.

And it turns a4 into the screen's honest counterweight: **the harm does not replicate on
`nemotron_nano`.** It leans the other way and does not reach significance. Three arms,
three different answers, reported as three rather than averaged into one.

`PairStrip` therefore draws a zero-pair test as *"No pairs formed. Not a null result —
nothing was compared."* A p-value of 1.000 from 8 pairs and no p-value at all are
different claims and must not render alike.

#### Two things the strip shows that a p-value hides

**The discarded majority.** The exact test throws away every concordant pair, so the
strip is scaled by **total** pairs and the 41 discarded ones are drawn — faint, but
drawn. `p = 3.8e-6` from 19 of 60 pairs and the same p from 19 of 19 are different
claims, and the difference should not require reading the method.

**The clustering.** `harmByTask` splits the test per task, and all four run the same
direction (c = 0 everywhere) — but `django__django-11019` supplies **10 of the 19**
discordant pairs alone. The effective sample is nearer 4 than 19. That limitation is now
a figure a reader can see rather than a sentence they can skim.

**Acceptance met:** every number traces to a `derive.ts` function, no component holds a
hardcoded figure, and the rendered HTML was checked to contain `b=19 c=0`,
`19 discordant of 60 pairs`, the corrected token series, `Search text not found 28`, the
`b=5 c=9` non-replication and all four limitation notes. 74 tests, five gates green, and
no row data in any client chunk.

### Phase 5 — screens 1, 3, 4, 5 · 2 days — **DONE**

All six screens exist. The rail has no disabled entries left.

| Screen | Route | Question it answers |
|---|---|---|
| 1 Overview | `/` | Did the experiment measure what it set out to measure? |
| 3 Edit format | `/edit-format` | Does the format decide whether a patch applies? |
| 4 Failure classes | `/failure-classes` | What actually goes wrong? |
| 5 Cells | `/cells` | Which attempt broke, and why? |

**Acceptance met:** every figure traces to a `derive.ts` function and no component
holds a hardcoded number. The Phase 0 placeholder at `/` was the last offender — it
hardcoded all five headline figures as strings.

#### The plain-language layer — a change across the whole console

Requested after Phase 4, and it changes every screen, so it is recorded here rather
than as its own phase.

The console was written for a reader who already knows what `b = 19, c = 0, p = 3.8e-6`
means. That is one of its three audiences. The examiner and the student defending the
work are the other two, and a line of notation serves neither.

**The editorial rule, now enforced everywhere: plain sentence first, notation second as
the receipt. Never notation alone.** That same test now reads:

> Of 60 matched attempts, 19 disagreed: 19 where blind retry worked and reflection did
> not, 0 the other way round. The remaining 41 came out the same both ways and tell us
> nothing. Luck is a very poor explanation for this — a split this lopsided happens by
> luck about 1 in 260,000.
>
> `b=19 c=0 · 19 discordant of 60 pairs`

| File | Role |
|---|---|
| `src/model/glossary.ts` | every term, one plain sentence each, plus `chanceInWords` and `strengthInWords` |
| `src/components/primitives/Plain.tsx` | `Plain`, `Receipt`, `Term`, `TermList`, `ReadThis` |
| `src/model/rows.ts` | `ARM_LABEL`, `ARM_QUESTION`, `STRATEGY_PLAIN`, and `STRATEGY_LABEL` reworded |
| `src/components/primitives/ClassMark.tsx` | `CLASS_PLAIN`, and `classColor` for HTML |

Four rules the glossary is tested against, because a glossary that needs a glossary is
decoration: every definition is a complete sentence; **no definition explains a symbol
with another symbol** (no `θ`, `λ`, `α`, `β`, `p̂` in any `plain` string); none uses
"simply", "just", "merely" or "obviously"; and a term's name is never the symbol it is
explaining.

`chanceInWords` turns a p-value into odds a person can picture — "about 1 in 260,000",
rounded to two significant figures because `1 in 262,144` claims a precision the
estimate does not have. `strengthInWords` deliberately never says "significant": that
word has a technical meaning readers substitute with "important", and the substitution
is the commonest way a statistics result gets misread.

Every screen also gained a **How to read this screen** block (the question, what you are
looking at, what would change your mind) and a **Words used on this screen** list.

#### A number on screen 6 contradicted the data beside it

Screen 6 said *"Format is the class that actually recovered in the pilot, 3 of 3"* three
pixels from a belief of **0.500**. Both cannot be true. `3 of 3` comes from the original
Chapter 5 pilot matrix; `ccos.json`'s FORMAT class — the one the policy actually runs on
— has **10 trials and 5 successes**, which is exactly why the belief is 0.5. The screen
now reads the trials and successes out of the data.

**`README.md` and `BUILD.md` still say 3/3.** They are describing the older matrix, so
they are not wrong, but a reader moving between them and the console cannot tell that.
Say which dataset each figure comes from before either is cited.

#### Screen 4 could not draw what it was specified to draw

The spec says "572 MALFORMED by reason" as the largest block, and that is there. But the
four-class taxonomy is the screen's real subject, and **the live sweep can only ever
produce two of the four**: FORMAT 710, BROKEN 46, **LOGIC 0, LOST 0**.

LOGIC means "the patch applied and the test still failed", and no live row ran a test.
So the class the entire stopping rule hinges on is *structurally unreachable* in the new
data. Drawing a bar at zero would be a lie told with a true number. The screen draws
those two lanes as **grey dashes labelled "not zero — not measurable"**, and the archive
triage sits in its own panel, marked as a different and much smaller dataset.

#### Screen 5 is the only screen that ships rows to the browser

Sorting and filtering 1,604 rows cannot happen on a static server, so the rows have to
travel. They are **fetched, not inlined**: 781 KB, 47 KB gzipped, served from
`public/cells.json` (written by `sync.ts`) and loaded only by the reader who opens that
screen. Inlining would have put ~480 KB into the HTML, duplicated again in the streaming
payload, on a screen most readers never open. `/cells/` is **18 KB**; the next largest
screen is 74 KB.

Consequences worth knowing:

- The fetch URL is **absolute** (`/cells.json`). `trailingSlash` is on, so a relative
  `./cells.json` resolves to `/cells/cells.json` — a 404 that appears only in the
  production export and never in dev.
- It is **windowed, not paginated**. A scrollbar that takes a long time to drag tells
  the truth about 1,604 rows in a way "page 1 of 33" does not.
- This screen therefore has real **loading, empty and error** states, built rather than
  stubbed — which is most of Phase 6 for this screen already done. The error lives
  inside the panel that failed and offers Try again.

#### Three traps

- **`classFill` returns `url(#cm-hatch-logic)` for the patterned classes**, which is
  meaningless as a CSS `background` and fails silently to transparent. Anything that is
  not an SVG shape needs the new `classColor`.
- **`as const satisfies Record<string, Entry>` narrows away optional fields.** Reading
  `.symbol` then only compiles for the terms that have one, so a generic renderer is
  impossible. Fixed by keeping the literal for checking and exporting it widened.
- **Calling `setState` synchronously inside an effect is now an eslint *error***, not a
  warning. The retry button is a counter the effect depends on, so the effect owns every
  state change that follows from it.

#### If a screen throws `Cannot read properties of undefined`

The dev server caches modules across edits and will serve a stale one after a new export
is added to a file it already loaded. Production build and `typecheck` passing while
`next dev` throws is that, every time. Restart it.

### Phase 6 — states and accessibility · 1 day — **DONE**

**Phone was dropped, deliberately.** The console is shown on a laptop and through a
projector at a viva. Building phone layouts would have spent the day on a width nobody
will use, and a 1,604-row table on a 390px screen is not a thing worth having.

What that does *not* mean is "ignore width". The floor still has to not break: every
grid uses `minmax(0, …)` so it collapses to one column under 1280 rather than forcing
the page sideways, and the one fixed-width table sits inside its own `overflow-x-auto`
so it scrolls within its panel. The **ceiling** turned out to be the real risk —
uncapped, a two-column grid on a 27" monitor gives each panel 1,100px, and a chart that
wide reads as decoration. `main` is now capped at `96rem`.

#### Every block now has its four states

| State | Rule |
|---|---|
| Empty | keeps its frame and header, one sentence spanning the block |
| Zero | prints `0`; **never** a dash |
| Missing | grey dash at value size; **never** `0`, never `--` |
| Loading | the final layout with values replaced by flat bars at their real size |
| Error | inside the block that failed, never a page banner |

`PanelEmpty` was written in Phase 1 and used exactly once. It is now on the six-block
table, the reasons lists on screens 3 and 4, the per-bug split on screen 2, and the
filtered table on screen 5.

Two charts could not previously be drawn empty at all. `SlopeChart` with no rounds
divided by zero; `DecisionPlane` with no lanes rendered an axis under nothing. Both now
draw **the grid without the series** and say what is absent — no "No data"
illustration, no padded range.

The contract those states rest on is tested rather than trusted: `armSummary`,
`malformedByReason`, `outcomeKinds`, `holes` and `harmByTask` return **empty lists, not
fabricated zero rows**; a rate over no rows is `0` while a mean over no calls is `null`;
and `mcNemar(0,0)` is distinguishable from a test that compared 8 pairs and found
nothing, **despite both having p = 1.000**.

#### Screen 5's states are real, because its data is

It is the only screen that fetches, so it is the only one where loading and error are
reachable. Loading is 14 rows at the true `ROW_HEIGHT`, so nothing shifts when the data
lands — **no shimmer**, because a pulsing skeleton animates for everyone including
readers who asked for no animation. The error states what failed, **what the snapshot
held when it was last good** (row count and commit), that every other screen is
unaffected, and offers Try again.

Its heading also stopped hardcoding `1,604` as a pre-fetch fallback — it reads the
count from `provenance.json`.

#### Accessibility

- **Skip link** on every screen. Six screens share a rail of six links; without it a
  keyboard reader tabs through all six before reaching the content, every time. `main`
  is `tabIndex={-1}` so the link moves focus rather than only the viewport.
- **Selected is distinct from hover** on a table row. Hover tints; selected tints *and*
  carries a measure-coloured edge — otherwise a reader cannot tell which row they opened
  once the pointer moves away.
- **Every row carries its own accessible name**: bug, strategy, try, run, outcome, and
  whether it is open. The grid has no table semantics to hang column headers on, so the
  name has to be self-sufficient.
- Verified in the built HTML: one `h1` per screen and **no skipped heading levels**,
  `main#content` and the skip link on all six, and **zero** `role="img"` marks without
  an `aria-label`.

Already in place from earlier phases and left alone: `:focus-visible` outlines globally,
`prefers-reduced-motion` zeroing every transition, tabular figures on all table cells,
and `useReducedMotion` on the one animated mark.


### Phase 6b — beUI, and three fixes found by looking at it on a laptop · ½ day — **DONE**

Four @beui components were evaluated against the screens. Two were taken whole, one was
taken and restyled, and one was declined.

#### The rail was never pinned

`Rail.tsx` had `lg:h-dvh lg:overflow-y-auto` — exactly one viewport of height, with its
own scrollbar — and **nothing that positioned it**. The page body was still the scroller,
so the whole flex row slid up together. It looked deliberate, which is why it survived
six phases. `lg:sticky lg:top-0`.

Sticky rather than making `main` the scroller: a non-scrolling body breaks find-on-page,
scroll restoration and the skip-link anchor.

#### `motion`, not `framer-motion`

Every beUI component imports `motion/react`. Both packages are **14.6.0** — same
codebase, `motion` is the current name — so the one import in `DecisionPlane.tsx` moved
and `framer-motion` was dropped. Shipping both would have meant two copies of one
library.

`shadcn add` also replaced `src/lib/utils.ts` (`export { cn } from "cn"`) with the
canonical clsx + tailwind-merge `cn`. That is an upgrade — tailwind-merge resolves
conflicting utilities, which the old one did not — and every component already imported
`cn` from that path, so the swap was transparent. The `cn` package was removed.

#### Taken, and what each one is actually for

| Component | Where | Why |
|---|---|---|
| `table` | screen 5 | virtualised via @tanstack/react-virtual, sorting, column resize and reorder, skeleton, empty state |
| `code-block` | screen 5 detail | the patch is the evidence; it was in a bare `<pre>` |
| `range-slider` | screen 6 | the one control the examiner will physically drag |

**Declined: `timeline`.** It wants an events-over-time story and the sweep has none —
the timestamps record when there was API credit, not a finding. It would have made the
flashiest thing on the site a non-result, on a console whose argument is that it does
not dress up what it measured.

**Declined: `animated-sidebar`.** 32,000 characters of provider, trigger, rail, inset,
header, footer and group for a nav of six links, to fix a one-line `sticky` bug. Its
`shared-layout-bg.tsx` looked useful, but it follows the **pointer**, not the active
item, and its `as` prop takes only `div`/`ul` while this nav is an `<ol>` because the
screens are numbered. The active marker is a `layoutId` instead: **one** element that
moves between items rather than six that fade in and out, which is the only reason the
motion is there — it shows where you came from.

#### Three local changes to vendored files, all marked `LOCAL`

Re-apply after any `shadcn add` upgrade.

1. **`table` has no row click.** Selection is wired only to the checkbox column, and
   there is no `onRowClick`. Master-detail needs one, so `onRowClick` and `activeRowId`
   were added — additive, so omitting them leaves upstream behaviour exactly as shipped.
   The row also takes focus and answers Enter and Space, and the table becomes
   `role="grid"` so `aria-selected` on a row is valid.
2. **`range-slider` used `bg-foreground`.** This console has one accent and it marks
   everything measured or interactive; a grey slider would have been the only live
   control on the site not using it. Two class strings now point at `measure`.
3. **eslint ignores `src/components/motion/**` and `src/components/agents/**`.** The
   vendored files fail two React Compiler rules. Disabling those rules globally would
   stop them catching the same mistake in **our** components — where it already caught
   one, in `Cells.tsx`. The trade is stated rather than hidden: vendored code is
   typechecked and exercised by the build, but not linted.

#### Screen 5 is master-detail now

The old row grid was `2fr 1fr 3rem 3rem 1fr 5rem`. On a laptop the Bug column alone was
**~650px holding ~180px of text**, leaving ~470px of dead space before the next column,
with reply length stranded at the far right edge. Connecting a row to its own number
meant crossing that gap by eye, and opening a row shoved 1,600 rows up and down the page.

The list is now narrow, **the far-right column is gone** — reply length belongs beside
the patch it describes — and selecting a row changes only the pane, which is sticky.

`editable`, `onInsertRow`, `onDeleteRow` and `onColumnRename` are deliberately **off**.
They are opt-in, and a finished experiment that looks editable implies the data can be
changed.

`CodeBlock` gets `language="diff"` only for a real unified diff. A `search_replace`
block is not one, and highlighting it as a diff would paint arbitrary lines red and
green — inventing additions and deletions that are not in the patch.

#### `range-slider` is an accessibility gain, not only a nicer feel

It replaced Radix. `useSlider` handles arrows, PageUp/Down, Home and End, and it sets
**`aria-valuetext`**, which the Radix version did not — a screen reader now announces
the formatted value rather than a bare number. `showTicks` stays **off**: these ranges
are 30 and 100 steps, so dots would be a grey smear, and the labelled values under the
track carry real numbers instead.

One thing that had to be fixed with it: `RangeSlider`'s root takes no `id`, so the
wrapper's `<label htmlFor>` pointed at nothing. A label associated with no control is
worse than no label element, so it is a `<span>` and the name comes from `aria-label`.

#### Measured, not assumed

```
341 KB eager JS per page (~110 KB gzipped) — unchanged by any of this
/cells/ 40 KB · / 49 KB · /stopping-rule/ 42 KB
no row or ccos data in any client chunk
87 tests, five gates green
```

`out/_next/static/chunks` is 15 MB, which is shiki's grammars. **Trimming `langs` to
`["diff"]` saves exactly nothing** — measured, 15 MB before and after — because the
`shiki` entry point bundles every grammar and `langs` only selects which to load at
runtime. Trimming it would have added a throw on any other language for no gain, so it
was reverted. Real trimming needs `shiki/core` with explicit grammar imports, which is a
genuine fork of `agent-code.tsx`. The grammars are lazily chunked and never fetched, so
this costs deploy artifact size and nothing a reader experiences.


### Phase 7 — gates, deploy, handover · ½ day

```sh
cd console
bun run contrast        # every token pair
bun run test            # derive.ts
bunx tsc --noEmit
bun run build           # writes out/ — there is no separate export command
```

| Item | State |
|---|---|
| The five gates, green on a clean checkout (17s) | **done** |
| `console/vercel.json` — `bun run check` as the build command | **done** |
| `recovery-bench/docs/LIMITATIONS.md` | **done** — 34 figures, all re-derived |
| λ corrected in `BUILD.md` | **done** |
| Vercel production deploy, URL recorded in `README.md` | **PENDING** — needs Aayush |
| Zenodo archive for the DOI | **PENDING** — blocked on repo ownership |
| A 90-second viva demo script | **done** — the explainer is it |
| A visual explainer of the method | **done** — six acts at `/how-it-works` |

**The deploy needs one thing `vercel.json` cannot set:** in the dashboard, **Root
Directory → `console`**. Without it Vercel builds from the repo root, finds no Next app
and fails. Framework auto-detects as Next.js; leave Build and Output Settings on
default, because the config overrides them. The build command is `bun run check`, not
`next build`, so a failing contrast ratio, test, type error or lint error **fails the
deploy** — a wrong number cannot reach an examiner through a green deployment.

**The Zenodo DOI is blocked, not forgotten.** `ENGINE.md` requires the repository to
move under `Lagadnakul` before the Data Availability statement is written, and the
authorship question is unresolved. Minting a DOI against the wrong owner is not
reversible.

**Two things that were on this list and should not have been.** `data/ledger.jsonl` was
listed as "the 1,428-call audit trail, still gitignored". It is **36 entries** from
30 September 2026 — doctor probes and a four-task pilot — and `recovery-bench/.gitignore`
already gives the correct reason to exclude it: per-machine spend state, which on a fresh
clone would appear as tokens already spent and would conflict on every run. It also
carries a `keyName` field. The real audit trail, `sweep_rows.jsonl`, is committed.
Separately, the λ claim was reported as wrong in two `recovery-bench` source comments;
it was not. `analysis/ccos.ts` already states *"the pilot provides no evidence that
context rot exists at all"* and returns `null` unless decay is genuinely excluded. Only
`BUILD.md` carried it unqualified.

---

### Phase 8 — the explainer · 1 day — **DONE**

A seventh screen at `/how-it-works`, first in the rail and unnumbered, for the reader who
does not yet know what to ask. Six acts, each one a scene that plays itself:

| Act | What it shows |
|---|---|
| 1 An agent that never stops | the problem: retries cost real tokens and nothing says stop |
| 2 The question nobody asked | 718 attempts hit a barrier labelled *did the fix actually work? never asked* |
| 3 How you ask decides what you get | 96.4% against 13.1%, from one word in the prompt |
| 4 Thinking about the mistake makes it worse | the two lines crossing, and why |
| 5 When should it stop? | a dot, a line, and every shipping agent as that rule at an extreme |
| 6 What it still needs | the ledger: **2 of 7** quantities measured |

**It replaces the 90-second viva demo script.** Scrolling it end to end *is* the demo:
the argument runs in order, the presenter talks instead of scrolling, and the numbered
buttons jump straight to a step when an examiner asks about one.

#### Played, not scrolled — and that was a correction

Built scroll-driven first, with pinned scenes scrubbed to scroll position. Wrong for the
job: in a viva the presenter is talking, and an examiner across a desk cannot drive the
page. Replacing scroll with a play button also deleted the whole pin-versus-sticky-rail
risk, which was the thing the architecture had been most worried about.

Nothing autoplays. WCAG 2.2.2 wants a stop control on anything auto-playing past five
seconds; an explicit play button satisfies that by construction, and the scene stays
still and readable until someone wants it to move.

#### Two bugs in the player, both the same shape

- **`settle()` then `tl.set()` at position 0.** A paused timeline never renders its first
  frame, so the set never applied and every act opened fully revealed. Content is now
  visible in the markup by default and `fromTo`'s immediate render hides it at build
  time — which also makes the no-JavaScript and reduced-motion states correct rather
  than blank.
- **`onUpdate` wired in the constructor.** GSAP renders tweens as they are created, so it
  fired during construction and the player reported the last step before anyone pressed
  anything. Callbacks attach after the rewind now.

#### The drawings are proportional, never rounded

Every figure is derived, and so is every length. Act 2's bands are 77.9px and 96.1px on
one 180px span — ratio 0.8104 against the real 718/886 = 0.8104, with the gap taken
*out* of the span so both share one scale. Act 3's bars are 414.5px and 56.1px on one
430px track, 7.3830 against the real 7.3830. Act 5's line animates to thresholds carried
on the element as data attributes, so the position it moves to and the figure the prose
quotes are the same derived number.

The alternative everyone reaches for — one square per ten attempts — would have meant
160 squares standing for 1,604 and 71.8 rounding to 72.

#### Layout traps specific to SVG

**`<text>` does not wrap.** A two-sentence class description ran straight across act 5's
plot and under both lanes. There is now an **anchor-aware overflow check** —
`textAnchor` decides which edge the text grows from, so centred and end-anchored strings
are not falsely flagged — and it caught two more lines in act 2 after the type was
raised a step throughout.

**GSAP writes its own SVG transforms** and ignores the CSS `transform-origin`, so act 2's
bands would have grown outwards from their centres. Origins go on the tween.

#### Reduced motion removes the player, not just the motion

A sequence whose content *is* movement has nothing to soften, so under
`prefers-reduced-motion` the scene renders complete and still and the controls are
replaced by a line saying why. Doing nothing is the correct static state, because the
content is visible in the markup by default.

The global `prefers-reduced-motion` rule in `globals.css` does **not** cover this: it
neutralises CSS animation, and GSAP writes inline styles from JavaScript. The gate is
`gsap.matchMedia()`.

#### Cost

`gsap` + `@gsap/react` is ~130 KB and loads on this route only — verified, the chunk is
referenced by exactly one page. Every other screen is unchanged at 341 KB eager.

## 7. Decisions

Both of the console's open questions were settled on 26 October and are recorded where
they apply: **Instrument Sans** in §4 *Type*, **persistent rail with screen-aware
controls** in §4 *Layout*. Nothing in the console is waiting on an answer.

Carried from `ENGINE.md` §9, not blocking the console but blocking the paper: **the
equivalence margin** (the comparable study uses 5 percentage points), and **N**, which
follows from it. Both need the supervisors.

One more, unrelated to the console but noticed while running the gates: **the derived
JSON files carry a `generated_at` timestamp**, so `bun run report` and `bun run ccos`
dirty `recovery-bench/data/ccos.json` and `chapter5_figures.json` on every run even when
no value changed. It makes the derived outputs undiffable and will eventually get a
timestamp-only change committed as if it were a result. Worth dropping the field, or
pinning it to the input's commit, before Stage 1.

---

## 8. The short version

Build the instrument first. Keep one accent, two type families, three motion moments.
Let every number be mono and tabular, and every mark carry a value. State R1, R2 and R3
on the screens themselves rather than in a footnote — they are the reason it will read as
serious rather than decorated.

**Estimate: 9 days of work in the 1–13 November window, with screen 6 done by 4
November.**
