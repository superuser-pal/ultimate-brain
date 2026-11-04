#!/bin/sh
# Usage: make-sandbox.sh <install dir> <new dir> standard|connected-pr|general-area|hub|retry
# A sandbox for one 0.9.0 acceptance scenario (CC-107), on the isolated installation made by install.sh:
#   <dir>/brain    the Acme fixture brain (all modules on, a Documents database), pinned by the installed CLI's own
#                  `brain upgrade` (its .claude/skills and .agents/skills are the agents' skills), every note recorded
#                  as published so nothing else waits
#   <dir>/notion   CC-104's Notion stand-in (eval/workflow-0.9.0/harness/notion-sim) with Tasks, Projects, Areas,
#                  Documents and Decisions
#   <dir>/github   the gh stand-in's state (gh-sim), for the scenarios with a GitHub-shaped repo
#   <dir>/bin      notion-sim, and gh (gh-sim)
#   <dir>/env.sh   the installation's env.sh, then BRAIN_DIR, NOTION_SIM_DIR, GH_SIM_DIR and PATH
# and the scenario's folders (see the case below). Nothing is written outside <dir> and the installation.
set -e
I="$1"; D="$2"; S="$3"
[ -f "$I/env.sh" ] || { echo "no installation at $I" >&2; exit 2; }
case "$S" in standard|connected-pr|general-area|hub|retry) ;; *) echo "scenario?" >&2; exit 2 ;; esac
if [ -e "$D" ]; then echo "$D exists: give a new folder" >&2; exit 2; fi
mkdir -p "$D/bin" "$D/notion" "$D/github"; D=$(cd "$D" && pwd); I=$(cd "$I" && pwd)
H=$(cd "$(dirname "$0")" && pwd); SRC=$(cd "$H/../../.." && pwd)
. "$I/env.sh"
B="$D/brain"
cp -R "$SRC/tests/fixtures/brain-acme" "$B"
cp "$SRC/templates/brain/AGENTS.md" "$B/AGENTS.md"
node -e '
const fs=require("fs");const p=process.argv[1]+"/brain.json";const c=JSON.parse(fs.readFileSync(p,"utf8"));
c.modules={domains:false,knowledge:true,orgs:true,documents:true,reports:true,tasks:true,planning:true};
c.notion.databases.documents=require("crypto").randomUUID();
fs.writeFileSync(p,JSON.stringify(c,null,2)+"\n");' "$B"
g() { git -C "$1" init -q -b main; git -C "$1" config user.email eval@acme.example; git -C "$1" config user.name Eval; git -C "$1" add -A; git -C "$1" commit -q -m init; }
g "$B"
export BRAIN_DIR="$B"
brain upgrade --brain "$B" --json > "$D/upgrade.json" || { cat "$D/upgrade.json" >&2; exit 1; }
for pass in 1 2 3; do
  brain sync render --changed --brain "$B" --json > "$D/render.json"
  node -e '
const fs=require("fs"),crypto=require("crypto");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).data;
fs.writeFileSync(process.argv[2],JSON.stringify({records:d.items.map(i=>({id:i.id,notion:i.page_id||crypto.randomUUID(),synced_at:"2026-11-01T09:00:00Z",published:i.published}))}));' "$D/render.json" "$D/record.json"
  brain sync record --brain "$B" --input "$D/record.json" --json >/dev/null
done
rm "$D/render.json" "$D/record.json"
git -C "$B" add -A; git -C "$B" commit -q -m "publish: sandbox"
cp "$SRC/eval/workflow-0.9.0/harness/notion-sim" "$D/bin/notion-sim"
cp "$H/gh-sim" "$D/bin/gh"; chmod +x "$D/bin/notion-sim" "$D/bin/gh"
PATH="$D/bin:$PATH" sh "$SRC/eval/workflow-0.9.0/harness/make-notion.sh" "$D/notion" "$B"
node -e '
const fs=require("fs");const f=process.argv[1]+"/state.json";const s=JSON.parse(fs.readFileSync(f,"utf8"));
const c=JSON.parse(fs.readFileSync(process.argv[2]+"/brain.json","utf8")).notion.databases;
s.databases[c.documents]={name:"Documents",properties:{Name:{type:"title"},"Brain ID":{type:"rich_text"},Category:{type:"select"},Project:{type:"relation"},Area:{type:"relation"}}};
s.databases[c.decisions]={name:"Decisions",properties:{Name:{type:"title"},"Brain ID":{type:"rich_text"},Project:{type:"relation"},Area:{type:"relation"}}};
fs.writeFileSync(f,JSON.stringify(s,null,2));' "$D/notion" "$B"
printf '{ "repo": "acme/none", "issues": [], "prs": [], "log": [] }\n' > "$D/github/state.json"
{ cat "$I/env.sh"; printf 'export BRAIN_DIR=%s NOTION_SIM_DIR=%s/notion GH_SIM_DIR=%s/github PATH=%s/bin:$PATH\n' "$B" "$D" "$D" "$D"; } > "$D/env.sh"

