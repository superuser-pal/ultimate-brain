#!/bin/bash
# Run the unattended catch-up scenarios blind and keep their traces (CC-64, decision 0051).
#
#   npm run build                              once, so the brain shim has a CLI to run
#   eval/unattended-0.7.0/run.sh               builds every brain, runs each in a fresh `claude -p`, then the attended follow-up
#   eval/unattended-0.7.0/run.sh mixed-on ...  only these scenarios (the attended follow-up needs mixed-ask)
#
# Output: eval/unattended-0.7.0/runs/<scenario>/ with reply.md (what the agent said), commits.txt, log.txt (the catch-up
# log line), status.txt (`brain status` unattended), writes.md (what it would have written to Notion) and changes.txt.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
B="${UB_EVAL_DIR:-/tmp/ub-eval-0.7.0}"
OUT="$HERE/runs"
export UB_EVAL_DIR="$B"
if [ $# -eq 0 ]; then python3 "$HERE/setup.py" all >/dev/null; else for s in "$@"; do python3 "$HERE/setup.py" "$s" >/dev/null; done; fi
export PATH="$B/bin:$PATH"
mkdir -p "$OUT"

SCENARIOS=(noop noop-connected budget mixed-on mixed-reports-off mixed-ask requests)
if [ $# -gt 0 ]; then SCENARIOS=("$@"); fi
for s in "${SCENARIOS[@]}"; do rm -rf "${OUT:?}/$s"; done
AWAY="The user is away and cannot be asked anything. There is no git remote and no Notion in this session."
sim() {
  echo "Notion isn't connected in this session and no Notion tools exist. Treat these files as the Notion tools' answers: $B/$1-sim/snapshot.json holds the rows of every configured database in the shape sync plan takes; $B/$1-sim/meetings.json is the Meetings database (Brain Status, Date, Project, Attendees, page_text); there are no Inbox rows to take in and no Ask rows. Wherever the skill would write to Notion with its tools (create or update a page, set a property, create a Report row), append one line saying exactly what you would write to $B/$1-sim/writes.md and treat the write as done. The user is away and cannot be asked anything. There is no git remote."
}
claude_in() { # dir, prompt, outfile
  (cd "$1" && claude -p "$2" --permission-mode bypassPermissions --strict-mcp-config --mcp-config "$B/no-mcp.json" --add-dir "$B" > "$3" 2>&1) || true
}

# Page ids and content hashes (the fixture's and the ones an agent makes up) become <id 1>, <id 2>, ... in every trace, so no
# id-shaped string is kept; the same one gets the same number within a file.
redact() {
  python3 - "$OUT" <<'PY'
import pathlib, re, sys
uuid = re.compile(r"\b(?:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|[0-9a-f]{32})\b", re.I)
for path in pathlib.Path(sys.argv[1]).rglob("*"):
    if path.is_file():
        seen = {}
        path.write_text(uuid.sub(lambda m: f"<id {seen.setdefault(m.group(0).lower(), len(seen) + 1)}>", path.read_text()))
PY
}

for s in "${SCENARIOS[@]}"; do git -C "$B/$s" rev-parse HEAD > "$B/$s.base"; done
for s in "${SCENARIOS[@]}"; do
  mkdir -p "$OUT/$s"
  if [ -d "$B/$s-sim" ]; then P="catch up unattended. $(sim "$s")"; else P="catch up unattended. $AWAY"; fi
  claude_in "$B/$s" "$P" "$OUT/$s/reply.md" &
done
wait

for s in "${SCENARIOS[@]}"; do
  d="$B/$s"; o="$OUT/$s"; base="$(cat "$B/$s.base")"
  git -C "$d" log --format='%s' "$base"..HEAD > "$o/commits.txt"
  git -C "$d" diff --name-status "$base" HEAD | grep -v -e ' index.md$' -e ' log/' > "$o/changes.txt" || true
  grep -h 'catch-up' "$d"/log/*.md > "$o/log.txt" 2>/dev/null || true
  brain status --brain "$d" --json | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['data']['unattended']))" > "$o/status.txt"
  [ -f "$B/$s-sim/writes.md" ] && cp "$B/$s-sim/writes.md" "$o/writes.md"
done

# The next attended catch-up opens with what the scheduled runs did. It is stopped after its batch of questions.
case " ${SCENARIOS[*]} " in *" mixed-ask "*) ;; *) redact; echo "traces in $OUT"; exit 0;; esac
rm -rf "$OUT/attended-opening"; mkdir -p "$OUT/attended-opening"
claude_in "$B/mixed-ask" "catch up. $(sim mixed-ask) For this test only: do the read-only pass and write the batch of questions exactly as you would show it to the user, then stop: apply, ingest and publish nothing, commit nothing. Print the batch." "$OUT/attended-opening/reply.md"
git -C "$B/mixed-ask" status --short > "$OUT/attended-opening/tree-after.txt"
redact
echo "traces in $OUT"
