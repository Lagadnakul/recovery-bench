"""
Session 3 — writes Chapter 4, sections 4.10 to 4.19, into Self.docx.

Continues directly from Section 4.9. Every factual claim traces to data/config.md,
data/master_table.md or data/outcome_taxonomy.md, and the prompt descriptions in
Sections 4.11 to 4.13 are taken from the generation scripts themselves.

Run from the project root:
    python3 reports/data/write_ch4_part2.py             # writes Self_ch4b.docx
    python3 reports/data/write_ch4_part2.py --in-place  # updates Self.docx, backs up first
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


def write(w):
    # ------------------------------------------------------------- 4.10
    w.section("4.10", "Baseline Evaluation")
    w.body(
        "The baseline stage establishes which tasks fail, and in what manner, before any "
        "recovery strategy is applied. Each of the 20 selected instances received exactly "
        "one generation attempt. The prompt supplied the repository name, the issue "
        "description recorded in the benchmark, the complete contents of the target file "
        "retrieved at the base commit, and the instructions governing the required output "
        "format. No information about the reference solution, the test names, or the "
        "expected behaviour beyond the issue text was provided."
    )
    w.body(
        "The resulting patches were evaluated by the harness described in Section 4.9. The "
        "outcome distribution was 12 instances resolved, 4 instances in which the patch "
        "applied but the required tests did not pass, and 4 instances in which the generated "
        "patch could not be applied at all. The 8 unresolved instances constitute the "
        "failure pool, and every recovery condition described below operates on that pool. "
        "The complete baseline record appears as Table 5.1."
    )
    w.body(
        "Two features of the baseline require emphasis before the recovery strategies are "
        "defined. The first is that the failure pool is not homogeneous. Half of its members "
        "entered it because no patch could be applied, which means no test was executed and "
        "no evidence was obtained about the quality of the underlying reasoning. The other "
        "half entered it because a validly applied patch did not produce the required "
        "behaviour. These are different kinds of failure and, as Section 4.14 sets out, they "
        "are classified separately and reported separately throughout Chapter 5."
    )
    w.body(
        "The second is that the baseline attempt is itself the first element of the "
        "comparison. Blind Retry, defined in Section 4.11, is a second attempt made under "
        "the same conditions as the first. The baseline therefore functions both as the "
        "selection mechanism for the failure pool and as the reference point against which "
        "the effect of additional post-failure information is measured."
    )

    # ------------------------------------------------------------- 4.11–4.13
    w.section("4.11", "Recovery Strategy 1: Blind Retry")
    w.body(
        "Blind Retry re-attempts a failed task with no information about the failure. The "
        "prompt is constructed identically to the baseline prompt: the repository name, the "
        "issue description, the complete target file, and the output-format instructions. "
        "The model is not informed that a previous attempt was made, is not shown that "
        "attempt, and receives no test output. Any change in outcome relative to the "
        "baseline is therefore attributable to sampling variation alone."
    )
    w.body(
        "This condition is essential to the design rather than merely a control of "
        "convenience. A recovery strategy that supplies additional information can only be "
        "credited with an improvement if that improvement exceeds what re-sampling achieves "
        "unaided. Much of the reported benefit of iterative self-correction in the "
        "literature has been obtained without such a control, and Chapter 3 identifies its "
        "absence as one of the gaps this study addresses. Blind Retry establishes the floor "
        "against which the remaining two conditions are assessed."
    )

    w.section("4.12", "Recovery Strategy 2: Reflection-only")
    w.body(
        "Reflection-only supplies the model with its own previous attempt and requires it to "
        "criticise that attempt before proposing a revision. The prompt states that a "
        "previous attempt was made and did not resolve the issue, reproduces the complete "
        "text of that previous response, and instructs the model to reflect critically on "
        "what might have been wrong with its earlier reasoning before providing a revised "
        "fix. The response format is extended by a REFLECTION field of two to four sentences "
        "that precedes the explanation and the edits."
    )
    w.body(
        "The previous attempt is supplied as the complete raw text of the earlier model "
        "response, comprising its stated explanation and its proposed edits, rather than as "
        "the derived patch. The model therefore sees its own reasoning as it originally "
        "expressed it, which is the form of self-reflection described in the Reflexion and "
        "Self-Refine literature reviewed in Sections 3.3.1 and 3.3.2."
    )
    w.body(
        "Critically, no execution information is provided. The model is told that its "
        "previous attempt failed, but not which tests failed, nor with what error, nor "
        "whether the failure arose from incorrect logic or from an unmet requirement it had "
        "not considered. The condition therefore tests whether unaided introspection over "
        "an unsuccessful attempt is sufficient to improve it, which is the precise question "
        "raised by Huang et al. in their analysis of intrinsic self-correction."
    )

    w.section("4.13", "Recovery Strategy 3: Diagnose+Revise")
    w.body(
        "Diagnose+Revise supplies everything given to Reflection-only and adds the observed "
        "result of executing the previous patch against the project test suite. The prompt "
        "presents this material explicitly as ground truth rather than conjecture, and "
        "instructs the model to diagnose the specific root cause on the basis of that "
        "evidence before revising. The response format substitutes a DIAGNOSIS field for the "
        "REFLECTION field, requiring the identified root cause to be grounded in the "
        "evidence supplied."
    )
    w.body(
        "The evidence is extracted from the artefacts written by the evaluation harness "
        "during the failed run. Two kinds are distinguished. Where the patch applied and "
        "tests executed, the captured test output is used, labelled as the real result of "
        "running the previous patch. Where the patch could not be applied, the patch "
        "application error recorded in the instance log is used instead, labelled as an "
        "indication that the previous patch could not be applied at all. The distinction "
        "matters because the two convey different information: the former describes "
        "incorrect behaviour, the latter describes a malformed edit."
    )
    w.body(
        "The evidence is truncated before insertion. Test logs produced by these projects "
        "are large, the largest encountered in this study approaching 1.7 megabytes, and "
        "cannot be supplied whole. Where the evidence exceeds 3,000 characters, only the "
        "final 3,000 are retained, preceded by a marker indicating that earlier output was "
        "removed. Retaining the tail is defensible for Python test output, since the "
        "exception type, the failing assertion, and the summary line appear at the end. It "
        "is nonetheless a substantial reduction: for the largest log encountered it retains "
        "approximately 0.2 per cent of the output, and in a run where several tests fail the "
        "earlier failures are discarded. This bound is a property of the condition as "
        "implemented, and Section 5.8 takes it into account when interpreting why "
        "execution-grounded diagnosis did not outperform the simpler strategies."
    )

    w.subsection("4.13.1", "Comparability of the Three Conditions")
    w.body(
        "The three prompts are strictly nested. The Blind Retry prompt is a subset of the "
        "Reflection-only prompt, which is in turn a subset of the Diagnose+Revise prompt. "
        "The shared portion, comprising the role statement, the issue description, the "
        "complete target file, and the output-format instructions, is identical in wording "
        "across all three conditions. The conditions differ only by the addition of the "
        "previous attempt, and then of the execution evidence."
    )
    w.body(
        "This nesting is what licenses the comparison. Because each condition adds "
        "information to the one before it without altering anything already present, any "
        "difference in outcome is attributable to the added information rather than to "
        "incidental differences in phrasing, ordering, or task framing. Figure 4.4 presents "
        "the three conditions side by side and identifies exactly what enters the prompt in "
        "each, and Table 4.3 states the same relationship in tabular form. The independent "
        "variable of this study is the content of that figure."
    )
    w.figure_placeholder("Figure 4.4", "Information Available to Each Recovery Strategy",
                         "fig4_4_information.png")
    w.blank()
    w.caption_bold("Table 4.3: Recovery Strategy Definitions")
    w.table([
        ["Information supplied", "Blind Retry", "Reflection-only", "Diagnose+Revise"],
        ["Issue description", "Yes", "Yes", "Yes"],
        ["Complete target file", "Yes", "Yes", "Yes"],
        ["Output-format instructions", "Yes", "Yes", "Yes"],
        ["Told that a previous attempt failed", "No", "Yes", "Yes"],
        ["Text of the previous attempt", "No", "Yes", "Yes"],
        ["Required to critique its own reasoning", "No", "Yes", "Yes"],
        ["Observed test output from the failed run", "No", "No", "Yes"],
        ["Required to diagnose a root cause", "No", "No", "Yes"],
        ["Approximate input cost relative to Blind Retry", "1x", "2x", "3x"],
    ])
    w.blank()
    w.body(
        "The final row of Table 4.3 records the cost of each condition, expressed as a "
        "multiple of the input volume required by Blind Retry. Because the complete target "
        "file is retransmitted on every request and the added material is small by "
        "comparison for most tasks, the ratio is dominated by the number of large blocks "
        "each prompt carries. This quantity is reported alongside every effectiveness "
        "measure in Section 5.7, for the reason given in Section 4.18.4: a strategy that "
        "returns an identical outcome at three times the cost is a result in its own right, "
        "and the recovery literature has tended to report effectiveness without it."
    )

    # ------------------------------------------------------------- 4.15
    w.section("4.14", "Metrics and Outcome Classification")
    w.body(
        "The benchmark reports a single binary flag per instance, recording whether the "
        "instance was resolved. That flag is retained as the primary measure, because it is "
        "the measure used in the published literature and comparability requires it. It is "
        "insufficient on its own, for two reasons established during this study."
    )
    w.subsection("4.14.1", "Sub-Test Scoring")
    w.body(
        "The binary flag cannot represent partial progress. An instance requiring sixteen "
        "tests to pass is recorded identically whether none of them passes or fifteen do. "
        "In this study that limitation is not hypothetical: the largest single change "
        "observed in the entire dataset occurs on an instance that the binary flag records "
        "as unresolved both before and after the change. Reporting only the flag would have "
        "concealed it entirely."
    )
    w.body(
        "This study therefore records, for every evaluated cell, the number of FAIL_TO_PASS "
        "tests that passed out of the number required, and the number of PASS_TO_PASS tests "
        "that regressed. These counts are read from the per-test status fields of the "
        "harness report rather than from its summary flag. The practice follows recent work "
        "arguing that aggregate resolution rates conceal the greater part of what an "
        "evaluation observes, and reporting it constitutes part of this study's "
        "methodological contribution under Objective 8."
    )
    w.subsection("4.14.2", "Unevaluated Cells")
    w.body(
        "A classification scheme confined to test outcomes cannot describe a cell for which "
        "no evaluation exists. As Sections 4.5 and 4.8 establish, two mechanisms produced "
        "such cells: the daily request ceiling, which made some combinations impossible to "
        "attempt on the day they were scheduled, and the rejection of an unmatched or "
        "ambiguous edit, after which no patch was written and the harness was never invoked. "
        "In both cases the cell is absent from the data rather than present with a negative "
        "outcome. The taxonomy below therefore includes an explicit category for such cells, "
        "and Chapter 5 marks them as unevaluated in every table. Treating an absent cell as "
        "a failure would attribute to a strategy an outcome it was never given the "
        "opportunity to produce."
    )
    w.subsection("4.14.3", "The Outcome Taxonomy")
    w.body(
        "Every cell in this study resolves to exactly one of five categories. The categories "
        "are decided by the contents of the harness report rather than by judgement, so the "
        "classification is reproducible from the published logs. Table 4.4 defines them and "
        "Figure 4.5 presents the decision procedure as a state machine."
    )
    w.blank()
    w.caption_bold("Table 4.4: Outcome Categories")
    w.table([
        ["Category", "Definition", "Decision rule"],
        ["Resolved",
         "All required tests pass and no previously passing test regresses.",
         "Resolution flag is true."],
        ["Partial",
         "The patch applied and made at least one required test pass, but not all.",
         "Flag false and at least one FAIL_TO_PASS test passing."],
        ["No progress",
         "The patch applied cleanly but no required test changed state.",
         "Flag false, patch applied, no FAIL_TO_PASS test passing."],
        ["Regression",
         "The patch applied and caused previously passing tests to fail.",
         "At least one PASS_TO_PASS test failing."],
        ["Not applied",
         "No valid patch reached the harness.",
         "No report exists, or the patch was not applied."],
    ])
    w.blank()
    w.body(
        "Two conventions govern the use of this taxonomy. First, the regression category "
        "overlaps the partial and no-progress categories by construction, since a patch may "
        "both fail to make progress and break existing behaviour. Where this occurs the "
        "regression is reported alongside the primary category rather than replacing it, so "
        "that an outcome appears as no progress with a stated number of regressions. "
        "Second, the not-applied category is subdivided in Chapter 5 according to cause, "
        "distinguishing a malformed patch, a rejected edit, a generation refused by the "
        "provider, and a cell never attempted, because these have different methodological "
        "implications and only the first two say anything about the model's output."
    )
    w.figure_placeholder("Figure 4.5", "Outcome Classification State Machine",
                         "fig4_5_taxonomy.png")

    # ------------------------------------------------------------- 4.16
    w.section("4.15", "The Fairness Retrofit as an Experimental Control")
    w.body(
        "Section 4.8 described the change from a model-authored unified diff to programmatic "
        "application of search-and-replace blocks. This section records why that change is "
        "treated as an experimental control rather than a bug fix, and how results obtained "
        "before and after it are handled."
    )
    w.body(
        "Under the original representation, 4 of the 8 members of the failure pool had "
        "failed without any test being executed. A comparison of recovery strategies "
        "conducted over that pool would have been substantially a comparison of the "
        "strategies' facility with a positional text format. The independent variable under "
        "study is the post-failure information supplied to the model, and patch formatting "
        "is a nuisance variable that was varying freely and influencing the outcome. "
        "Removing it is therefore a control, and the term fairness retrofit is used because "
        "its purpose is to ensure that the three conditions are compared on the quality of "
        "their reasoning rather than on their ability to count lines."
    )
    w.body(
        "The retrofit was applied uniformly to all three conditions. No condition received "
        "it earlier than another, and no condition was evaluated under a mixture of the two "
        "representations within a single reported comparison. Results obtained under the "
        "original representation are reported separately in Chapter 5 and are never pooled "
        "with results obtained after the retrofit. Figure 4.6 contrasts the two pipelines."
    )
    w.body(
        "The retrofit also has a consequence that was not anticipated when it was "
        "introduced. Because it altered how an edit is expressed while leaving the model, "
        "the prompt content, and the task unchanged, it constitutes an unplanned but clean "
        "manipulation of a single variable. The comparison between pre-retrofit and "
        "post-retrofit outcomes therefore answers a question of its own, distinct from the "
        "question the three conditions were designed to answer. Section 5.3 reports that "
        "comparison, and Section 5.9 argues that its result is the most substantial finding "
        "of the study."
    )
    w.figure_placeholder("Figure 4.6", "Patch Representation Before and After the Retrofit",
                         "fig4_6_retrofit.png")

    # ------------------------------------------------------------- 4.17
    w.section("4.16", "Second Recovery Round")
    w.body(
        "A single recovery attempt cannot distinguish a strategy that is ineffective from "
        "one whose effect happened not to materialise on a particular draw. Research "
        "Question 5 accordingly requires that each condition be applied more than once, and "
        "a second recovery round was conducted for this purpose."
    )
    w.body(
        "In the second round each condition was applied again to the failure pool, with its "
        "inputs advanced by one step. Blind Retry was issued the original prompt once more, "
        "unchanged, since by definition it carries no history. Reflection-only was supplied "
        "with the response it had produced in the first round in place of the baseline "
        "response, and the prompt was amended to state that the two preceding attempts had "
        "both failed. Diagnose+Revise was supplied with evidence freshly extracted from the "
        "evaluation of its own first-round patch, and the prompt was amended to state that "
        "the previous attempt had been based on a diagnosis and had nonetheless not resolved "
        "the issue. Each condition therefore revised its own work rather than the baseline, "
        "which is the sequential behaviour the recovery literature describes."
    )
    w.body(
        "The same truncation rule was applied to the second-round evidence as to the first, "
        "retaining the final 3,000 characters of the test output."
    )
    w.body(
        "Coverage of the second round was incomplete, for the reasons given in Section 4.5. "
        "Of the four logic-class instances, each condition was evaluated on three in the "
        "second round, but not on the same three: the instance omitted differs between "
        "conditions according to which combinations the request ceiling permitted on the day "
        "each was run. Section 5.6 reports the coverage cell by cell. This is a genuine "
        "limitation of the robustness check and is stated as such: the study can report that "
        "outcomes were identical wherever a cell was evaluated in both rounds, and it cannot "
        "report that they were identical across the whole pool."
    )

    # ------------------------------------------------------------- 4.18
    w.section("4.17", "Reproducibility and Experimental Controls")
    w.body(
        "This section records what was held constant, what was allowed to vary, and what "
        "could not be controlled."
    )
    w.subsection("4.17.1", "Quantities Held Constant")
    w.body(
        "The model, the access configuration, the benchmark, the task sample, the method of "
        "retrieving repository context, the method of identifying the target file, the patch "
        "representation within a reported comparison, the evaluation harness, the container "
        "configuration, and the shared portion of the prompt were identical across all three "
        "conditions. The ordering of tasks within a run was fixed. The number of model "
        "invocations per cell was one in every condition, so no condition benefited from "
        "additional attempts."
    )
    w.subsection("4.17.2", "The Quantity Deliberately Varied")
    w.body(
        "Only the post-failure information supplied to the model was varied, in the nested "
        "manner set out in Section 4.13.1 and Table 4.3."
    )
    w.subsection("4.17.3", "Quantities Not Controlled")
    w.body(
        "Sampling was not controlled. As recorded in Section 4.5.1, temperature, nucleus "
        "sampling, top-k, and random seed were left unspecified and the software development "
        "kit defaults were applied. Each generation is consequently a single draw from an "
        "unpinned distribution, and re-executing the pipeline may not reproduce an "
        "individual patch. The claim this study makes is that the procedure is reproducible "
        "and auditable, every script, prompt, prediction file, and evaluation log being "
        "published, and not that individual generations are deterministic. This is a genuine "
        "limitation and is repeated in Section 5.12."
    )
    w.body(
        "The number of observations per cell was also not controlled in the sense ordinarily "
        "required for statistical inference. Each cell represents a single generation, so no "
        "variance estimate is available for any individual cell and no significance test is "
        "reported anywhere in this dissertation. Where Chapter 5 states that outcomes did not "
        "differ between conditions, the statement is descriptive of the observed cells and is "
        "not a claim of statistical equivalence. Obtaining multiple observations per cell "
        "would require a request allowance the study did not have, and is identified as the "
        "first priority for extension in Section 6.6."
    )
    w.body(
        "Against these limitations, one observation acquires additional weight. On the "
        "instance requiring sixteen tests to pass, an identical sub-test score was returned "
        "in six separate cells spanning three conditions and two rounds. Those six figures "
        "were produced by six independent generations under unpinned sampling, not by one "
        "generation replayed six times. Agreement obtained in that manner constrains the "
        "behaviour of the system more tightly than a seeded replication would, and Section "
        "5.7 develops the point."
    )

    # ------------------------------------------------------------- 4.19
    w.section("4.18", "Ethical and Practical Considerations")
    w.subsection("4.18.1", "Provenance and Licensing of Materials")
    w.body(
        "All software used in this study is publicly available and used in accordance with "
        "its licence. The benchmark instances derive from public repositories whose licences "
        "permit research use. No proprietary source code, no private repository, and no "
        "personal data of any kind was accessed. Generated patches were applied only inside "
        "disposable containers and were never contributed to any upstream project."
    )
    w.subsection("4.18.2", "Resource Constraints and Their Disclosure")
    w.body(
        "The study was conducted without funding, using a free access tier permitting 20 "
        "generation requests per day. Section 4.5.2 sets out the arithmetic: a single "
        "complete recovery round over the failure pool requires 24 requests, so full "
        "coverage within one day was not attainable. The consequence is visible in the "
        "results, where a proportion of the combinations of instance, strategy, and round "
        "were never evaluated."
    )
    w.body(
        "This is disclosed as a methodological fact rather than confined to a limitations "
        "section, and the coverage achieved is reported cell by cell in Chapter 5, because "
        "the alternative practices are both worse. Presenting the evaluated cells without "
        "stating the denominator would imply a completeness the study does not have, and "
        "recording the unevaluated cells as failures would credit the strategies with "
        "outcomes they were never given the chance to produce. A study conducted at zero "
        "cost is legitimately bounded by what zero cost permits, provided the bound is "
        "stated."
    )
    w.subsection("4.18.3", "Provider Refusal and Benchmark Contamination")
    w.body(
        "One instance in the failure pool, astropy__astropy-14182, could not be evaluated "
        "under any recovery condition. Generation was terminated by the provider with the "
        "finish reason RECITATION, the response given when output is judged to reproduce "
        "memorised training data too closely. The refusal recurred on every attempt and "
        "under every condition, and the instance is therefore excluded from all three "
        "conditions rather than from any one of them. No strategy is advantaged or "
        "disadvantaged by the exclusion. Its effect on the study is to reduce the pool of "
        "instances on which a recovery attempt could be evaluated from 8 to 7."
    )
    w.body(
        "The refusal is reported here, rather than recorded silently as an exclusion, "
        "because it carries methodological information that bears directly on the validity "
        "of the benchmark. SWE-bench is constructed from public repositories whose relevant "
        "commits predate the training cut-off of contemporary models, and the possibility "
        "that reference solutions are present in model training data is the principal "
        "external threat to the validity of results obtained on it. That possibility is "
        "ordinarily a matter for conjecture. In this instance the provider's own filter "
        "declined to emit the output on the ground that it too closely reproduced memorised "
        "material, which constitutes a direct indication, from the provider rather than from "
        "the experimenter, that benchmark content is present in the training corpus."
    )
    w.body(
        "Two consequences follow. The first is that the baseline resolution rate reported in "
        "Chapter 5 should be read as an upper bound: where a reference solution is partly "
        "recalled rather than derived, the measurement overstates repair capability. The "
        "second is that the finding is of interest independently of the recovery comparison, "
        "and Section 5.10 develops it. Systematic screening of benchmark instances for "
        "contamination is identified as future work in Section 6.6."
    )
    w.subsection("4.18.4", "Reporting Standards Adopted")
    w.body(
        "Three reporting commitments follow from the foregoing and are observed throughout "
        "Chapter 5. Unevaluated cells are marked as unevaluated and never as failures. "
        "Coverage is stated wherever a claim of consistency is made. Effectiveness is "
        "reported together with cost, since a strategy returning an identical outcome at "
        "three times the input volume is a finding that an effectiveness measure alone does "
        "not express."
    )

    # ------------------------------------------------------------- 4.20
    w.section("4.19", "Chapter Summary")
    w.body(
        "This chapter has specified the experimental methodology of the study. The "
        "experiment evaluates single-shot, oracle-localized, single-file patch generation "
        "against the first 20 instances of SWE-bench Lite, using one model throughout and "
        "verifying every candidate modification by executing the project test suite inside "
        "an isolated container. The baseline stage resolved 12 instances and produced a "
        "failure pool of 8, comprising 4 instances whose patch applied but failed the "
        "required tests and 4 whose patch could not be applied at all."
    )
    w.body(
        "Three recovery strategies were applied to that pool across two rounds. The "
        "strategies form a strictly nested sequence in which each supplies everything "
        "available to the preceding one and adds a single further element: Blind Retry "
        "supplies nothing about the failure, Reflection-only adds the model's own previous "
        "attempt together with a requirement to critique it, and Diagnose+Revise adds the "
        "observed output of the failed test run. Because the conditions are nested and every "
        "other quantity is held constant, any difference in outcome is attributable to the "
        "added information."
    )
    w.body(
        "Three methodological decisions shape how the results are to be read. The patch "
        "representation was changed partway through the study, from a model-authored unified "
        "diff to programmatic application of search-and-replace blocks, in order to prevent "
        "patch formatting from confounding the comparison; results obtained under the two "
        "representations are reported separately. Outcomes are classified into five "
        "categories and supplemented by sub-test counts, because the benchmark's binary flag "
        "conceals partial progress. Cells that were never evaluated, whether because the "
        "daily request ceiling was reached or because an edit was rejected before any patch "
        "was produced, are marked as unevaluated rather than counted as failures."
    )
    w.body(
        "The limitations of the design are stated where they arise rather than deferred. The "
        "task sample is a contiguous prefix of the benchmark drawn from two repositories and "
        "is not random. Sampling parameters were not fixed, so individual generations are "
        "not reproducible although the procedure is. Each cell represents a single "
        "observation, so no significance test is reported. Coverage of the comparison is "
        "incomplete and is reported cell by cell. One instance was excluded because the "
        "provider refused to generate for it, an event that is itself reported as evidence "
        "bearing on benchmark contamination."
    )
    w.body(
        "Chapter 5 presents the results obtained under this methodology, beginning with the "
        "baseline and the classification of its failures, proceeding to the effect of the "
        "patch-representation retrofit, and then to the comparison of the three recovery "
        "strategies across both rounds."
    )


def main():
    in_place = "--in-place" in sys.argv
    w = ChapterWriter(SRC)
    write(w)
    if in_place:
        b = w.save_in_place()
        print(f"Updated Self.docx (backup at {os.path.basename(b)})")
    else:
        out = os.path.join(ROOT, "Self_ch4b.docx")
        w.save_as(out)
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()
