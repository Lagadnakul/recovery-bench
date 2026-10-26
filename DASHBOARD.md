# The console — design specification

**For:** Lagad Nakul Kiran · **Written:** 26 October 2026 · **Status:** plan only, nothing built
**Companion to:** `BUILD.md` §5 (the phase), `recovery-bench/docs/DECISIONS.md` (D0–D36)

This replaces `BUILD.md` §5. That section was written on 24 October, before any
live data existed; it specified six views over the archive. The sweep has since
finished — 1,604 rows — so the screens are rebuilt around what was measured
rather than around what was hoped for.

**This is a new build.** `recovery-bench/packages/dashboard` is not extended,
not restyled and not referenced. It stays on disk until the new package passes
its gates, then it is removed in one commit.

---

## 1. Where it lives

```
recovery-bench/packages/console/
```

React 19 + Vite + Tailwind v4, Bun, `base: "./"` so the build is a folder that
opens from `file://` with no server. Same workspace, new package.

---

## 2. The style

Dealt by `design-taste-frontend`, the only one of the four skills in
`.agents/skills/` with a chapter for screens people work in
(`references/app-screens.md`, distilled from 23 real product screens).

```
node draw.mjs --app --kind markets --theme light --style achromatic-ledger
→ seed 568883282 · shell: Open plane · type: Geist · density: sparse
```

**`markets`** is the kind for *research and monitoring read in long sessions*.
**`achromatic-ledger`** is the style:

> The chrome holds no colour at all; counts are set in ink, the one chart hue
> marks the screen's main data element, and the only other hue is a small
> signal where a figure changed.

**Colour budget: under 1% coloured pixels.** The sidebar, the title row, the
tabs, the buttons and the table chrome are greyscale. Every hue on the screen
is carrying a finding. The one filled button is near-black, never a brand
colour.

Two other light styles were dealt and rejected: `accent-ladder` (hue tints
carry the area work) and `framed-sheet` (a tinted L-frame). Both put colour
into the chrome, which would make a navigation element look like a failure
class.

### Off-style here, from the sheet

A brand-coloured primary button · tinted cards or tinted KPI tiles · a coloured
chart where one series in ink says it · bold on anything but the headline
figure · a chart with no y-scale · a grey pill as the only button for the
screen's main job.

---

## 3. Colour

### Chrome — greyscale, means nothing

```css
--ground:   #f8f8f8;   /* the page */
--surface:  #ffffff;   /* cards */
--raised:   #eeeeee;   /* nested panels, the active nav pill */
--border:   #e6e6e6;   /* 1px card edge */
--rule:     #f0f0f0;   /* row rules */
--control:  #d4d4d4;   /* input and select borders */
--text:     #0a0a0a;   /* 18.64:1 on ground */
--muted:    #6b6b6b;   /*  5.02:1 on ground */
--primary:  #141414;   /* the one filled button, white label */
```

### The two failure classes — the only hues

These are **not** a dashboard decision. Ochre = FORMAT and slate-blue = LOGIC
are defined in the paper's explainer and in the Chapter 5 figures. A dashboard
that picked different hues would disagree with its own paper in front of a
reviewer.

```css
--format: #a8521a;   /* FORMAT — unchanged from the paper */
--logic:  #2c4268;   /* LOGIC  — darkened, see below */
```

**A defect found while specifying this.** The paper's current pair separates at
only **1.28:1** from each other — nearly identical luminance. Printed in
greyscale, or read by someone with deuteranopia, the two classes are the same
colour. Measured:

| pair | on `--ground` | between them | greyscale-safe |
|---|---|---|---|
| `#a8521a` / `#3d5a8c` (paper today) | 5.09 / 6.51 | **1.28:1** | no |
| `#a8521a` / `#2c4268` (proposed) | 5.09 / 9.48 | **1.86:1** | yes |

`#2c4268` is already `--logic-ink` in the project's own tokens, so no new hue is
invented — the darker step simply becomes the primary one. The ochre does not
move.

### Colour is not the carrier — the mark is

Even with the fix, hue alone is never allowed to encode a class:

| class | mark |
|---|---|
| FORMAT | solid fill |
| LOGIC | 1px diagonal hatch |
| BROKEN | outline, no fill |
| LOST | a darker tone step |

Hue reinforces the mark. This holds in print, in greyscale and for a
colour-blind reader. **Every legend swatch is the mark itself, scaled down,** so
a legend can never drift from what it explains.

