# Orkiestra in Cursor (IDE and `cursor-agent` CLI)

Based on `cursor-agent models` and the Cursor subagents documentation.
UNTESTED: not tried in a live Cursor session.

## How to delegate

- Example pairing: Grok 4.7 (`grok-4.7-*`) is the boss, Composer 2.5
  (`composer-2.5`) is the subagent. Edit it to the models you have (see
  section 9 of `SKILL.md`).
- A subagent's model comes from its definition file (`model:` in the
  frontmatter; default `inherit`, the boss's model). Use the subagent
  `mk-orkiestra-composer`, defined in
  `helpers/cursor/mk-orkiestra-composer.md` in this skill. Cursor reads
  subagent definitions from `~/.cursor/agents/`, not from the skill folder, so
  copy or link the file there: `install.sh` does this for Cursor.
- Start it with the Task tool, with `/mk-orkiestra-composer <assignment>`, or by
  writing "Use the mk-orkiestra-composer subagent to …". Several Task calls in one
  message run in parallel. At most 2 at once.
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
   correction the boss rewrites the assignment more precisely or asks the
   user. The boss never takes the task over.
6. Effort: not settable for Composer 2.5.

## Ladder in practice

| Boss | May delegate to |
|---|---|
| Grok 4.7 | `mk-orkiestra-composer` for execution, mechanical work and chores; judgement stays with the boss |
| Composer 2.5 | nobody; work alone |
| any other model | nobody, unless the user names the subagent model |

`cursor-agent models` may also list `gemini-4-hydrogen-low`,
`-medium`, `-high` and `-xhigh`, `gemini-4-carbon-*`, `gemini-4-argon-*` and
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
  in the conversation (section 5 of the skill).
