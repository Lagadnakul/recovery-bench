# Dashboard Design Specification

Step 7 of the implementation. This document was written as the design contract
for `packages/dashboard/` before any code existed, and has been updated to record
what was actually built — including the four places the running page disagreed
with the plan.

**Status: built.** `bun run dev` in `packages/dashboard/`. 127 palette checks,
59 dashboard tests inside the suite's 433.

Three skills were consulted and are cited where they decided something:
`ui-ux-pro-max` (searchable UI/UX data), `frontend-design` (aesthetic direction),
and `vercel-react-best-practices`. Where a skill's recommendation was rejected,
the rejection and its reason are recorded — the same standard `DECISIONS.md`
holds the pipeline to.

---

## 1. Subject, audience, job

`frontend-design` opens by requiring the subject be named before anything is
designed. For this brief:

> An **instrument panel** for a failure-recovery experiment. Audience: Nakul,
> his examiners, and anyone re-running the sweep. Primary job: **find the cells
> that did something surprising**, out of 1,308.

The job matters more than it sounds. Step 6 writes one row per cell carrying its
outcome, evidence provenance, comparability flag and the model's full response —
so every quantity the dashboard shows has **already been computed by the
pipeline**. The dashboard filters, compares and inspects. It never calculates.

That single fact decides §7's largest call: a page that does no arithmetic does
not need a charting library.

---

## 2. What the skill data recommended, and what was rejected

The query run, with the design dials set for a dense instrument panel:

```sh
python3 scripts/search.py \
  "research benchmark analytics dashboard scientific data" \
  --design-system --variance 4 --motion 2 --density 8
```

| Skill output | Verdict |
| --- | --- |
| Style: **Data-Dense Dashboard** — light + dark, accessibility risk `low` | **Keep** |
| Density dial 8 → 8–32px spacing scale | **Keep** |
| Typography: **JetBrains Mono / IBM Plex Sans** (result 3) | **Keep** |
| Pre-delivery checklist, 7 items | **Keep — binding, see §9** |
| Heatmap rule: values *and* texture in cells, never colour alone | **Keep — see §3** |
| Pattern: **"Enterprise Gateway"** — hero video, Solutions by Industry, Client Logos, *"Contact Sales"* CTA | **Reject** |
| Colours: `#1E40AF` blue + `#D97706` amber | **Reject** |
| Motion: GSAP `ScrollTrigger` fade-and-slide reveal | **Reject** |

### Why the pattern is rejected

It is a B2B marketing landing page. The `landing.csv` domain was pulled in
because the word "dashboard" matched a product row. This is an internal
instrument with no conversion funnel and no visitor to persuade; there is
nothing to sell, and a "Contact Sales" button would be absurd.

### Why the palette is rejected

Two reasons. The weaker one: `#1E40AF` / `#D97706` is default Tailwind
`blue-700` + `amber-600`, and `frontend-design` lists precisely this kit among
the commonest tells of a generated page.

The decisive one: **the explainer already assigns meaning to those hues.**
`explainer/style.css` defines `--format: #a8521a` as format-class failure and
`--logic: #3d5a8c` as logic-class. An amber accent on buttons and links would
read as "format failure" to anyone who has looked at the explainer. A hue that
already carries a finding cannot be spent on chrome.

### Why the motion is rejected

`frontend-design` names scroll-triggered fade-and-slide-up as a generic
AI-generated tell, and a dashboard has no scroll narrative to reveal. Motion
here answers user actions only (§8). No GSAP dependency is added.

---

## 3. The data constraint found while surveying

`data/sweep_rows.jsonl` is **gitignored** — per-run experimental output, and
correctly excluded. Only `replay_rows.json` (the original study, 95 cells) and
`chapter5_figures.json` are committed.

So **a fresh clone has no sweep data at all.** Two load-bearing consequences:

1. The committed replay rows are the **always-available** dataset. The dashboard
   opens on those, not on the sweep.
2. A missing sweep file is a **first-class empty state**, not an error:
   *"No sweep has run on this machine. Run `bun run sweep --run --yes` to fill
   this view."*

The second point is not cosmetic. If the dashboard rendered a missing file as
`0 cells APPLIED`, it would reproduce in the UI the exact defect the whole
project was built against — **a failed or absent cell leaving no record**
(`DECISIONS.md` D15). It must never show a zero where it means "no data".
`frontend-design` is independently explicit that an empty screen is an
invitation to act; here it is also a correctness requirement.

---

## 4. Colour

### The rule the token file exists to enforce (D30)

Two palettes, which never borrow from each other:

- **chrome** — teal and slate. Hero, panel headers, controls, focus ring.
  Navigation and structure. Means nothing about the experiment.
- **status** — the nine outcome colours plus the two failure classes. Every one
  of them carries a finding.

The explainer already teaches a reader that ochre means format-class failure and
slate-blue means logic-class failure, so an ochre button would say "failure" on a
control that means nothing of the sort. The one exception is the two headline
cards, filled with the hue of the class they report — there the colour and the
claim are the same thing.

### Base tokens

Carried from `explainer/style.css` so the two artefacts read as one project
(`ARCHITECTURE.md` §7), with three additions the explainer has no need for:

| Token | Light | Role |
| --- | --- | --- |
| `--paper` | `#f3f5f6` | page |
| `--surface` | `#ffffff` | panels |
| `--surface-2` | `#eaeef0` | table zebra, rails |
| `--ink` | `#16202a` | body text |
| `--ink-soft` | `#4a5a68` | secondary text |
| `--ink-faint` | `#7b8a96` | labels, axis ticks |
| `--rule` | `#d9e1e5` | hairlines |
| `--accent` | `#116b63` | interactive — teal, the one unclaimed hue |
| `--edge` | `#7f8a93` | **added.** `--rule-strong` sits at 1.80:1 — fine for a divider, a WCAG 1.4.11 failure for the border of something clickable |
| `--surface-3` | `#dce5ea` | **added.** the inside of a tinted panel header |
| `--hero` / `--hero-2` | `#0d3b3a` / `#10514c` | **added.** the hero band's two gradient stops |

Dark mode is **stepped by hand, never inverted** — `ARCHITECTURE.md` §7 requires
it, and an automatic inversion would take the ochre that means something and
produce a hue that means nothing. It is declared twice, under `@media
(prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])` and
under `:root[data-theme="dark"]`, because a manual toggle has to beat the system
preference. Those two lists are maintained by hand, so the gate asserts they are
identical — nothing else would notice them disagreeing.

### The status palette — the one genuinely project-specific decision

Nine outcomes in `OUTCOME_KINDS`. `ARCHITECTURE.md` §7 reserves a status palette
for them, separate from any categorical series hue. The encoding here uses **two
channels, not one**:

> **Hue = what the cell tells you.
> Saturation = whether it tells you anything about the model at all.**

| Outcome | Token | Light | Reads as |
| --- | --- | --- | --- |
| `APPLIED` | `--st-good` | `#2d6a4a` | patch landed |
| `CONTAMINATED` | `--st-alarm` | `#8c2f39` | validity threat — own hue, never pooled |
| `MALFORMED` | `--st-format-3` | `#8f4616` | format-class, deepest |
| `APPLY_FAIL` | `--st-format-2` | `#a8521a` | format-class (= explainer `--format`) |
| `NO_PATCH` | `--st-format-1` | `#c0773f` | format-class, lightest |
| `NO_OUTPUT` | `--st-silent` | `#6b5a44` | model said nothing — desaturated ochre |
| `TRUNCATED` | `--st-limit` | `#7e8c98` | **instrument limit** |
| `BUDGET_STOP` | `--st-limit` | `#7e8c98` | **instrument limit** |
| `PROVIDER_ERROR` | `--st-limit` | `#7e8c98` | **instrument limit** |

Two glyph colours, not one. White clears 4.5:1 on the dark end of the ramp and
reaches only **3.53:1** on `--st-format-1`, so each status names its own
`onToken` (`--on-status` or `--on-status-ink`) and the gate checks the pair the
grid actually draws rather than assuming white everywhere. Assuming white is what
hid two failures on the first run.

The three outcomes satisfying `isInstrumentLimit()` are deliberately **grey and
hatched**, sharing one token. That predicate exists in `packages/core/types.ts`
precisely to say *this cell is evidence about the harness, not about the model.*
Colouring a provider's 429 as failure would let it look like the model failing —
the exact misattribution D18 was written to prevent. Grey plus a 45° hatch reads
as "no data here" at a glance across 1,308 cells.

The three format-class outcomes share one hue in three steps because
`isFormatClass()` groups exactly those three. `TRUNCATED` is **not** among them
(D18), and the palette must not imply otherwise — which is why it is grey rather
than a fourth ochre step.

### Never colour alone

Every grid cell carries **three** redundant signals: fill, a 45° hatch for
instrument limits, and a one-letter glyph (`A` `C` `M` `F` `N` `·` `T` `B` `E`).
The `ui-ux-pro-max` heatmap row demands exactly this — *"print values or symbols
in cells and use texture/labels in addition to the color scale. Do not rely on
color alone."*