case "$S" in
standard)
  # A software repo whose work is in GitHub issues, with no pointer. `brain` and `notion-sim` are logging stubs here,
  # so any call to either is recorded in <dir>/calls.log; the real brain stays untouched.
  R="$D/widget-lib"; mkdir -p "$R/src" "$R/test"
  printf '# widget-lib\n\nSmall string helpers. Work is tracked in GitHub issues.\n' > "$R/README.md"
  printf '# How we work\nOne issue per PR. Run `node --test` before opening a PR.\n' > "$R/AGENTS.md"
  printf 'export function slug(s) { return s.toLowerCase().trim().replace(/\\s+/g, "-"); }\n' > "$R/src/slug.mjs"
  printf 'import test from "node:test"; import assert from "node:assert"; import { slug } from "../src/slug.mjs";\ntest("slug", () => assert.equal(slug(" A b "), "a-b"));\n' > "$R/test/slug.test.mjs"
  printf '{ "name": "widget-lib", "type": "module", "private": true }\n' > "$R/package.json"
  g "$R"
  node -e '
const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({repo:"acme/widget-lib",prs:[],log:[],issues:[
 {number:1,title:"slug() should drop punctuation",body:"slug(\"Hi, there!\") should be \"hi-there\".",state:"open",stateReason:null,labels:["bug"],comments:[]},
 {number:2,title:"Add a truncate() helper",body:"truncate(s, n) cuts to n characters and adds an ellipsis.",state:"open",stateReason:null,labels:["enhancement"],comments:[]},
 {number:3,title:"Set up the README badges",body:"",state:"closed",stateReason:"COMPLETED",labels:[],comments:[]}]},null,2))' "$D/github/state.json"
  for t in brain notion-sim; do printf '#!/bin/sh\necho "$(date -u +%%FT%%TZ) %s $*" >> %s/calls.log\necho "%s: not available in this sandbox" >&2\nexit 127\n' "$t" "$D" "$t" > "$D/bin/$t"; chmod +x "$D/bin/$t"; done
  : > "$D/calls.log"
  ;;
connected-pr)
  # A software repo with a Markdown plan (1 done, 1 in progress, 1 to do), a bare remote and GitHub PRs.
  R="$D/acme-app"; mkdir -p "$R/src" "$R/test" "$R/docs"
  printf '# acme-app\n\nThe Acme website front end.\n' > "$R/README.md"
  printf '# How we work\nEach task is a branch and a PR; `node --test` must pass before review.\n' > "$R/AGENTS.md"
  printf '# Plan\n\n- [x] Set up the project skeleton\n- [/] Build the contact form validation\n- [ ] Add a price formatter\n' > "$R/PLAN.md"
  printf 'export function validEmail(s) { return /^[^@\\s]+@[^@\\s]+$/.test(s); }\n' > "$R/src/contact.mjs"
  printf 'import test from "node:test"; import assert from "node:assert"; import { validEmail } from "../src/contact.mjs";\ntest("email", () => assert.ok(validEmail("a@b.example")));\n' > "$R/test/contact.test.mjs"
  printf '{ "name": "acme-app", "type": "module", "private": true }\n' > "$R/package.json"
  g "$R"; git init -q --bare "$D/acme-app.git"; git -C "$R" remote add origin "$D/acme-app.git"; git -C "$R" push -q -u origin main
  printf '{ "repo": "acme/acme-app", "issues": [], "prs": [], "log": [] }\n' > "$D/github/state.json"
  ;;
