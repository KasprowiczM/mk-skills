# Security

Skills are instructions that an AI agent follows, and `install.sh` copies files
into your home folder. Read both before you use them.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting (the "Report a vulnerability"
button under the repository's Security tab). If that is not available, open an
issue without exploit details and ask for a private channel.

Examples worth reporting: an instruction in a skill that could make an agent
leak data or run something destructive, or a way for `install.sh` /
`uninstall.sh` to touch files outside the skill folders.

## What the scripts do

- `install.sh` writes only to the skill folders listed in the README (and
  helper agent folders for Cursor and Antigravity) and to `~/.mk-skills/manifest`.
- `uninstall.sh` removes only paths recorded in that manifest.
- Neither script uses the network or `sudo`.
- `skills/mk-ustrukturyzuj-prompt/scripts/install-quick-action.sh` (macOS, run
  by you) writes one `.workflow` folder into `~/Library/Services` and runs
  `pbs -update`. `structure.sh` sends the text you give it to the Claude Code CLI.
