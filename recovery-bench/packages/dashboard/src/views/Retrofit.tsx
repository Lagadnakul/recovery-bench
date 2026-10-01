/**
 * The retrofit, on `django__django-11620`. ARCHITECTURE §7's view 6.
 *
 * This is the five-second version of the thesis. The same model, the same task,
 * the same recovery conditions — and the only thing that changed was the format
 * it was asked to write the edit in. Against the committed audit:
 *
 *     unified_diff     4 attempts, 4 structural defects, 3 never named a file
 *     search_replace   3 attempts, 0 defects,            3 named the file
 *
 * Those counts are rendered from the data, never typed into the markup, so this
 * comment is the only place they can go stale — and the numbers above were in
 * fact wrong when first written, which is why they are now quoted from a run.
 *
 * No test ran in either column. That is the finding, not a limitation of it:
 * the unified-diff attempts were rejected before any test could run, so nobody
 * ever learned whether the fix was right. A recovery study that counts those as
 * "did not recover" is measuring the harness.
 *
 * The data is `legacy_patch_audit.json`, committed, derived by
 * `validateDiff()` from structural defects detectable without the source file.
 * The patch bodies are not committed, so this view shows what the audit knows —
 * the defect and its explanation — rather than inventing a diff to display.
 */

import type { AuditFile, AuditRow } from "../model/load.ts";
import { Empty, Pill } from "../ui/primitives.tsx";

const TASK = "django__django-11620";

/** `gemini-3.6-flash-blindretry-attempt2` → `blindretry, attempt2`. */
function condition(model: string): string {
  const tail = model.replace(/^gemini-[\d.]+-flash-?/, "");
  return tail.replace(/-/g, " ").replace(/\bv2 searchreplace\b/, "v2").trim() || "baseline";
}

function Column({
  era,
  rows,
  title,
  verdict,
  tone,
}: {
  era: string;
  rows: AuditRow[];
  title: string;
  verdict: string;
  tone: "good" | "format";
}) {
  const colour = tone === "good" ? "var(--st-good)" : "var(--st-format-2)";
  return (
    <div className="rounded-panel border border-rule">
      <header
        className="flex items-baseline gap-2 rounded-t-panel border-b border-rule px-3 py-2"
        style={{ background: tone === "good" ? "var(--accent-soft)" : "var(--format-soft)" }}
      >
        <h3 className="mono text-[14px]">{era}</h3>
        <span className="ml-auto text-[13px] font-bold" style={{ color: colour }}>
          {verdict}
        </span>
      </header>
      <div className="px-3 py-2">
        <p className="t-caption mt-0 mb-3">{title}</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((r) => (
            <li key={r.file} className="border-t border-rule pt-2 first:border-t-0 first:pt-0">
              <p className="m-0 text-[14px] font-semibold">{condition(r.model)}</p>
              <p className="mt-0.5 mb-0 text-[12px] text-ink-faint">
                {r.chars} chars, {r.hunks} {r.hunks === 1 ? "hunk" : "hunks"}, target{" "}
                {r.files.length === 0 ? (
                  <strong style={{ color: "var(--st-format-2)" }}>none named</strong>
                ) : (
                  <code>{r.files.join(", ")}</code>
                )}
              </p>
              {r.reasons.length === 0 ? (
                <p className="mt-1.5 mb-0 text-[12px]" style={{ color: "var(--st-good)" }}>
                  no structural defect
                </p>
              ) : (
                r.details.map((d, i) => (
                  <p
                    key={r.reasons[i] ?? i}
                    className="mt-1.5 mb-0 text-[12px]"
                    style={{ color: "var(--st-format-2)" }}
                  >
                    <Pill tone="format">{r.reasons[i]}</Pill> {d}
                  </p>
                ))
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Retrofit({ audit }: { audit: AuditFile }) {
  const mine = audit.rows.filter((r) => r.instanceId === TASK);
  const diff = mine.filter((r) => r.era === "unified_diff");
  const sr = mine.filter((r) => r.era === "search_replace");

  if (diff.length === 0 || sr.length === 0) {
    return (
      <Empty
        heading="The audit has no paired attempts for this task"
        detail={`${TASK} needs both a unified_diff and a search_replace era in legacy_patch_audit.json. Rebuild it with: bun run audit-legacy`}
      />
    );
  }

  const byEra = audit.totals.by_era;
  const d = byEra["unified_diff"];
  const s = byEra["search_replace"];

  return (
    <div>
      <p className="m-0 mb-4 text-[15px]">
        Same model, same task, same conditions. The format of the edit was the only
        thing that changed.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <Column
          era="unified_diff"
          rows={diff}
          title="What the original study asked for."
          verdict={`${diff.filter((r) => r.reasons.length > 0).length} of ${diff.length} defective`}
          tone="format"
        />
        <Column
          era="search_replace"
          rows={sr}
          title="What the retrofit asked for instead."
          verdict={`${sr.filter((r) => r.reasons.length === 0).length} of ${sr.length} clean`}
          tone="good"
        />
      </div>

      {d !== undefined && s !== undefined && (
        <p className="t-caption mt-4 mb-0">
          Across the whole archive, not just this task: {d.clean} of {d.patches} unified
          diffs were structurally clean ({d.cleanPct}%), against {s.clean} of {s.patches}{" "}
          search/replace patches ({s.cleanPct}%). No test ran on either side of this
          comparison &mdash; the defective patches were rejected before one could.
        </p>
      )}
    </div>
  );
}
