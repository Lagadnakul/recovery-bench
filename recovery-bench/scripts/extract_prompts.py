"""
Extracts the three condition prompt templates verbatim from the original
Python scripts and commits them as a checkable artifact.

The templates are the experiment. If the TypeScript reimplementation drifts
from them by a single character, the new runs are not comparable with Chapter
5 -- and nothing else in the pipeline would notice. This makes the originals
an oracle: data/original_prompts.json records each template together with the
SHA-256 of the file it came from, so a test can prove fidelity even after
Dissertation-main/ (gitignored, 94 MB) is gone.
"""
import hashlib, json, re, sys
from pathlib import Path

SRC = Path("../Dissertation-main/06_Methodology/code")

# condition -> (file, the assignment that starts the template)
TARGETS = {
    "l1_blind_retry":       "day12_step1_blindretry_searchreplace.py",
    "l2_reflection":        "day12_step2_reflectiononly_searchreplace.py",
    "l2_5_diagnose_revise": "day11b_diagnose_revise_searchreplace.py",
    # The first attempt, pre-retrofit. This one asks for a unified diff and a
    # PATCH: section, and it is the prompt that produced the baseline the whole
    # study measures recovery against. Notably it *instructs* the model that
    # hunk counts must match exactly -- the very defect D14 measured 16 of 51
    # model-written diffs failing on.
    "l0_baseline__unified_diff": "day7_step1_generate_full_pilot.py",
    # The first attempt in SEARCH/REPLACE form. This is the same file as
    # l1_blind_retry, and deliberately so: the blind-retry prompt shows the
    # problem and the file and NO history, so it *is* a first-attempt prompt.
    # Registered explicitly rather than left to a fallback, so the pairing is
    # visible in the artifact instead of implied by lookup order.
    "l0_baseline__search_replace": "day12_step1_blindretry_searchreplace.py",
}

def extract(path: Path) -> tuple[str, int, int]:
    """Pulls the f-string assigned to `prompt`, returning text and line span."""
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    start = None
    for i, line in enumerate(lines):
        if re.match(r'\s*prompt\s*=\s*f"""', line):
            start = i
            break
    if start is None:
        raise SystemExit(f"no `prompt = f\"\"\"` found in {path}")
    # The template begins after the opening delimiter on the same line.
    first = lines[start].split('f"""', 1)[1]
    body = [first]
    end = None
    for j in range(start + 1, len(lines)):
        if lines[j].startswith('"""'):
            end = j
            break
        body.append(lines[j])
    if end is None:
        raise SystemExit(f"unterminated template in {path}")
    return "".join(body), start + 1, end + 1

out = {
    "note": (
        "Verbatim prompt templates from the original study, the input to every "
        "recovery condition in Chapter 5. Extracted by scripts/extract_prompts.py. "
        "Placeholders are Python f-string expressions and are substituted, not "
        "reformatted, by packages/pipeline/strategies/prompt.ts."
    ),
    "source_repo": "Lagadnakul/Dissertation @ c8872d070fb0b098394796dfbc68bcf67c3bd957",
    "prompts": {},
}

if not SRC.is_dir():
    raise SystemExit(f"source not found: {SRC.resolve()}")

for cond, fname in TARGETS.items():
    p = SRC / fname
    text, lo, hi = extract(p)
    out["prompts"][cond] = {
        "source_file": f"06_Methodology/code/{fname}",
        "source_sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
        "line_range": [lo, hi],
        "placeholders": sorted(set(re.findall(r"\{([a-zA-Z_][\w\[\]'\"\.]*)\}", text))),
        "template": text,
    }

dest = Path("data/original_prompts.json")
dest.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

for cond, rec in out["prompts"].items():
    print(f"{cond:<22} {len(rec['template']):>5} chars  "
          f"lines {rec['line_range'][0]}-{rec['line_range'][1]}  "
          f"{len(rec['placeholders'])} placeholders")
print(f"\nwrote {dest}")
