#!/usr/bin/env bash
# Lightweight reminder after code edits. Non-blocking (exit 0 always).
# - If a .ts/.tsx file was touched: nudge to run `npm run typecheck`.
# - If a supabase migration was touched: nudge to run `npm run check:rls`.
# - If env.example changed: nudge to sync deploy docs.
set -euo pipefail

payload="$(cat)"

if command -v jq >/dev/null 2>&1; then
  path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_input.path // ""')"
else
  path="$(printf '%s' "$payload" \
    | grep -oE '"(file_path|path)"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -n1 \
    | sed -E 's/.*"(file_path|path)"[[:space:]]*:[[:space:]]*"(.*)"/\2/')"
fi

[ -z "$path" ] && exit 0

hints=()

case "$path" in
  *.ts|*.tsx)
    hints+=("Touched a TS file — consider: npm run typecheck")
    ;;
esac

case "$path" in
  */supabase/migrations/*)
    hints+=("Touched a migration — consider: npm run check:rls")
    ;;
esac

case "$path" in
  */env.example|env.example)
    hints+=("env.example changed — remember to update docs/deploy.md if you added/removed a var")
    ;;
esac

case "$path" in
  */package.json|package.json)
    hints+=("package.json changed — run: npm install (and commit package-lock.json if it moved)")
    ;;
esac

if [ ${#hints[@]} -gt 0 ]; then
  {
    echo "[.claude/post-edit-check]"
    for h in "${hints[@]}"; do echo "  - $h"; done
  } >&2
fi

exit 0