general-area)
  # A folder of general work (no Git), for the Clients area.
  W="$D/acme-workshop"; mkdir -p "$W"
  printf '# Acme strategy workshop\n\nA half-day workshop with the Acme team on next year'"'"'s priorities. Deliverables: an agenda and a one-page brief for participants.\n' > "$W/README.md"
  ;;
hub)
  # Two repos: acme-api (tasks tracked in TASKS.md, one unmapped status, a private folder under docs/) and
  # acme-mobile (a Markdown plan to adopt into Notion).
  R="$D/acme-api"; mkdir -p "$R/docs/private" "$R/decisions"
  printf '# acme-api\n\nPublic API for Acme.\n' > "$R/README.md"
  printf '# Use Postgres\n\nWe use Postgres for every service.\n' > "$R/decisions/0001-postgres.md"
  printf '# Rate limits\n\nOne hundred requests a minute per key.\n' > "$R/docs/rate-limits.md"
  printf '# Salary notes\n\nPrivate: not for the brain.\n' > "$R/docs/private/salaries.md"
  printf '# Tasks\n\n- [x] Pick a database\n- [ ] Add rate limiting\n- [?] Decide on caching\n' > "$R/TASKS.md"
  printf '# How work is done\n\nDecisions in decisions/ first; small PRs.\n' > "$R/AGENTS.md"
  g "$R"
  R="$D/acme-mobile"; mkdir -p "$R/docs"
  printf '# acme-mobile\n\nThe Acme mobile app.\n' > "$R/README.md"
  printf '# Offline first\n\nThe app works offline and syncs later.\n' > "$R/docs/offline.md"
  printf '# Plan\n\n- [x] Choose the framework\n- [ ] Build the login screen\n- [ ] Add push notifications\n' > "$R/PLAN.md"
  g "$R"
  ;;
retry)
  # A connected workflow on the Acme website project from a folder, with 3 items all done and 3 open create_task
  # operations, prepared with the CLI; Notion is set to fail twice (see eval/acceptance-0.9.0/README.md).
  W="$D/acme-launch"; mkdir -p "$W"; printf '# Acme launch checklist\n' > "$W/README.md"
  PRJ=$(brain index --brain "$B" --json | node -e 'const n=JSON.parse(require("fs").readFileSync(0,"utf8")).data.notes.find(n=>n.type==="project");console.log(n.id)')
  printf '{"folder_path":"%s","opted_in":{"statement":"Yes, connect it."},"destination":{"project":"%s"},"settings":{"work_type":"general","logging":"tasks_only","custom":[]},"status_map":{"todo":"To Do","in_progress":"Doing","waiting":"Waiting On","review":"Doing","done":"Done","dropped":"Won'"'"'t Do"}}' "$W" "$PRJ" > "$D/new.json"
  WF=$(brain workflow new --brain "$B" --input "$D/new.json" --json | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).data.id)')
  for t in "Book the venue" "Send the invitations" "Print the badges"; do
    printf '{"title":"%s","scope":"%s for the launch.","acceptance":[{"text":"%s is done"}],"status":"done","approve":true,"accepted":{"statement":"Done, thanks."}}' "$t" "$t" "$t" > "$D/item.json"
    brain workflow item put "$WF" --brain "$B" --input "$D/item.json" --json > /dev/null
  done
  rm "$D/new.json" "$D/item.json"
  node -e '
const fs=require("fs");const f=process.argv[1]+"/state.json";const s=JSON.parse(fs.readFileSync(f,"utf8"));
const prj=Object.values(s.pages).find(p=>p.database===Object.keys(s.databases).find(k=>s.databases[k].name==="Projects"));
Object.assign(prj.properties,{Workflow:"Connected","Work type":"General","Logging level":"Tasks only"});
s.fail=[{cmd:"create",mode:"ghost",code:"network",message:"Request timed out",times:1},{cmd:"create",mode:"lasting",code:"validation",message:"Status is not a property that exists",times:1}];
fs.writeFileSync(f,JSON.stringify(s,null,2));' "$D/notion"
  ;;
esac
git -C "$B" status --porcelain | grep -q . && { echo "brain not clean after setup" >&2; exit 1; }
echo "sandbox ready: $D ($S; . $D/env.sh)"
