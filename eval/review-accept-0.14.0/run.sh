#!/bin/bash
# Run the "no second yes" scenarios blind and keep their traces (CC-215, decision 0055, capture-and-review §7.3).
#
#   npm run build                                   once, so the brain shim has a CLI to run
#   UB_SKILLS_SRC=<fork>/brain eval/review-accept-0.14.0/run.sh          every scenario, with a skills fork's brain/ (optional)
#   eval/review-accept-0.14.0/run.sh exact held     only these scenarios
#   COLLECT_ONLY=1 eval/review-accept-0.14.0/run.sh collect the traces again from the brains of the last run, running nothing
#
# Output: eval/review-accept-0.14.0/runs/<scenario>/ with reply.md (what the agent said), commits.txt, changes.txt (files
# changed), note-diff.txt (the change to knowledge/ and projects/), proposals.txt (each proposal file the run changed, as it
# is now) and writes.md (what it would have written to Notion). A scenario is INCOMPLETE (listed at the end, exit 1) when its
# `claude -p` exited with an error, its reply says a limit was hit, or anything its collection needs is missing.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
B="${UB_EVAL_DIR:-/tmp/ub-eval-review-accept}"
OUT="${UB_EVAL_OUT:-$HERE/runs}"
export UB_EVAL_DIR="$B"
SCENARIOS=(exact held ambiguous revision catchup)
if [ $# -gt 0 ]; then SCENARIOS=("$@"); fi
COLLECT_ONLY="${COLLECT_ONLY:-}"
if [ -z "$COLLECT_ONLY" ]; then
  if [ $# -eq 0 ]; then python3 "$HERE/setup.py" all >/dev/null || exit 1; else for s in "$@"; do python3 "$HERE/setup.py" "$s" >/dev/null || exit 1; done; fi
fi
export PATH="$B/bin:$PATH"
mkdir -p "$OUT" "$B/exit"

sim() {
  echo "Notion isn't connected in this session and no Notion tools exist. Treat these files as the Notion tools' answers: $B/$1-sim/review.json is the result of querying the Review database (each row: page_id, last_edited_time, properties); $B/$1-sim/pages/<page_id>.json is one Review page as the tools return it: its last_edited_time, its properties and its body as Markdown (body_markdown); $B/$1-sim/snapshot.json holds the rows of every other configured database (none to take in). There are no meetings, Inbox rows or drop-folder files waiting. Wherever the skill would write to Notion (set or clear a property, replace a block's children, write a section, create a page), append one line saying exactly what you would write to $B/$1-sim/writes.md and treat the write as done; a page you read back after your own write is the same file as before. When you read a page again just before applying (the verification re-read, not the first read), read $1-sim/pages/<page_id>.reread.json instead if that file exists. There is no git remote."
}
USER_HERE="The user is here. If you need to ask them anything, ask it and end your reply: they will answer in their next message."
claude_in() { # name, dir, prompt, outfile
  (cd "$2" && claude -p "$3" --permission-mode bypassPermissions --strict-mcp-config --mcp-config "$B/no-mcp.json" --add-dir "$B" > "$4" 2>&1; echo $? > "$B/exit/$1")
}

redact() {
  python3 - "$OUT" <<'PY'
import pathlib, re, sys
uuid = re.compile(r"\b(?:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|[0-9a-f]{32})\b", re.I)
for path in pathlib.Path(sys.argv[1]).rglob("*"):
    if path.is_file():
        seen = {}
        text = "".join(line for line in path.read_text().splitlines(keepends=True) if not line.startswith("Warning: this sign-in ends"))
        path.write_text(uuid.sub(lambda m: f"<id {seen.setdefault(m.group(0).lower(), len(seen) + 1)}>", text))
PY
}

if [ -z "$COLLECT_ONLY" ]; then
  for s in "${SCENARIOS[@]}"; do rm -rf "${OUT:?}/$s" "$B/exit/$s"; git -C "$B/$s" rev-parse HEAD > "$B/$s.base"; done
  for s in "${SCENARIOS[@]}"; do
    mkdir -p "$OUT/$s"
    case "$s" in
      ambiguous) P="apply the Acme review. $USER_HERE $(sim "$s")" ;;
      catchup) P="catch up. $USER_HERE $(sim "$s")" ;;
      *) P="apply my reviews. $USER_HERE $(sim "$s")" ;;
    esac
    claude_in "$s" "$B/$s" "$P" "$OUT/$s/reply.md" &
  done
  wait
fi

collect() {
  local s="$1" d="$B/$1" o="$OUT/$1" base
  [ -f "$B/$s.base" ] && [ -d "$d/.git" ] && [ -f "$o/reply.md" ] || { echo "no earlier run of $s to collect" >&2; return 1; }
  base="$(cat "$B/$s.base")"
  git -C "$d" cat-file -e "$base^{commit}" 2>/dev/null || return 1
  git -C "$d" log --format='%s' "$base"..HEAD > "$o/commits.txt" || return 1
  git -C "$d" diff --name-status "$base" HEAD | grep -v -e ' index.md$' -e ' log/' > "$o/changes.txt" || true
  git -C "$d" diff "$base" HEAD -- knowledge projects > "$o/note-diff.txt" || return 1
  git -C "$d" status --porcelain > "$o/uncommitted.txt" || return 1
  : > "$o/proposals.txt"
  for f in $(git -C "$d" diff --name-only "$base" HEAD -- _proposals); do { echo "=== $f"; cat "$d/$f" 2>/dev/null || echo "(removed)"; } >> "$o/proposals.txt"; done
  [ -f "$B/$s-sim/writes.md" ] && cp "$B/$s-sim/writes.md" "$o/writes.md"
  return 0
}
incomplete=()
for s in "${SCENARIOS[@]}"; do collect "$s" || incomplete+=("$s (collection failed)"); done
[ -d "$OUT" ] && redact
for s in "${SCENARIOS[@]}"; do
  code="$(cat "$B/exit/$s" 2>/dev/null || echo missing)"
  if [ ! -f "$OUT/$s/reply.md" ]; then incomplete+=("$s (no reply)")
  elif [ "$code" != "0" ]; then incomplete+=("$s (claude exit $code)")
  elif grep -q -i -e 'session limit' -e 'usage limit' -e 'rate limit' "$OUT/$s/reply.md"; then incomplete+=("$s (a limit was hit)"); fi
done
if [ ${#incomplete[@]} -gt 0 ]; then echo "INCOMPLETE, run these again: ${incomplete[*]}" >&2; exit 1; fi
echo "traces in $OUT"