### Status — sparing

```css
--positive: #1f6b3f;   /* 6.12:1 — the skill's #247b50 fails on --raised at 4.50 */
--negative: #c4242a;   /* 5.44:1 */
--warning:  #92400e;

--pill-positive-bg: #dcfae5;  --pill-positive-ink: #04250e;
--pill-negative-bg: #ffedea;  --pill-negative-ink: #831c1e;
--pill-warning-bg:  #fffbeb;  --pill-warning-ink:  #92400e;
--pill-neutral-bg:  #eeeeee;  --pill-neutral-ink:  #3d3d3d;
```

Pills are a pale tint with dark ink of the same hue. Never a saturated fill with
white text. **Colour says good or bad, not up or down** — a rising failure rate
is `--negative`, a rising apply rate is `--positive`, and a zero or undefined
change is grey.

---

## 4. Type

**Geist** for text, **Geist Mono** for IDs, cell keys and `search_not_found`-style
machine strings. Self-hosted, Latin + Latin-Extended only.

```
page title     24px / 700
section title  16px / 400   muted grey
card title     16px / 600
KPI value      30px / 400
body, cells    14px / 400
labels, axes   12px / 400
pills          11px floor
```

Six sizes, three weights (400 / 500 / 700). Sentence case throughout. Zero
tracking. `font-variant-numeric: tabular-nums` on every table, every KPI and
anything that updates.

**Nothing over 32px. No figure at 40px or more.** 700 does exactly one job per
screen — the headline figure — and nothing else is bold.

---

## 5. Shell — Open plane

A **256px labelled sidebar sitting on the page ground**, separated by one 1px
hairline. No top bar. The title row sits straight on the ground, 32px from the
top.

```
┌────────────┬────────────────────────────────────────────────┐
│ ▣ recovery │  32px                                          │
│   bench    │  Overview                            24/700    │
│ full_grid  │  Reflection helps once, then poisons. 14/muted │
│ 1,604 cells│  ───────────────────────────────────── 1px     │
│            │  Arms  Classes  Models      ← 2px underline    │
│ Overview   │                                                │
│ Recovery   │  [ cards — one 12px gutter, everywhere ]       │
│ Edit format│                                                │
│ Failures   │                                                │
│ Cells      │                                                │
│ Stopping   │                                                │
│            │                                                │
│ Docs       │                                                │
│ About      │                                                │
└────────────┴────────────────────────────────────────────────┘
```

- **The product is named.** Mark and wordmark at the top, scope under it. A
  screen whose product cannot be named from a screenshot reads as a template.
- **Nav rows:** 34px pitch, 32px hit area, 14px labels at 400, 16px outline
  icons at 1.5px stroke.
- **Active item:** a neutral grey pill, `--raised`, radius 8, inset 8px. Never a
  coloured pill, never a left accent bar.
- **Nav items are screens, not anchors.** The skill records that a sidebar
  scroll-spying one long page was marked down twice in testing. This is the
  single biggest structural change from anything built before.
- **Utilities** (Docs, About) pushed to the bottom.

### The grid, and its arithmetic

```
1440 − 256 sidebar − 64 gutters = 1120 content

2-up    2 × 554 + 12        = 1120   ✓
3-up    3 × 365.33          — rejected, does not close
4-up    4 × 271 + 3 × 12    = 1120   ✓
43/57   476 + 12 + 632      = 1120   ✓
```

One gutter value — **12px** — horizontally and vertically. Mixed gutters are
flagged on 8 of the 23 studied screens.

### Density

The style deals **sparse** (44px rows, 24px padding, 14px body), and screens 1–4
use it as given. **Screen 5 (Cells) is a full list screen** and takes the dense
band instead: 13px body, 42px table rows, 32px card padding, generous gutters.
Density is three settings moved together — pitch, padding and type size — never
a shrunken type size over unchanged padding.

---

## 6. The six screens

Each is a real route, with one `h1`, one question, and its finding stated under
the title rather than buried in a caption.

| # | Screen | Its one question | Largest block |
|---|---|---|---|
| 1 | Overview | Did the experiment measure what it set out to measure? | the six-arm table |
| 2 | **Recovery** | Does reflection help? | the round-by-round collapse |
| 3 | Edit format | Does the format decide whether a patch applies? | a5's paired columns |
| 4 | Failure classes | What actually goes wrong? | 572 MALFORMED by reason |
| 5 | Cells | Which cell broke, and why? | the 1,604-row table |
| 6 | Stopping rule | When should the agent stop? | the live θ_c control |

