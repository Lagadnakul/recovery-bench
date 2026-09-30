"""
Session 7 — replaces the figure placeholders in Self.docx with the exported PNGs.

Each placeholder paragraph looks like
    [Figure 4.1 - insert fig4_1_pipeline.png]
and is immediately followed by its caption paragraph, which is left untouched.

Images are scaled to the usable text width (6.0 in) unless that would make them
taller than 7.5 in, in which case height governs instead so the figure and its
caption still fit on one page.

Run from the project root:
    python3 reports/data/insert_figures.py             # writes Self_figs.docx
    python3 reports/data/insert_figures.py --in-place  # updates Self.docx, backs up first
"""

import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import docx
from docx.shared import Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from PIL import Image

from docx_writer import backup  # noqa: E402

# Layout note: these scripts live in reports/data/, so the project root is
# two levels up. REPORTS anchors figures/, which moved alongside them.
REPORTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(REPORTS)
SRC = os.path.join(ROOT, "Self.docx")
PNG = os.path.join(REPORTS, "figures", "png")

MAX_W = 6.0   # inches — usable text width on A4 with 1 in margins
MAX_H = 7.5   # inches — leaves room for the caption beneath

PLACEHOLDER = re.compile(r"^\[(Figure \d+\.\d+)\s*[—-]\s*insert\s+(\S+\.png)\]$")


def fit(path):
    """Return (width, height) in inches, preserving aspect ratio."""
    with Image.open(path) as im:
        w, h = im.size
    width = MAX_W
    height = width * h / w
    if height > MAX_H:
        height = MAX_H
        width = height * w / h
    return Inches(width), Inches(height)


def main():
    in_place = "--in-place" in sys.argv
    doc = docx.Document(SRC)
    done, missing = [], []

    for p in doc.paragraphs:
        m = PLACEHOLDER.match(p.text.strip())
        if not m:
            continue
        label, fname = m.group(1), m.group(2)
        path = os.path.join(PNG, fname)
        if not os.path.exists(path):
            missing.append((label, fname))
            continue

        # Clear the placeholder text, then drop the image into the same paragraph
        for r in list(p.runs):
            r._element.getparent().remove(r._element)
        w, h = fit(path)
        p.add_run().add_picture(path, width=w, height=h)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pf = p.paragraph_format
        pf.space_before = docx.shared.Pt(6)
        pf.space_after = docx.shared.Pt(4)
        done.append((label, fname, round(w.inches, 2), round(h.inches, 2)))

    for label, fname, w, h in done:
        print(f"  inserted {label:<12} {fname:<26} {w} x {h} in")
    if missing:
        print("\n  MISSING:")
        for label, fname in missing:
            print(f"    {label}: {fname} not found in figures/png/")

    if in_place:
        b = backup(SRC)
        doc.save(SRC)
        print(f"\nUpdated Self.docx ({len(done)} figures); backup "
              f"{os.path.basename(b)}")
    else:
        out = os.path.join(ROOT, "Self_figs.docx")
        doc.save(out)
        print(f"\nWrote {out} ({len(done)} figures)")


if __name__ == "__main__":
    main()
