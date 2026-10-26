"use client";

import { Slider as RadixSlider } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * An instrument control: label, live value in mono, and a track whose ticks
 * carry real values rather than being decorative notches.
 *
 * Built on Radix rather than an <input type="range"> or a hand-rolled drag
 * handler, for the reasons that are hard to retrofit: arrow-key and Home/End
 * operation, correct ARIA, and a thumb that does not lose the pointer. The
 * professor will drag it; a keyboard user and a reviewer on a laptop trackpad
 * also have to be able to.
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
        <label
          id={labelId}
          htmlFor={id}
          className="text-ink flex items-baseline gap-1.5 text-small"
        >
          <span className="font-mono font-medium">{label}</span>
          <span
            className="text-ink-muted text-label"
            style={{ fontVariationSettings: '"wdth" 85' }}
          >
            {description}
          </span>
        </label>
        <span className="text-measure font-mono text-small tabular-nums">
          {format(value)}
        </span>
      </div>

      <RadixSlider.Root
        id={id}
        aria-labelledby={labelId}
        className="relative mt-2 flex h-4 w-full touch-none items-center select-none"
        value={[value]}
        onValueChange={([next]) => {
          if (next !== undefined) onValueChange(next);
        }}
        min={min}
        max={max}
        step={step}
      >
        {/* 3:1 against the canvas, via --color-rule-strong: the track is the
            boundary of a control, which WCAG 1.4.11 does not treat as
            decorative. A hairline divider colour here would fail. */}
        <RadixSlider.Track className="bg-rule-strong relative h-px grow">
          <RadixSlider.Range className="bg-measure absolute h-px" />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          className={cn(
            "bg-surface border-measure rounded-control block h-4 w-2.5 border-2",
            "transition-[box-shadow] duration-150",
            "hover:shadow-[0_0_0_3px_var(--color-measure-wash)]",
            "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
          )}
          aria-label={`${label} — ${description}`}
        />
      </RadixSlider.Root>

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