### Validation is scripted, not eyeballed

`scripts/check_contrast.ts` asserts every token pair at >= 4.5:1 for text and
>= 3:1 for non-text, in **both** modes, and **fails the build** otherwise. It
runs as a test too, so a palette regression fails `bun test` on a machine that
never builds the dashboard. **127 checks** at the time of writing.

It earned its place twice. On its first run it failed `--rule-strong` at 1.80:1,
which is what produced `--edge`. And it was itself broken for a while — reporting
82 passes while checking dark mode twice and light mode never, hiding five real
failures. See **D31**; the parser now locates a block's brace with a
whitespace-only scan and `tests/dashboardPalette.test.ts` checks it against a
fixture with known values.

---

## 5. Type

Changed after the first render. The original choice — IBM Plex Sans, carried from
the explainer — was correct for the explainer's prose and wrong here: it set
nearly every string between 11 and 13px, which left the page with no hierarchy at
all. Everything equally loud is everything equally quiet.

| Role | Face | Why |
| --- | --- | --- |
| UI, headlines, body | **Plus Jakarta Sans Variable** (200–800) | `ui-ux-pro-max` names it for "SaaS products, web apps, dashboards, B2B". Warmer and rounder than IBM Plex, so the page reads as human rather than institutional. Its 800 is genuinely heavy, which is what makes a display size work without growing further. |
| Mono — patches, diffs, cell keys, every number in a column | **Geist Mono Variable** (100–900) | Cleaner than JetBrains Mono at small sizes in a dense table, and unambiguous `0/O` and `l/1/I`, which matters when the content is a diff being judged for malformedness. |
| Display serif | **none** | Spectral is right for the explainer's prose. A dense instrument panel has no long-form reading, so a serif display here would be decoration. |

Self-hosted via Fontsource, versions verified on npm:

```
@fontsource-variable/plus-jakarta-sans   5.3.0
@fontsource-variable/geist-mono          5.3.0
```

Not a Google Fonts `<link>`. The build is `base: "./"` static assets (D11) and
must work opened from `file://` with no network; a CDN stylesheet fails silently
offline and falls back to system faces.

`src/fonts.css` declares the four faces by hand — **latin and latin-ext only**.
Importing Fontsource's `index.css` pulls in Cyrillic, Greek and Vietnamese
subsets: twelve font files, about 110 KB, for an interface whose vocabulary is
ASCII plus a few typographic marks. The browser would never download them
(`unicode-range` sees to that), but `dist/` is a folder someone copies around.
The filenames are pinned by the lockfile, and Vite fails the build on an
unresolved `url()` rather than quietly falling back — which is why they are
written out rather than globbed.

### Scale

```
38 / 24 / 18 / 15 / 13 / 11 px
body 15px, line-height 1.55, letter-spacing -0.005em
headings -0.02em, display -0.03em
font-variant-numeric: tabular-nums      ← global
```

Body went from 13px to 15px. Three typographic defaults `frontend-design` names
as tells, and which this page does not use: tracked-out ALL-CAPS eyebrows above
headings, meta strings joined with middle dots, and a `→` glued to link text.

## 6. Layout

### Reading order is the argument

The page opens with the question and its answer, then the two numbers that *are*
the answer, and only then the attempts those numbers came from. Controls sit
beside the evidence, not above the finding — a reader who has not been told what
the study found has no reason to filter anything.

The hero band is a deep-teal gradient carrying the study's question in 38px, the
answer under it, and a faint grid of the project's own unit (one square per cell)
as texture. That texture is drawn from the subject matter rather than being a
decorative wash.

Spacing scale at density 8: `4 / 8 / 12 / 16 / 24 / 32 / 48`.

Radius is **not** uniform — `3px` on cell chips, `6px` on controls, `10px` on
panels, `14px` on the hero. One radius on everything regardless of hierarchy is
item 4 on `frontend-design`'s generated-design tell list; the variation encodes
hierarchy instead of decorating it. Elevation is spent in exactly two places: the
hero and the two headline cards.

