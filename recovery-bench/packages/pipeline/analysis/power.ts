/**
 * Power for the exact McNemar test — the sample size the Registered Report
 * stands or falls on.
 *
 * `WORKFLOW.md` calls this the critical item, and the ordering is real: N fixes
 * the token budget, the budget fixes feasibility, and a Stage 1 reviewer checks
 * it before anything else. Under-powering is the exact failure the Registered
 * Report format exists to prevent, so a number that cannot be re-derived is
 * worse than no number at all.
 *
 * Everything here is closed form rather than simulated. The discordant pair
 * counts (b, c) are multinomial, and the exact McNemar p-value is a two-sided
 * binomial test at p = 1/2, so power is a finite double sum:
 *
 *     power = SUM over b,c   P(b, c | n)  ·  1[ p_exact(b, c) <= alpha ]
 *
 * O(n^2) and exact. No RNG, no seed, no Monte-Carlo error — which matters
 * because these figures get quoted in the paper: the same inputs give the same
 * digits forever. `ccos-study/docs/analysis_plan.md` section 7 reaches its table
 * with 3,000 simulations, so small disagreements with it are that sampling
 * noise, not a defect here.
 *
 * The load-bearing consequence is `minDiscordantPairs`: the exact test cannot
 * reach alpha = 0.05 on fewer than six discordant pairs, whatever n is. The
 * pilot had four logic-class failures. Its null was arithmetic before it was
 * ever evidence.
 */

import { existsSync } from "node:fs";

import { headline, type Headline } from "./aggregate.ts";
import { loadArchive, ARCHIVE_RUNS } from "./load.ts";

// ----------------------------------------------------------------- factorials

/**
 * log(k!) for k = 0..n, built once per call site.
 *
 * Summing logs rather than using a gamma approximation keeps this exact to
 * floating point at the n we care about (hundreds), and the table turns the
 * multinomial coefficient below into a subtraction instead of a product that
 * would overflow long before n = 200.
 */
function logFactorials(n: number): Float64Array {
  const lf = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) lf[i] = lf[i - 1]! + Math.log(i);
  return lf;
}

// --------------------------------------------------------- the exact p-value

/**
 * Two-sided exact McNemar p-value for `b` discordances one way, `c` the other.
 *
 * Conditional on the discordant total m = b + c, the test is a binomial test of
 * b against p = 1/2. That distribution is symmetric, so the two-sided p-value is
 * twice the lower tail at min(b, c), clamped at 1.
 *
 * Concordant pairs never appear: a task both strategies fix, or neither fixes,
 * carries no information about which is better. That is the whole reason a
 * 150-task study can have an effective sample size in the tens.
 */
export function mcnemarExactP(b: number, c: number): number {
  if (!Number.isInteger(b) || !Number.isInteger(c) || b < 0 || c < 0) {
    throw new Error(`mcnemarExactP: counts must be non-negative integers, got (${b}, ${c})`);
  }
  const m = b + c;
  if (m === 0) return 1; // nothing discordant: nothing observed either way
  const lf = logFactorials(m);
  const k = Math.min(b, c);
  let tail = 0;
  for (let i = 0; i <= k; i++) {
    tail += Math.exp(lf[m]! - lf[i]! - lf[m - i]! - m * Math.LN2);
  }
  return Math.min(1, 2 * tail);
}

/**
 * The largest minority count that still rejects, per discordant total.
 *
 * `t[m]` is the biggest min(b, c) whose exact p-value clears alpha when there
 * are m discordant pairs, or -1 when no split of m can reject at all.
 * Rejection depends only on (m, min(b, c)), so caching it keeps the power sum
 * at O(n^2) instead of recomputing a tail inside every cell.
 */
function rejectionThresholds(nMax: number, alpha: number): Int32Array {
  const t = new Int32Array(nMax + 1).fill(-1);
  const lf = logFactorials(nMax);
  for (let m = 1; m <= nMax; m++) {
    let tail = 0;
    let best = -1;
    for (let k = 0; k * 2 <= m; k++) {
      tail += Math.exp(lf[m]! - lf[k]! - lf[m - k]! - m * Math.LN2);
      if (Math.min(1, 2 * tail) <= alpha) best = k;
      else break; // the tail only grows with k, so a failure is final
    }
    t[m] = best;
  }
  return t;
}

