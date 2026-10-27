import { HowItWorks, type HowItWorksData } from "@/components/screens/HowItWorks";
import { loadRows, STRATEGY_LABEL } from "@/model/rows";
import {
  applyRateByFormat,
  malformedByReason,
  outcomeKinds,
  reflectionHarm,
  roundSeries,
  thetaFor,
  tokenSeries,
  totals,
} from "@/model/derive";
import { chanceInWords } from "@/model/glossary";
import { loadCcos } from "@/model/ccos";
import { CLASS_LABEL, CLASS_PLAIN } from "@/components/primitives/ClassMark";

/**
 * Server component. Every figure the explainer shows is derived here, the same
 * way the other six screens do it, so an animation can never drift from the
 * data it claims to describe.
 *
 * Act 1's token counts are blind retry on the 550B arm: the cheapest, simplest
 * retry strategy in the study, which is the right one to open with because it
 * is what an agent does by default.
 */
export default function Page() {
  const rows = loadRows();
  const attempts = tokenSeries(rows, "a3_capability", "l1_blind_retry");

  const data: HowItWorksData = {
    loop: {
      attempts: attempts.map((p) => ({
        round: p.round,
        meanCompletion: p.meanCompletion,
        tokens: p.meanCompletion,
      })),
      // Summed AFTER rounding, not before. The four means are 799.2, 945.65,
      // 1118.85 and 1091.5; rounding the sum gives 3,955 while the four rows
      // on screen add to 3,956. A reader who adds the column must get the
      // total it sits under, so the displayed figures are the ones summed.
      totalTokens: attempts.reduce(
        (n, p) => n + Math.round(p.meanCompletion ?? 0),
        0,
      ),
      model: "the 550B model, retrying without being told what went wrong",
    },
    gate: (() => {
      const t = totals(rows);
      const applied =
        outcomeKinds(rows).find((k) => k.kind === "APPLIED")?.count ?? 0;
      return {
        tasks: t.tasks,
        attempts: t.rows,
        applied,
        notApplied: t.rows - applied,
        // Derived, not asserted. `verification` is "apply" on every live row,
        // so this counts to zero from the data rather than being typed in as a
        // zero that a later run could silently falsify.
        tested: rows.filter((r) => r.verification !== "apply").length,
        starvedStrategy: {
          label: STRATEGY_LABEL.l2_5_diagnose_revise,
          rows: rows.filter(
            (r) => r.cell.strategy === "l2_5_diagnose_revise",
          ).length,
        },
      };
    })(),
    format: (() => {
      // a5 is the only block designed to test the format, and the only one
      // spanning 60 bugs. The other five held the format fixed, so they cannot
      // speak to this and are not pooled in.
      const ARM = "a5_format_at_scale" as const;
      const f = applyRateByFormat(rows, ARM);
      const inArm = rows.filter((r) => r.arm === ARM);
      const losing = inArm.filter((r) => r.cell.editFormat === "unified_diff");
      return {
        tasks: new Set(inArm.map((r) => r.cell.taskId)).size,
        models: [...new Set(inArm.map((r) => r.cell.model))].sort(),
        quote: {
          rows: f.searchReplace.rows,
          applied: f.searchReplace.applied,
          rate: f.searchReplace.rate,
        },
        diff: {
          rows: f.unifiedDiff.rows,
          applied: f.unifiedDiff.applied,
          rate: f.unifiedDiff.rate,
        },
        ratio: f.searchReplace.rate / f.unifiedDiff.rate,
        reasons: malformedByReason(losing).map((r) => ({
          label: r.label,
          count: r.count,
          share: r.share,
        })),
      };
    })(),
    collapse: (() => {
      // a3 is where the collapse appears. a2 and a4 are carried as the
      // replication check, because an act that showed only a3 would be the
      // most quotable and the least honest.
      const A = "a3_capability" as const;
      const after = (strategy: "l1_blind_retry" | "l2_reflection") =>
        rows.filter(
          (r) => r.arm === A && r.cell.strategy === strategy && r.cell.round >= 2,
        );
      const reflectReason = malformedByReason(after("l2_reflection"))[0];
      const blindReason = malformedByReason(after("l1_blind_retry"))[0];
      const test = reflectionHarm(rows, A);
      const inArm = rows.filter((r) => r.arm === A);

      // Three arms, three different answers, and the wording has to keep them
      // different. "No harm at all" for both would be true and useless: one is
      // dead even and the other actually leans toward reflection.
      const verdict = (arm: "a2_workhorse" | "a4_reasoning", label: string) => {
        const t = reflectionHarm(rows, arm);
        if (t.n === 0) return { label, verdict: "no pairs to compare" };
        if (t.p <= 0.05)
          return { label, verdict: t.b > t.c ? "same direction" : "the opposite" };
        if (t.b === t.c) return { label, verdict: "dead even" };
        return {
          label,
          verdict: t.c > t.b ? "leans the other way" : "no clear difference",
        };
      };

      return {
        blind: roundSeries(rows, A, "l1_blind_retry").map((p) => ({
          round: p.round,
          rate: p.rate,
        })),
        reflect: roundSeries(rows, A, "l2_reflection").map((p) => ({
          round: p.round,
          rate: p.rate,
        })),
        tasks: new Set(inArm.map((r) => r.cell.taskId)).size,
        repeats: new Set(inArm.map((r) => r.cell.repeat)).size,
        test: {
          b: test.b,
          c: test.c,
          pairs: test.n + test.concordant,
          odds: chanceInWords(test.p),
        },
        mechanism: {
          reflectCount: reflectReason?.count ?? 0,
          reflectReason: reflectReason?.label ?? "",
          blindCount: blindReason?.count ?? 0,
          blindReason: blindReason?.label ?? "",
        },
        replication: [
          verdict("a2_workhorse", "the 30B model"),
          verdict("a4_reasoning", "the reasoning model"),
        ],
      };
    })(),
    rule: (() => {
      const run = loadCcos();
      const { G, r, h } = run.payoffs;
      const of = (cls: "FORMAT" | "LOGIC") => {
        const row = run.policy.find((p) => p.cls === cls)!;
        return {
          key: cls,
          label: CLASS_LABEL[cls],
          plain: CLASS_PLAIN[cls],
          pHat: row.pZero,
          theta: row.theta,
          trials: row.trials,
          successes: row.successes,
        };
      };
      const lead = of("FORMAT");
      const leadQ = run.policy.find((p) => p.cls === "FORMAT")!.q;
      // The cost of asking a person at which the lead class flips from "ask"
      // to "keep trying": theta = q - (h - r)/G, so it crosses pHat at
      // h = r + G(q - pHat). Computed, not typed in, so the narration cannot
      // drift from the line the scene actually draws.
      const toH = Math.round((r + G * (leadQ - lead.pHat) + 0.18) * 100) / 100;
      return {
        payoffs: run.payoffs,
        lead,
        second: of("LOGIC"),
        demo: {
          fromH: h,
          fromTheta: lead.theta,
          toH,
          toTheta: thetaFor(G, r, toH, leadQ),
        },
        arms: run.arms.map((a) => ({
          label: a.label,
          plain: a.represents,
          at:
            a.id === "A_stubborn"
              ? 0
              : a.id === "B_needy"
                ? 1
                : ("class" as const),
        })),
      };
    })(),
    needs: (() => {
      const run = loadCcos();
      const { G, r, h } = run.payoffs;
      const byClass = (cls: string) => run.policy.find((p) => p.cls === cls)!;
      const fmt = byClass("FORMAT");
      const logic = byClass("LOGIC");
      const priorOnly = run.policy.filter((p) => p.priorOnly);
      const trials = run.observations.reduce((n, o) => n + o.trials, 0);

      const items = [
        {
          key: "p-format",
          label: "Chance a retry works — formatting slips",
          detail: `${fmt.successes} worked of ${fmt.trials} tried`,
          state: "measured" as const,
          status: `measured · ${fmt.trials} trials`,
        },
        {
          key: "p-logic",
          label: "Chance a retry works — wrong ideas",
          detail: `${logic.successes} worked of ${logic.trials} tried`,
          state: "measured" as const,
          status: `measured · ${logic.trials} trials`,
        },
        {
          key: "p-prior",
          label: `Chance a retry works — the other ${priorOnly.length} kinds`,
          detail: priorOnly
            .map((p) => p.cls.toLowerCase())
            .join(" and "),
          state: "none" as const,
          status: "no evidence · 0 trials",
        },
        {
          key: "q",
          label: "How often a person succeeds instead",
          detail: `assumed ${byClass("FORMAT").q} and ${byClass("LOGIC").q}; never measured`,
          state: "assumed" as const,
          status: "chosen, not measured",
        },
        {
          key: "payoffs",
          label: "What a fix is worth, and what each option costs",
          detail: `set to ${G}, ${r} and ${h}`,
          state: "assumed" as const,
          status: "chosen, not measured",
        },
        {
          key: "lambda",
          label: "How fast the chance fades with each try",
          detail: `fitted at ${run.lambda.estimate}, but the range reaches ${run.lambda.interval.hi}`,
          state: "inconclusive" as const,
          status: `inconclusive · ran at ${run.lambda.used}`,
        },
        {
          key: "survivorship",
          label: "What retrying after a success does",
          detail: `${run.survivorship.successes} succeeded, ${run.survivorship.retriedAfterSuccess} were tried again`,
          state: "none" as const,
          status: "never observed",
        },
      ];

      return {
        items,
        measured: items.filter((i) => i.state === "measured").length,
        trials,
        lambda: {
          estimate: run.lambda.estimate,
          lo: run.lambda.interval.lo,
          hi: run.lambda.interval.hi,
          used: run.lambda.used,
        },
      };
    })(),
  };

  return <HowItWorks data={data} />;
}
