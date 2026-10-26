/**
 * Contrast gate.
 *
 * Reads the colour tokens out of src/app/globals.css -- the file that actually
 * ships -- rather than a duplicated list, so the check cannot drift away from
 * the design. Converts OKLCH to linear sRGB, computes WCAG relative luminance,
 * and asserts every pair that the design puts on screen together.
 *
 *   bun run contrast
 *
 * Exits non-zero on any failure, so it can gate the build.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// import.meta.url rather than Bun's import.meta.dir, so the script also
// typechecks under plain tsc without pulling in bun-types.
const CSS = fileURLToPath(new URL("../src/app/globals.css", import.meta.url));

type Oklch = { l: number; c: number; h: number };

/** oklch(44% 0.17 232) and oklch(1 0 0) both parse. */
function parseOklch(raw: string): Oklch | null {
  const m = raw.match(
    /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*[\d.%]+\s*)?\)/i,
  );
  if (!m) return null;
  const [, lRaw, pct, cRaw, hRaw] = m;
  const l = Number(lRaw) / (pct === "%" ? 100 : 1);
  return { l, c: Number(cRaw), h: Number(hRaw) };
}

/**
 * OKLCH -> linear sRGB, per the Oklab specification. Values are returned
 * unclamped so that out-of-gamut tokens can be reported rather than silently
 * rounded into range.
 */
function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;

  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

/** WCAG 2.1 relative luminance. Linear sRGB is already what the formula wants. */
function luminance(token: Oklch): number {
  const [r, g, b] = oklchToLinearSrgb(token).map((v) =>
    Math.min(1, Math.max(0, v)),
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg: Oklch, bg: Oklch): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function outOfGamut(token: Oklch): boolean {
  return oklchToLinearSrgb(token).some((v) => v < -0.001 || v > 1.001);
}

// ── read the tokens ────────────────────────────────────────────────────────
const css = readFileSync(CSS, "utf8");
const tokens = new Map<string, Oklch>();
for (const [, name, value] of css.matchAll(
  /--color-([a-z0-9-]+):\s*(oklch\([^)]*\))/gi,
)) {
  const parsed = parseOklch(value);
  if (parsed) tokens.set(name, parsed);
}

if (tokens.size === 0) {
  console.error(
    "contrast: no --color-* oklch tokens found in globals.css.\n" +
      "Either the file moved or the tokens stopped being literal oklch() values.",
  );
  process.exit(1);
}

const t = (name: string): Oklch => {
  const v = tokens.get(name);
  if (!v) {
    console.error(`contrast: token --color-${name} is missing from globals.css`);
    process.exit(1);
  }
  return v;
};

// ── the pairs the design actually puts on screen ───────────────────────────
// `min` is the WCAG threshold for that pair's role:
//   4.5  body text and anything under 18.66px
//   3    large text (>=24px, or >=18.66px bold) and UI component boundaries
type Pair = { fg: string; bg: string; min: number; role: string };

const BACKGROUNDS = ["canvas", "surface", "surface-sunk"];

const pairs: Pair[] = [
  // Text on every surface it can land on.
  ...BACKGROUNDS.flatMap((bg) => [
    { fg: "ink", bg, min: 4.5, role: "body text" },
    { fg: "ink-muted", bg, min: 4.5, role: "secondary text" },
    { fg: "measure", bg, min: 4.5, role: "measured value" },
  ]),

  // Borders and rules are UI boundaries, so 3:1.
  ...BACKGROUNDS.map((bg) => ({
    fg: "rule-strong",
    bg,
    min: 3,
    role: "input border",
  })),

  // The accent's own wash has to hold its text.
  { fg: "measure", bg: "measure-wash", min: 4.5, role: "accent on wash" },
  { fg: "ink", bg: "measure-wash", min: 4.5, role: "text on wash" },

  // The two failure classes. They separate by VALUE so they survive greyscale,
  // and each has to be legible as a filled mark against the canvas.
  { fg: "class-format", bg: "canvas", min: 3, role: "FORMAT mark" },
  { fg: "class-logic", bg: "canvas", min: 3, role: "LOGIC mark" },
  { fg: "class-logic", bg: "class-format", min: 3, role: "the two classes apart" },

  // Focus ring against everything it can sit on.
  ...BACKGROUNDS.map((bg) => ({
    fg: "ring",
    bg,
    min: 3,
    role: "focus ring",
  })),
];

// `--color-ring` is an inline alias for measure; resolve aliases by name.
const ALIAS: Record<string, string> = { ring: "measure" };
const resolve = (name: string) => t(ALIAS[name] ?? name);

// ── report ─────────────────────────────────────────────────────────────────
let failures = 0;
let gamutFailures = 0;

for (const [name, token] of tokens) {
  if (outOfGamut(token)) {
    console.error(`  GAMUT  --color-${name} is outside sRGB`);
    gamutFailures++;
  }
}

const lines: string[] = [];
for (const { fg, bg, min, role } of pairs) {
  const r = ratio(resolve(fg), resolve(bg));
  const pass = r >= min;
  if (!pass) failures++;
  lines.push(
    `  ${pass ? "pass" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  ` +
      `need ${min.toFixed(1)}  ${fg} on ${bg}  — ${role}`,
  );
}

console.log(`contrast — ${pairs.length} pair(s), ${tokens.size} token(s)\n`);
console.log(lines.join("\n"));

// Greyscale separation for the two classes: the whole reason they are not two
// hues. Luminance difference, not contrast ratio, is what a printer sees.
const fmtL = luminance(t("class-format"));
const logL = luminance(t("class-logic"));
const greyDelta = Math.abs(fmtL - logL);
const GREY_MIN = 0.18;
const greyPass = greyDelta >= GREY_MIN;
if (!greyPass) failures++;
console.log(
  `\n  ${greyPass ? "pass" : "FAIL"}  greyscale separation of the two classes: ` +
    `${greyDelta.toFixed(3)} (need ${GREY_MIN})`,
);

if (failures || gamutFailures) {
  console.error(
    `\n${failures} contrast failure(s), ${gamutFailures} gamut failure(s)`,
  );
  process.exit(1);
}
console.log(`\nall ${pairs.length} pairs pass, every token in gamut`);
