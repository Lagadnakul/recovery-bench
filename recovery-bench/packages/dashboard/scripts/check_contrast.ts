/**
 * The palette gate. Exits non-zero, so the build cannot ship an illegible pair.
 *
 * ARCHITECTURE §7 requires the palette be "validated by script in light and
 * dark mode before any chart ships, never judged by eye". This is that script.
 * It reads `src/tokens.css` as the single source of truth — it does not keep a
 * second copy of the hex values, because a second copy is a second thing to
 * drift.
 *
 * Three classes of check:
 *
 *   TEXT         >= 4.5:1  (WCAG 1.4.3 AA, normal-size text)
 *   NON-TEXT     >= 3.0:1  (WCAG 1.4.11, grid fills and control boundaries)
 *   DUPLICATION  the two dark-mode blocks must be byte-identical
 *
 * The third is not an accessibility rule. `tokens.css` declares dark mode twice
 * — once under `prefers-color-scheme` and once under `[data-theme="dark"]` —
 * because a manual theme toggle has to beat the system preference. Those two
 * lists are maintained by hand and nothing else would notice them disagreeing.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { STATUS } from "../src/model/status.ts";

const TOKENS = resolve(import.meta.dirname, "../src/tokens.css");

const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3.0;

// --------------------------------------------------------------------- colour

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb {
  const h = hex.trim().replace(/^#/, "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`not a hex colour: ${hex}`);
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG 2.x relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  const f = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(parseHex(a));
  const lb = luminance(parseHex(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// --------------------------------------------------------------------- parsing

export type Tokens = Record<string, string>;

/**
 * Pulls `--name: #value;` declarations out of one brace-delimited block.
 *
 * The brace is located by scanning forward over whitespace only, and a match
 * where anything else intervenes is rejected and the search continues. Both
 * halves of that matter:
 *
 *   - `:root` is a prefix of `:root[data-theme="dark"]`, so a plain `indexOf`
 *     can match the wrong rule. Requiring `{` next rules the prefix out.
 *   - An earlier version took the selector with its brace already attached and
 *     then searched for `{` *after* it, which landed on the following block's
 *     brace. Every "light" check silently ran against the dark values, and the
 *     gate stayed green because both themes pass. Found by
 *     `tests/dashboardPalette.test.ts`.
 */
export function parseBlock(css: string, selector: string): Tokens {
  const needle = selector.replace(/\s*\{\s*$/, "");

  let at = -1;
  let open = -1;
  for (let from = 0; ; ) {
    at = css.indexOf(needle, from);
    if (at === -1) throw new Error(`selector not found in tokens.css: ${selector}`);
    let i = at + needle.length;
    while (i < css.length && /\s/.test(css[i] as string)) i++;
    if (css[i] === "{") {
      open = i;
      break;
    }
    // A longer selector that merely starts with this one. Keep looking.
    from = at + needle.length;
  }
  if (open === -1) throw new Error(`no block after ${selector}`);

  let depth = 0;
  let end = -1;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error(`unclosed block after ${selector}`);

  const body = css.slice(open + 1, end);
  const out: Tokens = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[m[1] as string] = (m[2] as string).toLowerCase();
  }
  return out;
}

// ---------------------------------------------------------------------- checks

interface Check {
  fg: string;
  bg: string;
  min: number;
  what: string;
}

/** Text pairs that actually occur in the interface. */
function textChecks(): Check[] {
  const onSurfaces = (fg: string, what: string): Check[] =>
    ["--paper", "--surface", "--surface-2"].map((bg) => ({
      fg,
      bg,
      min: TEXT_MIN,
      what,
    }));

  return [
    ...onSurfaces("--ink", "body text"),
    ...onSurfaces("--ink-soft", "secondary text"),
    ...onSurfaces("--ink-faint", "labels and axis ticks"),
    ...onSurfaces("--accent", "links and controls"),
    ...onSurfaces("--accent-ink", "control text"),
    { fg: "--format", bg: "--format-soft", min: TEXT_MIN, what: "format-class badge" },
    { fg: "--logic", bg: "--logic-soft", min: TEXT_MIN, what: "logic-class badge" },
    // The two headline cards are filled with the hue of the class they report.
    { fg: "--format-ink", bg: "--format-soft", min: TEXT_MIN, what: "format headline card" },
    { fg: "--logic-ink", bg: "--logic-soft", min: TEXT_MIN, what: "logic headline card" },
    { fg: "--accent-ink", bg: "--accent-soft", min: TEXT_MIN, what: "tinted panel header" },
    // The hero band, in both of its stops — a gradient has to be legible at
    // either end, not just where the text happens to start.
    ...["--hero", "--hero-2"].map((bg) => ({
      fg: "--on-hero",
      bg,
      min: TEXT_MIN,
      what: "hero headline",
    })),
    ...["--hero", "--hero-2"].map((bg) => ({
      fg: "--on-hero-soft",
      bg,
      min: TEXT_MIN,
      what: "hero supporting text",
    })),
    { fg: "--on-accent", bg: "--accent", min: TEXT_MIN, what: "primary control" },
    // Panel body text on a tinted header's surface.
    { fg: "--ink", bg: "--surface-3", min: TEXT_MIN, what: "panel header text" },
    { fg: "--ink-soft", bg: "--surface-3", min: TEXT_MIN, what: "panel header caption" },
    // Glyphs drawn on a status fill — the grid's only text-on-colour.
    //
    // The pairs come from `STATUS` itself rather than being listed here, so
    // this checks what the grid actually draws. A new outcome, or a fill moved
    // from the white glyph to the ink one, is covered without touching this
    // file. Assuming white everywhere is what hid two failures earlier.
    ...Object.values(STATUS).map((s) => ({
      fg: s.onToken,
      bg: s.token,
      min: TEXT_MIN,
      what: `${s.kind} cell glyph`,
    })),
  ];
}