### Screen 1 — Overview

Title row, then the finding:

> **All six arms ran. 1,604 cells, 1,428 calls, 18.1M tokens, no duplicates.**
> 130 cells were refused by design and 46 failed on the provider. Neither is a
> result.

A divided KPI strip — one container split by 1px dividers, **not four tiles**,
and **no icons, no sparklines**:

```
Cells        Calls        Tokens       Arms     Refused by design
1,604        1,428        18.1M        6 of 6   130
```

Below it the six-arm table: arm, rows, applied, malformed, refused, real
errors, calls, tokens, wall time. ISO dates, every figure right-aligned in
tabular numerals, ink only on the identity and the total.

### Screen 2 — Recovery · the one that matters

> **Reflection helps once, then poisons.** 19 cells where blind retry applied
> and reflection did not, and none the other way — p = 3.8e-6, across all four
> tasks, no reversals.

One chart, 43/57 beside the lineage ribbon. Four round columns, two series,
**straight 2px segments, no fill, no point markers**, 4 faint gridlines, no
y-axis line, round ticks above the maximum:

| | r1 | r2 | r3 | r4 |
|---|---|---|---|---|
| blind retry, 550B | 75% | 75% | 80% | 75% |
| reflection, 550B | **90%** | 45% | 40% | 50% |
| reflection, 30B | 76% | 72% | 68% | 74% |

A 1px dashed reference line at the baseline. The r1→r2 inversion gets a 1px
annotation marker and a 12px label — the skill's rule is that a step more than
about three times the usual change is annotated with its cause, because an
unexplained jump is the first thing a reader asks about.

Beside it, the paired-test panel: `b=19 c=0 n=60`, the 6-pair rejection floor
drawn as a reference, and the same test on a2 showing `b=4 c=4 p=1.000`.

### Screen 3 — Edit format

a5's 720 cells. Paired columns, square corners, one hue. `search_replace` 96.4%
against `unified_diff` 13.1%, p = 7.44e-89 on 360 pairs, and the sensitivity
analysis at p = 3.32e-65 beside it. The mechanism — `hunk_count_mismatch` on 206
of 304 FORMAT rows — as a sorted bar list underneath.

### Screen 4 — Failure classes

The 572 MALFORMED rows by reason, as a sorted horizontal bar list on a 64px
pitch, longest bar at about 88% of the width, one hue, no track:

```
hunk_count_mismatch          206
block_unterminated           182
search_not_found              86
no_file_header                80
search_not_found_whitespace   17
hunk_header_unparseable        1
```

Each row expands to the class it maps to and an example response. This screen
carries the `block_unterminated` correction: 164 of 182 of those rows **did**
close the block — the `=======` divider is what is missing — so the label is
shown with its real meaning beside it.

### Screen 5 — Cells

The full list screen. 1,604 rows, filterable by arm, model, strategy, round,
edit format and outcome. Total stated above the table, header row pinned while
scrolling, range shown at the end (`1–50 of 1,604`). 12px grey sentence-case
headers, **no zebra, no header band**, 1px rules, numbers right-aligned in
tabular figures. Selecting a row opens screen 6's detail: the full prompt, the
response, the patch, and the apply error if there was one.

### Screen 6 — Stopping rule

The thesis made touchable. Sliders for G, r, h and per-class q_c; θ_c and the
RETRY/ASK boundary recompute live. Every mark that is a model rather than a
measurement carries its caption: *"Expected shape, drawn to illustrate the
claim — not measured data."*

This is the most work and the most impressive. It is the one to cut if time runs
short.

---

## 7. The signature element — the lineage ribbon

Every product needs one thing only it has. Yours is one cell's four rounds drawn
as a chain, so a reader watches a patch decay:

```
l2_reflection · django__django-11019 · nemotron_ultra · n3

  r1 ████     r2 ████     r3 ▨▨▨▨     r4 ▨▨▨▨
   applied     applied     search_     search_
                           not_found   not_found
   1,118       1,284       1,317       1,397   tokens ↑
```

Solid while the patch applies, hatched once the SEARCH anchor drifts from the
file, with the completion-token count climbing underneath. **That single row is
the paper's argument.** It leads screen 2 and is the row format on screen 5.

