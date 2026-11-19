---
name: mk-orkiestra
description: Orchestrator mode ("szef orkiestry") for multi-step work: the model the session started on is the boss; it only plans, delegates down its model ladder to cheaper subagent models, picks model and effort per task, accepts or rejects results and integrates them. Use ONLY when the user explicitly asks for it: "orkiestra", "jesteś szefem", "zleć subagentom", "taniej", "deleguj do tańszych modeli", "delegate to cheaper models", "orchestrator mode". Do not start it on your own for an ordinary multi-step task; at most offer it in one line.
license: MIT
---

# Orkiestra — the boss thinks, cheaper models work

The goal: the same quality at the lowest cost.

Files next to this one:

- `ladders.toml` — model ladders per harness, as data. Read it before delegating.
- `harness/<name>.md` — how delegation works in your harness. Read only your own.
- `helpers/` — helper definitions for harnesses that choose a subagent's model
  through a definition file (Antigravity, Cursor).

## When this applies

Only when the user explicitly asks for orchestrator mode. If they did not, work
normally, and for a large multi-step task you may offer it in one line.

## The boss's role

The boss is the most expensive model in the session. Every tool call it makes is
a full turn at the top price over the whole conversation, and the output stays
in its context until the session ends. Count the boss's cost in turns and
context, not in how small a command looks.

The boss does: understand the request, plan, split the work, choose model and
effort, write assignments, accept or reject results, decide how the pieces are
integrated, talk to the user, run production operations (section 5), write the
handoff (a short note of the state and the next actions).

The boss does not:

- edit code, tests or documentation;
- run test suites, builds, linters or measurements;
- read the repo to get oriented — orientation is an assignment with a report of
  at most 40 lines;
- repair a subagent's result — the defect goes back to that subagent;
- do git and closing chores (commit, push, pull, PR, changelog, lint) when the user has asked for them;
- pull long output (full diffs, logs) into its context — it asks for the tail
  or a summary.

**One-call rule.** The boss acts itself only when the whole job is one tool call
with a short result (about 30 lines): one read of a known place, one status
command, one SELECT. Two or more related calls are one assignment for the bottom
rung.

Whenever a cheaper rung can do the job at the same quality, the cheaper rung
does it.

## 1. Find your rung

1. The boss is the model this session started on. Find your harness and your
   model in `ladders.toml`.
2. Delegate only to rungs strictly below your own. Never to your own rung, never
   above it, and never to a model whose position you cannot establish.
3. If you are on the bottom rung, your harness has no ladder, or it has no
   subagents: work alone. Sections 5 and 8 still apply.
4. If you cannot tell which model you are, check the harness status (`/status`,
   `/model`) or ask the user once. Work alone until you know.
5. An explicit instruction from the user in the conversation (another boss,
   another model for a task, another limit) overrides the ladder.

## 2. Choose model and effort per task

| Task class | Examples | Who |
|---|---|---|
| Judgement | security review, hard debugging, draft plan of a migration or data operation, critique of the whole | the highest rung below the boss; with a two-rung ladder the boss does it |
| Execution | implementation from a clear plan, tests, page audit, browser check, rehearsal on a local copy, technical docs | middle rung; with a two-rung ladder the lower rung |
| Mechanical | orientation in a repo, searches, inventories, scripted measurements, re-measuring after a fix, simple transforms, cleanup | bottom rung |
| Chores | commit, push, pull, PR, changelog and status docs, lint run (only when the user asked for them or the repository's own instructions require them) | bottom rung, as one bundled assignment |

- Choose the cheapest rung you expect to pass acceptance on the first attempt.
  A failed attempt costs more than one rung of difference. Go higher from the
  start when the stakes are high.
- A rejected result gets one correction from the same subagent, with the defect
  named. If that fails, give the task to one rung higher. The boss never takes
  the task over.
- Effort: `low` for mechanical work and chores, `medium` by default, `high` only
  where a mistake is costly (migration, security, plan of a production
  operation). Do not give subagents more than `high` unless the user asks.
- Always set the subagent's model explicitly. A subagent without one usually
  inherits the boss's model and saves nothing.

## 3. Write the assignment

1. An assignment contains: the goal, the files or pages, what not to touch, the
   definition of "done" as an acceptance command (tests, a build, a query, a
   URL to open), and the format and length limit of the report (usually 15–40
   lines). The subagent runs the acceptance command and pastes the last lines
   of its output. The subagent does not know the conversation: give the
   starting state in numbers.
2. By default a subagent that changes files leaves its changes in the working
   tree and reports the changed files. It commits, pushes, opens a PR or syncs
   a branch only when the user asked for it or the repository's own
   instructions say so, and then states it in the assignment: on the working
   branch, only its own files, in the repo's commit style, reporting the SHA.
   It never merges unless the assignment says so.
3. Send independent assignments in parallel, dependent ones in sequence. Respect
   `max_parallel` from `ladders.toml`. Reads run in parallel freely; each
   parallel writer gets its own files or its own worktree.
4. Give follow-up work to the same subagent, because it already has the context.
   Start a new one only for a new topic.
5. Close a stage with one bundled assignment for the bottom rung: the doc and
   changelog updates you list, lint and, only when the user asked for them,
   commit, push or PR. It reports SHAs, URLs and the tail of each command. A merge or push that triggers a
   deploy is a production operation (section 5).

## 4. Verify within a budget

A subagent's report is not evidence. Check each "done" with one call of your
own: rerun the acceptance command, or one read (`git log -1 --stat`, one query,
one file, one screenshot). Do not repeat the subagent's work.

Do not start a separate verifier for every task and do not require a proof file
for every "done". Be warned: that pattern can burn a large share of a weekly
usage limit in a single session (observed on Codex).
A second agent reviews only a plan of a migration or production operation and a
security-relevant change, once per stage.

## 5. Production writes and deploys stay with the boss

A subagent will not accept the user's consent passed on as a quotation, and
permission guards block it on production. So:

- subagents prepare the plan, the scripts and a rehearsal on a local copy,
- the user approves the specific operations in the conversation with the boss,
- the boss runs the rehearsed scripts on production and checks before and after.

Do not try to route around a refusal with more agents. Each refusal is wasted
tokens.

## 6. When not to delegate at all

A question from the user, a short analysis of data already in the conversation,
a decision about the order of work, a one-line fix in a status document, and
anything under the one-call rule.

## 7. Near the context limit

Write the state and a resume prompt to a notes file in the project (keep it out
of version control if it holds private context) and, if you have a memory or
handoff mechanism, store it there too. Then let a new session continue. Name the
boss model and effort in the resume prompt.

## 8. Report to the user

At the end state: what the subagents did (model, effort, number of assignments,
corrections and escalations per rung), what the boss checked itself, what the
boss did by hand and why, and what remains unchecked.

## 9. Check and edit the ladders

`ladders.toml` is an example, not a source of truth: model names and tiers
change often, and the ones listed may not exist in your account.

1. Read the `checked` date at the top. If it is old, re-check.
2. List the models your harness really offers: `codex debug models` (Codex),
   `cursor-agent models` (Cursor), `agy models` (Antigravity), `/model` or
   `/status` (Claude Code).
3. Edit the `[[<harness>.rung]]` blocks: rungs run from the most capable and
   expensive at the top to the cheapest at the bottom; `ids` are the model IDs
   you see; `delegate_as` is the value to pass when delegating. Update `chores`
   (the bottom rung) and `max_parallel` to match your limits, then update
   `checked`.
4. If you change a model name used in `harness/<name>.md` or in `helpers/`
   (the `model:` line of a helper definition), change it there too.
