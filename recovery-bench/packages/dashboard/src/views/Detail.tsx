/**
 * One cell, in full.
 *
 * This is where the raw enum name finally appears. Everywhere else the
 * interface says "patch never applied"; here it also says `APPLY_FAIL`, because
 * a reader who is cross-checking against `sweep_rows.jsonl` with `jq` needs the
 * token that is actually in the file.
 *
 * The provenance fields are shown even when they are dull. `evidenceSource:
 * "none"` on a Diagnose+Revise cell is the record of a refusal — the condition
 * could not run because the previous attempt applied cleanly and there was no
 * apply error to show it, and without Docker there is no test output either
 * (D22). A dashboard that hid that field would make the refusal invisible,
 * which is the whole failure mode this project was built against.
 */

import { isInstrumentLimit } from "@rb/core";
import type { ViewRow } from "../model/rows.ts";
import { reasonOf, statusOf } from "../model/status.ts";
import { Pill } from "../ui/primitives.tsx";

const EVIDENCE_NOTE: Record<string, string> = {
  archived_test: "real test output from the archive — comparable with Chapter 5",
  apply_error: "the apply error git actually printed; not test output",
  none: "no evidence was available, so this condition refused to run",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[108px_1fr] gap-2 border-b border-rule py-1.5 last:border-b-0">
      <dt className="text-[12px] text-ink-faint">{label}</dt>
      <dd className="m-0 text-[13px] break-words">{children}</dd>
    </div>
  );
}

export function Detail({ row, onClose }: { row: ViewRow; onClose: () => void }) {
  const s = statusOf(row.outcomeKind);
  const limit = isInstrumentLimit(row.outcome);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <div>
          <p className="m-0 text-[17px] font-bold" style={{ color: `var(${s.token})` }}>
            {s.label}
          </p>
          <p className="t-caption mt-1 mb-0">{reasonOf(row.outcome)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cell details"
          className="ml-auto grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-control border border-edge bg-surface text-ink-soft"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      {limit && (
        <p
          className="m-0 rounded-control px-3 py-2 text-[13px] leading-snug"
          style={{ background: "var(--surface-2)", color: "var(--ink-soft)" }}
        >
          This cell measured nothing about the model. It is excluded from both failure
          classes and from every rate on this page.
        </p>
      )}

      <dl className="m-0">
        <Field label="cell key">
          <code className="text-[11px]">{row.id}</code>
        </Field>
        <Field label="outcome">
          <code>{row.outcomeKind}</code>
        </Field>
        <Field label="task">
          <code>{row.taskId}</code>
        </Field>
        <Field label="condition">
          {row.conditionLabel} <code className="text-[11px] text-ink-faint">{row.strategy}</code>
        </Field>
        <Field label="round">R{row.round}</Field>
        {row.model !== null && <Field label="model">{row.model}</Field>}
        {row.editFormat !== null && (
          <Field label="edit format">
            <code>{row.editFormat}</code>
          </Field>
        )}
        {row.thinking !== null && (
          <Field label="thinking">{row.thinking ? "enabled" : "disabled"}</Field>
        )}
        {row.arm !== null && <Field label="arm">{row.arm}</Field>}
        {row.run !== null && <Field label="legacy run">{row.run}</Field>}
        <Field label="verified by">
          {row.verification === "test" ? "running the tests" : "applying the patch only"}
        </Field>
        <Field label="resolved">
          {row.resolved === null ? (
            <span className="text-ink-faint">
              unknown &mdash; not test-verified, and never inferred
            </span>
          ) : row.resolved ? (
            "yes"
          ) : (
            "no"
          )}
        </Field>
        {row.tests !== null && (
          <Field label="tests">
            FAIL_TO_PASS {row.tests.f2pPassed}/{row.tests.f2pTotal} &middot; PASS_TO_PASS{" "}
            {row.tests.p2pPassed}/{row.tests.p2pTotal}
          </Field>
        )}
        {row.evidenceSource !== null && (
          <Field label="evidence">
            <code>{row.evidenceSource}</code>
            <span className="block text-[11px] text-ink-faint">
              {EVIDENCE_NOTE[row.evidenceSource]}
            </span>
          </Field>
        )}
        <Field label="comparable">
          {row.comparableToChapter5 ? (
            "poolable with Chapter 5"
          ) : (
            <Pill tone="format">must not be pooled with Chapter 5</Pill>
          )}
        </Field>
        {row.honouredCondition !== null && (
          <Field label="honoured">
            {row.honouredCondition
              ? "the response contained the reasoning section its condition demanded"
              : "the response omitted the reasoning section its condition demanded"}
          </Field>
        )}
        <Field label="recorded">{row.timestamp}</Field>
      </dl>

      {row.patch !== null && row.patch !== "" && (
        <details>
          <summary className="cursor-pointer text-[13px] font-bold">
            Patch ({row.patch.length.toLocaleString()} chars)
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded-control bg-surface-2 p-2 text-[11px] whitespace-pre-wrap">
            {row.patch}
          </pre>
        </details>
      )}

      {row.response !== null && row.response !== "" && (
        <details>
          <summary className="cursor-pointer text-[13px] font-bold">
            Full response ({row.response.length.toLocaleString()} chars)
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded-control bg-surface-2 p-2 text-[11px] whitespace-pre-wrap">
            {row.response}
          </pre>
        </details>
      )}

      {row.source === "replay" && (
        <p className="t-caption m-0">
          Replayed from the archive. The archive kept the outcome and the git error but
          not the patch or the response, so those fields are absent rather than empty.
        </p>
      )}
    </div>
  );
}
