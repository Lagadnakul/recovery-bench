"""
Session 6 — writes Chapter 6 and the reference list into Self.docx.

Chapter 6 follows the section scheme Nakul already used in
MTech_Dissertation_Report.pdf (Summary of Work / Key Conclusions / Contributions /
Scope for Future Work), extended with an explicit answer to each canonical research
question (Section 6.2) and a consolidated limitations section (Section 6.5). Future
Work is Section 6.6, which is the target of the forward references in Chapter 5.

Claims carried over from the PDF are corrected where the logs contradict them; see
the CORRECTIONS note below.

The 35 references are transcribed from pages 28-30 of the same PDF, with hyphens
restored where PDF text extraction had dropped them. Two further entries are added
for the works cited by name in Section 5.11.

Run from the project root:
    python3 reports/data/write_ch6_refs.py             # writes Self_ch6.docx
    python3 reports/data/write_ch6_refs.py --in-place  # updates Self.docx, backs up first
"""

# CORRECTIONS applied to the Chapter 6 text carried over from the PDF:
#
# 1. "all three conditions recovered zero of four such failures in both rounds"
#    -> coverage was 16 of 24 cells, not complete. Qualified accordingly.
# 2. "a purely formatting-related baseline failure was resolved uniformly"
#    -> 3 of 3 evaluable format-class failures were resolved, one of them under
#       all three conditions. Stated precisely.
# 3. "a complete, reproducible empirical pipeline"
#    -> sampling parameters were never fixed. Reworded to "fully scripted and
#       auditable", with the limitation stated in Section 6.5.

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from docx_writer import ChapterWriter  # noqa: E402

# Layout note: these scripts live in reports/data/, so the project root is
# two levels up. REPORTS anchors figures/, which moved alongside them.
REPORTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(REPORTS)
SRC = os.path.join(ROOT, "Self.docx")

