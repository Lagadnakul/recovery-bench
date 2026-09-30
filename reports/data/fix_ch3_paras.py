"""
Session 7f — paragraph-level polish for Chapter 3 (and the same patterns
wherever they occur in Chapters 1 and 2).

Chapter 3 builds several arguments out of "display lines" -- short flow
expressions such as

    Plan -> Execute -> Observe -> Diagnose -> Replan -> Execute Again
    Attempt -> FAIL
    Correct diagnosis -> Correct intended modification -> Malformed patch -> FAIL

and a vertical "positioning ladder" in Section 3.11 built from alternating bold
labels and down-arrows. Three things made these read badly:

  1. The display lines sat flush left in bold, indistinguishable from a heading.
  2. Each carried full body spacing, so a lead-in ("For example:"), its display
     line, and the sentence that completes it ("would be classified as a
     failure...") were separated by as much space as three unrelated paragraphs.
  3. The Section 3.11 ladder spread eleven short paragraphs over most of a page.

Fix: display lines are centred and given tight spacing; a lead-in ending in a
colon keeps with the line that follows it; a continuation fragment (a paragraph
opening in lower case, directly after a display line) is pulled up against the
line it completes. Bullet lists get list spacing rather than body spacing.

No wording is changed -- this is layout only.

Run from the project root:
    python3 reports/data/fix_ch3_paras.py --in-place
"""

import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import docx
from docx.shared import Pt
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH

from docx_writer import backup  # noqa: E402

# Layout note: these scripts live in reports/data/, so the project root is
# two levels up. REPORTS anchors figures/, which moved alongside them.
REPORTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(REPORTS)
SRC = os.path.join(ROOT, "Self.docx")

FLOW = re.compile(r'[→↓]')          # -> or down-arrow
HEADING = re.compile(r'^(\d+\.\d+(\.\d+)?\s+\S|CHAPTER \d|Figure \d|Table \d)')


def is_list(p):
    return bool(p._p.findall('.//' + qn('w:numPr')))


def main():
    in_place = "--in-place" in sys.argv
    doc = docx.Document(SRC)
    ps = doc.paragraphs
    ch4 = next(i for i, p in enumerate(ps) if p.text.strip() == "CHAPTER 4")

    flow_n = lead_n = cont_n = list_n = 0

    for i in range(ch4):
        p = ps[i]
        t = p.text.strip()
        if not t or HEADING.match(t):
            continue
        pf = p.paragraph_format

        # --- bullet and numbered list items -------------------------------
        if is_list(p):
            pf.space_before = Pt(0)
            pf.space_after = Pt(3)
            pf.line_spacing = 1.15
            list_n += 1
            continue

        # --- display / flow lines ----------------------------------------
        if FLOW.search(t) and len(t) < 120:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            pf.space_before = Pt(2)
            pf.space_after = Pt(2)
            pf.line_spacing = 1.0
            pf.keep_with_next = True
            flow_n += 1
            continue

        # --- lead-in ending with a colon ---------------------------------
        if t.endswith(':') and len(t) < 110:
            pf.space_after = Pt(2)
            pf.keep_with_next = True
            lead_n += 1
            continue

        # --- continuation of the display line directly above --------------
        prev = ps[i - 1].text.strip() if i else ""
        if t[0].islower() and FLOW.search(prev):
            pf.space_before = Pt(0)
            cont_n += 1

    print(f"  {flow_n} display/flow lines centred and tightened")
    print(f"  {lead_n} colon lead-ins kept with the line that follows")
    print(f"  {cont_n} continuation fragments pulled up to their display line")
    print(f"  {list_n} list items given list spacing")

    # --- Section 3.11 positioning ladder ---------------------------------
    print("\n  Section 3.11 positioning ladder:")
    start = next((i for i, p in enumerate(ps)
                  if p.text.strip() == "Autonomous Coding Agents"), None)
    if start is not None:
        n = 0
        for i in range(start, min(start + 12, len(ps))):
            t = ps[i].text.strip()
            if not t:
                continue
            if t == "↓" or t in ("Autonomous Coding Agents",
                                      "Repository-Level Software Engineering",
                                      "Failure Detection",
                                      "Self-Reflection / Diagnosis",
                                      "Recovery", "Empirical Evaluation"):
                ps[i].alignment = WD_ALIGN_PARAGRAPH.CENTER
                pf = ps[i].paragraph_format
                pf.space_before = Pt(0)
                pf.space_after = Pt(0)
                pf.line_spacing = 1.0
                pf.keep_with_next = True
                n += 1
            else:
                break
        ps[start + n - 1].paragraph_format.keep_with_next = False
        ps[start + n - 1].paragraph_format.space_after = Pt(10)
        print(f"    {n} ladder rows centred, single-spaced, kept together")

    if in_place:
        b = backup(SRC)
        doc.save(SRC)
        print(f"\nUpdated Self.docx; backup {os.path.basename(b)}")
    else:
        doc.save(os.path.join(ROOT, "Self_c3p.docx"))
        print("\nWrote Self_c3p.docx")


if __name__ == "__main__":
    main()
