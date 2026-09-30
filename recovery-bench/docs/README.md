# recovery-bench — design documents

Read in this order.

| # | Document | What it settles |
| --- | --- | --- |
| 1 | [DECISIONS.md](DECISIONS.md) | every decision taken, with the evidence — D0 to D12 |
| 2 | [ARCHITECTURE.md](ARCHITECTURE.md) | the seven layers, the cell/queue model, the no-Docker change |
| 3 | [CONFIG.md](CONFIG.md) | every knob, and the 1,296-cell grid written out |
| 4 | [BUDGET.md](BUDGET.md) | token arithmetic per arm, per provider, against each free quota |

Worked configuration: [`../configs/base.yaml`](../configs/base.yaml).

**Stack:** TypeScript on Bun · zod · openai + @google/genai · jsdiff · plain git ·
Vite + React + Tailwind dashboard. Bun workspaces: `core` / `pipeline` /
`dashboard`. See D10 and D11.

**Status:** design only. No code has been written.

**Three standing constraints.**
Docker is not used anywhere (D6). API key *values* are never read into this
repository — only variable names (D3). `Self.docx` is submitted and is never
edited.
