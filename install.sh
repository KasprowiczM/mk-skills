#!/usr/bin/env bash
# Install mk-skills into the user-level skill folder of one or more agent harnesses.
# See README.md. Never overwrites an existing folder without --force.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$SCRIPT_DIR/skills"
STATE_DIR="${HOME}/.mk-skills"
MANIFEST="$STATE_DIR/manifest"

HARNESS=""
SKILL=""
DRY_RUN=0
LINK=0
FORCE=0

usage() {
  cat <<USAGE
Usage: install.sh --harness <claude|codex|antigravity|cursor|all> --skill <name|all> [options]

Options:
  --harness <name>   target harness (required)
  --skill <name>     skill folder name under skills/, or "all" (required)
  --dry-run          print the planned actions, change nothing
  --link             symlink to this checkout instead of copying
  --force            replace an existing folder or file (default: skip it)
  -h, --help         show this help

Skill folders: claude ~/.claude/skills, codex ~/.agents/skills,
antigravity ~/.gemini/config/skills, cursor ~/.cursor/skills.
Helper agent definitions (cursor, antigravity) go to ~/.cursor/agents and
~/.gemini/config/agents.
USAGE
}

die() { printf 'error: %s\n' "$*" >&2; exit 2; }

while [ $# -gt 0 ]; do
  case "$1" in
    --harness) [ $# -ge 2 ] || die "--harness needs a value"; HARNESS="$2"; shift 2 ;;
    --skill)   [ $# -ge 2 ] || die "--skill needs a value"; SKILL="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --link)    LINK=1; shift ;;
    --force)   FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "unknown argument: $1" ;;
  esac
done

[ -n "$HARNESS" ] || { usage >&2; die "--harness is required"; }
[ -n "$SKILL" ] || { usage >&2; die "--skill is required"; }
[ -n "${HOME:-}" ] || die "HOME is not set"

skills_dir_for() {
  case "$1" in
    claude)      echo "$HOME/.claude/skills" ;;
    codex)       echo "$HOME/.agents/skills" ;;
    antigravity) echo "$HOME/.gemini/config/skills" ;;
    cursor)      echo "$HOME/.cursor/skills" ;;
  esac
}

agents_dir_for() {
  case "$1" in
    antigravity) echo "$HOME/.gemini/config/agents" ;;
    cursor)      echo "$HOME/.cursor/agents" ;;
    *)           echo "" ;;
  esac
}

case "$HARNESS" in
  all) HARNESSES="claude codex antigravity cursor" ;;
  claude|codex|antigravity|cursor) HARNESSES="$HARNESS" ;;
  *) die "unknown harness: $HARNESS (use claude, codex, antigravity, cursor or all)" ;;
esac

if [ "$SKILL" = "all" ]; then
  SKILLS=""
  for d in "$SKILLS_SRC"/*/; do
    [ -f "${d}SKILL.md" ] && SKILLS="$SKILLS $(basename "$d")"
  done
  [ -n "$SKILLS" ] || die "no skills found in $SKILLS_SRC"
else
  case "$SKILL" in
    */*|.*|"") die "invalid skill name: $SKILL" ;;
  esac
  [ -f "$SKILLS_SRC/$SKILL/SKILL.md" ] || die "no such skill: $SKILL (see skills/)"
  SKILLS="$SKILL"
fi

say() { printf '%s\n' "$*"; }

record() { # harness skill path
  [ "$DRY_RUN" -eq 0 ] || return 0
  mkdir -p "$STATE_DIR"
  if [ -f "$MANIFEST" ]; then
    awk -F'|' -v p="$3" '$3 != p' "$MANIFEST" > "$MANIFEST.tmp" || true
    mv "$MANIFEST.tmp" "$MANIFEST"
  fi
  printf '%s|%s|%s\n' "$1" "$2" "$3" >> "$MANIFEST"
}

# place SRC DEST harness skill : copy or link SRC to DEST
place() {
  src="$1"; dest="$2"; h="$3"; s="$4"
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    if [ "$FORCE" -eq 0 ]; then
      say "skip    $dest (exists; use --force to replace)"
      SKIPPED=$((SKIPPED + 1))
      return 0
    fi
    if [ "$DRY_RUN" -eq 1 ]; then
      say "would replace $dest"
    else
      rm -rf "$dest"
    fi
  fi
  parent="$(dirname "$dest")"
  if [ "$LINK" -eq 1 ]; then
    say "$( [ "$DRY_RUN" -eq 1 ] && echo 'would link' || echo 'link   ') $dest -> $src"
    if [ "$DRY_RUN" -eq 0 ]; then mkdir -p "$parent"; ln -s "$src" "$dest"; fi
  else
    say "$( [ "$DRY_RUN" -eq 1 ] && echo 'would copy' || echo 'copy   ') $src -> $dest"
    if [ "$DRY_RUN" -eq 0 ]; then mkdir -p "$parent"; cp -R "$src" "$dest"; fi
  fi
  record "$h" "$s" "$dest"
  DONE=$((DONE + 1))
}

DONE=0
SKIPPED=0
for h in $HARNESSES; do
  sdir="$(skills_dir_for "$h")"
  adir="$(agents_dir_for "$h")"
  for s in $SKILLS; do
    say "== $h / $s"
    place "$SKILLS_SRC/$s" "$sdir/$s" "$h" "$s"
    if [ -n "$adir" ] && [ -d "$SKILLS_SRC/$s/helpers/$h" ]; then
      for f in "$SKILLS_SRC/$s/helpers/$h"/*.md; do
        [ -f "$f" ] || continue
        place "$f" "$adir/$(basename "$f")" "$h" "$s"
      done
    fi
  done
done

if [ "$DRY_RUN" -eq 1 ]; then
  say "dry run: nothing was changed ($DONE planned, $SKIPPED skipped)"
else
  say "done: $DONE installed, $SKIPPED skipped"
  [ "$DONE" -eq 0 ] || say "Start a new session in the harness so it picks up the skills."
fi
