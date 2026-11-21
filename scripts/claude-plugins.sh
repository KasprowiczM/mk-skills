#!/usr/bin/env bash
# Install, update and list the mk-skills plugins for Claude Code.
set -euo pipefail

MARKETPLACE_REPO="KasprowiczM/mk-skills"
MARKETPLACE_NAME="mk-skills"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT/.claude-plugin/marketplace.json"

usage() {
  cat <<'EOF'
Usage: scripts/claude-plugins.sh <command> [all|name...]

Commands:
  install [all|name...]   add the marketplace if missing, then install the plugins (user scope)
  update  [all|name...]   refresh the marketplace, then update the plugins
  list                    list the plugins offered by this marketplace

With no names, "all" is assumed. Run "list" to see the names.
Needs the Claude Code CLI (claude). Not called by install.sh.
EOF
}

die() { echo "error: $*" >&2; exit 1; }

names() {
  if command -v jq >/dev/null 2>&1; then
    jq -r '.plugins[].name' "$MANIFEST"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; [print(p["name"]) for p in json.load(open(sys.argv[1]))["plugins"]]' "$MANIFEST"
  else
    die "need jq or python3 to read $MANIFEST"
  fi
}

list_plugins() {
  if command -v jq >/dev/null 2>&1; then
    jq -r '.plugins[] | "\(.name)\t\(.description)"' "$MANIFEST"
  else
    python3 -c 'import json,sys; [print(p["name"]+"\t"+p.get("description","")) for p in json.load(open(sys.argv[1]))["plugins"]]' "$MANIFEST"
  fi
}

resolve() { # args -> one plugin name per line, validated
  local all; all="$(names)"
  if [ $# -eq 0 ] || [ "$1" = "all" ]; then echo "$all"; return; fi
  local n
  for n in "$@"; do
    printf '%s\n' "$all" | grep -qx -- "$n" || die "unknown plugin: $n (run: scripts/claude-plugins.sh list)"
    echo "$n"
  done
}

need_claude() { command -v claude >/dev/null 2>&1 || die "the claude CLI is not on PATH"; }

has_marketplace() { claude plugin marketplace list 2>/dev/null | grep -q "$MARKETPLACE_NAME"; }

cmd="${1:-}"
case "$cmd" in
  -h|--help|help|"") usage; [ -n "$cmd" ] || exit 1; exit 0 ;;
  list) list_plugins ;;
  install)
    shift; need_claude
    sel="$(resolve "$@")"
    has_marketplace || claude plugin marketplace add "$MARKETPLACE_REPO"
    while IFS= read -r p; do claude plugin install "$p@$MARKETPLACE_NAME" --scope user; done <<< "$sel"
    echo "Done. Start a new Claude Code session (or /reload-plugins)." ;;
  update)
    shift; need_claude
    sel="$(resolve "$@")"
    has_marketplace || claude plugin marketplace add "$MARKETPLACE_REPO"
    claude plugin marketplace update "$MARKETPLACE_NAME"
    while IFS= read -r p; do claude plugin update "$p@$MARKETPLACE_NAME" || echo "note: $p not installed or already current" >&2; done <<< "$sel"
    echo "Done. Restart Claude Code (or /reload-plugins) to load new versions." ;;
  *) usage >&2; die "unknown command: $cmd" ;;
esac
