# MK Progress

A Claude Code mod that shows how far Claude is, in the terminal and in Claude Desktop (Code tab):

- **Task bar above the prompt.** A purple progress bar that fills as Claude ticks off its plan (`Tasks 2/4`, percent, the step in progress under it). One thickness rule: the normal line (the unfinished track) is 8 px in Svg or a dim heavy `━` line in the terminal, and the finished part is 1.5 times that (a 12 px static gradient fill; full `█` blocks in the terminal). Only the unfinished part moves: a bright piece glides over it from the end of the fill to the end of the bar. The ▸ next to the ✕ unfolds the plan: one line per step, `✓` done (with the time), `◐` in progress, `○` still to do. It follows `TodoWrite`, `TaskCreate` / `TaskUpdate` and the mod's own tool `mcp__mk-progress__plan`, which Claude loads on demand (it is deferred, so it costs no tokens until used). SVG on Desktop, block glyphs in the terminal. The ✕ hides the bar until the plan changes again.
- **Subagent pane.** Compact, 48 columns wide. One line on top: the number of subagents, chat cost, tokens and time, and Hide. Under it a row per **model with its tokens and estimated cost**, led by a dot in the model's colour. Then one slim heading per group (Running green, Finished amber, Stopped red) and borderless cards: description with time and state, **model and effort** in the model's colour ("sonnet·high", "inherit" when the engine gave none) with type and tokens, the live step, and a thin animated bar (the style of the macOS Updates bars: a heavy line, a piece gliding along it in the helper's model colour, a full green or red line when over). A working card has a 6 px track (a dim `━` line) with a model-coloured piece gliding along it; a finished or stopped one is a solid 9 px green or red line (`█` blocks in the terminal). A collapsed card keeps the last 3 earlier steps as dim lines under the current step, and a "▸ all N steps" button opens the full list, where repeated steps fold into "×3". At the top of the pane a "Tasks d/n" group shows the plan: the done steps in one "✓ d done" line (click to list them), the step in progress highlighted, then the pending ones. The Clawd crab beside each card (a slim Clawd with the original silhouette on every surface: 7 by 3 glyphs in the terminal with thin box-drawing arms and legs, and a 21 by 18 px Svg, with its claws and legs animated and a short eyes-only blink about every 3.6 s while it works, and with a dim `#N` seat tag under it to tell cards on the same model apart) wears the colour of its model (Opus orange, Sonnet blue, Haiku teal, Fable pink, grey until the model is known). Not every number exists on every build; what is missing is left out.
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

1. `claude plugin list` shows `mk-progress@mk-skills` at 0.9.4 and enabled. Start `claude` (or run `/reload-plugins`).
2. Ask: "Make a 3-step plan with the progress tool, then do it: list files in /tmp, count them, print the count." The purple bar appears above the prompt and fills; ✕ hides it.
3. Ask for two parallel subagents ("use two Explore agents to look at ..."). Type `/mk-progress` (a narrow terminal does not seat the pane by itself): cards show model, effort, tokens; the top rows show tokens and cost per model.
4. Narrow the window to about 80 columns and then 40: the bar drops its percent, then its title, and never wraps.

**Desktop (Claude Desktop, Code tab, local session)**

1. Install from a terminal as above (user scope); a local Code-tab session loads it. `/plugin` does not run in Desktop, so install from the CLI or use + next to the prompt box, Plugins. Start a **new** session after installing.
2. Give the same prompts. The bar and the cards are drawn as SVG (the Clawd crab on each card, animated bars); `/mk-progress` opens the pane.

**Automated**

```
claude plugin test plugins/mk-progress
claude plugin validate plugins/mk-progress
claude plugin validate .
```

The tests draw the bar and the pane on terminal, desktop, vscode and mobile, at wide and narrow widths and with nothing to show.

## Troubleshooting

- **The plan bar never appears.** The plan tool is registered as deferred (loaded through ToolSearch). If Claude never calls it, open `plugins/mk-progress/hooks/register.tsx`, find the `$.tool.register({ name: 'plan', ... })` call and set `isDeferred: false` (the schema is then sent on every request, a few hundred tokens). `TodoWrite` / `TaskCreate` also feed the bar, so it appears whenever Claude keeps a to-do list. Run `/reload-plugins` afterwards.
- **No pane in the terminal.** Unasked, a terminal seats a pane only from about 110 to 144 columns. Type `/mk-progress`; that seats it at any width.
- **Pane or bar missing, mod seems off.** Check `~/.claude/mods/switches.json` for `"mk-progress": false` or `"mk-progress:hidden": true`.
- **Model or effort reads "inherit".** The engine reported none for that agent (a teammate in its own terminal pane, say).
- **Something else.** `~/.claude/mods-logs/mk-progress.log`, or `claude --debug`.

## Changes

- **0.9.4.** The blink is back, as an overlay on the limb frames: a working crab closes only its eye cells for one step about every 3.6 s; a finished crab keeps its eyes open. Head and body never change. The crab is slimmer to take less room: 7 columns in the terminal, 21 by 18 px in Svg, thin legs and arms.
- **0.9.3.** The original whole Clawd on every surface (one 9 by 3 glyph source for the terminal and the Svg, no separate small crab). Only the claws and the legs animate; head, eyes and body are identical in every frame (no blink).
- **0.9.2.** Finished bar parts are half as thick: 12 px on the task bar (track stays 8 px), 9 px on done and stopped cards (running track stays 6 px); the bar rows are lower to match.
- **0.9.1.** Crab: the Svg is built from the original 9 by 3 Clawd glyphs (18 by 6 pixels, 1.5 by 3 px each, 27 by 18 px in all, centred in the card), the terminal crab is a redesigned 5 by 2 copy of the original. Bars: one thickness rule (normal line 8 px, finished 3 times that, 24 px) on the task bar; card bars 6 px while working and 18 px when over; the finished part is static and only the unfinished part is animated; the terminal uses `█` for done and `━` for the track.
- **0.9.0.** Header reads "N subagents in this chat" with labelled stats (chat cost, subagent tok, time), a "By model" heading over the model rows ("tokens" written out when there is room), cards keep the agent type at 48 columns, the running step reads "Step N · …", and finished or stopped cards end in "✓ Done · N steps" / "✗ Stopped before it finished · N steps". Clawd is half the size (5 by 2 glyphs, 10 by 4 pixel Svg). Collapsed cards bring back the last 3 steps and a labelled "▸ all N steps" / "▾ hide steps" toggle. The task bar unfolds into the plan's steps (done with time, in progress, pending) and the pane has a "Tasks d/n" group. Done is thick and working is thin on the task bar and card bars, with a brighter moving piece on the in-progress part.
- **0.8.0.** Compact pane: 48 columns, one-line stats, tokens and cost per model moved to the top, slim group headings, borderless cards of 4 rows (running) and 3 rows (finished, stopped) with no scrolling for a handful of agents. Thin macOS-Updates-style bars on cards and on the task bar (a gliding piece, a travelling pulse, a glowing step in progress; no more dither sparkles). The crab is Clawd from the Claude Code start-up screen, drawn from quadrant glyphs in the terminal and from the same glyphs as pixels in Svg, coloured by model. Repeated steps fold into "×N". Colours hold 3:1 contrast on light and dark pages.
- **0.7.0.** Unknown MCP servers are named from their tool id ("Acme Crm", never "Connector"); the built-in table is trimmed to common servers. Model and effort on every subagent card, tokens and cost per model in the pane footer. Privacy: no raw Bash commands, `redact()` on all displayed and saved text. Dead platform helpers removed. Task bar fits narrow terminals; a hint when the pane cannot seat; tests on four surfaces.
- **0.6.0.** Renamed from helper-desk to mk-progress: plugin, marketplace, pane, `/mk-progress`, tool `mcp__mk-progress__plan`, log file and switches keys. Plan nudge after 3 calls and only without a plan, plan tool behind ToolSearch, log rotation, 7-day plan-file sweep, 15 s switches poll.
