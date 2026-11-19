# Orkiestra in Cursor (IDE and `cursor-agent` CLI)

Based on `cursor-agent models` and the Cursor subagents documentation. Tested
2026-11-19 with cursor-agent 2026.11.19-f005e9d in headless runs
(`cursor-agent -p --mode ask`): delegation down is untested, consultation up is
partly tested, the IDE is untested.

## How to delegate

- Example pairing: Grok 4.7 (`grok-4.7-*`) is the boss, Composer 2.5
  (`composer-2.5`) is the subagent. Edit it to the models you have (see
  section 11 of `SKILL.md`). A session started on a Claude-family model
  follows the Claude ladder order (Fable, Opus, Sonnet) with the Cursor ids in
  `ladders.toml` (`cursor.claude_rung`), and Composer 2.5 as the chores rung.
- A subagent's model comes from its definition file (`model:` in the
  frontmatter; default `inherit`, the boss's model). Use the subagent
  `mk-orkiestra-composer`, defined in
  `helpers/cursor/mk-orkiestra-composer.md` in this skill. Cursor reads
  subagent definitions from `~/.cursor/agents/`, not from the skill folder, so
  copy or link the file there: `install.sh` does this for Cursor.
- Start it with the Task tool, with `/mk-orkiestra-composer <assignment>`, or by
  writing "Use the mk-orkiestra-composer subagent to …". Several Task calls in one
  message run in parallel. At most 2 at once.
- In `cursor-agent` the Task tool takes an optional `model` and a fixed list of
  `subagent_type` values; in the tested version `mk-orkiestra-advisor` was not in that
  list, so the helper was not invocable by name there. Pass `model` directly
  (allowed slugs: see `task_model_slugs` in `ladders.toml`; `composer-2.5` is
  one). Whether the same limit applies to `orkiestra-composer` and to the IDE
  was not tested.
- A subagent starts with a clean context: the assignment must carry everything
  it needs.
- Follow-up: each run returns an agent ID; "Resume agent <id> and …" continues
  it with its context.

## The boss's role here

1. Model: it comes from the definition file. Always delegate through
   `mk-orkiestra-composer`, never through an undefined helper: it would inherit
   the boss's model.
2. Orientation and searches: `mk-orkiestra-composer`, report of at most 40 lines.
   Effort cannot be set.
3. Chores (only when the user asked for them: commit, push, pull, PR, changelog, lint): one bundled
   assignment to `mk-orkiestra-composer`. Execution and mechanical work go to it
   too; it is the only rung below the boss.
4. Writers: by default a subagent leaves its changes in the working tree and
   reports the changed files; it commits or pushes only when the user asked or
   the repository's instructions say so, and then reports the SHA. Subagents share one checkout, so each parallel writer gets its own
   files.
5. Corrections: a rejected result goes back with "Resume agent <id>" to the
   same subagent. There is no higher rung below the boss: after one failed
   correction the boss consults upward (trigger 5 of section 3 of the skill),
   rewrites the assignment more precisely or asks the user. The boss never
   takes the task over.
6. Effort: not settable for Composer 2.5.

## Upward

Section 3 of the skill says when.

- Helper `mk-orkiestra-advisor` (`helpers/cursor/mk-orkiestra-advisor.md`,
  copied into `~/.cursor/agents/` by `install.sh`): `model: claude-opus-5-5-medium`, `readonly: true`.
  Start it like the composer helper (`/mk-orkiestra-advisor <question>` or "Use
  the mk-orkiestra-advisor subagent to ..."). It answers one question or does one
  read-only review in at most 40 lines. A Fable id needs the user's yes first.
- In `cursor-agent`: Task with `model: "claude-opus-5-5-medium"` and a prompt
  that carries the full question, says "read-only" for an Expert, and asks the
  answer to begin with `Running on: <model>`.
- Cursor has been reported to fall back silently to the session model when a
  model is blocked by the plan. The helper is told to begin with
  `Running on: ...`; if that line names your own model, the upward call did not
  happen: tell the user and do not count it as a consultation.

Tested 2026-11-19 (cursor-agent 2026.11.19-f005e9d,
`cursor-agent -p --model composer-2.5 --mode ask`):
- Task with `model: "claude-opus-5-5-medium"` was accepted and the subagent
  answered "Running on: Claude Opus 5.5" (self-report; the stream carries no
  usage per model): works, evidence is the accepted slug plus the self-report.
- `claude-opus-5-5-high` was refused: the Task `model` accepts only a short
  list of slugs. The helper therefore names the `-medium` id.
- `mk-orkiestra-advisor` as `subagent_type` was refused in `cursor-agent` (fixed
  enum). The helper file exists and is visible; invoking it by name was not
  proven in the CLI and not tried in the IDE.

## Ladder in practice

| Boss | May delegate work to | Consult upward |
|---|---|---|
| Grok 4.7 | `mk-orkiestra-composer` for execution, mechanical work and chores; judgement stays with the boss | `mk-orkiestra-advisor` (Claude Opus 5.5); Fable only with the user's yes |
| Composer 2.5 | nobody; work alone | `mk-orkiestra-advisor` (Claude Opus 5.5); Fable only with the user's yes |
| Fable (Claude family) | `claude-opus-5-5-medium` (judgement), `claude-sonnet-5-5-high` (execution), `composer-2.5` (mechanical work and chores) | nobody |
| Opus (Claude family) | `claude-sonnet-5-5-high` (execution, judgement at high), `composer-2.5` (mechanical work and chores) | Fable ids, user's yes first |
| Sonnet (Claude family) | `composer-2.5` (mechanical work and chores); the boss does the remaining execution | Opus, then Fable (user's yes first) |
| any other model | nobody, unless the user names the subagent model | `mk-orkiestra-advisor` |

`cursor-agent models` may also list `gemini-4-neon-*`,
`gemini-4-hydrogen-*`, `gemini-4-carbon-*`, `gemini-4-argon-*` and
`gemini-3.8-flash-*`. They are not on the ladder and their relative cost is
unknown. Use them as subagent models only if the user says so.

## Known pitfalls

- Each subagent uses its own tokens; five in parallel cost about five times one.
  A simple task is slower in a subagent than done directly.
- Subagents share the boss's checkout. Two writers on the same files collide.
- Subagents nest one level only.
- On a legacy request-based plan without Max Mode, subagents run on Composer
  whatever the definition says. A model blocked by the plan falls back silently.
- Production writes and deploys: the boss runs them after the user's consent
  in the conversation (section 6 of the skill).
