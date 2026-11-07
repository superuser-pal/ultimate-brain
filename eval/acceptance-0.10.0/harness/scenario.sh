#!/bin/sh
# Usage: scenario.sh <sandbox> <variant>. Prepares a sandbox made by make-sandbox.sh for one scenario of
# docs/acceptance-0.10.0.md (CC-110), before the blind runner starts. Writes only inside <sandbox>.
#   unreachable   every notion-sim query and get fails with `network` (Notion can't be read; spec/assistant.md §2.3)
#   fail-update   the next notion-sim update fails once with `network` (a failed write, §6.4 step 3)
#   repos         two linked repos under <sandbox>/repos, committed in the brain: talk-notes (tasks tracked in the repo,
#                 TASKS.md with one open item, target the project "Conference talk proposal") and site-issues (tasks
#                 tracked as GitHub issues, target the Area "Workshops"); the sandbox's `gh` always fails
#                 (make-sandbox.sh), so site-issues can't be read
#   clear-fail    removes every injected failure (between two sessions)
#   user-edit <page> <properties json>
#                 the user editing a page in Notion: sets those properties and stamps last_edited now, with no entry in
#                 the call log (a stale write, §6.4; a Review row's "Your call", §6.3)
set -e
S="$1"; V="$2"; P="$3"; J="$4"
[ -f "$S/env.sh" ] || { echo "no sandbox at $S" >&2; exit 2; }
S=$(cd "$S" && pwd); . "$S/env.sh"
state() { node -e "$1" "$S/notion/state.json"; }
case "$V" in
unreachable)
  state 'const fs=require("fs"),f=process.argv[1],s=JSON.parse(fs.readFileSync(f,"utf8"));
s.fail=[{cmd:"query",code:"network",message:"Could not reach Notion",times:1000},{cmd:"get",code:"network",message:"Could not reach Notion",times:1000}];
fs.writeFileSync(f,JSON.stringify(s,null,2));' ;;
fail-update)
  state 'const fs=require("fs"),f=process.argv[1],s=JSON.parse(fs.readFileSync(f,"utf8"));
s.fail=[{cmd:"update",code:"network",message:"Request timed out",times:1}];
fs.writeFileSync(f,JSON.stringify(s,null,2));' ;;
clear-fail)
  state 'const fs=require("fs"),f=process.argv[1],s=JSON.parse(fs.readFileSync(f,"utf8"));s.fail=[];fs.writeFileSync(f,JSON.stringify(s,null,2));' ;;
user-edit)
  node -e 'const fs=require("fs"),[f,p,j]=process.argv.slice(1),s=JSON.parse(fs.readFileSync(f,"utf8"));
if(!s.pages[p]){console.error("no such page "+p);process.exit(1)}
Object.assign(s.pages[p].properties,JSON.parse(j));s.pages[p].last_edited=new Date().toISOString().replace(/\.\d+Z$/,"Z");
fs.writeFileSync(f,JSON.stringify(s,null,2));' "$S/notion/state.json" "$P" "$J" ;;
repos)
  B="$BRAIN_DIR"
  id() { brain index --brain "$B" --json | node -e 'const n=JSON.parse(require("fs").readFileSync(0,"utf8")).data.notes.find(n=>n.type===process.argv[1]&&n.title===process.argv[2]);if(!n)process.exit(1);console.log(n.id)' "$1" "$2"; }
  MKT=$(id area Marketing); WSH=$(id area Workshops); TALK=$(id project "Conference talk proposal"); STUDIO=$(id domain Studio); TEACH=$(id domain Teaching)
  g() { git -C "$1" init -q -b main; git -C "$1" config user.email eval@studio.example; git -C "$1" config user.name Eval; git -C "$1" add -A; git -C "$1" commit -qm "Start"; }
  kit() { # <repo dir> <json>: check, write after the "yes" (its confirm hash), add
    printf '%s' "$2" > "$S/kit.json"
    H=$(brain repo kit check --input "$S/kit.json" --brain "$B" --json | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")).data;if(d.problems.length){console.error(JSON.stringify(d.problems));process.exit(1)}console.log(d.confirm_sha256)')
    brain repo kit write --path "$1" --input "$S/kit.json" --confirm "$H" --brain "$B" --json > /dev/null
    git -C "$1" add brain-kit.json; git -C "$1" commit -qm "Add the brain kit"
    brain repo add "$(basename "$1")" --path "$1" --kit --brain "$B" --json > /dev/null
    rm "$S/kit.json"; }
  R="$S/repos/talk-notes"; mkdir -p "$R/notes"
  printf '# Talk notes\n\nDrafts for the conference talk.\n' > "$R/README.md"
  printf '# Outline\n\nThree parts: brief, sketches, handover.\n' > "$R/notes/outline.md"
  printf '# Tasks\n\n- [x] Pick the conference\n- [ ] Draft the abstract\n' > "$R/TASKS.md"
  g "$R"
  kit "$R" '{"kit_version":1,"name":"talk-notes","placement":{"area":"'"$MKT"'","domain":"'"$STUDIO"'","project":"'"$TALK"'"},"knowledge":{"patterns":["notes/**/*.md"],"never_read":[]},"tasks":{"mode":"tracked-in-repo","source":{"kind":"markdown","path":"TASKS.md","format":"checklist"},"status_map":{" ":"todo","/":"in_progress","x":"done","-":"dropped"}},"methodology":{"summary":"Notes in notes/, tasks in TASKS.md."}}'
  R="$S/repos/site-issues"; mkdir -p "$R"
  printf '# Workshop site\n\nIssues track the work.\n' > "$R/README.md"
  g "$R"
  kit "$R" '{"kit_version":1,"name":"site-issues","placement":{"area":"'"$WSH"'","domain":"'"$TEACH"'"},"knowledge":{"patterns":["README.md"],"never_read":[]},"tasks":{"mode":"tracked-in-repo","source":{"kind":"github","repo":"robin-example/workshop-site"},"status_map":{"label:blocked":"waiting"}},"methodology":{"summary":"Each change is an issue."}}'
  git -C "$B" add brain.json log; git -C "$B" commit -qm "Link talk-notes and site-issues"
  git -C "$B" status --porcelain | grep -q . && { echo "brain not clean" >&2; exit 1; }
  ;;
*) echo "unknown variant: $V" >&2; exit 2 ;;
esac
echo "scenario $V ready: $S"
