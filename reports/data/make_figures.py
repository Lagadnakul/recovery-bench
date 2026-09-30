"""
Session 7 — generates the eleven .drawio figures for Chapters 4, 5 and 6.

Design conventions (from PLAN.md section 6):
  * Greyscale only. Examiners print in black and white, so no finding may depend
    on hue. Emphasis is carried by fill value, stroke weight and line style.
  * Evaluated versus not-evaluated is distinguished by LINE STYLE (solid vs
    dashed), never by colour alone.
  * One font scale across all figures: 13 pt titles, 11 pt body, 9 pt annotation.
  * Every figure is a real .drawio file so any box can be edited by hand later.

Usage:
    python3 reports/data/make_figures.py          # writes figures/*.drawio
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))
# Layout note: these scripts live in reports/data/, so the project root is
# two levels up. REPORTS anchors figures/, which moved alongside them.
REPORTS = os.path.dirname(HERE)
ROOT = os.path.dirname(REPORTS)
OUT = os.path.join(REPORTS, "figures")

# ----------------------------------------------------------------- style vocab
BASE = "rounded=0;whiteSpace=wrap;html=1;fontSize=11;fontFamily=Helvetica;"
BOX = BASE + "fillColor=#ffffff;strokeColor=#333333;"
BOX_FILL = BASE + "fillColor=#e8e8e8;strokeColor=#333333;"
BOX_DARK = BASE + "fillColor=#4d4d4d;strokeColor=#000000;fontColor=#ffffff;fontStyle=1;"
BOX_SOFT = BASE + "fillColor=#f5f5f5;strokeColor=#808080;"
BOX_DASH = BASE + "fillColor=#ffffff;strokeColor=#808080;dashed=1;dashPattern=6 4;"
ROUND = "rounded=1;whiteSpace=wrap;html=1;fontSize=11;fontFamily=Helvetica;" \
        "fillColor=#ffffff;strokeColor=#333333;"
DIAMOND = "rhombus;whiteSpace=wrap;html=1;fontSize=10;fontFamily=Helvetica;" \
          "fillColor=#ffffff;strokeColor=#333333;"
TERM = BASE + "fillColor=#d9d9d9;strokeColor=#000000;rounded=1;"
LABEL = "text;html=1;align=left;verticalAlign=middle;fontSize=11;fontFamily=Helvetica;"
LABEL_C = "text;html=1;align=center;verticalAlign=middle;fontSize=11;fontFamily=Helvetica;"
NOTE = "text;html=1;align=left;verticalAlign=top;fontSize=9;fontFamily=Helvetica;" \
       "fontColor=#555555;"
TITLE = "text;html=1;align=center;verticalAlign=middle;fontSize=13;" \
        "fontFamily=Helvetica;fontStyle=1;"
SWIM = "swimlane;html=1;startSize=34;fontSize=11;fontFamily=Helvetica;fontStyle=1;" \
       "fillColor=#ffffff;strokeColor=#333333;horizontal=1;"
EDGE = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;" \
       "html=1;endArrow=block;endSize=8;strokeColor=#333333;fontSize=9;" \
       "fontFamily=Helvetica;"
EDGE_DASH = EDGE + "dashed=1;dashPattern=6 4;strokeColor=#808080;"
BAR = "rounded=0;html=1;fontSize=10;fontFamily=Helvetica;"


class Fig:
    def __init__(self, name, title=None):
        self.name = name
        self.cells = []
        self.n = 1
        self.title = title

    def _id(self, explicit=None):
        if explicit:
            return explicit
        self.n += 1
        return f"n{self.n}"

    def box(self, x, y, w, h, label, style=BOX, cid=None, parent="1"):
        i = self._id(cid)
        self.cells.append(
            f'<mxCell id="{i}" value="{label}" style="{style}" vertex="1" '
            f'parent="{parent}"><mxGeometry x="{x}" y="{y}" width="{w}" '
            f'height="{h}" as="geometry" /></mxCell>')
        return i

    def edge(self, src, tgt, label="", style=EDGE, pins="", offset=None):
        i = self._id()
        geo = '<mxGeometry relative="1" as="geometry">'
        if offset:
            geo += f'<mxPoint as="offset" x="{offset[0]}" y="{offset[1]}" />'
        geo += '</mxGeometry>'
        self.cells.append(
            f'<mxCell id="{i}" value="{label}" style="{style}{pins}" edge="1" '
            f'parent="1" source="{src}" target="{tgt}">{geo}</mxCell>')
        return i

    def xml(self):
        body = "\n        ".join(self.cells)
        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<mxfile host="drawio" version="26.0.0">\n'
            f'  <diagram name="{self.name}">\n'
            '    <mxGraphModel grid="1" gridSize="10" page="1" math="0" shadow="0">\n'
            '      <root>\n'
            '        <mxCell id="0" />\n'
            '        <mxCell id="1" parent="0" />\n'
            f'        {body}\n'
            '      </root>\n'
            '    </mxGraphModel>\n'
            '  </diagram>\n'
            '</mxfile>\n')

    def save(self):
        p = os.path.join(OUT, f"{self.name}.drawio")
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(self.xml())
        return p


V = "exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;"
H = "exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;"


# =========================================================== Figure 4.1
def fig41():
    f = Fig("fig4_1_pipeline")
    f.box(190, 10, 380, 30, "Experimental Pipeline Overview", TITLE)
    steps = [
        ("SWE-bench Lite instance&#xa;issue text, repo, base commit", BOX_SOFT),
        ("Oracle localisation&#xa;target path from gold patch metadata", BOX),
        ("Retrieve target file at base commit&#xa;complete file, no truncation", BOX),
        ("Prompt assembly&#xa;issue + whole file + format rules", BOX),
        ("Single model call&#xa;gemini-3.6-flash, one invocation", BOX_FILL),
        ("Apply SEARCH/REPLACE blocks&#xa;exact string match", BOX),
        ("Compute unified diff&#xa;difflib, deterministic", BOX),
        ("Containerised evaluation&#xa;project test suite, Docker + WSL 2", BOX),
        ("Outcome classification&#xa;five categories, Figure 4.5", BOX_FILL),
    ]
    ids, y = [], 60
    for lbl, st in steps:
        ids.append(f.box(230, y, 300, 50, lbl, st))
        y += 80
    for a, b in zip(ids, ids[1:]):
        f.edge(a, b, "", EDGE, V)

    # failure-pool branch
    pool = f.box(600, 620, 170, 50,
                 "Failure pool&#xa;8 of 20 instances", BOX_DARK)
    f.edge(ids[-1], pool, "unresolved", EDGE,
           "exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0.5;entryY=1;entryDx=0;entryDy=0;")
    conds = f.box(600, 440, 180, 140,
                  "Recovery conditions", SWIM + "startSize=30;")
    f.box(20, 40, 140, 28, "Blind Retry", BOX_SOFT, parent=conds)
    f.box(20, 72, 140, 28, "Reflection-only", BOX_SOFT, parent=conds)
    f.box(20, 104, 140, 28, "Diagnose+Revise", BOX_SOFT, parent=conds)
    f.edge(pool, conds, "three conditions&#xa;two rounds", EDGE,
           "exitX=0.5;exitY=0;exitDx=0;exitDy=0;entryX=0.5;entryY=1;entryDx=0;entryDy=0;")
    f.edge(conds, ids[5], "revised patch", EDGE_DASH,
           "exitX=0;exitY=0.5;exitDx=0;exitDy=0;entryX=1;entryY=0.5;entryDx=0;entryDy=0;")
    f.box(20, 440, 190, 90,
          "No repository navigation.&#xa;No tool use.&#xa;No execution during "
          "generation.&#xa;One stateless call per cell.", NOTE)
    f.save()


# =========================================================== Figure 4.2
def fig42():
    f = Fig("fig4_2_context")
    f.box(140, 10, 420, 30, "Repository Context Preparation", TITLE)
    a = f.box(40, 70, 200, 60,
              "Benchmark instance&#xa;gold patch metadata", BOX_SOFT)
    b = f.box(290, 70, 200, 60,
              "Extract source paths&#xa;regex on diff headers", BOX)
    c = f.box(540, 70, 200, 60,
              "Discard paths containing&#xa;&quot;test&quot;", BOX)
    d = f.box(540, 180, 200, 60,
              "Take first remaining path", BOX_FILL)
    e = f.box(290, 180, 200, 60,
              "Fetch file at base commit&#xa;raw host, exact revision", BOX)
    g = f.box(40, 180, 200, 60,
              "Complete file content&#xa;verbatim, unmodified", BOX_FILL)
    h = f.box(240, 300, 300, 70,
              "Prompt&#xa;issue text + complete file + format rules", BOX_DARK)
    f.edge(a, b, "", EDGE, H)
    f.edge(b, c, "", EDGE, H)
    f.edge(c, d, "", EDGE, V)
    f.edge(d, e, "", EDGE,
           "exitX=0;exitY=0.5;exitDx=0;exitDy=0;entryX=1;entryY=0.5;entryDx=0;entryDy=0;")
    f.edge(e, g, "", EDGE,
           "exitX=0;exitY=0.5;exitDx=0;exitDy=0;entryX=1;entryY=0.5;entryDx=0;entryDy=0;")
    f.edge(g, h, "", EDGE,
           "exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.25;entryY=0;entryDx=0;entryDy=0;")
    f.box(40, 400, 700, 80,
          "Only the PATH is taken from the gold patch. Its content never enters any "
          "prompt.&#xa;Cost: the largest target file in the sample, astropy/wcs/wcs.py, "
          "is 124,394 characters, approximately 31,100 tokens,&#xa;retransmitted in full "
          "on every request. No prompt caching was used.", NOTE)
    f.save()


# =========================================================== Figure 4.3
def fig43():
    f = Fig("fig4_3_patch")
    f.box(150, 10, 420, 30, "Patch Representation and Application", TITLE)
    a = f.box(250, 60, 220, 50, "Model response text", BOX_SOFT)
    b = f.box(250, 140, 220, 50,
              "Parse SEARCH/REPLACE blocks", BOX)
    d1 = f.box(255, 220, 210, 70,
               "Blocks found?", DIAMOND)
    t1 = f.box(540, 230, 210, 50,
               "no_blocks_found&#xa;prediction discarded", TERM)
    d2 = f.box(255, 320, 210, 80,
               "Occurrences of&#xa;search text?", DIAMOND)
    t2 = f.box(540, 310, 210, 50,
               "search_not_found&#xa;prediction discarded", TERM)
    t3 = f.box(540, 380, 210, 50,
               "search_ambiguous&#xa;prediction discarded", TERM)
    c = f.box(250, 440, 220, 50, "Substitute text in file", BOX)
    e = f.box(250, 520, 220, 50,
              "difflib.unified_diff&#xa;diff computed, not authored", BOX_FILL)
    g = f.box(250, 600, 220, 50, "Patch sent to harness", BOX_DARK)
    f.edge(a, b, "", EDGE, V)
    f.edge(b, d1, "", EDGE, V)
    f.edge(d1, t1, "none", EDGE,
           "exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;")
    f.edge(d1, d2, "yes", EDGE, V)
    f.edge(d2, t2, "zero", EDGE,
           "exitX=1;exitY=0.25;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;")
    f.edge(d2, t3, "more than one", EDGE,
           "exitX=1;exitY=0.75;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;")
    f.edge(d2, c, "exactly one", EDGE, V)
    f.edge(c, e, "", EDGE, V)
    f.edge(e, g, "", EDGE, V)
    f.box(30, 250, 200, 200,
          "A discarded prediction is printed&#xa;to the console and dropped.&#xa;"
          "Nothing is written to the&#xa;predictions file and the harness&#xa;"
          "is never invoked, so no&#xa;evaluation record exists.&#xa;&#xa;"
          "The cell is ABSENT from the&#xa;data, not present with a&#xa;"
          "negative outcome.", NOTE)
    f.save()


# =========================================================== Figure 4.4
def fig44():
    """The independent variable of the study."""
    f = Fig("fig4_4_information")
    f.box(180, 10, 560, 30,
          "Information Available to Each Recovery Strategy", TITLE)
    cols = [
        ("Blind Retry", 330),
        ("Reflection-only", 610),
        ("Diagnose+Revise", 890),
    ]
    rows = [
        ("Issue description", [1, 1, 1]),
        ("Complete target file", [1, 1, 1]),
        ("Output format rules", [1, 1, 1]),
        ("Told previous attempt failed", [0, 1, 1]),
        ("Text of previous attempt", [0, 1, 1]),
        ("Must critique own reasoning", [0, 1, 1]),
        ("Observed test output", [0, 0, 1]),
        ("Must diagnose root cause", [0, 0, 1]),
    ]
    f.box(40, 60, 270, 34, "Supplied to the prompt", BOX_DARK)
    for name, x in cols:
        f.box(x, 60, 260, 34, name, BASE + "fillColor=#4d4d4d;strokeColor=#000000;"
              "fontColor=#ffffff;fontStyle=1;")
    for r, (label, present) in enumerate(rows):
        y = 100 + r * 42
        f.box(40, y, 270, 34, label,
              BASE + "fillColor=#ffffff;strokeColor=#333333;align=left;"
              "spacingLeft=8;")
        for c, (_, x) in enumerate(cols):
            if present[c]:
                f.box(x, y, 260, 34, "supplied", BOX_FILL)
            else:
                f.box(x, y, 260, 34, "withheld", BOX_DASH)
    y = 100 + len(rows) * 42 + 12
    f.box(40, y, 270, 40, "Relative input cost", BOX_DARK)
    for i, (_, x) in enumerate(cols):
        f.box(x, y, 260, 40, f"{i + 1}x", BOX_DARK)
    f.box(40, y + 60, 1110, 60,
          "The three prompts are strictly nested: the shared portion is identical in "
          "wording, and each condition adds material without altering&#xa;anything "
          "already present. Shaded cells are supplied to the condition; dashed cells "
          "are withheld. This figure is the independent variable&#xa;of the study — "
          "every difference in outcome reported in Chapter 5 is attributable to the "
          "rows that differ between these columns.", NOTE)
    f.save()


# =========================================================== Figure 4.5
def fig45():
    f = Fig("fig4_5_taxonomy")
    f.box(170, 10, 420, 30, "Outcome Classification", TITLE)
    a = f.box(270, 60, 220, 44, "Evaluated cell", BOX_SOFT)
    d1 = f.box(265, 130, 230, 76,
               "Report exists and&#xa;patch applied?", DIAMOND)
    t5 = f.box(580, 140, 250, 56,
               "NOT APPLIED&#xa;malformed, rejected, refused, or never attempted",
               TERM)
    d2 = f.box(265, 236, 230, 66, "Resolution flag true?", DIAMOND)
    t1 = f.box(580, 244, 250, 44, "RESOLVED", BOX_DARK)
    d3 = f.box(265, 332, 230, 76,
               "Any PASS_TO_PASS&#xa;test failing?", DIAMOND)
    t4 = f.box(580, 340, 250, 56,
               "REGRESSION&#xa;reported alongside primary category", TERM)
    d4 = f.box(265, 438, 230, 76,
               "Any FAIL_TO_PASS&#xa;test passing?", DIAMOND)
    t2 = f.box(580, 446, 250, 44, "PARTIAL", TERM)
    t3 = f.box(265, 552, 230, 44, "NO PROGRESS", TERM)
    f.edge(a, d1, "", EDGE, V)
    f.edge(d1, t5, "no", EDGE,
           "exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;")
    f.edge(d1, d2, "yes", EDGE, V)
    f.edge(d2, t1, "yes", EDGE,
           "exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;")
    f.edge(d2, d3, "no", EDGE, V)
    f.edge(d3, t4, "yes", EDGE,
           "exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;")
    f.edge(d3, d4, "no", EDGE, V)
    f.edge(d4, t2, "yes", EDGE,
           "exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;")
    f.edge(d4, t3, "no", EDGE, V)
    f.box(20, 300, 220, 140,
          "REGRESSION overlaps PARTIAL and&#xa;NO PROGRESS by construction. It is&#xa;"
          "reported beside the primary category,&#xa;never instead of it, so a cell "
          "reads&#xa;as &quot;no progress with 8 regressions&quot;.", NOTE)
    f.save()


# =========================================================== Figure 4.6
def fig46():
    f = Fig("fig4_6_retrofit")
    f.box(170, 10, 500, 30,
          "Patch Representation Before and After the Retrofit", TITLE)
    left = f.box(40, 60, 360, 480, "Before: model-authored unified diff", SWIM)
    right = f.box(450, 60, 360, 480, "After: programmatic application", SWIM)
    ls = ["Model asked to emit a unified diff",
          "Model counts lines and&#xa;constructs hunk headers",
          "Text forwarded to harness unchanged",
          "Harness attempts to apply patch"]
    ids = []
    for i, s in enumerate(ls):
        ids.append(f.box(30, 60 + i * 90, 300, 56, s, BOX, parent=left))
    for a, b in zip(ids, ids[1:]):
        f.edge(a, b, "", EDGE, V)
    bad = f.box(30, 420, 300, 46,
                "4 of 20 instances: patch never applied", TERM, parent=left)
    f.edge(ids[-1], bad, "", EDGE, V)

    rs = ["Model asked for SEARCH / REPLACE blocks",
          "No line counting required",
          "Applied by exact string match",
          "difflib computes the unified diff"]
    rids = []
    for i, s in enumerate(rs):
        rids.append(f.box(30, 60 + i * 90, 300, 56, s,
                          BOX_FILL if i == 3 else BOX, parent=right))
    for a, b in zip(rids, rids[1:]):
        f.edge(a, b, "", EDGE, V)
    good = f.box(30, 420, 300, 46,
                 "3 of 3 evaluable format failures resolved", BOX_DARK,
                 parent=right)
    f.edge(rids[-1], good, "", EDGE, V)
    f.box(40, 560, 780, 50,
          "The model, the prompt content and the task are identical on both sides. "
          "Only the notation used to express an edit differs.&#xa;The clerical work "
          "of computing line offsets moves from the model to a deterministic "
          "procedure.", NOTE)
    f.save()


# =========================================================== Figure 5.1
def fig51():
    f = Fig("fig5_1_baseline")
    f.box(120, 10, 420, 30, "Baseline Outcome Breakdown, 20 Instances", TITLE)
    # horizontal stacked bar: 12 / 4 / 4 -> 30px per instance
    unit = 30
    x = 60
    segs = [("Resolved&#xa;12", 12, BAR + "fillColor=#4d4d4d;strokeColor=#000000;"
             "fontColor=#ffffff;fontStyle=1;"),
            ("Logic&#xa;4", 4, BAR + "fillColor=#bfbfbf;strokeColor=#000000;"),
            ("Format&#xa;4", 4, BAR + "fillColor=#ffffff;strokeColor=#000000;"
             "dashed=1;dashPattern=6 4;")]
    for lbl, n, st in segs:
        f.box(x, 70, unit * n, 80, lbl, st)
        x += unit * n
    rows = [
        ("Resolved on first attempt", "12 of 20", "60 per cent"),
        ("Logic-class failure&#xa;patch applied, required tests failed", "4 of 20",
         "20 per cent"),
        ("Format-class failure&#xa;patch could not be applied", "4 of 20",
         "20 per cent"),
        ("Failure pool", "8 of 20", "40 per cent"),
    ]
    y = 210
    f.box(60, y, 340, 30, "Outcome", BOX_DARK)
    f.box(400, y, 120, 30, "Count", BOX_DARK)
    f.box(520, y, 140, 30, "Share", BOX_DARK)
    for lbl, c, s in rows:
        y += 34
        st = BOX_FILL if lbl == "Failure pool" else BOX
        f.box(60, y, 340, 34, lbl, st)
        f.box(400, y, 120, 34, c, st)
        f.box(520, y, 140, 34, s, st)
    f.box(60, y + 60, 600, 40,
          "The two failure classes are equal in size. Half the failure pool entered "
          "it for a reason&#xa;unconnected with software reasoning.", NOTE)
    f.save()


# =========================================================== Figure 5.2
def fig52():
    """The money figure."""
    f = Fig("fig5_2_subtest")
    f.box(120, 10, 520, 30,
          "Sub-Test Recovery on django__django-11019", TITLE)
    f.box(40, 56, 600, 20,
          "The benchmark records this instance as UNRESOLVED both before and after. "
          "Only the sub-test counts reveal the change.", NOTE)

    TRACK = BAR + "fillColor=none;strokeColor=#999999;dashed=1;dashPattern=4 4;"
    FILLED = BAR + "fillColor=#4d4d4d;strokeColor=#000000;"
    # Panel A: FAIL_TO_PASS, scale 20 px per test, full scale 16 tests = 320 px
    f.box(40, 96, 400, 24,
          "FAIL_TO_PASS tests passing (dashed track = all 16 required)", LABEL)
    f.box(40, 130, 240, 40, "Unified diff", BOX)
    f.box(290, 130, 320, 40, "", TRACK)
    f.box(620, 130, 70, 40, "0 of 16", LABEL)
    f.box(40, 180, 240, 40, "SEARCH / REPLACE", BOX_FILL)
    f.box(290, 180, 320, 40, "", TRACK)
    f.box(290, 180, 120, 40, "", FILLED)
    f.box(620, 180, 70, 40, "6 of 16", LABEL)

    # Panel B: PASS_TO_PASS regressions, scale 10 px per test
    f.box(40, 260, 400, 24, "PASS_TO_PASS tests broken (fewer is better)", LABEL)
    f.box(40, 294, 240, 40, "Unified diff", BOX)
    f.box(290, 294, 330, 40, "", BAR + "fillColor=#bfbfbf;strokeColor=#000000;")
    f.box(630, 294, 60, 40, "33", LABEL)
    f.box(40, 344, 240, 40, "SEARCH / REPLACE", BOX_FILL)
    f.box(290, 344, 60, 40, "none", LABEL)

    # identical across conditions
    y = 430
    f.box(40, y, 630, 30,
          "Every evaluated recovery cell then returned the identical score", BOX_DARK)
    cells = ["Blind Retry R1", "Blind Retry R2", "Reflection R1",
             "Reflection R2", "Diagnose R1", "Diagnose R2"]
    for i, c in enumerate(cells):
        f.box(40 + (i % 3) * 210, y + 34 + (i // 3) * 40, 210, 36,
              f"{c}&#xa;6 of 16", BOX_FILL)
    f.box(40, y + 120, 630, 60,
          "Six independent generations, three strategies, two rounds, sampling not "
          "pinned by temperature or seed.&#xa;The retrofit moved this instance. "
          "Nothing told to the model about its failure moved it again.", NOTE)
    f.save()


# =========================================================== Figure 5.3
def fig53():
    f = Fig("fig5_3_matrix")
    f.box(150, 10, 520, 30,
          "Cross-Strategy Comparison Matrix, Logic-Class Instances", TITLE)
    tasks = ["astropy-7746", "django-11019", "django-11283", "django-11564"]
    conds = ["Blind Retry", "Reflection-only", "Diagnose+Revise"]
    # data[cond][task] = (round1, round2)
    data = {
        "Blind Retry": [(None, "0 of 1"), ("6 of 16", "6 of 16"),
                        (None, "0 of 1"), ("0 of 2", None)],
        "Reflection-only": [(None, "0 of 1"), ("6 of 16", "6 of 16"),
                            (None, "0 of 1"), (None, None)],
        "Diagnose+Revise": [("0 of 1", "0 of 1"), ("6 of 16", "6 of 16"),
                            ("0 of 1*", None), ("0 of 2", "0 of 2")],
    }
    x0, y0, cw, ch = 210, 64, 170, 36
    f.box(30, y0, 170, ch * 2, "Instance", BOX_DARK)
    for c, cond in enumerate(conds):
        f.box(x0 + c * cw * 2, y0, cw * 2, ch, cond, BOX_DARK)
        f.box(x0 + c * cw * 2, y0 + ch, cw, ch, "Round 1", BOX_FILL)
        f.box(x0 + c * cw * 2 + cw, y0 + ch, cw, ch, "Round 2", BOX_FILL)
    for t, task in enumerate(tasks):
        y = y0 + ch * 2 + t * ch
        f.box(30, y, 170, ch, task, BOX_FILL)
        for c, cond in enumerate(conds):
            for r in range(2):
                val = data[cond][t][r]
                x = x0 + c * cw * 2 + r * cw
                if val is None:
                    f.box(x, y, cw, ch, "not evaluated", BOX_DASH)
                else:
                    st = BOX_FILL if "6 of" in val else BOX
                    f.box(x, y, cw, ch, val, st)
    y = y0 + ch * 2 + len(tasks) * ch + 20
    f.box(30, y, 500, 20,
          "* Diagnose+Revise additionally broke 8 PASS_TO_PASS tests on this cell. "
          "Blind Retry broke none.", NOTE)
    f.box(30, y + 30, 170, 30, "Legend", BOX_DARK)
    f.box(210, y + 30, 170, 30, "evaluated", BOX)
    f.box(390, y + 30, 170, 30, "not evaluated", BOX_DASH)
    f.box(30, y + 74, 900, 40,
          "No instance was resolved by any strategy in either round. 16 of the 24 "
          "cells were evaluated; 8 were not.&#xa;Unevaluated cells are shown as such "
          "and are never counted as failures.", NOTE)
    f.save()


# =========================================================== Figure 5.4
def fig54():
    f = Fig("fig5_4_cost")
    f.box(130, 10, 480, 30, "Recovery Cost Against Outcome", TITLE)
    conds = [("Blind Retry", 1, 130), ("Reflection-only", 2, 260),
             ("Diagnose+Revise", 3, 390)]
    f.box(40, 60, 200, 24, "Relative input volume", LABEL)
    for name, mult, h in conds:
        pass
    x = 60
    for name, mult, _ in conds:
        bh = 40 * mult
        f.box(x, 220 - bh, 140, bh, f"{mult}x",
              BAR + ("fillColor=#4d4d4d;strokeColor=#000000;fontColor=#ffffff;"
                     "fontStyle=1;" if mult == 3 else
                     "fillColor=#bfbfbf;strokeColor=#000000;"))
        f.box(x, 228, 140, 40, name, BOX_FILL)
        x += 180
    f.box(40, 290, 500, 24, "Logic-class instances resolved", LABEL)
    x = 60
    for name, mult, _ in conds:
        f.box(x, 320, 140, 46, "0", BOX_DASH)
        x += 180
    f.box(40, 396, 560, 60,
          "Identical outcome at three times the input volume, plus the infrastructure "
          "to capture, store&#xa;and truncate execution evidence. Verified recovery "
          "rate zero for all three; recovery effort&#xa;differing by a factor of "
          "three.", NOTE)
    f.save()


# =========================================================== Figure 6.1
def fig61():
    f = Fig("fig6_1_ladder")
    f.box(140, 10, 480, 30, "The Recovery Strategy Ladder", TITLE)
    rungs = [
        ("L0", "Blind Retry", "re-attempt, no failure information", True),
        ("L1", "Reflection-only", "own previous attempt, self-critique", True),
        ("L2", "Diagnose+Revise", "observed test output, truncated", True),
        ("L3", "Constrained decoding", "malformed edits impossible by construction",
         False),
        ("L4", "Tool-grounded revision", "system executes tests itself", False),
        ("L5", "Checkpoint and rollback", "revert a regression-causing revision",
         False),
        ("L6", "Failure memory", "evidence carried across attempts", False),
    ]
    y = 500
    for code, name, desc, done in reversed(rungs):
        st = BOX_FILL if done else BOX_DASH
        f.box(60, y, 70, 50, code, BOX_DARK if done else BOX_DASH)
        f.box(140, y, 240, 50, name, st)
        f.box(390, y, 330, 50, desc, st)
        y -= 66
    f.box(60, 56, 660, 26,
          "Evaluated in this study: L0 to L2 (solid). Proposed as future work: "
          "L3 to L6 (dashed).", NOTE)
    f.box(60, 570, 660, 60,
          "L0 to L2 vary what the system is TOLD about its failure, and produced "
          "identical outcomes.&#xa;L3 to L6 vary what the system can DO about it. "
          "The one intervention that moved outcomes in this&#xa;study, changing the "
          "edit notation, belongs to the second kind.", NOTE)
    f.save()


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for fn in (fig41, fig42, fig43, fig44, fig45, fig46,
               fig51, fig52, fig53, fig54, fig61):
        fn()
        print("wrote", fn.__name__)
    print(f"\n{len(os.listdir(OUT))} files in {OUT}")
