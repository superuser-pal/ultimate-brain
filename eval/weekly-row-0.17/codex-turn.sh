#!/bin/sh
# Usage: codex-turn.sh <sandbox> <trace dir> <name> <the user's words> [<thread id to resume>]
# One blind `codex exec` turn for CC-371's evals, in <sandbox>/brain, without the user's Codex config (so no MCP server:
# Notion is notion-sim, RULES.md). Writes <trace dir>/<name>.jsonl (codex's events) and <name>.md (its last message),
# and prints the thread id.
set -e
S=$(cd "$1" && pwd); T="$2"; N="$3"; W="$4"; R="$5"
H=$(cd "$(dirname "$0")" && pwd); mkdir -p "$T"; T=$(cd "$T" && pwd)
P="Read $H/RULES.md first; the sandbox is $S. The user says: $W"
cd "$S/brain"
if [ -n "$R" ]; then
  codex exec resume "$R" "The user says: $W" --ignore-user-config --dangerously-bypass-approvals-and-sandbox --json -o "$T/$N.md" > "$T/$N.jsonl" 2>"$T/$N.err" </dev/null || true
else
  codex exec "$P" --ignore-user-config --dangerously-bypass-approvals-and-sandbox --add-dir "$H" --json -o "$T/$N.md" > "$T/$N.jsonl" 2>"$T/$N.err" </dev/null || true
fi
grep -o '"thread_id":"[^"]*"' "$T/$N.jsonl" | head -1