REFERENCES = [
    "[1] J. He, C. Treude, and D. Lo, “LLM-based multi-agent systems for software "
    "engineering: Literature review, vision, and the road ahead,” ACM Transactions on "
    "Software Engineering and Methodology, vol. 34, no. 5, pp. 124:1–124:30, 2025.",

    "[2] H. Li, H. Zhang, and A. E. Hassan, “The rise of AI teammates in software "
    "engineering (SE 3.0): How autonomous coding agents are reshaping software "
    "engineering,” 2025.",

    "[3] Y. Zhang, H. Ruan, Z. Fan, and A. Roychoudhury, “AutoCodeRover: Autonomous "
    "program improvement,” in Proceedings of the 33rd ACM SIGSOFT International "
    "Symposium on Software Testing and Analysis (ISSTA). ACM, 2024, pp. 1592–1604.",

    "[4] J. Yang, C. E. Jimenez, A. Wettig, K. Lieret, S. Yao, K. R. Narasimhan, and "
    "O. Press, “SWE-agent: Agent-computer interfaces enable automated software "
    "engineering,” in Advances in Neural Information Processing Systems (NeurIPS), "
    "vol. 37, 2024.",

    "[5] I. Bouzenia, P. Devanbu, and M. Pradel, “RepairAgent: An autonomous, LLM-based "
    "agent for program repair,” in Proceedings of the 47th IEEE/ACM International "
    "Conference on Software Engineering (ICSE), 2025, pp. 2188–2200.",

    "[6] X. Wang et al., “OpenHands: An open platform for AI software developers as "
    "generalist agents,” in International Conference on Learning Representations "
    "(ICLR), 2025.",

    "[7] N. Shinn, F. Cassano, A. Gopinath, K. Narasimhan, and S. Yao, “Reflexion: "
    "Language agents with verbal reinforcement learning,” Advances in Neural "
    "Information Processing Systems (NeurIPS), vol. 36, 2023.",

    "[8] A. Madaan, N. Tandon, P. Gupta et al., “Self-refine: Iterative refinement with "
    "self-feedback,” Advances in Neural Information Processing Systems (NeurIPS), "
    "vol. 36, 2023.",

    "[9] M. Renze and E. Guven, “Self-reflection in LLM agents: Effects on "
    "problem-solving performance,” in First Workshop on Foundational Large Language "
    "Models (FLLM), 2024.",

    "[10] X. Chen, M. Lin, N. Scharli, and D. Zhou, “Teaching large language models to "
    "self-debug,” in International Conference on Learning Representations (ICLR), 2024.",

    "[11] A. Zhao, D. Huang, Q. Xu, M. Lin, Y.-J. Liu, and G. Huang, “ExpeL: LLM agents "
    "are experiential learners,” in Proceedings of the AAAI Conference on Artificial "
    "Intelligence, vol. 38, no. 17, 2024, pp. 19632–19640.",

    "[12] X. Bo et al., “Reflective multi-agent collaboration based on large language "
    "models,” in Advances in Neural Information Processing Systems (NeurIPS), vol. 37, "
    "2024.",

    "[13] L. Pan, M. Saxon, W. Xu, D. Nathani, X. Wang, and W. Y. Wang, “Automatically "
    "correcting large language models: Surveying the landscape of diverse automated "
    "correction strategies,” Transactions of the Association for Computational "
    "Linguistics, vol. 12, pp. 484–506, 2024.",

    "[14] Z. Wu et al., “OS-Copilot: Towards generalist computer agents with "
    "self-improvement,” arXiv preprint arXiv:2402.07456, 2024.",

    "[15] W. Xu, Z. Liang, K. Mei, H. Gao, J. Tan, and Y. Zhang, “A-MEM: Agentic memory "
    "for LLM agents,” in Advances in Neural Information Processing Systems (NeurIPS), "
    "vol. 38, 2025.",

    "[16] Y. Wang and X. Chen, “MIRIX: Multi-agent memory system for LLM-based "
    "agents,” arXiv preprint arXiv:2507.07957, 2025.",

    "[17] A. Maharana et al., “Evaluating very long-term conversational memory of LLM "
    "agents,” in Proceedings of the 62nd Annual Meeting of the Association for "
    "Computational Linguistics (ACL), 2024, pp. 13851–13870.",

    "[18] Q. Zhang, C. Fang, Y. Xie, Y. Ma, W. Sun, Y. Yang, and Z. Chen, “A systematic "
    "literature review on large language models for automated program repair,” ACM "
    "Transactions on Software Engineering and Methodology, 2026.",

    "[19] C. E. Jimenez et al., “SWE-bench: Can language models resolve real-world GitHub "
    "issues?” in International Conference on Learning Representations (ICLR), 2024.",

    "[20] X. Liu et al., “AgentBench: Evaluating LLMs as agents,” in International "
    "Conference on Learning Representations (ICLR), 2024.",

    "[21] K. Zhu et al., “Where LLM agents fail and how they can learn from failures,” "
    "arXiv preprint arXiv:2509.25370, 2025.",

    "[22] J. Ruan et al., “TPTU: Task planning and tool usage of large language "
    "model-based AI agents,” in Foundation Models for Decision Making Workshop at "
    "NeurIPS, 2023.",

    "[23] C. H. Song et al., “LLM-Planner: Few-shot grounded planning for embodied agents "
    "with large language models,” in Proceedings of the IEEE/CVF International "
    "Conference on Computer Vision (ICCV), 2023, pp. 2998–3007.",

    "[24] M. Li et al., “API-Bank: A comprehensive benchmark for tool-augmented LLMs,” "
    "in Proceedings of EMNLP, 2023, pp. 3102–3116.",

    "[25] Z. Shen, “LLM with tools: A survey,” arXiv preprint arXiv:2409.18807, 2024.",

    "[26] M. Zhuge et al., “Agent-as-a-judge: Evaluate agents with agents,” arXiv "
    "preprint arXiv:2410.10934, 2024.",

    "[27] C. Guo et al., “RedCode: Risky code execution and generation benchmark for code "
    "agents,” in NeurIPS Datasets and Benchmarks Track, 2024.",

    "[28] T. Masterman, S. Besen, M. Sawtell, and A. Chao, “The landscape of emerging AI "
    "agent architectures for reasoning, planning, and tool calling: A survey,” arXiv "
    "preprint arXiv:2404.11584, 2024.",

    "[29] A. Bandi, B. Kongari, R. Naguru, S. Pasnoor, and S. V. Vilipala, “The rise of "
    "agentic AI: A review of definitions, frameworks, architectures, applications, "
    "evaluation metrics, and challenges,” Future Internet, vol. 17, no. 9, p. 404, 2025.",

    "[30] M. A. Ali, F. Dornaika, and J. Charafeddine, “Agentic AI: A comprehensive survey "
    "of architectures, applications, and future directions,” Artificial Intelligence "
    "Review, vol. 59, p. 11, 2026.",

    "[31] L. Wang et al., “A survey on large language model based autonomous agents,” "
    "Frontiers of Computer Science, vol. 18, no. 6, p. 186345, 2024.",

    "[32] R. Sapkota, K. I. Roumeliotis, and M. Karkee, “Vibe coding vs. agentic coding: "
    "Fundamentals and practical implications of agentic AI,” arXiv preprint "
    "arXiv:2505.19443, 2025.",

    "[33] M. Robeyns, M. Szummer, and L. Aitchison, “A self-improving coding agent,” "
    "arXiv preprint arXiv:2504.15228, 2025.",

    "[34] L. Staufer et al., “The 2025 AI agent index: Documenting technical and safety "
    "features of deployed agentic AI systems,” in Proceedings of the 2026 ACM Conference "
    "on Fairness, Accountability, and Transparency (FAccT). ACM, 2026, pp. 1536–1576.",

    "[35] S. S. Kannan, V. L. N. Venkatesh, and B.-C. Min, “SMART-LLM: Smart multi-agent "
    "robot task planning using large language models,” arXiv preprint arXiv:2309.10062, "
    "2024.",

    "[36] J. Huang, X. Chen, S. Mishra, H. S. Zheng, A. W. Yu, X. Song, and D. Zhou, "
    "“Large language models cannot self-correct reasoning yet,” in International "
    "Conference on Learning Representations (ICLR), 2024.",

    "[37] R. Kamoi, Y. Zhang, N. Zhang, J. Han, and R. Zhang, “When can LLMs actually "
    "correct their own mistakes? A critical survey of self-correction of LLMs,” "
    "Transactions of the Association for Computational Linguistics, vol. 12, "
    "pp. 1417–1440, 2024.",
]


