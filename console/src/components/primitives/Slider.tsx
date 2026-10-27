"use client";

import { RangeSlider } from "@/components/motion/range-slider";
import { cn } from "@/lib/utils";

/**
 * An instrument control: label, live value in mono, and a track whose ticks
 * carry real values rather than being decorative notches.
 *
 * Built on @beui/range-slider rather than an <input type="range"> or a
 * hand-rolled drag handler, for the reasons that are hard to retrofit:
 * arrow-key, PageUp/Down and Home/End operation, correct ARIA, and a thumb
 * that does not lose the pointer. The professor will drag it; a keyboard user
 * and a reviewer on a trackpad also have to be able to.
 *
 * It replaced a Radix slider and it is a small accessibility gain, not just a
 * nicer feel: it sets `aria-valuetext`, so a screen reader announces "0.30"
 * rather than a bare number with no unit. The spring on the thumb is the only
 * decorative part, and it is skipped under prefers-reduced-motion.
 *
 * `showTicks` stays OFF. These ranges are 30 and 100 steps, so dots would be a
 * grey smear; the labelled values under the track carry real numbers instead,
 * which is the point of an instrument.
 *
 * These sliders appear on screen 6 only. On the five screens showing measured
 * data there is nothing for G, r or h to move, and a control that looks live
 * but changes nothing is the same species of lie that R1-R3 exist to prevent.
 */
export function Slider({
  id,
  label,
  description,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  ticks,
  format = (v) => String(v),
  className,
}: {
  id: string;
  /** The symbol as it appears in the formula, e.g. "h". */
  label: string;
  /** What the symbol means, in plain words. */
  description: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Values to mark on the track. Each is labelled with the value itself. */
  ticks?: number[];
  format?: (value: number) => string;
  className?: string;
}) {
  const labelId = `${id}-label`;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-baseline justify-between gap-2">
        {/*
         * A span, not a <label>. RangeSlider's root takes no `id`, so `htmlFor`
         * would point at nothing -- a label associated with no control is
         * worse for a screen reader than no label element at all. The control's
         * accessible name comes from the `aria-label` passed below, which says
         * the same words.
         */}
        <span
          id={labelId}
          className="text-ink flex items-baseline gap-1.5 text-small"
        >
          <span className="font-mono font-medium">{label}</span>
          <span
            className="text-ink-muted text-label"
            style={{ fontVariationSettings: '"wdth" 85' }}
          >
            {description}
          </span>
        </span>
        <span className="text-measure font-mono text-small tabular-nums">
          {format(value)}
        </span>
      </div>

      <RangeSlider
        className="mt-2 h-7 rounded-control"
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        step={step}
        showTicks={false}
        aria-label={`${label} — ${description}`}
        formatValueText={format}
      />

      {ticks?.length ? (
        <div className="relative mt-1 h-3">
          {ticks.map((tick) => {
            const pct = ((tick - min) / (max - min)) * 100;
            return (
              <span
                key={tick}
                className="text-ink-muted absolute font-mono text-[10px] tabular-nums"
                style={{
                  left: `${pct}%`,
                  transform:
                    pct === 0
                      ? "none"
                      : pct === 100
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                }}
              >
                {format(tick)}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
