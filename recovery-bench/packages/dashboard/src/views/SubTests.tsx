/**
 * Sub-test movement on `django__django-11019` — thesis figure 5.2.
 *
 * The view the figure needed and did not originally have. A bar of "6" against
 * no visible scale says a fix worked; 6 against a dashed track of 16 says the
 * fix moved a third of the failing tests and left the rest failing. Those are
 * different findings, and only the second one is true.
 *
 * `p2pBroken` is the part that matters most and is easiest to lose: the
 * baseline patch applied cleanly and broke 33 previously passing tests. A view
 * that showed only FAIL_TO_PASS progress would report that patch as an
 * improvement.
 */

import { useState } from "react";
import type { Figures } from "../model/load.ts";
import { Track, ViewSwitch } from "../ui/primitives.tsx";

export function SubTests({ figures }: { figures: Figures }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const f = figures.fig5_2;
  const total = f.baseline.f2pTotal;

  const arms = [
    { name: "baseline", d: f.baseline },
    { name: "retrofitted", d: f.retrofitted },
  ];

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-3">
        <code className="text-[14px] font-semibold">{f.taskId}</code>
        <div className="ml-auto">
          <ViewSwitch view={view} onChange={setView} idBase="subtests" />
        </div>
      </div>

      {view === "table" ? (
        <table className="data">
          <thead>
            <tr>
              <th scope="col">attempt</th>
              <th scope="col">FAIL_TO_PASS passed</th>
              <th scope="col">of</th>
              <th scope="col">PASS_TO_PASS broken</th>
            </tr>
          </thead>
          <tbody>
            {arms.map((a) => (
              <tr key={a.name}>
                <th scope="row" className="font-normal">
                  {a.name}
                </th>
                <td>{a.d.f2pPassed}</td>
                <td>{a.d.f2pTotal}</td>
                <td className={a.d.p2pBroken > 0 ? "text-format" : ""}>{a.d.p2pBroken}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex flex-col gap-4">
          {arms.map((a) => (
            <div key={a.name}>
              <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
                <span className="text-[14px] font-semibold">{a.name}</span>
                <Track
                  value={a.d.f2pPassed}
                  total={total}
                  fill="var(--st-good)"
                  label={`${a.name} FAIL_TO_PASS passed`}
                />
                <span className="text-[14px] whitespace-nowrap">
                  <strong>{a.d.f2pPassed}</strong>
                  <span className="text-ink-faint">/{a.d.f2pTotal}</span>
                </span>
              </div>
              <p className="mt-1 mb-0 pl-[122px] text-[12px]">
                {a.d.p2pBroken > 0 ? (
                  <span className="text-format">
                    broke {a.d.p2pBroken} previously passing tests
                  </span>
                ) : (
                  <span className="text-ink-faint">broke nothing that was passing</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="t-caption mt-3 mb-0">
        The dashed track is all {total} FAIL_TO_PASS tests. Neither attempt resolved
        the instance; the retrofit moved {f.retrofitted.f2pPassed} of them and stopped
        breaking the {f.baseline.p2pBroken} the baseline broke.
        {f.allIdentical && " Every cell in this task produced an identical patch."}
      </p>
    </div>
  );
}
