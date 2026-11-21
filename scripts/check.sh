#!/usr/bin/env bash
# Pre-publish checks: marketplace validation, plugin validation, mod tests,
# and skills <-> marketplace entries. Run from anywhere.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST=.claude-plugin/marketplace.json
fail=0

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  echo "Usage: scripts/check.sh   (validates marketplace and plugins, tests mods, matches skills to entries)"; exit 0
fi
command -v claude >/dev/null 2>&1 || { echo "error: claude CLI not found" >&2; exit 1; }

echo "== marketplace"
claude plugin validate . --strict

echo "== plugin dirs"
for d in plugins/*/; do
  [ -f "$d.claude-plugin/plugin.json" ] || continue
  echo "-- $d"
  claude plugin validate "$d" --strict
done

echo "== mod tests"
for d in plugins/*/; do
  [ -d "$d/hooks" ] || continue
  echo "-- $d"
  (cd "$d" && claude plugin test .)
done

echo "== skills <-> marketplace entries"
if command -v jq >/dev/null 2>&1; then
  entries="$(jq -r '.plugins[] | select(.skills) | .skills[] | sub("^\\./skills/";"")' "$MANIFEST" | sort)"
  names="$(jq -r '.plugins[] | select(.skills) | .name' "$MANIFEST" | sort)"
else
  entries="$(python3 -c 'import json; [print(s[len("./skills/"):]) for p in json.load(open(".claude-plugin/marketplace.json"))["plugins"] for s in p.get("skills",[])]' | sort)"
  names="$(python3 -c 'import json; [print(p["name"]) for p in json.load(open(".claude-plugin/marketplace.json"))["plugins"] if p.get("skills")]' | sort)"
fi
dirs="$(for d in skills/*/; do [ -f "$d/SKILL.md" ] && basename "$d"; done | sort)"
if [ "$dirs" != "$entries" ]; then
  echo "MISMATCH: skills/ dirs vs marketplace skills entries" >&2
  diff <(echo "$dirs") <(echo "$entries") >&2 || true; fail=1
fi
if [ "$dirs" != "$names" ]; then
  echo "MISMATCH: skill plugin names must equal the skill dir names" >&2; fail=1
fi
[ "$fail" -eq 0 ] || exit 1
echo "ok: $(echo "$dirs" | wc -l | tr -d ' ') skills match their marketplace entries"
echo "ALL CHECKS PASSED"