/**
 * The fewest discordant pairs that can ever produce a significant result.
 *
 * At alpha = 0.05 this is 6. The most extreme possible split of m pairs gives
 * p = 2 · (1/2)^m, which is 0.0625 at m = 5 and 0.03125 at m = 6. Below that
 * floor the test cannot reject however lopsided the data is, so a study whose
 * discordant pool is smaller does not have low power — it has none.
 *
 * A property of the test alone: independent of n and of the effect size.
 */
export function minDiscordantPairs(alpha = 0.05): number {
  for (let m = 1; m <= 64; m++) {
    if (Math.min(1, 2 * Math.exp(-m * Math.LN2)) <= alpha) return m;
  }
  return Infinity;
}

// --------------------------------------------------------------------- power

export interface PowerInput {
  /** Paired observations. For H1 these are logic-class failures, not tasks. */
  n: number;
  /** P(the better strategy fixes it and the other does not). */
  pOnlyA: number;
  /** P(the reverse). */
  pOnlyB: number;
  alpha?: number;
}

/**
 * Exact power of the two-sided McNemar test.
 *
 * Sums the multinomial probability of every (b, c) that would reject. The rest
 * of the mass is concordant and contributes nothing but its own weight.
 */
export function mcnemarPower({ n, pOnlyA, pOnlyB, alpha = 0.05 }: PowerInput): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`mcnemarPower: n must be a non-negative integer, got ${n}`);
  }
  if (pOnlyA < 0 || pOnlyB < 0) {
    throw new Error("mcnemarPower: discordance probabilities must be >= 0");
  }
  if (pOnlyA + pOnlyB > 1) {
    throw new Error(`mcnemarPower: pOnlyA + pOnlyB must be <= 1, got ${pOnlyA + pOnlyB}`);
  }
  if (n === 0) return 0;

  const pSame = 1 - pOnlyA - pOnlyB;
  const t = rejectionThresholds(n, alpha);
  const lf = logFactorials(n);
  const lA = pOnlyA > 0 ? Math.log(pOnlyA) : -Infinity;
  const lB = pOnlyB > 0 ? Math.log(pOnlyB) : -Infinity;
  const lS = pSame > 0 ? Math.log(pSame) : -Infinity;

  let power = 0;
  for (let b = 0; b <= n; b++) {
    if (b > 0 && lA === -Infinity) break; // no probability mass above b = 0
    for (let c = 0; c <= n - b; c++) {
      if (c > 0 && lB === -Infinity) break;
      const rest = n - b - c;
      if (rest > 0 && lS === -Infinity) continue;
      const threshold = t[b + c]!;
      if (threshold < 0 || Math.min(b, c) > threshold) continue;
      const logP =
        lf[n]! - lf[b]! - lf[c]! - lf[rest]! +
        (b > 0 ? b * lA : 0) +
        (c > 0 ? c * lB : 0) +
        (rest > 0 ? rest * lS : 0);
      power += Math.exp(logP);
    }
  }
  return Math.min(1, power);
}

/**
 * The smallest paired n reaching `targetPower`, or null if `nMax` is not enough.
 *
 * Scanned rather than bisected. Exact power is non-decreasing in n overall but
 * not strictly so — adding one observation can leave the rejection region
 * untouched — and a bisection can settle on the wrong side of a flat step.
 */
export function smallestN(
  opts: Omit<PowerInput, "n"> & { targetPower?: number; nMax?: number },
): number | null {
  const { pOnlyA, pOnlyB, alpha = 0.05, targetPower = 0.8, nMax = 2000 } = opts;
  for (let n = 1; n <= nMax; n++) {
    if (mcnemarPower({ n, pOnlyA, pOnlyB, alpha }) >= targetPower) return n;
  }
  return null;
}

// ------------------------------------------------- tasks to analysable pairs

/**
 * How many tasks must be attempted to yield one analysable pair.
 *
 * A reviewer reads "N = 150" as the sample size. For H1 it is not: H1 compares
 * two strategies on **logic-class** failures, so a task enters the analysis only
 * if the baseline fails on it AND that failure is logic-class. Both rates are
 * derived from the pilot through `headline()` and never typed in, so if the
 * archive changes these move with it.
 */
