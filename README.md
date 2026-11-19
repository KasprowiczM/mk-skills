# mk-skills

[English](README.md) · [Polski](README.pl.md)

A small collection of agent skills (`SKILL.md` folders) for Claude Code, Codex,
Antigravity and Cursor. One repository, one installer.

## Skills

| Skill | What it does | Status |
|---|---|---|
| [`mk-orkiestra`](skills/mk-orkiestra/SKILL.md) | Orchestrator mode: the session's model is the "boss" that plans and delegates work down a ladder of cheaper subagent models, then spot-checks the results. The goal: the same quality at a lower cost. | 0.1.0 |
| [`mk-ustrukturyzuj-prompt`](skills/mk-ustrukturyzuj-prompt/SKILL.md) | Turns rambling or dictated text into one short, well-structured prompt to review before sending. Also a macOS Quick Action and a shell script. | 0.1.0 |

Adding a skill later is one new folder under `skills/` plus one row above.

## Requirements

- macOS or Linux with `bash` (3.2 or newer). The installer needs nothing beyond
  standard tools (`cp`, `awk`, `mkdir`).
- At least one supported harness: Claude Code (CLI or desktop Code tab), Codex
  (CLI or ChatGPT/Codex desktop), Antigravity (IDE or `agy`), Cursor (IDE or
  `cursor-agent`). OpenCode is not supported.
- `mk-ustrukturyzuj-prompt` works in chat with nothing extra; its script and
  Quick Action need the Claude Code CLI installed and signed in (macOS for the
  Quick Action).
- `mk-orkiestra` needs a harness that can start subagents; without them it
  works alone. It acts only when you ask for it explicitly. Delegation is tested
  in Claude Code and Codex, untested in Cursor and Antigravity.

## Install

```bash
git clone https://github.com/KasprowiczM/mk-skills.git
cd mk-skills
bash install.sh --harness claude --skill all --dry-run   # preview
bash install.sh --harness claude --skill all             # install
```

Flags: `--harness <claude|codex|antigravity|cursor|all>`, `--skill <name|all>`,
`--dry-run` (change nothing), `--link` (symlink to this checkout instead of
copying, so `git pull` updates the skill), `--force` (replace an existing
folder; without it an existing folder is skipped). The installer prints what it
did and records it in `~/.mk-skills/manifest`. Start a new session afterwards.

### Where skills go, and how to invoke them

