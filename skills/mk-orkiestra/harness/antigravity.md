# Orkiestra in Antigravity (IDE and `agy` CLI)

Based on `agy models`, `agy agents` and the Antigravity subagents
documentation. UNTESTED: a live invocation of the helper has not been tried.

## How to delegate

- First step: the model list depends on the signed-in Google account. Run
  `agy models` once at the start of an orchestrated session and find the
  session's model in that list before delegating. Boss on Gemini 4 Argon:
  delegate to `mk-orkiestra-flash`. Boss on Gemini 4 Hydrogen or Gemini 3.8
  Flash: bottom rung, work alone. Boss on a Claude or other non-Gemini model
  served by Antigravity: `mk-orkiestra-flash` only (assumption). Do not log in,
  log out or switch accounts for this.
- Tool: `invoke_subagent` with a role (the agent's name) and the assignment as
  the initial prompt. A subagent starts with a clean context and no history of
  the boss's conversation.
- A subagent's model is not chosen in the call. It comes from the agent
  definition: `model: inherit` (default, the boss's model), `flash` or `pro`.
  A helper without a definition therefore runs on the boss's model and saves
  nothing.
- Use the helper `mk-orkiestra-flash` (`model: flash`). It names the tier, not a
  model, so it runs on whichever of Gemini 4 Hydrogen or Gemini 3.8 Flash the
  signed-in account maps to `flash` (assumption, not verified live). Its
  definition is `helpers/antigravity/mk-orkiestra-flash.md` in this skill. Antigravity
  reads subagent definitions from `~/.gemini/config/agents/`, not from the
  skill folder, so copy or link the file there: `install.sh` does this for
  Antigravity. It is a subagent-only definition, so
  `agy agents` (which lists main agents) does not show it; check that the file
  exists. If it is missing, create the same definition with `define_subagent`
  for this session and tell the user. A live invocation of the helper has not
  been tried yet.
- Follow-up: `send_message` to the subagent's ID. An idle subagent keeps its
  context and wakes on a message. A killed subagent cannot be woken;
  `invoke_subagent` always starts a fresh one.
- At most 5 helpers at once (a sensible default; adjust). The documentation
  states no limit.

## The boss's role here

1. Model: it comes from the agent definition only. Always use
   `mk-orkiestra-flash`; a helper without a definition inherits the boss's model.
2. Orientation and searches: `mk-orkiestra-flash`, report of at most 40 lines.
3. Chores (only when the user asked for them: commit, push, pull, PR, changelog, lint): one bundled
   assignment to `mk-orkiestra-flash`. Execution and mechanical work go to it too.
4. Writers: by default a subagent leaves its changes in the working tree and
   reports the changed files; it commits or pushes only when the user asked or
   the repository's instructions say so, and then reports the SHA. Each parallel writer gets its own files.
5. Corrections: a rejected result goes back with `send_message` to the same
   subagent's ID. There is no higher rung below the boss: after one failed
   correction the boss rewrites the assignment more precisely or asks the
   user. The boss never takes the task over.
6. Effort: not under the boss's control (see the ladder section).

## Ladder in practice

| Boss | May delegate to |
|---|---|
| Gemini 4 Argon (`gemini-4-argon-*`, only on some accounts) | `mk-orkiestra-flash` for execution, mechanical work and chores; judgement stays with the boss |
| Gemini 4 Hydrogen or Gemini 3.8 Flash (`gemini-3.8-flash-*`) | nobody; same rung, work alone |
| Claude or other non-Gemini model served by Antigravity | `mk-orkiestra-flash` only (assumption that the Flash tier costs less) |

Effort is part of the session's model ID (`gemini-4-argon-high`) or the
`--effort` flag. The documentation gives no effort setting for a subagent
definition, so the effort of a helper is not under the boss's control.

Model availability depends on the signed-in Google account. Some accounts offer both Gemini 4 Argon and Gemini 4 Hydrogen, the successor
of Gemini 3.8 Flash; others list only `gemini-3.8-flash-*` plus a few
non-Gemini models. Hydrogen and 3.8 Flash are
one rung. Read the exact Hydrogen model IDs from
`agy models`; they are not recorded here.

## Known pitfalls

- Every helper draws on the same subscription quota as the boss. A helper that
  runs out of quota ends with `Error:` in `/agents`, not with a report.
- `/swarm` is labelled quota-heavy. Do not use it for this skill.
- A misspelled tool name in a definition's `tools` list can hang the subagent.
  The helper definition leaves `tools` out for that reason.
- Helpers inherit the boss's command prefixes, file scopes and sandbox;
  approval requests come up to the boss's session. In headless `-p` runs a
  helper's questions are skipped.
- Production writes and deploys: the boss runs them after the user's consent
  in the conversation (section 5 of the skill).
