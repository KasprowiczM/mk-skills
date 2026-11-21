# mk-skills

[English](README.md) · [Polski](README.pl.md)

A small collection of agent skills (`SKILL.md` folders) for Claude Code, Codex,
Antigravity and Cursor. One repository, one installer.

## Skills

| Skill | What it does | Status |
|---|---|---|
| [`mk-boss`](skills/mk-boss/SKILL.md) | Orchestrator mode: the session's model is the "boss" that plans and delegates work down a ladder of cheaper subagent models, then spot-checks the results. It can also consult a stronger model upward (advisor or expert) at defined points. The goal: the same quality at a lower cost. | 0.3.0 |
| [`mk-prompt`](skills/mk-prompt/SKILL.md) | Turns rambling or dictated text into one short, well-structured prompt to review before sending. Also a macOS Quick Action and a shell script. Adds a Working mode section and picks fitting skills from your installed skills. In chat it first asks up to three short clarifying questions about real gaps, then refines the prompt as you add notes. | 0.4.0 |

Adding a skill later is one new folder under `skills/` plus one row above.

## Mods

Mods are Claude Code plugins. They install through `/plugin`, not through `install.sh` (which handles skills only), and need a Claude Code build with mods and plugin hooks.

| Mod | What it does | Version |
|---|---|---|
| [`mk-progress`](plugins/mk-progress/README.md) | A Claude Code mod: a side pane with live subagent cards (Clawd crab coloured by model, steps, time, tokens, cost) and a plan progress bar above the prompt. | 0.8.0 |

```
/plugin marketplace add KasprowiczM/mk-skills
/plugin install mk-progress@mk-skills
```

## Requirements

- macOS or Linux with `bash` (3.2 or newer). The installer needs nothing beyond
  standard tools (`cp`, `awk`, `mkdir`).
- At least one supported harness: Claude Code (CLI or desktop Code tab), Codex
  (CLI or ChatGPT/Codex desktop), Antigravity (IDE or `agy`), Cursor (IDE or
  `cursor-agent`). OpenCode is not supported.
- `mk-prompt` works in chat with nothing extra; its script and
  Quick Action need the Claude Code CLI installed and signed in (macOS for the
  Quick Action).
- `mk-boss` needs a harness that can start subagents; without them it
  works alone. It acts only when you ask for it explicitly. Test status per
  harness is in the table below.

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

