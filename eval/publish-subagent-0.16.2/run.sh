#!/bin/bash
# CC-267's before/after catch-up (decision 0043's bar; eval/unattended-0.7.0's pattern).
#
#   npm run build                                               once, so the brain shim has a CLI to run
#   eval/publish-subagent-0.16.2/run.sh <skills-fork-checkout>  builds both brains, runs both in a fresh `claude -p`
#   COLLECT_ONLY=1 eval/publish-subagent-0.16.2/run.sh <checkout>  collects the traces of the last run again
#   VARIANTS=after COMPARE_BEFORE=<runs/pair-2/before> run.sh <checkout>  runs only `after`, its Tasks checked against an earlier before
#
# The two brains differ only in brain-catch-up's SKILL.md: `before` has the vendored one, `after` the fork branch's. Notion is
# a fake MCP server (notion-fake.mjs) that answers in Notion's shapes, so each reply costs what Notion's would; the database
# rows were "already read" into files, as in eval/unattended-0.7.0. Output, per variant, in runs/<variant>/: reply.md (the
# report), result.json's figures in measure.json (cost, calls, peak context, compactions, per transcript), writes.txt (each
# Notion write), tasks.txt (the Tasks created, by name), commits.txt, recorded.txt (the notes with a Notion page after the run) and render-after.txt
# (what a render would still write: empty when everything written was recorded).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
FORK="${1:?usage: run.sh <skills-fork-checkout at the CC-267 branch>}"
B="${UB_EVAL_DIR:-/tmp/ub-eval-cc267}"
OUT="${UB_EVAL_OUT:-$HERE/runs}"
export UB_EVAL_DIR="$B"
read -r -a VARIANTS <<< "${VARIANTS:-before after}"
if [ -z "${COLLECT_ONLY:-}" ]; then python3 "$HERE/setup.py" "$FORK" >/dev/null || exit 1; fi
export PATH="$B/bin:$PATH"
mkdir -p "$OUT" "$B/exit"

prompt() {
  echo "catch up unattended. Notion is the \`notion\` MCP server of this session (a test copy of the workspace): use its tools for every page read and every write. Its databases were already read for you, so query none of them to pull: $B/$1-sim/snapshot.json holds the rows of every configured database in the shape sync plan takes, as the pull found them; $B/$1-sim/meetings.json is the Meetings database (Brain Status, Date, Project, Attendees, page_text); $B/$1-sim/inbox.json is the Inbox (Kind, Brain Status, Project, page_text). The user is away and cannot be asked anything. There is no git remote."
}

if [ -z "${COLLECT_ONLY:-}" ]; then
  for v in "${VARIANTS[@]}"; do
    rm -rf "${OUT:?}/$v" "$B/exit/$v"; mkdir -p "$OUT/$v"
    (cd "$B/$v" && claude -p "$(prompt "$v")" --output-format json --permission-mode bypassPermissions --strict-mcp-config --mcp-config "$B/$v-mcp.json" --add-dir "$B" > "$B/$v.result.json" 2> "$B/$v.stderr"; echo $? > "$B/exit/$v") &
  done
  wait
fi

incomplete=()
for v in "${VARIANTS[@]}"; do
  d="$B/$v"; o="$OUT/$v"; mkdir -p "$o"
  code="$(cat "$B/exit/$v" 2>/dev/null || echo missing)"
  if [ "$code" != "0" ] || [ ! -s "$B/$v.result.json" ]; then incomplete+=("$v (claude exit $code)"); continue; fi
  python3 "$HERE/measure.py" "$B/$v.result.json" > "$o/measure.json" || { incomplete+=("$v (measure failed)"); continue; }
  python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['result'])" "$B/$v.result.json" > "$o/reply.md"
  git -C "$d" log --format='%s' "$(cat "$B/$v.base")"..HEAD > "$o/commits.txt"
  python3 - "$B/$v-sim/writes.jsonl" > "$o/writes.txt" <<'PY'
import json, sys, collections
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
print(f"{len(rows)} writes")
print(dict(collections.Counter(r["tool"] for r in rows)))
for r in rows:
    print(r["tool"], r.get("database") or "-", r.get("brain_id") or r.get("name") or "-", ",".join(r.get("props", [])) or (f"{r['blocks']} blocks" if "blocks" in r else ""))
PY
  python3 -c "import json,sys; [print(r['name']) for r in map(json.loads, open(sys.argv[1])) if r['tool'] == 'post-page' and r['database'] == 'tasks']" "$B/$v-sim/writes.jsonl" | sort > "$o/tasks.txt"
  grep -rl --include='*.md' --exclude-dir=.agents --exclude-dir=.claude --exclude-dir=.git -E '^notion: ' "$d" | sed "s|$d/||" | sort > "$o/recorded.txt"
  brain sync render --changed --brain "$d" --json | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(len(d['items']), 'items'); [print(i['database'], i['id'], i['action']) for i in d['items']]" > "$o/render-after.txt"
done
# Page ids and hashes become <id 1>, <id 2>, ... in every trace, as in eval/unattended-0.7.0, so no id-shaped string is kept.
python3 - "$OUT" <<'PY2'
import pathlib, re, sys
uuid = re.compile(r"\b(?:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|[0-9a-f]{32})\b", re.I)
for path in pathlib.Path(sys.argv[1]).rglob("*"):
    if path.is_file():
        seen = {}
        path.write_text(uuid.sub(lambda m: f"<id {seen.setdefault(m.group(0).lower(), len(seen) + 1)}>", path.read_text()))
PY2

# The after run creates exactly the before run's Tasks: the owner's to-dos the ingest kept, never another person's.
before_tasks="${COMPARE_BEFORE:-$OUT/before}/tasks.txt"
if [ -f "$OUT/after/tasks.txt" ] && [ -f "$before_tasks" ]; then
  if diff "$before_tasks" "$OUT/after/tasks.txt" > "$OUT/tasks-diff.txt"; then echo "same Tasks as before: $(wc -l < "$before_tasks" | tr -d ' ')" | tee "$OUT/tasks-diff.txt"
  else echo "Tasks differ from the before run:" >&2; cat "$OUT/tasks-diff.txt" >&2; incomplete+=("after (Tasks differ)"); fi
fi
if [ ${#incomplete[@]} -gt 0 ]; then echo "INCOMPLETE: ${incomplete[*]}" >&2; exit 1; fi
echo "traces in $OUT"
