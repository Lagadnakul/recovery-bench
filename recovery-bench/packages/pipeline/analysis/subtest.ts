/**
 * Phase 1b — would partial credit rescue the power problem?
 *
 * `power.ts` found that H1 gets 4.6-23.5% power at N = 150, because a binary
 * McNemar discards every concordant pair and the logic-class pool is only 0.2N.
 * The obvious escape is partial credit: score each task by how many FAIL_TO_PASS
 * sub-tests it fixes rather than by whether it fixed all of them, and use a
 * paired rank test. `django-11019` carries 16 sub-tests, so the idea looks
 * strong from that one example.
 *
 * It does not survive contact with the data, for two independent reasons, and
 * this module measures both so the protocol can say so rather than assert it.
 *
 *  1. **The distribution.** 64% of SWE-bench Lite instances have exactly ONE
 *     FAIL_TO_PASS test. For those the sub-test score IS the binary outcome, so
 *     there is no partial credit to be had. The median is 1 and `django-11019`
 *     sits in the top 3%.
 *
 *  2. **The observed differences.** In the pilot every paired F2P difference
 *     between strategies is exactly ZERO. Blind Retry, Reflection-only and
 *     Diagnose+Revise return identical sub-test scores on all four logic-class
 *     tasks. A Wilcoxon signed-rank test drops ties exactly as McNemar drops
 *     concordant pairs, so the informative sample is not smaller — it is empty.
 *
 * What the data does offer is `PASS_TO_PASS` regressions, which 98% of instances
 * can express and which **did** separate the strategies in the pilot: on
 * `django-11283` Diagnose+Revise broke 8 previously-passing tests where Blind
 * Retry broke none. That is a different question from recovery — it is whether
 * richer failure information does harm — and it is the one outcome here with
 * both the cardinality and the observed variance to support a test.
 */

import type { ArchiveRow } from "./load.ts";

// ------------------------------------------------- the information available

export interface Bucket {
  label: string;
  count: number;
  share: number;
}

export interface F2PDistribution {
  n: number;
  min: number;
  median: number;
  q75: number;
  q90: number;
  max: number;
  mean: number;
  buckets: Bucket[];
  /** Instances where the sub-test score cannot differ from the binary outcome. */
  singleTest: number;
  /** Instances with room for a partial difference. */
  multiTest: number;
  /** Instances that alone could supply the 6 pairs the exact test needs. */
  atLeastSix: number;
}

const BUCKETS: [string, (x: number) => boolean][] = [
  ["exactly 1", (x) => x === 1],
  ["2", (x) => x === 2],
  ["3-5", (x) => x >= 3 && x <= 5],
  ["6-9", (x) => x >= 6 && x <= 9],
  ["10 or more", (x) => x >= 10],
];

/** Quantiles of the FAIL_TO_PASS counts. Pure: the caller does the IO. */
export function f2pDistribution(sizes: readonly number[]): F2PDistribution {
  if (sizes.length === 0) throw new Error("f2pDistribution: no instances");
  const s = [...sizes].sort((a, b) => a - b);
  const n = s.length;
  const at = (p: number) => s[Math.min(n - 1, Math.floor(p * n))]!;
  return {
    n,
    min: s[0]!,
    median: at(0.5),
    q75: at(0.75),
    q90: at(0.9),
    max: s[n - 1]!,
    mean: s.reduce((a, b) => a + b, 0) / n,
    buckets: BUCKETS.map(([label, f]) => {
      const count = s.filter(f).length;
      return { label, count, share: count / n };
    }),
    singleTest: s.filter((x) => x === 1).length,
    multiTest: s.filter((x) => x >= 2).length,
    atLeastSix: s.filter((x) => x >= 6).length,
  };
}

/** Reads the FAIL_TO_PASS and PASS_TO_PASS sizes from the frozen dataset. */
export async function readTestCounts(
  path = "data/swebench_lite.jsonl",
): Promise<{ f2p: number[]; p2p: number[] }> {
  const text = await Bun.file(path).text();
  const f2p: number[] = [];
  const p2p: number[] = [];
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue;
    const d = JSON.parse(line) as { FAIL_TO_PASS: string | string[]; PASS_TO_PASS: string | string[] };
    const parse = (v: string | string[]) => (typeof v === "string" ? (JSON.parse(v) as string[]) : v);
    f2p.push(parse(d.FAIL_TO_PASS).length);
    p2p.push(parse(d.PASS_TO_PASS).length);
  }
  if (f2p.length === 0) throw new Error(`readTestCounts: no instances in ${path}`);
  return { f2p, p2p };
}

