# Orkiestra in Codex (CLI and Desktop)

Based on the Codex subagents and models documentation and the `spawn_agent`
tool schema. Both change: if a call fails, read the error and the current
schema. Requires the `multi_agent` feature.

## How to delegate

- Tool: `spawn_agent` with `task_name` (lowercase, digits, underscore),
  `message` (the assignment), `model` and `reasoning_effort`. Model and effort
  can be set directly in the call; no agent definition file is needed.
  Example: `task_name: "luna"`, `model: "gpt-6-luna"`,
  `reasoning_effort: "low"`, `fork_turns: "none"`.
- Always pass `fork_turns: "none"`. The default `"all"` copies the boss's whole
  conversation into the subagent, which is the expensive path. Put what the
  subagent needs into the assignment instead.
- Always pass `reasoning_effort` together with `model`. If you omit the effort,
  the subagent inherits the boss's (usually `high`).
- Follow-up to the same subagent: `followup_task` (starts a turn). `send_message`
  only delivers text and does not start a turn. `wait_agent` reports which
  agents have updates; `interrupt_agent` stops one; `list_agents` lists them.
- At most 2 subagents at once.

## The boss's role here

1. Model: set `model` and `reasoning_effort` in every `spawn_agent` call (see
   above).
2. Orientation and searches: `gpt-6-luna`, `low`, report of at most 40 lines.
3. Chores (only when the user asked for them: commit, push, pull, PR, changelog, lint): one bundled
   assignment to `gpt-6-luna`, `low`.
4. Writers: by default a subagent leaves its changes in the working tree and
   reports the changed files; it commits or pushes only when the user asked or
   the repository's instructions say so, and then reports the SHA. Parallel writers each get their own files (see pitfalls).
5. Corrections: a rejected result goes back with `followup_task` to the same
   subagent. After one failed correction, give the task to one rung higher if
   a higher rung exists below the boss. The boss never takes the task over.
6. Effort: set per call through `reasoning_effort`.

## Ladder in practice

| Boss | May delegate to |
|---|---|
| `gpt-6-astra` | `gpt-6.1-sol` (judgement), `gpt-6.1-terra` (execution, `medium`), `gpt-6-luna` (mechanical work and chores, `low`) |
| `gpt-6.1-sol` | `gpt-6.1-terra` (execution, `medium`), `gpt-6-luna` (mechanical work and chores, `low`) |
| `gpt-6.1-terra` | `gpt-6-luna` (mechanical work and chores, `low`) |
| `gpt-6-luna` | nobody; work alone |

Other models in the picker (`gpt-6-sol`, `gpt-5.6-*`, `gpt-6-chat-thinking`) are
not on the ladder. Do not delegate to them.

## Known pitfalls

- Verification cost. A boss that starts a separate verifier for every task and
  demands a proof file for every "done" can use a large share of the weekly
  limit in one session. One spot check by the boss per result; see section 4 of the skill.
- Do not use the `ultra` effort for subagents: it starts further subagents.
- Subagents inherit the boss's sandbox and approval settings. "Do not edit
  files" in an assignment is an instruction, not a read-only sandbox.
- In non-interactive runs an action that needs a new approval fails and the
  error returns to the boss.
- Parallel subagents that write to the same files collide. Parallelise reads;
  give each writer its own files.
- Production writes and deploys: the boss runs them after the user's consent
  in the conversation (section 5 of the skill).
