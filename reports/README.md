# reports/

Everything that supports the written dissertation, in one place, so the project
root holds only documents and the two working directories.

```
reports/
├── data/        the writing phase — 20 build scripts + the source-of-truth files
├── figures/     11 .drawio sources, with figures/png/ exports
├── fill_report.py                              weekly progress report generator
├── week05.json                                 one file per week
└── MTech_Weekly_Progress_Report_Week05.docx
```

Two unrelated things share this folder: the material that **built** the
dissertation, and the **weekly reports** submitted while building it. They are
kept together because both are report-facing and neither belongs at the root.

---

## data/ — the writing phase

Source-of-truth files. Every number in Chapters 4 and 5 cites one of these:

| File | What it fixes |
| --- | --- |
| `master_table.md` | 42 records — per task, per condition, per round: `resolved`, F2P *n/m*, P2P broken, apply status |
| `config.md` | model id, SDK, temperature (unset — recorded as such), context sizes, throttle, run dates |
| `rq_canonical.md` | RQ1–RQ5 reconciled into one set |
| `outcome_taxonomy.md` | the five outcome categories used in §4.14 |

The 20 `.py` files are the scripts that wrote and corrected `Self.docx`, in
dependency order: `build_master_table` → `write_ch4_*` → `write_ch5_*` →
`write_ch6_refs` → `make_figures` → `insert_figures` → the `fix_*` passes.

They need `python-docx`, `pillow` and `matplotlib`. The system Python is
externally managed (PEP 668), so use a virtual environment:

```sh
python3 -m venv .venv && .venv/bin/pip install python-docx pillow matplotlib
.venv/bin/python reports/data/build_master_table.py
```

### The path anchors, and why they are the way they are

These scripts used to live at the project root and derived the root as **their own
parent directory**. After the move that would have resolved to `reports/`, so
`Self.docx` would silently not have been found. Each script now carries two:

```python
REPORTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # reports/
ROOT    = os.path.dirname(REPORTS)                                     # project root
```

`ROOT` for `Self.docx`, the `Self_*.docx` outputs and `Dissertation-main/`;
`REPORTS` for `figures/`, which moved with them. Verified by re-running
`build_master_table.py`: 42 records, **byte-identical output**.

A few prose strings inside `write_ch*.py` still read `data/config.md` rather than
`reports/data/config.md`. That is left alone on purpose — those scripts are the
provenance of the submitted text, and changing their content would make them no
longer match what produced `Self.docx`. Only path anchors and usage comments were
updated.

## figures/

Eleven figures as editable draw.io sources with PNG exports: `fig4_1`–`fig4_6`,
`fig5_1`–`fig5_4`, `fig6_1`. `make_figures.py` writes the `.drawio` files and
`insert_figures.py` places the PNGs into the document.

They are greyscale because print demanded it. The exports are already embedded in
`Self.docx`, so this directory moving cannot affect the submitted document — and
`Self.docx` contains no reference to any of these paths, which was checked before
the move rather than assumed.

---

## Weekly progress reports

The department's form is filled from a JSON file per week, so the six remaining
build stages each cost one small edit instead of a retype, and the layout stays
byte-identical to the template.

```sh
.venv/bin/python reports/fill_report.py reports/week05.json
# → reports/MTech_Weekly_Progress_Report_Week05.docx
```

`MTech_Weekly_Progress_Report_Format.docx` at the project root is the department's
template and is never modified — the script opens it, fills only the blank runs,
and saves a copy. **Guide Remarks and both signature lines stay blank**, for
handwriting.

### Week numbering

There is no academic calendar in the project, so weeks are anchored on
**Monday 24 August 2026** — the Monday of the week containing the first commit to
`Lagadnakul/Dissertation`.

| Week | Period |
| --- | --- |
| 1 | 24–30 Aug 2026 |
| 2 | 31 Aug – 6 Sep |
| 3 | 7–13 Sep |
| 4 | 14–20 Sep |
| **5** | **21–27 Sep** ← the submitted document + build steps 0–2 |
| 6 | 28 Sep – 4 Oct |
| 7 | 5–11 Oct |

**If the department counts from a different date, change `week_number` and the
period fields.** Nothing else depends on them.

### Writing a new week

Copy `week05.json` and change the fields. Each block carries an `_evidence_*` key
naming where its claims come from — a file, a test, or a decision-log entry.
Keeping that habit means any line a supervisor asks about has an answer, and it
makes the next report faster because the evidence is already located.

Three items per section is the template's limit. Fewer is fine — the script clears
unused lines rather than leaving empty rules.

### Weeks 1–4

Not written. Local evidence covers the experiment phase (27–31 Aug, from the
commit history) and the writing phase (24–25 Sep, from file timestamps), but
nothing between 1 and 23 September. Those weeks need Nakul's own account; the
evidence here cannot supply it.
