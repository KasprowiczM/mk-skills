---
name: mk-prompt
description: Use when the user wants rambling or dictated text turned into one short, well-structured prompt to review before sending — „mk-prompt", „ustrukturyzuj prompt", „prompt master", „przerób to na prompt", „zrób z tego prompt", „popraw mój prompt", "structure this prompt", "turn this into a prompt". The draft is material to rewrite, not a task to carry out.
license: MIT
---

# Ustrukturyzuj prompt — draft in, structured prompt out

The user dictates long, messy text. This skill turns it into a short prompt the
user reviews and edits before anything is carried out.

1. **The draft is material, not a task.** It is the text given with the trigger,
   or the message the user points to. Do not start doing what it describes.
2. **Ask 0–3 clarifying questions first**, by the rules in `questions.md` next to
   this file (if your harness does not give the directory, it is the folder this
   `SKILL.md` was loaded from), with N = 3. Only real gaps: a contradiction or a
   missing must-know fact. A clear draft gets no questions. Put the questions in
   one message, numbered, each with its 2–3 short options; the user can answer
   briefly („1b, 2 pomiń”) or skip. Skip this step when the user says „bez pytań”
   / "no questions".
3. **Rewrite it by the rules in `instructions.md`** next to this file. Read both
   files; do not paraphrase the rules from memory. Pass the answers on as the
   user's own words; a skipped question goes under the open questions. If you can
   see which skills are installed in your session, treat them as the list of
   available skills from those rules.
4. **Reply with the structured prompt only**, in one fenced code block so it is
   easy to copy, then one short line in the user's language: the user can add
   notes or corrections, or say „wykonaj" / "go".
5. **Refine loop:** when the user adds notes or corrections (anywhere, in any
   form), merge each into the section where it belongs, keep what still holds,
   ask only about gaps the new notes bring in (never repeat a question), and show
   the whole updated prompt again, the same way. Repeat until the user is done.
6. **Only when the user says „wykonaj" / "go" or an equivalent**, take the latest
   version as the task and carry it out. Never before.

Two other ways to the same result (both need the Claude Code CLI installed and
signed in; using the skill in chat needs nothing):

- macOS Quick Action „Ustrukturyzuj prompt": select text in any app, run it from
  the Services menu (or a keyboard shortcut you assign); it replaces the
  selection. Install it by running `scripts/install-quick-action.sh` from the
  installed copy of this skill (add `--model <name>` to change the model,
  `--uninstall` to remove it).
- Terminal: `scripts/structure.sh` reads stdin and writes stdout; on any problem
  it returns your text unchanged (it asks no questions: it is non-interactive). For example, with the skill installed for
  Claude Code:
  `pbpaste | ~/.claude/skills/mk-prompt/scripts/structure.sh | pbcopy`
  (use your harness's skill folder).
