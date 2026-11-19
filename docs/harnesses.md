# Harness notes

Details that would make the README too long. For paths, invocation and the
test status of `mk-orkiestra` per harness see the table in
[README.md](../README.md). Test results were recorded on 2026-11-19 (Claude Code
2.1.328, codex-cli 0.170.0, agy 1.5.12, cursor-agent 2026.11.19); the full
facts, including what failed and the workaround, are in
`skills/mk-orkiestra/ladders.toml` (`[<harness>.up].tested`) and in
`skills/mk-orkiestra/harness/<name>.md`.

## Claude Code (CLI and desktop Code tab)

- Skills: `~/.claude/skills/<name>/SKILL.md`. Not read by Cowork or cloud
  sessions (per the docs). Start a new session after installing.
- Delegation down: tested (`Agent` tool with `model` and `effort`).
- Consultation up: tested. Two mechanisms: the built-in advisor (enable with
  `/advisor opus`, the setting `advisorModel`, or `claude --advisor opus`; the
  advisor must rank at or above the main model; it receives the whole
  conversation) or the `Agent` tool with the next model up. The skill works
  without the advisor. A Fable advisor can bill usage credits and needs your yes.
  Not tested: Fable advisor, desktop Code tab, `/advisor` in the desktop app.

## Codex (CLI and ChatGPT/Codex desktop)

- Skills: `$HOME/.agents/skills`. Mention a skill with `$mk-orkiestra` (CLI/IDE)
  or `@` (ChatGPT), or let Codex pick it by description.
- Delegation down: tested. The skill delegates with `spawn_agent`, choosing the
  model per call; no helper file is needed.
- Consultation up: partly tested. `codex exec -m <stronger id> -c
  model_reasoning_effort=high -s read-only --ephemeral "<question>"` is
  confirmed; a `spawn_agent` call naming a stronger model ran but the model that
  answered is unproven (no per-subagent usage in `--json`). Desktop app and
  `fork_turns: "all"` untested.

## Antigravity (IDE and `agy`)

- Skills: `~/.gemini/config/skills`. The CLI also reads
  `~/.gemini/antigravity-cli/skills` and `~/.gemini/skills`; the App does not.
  Run `/skills reload` or start a new conversation after installing.
- Antigravity chooses a subagent's model from an agent definition
  (`model: inherit|flash|pro`), not from the call. `mk-orkiestra` therefore ships
  `helpers/antigravity/mk-orkiestra-flash.md` (delegation down) and
  `helpers/antigravity/mk-orkiestra-pro.md` (consultation up). Subagent
  definitions live in `~/.gemini/config/agents/`, outside the skill folder, so
  `install.sh` copies (or links) the files there. Manual step without the
  installer: `cp skills/mk-orkiestra/helpers/antigravity/*.md ~/.gemini/config/agents/`
- Delegation down: tested for the flash helper in the CLI. On the tested account
  `flash` resolved to Hydrogen at high effort.
- Consultation up: partly tested. On the tested account `pro` resolved to
  Hydrogen at a higher effort, not to a stronger model: check what it resolves
  to on yours (the subagent transcript records the model). A one-shot
  `agy --model <stronger id> --mode plan -p="<question>"` was confirmed. IDE
  untested.

## Cursor (IDE and `cursor-agent`)

- Skills: `~/.cursor/skills`. Cursor also reads `~/.agents/skills`,
  `~/.claude/skills` and `~/.codex/skills`, and subagent definitions from
  `~/.claude/agents` and `~/.codex/agents`; install into one place only.
- Subagent definitions live in `~/.cursor/agents/`. `install.sh` copies
  `helpers/cursor/mk-orkiestra-composer.md` and
  `helpers/cursor/mk-orkiestra-advisor.md` there. Manual step without the
  installer: `cp skills/mk-orkiestra/helpers/cursor/*.md ~/.cursor/agents/`
- Delegation down: untested.
- Consultation up: partly tested. In `cursor-agent` the Task tool's `model`
  accepts only a short list of slugs (for example `claude-opus-5-5-medium`, not
  `-high`); the custom helper could not be invoked by name there. IDE untested.

## Editing the model ladders

See section 11 of `skills/mk-orkiestra/SKILL.md`. In short: list your models
(`codex debug models`, `cursor-agent models`, `agy models`, `/model`), edit
`skills/mk-orkiestra/ladders.toml` (and the `model:` line of the helper
definitions), then reinstall with `--force`. With `--link` the installed skill
is your checkout, so edits apply immediately.
