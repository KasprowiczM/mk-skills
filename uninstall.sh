#!/usr/bin/env bash
# Remove only what install.sh installed (recorded in ~/.mk-skills/manifest).
set -euo pipefail

STATE_DIR="${HOME:?HOME is not set}/.mk-skills"
MANIFEST="$STATE_DIR/manifest"
HARNESS="all"
SKILL="all"
DRY_RUN=0

usage() {
  cat <<USAGE
Usage: uninstall.sh [--harness <claude|codex|antigravity|cursor|all>] [--skill <name|all>] [--dry-run]

Removes only the folders, links and helper files that install.sh recorded.
Entries recorded by 0.2.x under the old names (mk-orkiestra, mk-ustrukturyzuj-prompt)
are removed too, also with --skill mk-boss / mk-prompt. Anything else in your skill folders is left alone. A Quick Action installed from
a skill copy that is being removed is removed with it.
USAGE
}

die() { printf 'error: %s\n' "$*" >&2; exit 2; }

while [ $# -gt 0 ]; do
  case "$1" in
    --harness) [ $# -ge 2 ] || die "--harness needs a value"; HARNESS="$2"; shift 2 ;;
    --skill)   [ $# -ge 2 ] || die "--skill needs a value"; SKILL="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "unknown argument: $1" ;;
  esac
done

if [ ! -f "$MANIFEST" ]; then
  echo "nothing to do: no install record at $MANIFEST"
  exit 0
fi

# Remove a Quick Action (macOS Service) that was installed from the skill copy
# being removed, i.e. whose command points at that copy's structure.sh.
quick_action_cleanup() {
  local p="$1" real wf found=0
  [ -f "$p/scripts/structure.sh" ] || return 0
  real="$(cd -P "$p" 2>/dev/null && pwd)" || real="$p"
  for wf in "$HOME/Library/Services"/*.workflow; do
    [ -f "$wf/Contents/document.wflow" ] || continue
    if grep -qF -e "$p/scripts/structure.sh" -e "$real/scripts/structure.sh" "$wf/Contents/document.wflow"; then
      found=1
      if [ "$DRY_RUN" -eq 1 ]; then echo "would remove Quick Action $wf"; else rm -rf "$wf"; echo "removed Quick Action $wf"; fi
    fi
  done
  if [ "$found" -eq 1 ] && [ "$DRY_RUN" -eq 0 ] && [ -x /System/Library/CoreServices/pbs ]; then
    /System/Library/CoreServices/pbs -update >/dev/null 2>&1 || true
  fi
  return 0
}

REMOVED=0
KEEP="$MANIFEST.keep"
: > "$KEEP"
while IFS='|' read -r h s p; do
  [ -n "$p" ] || continue
  # 0.2.x installs recorded the old skill names; treat them as the renamed skills.
  case "$s" in mk-orkiestra) s2=mk-boss ;; mk-ustrukturyzuj-prompt) s2=mk-prompt ;; *) s2="$s" ;; esac
  if { [ "$HARNESS" = "all" ] || [ "$HARNESS" = "$h" ]; } && { [ "$SKILL" = "all" ] || [ "$SKILL" = "$s" ] || [ "$SKILL" = "$s2" ]; }; then
    case "$p" in
      "$HOME"/?*) ;;
      *) echo "skip    $p (outside HOME)"; printf '%s|%s|%s\n' "$h" "$s" "$p" >> "$KEEP"; continue ;;
    esac
    quick_action_cleanup "$p"
    if [ -e "$p" ] || [ -L "$p" ]; then
      if [ "$DRY_RUN" -eq 1 ]; then echo "would remove $p"; else rm -rf "$p"; echo "removed $p"; fi
      REMOVED=$((REMOVED + 1))
    else
      echo "absent  $p"
    fi
    [ "$DRY_RUN" -eq 0 ] || printf '%s|%s|%s\n' "$h" "$s" "$p" >> "$KEEP"
  else
    printf '%s|%s|%s\n' "$h" "$s" "$p" >> "$KEEP"
  fi
done < "$MANIFEST"

if [ "$DRY_RUN" -eq 1 ]; then
  rm -f "$KEEP"
  echo "dry run: nothing was changed ($REMOVED would be removed)"
  exit 0
fi

if [ -s "$KEEP" ]; then mv "$KEEP" "$MANIFEST"; else rm -f "$KEEP" "$MANIFEST"; rmdir "$STATE_DIR" 2>/dev/null || true; fi
echo "done: $REMOVED removed"