def write(w):
    # =====================================================================
    w.chapter(6, "Conclusions and Summary")

    # ------------------------------------------------------------- 6.1
    w.section("6.1", "Summary of Work Carried Out")
    w.body(
        "This dissertation began with a systematic review of 35 studies published between "
        "2023 and 2026 on self-reflection, memory, planning, and failure recovery in agentic "
        "AI coding systems [1]–[35]. The review identified a specific and validated gap: "
        "the absence of empirical evidence on whether execution-grounded, diagnosis-based "
        "recovery improves outcomes for repository-level coding systems by comparison with "
        "simpler retry or reflection-based strategies."
    )
    w.body(
        "Building on that gap, a fully scripted and auditable empirical pipeline was designed "
        "and implemented, encompassing benchmark and task selection, retrieval of real "
        "repository context at the recorded base commit, a patch mechanism based on "
        "search-and-replace blocks with programmatically generated unified diffs, and a "
        "containerised evaluation harness executed through the Windows Subsystem for Linux. A "
        "controlled three-condition comparison of Blind Retry, Reflection-only, and "
        "Diagnose+Revise was conducted on a 20-instance pilot sample from SWE-bench Lite "
        "[19], followed by an independent second recovery round to test robustness."
    )
    w.body(
        "The comparison was conducted after a change in the representation used to express "
        "code edits, adopted because the original representation had caused half of the "
        "failure pool to fail for reasons unconnected with software reasoning. That change is "
        "treated throughout as an experimental control, and it proved to have consequences of "
        "its own that are among the principal findings reported below."
    )

    # ------------------------------------------------------------- 6.2
    w.section("6.2", "Conclusions Against the Research Questions")
    w.body(
        "The five research questions stated in Section 2.3 are answered as follows."
    )
    w.subsection("6.2.1", "Research Question 1")
    w.body(
        "What failure-recovery mechanisms have been investigated in existing research on "
        "agentic AI coding systems? The systematic review presented in Chapter 3 identified "
        "and classified the mechanisms reported across 35 studies, spanning verbal "
        "self-reflection and iterative self-revision [7]–[10], experiential and structured "
        "memory [11], [14]–[17], planning and tool use [22]–[25], failure detection and "
        "failure analysis [21], and automated program repair [18]. The review established "
        "that these mechanisms are typically evaluated by aggregate task-success rate, and "
        "that controlled comparison against an unaided resampling baseline is generally "
        "absent."
    )
    w.subsection("6.2.2", "Research Question 2")
    w.body(
        "How do Blind Retry, Reflection-only, and Diagnose+Revise differ in their approach to "
        "recovering from failed repository-level coding attempts? The three strategies were "
        "implemented as a strictly nested sequence, documented in Sections 4.11 to 4.13 and "
        "Table 4.3. Each supplies everything available to its predecessor and adds exactly one "
        "further element: Blind Retry supplies nothing about the failure, Reflection-only adds "
        "the system's own previous attempt together with a requirement to criticise it, and "
        "Diagnose+Revise adds the observed output of the failed test run. Because the shared "
        "portion of the prompt is identical in wording across the three, the information "
        "supplied after a failure is the only quantity that differs."
    )
    w.subsection("6.2.3", "Research Question 3")
    w.body(
        "Does the availability of reflection or execution-grounded diagnostic information "
        "improve recovery from failed coding attempts? On the evidence of this study, no. "
        "Across the logic-class failures, no instance was resolved by any strategy in either "
        "round, and in every cell where two or more strategies were evaluated on the same "
        "instance the outcomes were identical, including at the level of individual test "
        "counts. The instance affording the closest examination returned 6 of its 16 required "
        "tests in all six of its recovery cells, spanning three strategies and two rounds. "
        "Diagnose+Revise obtained these identical outcomes at approximately three times the "
        "input volume of Blind Retry. This conclusion is bounded by the coverage achieved, 16 "
        "of 24 cells, and by the limitations recorded in Section 6.5."
    )
    w.subsection("6.2.4", "Research Question 4")
    w.body(
        "To what extent can observed recovery failures be attributed to reasoning limitations "
        "rather than to patch-formatting or patch-application mechanisms? The two are cleanly "
        "separable, and separating them changes the conclusion. Of the 8 baseline failures, 4 "
        "were format-class, the patch never having been applied, and 4 were logic-class, the "
        "patch having applied and the required tests having failed. After the change of patch "
        "representation, all 3 evaluable format-class failures were resolved and none of the 4 "
        "logic-class failures was. Reporting a single undivided recovery rate would have given "
        "3 recoveries of 7 evaluable instances and appeared to demonstrate that the recovery "
        "strategies were effective, when every recovery was obtained on an instance whose "
        "original failure was mechanical. This is the clearest result of the dissertation."
    )
    w.subsection("6.2.5", "Research Question 5")
    w.body(
        "Are the observed recovery behaviours consistent across repeated evaluation rounds? "
        "Wherever a cell was evaluated in both rounds, the outcome was identical, and where "
        "sub-test counts are available they too were identical. The qualification is that "
        "coverage was incomplete: 16 of the 24 cells defined by the comparison were evaluated "
        "and 8 were not, for the resource reasons documented in Section 4.5.2. The supportable "
        "claim is therefore consistency across all evaluated cells, stated together with that "
        "coverage figure, and not consistency across the failure pool as a whole."
    )

    # ------------------------------------------------------------- 6.3
    w.section("6.3", "Key Conclusions")
    w.body(
        "Five conclusions follow from the work."
    )
    w.bullets([
        "Across the logic-class failures evaluated in this study, no measurable difference "
        "was found between Blind Retry, Reflection-only, and Diagnose+Revise. All three "
        "resolved none of the four such failures, in both rounds, across the 16 of 24 cells "
        "that were evaluated.",

        "Patch-formatting reliability and code-reasoning correctness are separable failure "
        "modes. Every format-class baseline failure that could be evaluated was resolved once "
        "a programmatically verified patch mechanism was adopted, whereas the logic-class "
        "failures remained unresolved under every recovery strategy. Changing how an edit was "
        "expressed altered outcomes substantially; changing what the system was told about "
        "its own failure did not alter them at all.",

        "The binary resolution metric used by the benchmark conceals the largest effect "
        "observed in this study. The change of patch representation moved one instance from 0 "
        "of 16 required tests with 33 regressions to 6 of 16 with none, a movement to which "
        "the resolution flag is entirely insensitive, recording the instance as unresolved in "
        "both states.",

        "The null result on logic-class failures suggests that, for this class of defect, the "
        "bottleneck is unlikely to be the availability of accurate diagnostic information "
        "within a single revision attempt. The convergence of six independent generations on "
        "the identical partial solution, under sampling that was not pinned, is more "
        "consistent with a stable limit of single-shot code reasoning than with a system "
        "whose behaviour is sensitive to post-failure feedback.",

        "Executing a container-based Linux evaluation harness from a Windows host can "
        "silently produce invalid results through line-ending corruption. This is a "
        "generalisable methodological caution for coding-agent research conducted on Windows "
        "platforms, and is documented in Section 4.9.",
    ])

    # ------------------------------------------------------------- 6.4
    w.section("6.4", "Contributions of the Dissertation")
    w.bullets([
        "A fully scripted and auditable empirical pipeline for evaluating failure-recovery "
        "strategies on repository-level coding tasks, with every script, prompt, prediction "
        "file, and evaluation log published, and all reported results regenerable from those "
        "logs by script.",

        "Empirical evidence, checked across two independent recovery rounds, on the "
        "comparative effectiveness of three widely discussed recovery strategies, reported "
        "together with the coverage achieved and the cost incurred.",

        "A demonstration and correction of the confound between patch-formatting reliability "
        "and reasoning correctness in coding-agent evaluation, together with the "
        "recommendation that patch-application rate be reported separately from task "
        "resolution rate.",

        "A replication, in the previously unexamined setting of repository-level program "
        "repair verified by project test suites, of the finding that language models do not "
        "reliably correct their own reasoning when given only a request to reconsider "
        "[36], [37].",

        "A documented methodological finding concerning platform-dependent evaluation "
        "validity in container-based coding-agent research.",

        "An observation bearing on benchmark contamination: a provider-side generation "
        "refusal on the ground of reproducing memorised training data, obtained "
        "independently of the experimenter and recorded in Section 4.18.3, which indicates "
        "that benchmark content is present in the model's training corpus.",
    ])

    # ------------------------------------------------------------- 6.5
    w.section("6.5", "Limitations of the Study")
    w.body(
        "The conclusions above are bounded by the following limitations, which are set out in "
        "full in Section 5.12 and summarised here."
    )
    w.bullets([
        "Task solvability was not independently audited. A strategy cannot be shown "
        "ineffective on a task that no strategy could complete, and a proportion of "
        "SWE-bench instances are known to be underspecified or unfairly tested. This is the "
        "most serious limitation of the empirical component.",

        "The logic-class comparison rests on four instances with one observation per cell. No "
        "variance estimate is available and no significance test is reported. The study "
        "reports that no effect was observed; it does not report that no effect exists.",

        "Coverage of the comparison was incomplete, 16 of 24 cells having been evaluated, "
        "owing to the free-tier request ceiling.",

        "The task sample is a contiguous prefix of one benchmark drawn from two "
        "repositories, 14 of the 20 instances originating from a single project, and is not "
        "random.",

        "Sampling parameters were not fixed, so individual generations are not reproducible "
        "although the procedure is.",

        "A single model from a single provider was used throughout.",

        "The execution evidence supplied to Diagnose+Revise was truncated to its final 3,000 "
        "characters, so that condition was tested with a deliberately narrow feedback window.",

        "File localisation was supplied from benchmark metadata rather than performed by the "
        "system, so the resolution rates reported are not comparable with those of "
        "end-to-end agentic systems.",
    ])

    # ------------------------------------------------------------- 6.6
    w.section("6.6", "Scope for Future Work")
    w.body(
        "The limitations above define the work required to establish more than this study "
        "does. The items are given in order of priority."
    )
    w.bullets([
        "Audit the solvability of the logic-class instances against their issue descriptions "
        "and reference solutions, so that the null result can be attributed with confidence "
        "either to the recovery strategies or to the benchmark. Repeating the comparison on "
        "SWE-bench Verified, whose instances have been human-screened for specification and "
        "test fairness, would achieve the same end.",

        "Migrate to a provider offering a substantially higher request allowance, so that "
        "every cell of the comparison can be evaluated and multiple observations obtained per "
        "cell. This single change removes the incomplete-coverage limitation, permits "
        "variance estimation and significance testing, and is a precondition for most of the "
        "items below.",

        "Extend the sample beyond 20 instances, by stratified random sampling across the "
        "repositories of SWE-bench Lite rather than by taking a contiguous prefix, to test "
        "whether the observed null holds at larger scale and outside two projects.",

        "Widen the evidence window supplied to Diagnose+Revise, and compare windowing "
        "strategies against structured extraction of the failing assertion, to determine "
        "whether the truncation to 3,000 characters accounts for the absence of any advantage "
        "from execution-grounded diagnosis.",

        "Extend the comparison beyond two recovery rounds, to determine whether iterative "
        "diagnosis-based revision eventually succeeds on hard defects given sufficient "
        "attempts, and at what cumulative cost.",

        "Remove the oracle file-localisation simplification by incorporating a "
        "repository-search component, so that recovery strategies are tested under "
        "unassisted conditions comparable to those of deployed agentic systems.",

        "Repeat the comparison across several model families and context-window sizes, to "
        "establish whether the null result is a property of the strategies or of the "
        "particular model evaluated here.",

        "Extend the strategy ladder beyond the three conditions examined. Candidates "
        "suggested by the present findings include constrained or typed decoding to eliminate "
        "malformed edits entirely, tool-grounded revision in which the system may execute "
        "tests itself rather than receiving a transcript, checkpointing with rollback so that "
        "a regression-causing revision can be reverted, and a failure memory carried across "
        "attempts.",

        "Develop and validate recovery-oriented evaluation metrics beyond task-success rate, "
        "including diagnosis accuracy, partial-credit sub-test scoring, patch-application "
        "rate reported separately, and recovery effort expressed in tokens and wall-clock "
        "time. The present study's reliance on sub-test counts to observe its principal "
        "effect illustrates the need.",

        "Screen benchmark instances systematically for training-data contamination, using "
        "provider refusal signals of the kind reported in Section 4.18.3 alongside "
        "established probing methods, so that reported resolution rates can be interpreted "
        "against a known contamination baseline.",
    ])

    # ------------------------------------------------------------- 6.7
    w.section("6.7", "Concluding Remarks")
    w.body(
        "This dissertation set out to determine whether giving a repository-level coding "
        "system information about its own failure helps it recover. On the evidence obtained, "
        "it did not. Neither the system's own reasoning returned to it, nor the observed "
        "output of the tests it had failed, changed what it produced; and the strategy "
        "supplied with most information cost three times as much as the strategy supplied with "
        "none, for outcomes that were identical wherever both were measured."
    )
    w.body(
        "What did change outcomes was the notation in which an edit was expressed. Moving the "
        "clerical work of computing line offsets from the model to a deterministic procedure "
        "resolved every format-class failure that could be evaluated, and moved the most "
        "demanding instance in the sample from 0 of 16 required tests with 33 regressions to 6 "
        "of 16 with none, without altering the model, the prompt, or the task."
    )
    w.body(
        "The practical lesson is therefore about measurement before it is about mechanism. A "
        "coding system's failures are not of one kind, and an evaluation that does not "
        "separate the mechanical from the cognitive will attribute the repair of the former to "
        "an improvement in the latter. Had this study reported a single aggregate recovery "
        "rate, it would have recorded a plausible-looking 43 per cent and drawn the opposite "
        "conclusion from its own data."
    )
    w.body(
        "The findings are bounded, and Section 6.5 states how narrowly. Four instances, one "
        "model, one observation per cell, and an unaudited assumption of task solvability do "
        "not settle a general question about self-reflection in coding agents. They do, "
        "however, establish that the question cannot be answered by aggregate resolution "
        "rates alone, and they indicate where the effort of answering it should be directed."
    )

    # =====================================================================
    w.references(REFERENCES)


def main():
    in_place = "--in-place" in sys.argv
    w = ChapterWriter(SRC)
    write(w)
    if in_place:
        b = w.save_in_place()
        print(f"Updated Self.docx (backup at {os.path.basename(b)})")
    else:
        out = os.path.join(ROOT, "Self_ch6.docx")
        w.save_as(out)
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()
