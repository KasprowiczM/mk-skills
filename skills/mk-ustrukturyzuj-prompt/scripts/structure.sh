#!/bin/bash
# mk-ustrukturyzuj-prompt: draft on stdin -> structured prompt on stdout.
# Never loses the text: on ANY problem (empty input, no mktemp, missing or
# failing CLI, timeout, empty answer, failed cleanup step) it prints the
# original draft unchanged and exits 0; on macOS it also shows a notification.
# Needs the Claude Code CLI (`claude`), installed and signed in. No python.
# Env: PROMPT_MASTER_MODEL (default sonnet), PROMPT_MASTER_CLAUDE (path to claude),
# PROMPT_MASTER_SKILLS_DIR (skills folder for the <available_skills> block; else
# the folder two levels above this script, i.e. the harness skills folder this
# skill is installed in, used only when it holds other */SKILL.md files). A
# failing skill list is dropped: the draft is still structured, without it.
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Read the draft first, byte for byte (the sentinel keeps trailing newlines).
DRAFT="$(cat; printf x)"
DRAFT="${DRAFT%x}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
INSTR="$DIR/../instructions.md"
MODEL="${PROMPT_MASTER_MODEL:-sonnet}"

notify() {
  osascript -e 'display notification "Could not structure the prompt; your text is unchanged." with title "Ustrukturyzuj prompt"' >/dev/null 2>&1
}

# <available_skills> block (max 60 skills, descriptions cut to 160 characters,
# block under 8000 characters), or nothing on any problem.
skills_block() {
  local dir="${PROMPT_MASTER_SKILLS_DIR:-}" f files own other=0
  if [ -z "$dir" ]; then
    dir="$(cd "$DIR/../.." 2>/dev/null && pwd)" || return 0
  fi
  [ -n "$dir" ] && [ -d "$dir" ] || return 0
  own="$(cd "$DIR/.." 2>/dev/null && pwd)"
  set -- "$dir"/*/SKILL.md
  [ -e "$1" ] || return 0
  for f in "$@"; do
    [ "$(cd "$(dirname "$f")" 2>/dev/null && pwd)" = "$own" ] || other=1
  done
  [ "$other" -eq 1 ] || return 0
  files="$(awk '
    function flush() {
      if (name != "") {
        d = desc; gsub(/[ \t]+/, " ", d)
        if (length(d) > 160) d = substr(d, 1, 159) "…"
        line = (d == "") ? name : name " — " d
        if (n < 60 && size + length(line) + 1 <= 8000) { out = out line "\n"; n++; size += length(line) + 1 }
      }
      name = ""; desc = ""
    }
    function val(v) {
      sub(/^[ \t]+/, "", v); sub(/[ \t\r]+$/, "", v)
      if (v ~ /^".*"$/ || v ~ /^\x27.*\x27$/) v = substr(v, 2, length(v) - 2)
      if (v == ">" || v == "|" || v == ">-" || v == "|-") v = ""
      return v
    }
    FNR == 1 { if (seen) flush(); seen = 1; infm = 0; done = 0 }
    !done && FNR == 1 && $0 ~ /^---[ \t\r]*$/ { infm = 1; next }
    infm && $0 ~ /^---[ \t\r]*$/ { infm = 0; done = 1; next }
    infm && $0 ~ /^name:/ { name = val(substr($0, 6)) }
    infm && $0 ~ /^description:/ { desc = val(substr($0, 13)) }
    END { flush(); printf "%s", out }
  ' "$@" 2>/dev/null)" || return 0
  [ -n "$files" ] || return 0
  printf '<available_skills>\n%s</available_skills>\n\n' "$files"
}

# Prints the structured prompt, or returns non-zero. Runs in a subshell.
structure() {
  local claude="${PROMPT_MASTER_CLAUDE:-}" c tmp pid wd rc out first last skills
  [ -n "$(printf '%s' "$DRAFT" | tr -d '[:space:]')" ] || return 1
  [ -r "$INSTR" ] || return 1
  if [ -z "$claude" ]; then claude="$(command -v claude 2>/dev/null)"; fi
  if [ -z "$claude" ] || [ ! -x "$claude" ]; then
    claude=""
    for c in "$HOME/.local/bin/claude" "$HOME/.claude/local/claude" /opt/homebrew/bin/claude /usr/local/bin/claude; do
      [ -x "$c" ] && claude="$c" && break
    done
  fi
  [ -n "$claude" ] || return 1

  tmp="$(mktemp -d)" || return 1
  [ -d "$tmp" ] || return 1
  trap 'rm -rf "$tmp"' EXIT
  skills="$(skills_block 2>/dev/null)" || skills=""
  { [ -z "$skills" ] || printf '%s' "$skills"; printf '<draft>\n'; printf '%s' "$DRAFT"; printf '\n</draft>\n'; } > "$tmp/msg" || return 1

  ( cd "$tmp" && exec "$claude" -p --model "$MODEL" \
      --system-prompt "$(cat "$INSTR")" \
      --tools "" \
      --setting-sources "" \
      --strict-mcp-config \
      --disable-slash-commands \
      --no-session-persistence \
      < "$tmp/msg" > "$tmp/out" 2>/dev/null ) &
  pid=$!
  ( sleep 90; kill "$pid" ) >/dev/null 2>&1 &
  wd=$!
  wait "$pid"; rc=$?
  pkill -P "$wd" 2>/dev/null; kill "$wd" 2>/dev/null; wait "$wd" 2>/dev/null
  [ "$rc" -eq 0 ] || return 1

  out="$(cat "$tmp/out")" || return 1
  out="${out#"${out%%[![:space:]]*}"}"        # trim leading whitespace
  [ -n "$out" ] || return 1
  # strip one wrapping code fence (first line ```lang, last line ```)
  case "$out" in
    *$'\n'*)
      first="${out%%$'\n'*}"; last="${out##*$'\n'}"
      if [[ "$first" == '```'* && "$last" == '```' ]]; then
        out="${out#*$'\n'}"; out="${out%$'\n'*}"
      fi ;;
  esac
  [ -n "$(printf '%s' "$out" | tr -d '[:space:]')" ] || return 1
  printf '%s\n' "$out"
}

if RESULT="$(structure 2>/dev/null)" && [ -n "$RESULT" ]; then
  printf '%s\n' "$RESULT"
else
  notify
  printf '%s' "$DRAFT"
fi
exit 0
