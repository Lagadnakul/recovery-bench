"""
Session 5 — writes Chapter 5, sections 5.7 to 5.13, into Self.docx.

These sections interpret the observations reported in Sections 5.1 to 5.6. Table
numbering continues from Table 5.4 (the coverage table written in Session 4), so
the sub-test table is Table 5.5 and the threats summary is Table 5.6.

Run from the project root:
    python3 reports/data/write_ch5_part2.py             # writes Self_ch5b.docx
    python3 reports/data/write_ch5_part2.py --in-place  # updates Self.docx, backs up first
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
    # ------------------------------------------------------------- 5.7
    w.section("5.7", "Cross-Strategy Comparison")
    w.body(
        "This section compares the three recovery strategies on the logic-class instances, "
        "which are the instances from which any inference about software reasoning can be "
        "drawn. The format-class instances are treated separately in Section 5.9, because "
        "what they demonstrate is of a different kind."
    )
    w.subsection("5.7.1", "Outcome Comparison")
    w.body(
        "Across the four logic-class instances, in two rounds, no instance was resolved by "
        "any of the three strategies. The measured outcome is identical in every cell where "
        "two or more strategies were evaluated on the same instance in the same round. "
        "Table 5.5 sets out the sub-test scores, which permit a finer comparison than the "
        "resolution flag and reveal no separation between the strategies either."
    )
    w.blank()
    w.caption_bold("Table 5.5: Sub-Test Scores by Condition, Logic-Class Instances")
    w.table([
        ["Condition and round", "astropy-7746", "django-11019", "django-11283",
         "django-11564"],
        ["Baseline", "0 of 1", "0 of 16, 33 regressions", "0 of 1", "0 of 2"],
        ["Blind Retry, round one", NE, "6 of 16", NE, "0 of 2"],
        ["Blind Retry, round two", "0 of 1", "6 of 16", "0 of 1", NE],
        ["Reflection-only, round one", NE, "6 of 16", NE, NE],
        ["Reflection-only, round two", "0 of 1", "6 of 16", "0 of 1", NE],
        ["Diagnose+Revise, round one", "0 of 1", "6 of 16",
         "0 of 1, 8 regressions", "0 of 2"],
        ["Diagnose+Revise, round two", "0 of 1", "6 of 16", NE, "0 of 2"],
    ])
    w.blank()
    w.body(
        "The instance django__django-11019 is the most informative, being the only instance "
        "evaluated in all six recovery cells and the only one requiring a substantial number "
        "of tests to pass. It returned 6 of 16 in every one of those six cells. The identity "
        "holds across strategies that received quite different information: one that was told "
        "nothing about the failure, one that received its own previous attempt and a "
        "requirement to criticise it, and one that additionally received the observed output "
        "of the failing tests. Section 5.8 considers what this implies."
    )
    w.body(
        "Figure 5.3 presents the complete comparison matrix, with the cells that were not "
        "evaluated shown as such rather than omitted or inferred."
    )
    w.figure_placeholder("Figure 5.3", "Cross-Strategy Comparison Matrix",
                         "fig5_3_matrix.png")
    w.subsection("5.7.2", "The One Case Where the Strategies Differed")
    w.body(
        "In exactly one cell did a strategy produce an outcome that another did not, and the "
        "difference was unfavourable to the better-informed strategy. On "
        "django__django-11283 in the first round, Diagnose+Revise produced a patch that "
        "applied cleanly, failed the single required test, and additionally caused 8 "
        "previously passing tests to fail. Blind Retry, evaluated on the same instance in the "
        "second round, produced no regressions, as did Reflection-only."
    )
    w.body(
        "This observation is recorded rather than averaged away, because averaging it into an "
        "aggregate recovery rate would remove the only point of separation the data contains. "
        "Its interpretation must be cautious: it is a single cell, produced by a single "
        "unpinned generation, and it may be a sampling artefact. It is nonetheless consistent "
        "with a mechanism worth stating. The Diagnose+Revise prompt directs the model to a "
        "specific root cause grounded in the evidence supplied, and that evidence is the final "
        "portion of a test log. A directive to address the proximate cause of a specific "
        "observed failure invites a narrowly targeted edit, and a narrowly targeted edit in a "
        "framework as interdependent as Django can satisfy the immediate complaint while "
        "disturbing behaviour elsewhere. On this instance the additional information did not "
        "merely fail to help; it accompanied a more damaging modification."
    )
    w.subsection("5.7.3", "Cost of Each Strategy")
    w.body(
        "Effectiveness is reported here together with the cost at which it was obtained, in "
        "accordance with Section 4.18.4. The three strategies do not cost the same. Because "
        "the complete target file is retransmitted on every request, and because each "
        "condition adds further material to the prompt without removing anything, input "
        "volume rises across the sequence: Reflection-only carries approximately twice the "
        "input of Blind Retry, and Diagnose+Revise approximately three times. For the largest "
        "instance in the sample the target file alone accounts for some 31,100 tokens on every "
        "request, and no caching was employed. Each request additionally incurred the "
        "60-second delay described in Section 4.5.2."
    )
    w.body(
        "Taken together with the outcome comparison, the result is therefore not simply that "
        "the additional information failed to improve recovery. It is that a strategy costing "
        "three times as much in input volume, and requiring the additional infrastructure to "
        "capture, store, and truncate execution evidence, returned an outcome identical to "
        "that of re-issuing the original prompt unchanged. Expressed in the terms the "
        "recovery literature has begun to adopt, the verified recovery rate on logic-class "
        "failures was zero for all three strategies, while the recovery effort differed by a "
        "factor of three. Figure 5.4 presents cost against outcome."
    )
    w.figure_placeholder("Figure 5.4", "Recovery Cost by Strategy",
                         "fig5_4_cost.png")

    # ------------------------------------------------------------- 5.8
    w.section("5.8", "Interpretation of the Null Result")
    w.body(
        "No recovery strategy resolved any logic-class failure, and the better-informed "
        "strategies did not outperform the uninformed one. Three explanations are compatible "
        "with this observation, and they are not equally well supported."
    )
    w.subsection("5.8.1", "Explanation One: The Information Was Not Available")
    w.body(
        "The first explanation is that the model lacked what it needed. This explanation is "
        "the weakest, and the design of the experiment is what weakens it. The target file was "
        "supplied in full rather than discovered, so the model cannot have examined the wrong "
        "file. The issue description was supplied verbatim. In the Reflection-only condition "
        "the model's own previous reasoning was returned to it in the form in which it had "
        "been expressed. In the Diagnose+Revise condition the observed output of the failing "
        "tests was supplied and explicitly labelled as ground truth. The information required "
        "to identify the defect was, by construction, present in the prompt. As argued in "
        "Section 4.7.2, oracle localization makes this explanation harder to sustain rather "
        "than easier."
    )
    w.body(
        "One qualification applies. The execution evidence was truncated to its final 3,000 "
        "characters, which for the largest log retained approximately 0.2 per cent of the "
        "output. The tail of a Python test log carries the exception and the failing "
        "assertion, so the most diagnostic portion is likely to have been retained; but in a "
        "run where several tests fail, earlier failures were discarded. The Diagnose+Revise "
        "condition was therefore tested with a deliberately narrow evidence window, and this "
        "study cannot exclude the possibility that a wider window would have produced a "
        "different outcome. This is recorded as a limitation of the condition as implemented "
        "and as a specific target for future work in Section 6.6."
    )
    w.subsection("5.8.2", "Explanation Two: The Tasks Were Not Solvable")
    w.body(
        "The second explanation is that the four logic-class instances could not have been "
        "resolved by any strategy, in which case no strategy could demonstrate an advantage "
        "and the comparison is uninformative rather than negative."
    )
    w.body(
        "This explanation cannot be excluded. The human screening exercise undertaken during "
        "the construction of SWE-bench Verified established that a substantial proportion of "
        "SWE-bench instances are problematic as stated, the two principal causes being issue "
        "descriptions that underspecify the required behaviour and tests that impose "
        "requirements not derivable from the issue text. No independent solvability audit of "
        "the four instances in this study's pool was conducted, for the reason given in "
        "Section 4.4.3. One instance, django__django-11283, is known from its test output to "
        "fail because the test invokes the modified function with an argument the issue "
        "description does not mention, which is characteristic of the second category. It is "
        "therefore possible that part of the null result reflects the benchmark rather than "
        "the strategies. This is the most serious limitation of the empirical component of "
        "this dissertation and is recorded as such in Section 5.12."
    )
    w.subsection("5.8.3", "Explanation Three: The Information Was Available and Not Used")
    w.body(
        "The third explanation is that the additional information was present and did not "
        "alter what the model produced. The pattern on django__django-11019 bears on this "
        "directly and is the strongest positive evidence the study offers."
    )
    w.body(
        "That instance returned 6 of 16 in six separate cells. Those six figures were "
        "produced by six independent generations, spanning three strategies and two rounds, "
        "under sampling that was not pinned by a fixed temperature or seed, as recorded in "
        "Section 4.17.3. Six unpinned draws converging on precisely the same partial solution "
        "is not the signature of a system responding to its inputs and being deflected by "
        "noise. It is the signature of a system arriving at the same place irrespective of "
        "what it is told about having been there before. The model appears to reach a stable "
        "partial understanding of the issue, one sufficient to satisfy 6 of the 16 "
        "requirements, and neither self-criticism nor the observed test output moved it from "
        "that position."
    )
    w.body(
        "The absence of a fixed seed, which Section 4.17.3 records as a limitation for "
        "reproducibility, therefore strengthens this particular inference. Had the "
        "generations been seeded, identical outputs would have been unremarkable and would "
        "have demonstrated nothing about the influence of the prompt. Obtained from unpinned "
        "draws, the agreement constrains the system's behaviour more tightly than a "
        "deterministic replication could."
    )
    w.subsection("5.8.4", "Assessment")
    w.body(
        "The first explanation is largely excluded by the design, subject to the qualification "
        "about the evidence window. The second cannot be excluded and requires a solvability "
        "audit that this study did not perform. The third is positively supported on the one "
        "instance where the data are rich enough to test it. The defensible conclusion is "
        "therefore narrower than a general claim about self-reflection: on the logic-class "
        "failures evaluated here, supplying a coding system with its own failed attempt, or "
        "with the observed output of the tests it failed, did not change what it produced, and "
        "on the instance affording the closest examination the system returned the identical "
        "partial solution under every condition. Whether this generalises beyond four "
        "instances, two repositories, and one model is not established by this study, and "
        "Section 5.12 states so."
    )

    # ------------------------------------------------------------- 5.9
    w.section("5.9", "Patch Reliability and Reasoning Correctness")
    w.body(
        "The comparison between the two failure classes yields the clearest result of this "
        "study, and it concerns Research Question 4."
    )
    w.body(
        "Of the four format-class failures, three could be evaluated after the change of "
        "patch representation and all three were resolved. Of the four logic-class failures, "
        "none was resolved by any strategy in either round. Stated as rates, recovery on "
        "evaluable format-class failures was 3 of 3, and recovery on logic-class failures was "
        "0 of 4. The two classes differ in the mechanism by which they entered the failure "
        "pool, and they responded to entirely different interventions."
    )
    w.body(
        "The intervention that resolved the format-class failures altered nothing about the "
        "model's reasoning. It did not supply additional information, did not request "
        "reflection, and did not provide execution evidence. It changed the notation in which "
        "the edit was expressed, moving the clerical work of computing line offsets from the "
        "model to a deterministic procedure. The evidence on django__django-11019 reported in "
        "Section 5.4 makes the same point within a single instance: the same change of "
        "notation moved that instance from 0 of 16 required tests with 33 regressions to 6 of "
        "16 with none, while the model, the prompt content, and the task remained unchanged."
    )
    w.body(
        "The finding may therefore be stated as follows. Across this experiment, changing how "
        "the edit was expressed altered outcomes substantially. Changing what the model was "
        "told about its own failure did not alter them at all. Both interventions were applied "
        "to the same instances, by the same pipeline, under the same evaluation."
    )
    w.subsection("5.9.1", "Consequence for the Evaluation of Coding Agents")
    w.body(
        "This has a direct implication for how recovery mechanisms are evaluated, and it is "
        "the principal methodological contribution of this dissertation. An aggregate "
        "resolution rate cannot distinguish the two mechanisms. Had this study reported a "
        "single recovery figure over the undivided pool of 8 instances, the result would have "
        "been 3 recoveries of 7 evaluable instances, approximately 43 per cent, and that "
        "figure would have appeared to demonstrate that the recovery strategies worked. It "
        "would have been arithmetically correct and substantively misleading, because every "
        "one of the three recoveries was obtained on an instance whose original failure was a "
        "malformed patch, and none on an instance whose original failure was a defect of "
        "reasoning."
    )
    w.body(
        "It follows that a study reporting an improved resolution rate after the introduction "
        "of a reflection or diagnosis mechanism cannot be assumed to have demonstrated "
        "improved reasoning, unless it also reports how many of its prior failures were patch "
        "application failures. Where a system's patch-application reliability and its "
        "reasoning correctness are not reported separately, a gain in the former is "
        "indistinguishable from a gain in the latter. Section 5.10 states this as a general "
        "reporting recommendation, and Section 3.10.4 identified the absence of this "
        "separation in the existing literature as one of the gaps motivating the study."
    )

    # ------------------------------------------------------------- 5.10
    w.section("5.10", "Methodological Findings")
    w.body(
        "Five findings of this study concern how recovery in coding systems should be measured "
        "rather than how it behaves. They constitute the response to Objective 8."
    )
    w.subsection("5.10.1", "Patch Application Must Be Reported Separately")
    w.body(
        "For the reasons set out in Section 5.9, the proportion of attempts whose patch "
        "applied should be reported alongside, and separately from, the proportion that "
        "resolved the task. In this study half the failure pool consisted of patches that "
        "never applied, and no conclusion about reasoning could be drawn from them until the "
        "representation was repaired."
    )
    w.subsection("5.10.2", "Binary Resolution Rates Conceal the Largest Effects")
    w.body(
        "The most substantial change observed in this study, the movement on "
        "django__django-11019 from 0 of 16 required tests with 33 regressions to 6 of 16 with "
        "none, is invisible to the benchmark's resolution flag, which records the instance as "
        "unresolved in both states. Reporting sub-test counts is inexpensive, the data being "
        "present in the harness output already, and in this case it was the difference between "
        "observing the study's principal effect and missing it entirely."
    )
    w.subsection("5.10.3", "A Resampling Control Is Necessary")
    w.body(
        "Any claim that a reflection or diagnosis mechanism improves recovery requires "
        "comparison against simply attempting the task again. In this study the uninformed "
        "control matched both better-informed strategies on every evaluated logic-class cell. "
        "Without that control, the partial progress observed after the retrofit could have "
        "been attributed to reflection, since it coincided with it in time."
    )
    w.subsection("5.10.4", "Effectiveness Must Be Reported With Cost")
    w.body(
        "Diagnose+Revise consumed approximately three times the input volume of Blind Retry "
        "and required additional infrastructure to collect and truncate execution evidence, "
        "for an identical outcome. An effectiveness measure reported alone would not express "
        "this. The pairing of a recovery rate with the effort expended in obtaining it, as "
        "Section 5.7.3 reports, is necessary for the comparison to be meaningful to anyone "
        "deciding whether to deploy such a mechanism."
    )
    w.subsection("5.10.5", "Unevaluated Cells Must Not Be Recorded as Failures")
    w.body(
        "Of the 24 cells defined by the logic-class comparison, 8 were never evaluated. Had "
        "these been recorded as failures, the strategies would have been charged with "
        "outcomes they were never given the opportunity to produce, and the apparent coverage "
        "of the study would have been overstated. Reporting coverage explicitly, as Table 5.4 "
        "does, is the minimum requirement for a comparison conducted under resource "
        "constraints."
    )
    w.subsection("5.10.6", "Provider Refusals Are a Contamination Signal")
    w.body(
        "The exclusion of astropy__astropy-14182 recorded in Section 4.18.3 arose because the "
        "provider declined to generate output on the ground that it reproduced memorised "
        "training data too closely. Benchmark contamination is ordinarily inferred "
        "indirectly, by comparing performance across instances of differing vintage or by "
        "probing for memorisation. Here it was signalled by the provider's own filter, "
        "independently of the experimenter. Such refusals are recorded in generation logs and "
        "are straightforward to detect; treating them as contamination evidence rather than as "
        "an inconvenience to be excluded silently costs nothing and yields information that "
        "bears on the validity of every result obtained on the benchmark."
    )

    # ------------------------------------------------------------- 5.11
    w.section("5.11", "Comparison With the Existing Literature")
    w.body(
        "The findings of this study stand in a definite relation to the literature reviewed "
        "in Chapter 3, agreeing with one part of it and qualifying another."
    )
    w.subsection("5.11.1", "Agreement With Analyses of Intrinsic Self-Correction")
    w.body(
        "The result obtained under the Reflection-only condition agrees with the conclusion of "
        "Huang et al., who report that large language models do not reliably correct their own "
        "reasoning when the only additional input is a request to reconsider, and that "
        "apparent gains from self-correction frequently disappear once a comparable "
        "resampling control is introduced. The present study reaches the same conclusion in a "
        "setting their work did not examine: repository-level program repair, on production "
        "source files, verified by the projects' own test suites. The agreement is therefore a "
        "replication in a new domain rather than a restatement, and it strengthens both "
        "results. The related analysis by Kamoi et al. of the conditions under which "
        "self-correction succeeds is consistent with this: they identify the availability of "
        "reliable external feedback as the decisive factor, and the Reflection-only condition "
        "supplies none."
    )
    w.body(
        "The Diagnose+Revise condition does supply external feedback, in the form of the "
        "observed test output, and on that account might have been expected to succeed where "
        "Reflection-only did not. It did not. Two candidate reasons are available and this "
        "study cannot separate them: the feedback was truncated to a narrow window, as "
        "Section 5.8.1 records; or the defects in question were not ones the model could "
        "repair given any amount of feedback, as Section 5.8.2 allows. This is the most "
        "significant point at which the present findings depart from what the literature would "
        "predict, and resolving it is the most valuable extension of the work."
    )
    w.subsection("5.11.2", "Qualification of Reported Gains From Iterative Refinement")
    w.body(
        "The Reflexion and Self-Refine frameworks reviewed in Sections 3.3.1 and 3.3.2 report "
        "substantial benefits from iterative self-revision. The present results do not "
        "contradict those reports, but they bound them. Those frameworks were evaluated "
        "predominantly on tasks where the correctness signal is cheap, immediate, and complete, "
        "such as unit-test-level code generation or constrained reasoning problems. "
        "Repository-level repair differs in each respect: the signal is expensive to obtain, "
        "requires container construction and full test execution, and arrives as a large log "
        "that must be truncated before it can be used. The present study suggests that the "
        "benefit of iterative refinement does not transfer automatically to this setting, and "
        "that the properties of the feedback channel, rather than the presence of a "
        "reflection step, may be what determines whether it does."
    )
    w.subsection("5.11.3", "Consistency With Partial-Credit Critiques of Resolve Rate")
    w.body(
        "Recent work criticising aggregate resolution rates argues that a binary measure "
        "discards the greater part of what an evaluation observes and that partial progress "
        "should be reported. The observation on django__django-11019, where the resolution "
        "flag is unchanged while the underlying sub-test counts move from 0 of 16 with 33 "
        "regressions to 6 of 16 with none, is a direct instance of that argument. The present "
        "study did not set out to test it and provides incidental but unambiguous support for "
        "it."
    )
    w.subsection("5.11.4", "Comparison With Independently Reported Recovery Evaluations")
    w.body(
        "Independent evaluation of recovery mechanisms on site-reliability and operations "
        "benchmarks provides a useful point of comparison. One such evaluation reports an "
        "improvement from 20 of 50 tasks to 24 of 50 upon the introduction of a structured "
        "recovery mechanism, and reports that improvement as not statistically significant at "
        "that sample size. The relation to the present study is twofold. The direction of the "
        "reported effect is favourable where this study observed none, which is a genuine "
        "difference to be accounted for by domain, mechanism, or scale. But the magnitude is "
        "of an order that a sample of four instances could not have detected, which places "
        "the present null result in proper perspective: it is evidence that the effect is not "
        "large on these instances, and not evidence that no effect exists."
    )

    # ------------------------------------------------------------- 5.12
    w.section("5.12", "Threats to Validity")
    w.body(
        "The limitations of this study are material and are stated in full. Table 5.6 "
        "summarises them; the subsections that follow set out the four most consequential."
    )
    w.blank()
    w.caption_bold("Table 5.6: Threats to Validity")
    w.table([
        ["Threat", "Type", "Effect on the conclusions", "Status"],
        ["Task solvability not audited", "Conclusion",
         "Null result may reflect the benchmark rather than the strategies",
         "Not mitigated; audit required"],
        ["Four logic-class instances only", "External",
         "No claim of generality; effects smaller than large are undetectable",
         "Stated; larger pool required"],
        ["Sample is a contiguous prefix, two repositories", "External",
         "Not representative of SWE-bench Lite",
         "Disclosed in Section 4.4"],
        ["Coverage of 16 cells of 24", "Internal",
         "Consistency claim limited to evaluated cells",
         "Reported cell by cell, Table 5.4"],
        ["Sampling parameters not fixed", "Internal",
         "Individual generations not reproducible",
         "Disclosed; strengthens Section 5.8.3"],
        ["One observation per cell", "Conclusion",
         "No variance estimate; no significance test reported",
         "Stated in Section 4.17.3"],
        ["Single model and provider", "External",
         "Findings conditional on one model family",
         "Stated; replication required"],
        ["Benchmark contamination", "External",
         "Baseline resolution rate is an upper bound",
         "Evidenced in Section 4.18.3"],
        ["Evidence truncated to 3,000 characters", "Construct",
         "Diagnose+Revise tested with a narrow feedback window",
         "Disclosed in Section 4.13"],
        ["Oracle file localization", "Construct",
         "Rates not comparable with end-to-end systems",
         "Disclosed in Section 4.7"],
        ["Patch representation changed mid-study", "Internal",
         "Pre- and post-retrofit results not comparable",
         "Reported separately throughout"],
    ])
    w.blank()
    w.subsection("5.12.1", "Task Solvability")
    w.body(
        "The most serious threat is that the logic-class instances may not have been solvable "
        "from the information supplied. A strategy cannot be shown ineffective on a task that "
        "no strategy could complete. As Section 5.8.2 records, the screening undertaken for "
        "SWE-bench Verified established that a substantial proportion of SWE-bench instances "
        "are underspecified or unfairly tested, and at least one instance in this study's pool "
        "exhibits the characteristic pattern of the latter. Until the four instances are "
        "audited against their issue descriptions and reference solutions, the null result "
        "cannot be attributed with confidence to the strategies rather than to the tasks. This "
        "audit is the first item of future work identified in Section 6.6."
    )
    w.subsection("5.12.2", "Scale and Statistical Power")
    w.body(
        "The logic-class comparison rests on four instances and one observation per cell. No "
        "variance estimate is available and no significance test is reported anywhere in this "
        "dissertation. The study can state that no effect was observed; it cannot state that "
        "no effect exists. As Section 5.11.4 notes, an effect of the magnitude reported "
        "elsewhere in the literature would not have been detectable at this scale. Claims in "
        "this chapter are accordingly confined to the observed cells."
    )
    w.subsection("5.12.3", "Generality")
    w.body(
        "The sample is a contiguous prefix of one benchmark, drawn from two repositories, with "
        "14 of the 20 instances originating from a single project. One model from one provider "
        "was used throughout. The findings are therefore conditional on that model, those "
        "repositories, and the particular prompt formulations reported in Sections 4.11 to "
        "4.13. Whether they hold for a different model family, for repositories with different "
        "test conventions, or under prompts differently phrased, is not established here."
    )
    w.subsection("5.12.4", "Benchmark Contamination")
    w.body(
        "As recorded in Sections 4.18.3 and 5.10.6, the provider declined to generate for one "
        "instance on the ground that the output reproduced memorised training data. This is "
        "direct evidence that benchmark content is present in the model's training corpus. "
        "Its consequence for this chapter is that the baseline resolution rate of 60 per cent "
        "should be read as an upper bound on repair capability, since an instance whose "
        "reference solution is partly recalled rather than derived inflates the measure. It "
        "does not affect the comparison between recovery strategies, all three of which "
        "operated on the same instances under the same conditions."
    )

    # ------------------------------------------------------------- 5.13
    w.section("5.13", "Chapter Summary")
    w.body(
        "This chapter has reported and interpreted the results of the experiment specified in "
        "Chapter 4. At baseline, 12 of 20 instances were resolved, a rate of 60 per cent, "
        "leaving a failure pool of 8. That pool divided evenly into 4 instances whose patch "
        "applied but whose required tests did not pass, and 4 whose patch could not be applied "
        "at all."
    )
    w.body(
        "On the logic-class instances, no strategy resolved any instance in either round. "
        "Where cells were evaluated the outcomes were identical between strategies, including "
        "at the level of sub-test counts: django__django-11019 returned 6 of 16 required tests "
        "in all six of its recovery cells. In the single cell where the strategies diverged, "
        "the divergence was unfavourable to the best-informed strategy, Diagnose+Revise having "
        "caused 8 regressions where the other two caused none. Diagnose+Revise consumed "
        "approximately three times the input volume of Blind Retry for these identical "
        "outcomes."
    )
    w.body(
        "On the format-class instances, all 3 that could be evaluated were resolved, following "
        "a change in the notation used to express an edit that left the model, the prompt "
        "content, and the task unaltered. The same change moved django__django-11019 from 0 of "
        "16 required tests with 33 regressions to 6 of 16 with none. Across this experiment, "
        "changing how an edit was expressed altered outcomes substantially, and changing what "
        "the model was told about its own failure did not alter them at all."
    )
    w.body(
        "The principal methodological consequence is that patch-application reliability and "
        "reasoning correctness must be measured and reported separately. Had this study "
        "reported a single undivided recovery rate, it would have recorded 3 recoveries of 7 "
        "evaluable instances and appeared to demonstrate that the recovery strategies were "
        "effective, when every recovery was obtained on an instance whose original failure was "
        "mechanical."
    )
    w.body(
        "These conclusions are bounded. Four logic-class instances, one observation per cell, "
        "coverage of 16 cells of 24, a non-random sample from two repositories, a single "
        "model, unpinned sampling, a truncated feedback window, and an unaudited assumption of "
        "task solvability all limit what may be inferred. The study reports that no effect was "
        "observed on these instances under these conditions; it does not report that no effect "
        "exists. Chapter 6 states the conclusions against each research question and sets out "
        "the work that would be required to establish more."
    )


def main():
    in_place = "--in-place" in sys.argv
    w = ChapterWriter(SRC)
    write(w)
    if in_place:
        b = w.save_in_place()
        print(f"Updated Self.docx (backup at {os.path.basename(b)})")
    else:
        out = os.path.join(ROOT, "Self_ch5b.docx")
        w.save_as(out)
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()
