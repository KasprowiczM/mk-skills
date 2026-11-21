# MK Progress

A Claude Code mod that shows how far Claude is, in the terminal and in Claude Desktop (Code tab):

- **Task bar above the prompt.** A purple progress bar that fills as Claude ticks off its plan (`Tasks 2/4`, percent, the step in progress under it). It follows `TodoWrite`, `TaskCreate` / `TaskUpdate` and the mod's own tool `mcp__mk-progress__plan`, which Claude loads on demand (it is deferred, so it costs no tokens until used). SVG on Desktop, block glyphs in the terminal. The ✕ hides the bar until the plan changes again.
- **Subagent pane.** Compact, 48 columns wide. One line on top: the number of subagents, chat cost, tokens and time, and Hide. Under it a row per **model with its tokens and estimated cost**, led by a dot in the model's colour. Then one slim heading per group (Running green, Finished amber, Stopped red) and borderless cards: description with time and state, **model and effort** in the model's colour ("sonnet·high", "inherit" when the engine gave none) with type and tokens, the live step, and a thin animated bar (the style of the macOS Updates bars: a heavy line, a piece gliding along it in the helper's model colour, a full green or red line when over). The ▸ button opens the step list, where repeated steps fold into "×3". The Clawd crab beside each card wears the colour of its model (Opus orange, Sonnet blue, Haiku teal, Fable pink, grey until the model is known). Not every number exists on every build; what is missing is left out.
- **Colours.** The engine does not tell a mod the theme, so the terminal uses single mid-tone colours that keep 3:1 contrast on white and on #1e1e1e; Svg drawings switch to brighter shades on a dark page with CSS.

Forked from BenAI's Helper Desk (original author: Ben AI), renamed and patched.

## Commands

| | |
| --- | --- |
| `/mk-progress` | Opens the pane (at any width; the mod also opens it by itself when subagents start, if the terminal is at least about 110 to 144 columns wide, otherwise a toast tells you to type this). |
| Hide button / ✕ | Hide the pane for good (shared with every chat), or the bar until the plan changes. |
| `/mods` | Turns the mod on or off, if you have the mods plugin. |
| `/reload-plugins` | Loads a new version into a chat that is already open (terminal). |

## Privacy

Nothing secret-looking is shown or saved:

- A Bash step shows the tool call's `description` if there is one, otherwise only the program name and an ellipsis (`curl…`). The command line and its arguments are never shown.
- Every displayed text (steps, card titles, plan items, toasts, the plan file under `~/.claude/mods-state/`) goes through `redact()`: `KEY=value` assignments, `Bearer` tokens and `Authorization` headers, values of `--token` / `--password` / `--secret` style flags and `-u user:pass`, userinfo and query strings of URLs, and hex or base64 strings of 24 characters or more become `[redacted]`.
- Costs are the engine's client-side estimates, not the bill.
- The mod makes no network calls. Its log is `~/.claude/mods-logs/mk-progress.log` (errors only, 256 KB, one backup).

## Install

Requires a Claude Code build with mods and plugin hooks (the `$.tool.register` and pane API the mod uses). Mods install through `/plugin`, not through `install.sh`:

```
/plugin marketplace add KasprowiczM/mk-skills
/plugin install mk-progress@mk-skills
```

Or from a shell: `claude plugin marketplace add KasprowiczM/mk-skills` then `claude plugin install mk-progress@mk-skills`. After a new version run `claude plugin update mk-progress@mk-skills`.

## Switching it off and on

- `~/.claude/mods/switches.json`: `"mk-progress": false` turns the mod off, `"mk-progress:hidden": true` hides the bar and pane (the Hide button writes this). Chats pick it up within 15 s or at the next prompt.
- `claude plugin disable mk-progress@mk-skills` / `enable` switches the plugin itself.

## Test it

**Terminal (CLI)**

1. `claude plugin list` shows `mk-progress@mk-skills` at 0.8.0 and enabled. Start `claude` (or run `/reload-plugins`).
2. Ask: "Make a 3-step plan with the progress tool, then do it: list files in /tmp, count them, print the count." The purple bar appears above the prompt and fills; ✕ hides it.
3. Ask for two parallel subagents ("use two Explore agents to look at ..."). Type `/mk-progress` (a narrow terminal does not seat the pane by itself): cards show model, effort, tokens; the top rows show tokens and cost per model.
4. Narrow the window to about 80 columns and then 40: the bar drops its percent, then its title, and never wraps.

**Desktop (Claude Desktop, Code tab, local session)**

1. Install from a terminal as above (user scope); a local Code-tab session loads it. `/plugin` does not run in Desktop, so install from the CLI or use + next to the prompt box, Plugins. Start a **new** session after installing.
2. Give the same prompts. The bar and the cards are drawn as SVG (the Clawd crab on each card, thin animated bars); `/mk-progress` opens the pane.

**Automated**

```
claude plugin test plugins/mk-progress
claude plugin validate plugins/mk-progress
claude plugin validate .   # from the repository root
```

The tests draw the bar and the pane on terminal, desktop, vscode and mobile, at wide and narrow widths and with nothing to show.

## Troubleshooting

- **The plan bar never appears.** The plan tool is registered as deferred (loaded through ToolSearch). If Claude never calls it, open `plugins/mk-progress/hooks/register.tsx`, find the `$.tool.register({ name: 'plan', ... })` call and set `isDeferred: false` (the schema is then sent on every request, a few hundred tokens). `TodoWrite` / `TaskCreate` also feed the bar, so it appears whenever Claude keeps a to-do list. Run `/reload-plugins` afterwards.
- **No pane in the terminal.** Unasked, a terminal seats a pane only from about 110 to 144 columns. Type `/mk-progress`; that seats it at any width.
- **Pane or bar missing, mod seems off.** Check `~/.claude/mods/switches.json` for `"mk-progress": false` or `"mk-progress:hidden": true`.
- **Model or effort reads "inherit".** The engine reported none for that agent (a teammate in its own terminal pane, say).
- **Something else.** `~/.claude/mods-logs/mk-progress.log`, or `claude --debug`.