// ---------------------------------------------- the differences actually seen

/** The two strategies H1 compares. */
export const H1_PAIR = ["l1_blind_retry", "l2_5_diagnose_revise"] as const;

export interface PairedDiff {
  taskId: string;
  round: number;
  strategyA: string;
  strategyB: string;
  f2pA: number;
  f2pB: number;
  f2pTotal: number;
  /** f2pA - f2pB. Zero is a tie, and a tie is discarded by every paired test. */
  diff: number;
}

/**
 * Paired F2P scores for one strategy pair, per task and round.
 *
 * Only rounds where both strategies produced a test-verified cell can be paired;
 * an unmatched cell is not a zero, it is absent, and is left out rather than
 * imputed.
 */
export function pairedF2PDiffs(
  rows: ArchiveRow[],
  taskIds: readonly string[],
  pair: readonly [string, string] = H1_PAIR,
): PairedDiff[] {
  const out: PairedDiff[] = [];
  const verified = rows.filter((r) => r.row.verification === "test" && r.row.tests !== null);

  for (const taskId of taskIds) {
    const mine = verified.filter((r) => r.row.cell.taskId === taskId);
    const rounds = [...new Set(mine.map((r) => r.row.cell.round))].sort((a, b) => a - b);
    for (const round of rounds) {
      const a = mine.find((r) => String(r.row.cell.strategy) === pair[0] && r.row.cell.round === round);
      const b = mine.find((r) => String(r.row.cell.strategy) === pair[1] && r.row.cell.round === round);
      if (!a || !b) continue;
      const ta = a.row.tests!;
      const tb = b.row.tests!;
      out.push({
        taskId,
        round,
        strategyA: pair[0],
        strategyB: pair[1],
        f2pA: ta.f2pPassed,
        f2pB: tb.f2pPassed,
        f2pTotal: ta.f2pTotal,
        diff: ta.f2pPassed - tb.f2pPassed,
      });
    }
  }
  return out;
}

/**
 * Non-tied pairs: the only ones a paired rank test can use.
 *
 * Wilcoxon signed-rank discards zero differences before ranking, which is the
 * same structural loss that makes McNemar throw away concordant pairs. Partial
 * credit only helps if it converts ties into non-ties.
 */
export function informativePairs(diffs: readonly PairedDiff[]): number {
  return diffs.filter((d) => d.diff !== 0).length;
}

// --------------------------------------------------------- the other signal

export interface P2PRegression {
  taskId: string;
  strategy: string;
  round: number;
  broken: number;
  p2pTotal: number;
}

/** Previously-passing tests each cell broke. D4's counter-signal, enumerated. */
export function p2pRegressions(rows: ArchiveRow[]): P2PRegression[] {
  return rows
    .filter((r) => r.row.verification === "test" && r.row.tests !== null)
    .map((r) => {
      const t = r.row.tests!;
      return {
        taskId: r.row.cell.taskId,
        strategy: String(r.row.cell.strategy),
        round: r.row.cell.round,
        broken: t.p2pTotal - t.p2pPassed,
        p2pTotal: t.p2pTotal,
      };
    })
    .filter((x) => x.broken > 0)
    .sort((a, b) => b.broken - a.broken);
}

// ------------------------------------------------------------------ verdict

export interface SubTestVerdict {
  dist: F2PDistribution;
  diffs: PairedDiff[];
  informative: number;
  /** Discordant/non-tied pairs the exact test needs. From `power.ts`. */
  floor: number;
  /** Whether partial credit converts any tie into a usable pair. */
  helps: boolean;
  /** Share of instances that can express a regression at all. */
  p2pAvailability: number;
  p2pMedian: number;
  observedRegressions: P2PRegression[];
}

