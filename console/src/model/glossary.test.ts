import { describe, expect, test } from "bun:test";
import { GLOSSARY, chanceInWords, strengthInWords } from "./glossary";
import { loadRows } from "./rows";
import { reflectionHarm, applyRateByFormat } from "./derive";

describe("the plain-language layer", () => {
  test("every definition is a complete, self-contained sentence", () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      expect(entry.term.length, key).toBeGreaterThan(2);
      expect(entry.plain.endsWith("."), key).toBe(true);
      expect(entry.plain.length, key).toBeGreaterThan(30);
    }
  });

  test("no definition explains a symbol with another symbol", () => {
    // A glossary that needs a glossary is decoration. Greek letters and the
    // single-letter payoff names are the ones that actually bite.
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      expect(entry.plain, key).not.toMatch(/[θλαβ]|p̂/);
    }
  });

  test("no definition uses the words that signal hand-waving", () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      expect(entry.plain.toLowerCase(), key).not.toMatch(
        /\b(simply|just|merely|obviously)\b/,
      );
    }
  });

  test("a term's name is never the symbol it is explaining", () => {
    // "θ: the threshold θ" would pass every other check here.
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      if (entry.symbol) expect(entry.term, key).not.toBe(entry.symbol);
    }
  });

  test("probabilities become odds a reader can picture", () => {
    expect(chanceInWords(1)).toBe("exactly what chance alone would produce");
    expect(chanceInWords(0.5)).toBe("about 1 in 2.0");
    expect(chanceInWords(0.001)).toBe("about 1 in 1,000");
    // Rounded to two significant figures: 1/3.8147e-6 is 262,144 exactly, and
    // printing that implies a precision the estimate does not have.
    expect(chanceInWords(3.814697265625e-6)).toBe("about 1 in 260,000");
    // The boundary either side, so the switch cannot drift unnoticed.
    expect(chanceInWords(1e-14)).toBe("about 1 in 100,000,000,000,000");
    expect(chanceInWords(1e-16)).toBe("about 1 in 10 followed by 16 zeros");
  });

  test("the two headline results read correctly in words", () => {
    const rows = loadRows();
    const harm = reflectionHarm(rows, "a3_capability");
    expect(chanceInWords(harm.p)).toBe("about 1 in 260,000");
    expect(strengthInWords(harm.p, harm.canReject)).toBe(
      "Luck is a very poor explanation for this",
    );

    // The format result is p = 7.4e-89. Spelled out as odds that is an
    // 89-digit number, which overflowed the page sideways and told the reader
    // nothing. Past 10^15 it switches to a power of ten.
    const format = applyRateByFormat(rows, "a5_format_at_scale").test;
    expect(chanceInWords(format.p)).toBe("about 1 in 10 followed by 88 zeros");
  });

  test("no phrase this function returns can break a layout", () => {
    // The actual defect: an unbreakable 89-digit figure with no spaces, which
    // browsers will not wrap on commas, widened every screen below it.
    for (const p of [1, 0.5, 0.05, 1e-3, 1e-6, 1e-20, 1e-100, 0]) {
      const words = chanceInWords(p);
      const longest = Math.max(...words.split(" ").map((w) => w.length));
      expect(longest, `chanceInWords(${p}) = "${words}"`).toBeLessThan(28);
    }
  });

  test("a result with too few pairs is never described as a null result", () => {
    // The distinction the whole screen 2 contrast rests on.
    expect(strengthInWords(1, false)).toBe(
      "Too few disagreeing pairs for this test to answer",
    );
    expect(strengthInWords(1, true)).toBe("This is what chance alone looks like");
  });

  test("a null result is not described as evidence of no difference", () => {
    const rows = loadRows();
    const flat = reflectionHarm(rows, "a2_workhorse");
    expect(flat.p).toBe(1);
    expect(strengthInWords(flat.p, flat.canReject)).toBe(
      "This is what chance alone looks like",
    );
  });
});