export interface PoolRates {
  /** Baseline failures over tasks attempted — 8/20 in the pilot. */
  failureRate: number;
  /** Logic-class share of those failures — 4/8. */
  logicShare: number;
  /** Logic-class failures per task attempted: the product of the two above. */
  logicRate: number;
  /** Format-class failures per task attempted. */
  formatRate: number;
  /** Pool tasks with at least one evaluated attempt, over pool size — 7/8. */
  evaluableShare: number;
  source: { failures: number; tasks: number; logic: number; format: number; evaluable: number };
}

export function poolRates(h: Headline): PoolRates {
  const tasks = h.baselineN;
  const failures = h.poolSize;
  const logic = h.logicTasks.length;
  const format = failures - logic;
  const failureRate = failures / tasks;
  const logicShare = logic / failures;
  return {
    failureRate,
    logicShare,
    logicRate: failureRate * logicShare,
    formatRate: failureRate * (format / failures),
    evaluableShare: h.evaluable / failures,
    source: { failures, tasks, logic, format, evaluable: h.evaluable },
  };
}

/** Expected analysable counts at a given task budget. */
export interface ExpectedPool {
  nTasks: number;
  failures: number;
  logic: number;
  format: number;
  evaluable: number;
}

export function expectedPool(nTasks: number, r: PoolRates): ExpectedPool {
  return {
    nTasks,
    failures: nTasks * r.failureRate,
    logic: nTasks * r.logicRate,
    format: nTasks * r.formatRate,
    evaluable: nTasks * r.failureRate * r.evaluableShare,
  };
}

/** Tasks needed for the logic-class pool to reach `nLogic`. */
export function tasksForLogicPool(nLogic: number, r: PoolRates): number {
  return Math.ceil(nLogic / r.logicRate);
}

// ----------------------------------------------------------------- scenarios

/**
 * Three effect sizes, matched to `ccos-study/docs/analysis_plan.md` section 7 so
 * the two documents can be read side by side.
 */
export const SCENARIOS = [
  { label: "small", pOnlyA: 0.1, pOnlyB: 0.02 },
  { label: "medium", pOnlyA: 0.15, pOnlyB: 0.03 },
  { label: "large", pOnlyA: 0.2, pOnlyB: 0.05 },
] as const;

export interface PowerCell {
  label: string;
  pOnlyA: number;
  pOnlyB: number;
  power: number;
}

export interface PowerRow {
  n: number;
  alpha: number;
  power: PowerCell[];
}

export function powerCurve(ns: readonly number[], alpha = 0.05): PowerRow[] {
  return ns.map((n) => ({
    n,
    alpha,
    power: SCENARIOS.map((s) => ({
      label: s.label,
      pOnlyA: s.pOnlyA,
      pOnlyB: s.pOnlyB,
      power: mcnemarPower({ n, pOnlyA: s.pOnlyA, pOnlyB: s.pOnlyB, alpha }),
    })),
  }));
}

/** Everything the sample-size paragraph and the dashboard need. */
export interface PowerReport {
  alpha: number;
  targetPower: number;
  minDiscordant: number;
  rates: PoolRates;
  /** Power against the paired n directly. */
  curve: PowerRow[];
  /** Per effect size: the paired n required, and the task budget implying it. */
  requirement: {
    label: string;
    pOnlyA: number;
    pOnlyB: number;
    nPairs: number | null;
    tasksForH1: number | null;
  }[];
  /** What the pilot was capable of detecting. */
  pilot: {
    logicPool: number;
    minDiscordant: number;
    couldEverReject: boolean;
    /** The p-value of the most extreme split its pool could have produced. */
    bestAttainableP: number;
  };
}

