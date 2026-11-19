# Boss mode (orkiestra) in Antigravity (IDE and `agy` CLI)

Based on `agy models`, `agy agents` and the Antigravity subagents
documentation. Tested 2026-11-19 with agy 1.5.12 in headless `agy -p` runs:
delegation down with the flash helper ran; consultation up is partly tested
(see Upward); the IDE is untested.

## How to delegate

- First step: the model list depends on the signed-in Google account. Run
  `agy models` once at the start of an orchestrated session and find the
  session's model in that list before delegating. Boss on Gemini 4 Argon or
  Gemini 4 Neon: delegate work to `mk-boss-flash`. Boss on Gemini 4 Hydrogen
  or Gemini 3.8 Flash: bottom rung, work alone. Boss on a Claude or other
  non-Gemini model served by Antigravity: `mk-boss-flash` only (assumption).
  Do not log in, log out or switch accounts for this.
- Tool: `invoke_subagent` with a role (the agent's name) and the assignment as
  the initial prompt. A subagent starts with a clean context and no history of
  the boss's conversation.
- A subagent's model is not chosen in the call. It comes from the agent
  definition: `model: inherit` (default, the boss's model), `flash` or `pro`.
  A helper without a definition therefore runs on the boss's model and saves
  nothing.
- Use the helper `mk-boss-flash` (`model: flash`). It names the tier, not a
  model, so it runs on whichever of Gemini 4 Hydrogen or Gemini 3.8 Flash the
  signed-in account maps to `flash` (tested on one account: Hydrogen, see
  below). Its definition is `helpers/antigravity/mk-boss-flash.md` in this
  skill. Antigravity reads subagent definitions from
  `~/.gemini/config/agents/`, not from the skill folder, so copy or link the
  file there (as for `mk-boss-pro.md`, see Upward): `install.sh` does this
  for Antigravity. It is a subagent-only definition, so
  `agy agents` (which lists main agents) does not show it; check that the file
  exists. If it is missing, create the same definition with `define_subagent`
  for this session and tell the user. Tested 2026-11-19 (agy 1.5.12):
  `invoke_subagent` with role `mk-boss-flash` ran, and its transcript
  records the model `gemini-4-hydrogen-tiered-high` on the tested account (boss
  on `gemini-4-hydrogen-low`).
- Follow-up: `send_message` to the subagent's ID. An idle subagent keeps its
  context and wakes on a message. A killed subagent cannot be woken;
  `invoke_subagent` always starts a fresh one.
- At most 5 helpers at once (a sensible default; adjust). The documentation
  states no limit.

## The boss's role here

1. Model: it comes from the agent definition only. Always use
   `mk-boss-flash`; a helper without a definition inherits the boss's model.
2. Orientation and searches: `mk-boss-flash`, report of at most 40 lines.
3. Chores (only when the user asked for them: commit, push, pull, PR, changelog, lint): one bundled
   assignment to `mk-boss-flash`. Execution and mechanical work go to it too.
4. Writers: by default a subagent leaves its changes in the working tree and
   reports the changed files; it commits or pushes only when the user asked or
   the repository's instructions say so, and then reports the SHA. Each parallel writer gets its own files.
5. Corrections: a rejected result goes back with `send_message` to the same
   subagent's ID. There is no higher rung with a helper below the boss: after
   one failed correction the boss consults upward (trigger 5 of section 3 of
   the skill), rewrites the assignment more precisely or asks the user. The
   boss never takes the task over.
6. Effort: not under the boss's control (see the ladder section).

## Upward

Section 3 of the skill says when. A subagent helper only helps if its tier
resolves above the boss, and that depends on the account.

- First check what `pro` resolves to. Tested 2026-11-19 (agy 1.5.12, boss on
  `gemini-4-hydrogen-low`, one account): the transcripts of the two helpers
  record `mk-boss-pro` on `gemini-4-hydrogen-tiered-xhigh` and
  `mk-boss-flash` on `gemini-4-hydrogen-tiered-high` (find them in
  `~/.gemini/antigravity-cli/brain/<conversation>/.system_generated/logs/
  transcript.jsonl`, field `"model"`). So on that account `pro` was Hydrogen at
  higher effort, not a stronger model, and `mk-boss-pro` is not a real upward
  consult for a Hydrogen boss. Ask the helper to begin with `Running on: ...`,
  but it does not know its model ID, so the transcript is the evidence.
- Working upward mechanism: a separate one-shot process on a stronger model,
  `agy --model gemini-4-neon-high --mode plan --output-format json
  -p="<question>"`. Attach the prompt to the flag with `=`: `-p --model ...`
  makes `-p` take `--model` as the prompt. The process has no conversation, so
  the question carries the context; for an Expert it says "read-only" and
  "report at most 40 lines". Tested 2026-11-19 (agy 1.5.12): it ran and the
  transcript records `gemini-4-neon-high`.
- Whom to ask: a Hydrogen or 3.8 Flash boss asks `gemini-4-neon-high`, then
  `gemini-4-argon-high`. A Neon boss asks `gemini-4-argon-high` (or Carbon if
  `agy models` lists it). An Argon boss has nobody listed above. A Claude boss
  served by Antigravity follows the Claude ladder through `agy --model
  claude-opus-5-5-high` (untested).
- `mk-boss-pro` (`helpers/antigravity/mk-boss-pro.md`, `model: pro`,
  copied into `~/.gemini/config/agents/` by `install.sh`) ran in the 2026-11-19
  test. Use it only when the transcript shows `pro` above the boss's model.
- Alternative topology: the built-in "Orchestrator (Neon)" and "Orchestrator
  (Argon)" models (`gemini-pro-orchestrator-neon`,
  `gemini-pro-orchestrator-g1-pro`) pair a strong planner with a Hydrogen
  implementer. When you start in one of them, that replaces this skill's
  delegation. Not tested.

## Ladder in practice

| Boss | May delegate work to | Consult upward |
|---|---|---|
| Gemini 4 Argon (`gemini-4-argon-*`) | `mk-boss-flash` for execution, mechanical work and chores; judgement stays with the boss | nobody listed above |
| Gemini 4 Neon (`gemini-4-neon-*`) | `mk-boss-flash` for execution, mechanical work and chores | `agy --model gemini-4-argon-high -p=...` |
| Gemini 4 Hydrogen or Gemini 3.8 Flash (`gemini-4-hydrogen-*`, `gemini-3.8-flash-*`) | nobody; same rung, work alone | `agy --model gemini-4-neon-high -p=...`, then Argon |
| Claude or other non-Gemini model served by Antigravity | `mk-boss-flash` only (assumption that the Flash tier costs less) | `agy -p` on the next Claude rung (untested) |

Effort is part of the session's model ID (`gemini-4-argon-high`) or the
`--effort` flag. The documentation gives no effort setting for a subagent
definition, so the effort of a helper is not under the boss's control.

Model availability depends on the signed-in Google account. On the account
tested (agy 1.5.12, 2026-11-19) `agy models` listed `gemini-4-neon-*`, `gemini-4-argon-*`,
`gemini-4-hydrogen-*`, `gemini-3.8-flash-*`, `claude-opus-5-5-*`,
`claude-sonnet-5-5-*`, `gpt-oss-120b-medium` and two Orchestrator models; no
Carbon. Google positions Neon between Hydrogen and Carbon (Google blog and
model card for Gemini 4 Neon). Hydrogen and 3.8 Flash are one rung.

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
  in the conversation (section 6 of the skill).
