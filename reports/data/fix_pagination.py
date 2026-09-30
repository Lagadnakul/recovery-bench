"""
Session 7 — removes the stray blank pages and gives the document real page breaks.

Diagnosis
---------
The document contained 156 blank paragraphs sitting in runs of three or more,
the worst being 84 consecutive blanks before the Table of Contents. These runs
were doing the work of page breaks: the front matter had only two explicit page
breaks in total, so each certificate was pushed onto its own page by padding it
with empty lines. Any edit that changes text length then shifts everything and
leaves blank pages stranded in the middle of the document.

Chapters 1, 2 and 3 had no page break at all and simply ran on from the previous
chapter.

Fix
---
1. Delete every standalone page-break paragraph (they leave an empty line at the
   top of the following page).
2. Set the `page_break_before` paragraph property on every heading that must
   start a new page. This is robust: it survives edits to the text above it.
3. Delete the blank-paragraph runs, keeping at most one blank as spacing where a
   run sits inside the body text, and none immediately before a page break.

Blank paragraphs that hold an image or an explicit break are never touched.

Run from the project root:
    python3 reports/data/fix_pagination.py             # writes Self_pag.docx
    python3 reports/data/fix_pagination.py --in-place  # updates Self.docx, backs up
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import docx
from docx.oxml.ns import qn

from docx_writer import backup  # noqa: E402

# Layout note: these scripts live in reports/data/, so the project root is
# two levels up. REPORTS anchors figures/, which moved alongside them.
REPORTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(REPORTS)
SRC = os.path.join(ROOT, "Self.docx")

# Headings that must begin a new page.
PAGE_START = [
    "CERTIFICATE",
    "THESIS APPROVAL CERTIFICATE",
    "ACKNOWLEDGEMENT",
    "PAPER PUBLICATION CERTIFICATE",
    "ABSTRACT",
    "TABLE OF CONTENTS",
    "LIST OF ABBREVIATIONS",
    "LIST OF FIGURES",
    "LIST OF TABLES",
    "CHAPTER 1", "CHAPTER 2", "CHAPTER 3",
    "CHAPTER 4", "CHAPTER 5", "CHAPTER 6",
    "REFERENCES",
]

MAX_BODY_BLANKS = 1   # blanks tolerated inside running text


def is_blank(p):
    """True for a paragraph with no text, no image and no break."""
    if p.text.strip():
        return False
    if p._p.findall('.//' + qn('a:blip')):
        return False
    if p._p.findall('.//' + qn('w:br')):
        return False
    return True


def is_break_only(p):
    """A paragraph whose only content is a page break."""
    if p.text.strip() or p._p.findall('.//' + qn('a:blip')):
        return False
    return any(br.get(qn('w:type')) == 'page'
               for br in p._p.findall('.//' + qn('w:br')))


def drop(p):
    p._p.getparent().remove(p._p)


def main():
    in_place = "--in-place" in sys.argv
    doc = docx.Document(SRC)

    # ---- 1. remove standalone page-break paragraphs -----------------------
    removed_breaks = 0
    for p in list(doc.paragraphs):
        if is_break_only(p):
            drop(p)
            removed_breaks += 1
    print(f"removed {removed_breaks} standalone page-break paragraphs")

    # ---- 1b. strip page breaks left inside content paragraphs -------------
    # e.g. the examiner signature line "2)" on the approval certificate carried
    # a trailing page break. With page_break_before set on the next heading it
    # would produce an extra blank page.
    stripped = 0
    for p in doc.paragraphs:
        for br in p._p.findall('.//' + qn('w:br')):
            if br.get(qn('w:type')) == 'page':
                br.getparent().remove(br)
                stripped += 1
    print(f"stripped {stripped} page breaks from inside content paragraphs")

    # ---- 2. mark headings that start a page ------------------------------
    marked = []
    wanted = set(PAGE_START)
    for p in doc.paragraphs:
        t = p.text.strip()
        if t in wanted:
            p.paragraph_format.page_break_before = True
            marked.append(t)
            wanted.discard(t)
    print(f"set page_break_before on {len(marked)} headings")
    if wanted:
        print(f"  WARNING not found: {sorted(wanted)}")

    # ---- 3. collapse blank runs ------------------------------------------
    ps = doc.paragraphs
    starts = {i for i, p in enumerate(ps)
              if p.text.strip() in set(PAGE_START)}

    removed_blanks = 0
    run = []
    to_delete = []
    for i, p in enumerate(ps + [None]):
        if p is not None and is_blank(p):
            run.append(i)
            continue
        if run:
            # A run immediately preceding a page-starting heading is pure
            # padding: the page break now does that work.
            before_page_start = (i in starts)
            keep = 0 if before_page_start else MAX_BODY_BLANKS
            if len(run) > keep:
                to_delete.extend(run[keep:] if keep else run)
            run = []
    for i in to_delete:
        drop(ps[i])
        removed_blanks += 1
    print(f"removed {removed_blanks} blank paragraphs")

    # ---- report -----------------------------------------------------------
    doc2 = doc
    ps = doc2.paragraphs
    worst, cur = 0, 0
    for p in ps:
        cur = cur + 1 if is_blank(p) else 0
        worst = max(worst, cur)
    print(f"\nafter: {len(ps)} paragraphs, longest blank run now {worst}")

    if in_place:
        b = backup(SRC)
        doc.save(SRC)
        print(f"Updated Self.docx; backup {os.path.basename(b)}")
    else:
        out = os.path.join(ROOT, "Self_pag.docx")
        doc.save(out)
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()