export function powerReport(
  h: Headline,
  opts: { alpha?: number; targetPower?: number; ns?: readonly number[] } = {},
): PowerReport {
  const alpha = opts.alpha ?? 0.05;
  const targetPower = opts.targetPower ?? 0.8;
  const ns = opts.ns ?? [10, 20, 30, 40, 60, 90, 120, 150, 200];
  const rates = poolRates(h);
  const logicPool = h.logicTasks.length;
  const minDisc = minDiscordantPairs(alpha);

  return {
    alpha,
    targetPower,
    minDiscordant: minDisc,
    rates,
    curve: powerCurve(ns, alpha),
    requirement: SCENARIOS.map((s) => {
      const nPairs = smallestN({ pOnlyA: s.pOnlyA, pOnlyB: s.pOnlyB, alpha, targetPower });
      return {
        label: s.label,
        pOnlyA: s.pOnlyA,
        pOnlyB: s.pOnlyB,
        nPairs,
        tasksForH1: nPairs === null ? null : tasksForLogicPool(nPairs, rates),
      };
    }),
    pilot: {
      logicPool,
      minDiscordant: minDisc,
      couldEverReject: logicPool >= minDisc,
      bestAttainableP: mcnemarExactP(logicPool, 0),
    },
  };
}

// ----------------------------------------------------------------- rendering

const pct = (x: number) => (x * 100).toFixed(1) + "%";

/** Task budgets worth tabulating: the pre-registered target and the ladder up. */
export const CANDIDATE_BUDGETS = [150, 220, 300, 450, 600] as const;

/**
 * The sample-size section of the protocol, generated rather than typed.
 *
 * Deliberately leads with the chain from tasks to analysable pairs, because that
 * is the step a reader skips: "N = 150" is not the sample size for H1, and every
 * figure below follows from the difference.
 */
export function renderPowerReport(rep: PowerReport): string {
  const L: string[] = [];
  const s = rep.rates.source;

  L.push("# Power analysis — exact McNemar");
  L.push("");
  L.push("Do not edit by hand. Regenerate with `bun run power`.");
  L.push("");
  L.push(
    `Exact, not simulated: discordant pairs are multinomial and the exact McNemar ` +
      `p-value is a two-sided binomial test at p = 1/2, so power is a finite double sum. ` +
      `No RNG, so these digits are reproducible.`,
  );
  L.push("");
  L.push(`alpha = ${rep.alpha} · target power = ${rep.targetPower} (two-sided)`);
  L.push("");

  L.push("## The floor");
  L.push("");
  L.push(
    `The exact test cannot reach alpha = ${rep.alpha} on fewer than ` +
      `**${rep.minDiscordant} discordant pairs**, whatever n is: the most extreme split of ` +
      `m pairs gives p = 2 x (1/2)^m. Below that the rejection region is empty, so power ` +
      `is not low — it is zero.`,
  );
  L.push("");
  L.push(
    `**The pilot had ${rep.pilot.logicPool} logic-class failures.** Had every one favoured ` +
      `one strategy, p would have been ${rep.pilot.bestAttainableP} — above alpha. ` +
      `Its null result was arithmetic before it was evidence, and that is the case for ` +
      `re-testing H1 rather than a weakness in it.`,
  );
  L.push("");

  L.push("## Tasks are not pairs");
  L.push("");
  L.push(
    `From the pilot (${s.failures}/${s.tasks} baseline failures, ${s.logic} logic-class, ` +
      `${s.format} format-class, ${s.evaluable}/${s.failures} with an evaluated attempt):`,
  );
  L.push("");
  L.push("| Quantity | Per task attempted |");
  L.push("|---|---|");
  L.push(`| Baseline failure | ${rep.rates.failureRate} |`);
  L.push(`| Logic-class failure (**the H1 sample**) | ${rep.rates.logicRate} |`);
  L.push(`| Format-class failure | ${rep.rates.formatRate} |`);
  L.push("");
  L.push(
    `H1 compares two strategies on logic-class failures only, so its sample is ` +
      `**${rep.rates.logicRate} x N**, not the ${rep.rates.failureRate} x N whole pool.`,
  );
  L.push("");

  L.push("## Power against the paired n");
  L.push("");
  L.push("| paired n | " + SCENARIOS.map((x) => `${x.label} (${x.pOnlyA}/${x.pOnlyB})`).join(" | ") + " |");
  L.push("|---|" + SCENARIOS.map(() => "---").join("|") + "|");
  for (const row of rep.curve) {
    L.push(`| ${row.n} | ` + row.power.map((p) => pct(p.power)).join(" | ") + " |");
  }
  L.push("");

  L.push(`## What ${rep.targetPower * 100}% power costs`);
  L.push("");
  L.push("| Effect | p(only A)/p(only B) | paired n | tasks to attempt |");
  L.push("|---|---|---|---|");
  for (const q of rep.requirement) {
    L.push(
      `| ${q.label} | ${q.pOnlyA}/${q.pOnlyB} | ${q.nPairs ?? "not reached"} | ` +
        `**${q.tasksForH1 ?? "not reached"}** |`,
    );
  }
  L.push("");

  L.push("## H1 power at candidate task budgets");
  L.push("");
  L.push("| Tasks | Failure pool | Logic pool | " + SCENARIOS.map((x) => x.label).join(" | ") + " |");
  L.push("|---|---|---|" + SCENARIOS.map(() => "---").join("|") + "|");
  for (const n of CANDIDATE_BUDGETS) {
    const e = expectedPool(n, rep.rates);
    const nl = Math.floor(e.logic);
    const ps = SCENARIOS.map((x) =>
      pct(mcnemarPower({ n: nl, pOnlyA: x.pOnlyA, pOnlyB: x.pOnlyB, alpha: rep.alpha })),
    );
    L.push(`| ${n} | ${e.failures.toFixed(0)} | ${nl} | ` + ps.join(" | ") + " |");
  }
  L.push("");
  L.push(
    "The pre-registered N = 150 gives H1 a logic pool of 30. Every figure in that row is " +
      "the reason this analysis had to run before the protocol was written, not after.",
  );
  L.push("");
  return L.join("\n");
}

