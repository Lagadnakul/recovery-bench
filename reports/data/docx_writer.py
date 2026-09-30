"""
Writes new chapters into Self.docx using Nakul's own formatting conventions.

Why this module exists
----------------------
Self.docx does not use Word heading styles. 747 of its 748 paragraphs carry the
`Normal` style, and headings are produced by direct run formatting (bold + point
size) on Normal paragraphs. Appending content with python-docx's `add_heading()`
would apply the `Heading 1/2/3` styles instead, which look different, and would
make the new chapters visibly inconsistent with Chapters 1-3.

This module therefore reproduces the existing convention exactly, as measured
from the document itself:

    CHAPTER n       centred, 18 pt, bold          (para 206, 366)
    TITLE           centred, 14 pt, bold          (para 207, 367)
    n.m Heading     left,    14 pt, bold          (para 208, 368, ...)
    n.m.k Heading   left,    default size, bold   (para 327, 413, ...)
    body            left,    default, regular
    Figure n.m Cap  left,    default, regular     (para 231, 259, 272)

Body font is inherited from the `Normal` style (Times New Roman), so runs
deliberately leave `font.name` unset.

Safety
------
`save_as()` never overwrites the input. Callers pass an explicit output path and
`backup()` writes a timestamped copy before any in-place save.
"""

import os
import shutil
import datetime

import docx
from docx.shared import Pt, Twips
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

CHAPTER_PT = 18
SECTION_PT = 14

# Usable text width on this document's page: A4 (8.27 in) less 1 in margins each
# side = 6.267 in = 9024 twips. Tables wider than this overflow the right margin.
USABLE_TWIPS = 9024

# Border spec copied from Tables 3.1 and 3.2 in Self.docx: single line,
# sz=4 (half-points, i.e. 0.5 pt), colour auto, on all six edges.
BORDER_EDGES = ("top", "left", "bottom", "right", "insideH", "insideV")


def set_table_borders(table, sz=4, val="single", color="auto"):
    """Write explicit <w:tblBorders> onto a table.

    Relying on the `Table Grid` style alone is fragile: the borders live in
    styles.xml and are lost if the style is renamed, redefined, or missing in a
    target template. Chapters 1-3 of Self.docx set borders on the table element
    directly, so new tables do the same.
    """
    tblPr = table._tbl.tblPr
    existing = tblPr.find(qn("w:tblBorders"))
    if existing is not None:
        tblPr.remove(existing)
    borders = OxmlElement("w:tblBorders")
    for edge in BORDER_EDGES:
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), val)
        el.set(qn("w:sz"), str(sz))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        borders.append(el)
    tblPr.append(borders)
    return table


