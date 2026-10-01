/**
 * The legend, grouped by band rather than listed flat.
 *
 * Nine swatches in a row would say "nine kinds of failure". Grouped, they say
 * what the palette is actually encoding: one outcome is success, one is a
 * validity threat, three are the model failing to produce applicable output,
 * one is the model saying nothing, and three measured nothing at all because of
 * a limit we imposed.
 *
 * That last group is the one readers get wrong, so it is labelled in words.
 */

import type { OutcomeKind } from "@rb/core";
import {
  BAND_LABEL,
  BAND_ORDER,
  ORDERED_KINDS,
  statusOf,
  type Band,
} from "../model/status.ts";

export function Legend({ counts }: { counts: Map<OutcomeKind, number> }) {
  const byBand = new Map<Band, OutcomeKind[]>();
  for (const kind of ORDERED_KINDS) {
    const b = statusOf(kind).band;
    const list = byBand.get(b);
    if (list) list.push(kind);
    else byBand.set(b, [kind]);
  }

  return (
    <dl className="m-0 flex flex-col gap-3">
      {BAND_ORDER.filter((b) => byBand.has(b)).map((band) => (
        <div key={band}>
          <dt className="t-micro mb-1.5">{BAND_LABEL[band]}</dt>
          {(byBand.get(band) ?? []).map((kind) => {
            const s = statusOf(kind);
            const n = counts.get(kind) ?? 0;
            return (
              <dd key={kind} className="m-0 flex items-center gap-2 py-0.5">
                <span
                  aria-hidden="true"
                  className={`cell${s.hatched ? " cell--hatched" : ""}`}
                  style={{
                    ["--cell-fill" as string]: `var(${s.token})`,
                    ["--cell-ink" as string]: `var(${s.onToken})`,
                    cursor: "default",
                  }}
                >
                  {s.glyph}
                </span>
                <span className="text-[13px]">{s.label}</span>
                <code className="ml-auto text-[10px] text-ink-faint">{kind}</code>
                <span className="w-10 text-right text-[13px] font-semibold tabular-nums">
                  {n.toLocaleString()}
                </span>
              </dd>
            );
          })}
        </div>
      ))}
    </dl>
  );
}