/** The Phase 1b section of the sample-size analysis, generated. */
export function renderSubTestVerdict(v: SubTestVerdict): string {
  const L: string[] = [];
  const pc = (x: number) => (x * 100).toFixed(1) + "%";
  const d = v.dist;

  L.push("## Phase 1b — would partial credit help? No.");
  L.push("");
  L.push(
    "Scoring each task by how many FAIL_TO_PASS sub-tests it fixes, instead of whether it " +
      "fixed all of them, is the obvious way to buy power: `django-11019` carries 16 sub-tests. " +
      "Two independent measurements say it does not work.",
  );
  L.push("");

  L.push("### 1. There is almost no partial credit available");
  L.push("");
  L.push(`FAIL_TO_PASS counts over all ${d.n} SWE-bench Lite instances:`);
  L.push("");
  L.push("| Sub-tests | Instances | Share |");
  L.push("|---|---|---|");
  for (const b of d.buckets) L.push(`| ${b.label} | ${b.count} | ${pc(b.share)} |`);
  L.push("");
  L.push(
    `min ${d.min} · median **${d.median}** · q75 ${d.q75} · q90 ${d.q90} · max ${d.max} · ` +
      `mean ${d.mean.toFixed(2)}`,
  );
  L.push("");
  L.push(
    `**${pc(d.singleTest / d.n)} of instances have exactly one FAIL_TO_PASS test.** For those ` +
      `the sub-test score *is* the binary outcome — there is no partial credit to extract. ` +
      `Only ${pc(d.atLeastSix / d.n)} have six or more, so \`django-11019\` is the least ` +
      `representative instance in the benchmark rather than the typical one.`,
  );
  L.push("");

  L.push("### 2. The differences that exist are all zero");
  L.push("");
  L.push("| Task | Round | F2P total | Blind Retry | Diagnose+Revise | Difference |");
  L.push("|---|---|---|---|---|---|");
  for (const p of v.diffs) {
    L.push(
      `| \`${p.taskId}\` | ${p.round} | ${p.f2pTotal} | ${p.f2pA}/${p.f2pTotal} | ` +
        `${p.f2pB}/${p.f2pTotal} | **${p.diff}** |`,
    );
  }
  L.push("");
  L.push(
    `**${v.informative} informative (non-tied) pairs**, against a floor of ${v.floor}. ` +
      `A Wilcoxon signed-rank test discards zero differences before ranking, exactly as ` +
      `McNemar discards concordant pairs, so the informative sample here is not smaller than ` +
      `the binary one — it is empty. The strategies return *identical sub-test scores*, not ` +
      `merely identical verdicts, which is a sharper statement of the pilot finding than the ` +
      `binary table can make.`,
  );
  L.push("");

  L.push("### What the data does support: PASS_TO_PASS regressions");
  L.push("");
  L.push(
    `${pc(v.p2pAvailability)} of instances carry at least one PASS_TO_PASS test ` +
      `(median ${v.p2pMedian}), and unlike F2P this outcome **did** separate the strategies:`,
  );
  L.push("");
  L.push("| Task | Strategy | Round | Tests broken |");
  L.push("|---|---|---|---|");
  for (const r of v.observedRegressions) {
    L.push(`| \`${r.taskId}\` | ${r.strategy} | ${r.round} | ${r.broken} |`);
  }
  L.push("");
  L.push(
    "This measures a different question from recovery — whether richer failure information " +
      "does *harm* — and it is the only outcome available with both the cardinality and the " +
      "observed variance to support a test. It is a candidate for a new hypothesis, not a " +
      "replacement for H1.",
  );
  L.push("");
  return L.join("\n");
}

export function subTestVerdict(
  rows: ArchiveRow[],
  logicTasks: readonly string[],
  counts: { f2p: number[]; p2p: number[] },
  floor: number,
): SubTestVerdict {
  const dist = f2pDistribution(counts.f2p);
  const diffs = pairedF2PDiffs(rows, logicTasks);
  const informative = informativePairs(diffs);
  const p2pSorted = [...counts.p2p].sort((a, b) => a - b);
  return {
    dist,
    diffs,
    informative,
    floor,
    helps: informative > 0,
    p2pAvailability: counts.p2p.filter((x) => x >= 1).length / counts.p2p.length,
    p2pMedian: p2pSorted[Math.floor(p2pSorted.length / 2)]!,
    observedRegressions: p2pRegressions(rows),
  };
}
