# Setup

First time on a new machine. Takes about five minutes.

## 1. Clone and install

```sh
git clone git@github.com:AAYUSH412/Nakul-Research-paper.git
cd "Nakul-Research-paper/recovery-bench"
bun install
```

Bun: https://bun.sh — `curl -fsSL https://bun.sh/install | bash`

## 2. API keys

Nothing runs against a live model without these, but **everything offline works
without them** — `doctor`, `test`, `replay` and `report` all run with no key.

Copy the template and fill in your own values:

```sh
cp recovery-bench/.env.example .env.local
```

`.env.local` sits in the **project root**, not inside `recovery-bench/`, and is
gitignored. It holds:

| Variable | Where from |
|---|---|
| `NVIDIA_KEY_1` … `_3` | build.nvidia.com — a list enables the key pool |
| `qwen_api_key` | maas.qwencloudapi.com |
| `gemini_api_key` | Google AI Studio — needed for the replication arm |

**Never paste a key into a file that is not `.env.local`.** A key committed to a
private repository still survives being made public later, and survives forks.

Check it worked:

```sh
cd recovery-bench && bun run doctor
```

## 3. Agent skills

The shared skills live in `.agents/skills/` (committed, so both machines get the
same versions — `skills-lock.json` records the hashes). Claude Code reads them
from `.claude/skills/`, which is **not** committed because symlinks break on
Windows.

Make the links yourself, once:

**macOS / Linux**

```sh
mkdir -p .claude/skills
for s in .agents/skills/*/; do
  ln -sfn "../../$s" ".claude/skills/$(basename "$s")"
done
```

**Windows (PowerShell, as Administrator)**

```powershell
New-Item -ItemType Directory -Force .claude\skills
Get-ChildItem .agents\skills -Directory | ForEach-Object {
  New-Item -ItemType Junction -Path ".claude\skills\$($_.Name)" -Target $_.FullName -Force
}
```

If symlinks are a problem on Windows, copying the folders works just as well —
they are only read, never written.

## 4. Optional — the paper-writing skills

Used for the research paper, not for the code. It is a separate 70 MB repo with
its own git history, so it is deliberately **not** part of this project:

```sh
git clone https://github.com/Imbad0202/academic-research-skills.git ~/academic-research-skills
```

Then follow its `QUICKSTART.md` to link the five skills into whichever project
you are writing in.

---

## Working together without pushing constantly

Three tools, split by what is being edited:

| What | Tool | Why |
|---|---|---|
| **The paper** | **Overleaf** | Both people type in the same document at once. No push, no pull, no merge conflicts. IEEE templates built in. This is how papers are actually written |
| **The code** | This repo | Push at the end of a session. You will rarely touch the same file |
| **Live pairing** | VS Code Live Share | Share a link, both edit the same files on one machine, nothing pushed |

**Do not put this folder in Google Drive, iCloud or Dropbox.** They sync `.git/`
while git is writing to it and corrupt the repository. It is a well-known and
very painful failure.
