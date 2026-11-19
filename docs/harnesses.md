# Harness notes

Details that would make the README too long. For paths and invocation see the
table in [README.md](../README.md).

## Claude Code (CLI and desktop Code tab)

- Skills: `~/.claude/skills/<name>/SKILL.md`. Not read by Cowork or cloud
  sessions (per the docs).
- Start a new session after installing. Delegation is tested. Cowork does not read this folder.

## Codex (CLI and ChatGPT/Codex desktop)

- Skills: `$HOME/.agents/skills`. Mention a skill with `$mk-orkiestra` (CLI/IDE)
  or `@` (ChatGPT), or let Codex pick it by description.
- Delegation is tested. The skill delegates with `spawn_agent`, choosing the model per call; no helper
  file is needed.

## Antigravity (IDE and `agy`)

- Delegation with `mk-orkiestra` is untested here.
- Skills: `~/.gemini/config/skills`. The CLI also reads
  `~/.gemini/antigravity-cli/skills` and `~/.gemini/skills`; the App does not.
  Run `/skills reload` or start a new conversation after installing.
- Antigravity chooses a subagent's model from an agent definition
  (`model: inherit|flash|pro`), not from the call. `mk-orkiestra` therefore ships
  `helpers/antigravity/mk-orkiestra-flash.md`. Subagent definitions live in
  `~/.gemini/config/agents/`, outside the skill folder, so `install.sh` copies
  (or links) the file there. Manual step if you do not use the installer:
  `cp skills/mk-orkiestra/helpers/antigravity/mk-orkiestra-flash.md ~/.gemini/config/agents/`

## Cursor (IDE and `cursor-agent`)

- Delegation with `mk-orkiestra` is untested here.
- Skills: `~/.cursor/skills`. Cursor also reads `~/.agents/skills`,
  `~/.claude/skills` and `~/.codex/skills`, and subagent definitions from
  `~/.claude/agents` and `~/.codex/agents`; install into one place only.
- Subagent definitions live in `~/.cursor/agents/`. `install.sh` copies
  `helpers/cursor/mk-orkiestra-composer.md` there. Manual step:
  `cp skills/mk-orkiestra/helpers/cursor/mk-orkiestra-composer.md ~/.cursor/agents/`

## Editing the model ladders

See section 9 of `skills/mk-orkiestra/SKILL.md`. In short: list your models
(`codex debug models`, `cursor-agent models`, `agy models`, `/model`), edit
`skills/mk-orkiestra/ladders.toml` (and the `model:` line of the helper
definitions), then reinstall with `--force`. With `--link` the installed skill
is your checkout, so edits apply immediately.
