# Contributing

Thanks for looking. This is a small personal collection, so keep changes small.

## Report a problem or propose a change

- Open a GitHub issue: say which harness (Claude Code, Codex, Antigravity,
  Cursor), its version, what you ran and what happened. For a skill that
  behaved badly, quote the instruction that was followed or ignored.
- For a change, open an issue first or a pull request with one focused change.
  Wrong or outdated model names in `ladders.toml` and wrong skill-folder paths
  are especially welcome, with a link to the official documentation.

## Layout: one repo, one marketplace

`skills/<name>/` is the canonical home of a skill (`install.sh` copies it to Codex, Antigravity, Cursor and Claude). `plugins/<name>/` holds mods. `.claude-plugin/marketplace.json` lists everything as Claude Code plugins.

Each skill is exposed as a plugin named exactly like the skill, using the root-source form, so no skill file is duplicated:

```json
{ "name": "mk-boss", "source": "./", "skills": ["./skills/mk-boss"], "description": "...", "author": {"name": "mk"}, "homepage": "https://github.com/KasprowiczM/mk-skills" }
```

Why this form: tested with `claude plugin marketplace add` and `install` in a throwaway `HOME` (Claude Code 2.1.330). `claude plugin details` shows exactly 1 skill, 0 hooks, 0 agents for each skill plugin, so neither the other skill nor the mod is loaded. The fallback, if a future build loads extras, is `plugins/<name>/skills/<name>` as a relative symlink to `../../../skills/<name>` (symlinks inside the repo are dereferenced into the plugin cache). Note: the root form caches the whole repo per plugin, which is harmless but larger.

## Add a new skill

1. Create `skills/<name>/SKILL.md` (frontmatter `name`, `description`) plus any extra files in that folder.
2. Add a marketplace entry in `.claude-plugin/marketplace.json`: `name` = folder name, `"source": "./"`, `"skills": ["./skills/<name>"]`, `description`, `author`, `homepage`, `category`, `keywords`. No `version`: the commit SHA is the version, so every push is an update.
3. Add a row to the Skills table in `README.md` and `README.pl.md`, and a CHANGELOG entry; bump `VERSION`.
4. Run `scripts/check.sh` and `bash install.sh --harness all --skill all --dry-run`.
5. Commit and push to `main`. Publishing is the push: users get it with `/plugin marketplace update mk-skills` or auto-update.

## Add a new mod

1. Create `plugins/<name>/` with `.claude-plugin/plugin.json` (`name`, `version`, `description`, `author`), `hooks/`, and a full `README.md` (install is via this marketplace).
2. Add the entry: `"source": "./plugins/<name>"`, `description`, `author`, `homepage`, `category`. Do not repeat `version` there.
3. Version rule: set `version` in ONE place, the mod's `plugin.json`, and bump it on every change users should receive (an unchanged version means no update). Skill plugins have no version at all.
4. Add the mod to the README tables (EN and PL) and the CHANGELOG; bump `VERSION`.
5. Run `scripts/check.sh` (validates, runs `claude plugin test`), then push to `main`.

## Run the checks locally

There are no GitHub Actions workflows in this repository on purpose. Before you
send a change, run:

```bash
scripts/check.sh                       # marketplace, plugins, mod tests, skills vs entries
bash -n scripts/*.sh
bash -n install.sh uninstall.sh skills/*/scripts/*.sh
shellcheck install.sh uninstall.sh skills/*/scripts/*.sh   # if you have shellcheck
python3 -c "import tomllib; tomllib.load(open('skills/mk-boss/ladders.toml','rb'))"
bash install.sh --harness all --skill all --dry-run
HOME="$(mktemp -d)" bash install.sh --harness claude --skill all   # throwaway HOME
```

Do not put personal paths, account names, e-mail addresses or tokens in any file.