```
┌────────────────────────────────────────────────────────────────────────┐
│ recovery-bench          [replay ▾] [sweep]            1,308 cells  ◐  │  48px
├──────────┬─────────────────────────────────────────────────────────────┤
│ FILTERS  │  3/3 format-class       0/4 logic-class      59% budget     │
│          │  recovered              recovered            of 24.0M      │  stat
│ arm      │                                                            │  tiles
│ ▸ a1 ·28 │─────────────────────────────────────────────────────────────┤
│ ▸ a5 ·—  │  localise → prompt → call → parse → apply → record         │  pipeline
│          │     ●        ●        ●       ●       ◐        ○            │
│ model    │─────────────────────────────────────────────────────────────┤
│ ☑ nemo   │  THE GRID            round ▸ 0  1  2                        │
│ ☐ muse   │  django-11099    A  M  M     ← lineage, one row             │
│          │  astropy-14182   A  F  ▨     ▨ = instrument limit           │
│ outcome  │  sympy-13177     ·  ·  ·                                    │  grid
│ ☑ 9 kinds│  … 1,044 lineages, virtualized only if measured slow        │
│          │─────────────────────────────────────────────────────────────┤
│ ☐ not    │  apply rate by edit format            [chart] [table]       │
│   compar-│  search_replace  ████████████░░░░░░░░  12/20                │  bar
│   able   │  unified_diff    ███░░░░░░░░░░░░░░░░░   3/20                │
│          │─────────────────────────────────────────────────────────────┤
│          │  django-11620 — the retrofit                                │
│          │  ┌─ unified diff ─ APPLY_FAIL ─┐┌─ SEARCH/REPLACE ─ APPLIED│  diff
└──────────┴─────────────────────────────────────────────────────────────┘
```

Left rail 232px, content fluid to a 1440px maximum. **Left-aligned
throughout** — centred text in an instrument panel costs scanning speed.

Breakpoints 375 / 768 / 1024 / 1440. Under 1024 the filter rail becomes a sheet
and the grid gets an `overflow-x` wrapper — the skill's Responsive →
Table Handling row, severity Medium: *"use horizontal scroll or card layout;
don't let wide tables break the layout."*

### Where the boldness is spent

`frontend-design` requires boldness be spent in one place. The first build spent
it on **the grid** and nothing else, and the result read as a static HTML file:
six identical white panels with identical hairline borders stacked in identical
rhythm, colour present only in 20px chips.

It is now spent on **the opening** — the hero band and the two filled headline
cards — with the grid as the second, quieter focus. That is a change of plan made
after looking at the rendered page, and it is the right way round: the grid is
what an examiner explores, but the finding is what every reader needs first.

The six views and their forms are fixed by `ARCHITECTURE.md` §7 and are not
revisited here.

---

## 7. Stack

As installed:

```
vite                                 8.3.2
react / react-dom                   19.3.0
tailwindcss + @tailwindcss/vite      4.3.3
@vitejs/plugin-react                 6.1.1
typescript                           7.x     (the workspace's)
clsx · tailwind-merge · cva                  (shadcn/ui's utility layer)
```

**shadcn/ui** is available for the chrome and its Radix primitives are a real
improvement over hand-rolled controls. It is not used for charts — see D29 and
the next heading.

### Tailwind v4, CSS-first

No `tailwind.config.js`. v4 declares tokens in CSS via `@theme`, so the status
palette lives in **one** `tokens.css` that both `packages/dashboard/` and
`explainer/style.css` import. One source of truth for the nine colours; a
change cannot land in one and not the other.

### No chart library

Deliberate, and the biggest call in this document. Every charting rule
`ARCHITECTURE.md` §7 imposes is a fight against a library's defaults:

- a zero value must draw **no bar** — Recharts draws a 1px stub
- a **dashed full-scale track** must show the denominator
- every chart needs a paired **table view**
- **no dual axes**, anywhere

Across the six views the actual drawing is two bar rows, one SVG pipeline, one
CSS-grid matrix, and three non-charts. Hand-rolled inline SVG plus CSS grid is
less code than configuring a library to stop doing things, and saves roughly
110 KB. Recharts 3.10 remains the fallback if a later view needs real axes and
tick formatting.

### No chart library (D29)

Every charting rule `ARCHITECTURE.md` §7 imposes fights a library's defaults: a
zero must draw **no bar** (Recharts draws a 1px stub), a dashed full-scale track
must show the denominator, every chart needs a table view, and no dual axes ever.
Across the six views the drawing is two bar rows, one SVG pipeline, one CSS-grid
matrix and three non-charts. Hand-rolled is less code than configuring a library
to stop doing things, and about 110 KB lighter. Recharts remains the fallback if
a later view needs real axes and ticks.

### No virtualization yet

