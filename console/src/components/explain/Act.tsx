"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

/**
 * One act of the explainer: a scene that plays itself when you press play.
 *
 * This was scroll-driven first, and scroll-driven was wrong for the job. In a
 * viva the presenter is talking, not scrolling, and an examiner watching from
 * across a desk cannot drive the page. Press play and the steps advance on
 * their own; the numbered dots jump straight to any step, which is what you
 * want when someone asks about one specific moment.
 *
 * It also removes a real risk: a pinned scroll scene fights the sticky rail on
 * some engines, and nothing here needs pinning any more.
 *
 * ## Nothing autoplays
 *
 * Deliberate. Motion that starts on its own is motion the reader did not ask
 * for, and WCAG 2.2.2 requires a stop control for anything auto-playing past
 * five seconds. An explicit play button satisfies that by construction, and it
 * means the scene is still and readable until someone wants it to move.
 *
 * ## Reduced motion removes the player, not just the motion
 *
 * `accessible-animation` tiers motion rather than killing it, but a sequence
 * whose whole content IS movement has nothing to soften. So under
 * `prefers-reduced-motion` the scene renders complete and static, and the
 * controls are replaced by a line saying why. The reader loses the animation
 * and loses nothing else -- every fact is on screen at once.
 *
 * The global `prefers-reduced-motion` rule in globals.css does NOT cover this:
 * it neutralises CSS animation, and GSAP writes inline styles from JavaScript.
 * The gate has to be `gsap.matchMedia()`.
 */

export type BuildScene = (
  /**
   * The paused timeline. Add tweens, and call `tl.addLabel()` before each step
   * so the player can render a dot for it and seek to it.
   */
  tl: gsap.core.Timeline,
  scope: HTMLElement,
) => void;

export function Act({
  id,
  title,
  lede,
  build,
  children,
}: {
  id: string;
  title: string;
  lede: string;
  build: BuildScene;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  /** Label times, captured after build so onUpdate does not re-read them. */
  const times = useRef<number[]>([]);

  const [reduced, setReduced] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);

  useGSAP(
    () => {
      const scope = root.current;
      if (!scope) return;

      const mm = gsap.matchMedia();

      mm.add(
        {
          motionOK: "(prefers-reduced-motion: no-preference)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const isReduced = (context.conditions as { reduce: boolean }).reduce;
          setReduced(isReduced);

          // Reduced motion needs no work at all. The scene's content is
          // visible in the markup by default, so doing nothing IS the
          // finished, static state -- which is also what a reader sees if
          // JavaScript never runs.
          if (isReduced) return;

          // Built with NO callbacks attached. GSAP renders tweens as they are
          // created -- `fromTo` applies its start state immediately -- so an
          // onUpdate wired in the constructor fires during construction and
          // leaves the player reporting the last step before anyone has
          // pressed anything. That is exactly what it did.
          const tl = gsap.timeline({ paused: true });
          build(tl, scope);

          // Rewind, THEN listen.
          tl.progress(0).pause();
          tl.eventCallback("onUpdate", () => {
            // Written straight to the DOM rather than through React state.
            // This fires every frame, and a setState per frame would
            // re-render the whole act sixty times a second.
            if (bar.current) {
              bar.current.style.transform = `scaleX(${tl.progress()})`;
            }
            const at = tl.time();
            let index = 0;
            times.current.forEach((time, i) => {
              if (at >= time - 0.001) index = i;
            });
            // Only when it actually changes, so React work stays off the
            // animation frame.
            setCurrent((prev) => (prev === index ? prev : index));
          });
          tl.eventCallback("onComplete", () => setPlaying(false));

          const labels = Object.entries(tl.labels).sort((a, b) => a[1] - b[1]);
          times.current = labels.map(([, time]) => time);

          timeline.current = tl;
          setSteps(labels.map(([label]) => label));
          setCurrent(0);
          if (bar.current) bar.current.style.transform = "scaleX(0)";
        },
      );

      return () => {
        mm.revert();
        timeline.current = null;
      };
    },
    { scope: root },
  );

  const toggle = () => {
    const tl = timeline.current;
    if (!tl) return;
    if (tl.progress() === 1) {
      tl.restart();
      setPlaying(true);
      return;
    }
    if (tl.paused()) {
      tl.play();
      setPlaying(true);
    } else {
      tl.pause();
      setPlaying(false);
    }
  };

  const seek = (label: string) => {
    const tl = timeline.current;
    if (!tl) return;
    tl.pause().seek(label);
    setPlaying(false);
  };

  const restart = () => {
    const tl = timeline.current;
    if (!tl) return;
    tl.restart();
    setPlaying(true);
  };

  return (
    <section
      ref={root}
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-rule rounded-panel bg-surface border p-5 lg:p-7"
    >
      <header className="max-w-prose">
        <h2 id={`${id}-title`} className="text-ink text-h1">
          {title}
        </h2>
        <p className="text-ink-muted mt-2 text-body">{lede}</p>
      </header>

      {reduced ? (
        <p className="text-ink-muted border-rule-strong mt-4 max-w-prose border-l-2 pl-3 text-small">
          Your system asks for reduced motion, so this scene is shown complete
          and still instead of playing. Nothing is missing — every step is on
          screen at once.
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className="border-rule-strong rounded-control text-ink hover:bg-surface-sunk focus-visible:ring-ring flex items-center gap-2 border px-3 py-1.5 text-small focus-visible:ring-2 focus-visible:outline-none"
          >
            <span aria-hidden className="text-measure">
              {playing ? "❚❚" : "▶"}
            </span>
            {playing ? "Pause" : current === 0 ? "Play" : "Continue"}
          </button>

          <button
            type="button"
            onClick={restart}
            className="text-ink-muted hover:text-ink rounded-control focus-visible:ring-ring px-1 text-small underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
          >
            Start again
          </button>

          {steps.length > 0 ? (
            <div className="flex items-center gap-1.5">
              {steps.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => seek(label)}
                  aria-label={`Go to step ${i + 1} of ${steps.length}`}
                  aria-current={i === current ? "step" : undefined}
                  className={cn(
                    "rounded-control focus-visible:ring-ring h-6 w-6 text-label tabular-nums focus-visible:ring-2 focus-visible:outline-none",
                    i === current
                      ? "bg-measure text-surface"
                      : "text-ink-muted hover:bg-surface-sunk",
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          ) : null}

          {/* Progress. Scaled by transform so it never triggers layout. */}
          <div
            className="bg-surface-sunk relative h-px min-w-24 flex-1 overflow-hidden"
            role="presentation"
          >
            <div
              ref={bar}
              className="bg-measure absolute inset-0 origin-left"
              style={{ transform: "scaleX(0)" }}
            />
          </div>
        </div>
      )}

      <div className="mt-6">{children}</div>
    </section>
  );
}
