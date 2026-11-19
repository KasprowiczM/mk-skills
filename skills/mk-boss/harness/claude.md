# Boss mode (orkiestra) in Claude Code and Claude Desktop (Code tab)

Written against the `Agent` tool schema; the upward part was tested on
2026-11-19 with Claude Code 2.1.328 in print mode and checked against
code.claude.com/docs/en/advisor and /sub-agents. Tool parameters change between
versions: if a call fails, read the error and the current tool schema. Cowork
and cloud sessions do not read the personal skills folder, so the skill is not
available there.

## How to delegate

- Tool: `Agent`. Set `model` to `opus`, `sonnet` or `haiku` (only rungs below
  your own for work) and `effort` to `low`, `medium` or `high`. Choose both per
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
   higher rung exists below the boss; if none does, consult upward (trigger 5
   of section 3 of the skill). The boss never takes the task over, except
   execution under the exception in section 2 (Sonnet over Haiku).
6. Effort: set per call through `effort`.

## Known pitfalls

- Do not set the `name` parameter; if a call with `name` fails, omit it.
- Subagents have refused to write report files such as `findings-*.md`. Ask
  them to return the text and save it yourself if it must be kept.
- Subagents refuse production database writes and deploys on consent passed as
  a quotation, and the permission guard has also blocked their production
  reads. See section 6 of the skill: the boss does those.
- Start agents only on an explicit request from the user in the conversation
  (for example "orkiestra" or "delegate to cheaper models"). Loading this
  skill is not such a request. Without one, work alone and offer orchestration
  in one line. If your instructions forbid agents, work alone.
- Never read a background agent's transcript file. Wait for its report.

## Upward

Section 3 of the skill says when. Two mechanisms; the user's setting decides
which one you use. The skill never edits settings.

1. **Built-in advisor tool** (experimental). The user turns it on with
   `/advisor <model>` (also in `-p`, the desktop app and Remote Control), the
   setting `advisorModel`, or `claude --advisor <model>` (not shown in
   `--help`). The advisor receives the whole conversation and the model decides
   when to consult it. The advisor must rank at or above the main model: Sonnet
   5.5 accepts Fable or Opus 5 and later; Opus 5 or 5.5 accepts Fable or Opus
   5 and later; Fable 5.2 accepts Fable 5.2 only. A Fable advisor may bill
   usage credits (one-time consent). It needs the Anthropic API (or the
   Claude Platform on AWS or Claude Models on Google Cloud). When the advisor
   is on, say "consult the advisor" at the trigger points. When it is not, tell
   the user once, in one line, that `/advisor opus` would make this cheaper,
   and use mechanism 2.
2. **Agent tool with a stronger model.** `Agent` with `model` set to the next
   rung up, `effort: "high"`, `subagent_type: "general-purpose"` (or `Explore`
   for a read-only look), never `fork`. The subagent sees only the prompt, so
   the question must carry the context (what you tried, in numbers, the
   options, the form of answer). An Expert call says "read-only" and "report at
   most 40 lines"; an Advisor call says "answer in a few hundred words, no
   tools". Fable needs the user's yes first.

Tested 2026-11-19 (Claude Code 2.1.328, print mode, read-only prompts):
- `claude -p --model sonnet --advisor opus --output-format json` was accepted
  and `modelUsage` listed `claude-opus-5-5` (about 72k input, 923 output
  tokens): confirmed, the advisor reads the whole conversation, so it costs
  more the longer the session is.
- A Sonnet session calling `Agent` with `model: "opus"` ran: `modelUsage`
  listed `claude-opus-5-5` (about 60k tokens in, 136 out) and
  `subagent_stats.spawned` was 1: confirmed. A subagent has a large fixed
  start-up context here, so ask only when the trigger applies.
- Not tested: a Fable advisor (consent), the desktop Code tab, `/advisor` in
  the desktop app.

## Ladder in practice

| Boss | May delegate work to | Consult upward (next rung first) |
|---|---|---|
| Fable / Mythos | `opus` (judgement), `sonnet` (execution, `medium`), `haiku` (mechanical work and chores, `low`) | nobody; section 3 does not apply |
| Opus | `sonnet` (judgement at `high`, execution at `medium`), `haiku` (mechanical work and chores, `low`) | `fable` (user's yes first; built-in advisor: Fable) |
| Sonnet | `haiku` (mechanical work and chores, `low`); the boss does the remaining execution | `opus`, then `fable` (user's yes first) |
| Haiku | nobody; work alone | `sonnet`, then `opus`, then `fable` (user's yes first) |

Mythos is for approved organisations and is never a delegation or consultation
target.