The most frequent job — *find the cell that broke* — is one click from the
overview.

---

## 8. Charts — hand-drawn SVG, no library

D29 stands. Every mark is drawn to the rules in `app-screens.md` §6.

| Question | Form |
|---|---|
| Does it degrade over rounds? | one line per strategy, straight 2px segments, 3–5 faint gridlines, no y-axis line |
| Which failure reason dominates? | sorted horizontal bar list, one hue, no track |
| Format A against format B | paired columns, square corners, 2px seam |
| What share of cells were measured? | 100% stacked bar — measured / refused / errored |
| One cell's history | the lineage ribbon |

Rules that are not optional: **one series per chart** (three is the most any
studied screen draws); **no legend for a single series**; round, even y ticks
with the top tick above the maximum; x labels flat and never rotated; no
smoothing, because a spline invents values between measured points; tooltips as
bare text.

---

## 9. Three honesty rules that are design rules

These are not disclaimers to add at the end. They decide what the screens
render.

1. **`APPLIED` is not `RESOLVED`.** Every screen showing an apply rate carries
   it. `evidenceSource` is `none` on all 1,604 live rows, because D6 put Docker
   permanently out of reach. The dashboard measures whether a patch *applied*,
   never whether it *fixed the bug*.
2. **130 refusals are not 46 errors.** Both wear the `PROVIDER_ERROR` kind in
   the data, separable only by `status: null` plus the reason string. A
   dashboard that renders the kind directly would say *"the API failed 176
   times"*, which is false. They are split everywhere, always.
3. **32 cells never ran** (D36). Drawn as holes, never as zeros. The skill's own
   rule, and D18's: when set-aside exceeds measured, it leads the panel.

Every synthetic mark — screen 6's curves above all — carries
*"Expected shape, drawn to illustrate the claim — not measured data."*

---

## 10. States, which are half the build

For every block: empty, zero, loading, error. For every row and control: hover,
selected, focus, disabled.

- A real zero prints as `0`, never as a dash.
- A missing value is a grey dash, never `--` at value size (that reads as
  loading).
- An empty section **keeps its frame and its header** and adds one sentence
  spanning the block.
- An empty chart is drawn: the zero line, missing bars for empty periods, no
  padded range, no "No data" picture.
- Loading is the final layout with each value replaced by a flat grey bar at its
  real size. No shimmer. No layout shift when the data lands.
- An error lives **inside the block that failed**, never as a page banner: one
  sentence saying what failed and when the data was last good, plus a Retry text
  button.

---

## 11. The phone

The sidebar folds to a 48px top bar: screen name, menu button opening a
full-screen sheet, at most one action. 16px margins, 44px touch targets. KPIs
become a 2-column grid. Charts go full width at 160–200px tall with 3–4 x
labels. **The table becomes two-line rows** — identity and key figure on line 1,
the other fields in 13px grey on line 2 — never a sideways-scrolling page.

---

## 12. Gates

```sh
cd recovery-bench/packages/console
bun run contrast                                   # every token pair, light
node <skill>/scripts/lint.mjs --app src
node <skill>/scripts/inspect.mjs --app dist/index.html
```

`inspect.mjs --app` opens the real browser at 1440, 768 and 390 and measures:
one `h1`; the sidebar folding on the phone; the canvas used to its right edge;
panel shadows and borders; the number of corner radii; **cards in one row
ending apart** (`ragged-row`); **a blank band over 40px inside a card**
(`panel-void`); icons in tinted squares; numeric alignment and tabular figures;
chart hues; colour share; placeholder data; text under 11px.

**0 FAIL at all three widths, on the production build**, not the dev server.
Then three rounds of reading the screenshots against the rubric — and the scores
get reported, not just "it passed".

---

## 13. Open decisions

1. **Darken the LOGIC blue to `#2c4268`?** It fixes a real greyscale defect that
   affects the paper's figures too, and uses a hue the project already defines.
   The alternative is to keep `#3d5a8c` and rely on the hatch mark alone.
2. **Six screens, or five?** Screen 6 is the most work and the most impressive.
3. **Retire `packages/dashboard` once the console passes?** My recommendation:
   yes, in one commit, after the gates are green — not before.

**Estimate:** 4 days for screens 1–5, +1 for screen 6. Fits the 1–13 November
window in `BUILD.md` §5.

**Milestone M4 → write to memory when screens 1–5 pass their gates.**