`@tanstack/react-virtual` 3.14 is the right tool if it is needed, but
`vercel-react-best-practices` and the skill's own `react` stack rows are explicit
that memoization and virtualization are **measured** optimizations, not blanket
defaults (*"Use React.memo for pure components with stable props and real render
cost; don't memoize every component or use it as a guess"*). 1,308 rows is
borderline. The render budget gets measured first, virtualization added only if
it misses, and the result reported either way.

### The property that makes this worth building

`src/` imports `Outcome` and `Row<V>` from `packages/core` — the same types the
pipeline writes. Adding a tenth outcome **breaks the dashboard's `tsc`** rather
than producing a chart that silently drops a category. `resolveRate` still
refuses apply-verified rows at compile time, so no view can show a resolve rate
over sweep data. This is the same integrity rule as §6 of the architecture,
enforced by the same type system rather than by a second set of tests.

---

## 8. Motion

User actions only. Nothing on load, nothing on scroll.

| Trigger | Change | Duration |
| --- | --- | --- |
| filter toggled | grid cells cross-fade | 120ms `ease-out` |
| cell clicked | detail panel slides in | 180ms |
| diff section expanded | height to auto | 160ms |
| hover on a cell | 1px ring, no movement | 100ms |

All of it wrapped in `prefers-reduced-motion: reduce` → `0ms`, final state
rendered immediately.

---

## 9. Accessibility — a build gate, not a review step

`ui-ux-pro-max` ranks this priority 1, CRITICAL. Binding checks:

- scripted contrast >= 4.5:1 text and >= 3:1 fills, both modes — **build fails
  otherwise** (§4)
- the grid is a real `<table>` with `scope`, arrow-key navigable; focus reveals
  the cell's outcome and reason **as text**
- every chart has a table toggle (`ARCHITECTURE.md` §7, non-negotiable)
- visible focus ring everywhere; never `outline: none`
- 44×44px minimum on every control. Grid cells are 20px by design, so they also
  expose a row-level control that meets the minimum
- no emoji as icons — `lucide-react`, SVG only
- `cursor-pointer` on everything clickable
- responsive verified at 375 / 768 / 1024 / 1440

---

## 10. Copy

`frontend-design`'s writing rules, applied to labels that already exist in the
code:

- **User-facing names, not internal ones.** A headline reads *"patch never
  applied"*, not `APPLY_FAIL`. The raw token stays visible in the detail panel,
  because that is what `jq` shows and a reader cross-checking the JSONL needs to
  find it.
- **Empty states direct.** *"No sweep has run on this machine."* Not a spinner,
  not a zero (§3).
- **Errors state what happened and what to do.** No apology, no vagueness.
- **Sentence case throughout.** No ALL-CAPS labels.

---

## 11. The three decisions, as resolved

1. **Fonts** — proposed IBM Plex Sans + JetBrains Mono; **changed after the
   first render** to Plus Jakarta Sans + Geist Mono (§5). The original was not
   wrong about legibility, it was wrong about register: too institutional, and
   paired with a type scale that had no hierarchy in it.
2. **Zero chart dependencies** — **kept** (D29).
3. **Instrument limits grey and hatched** rather than coloured as failure —
   **kept**, and it is the choice this document is most confident in. A
   provider's 429 painted in a failure colour would read as the model failing,
   which is the misattribution D18 exists to prevent.

---

## 12. What the rendered page disagreed with

Four things, none of which any test could have caught, all found by screenshotting
the running dashboard. Recorded because the lesson generalises: a design document
is a hypothesis.

1. **It never stated its own finding.** `3/3` and `0/4` under four-word labels,
   and nothing anywhere said what the study asked or concluded. Fixed by the hero
   and by `model/narrative.ts`, which derives the sentences from the figures so a
   claim cannot drift from its number (D32).

2. **It spoke in internal vocabulary.** cell, lineage, arm, round, format-class,
   instrument limit, "not comparable to Chapter 5". Leaf labels were in plain
   words; every structural term was not. Fixed by the glossary and the `<Term>`
   component.

3. **A single bar claimed to be a comparison** (D33). "Apply rate by edit format"
   drew one bar and still printed *"the two bars are comparable"*.

4. **The denominator was the finding, and it was a footnote** (D33). 5/8 in large
   type, "23 set aside" in 11px grey — when those 23 were three-quarters of
   everything in view.

The last two are the D18 category error reappearing at the presentation layer.
Excluding instrument limits from the arithmetic was necessary and not sufficient:
the exclusion has to be as visible as the number it changes.

---

## 13. Out of scope

`l3_constrained` and `l4_tool_grounded` (step 8). Any change to `Self.docx` —
the document is final and is never edited. Any view that computes a number the
pipeline has not already written.
