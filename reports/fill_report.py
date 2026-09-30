#!/usr/bin/env python3
"""
Fills the department's weekly progress report template from a week JSON file.

    python3 reports/fill_report.py reports/week05.json

Writes reports/MTech_Weekly_Progress_Report_Week<NN>.docx.

Why a script rather than typing into Word: the build has six more stages, so this
form recurs weekly. Each future week becomes an edit to a small JSON file, and the
department's layout, fonts and spacing stay byte-identical because the template is
never rebuilt — only its blank runs are filled.

Requires python-docx. The system Python is externally managed (PEP 668), so:

    python3 -m venv .venv && .venv/bin/pip install python-docx
    .venv/bin/python reports/fill_report.py reports/week05.json
"""

import json
import re
import sys
from pathlib import Path

from docx import Document

TEMPLATE = Path("MTech_Weekly_Progress_Report_Format.docx")

# Section heading in the template  ->  key in the week JSON holding 3 items.
LIST_SECTIONS = {
    "Work Planned for the Week": "work_planned",
    "Work Completed During the Week": "work_completed",
    "Key Achievements": "key_achievements",
    "Challenges / Issues Faced": "challenges",
    "Support Required from Guide": "support_required",
    "Work Plan for Next Week": "next_week_plan",
}

# Label before the blank  ->  key in the week JSON.
INLINE_FIELDS = {
    "Week Number": "week_number",
    "Student Name": "student_name",
    "Enrollment Number": "enrollment_number",
    "Project Title": "project_title",
    "Overall Project Completion (%)": "completion_percent",
}

BLANK = re.compile(r"_{3,}")


def set_text(para, text):
    """Replaces a paragraph's text while keeping the first run's formatting."""
    if not para.runs:
        para.add_run(text)
        return
    para.runs[0].text = text
    for run in para.runs[1:]:
        run.text = ""


def fill_blank(para, value):
    """Replaces the underscore run in `Label: ______` with `value`."""
    joined = "".join(run.text for run in para.runs)
    set_text(para, BLANK.sub(str(value), joined, count=1))


def fill_period(para, week):
    joined = "".join(run.text for run in para.runs)
    filled = BLANK.sub(week["period_from"], joined, count=1)
    filled = BLANK.sub(week["period_to"], filled, count=1)
    set_text(para, filled)


def tick(para, chosen):
    """Marks the selected progress status and leaves the others as empty boxes."""
    joined = "".join(run.text for run in para.runs)
    out = []
    for option in ("On Schedule", "Slightly Delayed", "Delayed", "Ahead of Schedule"):
        if option not in joined:
            continue
        # "Delayed" is a substring of "Slightly Delayed"; compare the whole label.
        mark = "☒" if option == chosen else "☐"
        out.append(f"{mark} {option}")
    set_text(para, "    ".join(out))


def main(week_path):
    week = json.loads(Path(week_path).read_text())
    doc = Document(str(TEMPLATE))

    section = None          # the list section we are inside
    item_index = 0          # which numbered line within it
    remarks_target = None   # "student" | "guide" | None
    remarks_written = False

    for para in doc.paragraphs:
        text = "".join(run.text for run in para.runs).strip()
        if not text:
            continue

        # --- section headings -------------------------------------------------
        if text in LIST_SECTIONS:
            section = LIST_SECTIONS[text]
            item_index = 0
            remarks_target = None
            continue

        if text.startswith("Student Remarks"):
            remarks_target, remarks_written, section = "student", False, None
            continue
        if text.startswith("Guide Remarks"):
            remarks_target, remarks_written, section = "guide", False, None
            continue
        if text.startswith("Progress Status"):
            section, remarks_target = None, None
            continue

        # --- numbered items --------------------------------------------------
        if section and re.match(r"^\d+\.", text):
            items = week[section]
            if item_index < len(items):
                number = text.split(".", 1)[0]
                set_text(para, f"{number}. {items[item_index]}")
            else:
                # Fewer items than blanks: clear the line rather than leave rules.
                set_text(para, "")
            item_index += 1
            continue

        # --- the tick-box line -----------------------------------------------
        if "On Schedule" in text and "Delayed" in text:
            tick(para, week["progress_status"])
            continue

        # --- free-text remarks ----------------------------------------------
        # Only a line that is *nothing but* rules belongs to a remarks block.
        # "Student Signature: ____" also matches BLANK and must not be consumed
        # here, or it silently swallows the signature and date fields below.
        if remarks_target and BLANK.fullmatch(text):
            key = f"{remarks_target}_remarks"
            if not remarks_written and week.get(key):
                set_text(para, week[key])
                remarks_written = True
            elif remarks_target == "student" and remarks_written:
                set_text(para, "")  # second rule line no longer needed
            # Guide's blank rules are left intact for handwriting.
            continue

        # --- labelled inline blanks ------------------------------------------
        if "Reporting Period" in text:
            fill_period(para, week)
            continue

        for label, key in INLINE_FIELDS.items():
            if text.startswith(label):
                fill_blank(para, week[key])
                break
        else:
            if text.startswith("Date:"):
                fill_blank(para, week["date_signed"])
            # Signature lines keep their rules — they are signed by hand.

    out = Path("reports") / f"MTech_Weekly_Progress_Report_Week{week['week_number']}.docx"
    doc.save(str(out))
    print(f"wrote {out}")
    return out


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
