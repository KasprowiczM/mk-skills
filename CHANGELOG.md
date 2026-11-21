# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.6.3] - 2026-11-21

### Changed
- mk-progress 0.9.3: the whole original 9 by 3 Clawd is drawn on every surface (Svg 27 by 18 px); only the claws and legs animate.

## [0.6.2] - 2026-11-21

### Changed
- mk-progress 0.9.2: finished bar parts are half as thick (task bar fill 12 px over an 8 px track; card done and stopped bars 9 px over a 6 px running track).

## [0.6.1] - 2026-11-21

### Changed
- mk-progress 0.9.1: Clawd crab redrawn from the original frames (27 by 18 px in Svg, a redesigned 5 by 2 copy in the terminal); one thickness rule for bars (task bar 8 px, finished 24 px, static; card bars 6 px working, 18 px done); animation only over the unfinished part.

## [0.6.0] - 2026-11-21

### Changed
- mk-progress 0.9.0: half-size Clawd crab with a `#N` seat tag; step history on cards with an "all N steps" toggle; expandable plan list on the task bar and a "Tasks" group in the pane; thick line = done, thin line = working; 0.7.0 card and header labels restored.

## [0.5.0] - 2026-11-21

### Added
- Added mk-progress mod (0.8.0): `plugins/mk-progress/` plus `.claude-plugin/marketplace.json`.
  Install with `/plugin marketplace add KasprowiczM/mk-skills` and
  `/plugin install mk-progress@mk-skills`.

## [0.4.0] - 2026-11-21

### Added
- `mk-prompt`: before writing, the agent asks 0-3 clarifying questions about real
  gaps only (contradictions or a missing must-know fact), each with 2-3 short
  options; the rules are in the new `skills/mk-prompt/questions.md`. A skipped
  question goes under the open questions.
- `mk-prompt`: an explicit refine loop. Notes added to the prompt are merged into
  the section they belong to, only new gaps are asked about, and the whole
  updated prompt is shown again.

### Changed
- `skills/mk-prompt/instructions.md`: accepts `<current_prompt>`, `<additions>` and
  `<answers>` blocks besides `<draft>`; skipped answers go under the open
  questions. `scripts/structure.sh` is unchanged and stays non-interactive (no
  questions).

## [0.3.0] - 2026-11-19

### Changed
- Renamed `mk-orkiestra` to `mk-boss` (folder `skills/mk-boss/`; helpers
  `mk-boss-composer`, `mk-boss-advisor`, `mk-boss-flash`, `mk-boss-pro`) and
  `mk-ustrukturyzuj-prompt` to `mk-prompt` (folder `skills/mk-prompt/`). The old
  trigger phrases (orkiestra, szef orkiestry, ustrukturyzuj prompt, prompt
  master, ...) still work; `mk-boss`, "boss mode" and `mk-prompt` were added.
  The macOS Quick Action keeps the service name "Ustrukturyzuj prompt".
- `uninstall.sh` also recognises and removes entries recorded by 0.2.x under
  the old names.

### Upgrading from 0.2.x
Run `uninstall.sh` (the old one from the 0.2.x checkout, or the 0.3.0 one, which
recognises the old names), or remove `mk-orkiestra`, `mk-ustrukturyzuj-prompt`
and the four `mk-orkiestra-*` helper files by hand; then install 0.3.0 and
re-run `install-quick-action.sh --force` so the Quick Action points at the new
path.

## [0.2.0] - 2026-11-19

### Added
- `mk-orkiestra`: consulting a stronger model upward (advisor or expert) at six
  defined triggers, with a budget of three calls per stage and consent for a
  top rung marked `consent = true`; a Sonnet-over-Haiku execution exception; a
  section on which model to start on; upward calls in the final report.
- `ladders.toml` (version 2): `judgement` and `consent` per rung, an
  `[<harness>.up]` table per harness with live-test results, new example models
  (Gemini 4 Neon, GPT-6.2 Astra and Sol, tier-grouped Codex rungs), Cursor's
  Claude-family ladder and the slugs the Task tool accepts.
- Helpers `mk-orkiestra-advisor` (Cursor) and `mk-orkiestra-pro` (Antigravity),
  installed and removed by `install.sh` and `uninstall.sh`.
- `mk-ustrukturyzuj-prompt`: an optional list of available skills (built by
  `scripts/structure.sh` from `PROMPT_MASTER_SKILLS_DIR` or the harness skills
  folder), up to four specialists under "Role", skill names under "Tools and
  resources", and a "Working mode" section for multi-stage tasks.
- README: consultation upward, the Claude Code advisor, and per-harness test
  status for delegation down and consultation up.

### Changed
- `mk-orkiestra` section numbering: the ladder-editing section is now 11.
- Harness guides gained an "Upward" part; test results are stated as facts about
  each product and version.

## [0.1.0] - 2026-11-19

### Added
- `mk-orkiestra`: orchestrator mode for multi-step work. The session's model is
  the boss; it plans, delegates down a model ladder to cheaper subagent models,
  and verifies results. Includes example model ladders (`ladders.toml`), notes
  for Claude Code, Codex, Antigravity and Cursor, and helper agent definitions
  for Antigravity and Cursor.
- `mk-ustrukturyzuj-prompt`: turns rambling or dictated text into one short,
  well-structured prompt to review before sending. Includes `scripts/structure.sh`
  (stdin to stdout; needs the Claude Code CLI) and `scripts/install-quick-action.sh`
  (macOS Services Quick Action).
- `install.sh` and `uninstall.sh` (copy or symlink; `--dry-run`, `--force`;
  never overwrites without `--force`).
- English and Polish READMEs, CONTRIBUTING, SECURITY, MIT license.

[Unreleased]: https://github.com/KasprowiczM/mk-skills/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/KasprowiczM/mk-skills/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/KasprowiczM/mk-skills/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/KasprowiczM/mk-skills/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/KasprowiczM/mk-skills/releases/tag/v0.1.0