def fit_table_width(table, twips=USABLE_TWIPS):
    """Constrain a table to the usable text width.

    `Table.width` in python-docx does not rewrite the underlying <w:tblW>, so the
    element is set directly. A table left at a larger explicit width (Word writes
    one when a user drags a column) overflows the right margin on print.
    """
    tblPr = table._tbl.tblPr
    existing = tblPr.find(qn("w:tblW"))
    if existing is not None:
        tblPr.remove(existing)
    tblW = OxmlElement("w:tblW")
    tblW.set(qn("w:w"), str(twips))
    tblW.set(qn("w:type"), "dxa")
    tblPr.append(tblW)

    layout = tblPr.find(qn("w:tblLayout"))
    if layout is None:
        layout = OxmlElement("w:tblLayout")
        tblPr.append(layout)
    layout.set(qn("w:type"), "autofit")

    table.autofit = True
    for row in table.rows:
        for cell in row.cells:
            cell.width = Twips(twips // len(row.cells))
    return table


def backup(path):
    """Copy `path` beside itself with a timestamp. Returns the backup path."""
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    base, ext = os.path.splitext(path)
    dest = f"{base}.backup-{stamp}{ext}"
    shutil.copy2(path, dest)
    return dest


class ChapterWriter:
    """Appends formatted paragraphs to the end of an existing document."""

    def __init__(self, path):
        self.path = path
        self.doc = docx.Document(path)
        self._trim_trailing_blanks()

    # ------------------------------------------------------------- internals
    def _trim_trailing_blanks(self):
        """Remove the empty paragraphs the document currently ends with.

        Self.docx ends with eight blank Normal paragraphs (740-747). Appending
        after them would leave a ragged gap before the new chapter.
        """
        self.removed = 0
        while self.doc.paragraphs and not self.doc.paragraphs[-1].text.strip():
            p = self.doc.paragraphs[-1]._element
            p.getparent().remove(p)
            self.removed += 1

    def _para(self, text, *, size=None, bold=False, centre=False, italic=False):
        p = self.doc.add_paragraph()
        p.style = self.doc.styles["Normal"]
        if centre:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if text:
            r = p.add_run(text)
            if size:
                r.font.size = Pt(size)
            r.font.bold = bold or None
            r.font.italic = italic or None
        return p

    # ---------------------------------------------------------------- public
    def page_break(self):
        from docx.enum.text import WD_BREAK
        p = self.doc.add_paragraph()
        p.style = self.doc.styles["Normal"]
        p.add_run().add_break(WD_BREAK.PAGE)
        return p

    def chapter(self, number, title):
        """`CHAPTER 4` (18 pt) + `METHODOLOGY` (14 pt), both centred and bold.

        Matches Chapters 1 and 2. Chapter 3 uses 16 pt for both lines, which is
        an existing inconsistency listed for correction in the front-matter pass.
        """
        self.page_break()
        self._para(f"CHAPTER {number}", size=CHAPTER_PT, bold=True, centre=True)
        self._para(title.upper(), size=SECTION_PT, bold=True, centre=True)

    def section(self, number, title):
        """`4.1 Overview` — left, 14 pt bold."""
        self._para(f"{number} {title}", size=SECTION_PT, bold=True)

    def subsection(self, number, title):
        """`4.1.1 Detail` — left, default size, bold."""
        self._para(f"{number} {title}", bold=True)

    def body(self, text):
        """One body paragraph, Normal, inherited font."""
        self._para(text)

    def blank(self):
        self._para("")

    def caption(self, text):
        """`Figure 4.1 Something` — plain, matching paras 231/259/272."""
        self._para(text)

    def caption_bold(self, text):
        """`Table 4.1: Something` — bold, default size, matching para 628/643."""
        self._para(text, bold=True)

    def figure_placeholder(self, label, caption, filename):
        """Marks where a draw.io export will be inserted in Session 7."""
        self._para(f"[{label} — insert {filename}]", italic=True)
        self.caption(f"{label} {caption}")

    def bullets(self, items):
        for it in items:
            p = self._para(f"•\t{it}")
            pf = p.paragraph_format
            pf.left_indent = Pt(18)
            pf.first_line_indent = Pt(-18)

    def references(self, entries):
        """`REFERENCES` heading plus a hanging-indented IEEE-style entry list.

        Rendered as a chapter-level heading (centred, 18 pt, bold) because it is a
        top-level division of the document, not a section of Chapter 6.
        """
        self.page_break()
        self._para("REFERENCES", size=CHAPTER_PT, bold=True, centre=True)
        self.blank()
        for entry in entries:
            p = self._para(entry)
            pf = p.paragraph_format
            pf.left_indent = Pt(28)
            pf.first_line_indent = Pt(-28)
            pf.space_after = Pt(6)
        return self

    def table(self, rows, header=True, size=None):
        """Insert a bordered table sized to the usable text width.

        Borders are written explicitly (see `set_table_borders`) rather than left
        to the table style, so they render regardless of how the style resolves.
        """
        if not rows:
            return None
        names = [s.name for s in self.doc.styles]
        style = "Table Grid" if "Table Grid" in names else "TableGrid"
        t = self.doc.add_table(rows=len(rows), cols=len(rows[0]))
        t.style = self.doc.styles[style]
        for i, row in enumerate(rows):
            for j, cell in enumerate(row):
                para = t.cell(i, j).paragraphs[0]
                run = para.add_run(str(cell))
                if header and i == 0:
                    run.font.bold = True
                if size:
                    run.font.size = Pt(size)
        set_table_borders(t)
        fit_table_width(t)
        return t

    def save_as(self, out_path):
        self.doc.save(out_path)
        return out_path

    def save_in_place(self):
        b = backup(self.path)
        self.doc.save(self.path)
        return b


def audit(path):
    """Print a formatting profile — used to verify appended content matches."""
    d = docx.Document(path)
    print(f"{path}: {len(d.paragraphs)} paragraphs, {len(d.tables)} tables")
    for i, p in enumerate(d.paragraphs):
        t = p.text.strip()
        if not t:
            continue
        r = p.runs[0] if p.runs else None
        sz = r.font.size.pt if (r and r.font.size) else None
        bold = r.font.bold if r else None
        if bold or (sz and sz >= SECTION_PT):
            align = "CENTRE" if p.alignment == WD_ALIGN_PARAGRAPH.CENTER else "left"
            print(f"  {i:4} | {p.style.name:<8} | {align:<6} | "
                  f"sz={str(sz):<5} bold={str(bold):<5} | {t[:60]}")


if __name__ == "__main__":
    import sys
    audit(sys.argv[1] if len(sys.argv) > 1 else "Self.docx")