// --------------------------------------------------------------------- CLI

const TABLE_OUT = "../reports/data/power.md";
const JSON_OUT = "data/power.json";

/**
 * `power` — regenerate the sample-size section and the dashboard feed.
 *
 * Exits non-zero when the design cannot reach the target power at any candidate
 * budget. That is not a crash: it is the command refusing to let an
 * under-powered protocol look finished.
 */
export async function power(toStdout: boolean): Promise<number> {
  if (!existsSync(ARCHIVE_RUNS)) {
    console.error(
      [
        `no archive at ${ARCHIVE_RUNS}/.`,
        "The rates are derived from the pilot, never typed in, so this command needs it.",
        "Rebuild it with the recipe in archive/MANIFEST.md.",
      ].join("\n"),
    );
    return 1;
  }

  const { rows } = await loadArchive();
  const rep = powerReport(headline(rows));
  const table = renderPowerReport(rep);

  if (toStdout) {
    process.stdout.write(table);
    return 0;
  }

  await Bun.write(TABLE_OUT, table);
  await Bun.write(JSON_OUT, JSON.stringify(rep, null, 2) + "\n");

  // The best power any candidate budget reaches, over every effect size. If even
  // that misses the target, the design cannot answer H1 and saying so is the
  // point of running this before the protocol is written.
  const best = Math.max(
    ...CANDIDATE_BUDGETS.map((n) => {
      const nl = Math.floor(expectedPool(n, rep.rates).logic);
      return Math.max(
        ...SCENARIOS.map((s) =>
          mcnemarPower({ n: nl, pOnlyA: s.pOnlyA, pOnlyB: s.pOnlyB, alpha: rep.alpha }),
        ),
      );
    }),
  );

  console.log(`\npower - alpha ${rep.alpha}, target ${rep.targetPower}`);
  console.log(`  pilot logic pool ${rep.pilot.logicPool}, floor ${rep.minDiscordant} discordant pairs`);
  console.log(`  pilot could ever reject: ${rep.pilot.couldEverReject ? "yes" : "NO"}`);
  for (const q of rep.requirement) {
    console.log(
      `  ${q.label.padEnd(7)} needs n=${String(q.nPairs).padStart(4)} pairs` +
        ` -> ${q.tasksForH1} tasks attempted`,
    );
  }
  console.log(`  wrote ${TABLE_OUT}`);
  console.log(`  wrote ${JSON_OUT}`);

  if (best < rep.targetPower) {
    console.log(
      [
        "",
        `  H1 reaches at most ${(best * 100).toFixed(1)}% power at any candidate budget,` +
          ` against a target of ${rep.targetPower * 100}%.`,
        "  This is a design finding, not a failure to compute: the protocol needs a",
        "  decision before Stage 1 is written. See BUILD.md section 3.",
        "",
      ].join("\n"),
    );
    return 1;
  }
  console.log("");
  return 0;
}