/** Fills and boundaries, which carry meaning but no text. */
function nonTextChecks(): Check[] {
  // Distinct fills, derived — the three instrument limits share one token.
  const fills = [...new Set(Object.values(STATUS).map((s) => s.token))];
  return [
    ...fills.map((fg) => ({
      fg,
      bg: "--surface",
      min: NON_TEXT_MIN,
      what: "grid fill against the panel",
    })),
    // Control boundaries, on both backgrounds a control can sit on.
    ...["--surface", "--paper"].map((bg) => ({
      fg: "--edge",
      bg,
      min: NON_TEXT_MIN,
      what: "control boundary",
    })),
    ...["--surface", "--paper"].map((bg) => ({
      fg: "--accent",
      bg,
      min: NON_TEXT_MIN,
      what: "focus ring",
    })),
  ];
  // `--rule` and `--rule-strong` are exempt by design: a hairline between rows
  // of a table is decoration, not a control boundary, and WCAG 1.4.11 does not
  // cover it. Every control that needs an edge uses `--edge`, checked above.
  // That split exists because this script failed on `--rule-strong` the first
  // time it ran, at 1.80:1.
}

interface Failure {
  mode: string;
  what: string;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
}

function run(mode: string, tokens: Tokens, checks: Check[]): Failure[] {
  const out: Failure[] = [];
  for (const c of checks) {
    const fg = tokens[c.fg];
    const bg = tokens[c.bg];
    if (fg === undefined) throw new Error(`${mode}: token ${c.fg} is not defined`);
    if (bg === undefined) throw new Error(`${mode}: token ${c.bg} is not defined`);
    const ratio = contrast(fg, bg);
    if (ratio < c.min) {
      out.push({ mode, what: c.what, fg: c.fg, bg: c.bg, ratio, min: c.min });
    }
  }
  return out;
}

export async function check(): Promise<{ failures: Failure[]; checked: number }> {
  const css = await readFile(TOKENS, "utf8");

  const light = parseBlock(css, ":root {");
  const darkAttr = parseBlock(css, ':root[data-theme="dark"]');
  const darkMedia = parseBlock(css, ':root:not([data-theme="light"])');

  const failures: Failure[] = [];

  // The two dark blocks are hand-maintained duplicates. Nothing else notices
  // them disagreeing, so this is checked first.
  const keys = new Set([...Object.keys(darkAttr), ...Object.keys(darkMedia)]);
  for (const k of [...keys].sort()) {
    const a = darkAttr[k];
    const b = darkMedia[k];
    if (a !== b) {
      failures.push({
        mode: "dark (duplication)",
        what: `${k} differs between the two dark blocks: ${a ?? "absent"} vs ${b ?? "absent"}`,
        fg: k,
        bg: k,
        ratio: 0,
        min: 0,
      });
    }
  }

  const checks = [...textChecks(), ...nonTextChecks()];
  failures.push(...run("light", light, checks));
  failures.push(...run("dark", darkAttr, checks));

  return { failures, checked: checks.length * 2 + keys.size };
}

if (import.meta.main) {
  const { failures, checked } = await check();
  if (failures.length === 0) {
    console.log(`  ok  ${checked} palette checks pass in light and dark`);
    process.exit(0);
  }
  console.error(`  FAIL  ${failures.length} of ${checked} palette checks\n`);
  for (const f of failures) {
    if (f.min === 0) {
      console.error(`  ${f.mode}  ${f.what}`);
      continue;
    }
    console.error(
      `  ${f.mode.padEnd(6)} ${f.ratio.toFixed(2)}:1 < ${f.min}:1  ` +
        `${f.fg} on ${f.bg}  (${f.what})`,
    );
  }
  console.error(
    "\n  Adjust src/tokens.css. Do not lower a threshold: the thresholds are\n" +
      "  WCAG 1.4.3 (4.5:1 text) and 1.4.11 (3:1 non-text).",
  );
  process.exit(1);
}