| Harness | User-level skill folder | Source | Invoke | `mk-boss`: delegation down | `mk-boss`: consultation up |
|---|---|---|---|---|---|
| Claude Code | `~/.claude/skills` | verified ([docs](https://code.claude.com/docs/en/skills)) | `/mk-boss`, or automatically by description | tested | tested (advisor tool and `Agent` with a stronger model; Fable advisor and desktop Code tab untested) |
| Codex | `~/.agents/skills` | verified ([docs](https://learn.chatgpt.com/docs/build-skills)) | `$mk-boss` or `/skills` (CLI/IDE), `@` in ChatGPT, or automatically | tested | partly tested (`codex exec` fallback confirmed; the model of a `spawn_agent` call is unproven) |
| Antigravity | `~/.gemini/config/skills` | verified ([docs](https://antigravity.google/docs/skills)) | `/mk-boss` (App and CLI), naming it in a message, or automatically | tested for the flash helper (CLI) | partly tested (one-shot `agy --model ...` confirmed; the `pro` helper was not a stronger model on the tested account) |
| Cursor | `~/.cursor/skills` | verified ([docs](https://cursor.com/docs/skills)) | type `/` in Agent chat and pick it, or automatically | untested | partly tested (Task `model` accepted in `cursor-agent`; helper by name refused there; IDE untested) |

Test results are from 2026-11-19 (Claude Code 2.1.328, codex-cli 0.170.0, agy
1.5.12, cursor-agent 2026.11.19) and are recorded in `ladders.toml` and the
harness guides under `skills/mk-boss/harness/`.

Paths were checked against the official documentation on 2026-11-19. Docs change;
if a path stops working, open an issue. Notes:

- Cursor and Antigravity read subagent definitions from separate folders
  (`~/.cursor/agents`, `~/.gemini/config/agents`; docs:
  [Cursor](https://cursor.com/docs/subagents),
  [Antigravity](https://antigravity.google/docs/subagents)). `install.sh` copies
  the helper definitions of `mk-boss` (`skills/mk-boss/helpers/`) there. More in
  [docs/harnesses.md](docs/harnesses.md).
- Cursor also reads `~/.agents/skills`, `~/.claude/skills` and `~/.codex/skills`
  (and subagent definitions from `~/.claude/agents` and `~/.codex/agents`);
  install into one place only to avoid duplicates.
- Claude Code's personal skills folder is not read by Cowork or cloud sessions.

## Usage

- "Use mk-boss: split this migration into assignments for cheaper models and
  check the results."
- "orkiestra: zleć to subagentom i sprawdź wyniki."
- "You are the boss, delegate the implementation, keep the cost down."

On first use the skill reads `ladders.toml`, finds your model's rung and
delegates only to cheaper rungs. The ladders are examples: check them against
your own model list and edit them (section 11 of
[`SKILL.md`](skills/mk-boss/SKILL.md)).

#### Consulting a stronger model (upward)

Work only goes down the ladder; questions may go up. At defined points the boss
asks the next model above it for one **advisor** answer (a few hundred words,
no tools) or one read-only **expert** review (at most 40 lines), keeps the
task and checks the result like any other work. The triggers: before a
production write or irreversible step; a migration, data or security plan; the
same failure after two own attempts; an expensive-to-reverse design choice; a
subagent that failed its one correction; one critique of a finished multi-stage
task. Budget: three upward calls per stage, one expert. A top rung marked
`consent = true` in `ladders.toml` needs your yes before its first call. Say
"doradca", "advisor" or "consult a stronger model" to ask for it explicitly.

In Claude Code you can enable the built-in advisor: `/advisor opus`, the
setting `advisorModel`, or `claude --advisor opus`. Without it the skill uses
the `Agent` tool with the next model up, so it works either way. Other
harnesses use the mechanisms in `ladders.toml` (`[<harness>.up]`).

### mk-prompt

Needs nothing in chat. The script and the Quick Action need the Claude Code CLI
(`claude`) installed and signed in; set `PROMPT_MASTER_MODEL` to change the model
(default `sonnet`; for the Quick Action use `--model`). On any problem (missing
CLI, error, timeout, empty answer) the script returns your text unchanged.

Working mode and skill selection: when the agent can see which skills are
installed (or the script finds them, see below), the prompt can name fitting
skills under "Tools and resources", list up to four specialists under "Role",
and for a task with several stages add a "Working mode" section, for example
telling the agent to work in `mk-boss` orchestrator mode. The script builds
the list from `PROMPT_MASTER_SKILLS_DIR` or, by default, the skills folder this
skill is installed in (at most 60 skills, 160 characters each). Known limit:
without a skills list the Working mode section is occasionally left out; you
review the prompt before sending anyway.

Clarifying questions and refining (chat): before writing, the agent reads the
draft for real gaps only, meaning contradictions or a missing must-know fact
(for whom, scope, format, source, deadline, target), and asks at most three
short questions with two or three options each, in your language. Answer
briefly or skip; a skipped question ends up under "Open questions". A clear
draft gets no questions. Then add notes to the prompt anywhere, in any form: the
agent merges each into the section where it belongs, asks only about new gaps
and shows the whole updated prompt again. The script and the Quick Action are
non-interactive and never ask.

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

For a multi-stage draft ("research three libraries, then build the importer, then
check it") with `mk-boss` installed, the result also gets a section such as:

```
## Working mode
The task has three stages. Work in `mk-boss` orchestrator mode: delegate
research, implementation and verification to separate subagents.
```

Three ways to use it:

1. **In chat, by name:** "ustrukturyzuj prompt: <your draft>". The agent may
   ask a few short questions first, then replies with the structured prompt
   only; add notes or corrections (it shows the whole prompt again), then say
   "go" / "wykonaj".
2. **macOS Quick Action** (select text in any app, it replaces the selection):
   `bash ~/.claude/skills/mk-prompt/scripts/install-quick-action.sh`
   (run it from the installed copy, in your harness's skill folder; the action
   points at the folder the script lives in, so do not move that folder
   afterwards). Flags: `--model <name>` (bakes `PROMPT_MASTER_MODEL=<name>` into
   the action; shell environment variables do not reach a Services action),
   `--name`, `--services-dir`, `--force`, `--uninstall`. Assign a shortcut in
   System Settings > Keyboard > Keyboard Shortcuts > Services > Text.
   `uninstall.sh` also removes a Quick Action installed from the copy it removes.
3. **Terminal:** `pbpaste | ~/.claude/skills/mk-prompt/scripts/structure.sh | pbcopy`

## Update

```bash
git pull
bash install.sh --harness <the one you installed> --skill all --force   # copies; not needed with --link
# rerun with the same --harness value you used the first time
```

### Upgrading from 0.2.x

The skills were renamed in 0.3.0: `mk-orkiestra` is now `mk-boss` and
`mk-ustrukturyzuj-prompt` is now `mk-prompt` (the old trigger phrases such as
"orkiestra" and "ustrukturyzuj prompt" still work). To upgrade, either:

1. run `bash uninstall.sh` (0.3.0 recognises the old names recorded by 0.2.x and
   removes only those paths, including a Quick Action installed from the old
   copy), or run the old `uninstall.sh` from the 0.2.x checkout first; or remove
   `mk-orkiestra`, `mk-ustrukturyzuj-prompt` and the four helper files
   `mk-orkiestra-composer.md`, `mk-orkiestra-advisor.md`, `mk-orkiestra-flash.md`
   and `mk-orkiestra-pro.md` by hand;
2. then install 0.3.0 (`bash install.sh --harness <harness> --skill all`);
3. re-run `install-quick-action.sh --force` from the new copy so the Quick
   Action points at the new path.

## Uninstall

```bash
bash uninstall.sh --dry-run
bash uninstall.sh                         # all harnesses, all skills
bash uninstall.sh --harness claude --skill mk-boss
```

Only paths that `install.sh` recorded are removed.

## FAQ / troubleshooting

- **The skill does not show up.** Start a new session (Antigravity CLI: `/skills
  reload`). Check the folder in the table exists and contains `mk-boss/SKILL.md`.
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