| Harness | User-level skill folder | Source | Invoke | `mk-orkiestra` delegation |
|---|---|---|---|---|
| Claude Code | `~/.claude/skills` | verified ([docs](https://code.claude.com/docs/en/skills)) | `/mk-orkiestra`, or automatically by description | tested |
| Codex | `~/.agents/skills` | verified ([docs](https://learn.chatgpt.com/docs/build-skills)) | `$mk-orkiestra` or `/skills` (CLI/IDE), `@` in ChatGPT, or automatically | tested |
| Antigravity | `~/.gemini/config/skills` | verified ([docs](https://antigravity.google/docs/skills)) | `/mk-orkiestra` (App and CLI), naming it in a message, or automatically | untested |
| Cursor | `~/.cursor/skills` | verified ([docs](https://cursor.com/docs/skills)) | type `/` in Agent chat and pick it, or automatically | untested |

Paths were checked against the official documentation on 2026-11-19. Docs change;
if a path stops working, open an issue. Notes:

- Cursor and Antigravity read subagent definitions from separate folders
  (`~/.cursor/agents`, `~/.gemini/config/agents`; docs:
  [Cursor](https://cursor.com/docs/subagents),
  [Antigravity](https://antigravity.google/docs/subagents)). `install.sh` copies
  the helper definitions of `mk-orkiestra` (`skills/mk-orkiestra/helpers/`) there. More in
  [docs/harnesses.md](docs/harnesses.md).
- Cursor also reads `~/.agents/skills`, `~/.claude/skills` and `~/.codex/skills`
  (and subagent definitions from `~/.claude/agents` and `~/.codex/agents`);
  install into one place only to avoid duplicates.
- Claude Code's personal skills folder is not read by Cowork or cloud sessions.

## Usage

- "Use mk-orkiestra: split this migration into assignments for cheaper models and
  check the results."
- "orkiestra: zleć to subagentom i sprawdź wyniki."
- "You are the boss, delegate the implementation, keep the cost down."

On first use the skill reads `ladders.toml`, finds your model's rung and
delegates only to cheaper rungs. The ladders are examples: check them against
your own model list and edit them (section 9 of
[`SKILL.md`](skills/mk-orkiestra/SKILL.md)).

### mk-ustrukturyzuj-prompt

Needs nothing in chat. The script and the Quick Action need the Claude Code CLI
(`claude`) installed and signed in; set `PROMPT_MASTER_MODEL` to change the model
(default `sonnet`; for the Quick Action use `--model`). On any problem (missing
CLI, error, timeout, empty answer) the script returns your text unchanged.

Before (a dictated draft):

> so I want like a script, uh, in python, that goes through all the csv files in
> a folder, no wait, in a folder and its subfolders, and merges them into one
> file, and it should drop the duplicate rows, and the output file is called
> merged.csv, and make sure it does not choke on big files

After:

```
## Goal
Merge many CSV files into one deduplicated file.

## Task
Write a Python script that:
1. Finds all CSV files in a folder and its subfolders.
2. Merges them into one file named `merged.csv`.
3. Drops duplicate rows.

## Requirements and constraints
- It must handle large files without running out of memory.

## Open questions
- Do all files share the same columns?
```

Three ways to use it:

1. **In chat, by name:** "ustrukturyzuj prompt: <your draft>". The agent replies
   with the structured prompt only; correct it, then say "go" / "wykonaj".
2. **macOS Quick Action** (select text in any app, it replaces the selection):
   `bash ~/.claude/skills/mk-ustrukturyzuj-prompt/scripts/install-quick-action.sh`
   (run it from the installed copy, in your harness's skill folder; the action
   points at the folder the script lives in, so do not move that folder
   afterwards). Flags: `--model <name>` (bakes `PROMPT_MASTER_MODEL=<name>` into
   the action; shell environment variables do not reach a Services action),
   `--name`, `--services-dir`, `--force`, `--uninstall`. Assign a shortcut in
   System Settings > Keyboard > Keyboard Shortcuts > Services > Text.
   `uninstall.sh` also removes a Quick Action installed from the copy it removes.
3. **Terminal:** `pbpaste | ~/.claude/skills/mk-ustrukturyzuj-prompt/scripts/structure.sh | pbcopy`

## Update

```bash
git pull
bash install.sh --harness <the one you installed> --skill all --force   # copies; not needed with --link
# rerun with the same --harness value you used the first time
```

## Uninstall

```bash
bash uninstall.sh --dry-run
bash uninstall.sh                         # all harnesses, all skills
bash uninstall.sh --harness claude --skill mk-orkiestra
```

Only paths that `install.sh` recorded are removed.

## FAQ / troubleshooting

- **The skill does not show up.** Start a new session (Antigravity CLI: `/skills
  reload`). Check the folder in the table exists and contains `mk-orkiestra/SKILL.md`.
- **"skip ... (exists)".** The target already exists; use `--force` to replace it.
- **The subagent used the boss's model and saved nothing.** The harness ignored
  the model choice or the ladder names a model your account does not have. Check
  `ladders.toml` against your model list.
- **Antigravity/Cursor helpers are not found.** Confirm the files exist in
  `~/.gemini/config/agents/` / `~/.cursor/agents/`.
- **Is it safe?** The scripts only write to the folders above and
  `~/.mk-skills`; skills are plain text. See [SECURITY.md](SECURITY.md).

## Contributing, license

[CONTRIBUTING.md](CONTRIBUTING.md) · [CHANGELOG.md](CHANGELOG.md) · MIT, see [LICENSE](LICENSE).
