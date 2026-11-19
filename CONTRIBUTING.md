# Contributing

Thanks for looking. This is a small personal collection, so keep changes small.

## Report a problem or propose a change

- Open a GitHub issue: say which harness (Claude Code, Codex, Antigravity,
  Cursor), its version, what you ran and what happened. For a skill that
  behaved badly, quote the instruction that was followed or ignored.
- For a change, open an issue first or a pull request with one focused change.
  Wrong or outdated model names in `ladders.toml` and wrong skill-folder paths
  are especially welcome, with a link to the official documentation.

## Run the checks locally

There are no GitHub Actions workflows in this repository on purpose. Before you
send a change, run:

```bash
bash -n install.sh uninstall.sh skills/*/scripts/*.sh
shellcheck install.sh uninstall.sh skills/*/scripts/*.sh   # if you have shellcheck
python3 -c "import tomllib; tomllib.load(open('skills/mk-boss/ladders.toml','rb'))"
bash install.sh --harness all --skill all --dry-run
HOME="$(mktemp -d)" bash install.sh --harness claude --skill all   # throwaway HOME
```

Do not put personal paths, account names, e-mail addresses or tokens in any file.
