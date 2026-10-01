# recovery-bench — design documents

Read in this order.

| # | Document | What it settles |
| --- | --- | --- |
| 1 | [DECISIONS.md](DECISIONS.md) | every decision taken, with the evidence — D0 to D33 |
| 2 | [ARCHITECTURE.md](ARCHITECTURE.md) | the seven layers, the cell/queue model, the no-Docker change |
| 3 | [CONFIG.md](CONFIG.md) | every knob, and the full cell grid written out |
| 4 | [BUDGET.md](BUDGET.md) | token arithmetic per arm, per provider, against each free quota |
| 5 | [DASHBOARD.md](DASHBOARD.md) | the dashboard's design contract — palette, type, stack, and the four places the rendered page disagreed with it |

Worked configuration: [`../configs/base.yaml`](../configs/base.yaml).

**Stack:** TypeScript on Bun · zod · openai + @google/genai · jsdiff · plain git ·
Vite + React + Tailwind dashboard, no charting library (D29). Bun workspaces:
`core` / `pipeline` / `dashboard`. See D10 and D11.

Run the dashboard: `cd packages/dashboard && bun run dev`.

**Status:** steps 1-7 built — 433 tests, 127 palette checks. Step 8
(`l3_constrained`, `l4_tool_grounded`) is declared and not yet written.

**Three standing constraints.**
Docker is not used anywhere (D6). API key *values* are never read into this
repository — only variable names (D3). `Self.docx` is submitted and is never
edited.
