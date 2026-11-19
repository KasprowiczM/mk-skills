# Orkiestra in Claude Code and Claude Desktop (Code tab)

Written against the `Agent` tool schema. Tool parameters change between
versions: if a call fails, read the error and the current tool schema. Cowork
and cloud sessions do not read the personal skills folder, so the skill is not
available there.

## How to delegate

- Tool: `Agent`. Set `model` to `opus`, `sonnet` or `haiku` (only rungs below
  your own) and `effort` to `low`, `medium` or `high`. Choose both per
  task.
- `subagent_type`: `general-purpose` for work that edits or runs things,
  `Explore` for read-only searches across many files.
- Subagents run in the background and report when they finish. Send independent
  assignments in one message so they run in parallel. At most 4 at once.
- Follow-up: `SendMessage` to the same agent, addressed by the ID from its
  start result.

## The boss's role here

1. Model: always pass the Agent tool's `model`. When it is omitted the
   subagent inherits the boss's model and saves nothing. Never use
   `subagent_type: "fork"`: a fork always runs on the boss's model and ignores
   `model`.
2. Orientation and searches: `subagent_type: "Explore"`, `model: "haiku"`,
   `effort: "low"`, report of at most 40 lines.
3. Chores (only when the user asked for them: commit, push, pull, PR, changelog, lint): one bundled
   assignment to `general-purpose`, `haiku`, `low`.
4. Writers: by default a subagent leaves its changes in the working tree and
   reports the changed files; it commits or pushes only when the user asked or
   the repository's instructions say so, and then reports the SHA. Parallel writers that might touch the same files get
   `isolation: "worktree"`.
5. Corrections: a rejected result goes back with `SendMessage` to the same
   agent. After one failed correction, give the task to one rung higher if a
   higher rung exists below the boss. The boss never takes the task over.
6. Effort: set per call through `effort`.

## Known pitfalls

- Do not set the `name` parameter; if a call with `name` fails, omit it.
- Subagents have refused to write report files such as `findings-*.md`. Ask
  them to return the text and save it yourself if it must be kept.
- Subagents refuse production database writes and deploys on consent passed as
  a quotation, and the permission guard has also blocked their production
  reads. See section 5 of the skill: the boss does those.
- Start agents only on an explicit request from the user in the conversation
  (for example "orkiestra" or "delegate to cheaper models"). Loading this
  skill is not such a request. Without one, work alone and offer orchestration
  in one line. If your instructions forbid agents, work alone.
- Never read a background agent's transcript file. Wait for its report.

## Ladder in practice

| Boss | May delegate to |
|---|---|
| Fable / Mythos | `opus` (judgement), `sonnet` (execution, `medium`), `haiku` (mechanical work and chores, `low`) |
| Opus | `sonnet` (judgement at `high`, execution at `medium`), `haiku` (mechanical work and chores, `low`) |
| Sonnet | `haiku` (mechanical work and chores, `low`) |
| Haiku | nobody; work alone |
