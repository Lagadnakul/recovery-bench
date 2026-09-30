"""
Session 7 — front-matter repairs and TOC enablement.

Defects addressed (PLAN.md section D9):

  D9-3  Three different thesis titles appear across the certificates. The
        canonical title is the one on the approval certificate, which is also
        the most complete. The two variants that name the SYSTEMATIC REVIEW are
        the title of the submitted journal article, not of the dissertation, and
        are corrected where they stand in for the dissertation title.
  D9-4  Cover reads "Coding System" (singular) and carries a trailing full stop.
  D9-6  Publication certificate reads "has published/accepted the article" when
        the same paragraph goes on to say that volume, DOI and publication
        details "will be added upon acceptance". The manuscript is submitted,
        not accepted.
  D9-7  The Table of Contents is a real Word TOC field, but NO paragraph in the
        document carries an outline level -- not even in Chapters 1 to 3. Its 88
        cached entries are stale, so pressing F9 would empty it rather than
        repair it. This script sets w:outlineLvl on every heading so that the
        field regenerates correctly.
  D9-9  Chapter 1 section titles disagree with the TOC. Regenerating the field
        from the actual headings resolves this by construction.

  Abstract: two claims are stated more strongly than the logs support. Both are
        corrected to the wording used in Chapters 5 and 6.

  D9-5 required no change: the supervisor's name is spelled "Ramizraja"
        consistently throughout Self.docx. The "Ramirzaja" misspelling occurs in
        the submitted Elsevier manuscript, which is a separate document.

Run from the project root:
    python3 reports/data/fix_frontmatter.py             # writes Self_fm.docx
    python3 reports/data/fix_frontmatter.py --in-place  # updates Self.docx, backs up
"""

import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import docx
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

from docx_writer import backup  # noqa: E402

# Layout note: these scripts live in reports/data/, so the project root is
# two levels up. REPORTS anchors figures/, which moved alongside them.
REPORTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(REPORTS)
SRC = os.path.join(ROOT, "Self.docx")

CANON = ("Self-Reflection and Failure Recovery in Agentic AI Coding Systems: "
         "An Empirical Evaluation of Blind Retry, Reflection, and "
         "Diagnosis-Based Recovery Strategies")

ARTICLE = ("Self-Reflection and Failure Recovery in Agentic AI Coding Systems: "
           "A Systematic Review")

# (substring to find, replacement, note) — applied to whole-paragraph text
REPLACEMENTS = [
    # D9-4 cover
    ("Self-Reflection and Failure Recovery in Agentic AI Coding System: An "
     "Empirical Evaluation of Blind Retry, Reflection, and Diagnosis-Based "
     "Recovery Strategies.",
     CANON,
     "D9-4 cover title: 'System' -> 'Systems', trailing stop removed"),

    # D9-3 approval certificate carries the article title where the
    # dissertation title belongs
    ("“Self Reflection and Failure Recovery in Agentic AI Coding Systems: "
     "A Systematic Review”",
     f"“{CANON}”",
     "D9-3 approval certificate: dissertation title restored"),

    # D9-3 / D9-6 publication certificate
    ("“SelfReflection and Failure Recovery in Agentic AI Coding Systems: "
     "A Systematic Review”",
     f"“{CANON}”",
     "D9-3 publication certificate: dissertation title restored"),
    ("has published/accepted the article",
     "has submitted the article",
     "D9-6 publication certificate: 'published/accepted' -> 'submitted'"),

    # Abstract corrections
    ("the three recovery strategies produced identical outcomes across the "
     "failure pool in two independent evaluation rounds.",
     "the three recovery strategies produced identical outcomes in every cell "
     "that was evaluated, across two independent evaluation rounds; 16 of the "
     "24 cells defined by the comparison were evaluated, the remainder being "
     "constrained by the free-tier request ceiling.",
     "Abstract: coverage qualification added"),
    ("The dissertation contributes a reproducible evaluation pipeline for "
     "studying failure recovery in coding agents,",
     "The dissertation contributes a fully scripted and auditable evaluation "
     "pipeline for studying failure recovery in coding agents,",
     "Abstract: 'reproducible' -> 'fully scripted and auditable'"),
]

# Front-matter and top-level headings that belong in the Table of Contents
LEVEL0 = {
    "CERTIFICATE", "THESIS APPROVAL CERTIFICATE", "ACKNOWLEDGEMENT",
    "PAPER PUBLICATION CERTIFICATE", "ABSTRACT", "LIST OF ABBREVIATIONS",
    "LIST OF FIGURES", "LIST OF TABLES", "REFERENCES",
    "INTRODUCTION", "AIM, OBJECTIVES AND RESEARCH SCOPE", "LITERATURE REVIEW",
    "RESEARCH METHODOLOGY", "RESULTS AND DISCUSSION", "CONCLUSIONS AND SUMMARY",
}

SECTION = re.compile(r'^(\d+)\.(\d+)(?:\.(\d+))?\s+\S')


def set_outline(p, level):
    pPr = p._p.get_or_add_pPr()
    old = pPr.find(qn('w:outlineLvl'))
    if old is not None:
        pPr.remove(old)
    el = OxmlElement('w:outlineLvl')
    el.set(qn('w:val'), str(level))
    pPr.append(el)


def replace_text(p, old, new):
    """Replace across a paragraph, collapsing to a single run if needed."""
    if old not in p.text:
        return False
    if len(p.runs) == 1:
        p.runs[0].text = p.runs[0].text.replace(old, new)
        return True
    # Multi-run: rewrite into the first run and blank the rest, keeping format
    full = p.text.replace(old, new)
    first = p.runs[0]
    for r in list(p.runs[1:]):
        r._element.getparent().remove(r._element)
    first.text = full
    return True


def main():
    in_place = "--in-place" in sys.argv
    doc = docx.Document(SRC)
    ps = doc.paragraphs

    print("TEXT REPAIRS")
    applied = set()
    for old, new, note in REPLACEMENTS:
        hit = False
        for p in ps:
            if old in p.text and replace_text(p, old, new):
                hit = True
                break
        print(f"  [{'ok ' if hit else 'MISS'}] {note}")
        if hit:
            applied.add(note)

    print("\nOUTLINE LEVELS (enables the TOC field to regenerate)")
    counts = {0: 0, 1: 0, 2: 0}
    for p in ps:
        t = p.text.strip()
        if not t or len(t) > 120:
            continue
        bold = bool(p.runs and p.runs[0].font.bold)
        if t in LEVEL0:
            set_outline(p, 0)
            counts[0] += 1
            continue
        m = SECTION.match(t)
        if m and bold:
            level = 2 if m.group(3) else 1
            set_outline(p, level)
            counts[level] += 1
    print(f"  level 0 (chapter / front matter): {counts[0]}")
    print(f"  level 1 (n.m sections)          : {counts[1]}")
    print(f"  level 2 (n.m.k subsections)     : {counts[2]}")
    print(f"  total headings marked           : {sum(counts.values())}")

    if in_place:
        b = backup(SRC)
        doc.save(SRC)
        print(f"\nUpdated Self.docx; backup {os.path.basename(b)}")
    else:
        out = os.path.join(ROOT, "Self_fm.docx")
        doc.save(out)
        print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
