"""
Session 4 — writes Chapter 5, sections 5.1 to 5.6, into Self.docx.

These sections report results only. Interpretation, cross-strategy analysis, the
comparison with the literature, and the threats to validity belong to Sections 5.7
to 5.13 (Session 5) and are referred forward to, not anticipated here.

Every figure in every table is taken from data/master_table.md, which is generated
from the harness reports by data/build_master_table.py.

Run from the project root:
    python3 reports/data/write_ch5_part1.py             # writes Self_ch5.docx
    python3 reports/data/write_ch5_part1.py --in-place  # updates Self.docx, backs up first
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from docx_writer import ChapterWriter  # noqa: E402

# Layout note: these scripts live in reports/data/, so the project root is
# two levels up. REPORTS anchors figures/, which moved alongside them.
REPORTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(REPORTS)
SRC = os.path.join(ROOT, "Self.docx")

NE = "Not evaluated"


def write(w):
    # =====================================================================
    w.chapter(5, "Results and Discussion")

    w.body(
        "This chapter presents the results of the experiment specified in Chapter 4. "
        "Sections 5.1 to 5.6 report the observations: the baseline outcome across the 20 "
        "selected instances, the classification of the resulting failures, the effect of the "
        "change in patch representation, and the outcome of each recovery strategy in each of "
        "the two rounds. These sections report what was observed and defer interpretation. "
        "Sections 5.7 to 5.13 then compare the strategies, interpret the null result, "
        "position the findings against the literature reviewed in Chapter 3, and state the "
        "threats to validity."
    )
    w.body(
        "All figures reported in this chapter are derived by script from the structured "
        "reports written by the evaluation harness, and the derivation can be re-executed "
        "against the published logs. Sub-test counts are read from the per-test status "
        "fields of those reports rather than from the summary resolution flag, for the "
        "reasons given in Section 4.14.1. Cells that were never evaluated are marked as such "
        "throughout and are never presented as failures, in accordance with the reporting "
        "commitments stated in Section 4.18.4."
    )

    # ------------------------------------------------------------- 5.1
    w.section("5.1", "Baseline Results")
    w.body(
        "Each of the 20 selected instances received one generation attempt under the "
        "conditions described in Section 4.10. Of these, 12 instances were resolved, meaning "
        "that every required test passed and no previously passing test regressed. This "
        "corresponds to a baseline resolution rate of 60 per cent. The remaining 8 instances "
        "were not resolved and constitute the failure pool."
    )
    w.body(
        "Table 5.1 records the outcome for every instance, together with the number of "
        "FAIL_TO_PASS tests that passed out of the number required and the number of "
        "PASS_TO_PASS tests that regressed. Figure 5.1 presents the same distribution "
        "graphically."
    )
    w.blank()
    w.caption_bold("Table 5.1: Baseline Results, All 20 Instances")
    w.table([
        ["Instance", "Outcome category", "FAIL_TO_PASS", "Regressions"],
        ["astropy__astropy-6938", "Resolved", "2 of 2", "0"],
        ["astropy__astropy-12907", "Resolved", "2 of 2", "0"],
        ["astropy__astropy-14365", "Resolved", "1 of 1", "0"],
        ["astropy__astropy-14995", "Resolved", "1 of 1", "0"],
        ["django__django-10914", "Resolved", "1 of 1", "0"],
        ["django__django-10924", "Resolved", "1 of 1", "0"],
        ["django__django-11001", "Resolved", "2 of 2", "0"],
        ["django__django-11049", "Resolved", "1 of 1", "0"],
        ["django__django-11099", "Resolved", "3 of 3", "0"],
        ["django__django-11133", "Resolved", "1 of 1", "0"],
        ["django__django-11179", "Resolved", "1 of 1", "0"],
        ["django__django-11422", "Resolved", "1 of 1", "0"],
        ["astropy__astropy-7746", "No progress", "0 of 1", "0"],
        ["django__django-11019", "No progress, with regressions", "0 of 16", "33"],
        ["django__django-11283", "No progress", "0 of 1", "0"],
        ["django__django-11564", "No progress", "0 of 2", "0"],
        ["astropy__astropy-14182", "Not applied (malformed patch)", "Not run", "Not run"],
        ["django__django-11039", "Not applied (malformed patch)", "Not run", "Not run"],
        ["django__django-11583", "Not applied (malformed patch)", "Not run", "Not run"],
        ["django__django-11620", "Not applied (malformed patch)", "Not run", "Not run"],
    ])
    w.blank()
    w.body(
        "Two observations are recorded here without comment and returned to later. The "
        "instance django__django-11019 is the only one in the sample requiring a large number "
        "of tests to pass, 16 in total, and is also the only instance at which the baseline "
        "patch caused regressions, breaking 33 previously passing tests. All other instances "
        "in the sample require between one and three tests to pass."
    )
    w.figure_placeholder("Figure 5.1", "Baseline Outcome Breakdown",
                         "fig5_1_baseline.png")

    # ------------------------------------------------------------- 5.2
    w.section("5.2", "Baseline Failure Classification")
    w.body(
        "The 8 unresolved instances did not fail in the same manner. Applying the taxonomy "
        "defined in Section 4.14.3 divides them into two groups of equal size, and the "
        "division is determined by a single question: whether the generated patch was "
        "successfully applied before any test was executed."
    )
    w.subsection("5.2.1", "Logic-Class Failures")
    w.body(
        "Four instances produced a patch that applied cleanly to the repository. The "
        "evaluation therefore proceeded, the designated tests were executed, and the required "
        "tests did not pass. These are astropy__astropy-7746, django__django-11019, "
        "django__django-11283, and django__django-11564. For these instances the evaluation "
        "yields information about the correctness of the proposed modification, because the "
        "modification was actually made and its behavioural consequences observed. They are "
        "referred to throughout this chapter as logic-class failures."
    )
    w.subsection("5.2.2", "Format-Class Failures")
    w.body(
        "Four instances produced a patch that could not be applied at all. In one case the "
        "harness reported that only unusable content was present in the patch input. For "
        "these instances no test was executed, so the evaluation yields no information "
        "whatsoever about whether the intended modification was correct; it establishes only "
        "that the modification was not expressible in the requested format. These are "
        "astropy__astropy-14182, django__django-11039, django__django-11583, and "
        "django__django-11620. They are referred to as format-class failures."
    )
    w.subsection("5.2.3", "Consequence for the Comparison")
    w.body(
        "That the failure pool divides evenly between the two classes is the central "
        "methodological observation of this study. Half of the pool entered it for a reason "
        "unrelated to software reasoning. A comparison of recovery strategies conducted over "
        "the pool as a whole, reporting a single aggregate recovery rate, would therefore have "
        "measured two different things at once and reported their sum. Every results table "
        "from this point forward distinguishes the two classes, and Section 5.9 sets out why "
        "the distinction changes the conclusion the study reaches."
    )

    # ------------------------------------------------------------- 5.3
    w.section("5.3", "The Patch-Formatting Confound")
    w.body(
        "The format-class failures were initially treated as ordinary failures. The "
        "recovery strategies were applied to the full pool of 8 instances using the original "
        "patch representation, in which the model was asked to emit a unified diff directly. "
        "Inspection of the resulting logs showed that the failures of this group were not "
        "distributed across the varied causes that a reasoning failure would produce, but "
        "were concentrated in the mechanics of the diff format itself: hunk headers declaring "
        "line positions that did not correspond to the target file, and in one case output "
        "that the patch utility could not parse at all."
    )
    w.body(
        "This prompted the change of representation described in Section 4.8.2 and treated as "
        "an experimental control in Section 4.15. Under the revised arrangement the model "
        "expresses each edit as a pair of literal text blocks, the edit is applied "
        "programmatically by exact string match, and the unified diff required by the harness "
        "is computed mechanically from the original and modified files. The model is no longer "
        "required to count lines or construct hunk headers."
    )
    w.body(
        "The effect was immediate and is reported here as an observation. Of the 4 "
        "format-class instances, 3 were subsequently resolved. The fourth, "
        "astropy__astropy-14182, could not be evaluated at all for the reason recorded in "
        "Section 4.18.3, the provider having declined to generate output for it. Every "
        "format-class instance that could be evaluated after the change of representation was "
        "resolved."
    )
    w.body(
        "The instances django__django-11039 and django__django-11583 were resolved under "
        "Blind Retry while the original representation was still in use, and were not "
        "subsequently re-evaluated under the remaining two conditions, the requests being "
        "reserved for the logic-class instances for the reason given in Section 4.5.2. The "
        "instance django__django-11620 was evaluated under all three conditions after the "
        "retrofit and was resolved by each of them."
    )
    w.body(
        "A second effect of the change of representation was observed on a logic-class "
        "instance and is reported in Section 5.4, because it concerns the sub-test counts "
        "rather than the resolution flag."
    )

    # ------------------------------------------------------------- 5.4
    w.section("5.4", "Results After the Fairness Retrofit")
    w.body(
        "The change of patch representation altered the measured outcome on "
        "django__django-11019, the instance requiring 16 tests to pass. This instance is not "
        "recorded as resolved either before or after the change, so the alteration is "
        "invisible to the benchmark's resolution flag and is observable only in the sub-test "
        "counts introduced for this purpose in Section 4.14.1."
    )
    w.body(
        "Under the original representation the baseline patch for this instance passed 0 of "
        "the 16 required tests and caused 33 previously passing tests to fail. Under the "
        "revised representation the patch passed 6 of the 16 required tests and caused no "
        "regressions. The change is therefore from 0 to 6 on the required tests, and from 33 "
        "to 0 on the regressions. Figure 5.2 presents both movements."
    )
    w.body(
        "This is the largest single change in measured behaviour observed anywhere in this "
        "study. It was produced without altering the model, the sampling configuration, the "
        "issue description, the repository context, or the instructions governing the "
        "reasoning required. The only quantity that changed was the format in which the edit "
        "was expressed. Section 5.9 examines what follows from this."
    )
    w.body(
        "The same figure of 6 of 16 was subsequently returned by every evaluated recovery "
        "cell for this instance, under all three strategies and in both rounds. The tables in "
        "Sections 5.5 and 5.6 record this, and Section 5.7 examines it."
    )
    w.figure_placeholder("Figure 5.2", "Sub-Test Recovery on django__django-11019",
                         "fig5_2_subtest.png")

    # ------------------------------------------------------------- 5.5
    w.section("5.5", "Recovery Outcomes: Round One")
    w.body(
        "Table 5.2 reports the outcome of each recovery strategy applied to each instance in "
        "the failure pool during the first recovery round. Cells in which no evaluation was "
        "performed are marked as not evaluated. As set out in Sections 4.5.2 and 4.8.2, such "
        "a cell arises either because the daily request ceiling was reached before the "
        "combination could be attempted, or because the model's proposed edit was rejected by "
        "the applicator and no patch was produced. In neither case does the cell constitute "
        "evidence about the strategy, and it is not counted as a failure."
    )
    w.blank()
    w.caption_bold("Table 5.2: Round One Recovery Outcomes")
    w.table([
        ["Instance", "Class", "Blind Retry", "Reflection-only", "Diagnose+Revise"],
        ["astropy__astropy-7746", "Logic", NE, NE, "No progress, 0 of 1"],
        ["django__django-11019", "Logic", "Partial, 6 of 16", "Partial, 6 of 16",
         "Partial, 6 of 16"],
        ["django__django-11283", "Logic", NE, NE,
         "No progress, 0 of 1, with 8 regressions"],
        ["django__django-11564", "Logic", "No progress, 0 of 2", NE,
         "No progress, 0 of 2"],
        ["astropy__astropy-14182", "Format", "Excluded", "Excluded", "Excluded"],
        ["django__django-11039", "Format", "Resolved (pre-retrofit)", NE, NE],
        ["django__django-11583", "Format", "Resolved (pre-retrofit)", NE, NE],
        ["django__django-11620", "Format", "Resolved", "Resolved", "Resolved"],
    ])
    w.blank()
    w.body(
        "Considering first the four logic-class instances, no instance was resolved by any "
        "strategy. One instance, django__django-11019, returned a partial outcome of 6 of 16 "
        "required tests under each of the three strategies. The remaining evaluated cells "
        "returned no progress. One cell, django__django-11283 under Diagnose+Revise, "
        "additionally caused 8 previously passing tests to fail."
    )
    w.body(
        "Coverage of the logic-class instances in this round was uneven. Diagnose+Revise was "
        "evaluated on all 4; Blind Retry on 2; Reflection-only on 1. The unevenness is a "
        "consequence of the constraint documented in Section 4.5.2 and not of any selection "
        "decision, and it means that the round-one figures alone do not support a comparison "
        "between the three strategies on equal terms. The second round, reported in Section "
        "5.6, was conducted in part to address this."
    )
    w.body(
        "Considering the format-class instances, the 3 that could be evaluated were resolved. "
        "The instance evaluated under all three conditions, django__django-11620, was "
        "resolved by each of them."
    )

    # ------------------------------------------------------------- 5.6
    w.section("5.6", "Recovery Outcomes: Round Two")
    w.body(
        "The second recovery round was applied to the four logic-class instances under the "
        "arrangement described in Section 4.16, each strategy revising its own previous work "
        "rather than the baseline. The format-class instances were not re-evaluated in this "
        "round, the three evaluable members of that group having already been resolved. "
        "Table 5.3 reports the outcome."
    )
    w.blank()
    w.caption_bold("Table 5.3: Round Two Recovery Outcomes")
    w.table([
        ["Instance", "Blind Retry", "Reflection-only", "Diagnose+Revise"],
        ["astropy__astropy-7746", "No progress, 0 of 1", "No progress, 0 of 1",
         "No progress, 0 of 1"],
        ["django__django-11019", "Partial, 6 of 16", "Partial, 6 of 16",
         "Partial, 6 of 16"],
        ["django__django-11283", "No progress, 0 of 1", "No progress, 0 of 1", NE],
        ["django__django-11564", NE, NE, "No progress, 0 of 2"],
    ])
    w.blank()
    w.body(
        "No instance was resolved by any strategy in the second round. Every evaluated cell "
        "returned the same outcome category as the corresponding cell in the first round, and "
        "where sub-test counts are available they are identical. In particular "
        "django__django-11019 returned 6 of 16 under every strategy in both rounds, and "
        "astropy__astropy-7746 returned 0 of 1 under every strategy in both rounds. No "
        "regressions were observed in any second-round cell, including the cell that had "
        "produced 8 regressions in the first round."
    )
    w.body(
        "Coverage in this round was more even than in the first but remained incomplete. Each "
        "strategy was evaluated on 3 of the 4 logic-class instances, but not on the same 3: "
        "Blind Retry and Reflection-only were evaluated on astropy__astropy-7746, "
        "django__django-11019 and django__django-11283, whereas Diagnose+Revise was evaluated "
        "on astropy__astropy-7746, django__django-11019 and django__django-11564."
    )
    w.subsection("5.6.1", "Coverage Across Both Rounds")
    w.body(
        "Because coverage is incomplete in both rounds and incomplete in different places, "
        "the extent of the evidence supporting the comparison is stated explicitly. The "
        "comparison of three strategies over four logic-class instances across two rounds "
        "defines 24 cells. Of these, 16 were evaluated and 8 were not. Table 5.4 gives the "
        "distribution."
    )
    w.blank()
    w.caption_bold("Table 5.4: Coverage of the Logic-Class Comparison")
    w.table([
        ["Strategy", "Round one", "Round two", "Total evaluated"],
        ["Blind Retry", "2 of 4", "3 of 4", "5 of 8"],
        ["Reflection-only", "1 of 4", "3 of 4", "4 of 8"],
        ["Diagnose+Revise", "4 of 4", "3 of 4", "7 of 8"],
        ["All strategies", "7 of 12", "9 of 12", "16 of 24"],
    ])
    w.blank()
    w.body(
        "The claim that the observations support is therefore consistency across every cell "
        "that was evaluated, in both rounds and under all three strategies, together with the "
        "coverage figure of 16 cells of 24. The observations do not support a claim of "
        "consistency across the failure pool as a whole, and no such claim is made in this "
        "dissertation. Section 5.12 records the incompleteness of coverage among the threats "
        "to validity."
    )
    w.body(
        "Sections 5.7 to 5.13 now interpret these observations, beginning with the comparison "
        "between the three strategies and the cost at which each was obtained."
    )


def main():
    in_place = "--in-place" in sys.argv
    w = ChapterWriter(SRC)
    write(w)
    if in_place:
        b = w.save_in_place()
        print(f"Updated Self.docx (backup at {os.path.basename(b)})")
    else:
        out = os.path.join(ROOT, "Self_ch5.docx")
        w.save_as(out)
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()
