#!/usr/bin/env bash
# Block pushes to main/master and force-push variants.
# Reads Claude Code PreToolUse hook payload from stdin.
set -euo pipefail

payload="$(cat)"

# Extract the shell command being run. jq is not guaranteed on every host,
# so fall back to a grep-based extractor.
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')"
else
  cmd="$(printf '%s' "$payload" \
    | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -n1 \
    | sed -E 's/.*"command"[[:space:]]*:[[:space:]]*"(.*)"/\1/')"
fi

[ -z "$cmd" ] && exit 0

# Normalize whitespace for matching.
normalized="$(printf '%s' "$cmd" | tr -s '[:space:]' ' ')"

if printf '%s' "$normalized" | grep -qE '(^| )git +push +(--force|-f)( |$)|(^| )git +push +[^ ]+ +[^ ]+ +--force'; then
  echo "BLOCKED: git force-push is not allowed. Push a normal commit instead." >&2
  exit 2
fi

if printf '%s' "$normalized" | grep -qE '(^| )git +push +origin +(main|master)( |$|:)'; then
  echo "BLOCKED: direct push to origin/main|master is not allowed on this repo." >&2
  echo "Push to a feature branch and open a PR." >&2
  exit 2
fi

exit 0
