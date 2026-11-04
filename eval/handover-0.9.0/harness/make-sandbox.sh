#!/bin/sh
# Usage: make-sandbox.sh <new dir> catch-up|ingest. CC-104's sandbox (eval/workflow-0.9.0/harness/make-sandbox.sh), then:
# every note recorded as published, so a catch-up has nothing else to publish; and for catch-up, acme-api linked with a
# tracked-in-repo kit on the Acme website project, its files already ingested, an old rollup toggle on the project page,
# and one more commit to TASKS.md after it. For ingest, acme-api stays unlinked.
set -e
D="$1"; CASE="$2"; HERE=$(cd "$(dirname "$0")" && pwd)
case "$CASE" in catch-up|ingest) ;; *) echo "case: catch-up or ingest" >&2; exit 2 ;; esac
sh "$HERE/../../workflow-0.9.0/harness/make-sandbox.sh" "$D" >/dev/null
. "$D/env.sh"
B="$D/brain"; R="$D/acme-api"
for pass in 1 2 3; do
  brain sync render --changed --json > "$D/render.json"
  node -e '
const fs=require("fs"),crypto=require("crypto");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).data;
const records=d.items.map(i=>({id:i.id,notion:i.page_id||crypto.randomUUID(),synced_at:"2026-11-01T09:00:00Z",published:i.published}));
fs.writeFileSync(process.argv[2],JSON.stringify({records}));' "$D/render.json" "$D/record.json"
  brain sync record --input "$D/record.json" --json >/dev/null
done
rm "$D/render.json" "$D/record.json"
git -C "$B" add -A; git -C "$B" commit -q -m "publish: sandbox"
if [ "$CASE" = catch-up ]; then
  PRJ=$(brain index --json | node -e 'const n=JSON.parse(require("fs").readFileSync(0,"utf8")).data.notes.find(n=>n.type==="project");console.log(n.id+" "+n.area+" "+n.notion)')
  set -- $PRJ
  cat > "$D/kit.json" <<K
{
  "kit_version": 1,
  "name": "acme-api",
  "placement": { "area": "$2", "project": "$1" },
  "knowledge": { "patterns": ["decisions/**", "docs/**/*.md", "README.md"], "never_read": [".env*", "secrets/**"] },
  "tasks": {
    "mode": "tracked-in-repo",
    "source": { "kind": "markdown", "path": "TASKS.md", "format": "checklist" },
    "status_map": { "?": "waiting" }
  },
  "methodology": { "summary": "Decisions in decisions/ first; small PRs.", "files": ["AGENTS.md"] }
}
K
  node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify(JSON.parse(fs.readFileSync(process.argv[1],"utf8")),null,2)+"\n")' "$D/kit.json"
  SHA=$(brain repo kit check --input "$D/kit.json" --json | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).data.sha256)')
  brain repo kit write --path "$R" --input "$D/kit.json" --confirm "$SHA" --json >/dev/null
  rm "$D/kit.json"
  git -C "$R" add brain-kit.json; git -C "$R" commit -q -m "Add brain-kit.json"
  brain repo add acme-api --path "$R" --kit --json >/dev/null
  brain repo record acme-api --commit "$(git -C "$R" rev-parse HEAD)" --json >/dev/null
  git -C "$B" add -A; git -C "$B" commit -q -m "repo: link acme-api"
  node -e '
const fs=require("fs");const f=process.argv[1]+"/state.json";const s=JSON.parse(fs.readFileSync(f,"utf8"));
s.pages[process.argv[2]].toggles["Repo tasks · acme-api"]="As of 1 Nov 2026, 09:00 · from acme-api (TASKS.md) · read-only\n1 completed · 2 open (1 waiting, 1 to do) · 50%\n- Waiting: Decide on caching\n- To do: Add rate limiting\n";
fs.writeFileSync(f,JSON.stringify(s,null,2));' "$D/notion" "$3"
  printf '# Tasks\n\n- [x] Pick a database\n- [x] Add rate limiting\n- [?] Decide on caching\n- [ ] Write the API guide\n' > "$R/TASKS.md"
  git -C "$R" commit -q -am "Rate limiting done; API guide"
fi
echo "sandbox ready: $D ($CASE; . $D/env.sh)"
