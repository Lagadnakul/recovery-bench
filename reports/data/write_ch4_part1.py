"""
Session 2 — writes Chapter 4, sections 4.1 to 4.9, into Self.docx.

Every factual claim traces to data/config.md, data/master_table.md or
data/outcome_taxonomy.md. Formatting follows the conventions measured from
Chapters 1-3 (see data/docx_writer.py).

Run from the project root:
    python3 reports/data/write_ch4_part1.py            # writes Self_ch4.docx
    python3 reports/data/write_ch4_part1.py --in-place  # updates Self.docx, backs up first
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
    # =====================================================================
    w.chapter(4, "Research Methodology")

    # ------------------------------------------------------------- 4.1
    w.section("4.1", "Experimental Overview")
    w.body(
        "This chapter describes the experimental methodology used to compare three "
        "failure-recovery strategies for large language model (LLM)-based repository-level "
        "code repair. The chapter specifies the benchmark, the task sample, the model and "
        "access configuration, the manner in which repository context was prepared, the "
        "representation used to express code modifications, and the infrastructure used to "
        "verify each generated modification against the original project test suite. "
        "Sections 4.1 to 4.9 establish the experimental setup common to all conditions; "
        "Sections 4.10 to 4.19 define the individual recovery strategies, the outcome "
        "classification scheme, and the controls applied to the comparison."
    )
    w.body(
        "The experiment follows a two-stage design. In the first stage, a single code "
        "modification is generated for each task in the sample and evaluated against the "
        "project test suite. Tasks that are not resolved at this stage form the failure "
        "pool. In the second stage, each task in the failure pool is submitted to three "
        "distinct recovery strategies, which differ only in the information made available "
        "to the model after the initial failure. The strategies are Blind Retry, in which "
        "the task is attempted again with no additional information; Reflection-only, in "
        "which the model receives its own previous attempt together with a request to "
        "critique it; and Diagnose+Revise, in which the model additionally receives "
        "execution evidence extracted from the failed test run. Because the three "
        "conditions differ in exactly one respect, namely the post-failure information "
        "supplied, any difference in outcome is attributable to that information."
    )
    w.body(
        "A precise statement of the system under evaluation is necessary in order to avoid "
        "overstating its capabilities. The system implemented in this study performs a "
        "single, stateless model invocation per experimental cell. It does not navigate the "
        "repository, does not invoke external tools during generation, does not execute "
        "code as part of its reasoning process, and does not maintain state across "
        "invocations. The target file for each task is identified in advance from benchmark "
        "metadata rather than discovered by the system. The system is therefore accurately "
        "described as single-shot, oracle-localized, single-file patch generation, and the "
        "term agentic is used in this dissertation only in reference to prior systems such "
        "as SWE-agent, AutoCodeRover, RepairAgent, and OpenHands, which do incorporate "
        "tool use and iterative execution [3]-[6]. This restriction is deliberate. The "
        "objective of the study is to isolate the effect of post-failure information on "
        "revision quality, and a simpler system permits that effect to be observed without "
        "confounding from repository navigation or tool-use behaviour."
    )
    w.body(
        "Figure 4.1 presents the complete experimental pipeline. Each task enters the "
        "pipeline as a natural-language issue description together with repository "
        "metadata. The target source file is retrieved at the recorded base commit and "
        "supplied to the model in full. The model returns a set of textual edit "
        "instructions, which are applied programmatically to produce a modified file, from "
        "which a unified diff is then computed mechanically. The resulting patch is "
        "evaluated inside an isolated container against the project test suite, and the "
        "outcome is assigned to one of five categories defined in Section 4.14. Tasks that "
        "do not resolve re-enter the pipeline under each of the three recovery strategies."
    )
    w.figure_placeholder("Figure 4.1", "Experimental Pipeline Overview",
                         "fig4_1_pipeline.png")

    # ------------------------------------------------------------- 4.2
    w.section("4.2", "Research Questions and Evaluation Design")
    w.body(
        "The empirical component of this dissertation addresses the research questions "
        "stated in Section 2.3. Three of those questions are answered by the experiment "
        "described in this chapter, and the design of the experiment follows directly from "
        "their requirements."
    )
    w.body(
        "Research Question 3 asks whether the availability of reflection or "
        "execution-grounded diagnostic information improves recovery from failed coding "
        "attempts. Answering this question requires a comparison in which the post-failure "
        "information is the only quantity that varies. The experiment therefore holds the "
        "model, the sampling configuration, the task sample, the repository context, the "
        "patch representation, and the evaluation harness constant across all three "
        "conditions, and varies only the content of the prompt supplied after a failure. "
        "Section 4.17 documents the controls applied and their limitations."
    )
    w.body(
        "Research Question 4 asks to what extent observed recovery failures can be "
        "attributed to reasoning limitations rather than to patch-formatting or "
        "patch-application mechanisms. Answering this question requires that the two "
        "categories of failure be distinguishable in the recorded data. The experiment "
        "therefore classifies every baseline failure by whether the generated patch was "
        "successfully applied before any test was executed. A patch that cannot be applied "
        "produces no information about the reasoning that produced it, and pooling such "
        "cases with genuine test failures would confound a mechanical defect with a "
        "cognitive one. Section 4.14 defines the classification scheme, and Section 4.15 "
        "describes the corrective measure applied once the extent of the formatting problem "
        "became apparent."
    )
    w.body(
        "Research Question 5 asks whether the observed recovery behaviour is consistent "
        "across repeated evaluation rounds. Answering this question requires that each "
        "condition be applied more than once to the same failure pool. The experiment "
        "therefore incorporates a second recovery round, described in Section 4.16, in which "
        "each strategy is granted a further opportunity to revise its solution using the "
        "evidence produced by its own preceding attempt."
    )
    w.body(
        "Research Questions 1 and 2 are addressed by the systematic review presented in "
        "Chapter 3 and by the strategy definitions in Sections 4.10 to 4.13 respectively, "
        "and do not require additional experimental apparatus."
    )
    w.body(
        "The dependent variable throughout is the outcome of executing the project test "
        "suite against the modified repository. The benchmark reports this outcome as a "
        "binary resolution flag. As Section 4.14 explains, the present study additionally "
        "records the underlying sub-test counts, because a binary flag cannot represent "
        "partial progress and, in this experiment, conceals the largest single change "
        "observed in the data."
    )

    # ------------------------------------------------------------- 4.3
    w.section("4.3", "Dataset and Benchmark")
    w.body(
        "The experiment uses SWE-bench Lite, a curated subset of the SWE-bench benchmark "
        "for repository-level software engineering [1]. SWE-bench is constructed from "
        "resolved issues and their corresponding pull requests in widely used open-source "
        "Python projects. Each benchmark instance provides a natural-language issue "
        "description, the repository identifier, the base commit at which the issue was "
        "present, the reference modification authored by the project maintainers, and two "
        "sets of tests. SWE-bench Lite comprises 300 instances drawn from 11 repositories "
        "and was released in order to reduce the computational cost of evaluation relative "
        "to the full benchmark of 2,294 instances."
    )
    w.body(
        "The two test sets are central to the evaluation. The FAIL_TO_PASS set contains "
        "tests that fail at the base commit and pass once the reference modification is "
        "applied; these tests define the required behaviour and a candidate modification "
        "must make all of them pass. The PASS_TO_PASS set contains tests that pass both "
        "before and after the reference modification; these tests guard against regression "
        "and a candidate modification must not cause any of them to fail. A benchmark "
        "instance is recorded as resolved only when every FAIL_TO_PASS test passes and no "
        "PASS_TO_PASS test regresses. This conjunction is important for the present study "
        "because it means a single regression is sufficient to record a failure irrespective "
        "of how much required behaviour was correctly implemented."
    )
    w.body(
        "SWE-bench Lite was selected for three reasons. First, its instances are drawn from "
        "genuine project histories rather than synthesised, so the tasks exhibit the "
        "dependency structure, implementation constraints, and test coverage of production "
        "software. Second, evaluation is fully automated and deterministic given a patch, "
        "which removes subjective judgement from the dependent variable. Third, the "
        "benchmark is widely used in the agentic coding literature reviewed in Chapter 3, "
        "which permits the baseline resolution rate reported in Chapter 5 to be interpreted "
        "against published results."
    )
    w.body(
        "The benchmark is distributed through the HuggingFace datasets library. Generation "
        "scripts load the dataset under the identifier princeton-nlp/SWE-bench_Lite, and the "
        "evaluation harness is invoked with the equivalent identifier "
        "SWE-bench/SWE-bench_Lite. These are two aliases for the same distribution, and the "
        "test split is used throughout."
    )
    w.body(
        "One property of the benchmark constrains the interpretation of all results reported "
        "in this dissertation. The repositories from which SWE-bench is constructed are "
        "public, and the commits from which the instances are derived predate the training "
        "cut-off of any contemporary language model. Reference solutions may therefore be "
        "present in the training data of the model under evaluation. This study observed a "
        "direct provider-side indication that this is so, and the matter is reported in "
        "Section 4.18 and carried into the validity analysis in Section 5.12."
    )

    # ------------------------------------------------------------- 4.4
    w.section("4.4", "Task Selection")
    w.body(
        "The experiment uses the first 20 instances of the SWE-bench Lite test split, "
        "selected by their position in the distributed ordering. The sample is therefore a "
        "contiguous prefix of the benchmark rather than a random draw. Table 4.1 lists the "
        "selected instances together with the outcome each received at the baseline stage."
    )
    w.body(
        "The sample size was determined by the access constraints documented in Section 4.5. "
        "A pilot of 20 instances was adopted because it was expected to yield a failure pool "
        "large enough to support a three-way comparison while remaining within the daily "
        "request ceiling available to the study. That expectation was met: 8 of the 20 "
        "instances did not resolve at the baseline stage, and those 8 constitute the failure "
        "pool used throughout Sections 4.10 to 4.16."
    )
    w.body(
        "Three properties of this sample restrict the generality of the findings and are "
        "recorded here rather than deferred, because they bear on how the results in "
        "Chapter 5 should be read."
    )
    w.subsection("4.4.1", "The Sample Is Not Random")
    w.body(
        "Because the sample is a contiguous prefix of an ordered distribution rather than a "
        "random draw, it cannot be treated as representative of SWE-bench Lite. No claim in "
        "this dissertation is generalised to the full benchmark on the basis of this sample. "
        "A stratified random sample would be required for such a claim, and is identified as "
        "future work in Section 6.6."
    )
    w.subsection("4.4.2", "Repository Coverage Is Narrow")
    w.body(
        "The 20 selected instances are drawn from 2 of the 11 repositories represented in "
        "SWE-bench Lite. Of these, 14 instances originate from the Django web framework and "
        "6 from the astropy astronomy library. The ordering of the distributed dataset groups "
        "instances by repository, so a contiguous prefix necessarily concentrates on the "
        "first repositories in that ordering. Results are consequently conditioned on the "
        "code style, test conventions, and module structure of two projects, and the "
        "predominance of Django means the sample is weighted towards a single codebase."
    )
    w.subsection("4.4.3", "Task Solvability Was Not Independently Audited")
    w.body(
        "The human screening exercise conducted during the construction of SWE-bench "
        "Verified found that a substantial proportion of SWE-bench instances are problematic "
        "as stated: issue descriptions that underspecify the required behaviour, and tests "
        "that impose requirements not derivable from the issue text. Instances of this kind "
        "cannot be solved reliably from the information supplied, irrespective of model "
        "capability. The present study did not conduct an independent solvability audit of "
        "the four logic-class failures in its pool, and the possibility that one or more of "
        "them is underspecified or unfairly tested is therefore retained as a threat to "
        "validity in Section 5.12. This matters specifically for the interpretation of a "
        "null result: a strategy cannot be shown ineffective on a task that no strategy "
        "could solve."
    )
    w.blank()
    w.caption_bold("Table 4.1: Task Selection — 20 Pilot Instances")
    w.table([
        ["#", "Instance identifier", "Repository", "Baseline outcome"],
        ["1", "astropy__astropy-6938", "astropy", "Resolved"],
        ["2", "astropy__astropy-7746", "astropy", "Unresolved (logic)"],
        ["3", "astropy__astropy-12907", "astropy", "Resolved"],
        ["4", "astropy__astropy-14182", "astropy", "Not applied (malformed)"],
        ["5", "astropy__astropy-14365", "astropy", "Resolved"],
        ["6", "astropy__astropy-14995", "astropy", "Resolved"],
        ["7", "django__django-10914", "django", "Resolved"],
        ["8", "django__django-10924", "django", "Resolved"],
        ["9", "django__django-11001", "django", "Resolved"],
        ["10", "django__django-11019", "django", "Unresolved (logic)"],
        ["11", "django__django-11039", "django", "Not applied (malformed)"],
        ["12", "django__django-11049", "django", "Resolved"],
        ["13", "django__django-11099", "django", "Resolved"],
        ["14", "django__django-11133", "django", "Resolved"],
        ["15", "django__django-11179", "django", "Resolved"],
        ["16", "django__django-11283", "django", "Unresolved (logic)"],
        ["17", "django__django-11422", "django", "Resolved"],
        ["18", "django__django-11564", "django", "Unresolved (logic)"],
        ["19", "django__django-11583", "django", "Not applied (malformed)"],
        ["20", "django__django-11620", "django", "Not applied (malformed)"],
    ])
    w.blank()
    w.body(
        "The baseline outcomes summarised in Table 4.1 are 12 resolved instances, 4 "
        "instances in which the patch applied but the required tests did not pass, and 4 "
        "instances in which the generated patch could not be applied at all. The "
        "significance of the distinction between the latter two groups is developed in "
        "Sections 4.8 and 4.14 and is the subject of Research Question 4."
    )

    # ------------------------------------------------------------- 4.5
    w.section("4.5", "Model and Access Configuration")
    w.body(
        "All code modifications evaluated in this study were generated by a single model, "
        "gemini-3.6-flash, accessed through the Google generative AI Python SDK. A single "
        "model was used throughout so that differences between conditions could not be "
        "attributed to model substitution. Table 4.2 records the complete configuration."
    )
    w.blank()
    w.caption_bold("Table 4.2: Model and Access Configuration")
    w.table([
        ["Parameter", "Value"],
        ["Model identifier", "gemini-3.6-flash"],
        ["Software development kit", "google-genai (Python)"],
        ["Access tier", "Google AI Studio, free tier"],
        ["Sampling temperature", "Not specified; SDK default applied"],
        ["Nucleus sampling (top-p) and top-k", "Not specified; SDK default applied"],
        ["Random seed", "Not specified"],
        ["Maximum output tokens", "Not specified"],
        ["Model invocations per experimental cell", "1"],
        ["Inter-request delay", "60 seconds"],
        ["Daily request ceiling", "20 requests"],
        ["Benchmark", "SWE-bench Lite, test split, first 20 instances"],
        ["Evaluation harness", "swebench.harness.run_evaluation"],
        ["Harness parallelism", "2 workers"],
        ["Container runtime", "Docker Desktop with WSL 2 integration"],
        ["Host platform", "Windows with Windows Subsystem for Linux 2"],
    ])
    w.blank()
    w.subsection("4.5.1", "Sampling Configuration")
    w.body(
        "No sampling parameters were specified in any generation script. Temperature, "
        "nucleus sampling, top-k, and random seed were left unset, and the corresponding "
        "software development kit defaults were applied implicitly. Each generation is "
        "therefore a single draw from a sampling distribution that was not pinned by the "
        "experimenter. Two consequences follow and are stated plainly."
    )
    w.body(
        "First, exact reproduction of an individual experimental cell cannot be guaranteed. "
        "The pipeline is fully scripted and every script, prompt, prediction file, and "
        "evaluation log is published, so the procedure is auditable and re-executable; but "
        "re-execution may not return the identical patch. The claim that can be supported is "
        "that the pipeline is reproducible as a procedure, not that individual generations "
        "are deterministic. Section 4.17 returns to this point."
    )
    w.body(
        "Second, and in the opposite direction, any stability observed across independent "
        "generations is stronger evidence than it would be under a fixed seed. Where "
        "Chapter 5 reports that a task returned an identical sub-test score across six "
        "separate model invocations spanning three strategies and two rounds, that agreement "
        "was obtained from six unpinned draws rather than from a single seeded draw repeated "
        "six times. Such a result constrains the behaviour of the system more tightly than a "
        "deterministic replication would."
    )
    w.subsection("4.5.2", "Access Constraints")
    w.body(
        "The study was conducted without funding, using free-tier access. The applicable "
        "quota for this model permits 20 generation requests per day, and requests beyond "
        "that ceiling are refused with an explicit resource-exhaustion response. A 60-second "
        "delay was inserted before each request in order to remain within the per-minute "
        "rate limit."
    )
    w.body(
        "This constraint shaped the experiment and is therefore reported as part of the "
        "methodology rather than confined to a limitations section. A single complete "
        "recovery round over the failure pool of 8 instances under 3 strategies requires 24 "
        "generation requests. The daily ceiling is 20. It was consequently not possible to "
        "evaluate every combination of instance, strategy, and round within a single day, and "
        "the evaluation was distributed across multiple days with some combinations left "
        "unevaluated. The resulting coverage is reported in full in Chapter 5, where every "
        "unevaluated combination is marked as unevaluated rather than treated as a negative "
        "result. Section 4.18 discusses the practical implications of conducting the study "
        "under this constraint, and Section 6.6 identifies the migration to a higher-throughput "
        "provider as the first priority for any extension of this work."
    )

    # ------------------------------------------------------------- 4.6
    w.section("4.6", "Repository Context and Task Preparation")
    w.body(
        "Each benchmark instance identifies a repository and a base commit at which the "
        "reported issue is present. For every task the target source file was retrieved "
        "directly from the hosting service at that exact commit, ensuring that the model "
        "received the file in precisely the state in which the issue existed rather than in "
        "its current or subsequently modified state. Retrieval at the recorded commit is "
        "essential: a later revision of the file might already contain the fix, or might "
        "have been restructured such that the issue description no longer applies."
    )
    w.body(
        "The retrieved file was supplied to the model in full. No summarisation, truncation, "
        "chunking, embedding-based retrieval, or relevance filtering was applied to the "
        "source context. The complete file was interpolated verbatim into the prompt, "
        "accompanied by the issue description and the instructions governing the required "
        "output format. Figure 4.2 illustrates this preparation sequence."
    )
    w.body(
        "Supplying the entire file removes an important source of variability. Had a "
        "retrieval or summarisation component been interposed, a failure could have "
        "originated in that component rather than in the model's reasoning, and the "
        "comparison between recovery strategies would have been confounded by differences "
        "in what each strategy happened to retrieve. Providing the whole file guarantees "
        "that all three conditions operate on identical source context, so that the only "
        "quantity differing between them is the post-failure information under study."
    )
    w.body(
        "This choice has a substantial and quantifiable cost. The target files in the sample "
        "are production source files of considerable size. The largest encountered, the "
        "world coordinate system module of astropy required by instance "
        "astropy__astropy-7746, contains 124,394 characters, corresponding to approximately "
        "31,100 tokens. That volume is transmitted in its entirety on every request "
        "concerning that instance. No prompt caching or context reuse was employed, so a "
        "single task evaluated under three strategies retransmits the same file three times, "
        "and each additional recovery round retransmits it again. Because the free-tier "
        "quota described in Section 4.5 is expressed in requests rather than tokens, this "
        "cost did not reduce the number of tasks that could be attempted; it does, however, "
        "establish the cost baseline against which the relative expense of the three "
        "strategies is assessed in Section 5.7, and it would become the dominant constraint "
        "under any token-metered access arrangement."
    )
    w.figure_placeholder("Figure 4.2", "Repository Context Preparation",
                         "fig4_2_context.png")

    # ------------------------------------------------------------- 4.7
    w.section("4.7", "Oracle-Based File Localization")
    w.body(
        "Repository-level code repair is conventionally decomposed into two sub-problems: "
        "identifying which file or files require modification, and determining the "
        "modification itself. The present study addresses only the second. The file to be "
        "modified is supplied to the system rather than discovered by it, a procedure "
        "commonly termed oracle localization."
    )
    w.body(
        "The target path was obtained from benchmark metadata. Each instance includes the "
        "reference modification authored by the project maintainers, expressed as a unified "
        "diff. The file paths in that diff were extracted by matching the source-file header "
        "lines, and paths containing the substring test were discarded so that test files "
        "introduced by the reference modification were not mistaken for implementation "
        "targets. Where more than one implementation file remained, the first was selected. "
        "Only the path was taken from the reference modification; its content was never "
        "supplied to the model, and no part of the reference solution entered any prompt."
    )
    w.body(
        "Two implications require explicit statement."
    )
    w.subsection("4.7.1", "The Evaluated System Is Not Performing Localization")
    w.body(
        "Because the target file is supplied, the resolution rates reported in Chapter 5 are "
        "not comparable with those of systems that perform their own localization, such as "
        "SWE-agent, AutoCodeRover, or OpenHands [3]-[6]. Those systems solve a strictly "
        "harder problem. The figures in this dissertation should be read as measurements of "
        "repair quality conditional on correct localization, and Chapter 5 does not compare "
        "them against published end-to-end resolution rates."
    )
    w.subsection("4.7.2", "Oracle Localization Strengthens a Null Result")
    w.body(
        "The principal empirical finding of this study, presented in Chapter 5, is that "
        "additional post-failure information did not improve recovery on tasks whose failure "
        "was genuinely one of program reasoning. Oracle localization makes that finding "
        "harder to dismiss rather than easier. Under a system performing its own "
        "localization, an unimproved outcome could be attributed to the model having "
        "examined the wrong file, and the result would be uninformative about reflection or "
        "diagnosis. In the present design the model was given the correct file on every "
        "attempt, and the complete contents of that file, and in the Diagnose+Revise "
        "condition the output of the failing tests as well. The information required to "
        "identify the defect was demonstrably present. That the additional information "
        "produced no improvement therefore constitutes evidence about the use the model made "
        "of it, and not about whether it was available."
    )
    w.body(
        "One structural limitation follows from the selection rule. Where a reference "
        "modification spans several implementation files, only the first was supplied, so "
        "the model could not express a change requiring coordinated edits across files. No "
        "instance in the failure pool was found to require such a change, but the constraint "
        "is recorded because it bounds the class of task the system is in principle capable "
        "of resolving, and it is revisited in Section 5.12."
    )

    # ------------------------------------------------------------- 4.8
    w.section("4.8", "Patch Representation and Application")
    w.body(
        "A generated modification must be converted into a patch that the evaluation harness "
        "can apply. This apparently mechanical step proved to be methodologically decisive, "
        "and the manner in which it was implemented changed during the study. Both "
        "implementations are described here, because results obtained under them are not "
        "comparable and are reported separately throughout Chapter 5."
    )
    w.subsection("4.8.1", "Initial Approach: Model-Authored Unified Diff")
    w.body(
        "In the initial implementation the model was asked to emit a unified diff directly. "
        "This is the format the evaluation harness consumes, so the output could be "
        "forwarded without intermediate processing."
    )
    w.body(
        "The approach proved unreliable. A unified diff is a positional format: each hunk "
        "header declares the line at which the change begins and the number of lines of "
        "context on either side, and the patch is rejected if these do not correspond "
        "exactly to the target file. Producing a correct hunk header requires accurate line "
        "counting over a file of many thousands of lines, which is a clerical operation "
        "poorly matched to a generative model. Of the 20 baseline instances, 4 produced "
        "patches that could not be applied at all, the harness reporting in one case that "
        "only unusable content was present in the patch input. In each of these cases no "
        "test was ever executed, and consequently no information whatsoever was obtained "
        "about whether the intended modification was correct."
    )
    w.body(
        "This is a confound rather than a mere inconvenience. A benchmark that records such "
        "an instance as a failure attributes to the model's reasoning a defect that lies "
        "entirely in the transcription of the edit. Four of the eight members of the failure "
        "pool, one half, entered it for this reason. Any comparison of recovery strategies "
        "conducted over that pool without separating the two categories would have measured "
        "the strategies' capacity to produce well-formed diffs rather than their capacity to "
        "repair software."
    )
    w.subsection("4.8.2", "Revised Approach: Search-and-Replace Blocks")
    w.body(
        "The representation was therefore changed. In the revised implementation the model "
        "is asked to express each edit as a pair of literal text blocks: the exact existing "
        "text to be located, and the text that is to replace it. The model is not required "
        "to count lines, compute offsets, or construct hunk headers. The edit is instead "
        "applied programmatically by locating the search text within the retrieved file and "
        "substituting the replacement, and the unified diff required by the harness is then "
        "computed mechanically from the original and modified file contents using the "
        "standard library difflib module. The diff is thus generated by a deterministic "
        "procedure that cannot produce a malformed hunk header, and the model's "
        "responsibility is reduced to identifying the correct text to change."
    )
    w.body(
        "The applicator enforces an exact-match requirement with three rejection conditions, "
        "shown as terminal states in Figure 4.3. If the search text occurs exactly once, the "
        "substitution is performed. If it does not occur, the edit is rejected as not found. "
        "If it occurs more than once, the edit is rejected as ambiguous, because the "
        "intended location cannot be determined. If the response contains no parsable "
        "blocks, it is rejected as unparsable. In each rejection case no patch is produced."
    )
    w.body(
        "The behaviour following a rejection must be recorded precisely, because it affects "
        "how the results tables in Chapter 5 are to be read. A rejected response was "
        "reported to the console and then discarded: no entry was written to the predictions "
        "file for that task, the evaluation harness was never invoked for it, and no "
        "evaluation record was produced. The corresponding experimental cell is therefore "
        "absent from the data rather than present with a negative outcome. Together with the "
        "request ceiling described in Section 4.5, this is one of two mechanisms by which "
        "combinations of task, strategy, and round came to be unevaluated. Chapter 5 marks "
        "every such combination as unevaluated and never treats an absent cell as evidence "
        "that a strategy failed."
    )
    w.body(
        "The change of representation is referred to in this dissertation as the fairness "
        "retrofit, because its purpose is to ensure that the three strategies are compared "
        "on their reasoning rather than on their facility with a positional text format. "
        "Section 4.15 documents the retrofit as an experimental control, and Section 5.3 "
        "reports the effect it had on the measured outcomes, which was substantial."
    )
    w.figure_placeholder("Figure 4.3", "Patch Representation and Application",
                         "fig4_3_patch.png")

    # ------------------------------------------------------------- 4.9
    w.section("4.9", "Evaluation Infrastructure")
    w.body(
        "Every candidate modification was verified by execution. No outcome reported in this "
        "dissertation rests on inspection of a patch, on model self-assessment, or on "
        "similarity to the reference solution; each rests on the observed result of running "
        "the project's own test suite against the modified repository."
    )
    w.body(
        "Verification used the official SWE-bench evaluation harness, invoked as the "
        "run_evaluation module of the swebench package. For each task the harness "
        "constructs an isolated container image containing the repository at the recorded "
        "base commit together with the dependency set required by that project and commit, "
        "applies the candidate patch, executes the designated FAIL_TO_PASS and PASS_TO_PASS "
        "tests, and writes a structured report recording whether the patch applied, the "
        "status of each individual test, and the resulting resolution flag. The harness was "
        "run with two parallel workers, a setting chosen to remain within the memory "
        "available on the host."
    )
    w.body(
        "Containerisation is essential to the validity of the comparison. The repositories "
        "in the benchmark are evaluated at commits several years old and require dependency "
        "versions that conflict both with one another and with any contemporary development "
        "environment. Executing each task in an image constructed for its own commit ensures "
        "that a test failure reflects the candidate patch and not an incompatibility in the "
        "surrounding environment, and that every condition is evaluated under identical "
        "circumstances."
    )
    w.body(
        "The harness was executed on a Windows host through the Windows Subsystem for Linux, "
        "with container support provided by Docker Desktop configured for integration with "
        "that subsystem. Two infrastructure problems were encountered and resolved during "
        "the study, and are recorded here because they are likely to recur for anyone "
        "reproducing this work. The first concerns line endings: patches authored on the "
        "Windows host carried carriage-return line terminators, which the patch utility "
        "inside the Linux container rejected. The second concerns container reachability, "
        "the container daemon becoming unreachable from the subsystem until integration was "
        "enabled in the runtime's resource settings and the runtime restarted. Neither "
        "problem affected any recorded result, since both manifested as an inability to "
        "complete an evaluation rather than as an incorrect outcome, but both consumed time "
        "that the request ceiling had already made scarce."
    )
    w.body(
        "The structured report produced for each evaluation is the primary record of this "
        "study. All results presented in Chapter 5 are derived from these reports by script, "
        "and the derivation can be re-executed against the published logs at any time. In "
        "particular, the sub-test counts used in Sections 5.4 and 5.7 are read from the "
        "per-test status fields of these reports rather than from the summary resolution "
        "flag, for the reasons given in Section 4.14."
    )


def main():
    in_place = "--in-place" in sys.argv
    w = ChapterWriter(SRC)
    write(w)
    if in_place:
        backup = w.save_in_place()
        print(f"Updated Self.docx (backup at {os.path.basename(backup)})")
    else:
        out = os.path.join(ROOT, "Self_ch4.docx")
        w.save_as(out)
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()
