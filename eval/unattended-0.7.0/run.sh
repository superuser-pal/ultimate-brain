#!/bin/bash
# Run the unattended catch-up scenarios blind and keep their traces (CC-64, decision 0051).
#
#   npm run build                              once, so the brain shim has a CLI to run
#   eval/unattended-0.7.0/run.sh               builds every brain, runs each in a fresh `claude -p`, then the attended follow-up
#   eval/unattended-0.7.0/run.sh mixed-on ...  only these scenarios (the attended follow-up needs mixed-ask)
#   COLLECT_ONLY=1 eval/unattended-0.7.0/run.sh  collect the traces again from the brains of the last run, running nothing
#
# Output: eval/unattended-0.7.0/runs/<scenario>/ with reply.md (what the agent said), commits.txt, log.txt (the catch-up
# log line), status.txt (`brain status` unattended), changes.txt (files changed), fix-text.txt (where the text of a waiting
# What to fix appears in the brain's own notes, not the shipped skills: empty means nowhere, so nothing was interpreted into a
# note or a proposal), report-rows.txt (how many unattended Report rows its Notion writes hold) and writes.md (what it would
# have written to Notion).
#
# A scenario whose `claude -p` exits with an error, or whose reply says a limit was hit, is INCOMPLETE: it is listed at the
# end and the script exits 1, so a run cut short is never taken for a reproduction.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
B="${UB_EVAL_DIR:-/tmp/ub-eval-0.7.0}"
OUT="$HERE/runs"
export UB_EVAL_DIR="$B"
SCENARIOS=(noop noop-connected budget mixed-on mixed-reports-off mixed-ask requests)
if [ $# -gt 0 ]; then SCENARIOS=("$@"); fi
COLLECT_ONLY="${COLLECT_ONLY:-}"
if [ -z "$COLLECT_ONLY" ]; then
  if [ $# -eq 0 ]; then python3 "$HERE/setup.py" all >/dev/null || exit 1; else for s in "$@"; do python3 "$HERE/setup.py" "$s" >/dev/null || exit 1; done; fi
fi
export PATH="$B/bin:$PATH"
mkdir -p "$OUT" "$B/exit"

AWAY="The user is away and cannot be asked anything. There is no git remote and no Notion in this session."
sim() {
  echo "Notion isn't connected in this session and no Notion tools exist. Treat these files as the Notion tools' answers: $B/$1-sim/snapshot.json holds the rows of every configured database in the shape sync plan takes; $B/$1-sim/meetings.json is the Meetings database (Brain Status, Date, Project, Attendees, page_text); there are no Inbox rows to take in and no Ask rows. Wherever the skill would write to Notion with its tools (create or update a page, set a property, create a Report row), append one line saying exactly what you would write to $B/$1-sim/writes.md and treat the write as done. The user is away and cannot be asked anything. There is no git remote."
}
claude_in() { # name, dir, prompt, outfile: keeps the output, and the exit status for the end
  (cd "$2" && claude -p "$3" --permission-mode bypassPermissions --strict-mcp-config --mcp-config "$B/no-mcp.json" --add-dir "$B" > "$4" 2>&1; echo $? > "$B/exit/$1")
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

if [ -z "$COLLECT_ONLY" ]; then
  for s in "${SCENARIOS[@]}"; do rm -rf "${OUT:?}/$s" "$B/exit/$s"; git -C "$B/$s" rev-parse HEAD > "$B/$s.base"; done
  for s in "${SCENARIOS[@]}"; do
    mkdir -p "$OUT/$s"
    if [ -d "$B/$s-sim" ]; then P="catch up unattended. $(sim "$s")"; else P="catch up unattended. $AWAY"; fi
    claude_in "$s" "$B/$s" "$P" "$OUT/$s/reply.md" &
  done
  wait
fi

for s in "${SCENARIOS[@]}"; do
  d="$B/$s"; o="$OUT/$s"; base="$(cat "$B/$s.base")"; mkdir -p "$o"
  git -C "$d" log --format='%s' "$base"..HEAD > "$o/commits.txt"
  git -C "$d" diff --name-status "$base" HEAD | grep -v -e ' index.md$' -e ' log/' > "$o/changes.txt" || true
  grep -h 'catch-up' "$d"/log/*.md > "$o/log.txt" 2>/dev/null || true
  brain status --brain "$d" --json | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['data']['unattended']))" > "$o/status.txt"
  git -C "$d" grep -n -e '90000 EUR' -e 'left Acme in June' -- . ':(exclude).agents' ':(exclude).claude' ':(exclude)AGENTS.md' > "$o/fix-text.txt" || true
  [ -f "$B/$s-sim/writes.md" ] && { grep -c -E 'Catch-up [0-9]+ [A-Z][a-z]+:' "$B/$s-sim/writes.md" > "$o/report-rows.txt" || true; }
  [ -f "$B/$s-sim/writes.md" ] && cp "$B/$s-sim/writes.md" "$o/writes.md"
done

# The next attended catch-up opens with what the scheduled runs did. It is stopped after its batch of questions.
case " ${SCENARIOS[*]} " in
  *" mixed-ask "*)
    if [ -z "$COLLECT_ONLY" ]; then
      rm -rf "$OUT/attended-opening" "$B/exit/attended-opening"; mkdir -p "$OUT/attended-opening"
      claude_in attended-opening "$B/mixed-ask" "catch up. $(sim mixed-ask) For this test only: do the read-only pass and write the batch of questions exactly as you would show it to the user, then stop: apply, ingest and publish nothing, commit nothing. Print the batch." "$OUT/attended-opening/reply.md"
      git -C "$B/mixed-ask" status --short > "$OUT/attended-opening/tree-after.txt"
    fi
    ;;
esac
redact

incomplete=()
for s in "${SCENARIOS[@]}" attended-opening; do
  [ -f "$OUT/$s/reply.md" ] || continue
  code="$(cat "$B/exit/$s" 2>/dev/null || echo missing)"
  if [ "$code" != "0" ] || grep -q -i -e 'session limit' -e 'usage limit' -e 'rate limit' "$OUT/$s/reply.md"; then incomplete+=("$s (claude exit $code)"); fi
done
if [ ${#incomplete[@]} -gt 0 ]; then
  echo "INCOMPLETE, run these again: ${incomplete[*]}" >&2
  exit 1
fi
echo "traces in $OUT"
