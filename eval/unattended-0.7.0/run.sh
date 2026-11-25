#!/bin/bash
# Run the unattended catch-up scenarios blind and keep their traces (CC-64, decision 0051; the 0.17.0 model, CC-388).
#
#   npm run build                              once, so the brain shim has a CLI to run
#   eval/unattended-0.7.0/run.sh               builds every brain, runs each in a fresh `claude -p`, then the attended follow-up
#   eval/unattended-0.7.0/run.sh mixed-on ...  only these scenarios (the attended follow-up needs mixed-ask)
#   COLLECT_ONLY=1 eval/unattended-0.7.0/run.sh  collect the traces again from the brains of the last run, running nothing
#
# Output: eval/unattended-0.7.0/runs/<scenario>/ with reply.md (what the agent said), commits.txt, log.txt (the catch-up
# log line), status.txt (`brain status` unattended), waiting.txt (the decisions left for the next session), weekly.txt (the
# Weekly row's items and what became of each), facts.txt (the two facts a run must leave alone), changes.txt (files changed), fix-text.txt (where the words of a waiting What to
# fix or Your note appear in the brain's own notes, not the shipped skills: empty means nowhere, so nothing was interpreted into
# a note or a proposal), report-rows.txt (how many Catch-up rows its Notion writes hold) and writes.md (what it would have
# written to Notion).
#
# Each session runs on the schedule's default model (UB_EVAL_MODEL, default claude-sonnet-5-5), without the user's own settings,
# hooks or MCP servers, at most 6 USD (UB_EVAL_BUDGET). CLAUDE_CONFIG_DIR picks another Claude Code login.
#
# A scenario is INCOMPLETE, listed at the end with the script exiting 1, when its `claude -p` exited with an error or its
# reply says a limit was hit, when anything its collection needs is missing (the brain, its baseline commit, its reply, its
# saved exit status: a collect-only run on a machine that never ran it) or when a collection command fails. So an empty or
# partial set of traces is never taken for a reproduction.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
B="${UB_EVAL_DIR:-/tmp/ub-eval-0.7.0}"
OUT="${UB_EVAL_OUT:-$HERE/runs}"
export UB_EVAL_DIR="$B"
SCENARIOS=(noop noop-connected budget mixed-on mixed-reports-off mixed-ask requests)
if [ $# -gt 0 ]; then SCENARIOS=("$@"); fi
COLLECT_ONLY="${COLLECT_ONLY:-}"
if [ -z "$COLLECT_ONLY" ]; then
  if [ $# -eq 0 ]; then python3 "$HERE/setup.py" all >/dev/null || exit 1; else for s in "$@"; do python3 "$HERE/setup.py" "$s" >/dev/null || exit 1; done; fi
fi
export PATH="$B/bin:$PATH"
export BRAIN_DIR="$B/no-brain"  # no such folder: a brain CLI that isn't the shim is refused too
mkdir -p "$OUT" "$B/exit"

# No session may reach this computer's own brain. Two guards, checked before any model runs: the shim has the eval's HOME,
# which holds no config (a command without --brain is BRAIN_NOT_CONFIGURED), and a CLI past the shim gets BRAIN_DIR above,
# which wins over the config (BRAIN_NOT_FOUND; cli.md §4).
refused() { # code, command...: the command must fail with that error code
  local code="$1" out; shift
  out="$("$@" 2>&1)" && return 1
  grep -q "\"$code\"" <<< "$out"
}
if [ -z "$COLLECT_ONLY" ]; then
  if [ -e "$B/home/.config/ultimate-brain" ] || ! refused BRAIN_NOT_CONFIGURED brain status --json || ! refused BRAIN_NOT_FOUND node "$HERE/../../bin/brain.js" status --json; then
    echo "the eval isn't isolated: a command without --brain isn't refused; no session was run" >&2; exit 1
  fi
fi

MODEL="${UB_EVAL_MODEL:-claude-sonnet-5-5}"
AWAY="The user is away and cannot be asked anything. There is no git remote and no Notion in this session."
sim() {
  echo "Notion isn't connected in this session and no Notion tools exist. Treat these files as the Notion tools' answers: $B/$1-sim/snapshot.json holds the rows of every configured database in the shape sync plan takes; as brain sync snapshot writes it (take it as that command's output); $B/$1-sim/meetings.json is the Meetings database (Brain Status, Date, Project, Attendees, page_text); $B/$1-sim/inbox.json is the Inbox rows that are not Done and their body as Markdown (empty: none; no capture and no Ask row waits). Take the time as 2026-12-14T09:05:00Z, whatever the computer's clock says. Wherever the skill would write to Notion with its tools (create or update a page, set a property, create a Report row), append one line saying exactly what you would write to $B/$1-sim/writes.md and treat the write as done; a page you create gets a page id you make up (a UUID), to record as Notion's. The user is away and cannot be asked anything. There is no git remote."
}
claude_in() { # name, dir, prompt, outfile: keeps the output, and the exit status for the end
  (cd "$2" && claude -p "$3" --model "$MODEL" --max-budget-usd "${UB_EVAL_BUDGET:-6}" --setting-sources project --permission-mode bypassPermissions --strict-mcp-config --mcp-config "$B/no-mcp.json" --add-dir "$B" > "$4" 2>&1; echo $? > "$B/exit/$1")
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

collect() { # name: the traces of one scenario; returns 1 on anything missing or failed
  local s="$1" d="$B/$1" o="$OUT/$1" base rc
  [ -f "$B/$s.base" ] && [ -d "$d/.git" ] && [ -f "$o/reply.md" ] || { echo "no earlier run of $s to collect (brain, baseline or reply missing)" >&2; return 1; }
  base="$(cat "$B/$s.base")"
  git -C "$d" cat-file -e "$base^{commit}" 2>/dev/null || { echo "$s: baseline commit $base is not in its brain" >&2; return 1; }
  git -C "$d" log --format='%s' "$base"..HEAD > "$o/commits.txt" || return 1
  git -C "$d" diff --name-status "$base" HEAD > "$o/changes.all" || return 1
  grep -v -e $'\tindex.md$' -e $'\tlog/' "$o/changes.all" > "$o/changes.txt" || true
  rm -f "$o/changes.all"
  cat "$d"/log/*.md 2>/dev/null | grep -h 'catch-up' > "$o/log.txt" || true  # no log folder is a legitimate empty result
  brain status --brain "$d" --json | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['data']['unattended']))" > "$o/status.txt" || return 1
  brain proposal list --waiting --brain "$d" --json | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
for p in d['waiting']: print(p['kind'], p.get('field', ''), '·', p['title'])
print(d['counts'])" > "$o/waiting.txt" || return 1
  if [ -f "$d/_weekly/state.json" ]; then
    grep -l '^weekly: ' "$d"/_proposals/*.md | sort | xargs grep -h -e '^title:' -e '^status:' -e '^closed_reason:' -e 'decided_by:' > "$o/weekly.txt" || return 1
  fi
  (cd "$d" && grep -e '^  launch_date:' -e '^  role:' projects/acme-website/project.md knowledge/people/maria-lopez.md) > "$o/facts.txt" || return 1
  git -C "$d" grep -n -e 'leads the copy team' -e 'left Acme in June' -- . ':(exclude).agents' ':(exclude).claude' ':(exclude)AGENTS.md' > "$o/fix-text.txt"
  rc=$?; [ "$rc" -le 1 ] || return 1  # 1 means no match, which is the good result; more is a failure
  if [ -f "$B/$s-sim/writes.md" ]; then
    cp "$B/$s-sim/writes.md" "$o/writes.md" || return 1
    grep -c -E 'Catch-up [0-9]+ [A-Z][a-z]+:' "$B/$s-sim/writes.md" > "$o/report-rows.txt"
    rc=$?; [ "$rc" -le 1 ] || return 1
  fi
  return 0
}

incomplete=()
for s in "${SCENARIOS[@]}"; do
  collect "$s" || incomplete+=("$s (collection failed)")
done

# The next attended catch-up opens with what the scheduled runs did. It is stopped after its batch of questions.
case " ${SCENARIOS[*]} " in
  *" mixed-ask "*)
    if [ -z "$COLLECT_ONLY" ]; then
      rm -rf "$OUT/attended-opening" "$B/exit/attended-opening"; mkdir -p "$OUT/attended-opening"
      head="$(git -C "$B/mixed-ask" rev-parse HEAD)"
      claude_in attended-opening "$B/mixed-ask" "catch up. $(sim mixed-ask) For this test only: do the read-only pass and write the batch of questions exactly as you would show it to the user, then stop: apply, ingest and publish nothing, commit nothing. Print the batch." "$OUT/attended-opening/reply.md"
      { git -C "$B/mixed-ask" status --short; git -C "$B/mixed-ask" log --format='%s' "$head"..HEAD; } > "$OUT/attended-opening/tree-after.txt"
    fi
    ;;
esac
[ -d "$OUT" ] && redact

names=("${SCENARIOS[@]}")
case " ${SCENARIOS[*]} " in *" mixed-ask "*) names+=(attended-opening);; esac
for s in "${names[@]}"; do
  code="$(cat "$B/exit/$s" 2>/dev/null || echo missing)"
  if [ ! -f "$OUT/$s/reply.md" ]; then incomplete+=("$s (no reply)")
  elif [ "$code" != "0" ]; then incomplete+=("$s (claude exit $code)")
  elif grep -q -i -e 'session limit' -e 'usage limit' -e 'rate limit' "$OUT/$s/reply.md"; then incomplete+=("$s (a limit was hit)"); fi
done
if [ ${#incomplete[@]} -gt 0 ]; then
  echo "INCOMPLETE, run these again: ${incomplete[*]}" >&2
  exit 1
fi
echo "traces in $OUT"
