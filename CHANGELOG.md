# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/KasprowiczM/mk-skills/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/KasprowiczM/mk-skills/releases/tag/v0.1.0
