import {
  StoppingRule,
  type StoppingRuleData,
} from "@/components/screens/StoppingRule";
import { loadCcos } from "@/model/ccos";

/**
 * Server component. It reads ccos.json at build time and hands the client
 * screen a compact projection -- a few hundred bytes rather than the 132 KB
 * file, and none of the 1.1 MB row snapshot. That is the Phase 2 architectural
 * rule: aggregates resolve on the server, clients get projections.
 */
export default function Page() {
  const run = loadCcos();
  const beliefs = new Map(run.beliefs.map((b) => [b.cls, b]));

  const data: StoppingRuleData = {
    payoffs: run.payoffs,
    lambdaUsed: run.lambda.used,
    lambdaEstimate: run.lambda.estimate,
    lambdaInterval: run.lambda.interval,
    lambdaIsMeasured: run.lambda.isMeasured,
    classes: run.policy.map((row) => {
      const belief = beliefs.get(row.cls);
      return {
        cls: row.cls,
        alpha: belief?.belief.alpha ?? 0.5,
        beta: belief?.belief.beta ?? 0.5,
        q: row.q,
        trials: row.trials,
        successes: row.successes,
        priorOnly: row.priorOnly,
        prescribed: row.prescribed,
      };
    }),
    horizonClasses: run.horizons.map((h) => h.cls),
    horizonK: run.horizons[0]?.result.decisions.length ?? 5,
    arms: run.arms,
    survivorship: {
      successes: run.survivorship.successes,
      retriedAfterSuccess: run.survivorship.retriedAfterSuccess,
    },
    totalTrials: run.observations.reduce((n, o) => n + o.trials, 0),
  };

  return <StoppingRule data={data} />;
}
