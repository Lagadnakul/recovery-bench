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
2. **Reflection helps once, then poisons.** 550B model: blind retry 75 / 75 / 80 / 75
   across rounds 1–4; reflection **90 / 45 / 40 / 50**. Paired exact McNemar on rounds
   2–4: **b = 19, c = 0, p = 3.8e-6**, no reversals in any of the 4 tasks. The 30B model
   is null: `b = 4, c = 4, p = 1.000`. Mechanism: completion tokens climb monotonically
   with reflection depth (1125 → 1284 → 1317 → 1397) while blind retry sits flat near
   740, and 29 of 30 MALFORMED rows are `search_not_found` — the model anchors on its own
   prior output instead of the file. **The prescription is K = 1.**
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

### Phase 2 — the data layer · 1 day

The highest-risk phase. Everything downstream inherits its mistakes.

```
console/scripts/sync.ts        reads ../recovery-bench/data/* → src/data/*.json
console/src/data/              committed, so the build is hermetic
console/src/model/rows.ts      zod schema from §3, parsed once
console/src/model/derive.ts    every aggregate, pure functions, unit-tested
```

Derivations to implement, each with a test:

| Function | Returns |
|---|---|
| `armSummary()` | rows, applied, malformed, refused-by-design, real errors, calls, tokens, wall time |
| `splitProviderError()` | `{ byDesign: 130, real: 46 }` — **R2, reason prefix not status** |
| `applyRateByFormat()` | a5's paired columns |
| `roundSeries()` | apply rate per round per strategy per model |
| `pairedMcNemar()` | `{ b, c, n, p }` exact, two-sided binomial at ½ |
| `malformedByReason()` | sorted, with `block_unterminated` relabelled |
| `holes()` | the 32 unrun cells with their lineage reason — **R3** |
| `thetaFor(G, r, h, q)` | `θ_c = q_c − (h − r)/G` |
| `classify(row)` | FORMAT / LOGIC / BROKEN / LOST, from `outcome` only |

**Acceptance:** `armSummary()` reproduces §3's table exactly. `splitProviderError()`
returns 130/46. Totals equal 1,604 rows / 1,428 calls / 18,102,295 tokens. A test asserts
`evidenceSource === "none"` on every live row, so R1 can never silently become false.

### Phase 3 — screen 6, the instrument · 2 days

**Build this first.** It is the hardest, the most impressive, and the literal answer to
the professor's question. If the schedule slips, you want the irreplaceable thing
finished rather than five conventional screens and a gap.

The field of 1,604 cells, θ drawn across it, three sliders in the rail. Drag `h` and the
cells migrate across the boundary; the counts recount as they move. The formula sits
under the sliders, as text:

```
RETRY  ⟺  p(c,k) > θ_c          θ_c = q_c − (h − r)/G
```

Finding line: the stopping rule is a threshold on a belief, and the four arms in the
literature are **one algorithm at four values of θ** — Stubborn −∞, Needy +∞, Random
ignores class, CC-OS θ_c. Add a control that snaps to each, so the professor can see the
baselines *are* the same rule.

Every curve here is **illustrative**, so every one carries the caption from §2. The cells
are real; the policy outcome is not measured.

**Acceptance:** dragging a slider re-sorts real cells at 60fps. Reduced-motion gives
instant re-sort. Four arms reachable from one control. Every synthetic mark captioned.

### Phase 4 — screen 2, the collapse · 1 day

The reflection-harm result. One slope chart, two series, straight 2px segments, no fill,
no point markers, 4 faint gridlines, no y-axis line, a 1px dashed reference at baseline.
The r1→r2 inversion annotated **with its cause**, not just a marker.

Beside it the paired-test panel: `b=19 c=0 n=60`, the 6-pair rejection floor drawn as a
reference line, and a2's `b=4 c=4 p=1.000` for contrast.

Body text must say: 4 tasks, 5 repeats, pairs cluster within task.

**Acceptance:** numbers match §3 finding 2 exactly. The clustering limitation is on
screen, in prose.

### Phase 5 — screens 1, 3, 4, 5 · 2 days

| Screen | Question | Largest block |
|---|---|---|
| 1 Overview | Did the experiment measure what it set out to? | the six-arm table |
| 3 Edit format | Does the format decide whether a patch applies? | a5's paired columns |
| 4 Failure classes | What actually goes wrong? | 572 MALFORMED by reason |
| 5 Cells | Which cell broke, and why? | the 1,604-row table |

Screen 1 opens with a divided KPI strip — **one container split by 1px rules, not four
cards**, no icons, no sparklines:

```
Cells      Calls      Tokens     Arms       Refused by design
1,604      1,428      18.1M      6 of 6     130
```

Screen 5 is a real data table: virtualised, sortable, filterable by arm / model /
strategy / outcome / round, each row expanding to its patch and stderr. The holes appear
as holes.

**Acceptance:** every figure traceable to a `derive.ts` function. No hardcoded numbers in
any component.

### Phase 6 — states, phone, accessibility · 1 day

Half the build, and the half that separates professional from demo.

For every block: empty, zero, loading, error. For every row and control: hover, selected,
focus, disabled.

- A real zero prints `0`, never a dash. A missing value is a grey dash, never `--` at
  value size.
- An empty section keeps its frame and header, and adds one sentence spanning the block.
- An empty chart is drawn — zero line, missing bars, no padded range, no "No data"
  illustration.
- Loading is the final layout with each value replaced by a flat grey bar at its real
  size. No shimmer, no layout shift when data lands.
- An error lives **inside the block that failed**, never as a page banner: what failed,
  when the data was last good, and a Retry text button.

Phone: rail folds to a 48px top bar, KPIs become 2 columns, charts full width at
160–200px with 3–4 x labels, **the table becomes two-line rows** — identity and key
figure on line 1, the rest in 13px grey on line 2. Never a sideways-scrolling page.

Keyboard: visible focus everywhere, sliders arrow-key operable, the table navigable.

**Acceptance:** 0 failures at 1440, 768 and 390 on the **production build**. Every state
reachable in a dev-only state gallery.

### Phase 7 — gates, deploy, handover · ½ day

```sh
cd console
bun run contrast        # every token pair
bun run test            # derive.ts
bunx tsc --noEmit
bun run build           # writes out/ — there is no separate export command
```

- Vercel production deploy, URL recorded in `README.md`.
- `recovery-bench/docs/LIMITATIONS.md` — referenced from several documents, still never
  written. R1, R2, R3, the 4-task clustering, and the 460–765 power requirement.
- Zenodo archive for the DOI, after the repo-ownership question is settled.
- A 90-second demo script for the viva: open screen 6, drag `h`, say one sentence.

---

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
