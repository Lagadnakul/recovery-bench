/**
 * The palette gate, as a test as well as a build step.
 *
 * `scripts/check_contrast.ts` runs before the build and exits non-zero. Running
 * it here too means a palette regression fails `bun test` on a machine that
 * never builds the dashboard — and the contrast arithmetic itself gets checked
 * against values whose ratios are known independently.
 */

import { describe, expect, test } from "bun:test";
import {
  check,
  contrast,
  luminance,
  parseBlock,
  parseHex,
} from "../packages/dashboard/scripts/check_contrast.ts";

describe("the contrast arithmetic", () => {
  test("hex parses in both lengths", () => {
    expect(parseHex("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex("000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHex("#A8521A")).toEqual({ r: 168, g: 82, b: 26 });
  });

  test("a value that is not a colour throws rather than becoming black", () => {
    expect(() => parseHex("#gggggg")).toThrow();
    expect(() => parseHex("rgb(0,0,0)")).toThrow();
  });

  test("luminance hits its known endpoints", () => {
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
    expect(luminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
  });

  test("black on white is 21:1, the WCAG maximum", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });

  test("a colour against itself is 1:1", () => {
    expect(contrast("#1a6b66", "#1a6b66")).toBeCloseTo(1, 5);
  });

  test("order does not matter", () => {
    expect(contrast("#16202a", "#f3f5f6")).toBeCloseTo(contrast("#f3f5f6", "#16202a"), 10);
  });
});

describe("parsing tokens.css", () => {
  const css = `
    :root {
      --paper: #f3f5f6;
      --ink: #16202a;
      --not-a-colour: var(--paper);
    }
    :root[data-theme="dark"] { --paper: #0f1720; }
  `;

  test("declarations are read out of the right block", () => {
    const light = parseBlock(css, ":root {");
    expect(light["--paper"]).toBe("#f3f5f6");
    expect(light["--ink"]).toBe("#16202a");
  });

  test("non-colour declarations are left out rather than guessed at", () => {
    expect(parseBlock(css, ":root {")["--not-a-colour"]).toBeUndefined();
  });

  test("a selector that is not there throws, so a renamed block cannot skip checks", () => {
    expect(() => parseBlock(css, ":root[data-theme=\"sepia\"]")).toThrow();
  });
});

describe("the real palette", () => {
  test("every pair passes in light and dark", async () => {
    const { failures, checked } = await check();
    // Printed rather than just asserted, so a failure names itself.
    if (failures.length > 0) {
      const lines = failures.map(
        (f) =>
          `${f.mode} ${f.fg} on ${f.bg} = ${f.ratio.toFixed(2)}:1 (need ${f.min}:1) — ${f.what}`,
      );
      throw new Error(`palette failures:\n${lines.join("\n")}`);
    }
    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(40);
  });
});
