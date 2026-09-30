/**
 * The config schema is a research instrument, not plumbing: it is what stops the
 * original's defects from recurring. These tests assert that each defect is
 * rejected, using the defect itself as the fixture.
 */

import { test, expect, describe } from "bun:test";
import { parse as parseYaml } from "yaml";
import { ConfigSchema, hashConfig, loadConfig } from "../packages/core/config.ts";

/** A minimal config that parses. Tests mutate one thing at a time. */
const good = () =>
  parseYaml(`
run:
  name: t
providers:
  nv:
    kind: openai_compat
    base_url: https://integrate.api.nvidia.com/v1
    api_key_env: [NVIDIA_KEY_1]
models:
  m30:
    provider: nv
    model: meta/muse-glimmer-30b
    temperature: 0.0
    top_p: 1.0
    max_tokens: 8192
    thinking: false
tasks:
  dataset: princeton-nlp/SWE-bench_Lite
  revision: 6ec7bb89b9342f664a54a6e0a6ea6501d3437cc2
  expected_rows: 300
  pool:
    selection: explicit
    ids: [django__django-11019]
  context:
    mode: symbol
edit:
  formats: [search_replace]
verify:
  backend: git_apply
budget:
  nv:
    max_tokens: 1000
    max_calls: 10
grid:
  a1:
    models: [m30]
    tasks: pool
    strategies: [l1_blind_retry]
    edit_formats: [search_replace]
`) as Record<string, any>;

const parse = (c: unknown) => ConfigSchema.safeParse(c);
const messages = (c: unknown) => {
  const r = parse(c);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("the baseline fixture is valid", () => {
  test("parses", () => {
    const r = parse(good());
    expect(r.success).toBe(true);
  });

  test("maps snake_case YAML to camelCase TypeScript", () => {
    const c = parse(good());
    if (!c.success) throw new Error(messages(good()).join("\n"));
    expect(c.data.models.m30!.topP).toBe(1.0);
    expect(c.data.models.m30!.maxTokens).toBe(8192);
    expect(c.data.tasks.expectedRows).toBe(300);
    expect(c.data.grid.a1!.editFormats).toEqual(["search_replace"]);
    expect(c.data.run.dryRun).toBe(false);
  });

  test("defaults the pinned seed rather than leaving it unset", () => {
    const c = parse(good());
    if (!c.success) throw new Error("fixture invalid");
    expect(c.data.run.seed).toBe(20260926);
  });
});

describe("the original's defects are rejected", () => {
  test("omitting temperature fails — sampling was never pinned (D0)", () => {
    const c = good();
    delete c.models.m30.temperature;
    expect(messages(c).join()).toContain("models.m30.temperature");
  });

  test("omitting top_p fails", () => {
    const c = good();
    delete c.models.m30.top_p;
    expect(messages(c).join()).toContain("models.m30.top_p");
  });

  test("a model naming a provider that does not exist fails", () => {
    const c = good();
    c.models.m30.provider = "nope";
    expect(messages(c).join()).toContain('unknown provider "nope"');
  });

  test("an arm naming a model that does not exist fails", () => {
    const c = good();
    c.grid.a1.models = ["ghost"];
    expect(messages(c).join()).toContain('unknown model "ghost"');
  });

  test("an arm naming a task set that does not exist fails", () => {
    const c = good();
    c.grid.a1.tasks = "missing_pool";
    expect(messages(c).join()).toContain('unknown task set "missing_pool"');
  });

  test("an openai_compat provider without base_url fails", () => {
    const c = good();
    delete c.providers.nv.base_url;
    expect(messages(c).join()).toContain("base_url");
  });

  test("a real key value in api_key_env is rejected, not stored", () => {
    const c = good();
    c.providers.nv.api_key_env = ["nvapi-abc123-def456"];
    expect(messages(c).join()).toContain("NAMES, not key values");
  });

  test("explicit selection with no ids fails", () => {
    const c = good();
    c.tasks.pool = { selection: "explicit", ids: [] };
    expect(() => ConfigSchema.parse(c)).toThrow(/explicit requires ids/);
  });

  test("stratified selection with no n fails", () => {
    const c = good();
    c.tasks.pool = { selection: "stratified", per_repo_min: 3 };
    expect(() => ConfigSchema.parse(c)).toThrow(/stratified requires n/);
  });
});

describe("D6 — no Docker, enforced by the type", () => {
  test("git_apply is the only accepted verify backend", () => {
    const c = good();
    c.verify.backend = "docker";
    expect(messages(c).join()).toContain("verify.backend");
  });
});

describe("D5 — thinking is a validity control, not a flag", () => {
  test("a reasoning_budget nothing ever uses is rejected", () => {
    const c = good();
    c.models.m30.reasoning_budget = 4096; // thinking: false, and no arm toggles it
    expect(messages(c).join()).toContain("nothing ever thinks with this model");
  });

  test("a reasoning_budget IS allowed when an arm turns thinking on", () => {
    const c = good();
    c.models.m30.reasoning_budget = 4096;
    c.grid.a1.thinking = [false, true];
    expect(parse(c).success).toBe(true);
  });

  test("an arm that only ever thinks is rejected — nothing to compare against", () => {
    const c = good();
    c.grid.a1.thinking = [true];
    expect(messages(c).join()).toContain("cannot be compared");
  });
});

describe("YAML traps", () => {
  test("underscore numerals are strings in YAML 1.2, and must not pass silently", () => {
    // `max_tokens: 8_000_000` parses as the STRING "8_000_000". Left uncaught it
    // would have capped the NVIDIA budget at nothing. base.yaml carries a comment.
    const c = good();
    c.budget.nv.max_tokens = "8_000_000";
    expect(() => ConfigSchema.parse(c)).toThrow(/max_tokens/);
  });
});

describe("config hashing", () => {
  test("the hash is stable for identical text", () => {
    expect(hashConfig("a: 1\n")).toBe(hashConfig("a: 1\n"));
  });

  test("a comment change is a different config", () => {
    // Deliberate: base.yaml's comments record which models were dropped and why,
    // and that is part of the experimental record.
    expect(hashConfig("a: 1\n")).not.toBe(hashConfig("a: 1 # dropped glm-flash\n"));
  });

  test("the hash is short enough to paste into a run id", () => {
    expect(hashConfig("a: 1\n")).toHaveLength(16);
  });
});

describe("the shipped config", () => {
  test("configs/base.yaml is valid and has the expected shape", async () => {
    const { config, hash } = await loadConfig("configs/base.yaml");
    expect(hash).toHaveLength(16);
    expect(config.verify.backend).toBe("git_apply");
    expect(Object.keys(config.grid).length).toBeGreaterThanOrEqual(6);
    // Every model pins sampling — the single defect that most damaged the original.
    for (const [id, m] of Object.entries(config.models)) {
      expect(typeof m.temperature, id).toBe("number");
      expect(typeof m.topP, id).toBe("number");
    }
    // No key values anywhere in the file.
    const raw = await Bun.file("configs/base.yaml").text();
    expect(raw).not.toMatch(/nvapi-|sk-[A-Za-z0-9]{16}|AIza[A-Za-z0-9]{20}/);
  });
});
