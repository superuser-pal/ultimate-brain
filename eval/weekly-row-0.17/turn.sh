#!/bin/sh
# Usage: turn.sh <sandbox> <trace dir> <name> <the user's words> [<session id to resume>]
# One blind `claude -p` turn for CC-371's evals, in <sandbox>/brain, with no MCP server (Notion is notion-sim, RULES.md),
# Sonnet as the schedule's default model. Writes <trace dir>/<name>.json (claude's JSON result) and prints its session id.
set -e
S=$(cd "$1" && pwd); T="$2"; N="$3"; W="$4"; R="$5"
H=$(cd "$(dirname "$0")" && pwd); mkdir -p "$T"
printf '{"mcpServers":{}}' > "$S/no-mcp.json"
P="Read $H/RULES.md first; the sandbox is $S. The user says: $W"
[ -n "$R" ] && P="The user says: $W"
cd "$S/brain"
claude -p "$P" ${R:+--resume "$R"} --model claude-sonnet-5-5 --max-budget-usd 6 --output-format json \
  --permission-mode bypassPermissions --strict-mcp-config --mcp-config "$S/no-mcp.json" --add-dir "$H" > "$T/$N.json" || true
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(j.session_id, "cost="+j.total_cost_usd, "turns="+j.num_turns, j.is_error?"ERROR "+j.subtype:"")' "$T/$N.json"
