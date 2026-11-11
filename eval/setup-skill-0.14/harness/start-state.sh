#!/bin/sh
# Usage: start-state.sh <sandbox> <stage>
# Writes a run's starting state into the sandbox's fresh brain, as the earlier runs left it, so each run can start alone.
#   fresh       nothing (run 1)
#   settings    what run 1 wrote: started, prerequisites (Notion AI yes, no Custom Agents), the settings screen kept
#               with the email filled in (identity for all repositories, the local remote, the drop folder, Language
#               English, publish ask, push auto, recall/markitdown/gh off)
#   connected   + steps 3 to 5 as done by the user in another session (run 2's start): the database ids, template
#               0024, the owner's person note and their source, the five setup lines
#   notion-lost + run 2's line: notion-mcp failed, notion-unreachable (the start of runs 3 and 6)
#   seeded      + run 3's seeding (inputs/run3-seed.json, Domains on, unpublished) and its line notes=16 documents=0;
#               the drop folder holds inputs/harbor-lane-site-notes.md (the start of run 4)
#   resumed     + run 4's first-value line (tasks unsuitable, report pass, organised fail, answer unsuitable); Tasks
#               off; the drop folder holds inputs/harbor-lane-worktops.md (the start of run 5). Run 4's ingest of the
#               site notes is not replayed: run 5 sees its first-value line, not its Document.
# Runs 4 and 5 ran one after the other in one sandbox: for the exact sequence, use `seeded` and run them in turn.
set -e
D=$(cd "$1" && pwd); STAGE="$2"; . "$D/env.sh"; B="$D/brain"; IN=$(cd "$(dirname "$0")/../inputs" && pwd)
b(){ brain "$@" --brain "$B" --json >/dev/null; }
log(){ b log setup - "$@"; }
at(){ case " fresh settings connected notion-lost seeded resumed " in *" $STAGE "*) ;; *) echo "unknown stage $STAGE" >&2; exit 2;; esac
  for s in fresh settings connected notion-lost seeded resumed; do [ "$s" = "$1" ] && return 0; [ "$s" = "$STAGE" ] && return 1; done; }
at fresh || { echo "stage $STAGE"; exit 0; }
if at settings; then
  git config --global user.name "Sam Rivera"; git config --global user.email "sam@studio.example"
  log step=started result=done; log step=prerequisites result=done notion_ai=yes custom_agents=no
  git -C "$B" remote add origin "file://$D/remote.git"
  mkdir -p "$D/home/Documents/brain-dropbox"
  printf '\nDrop folder: ~/Documents/brain-dropbox/\n\nLanguage: English\n' >> "$B/AGENTS.md"
  git -C "$B" add AGENTS.md; git -C "$B" commit -q -m "rules: drop folder and language"
  for kv in publish=ask push=auto recall=off markitdown=off gh=off; do b config set "settings.${kv%%=*}" "\"${kv#*=}\""; done
  log step=settings result=done
  git -C "$B" add -A; git -C "$B" commit -q -m "setup: settings"; git -C "$B" push -q -u origin HEAD
fi
if at connected; then
  while read k id; do
    if [ "$k" = tasks ]; then b config set notion.tasks.database "\"$id\""; else b config set "notion.databases.$k" "\"$id\""; fi
  done < "$D/dbs.txt"
  b config set notion.tasks.status_type '"status"'; b config set notion.template_version '"0024"'
  cat > "$D/work/owner.json" <<'J'
{ "notes": [
 { "type": "source", "title": "Setup: my identities (owner ruling)", "file_date": "2026-11-11", "frontmatter": { "source_key": "agent:claude-code/2026-11-11-identities-ruling", "kind": "note" }, "body": "Q: Which names and work emails do you appear under?\nA: Sam Rivera, Sam, sam@studio.example\n" },
 { "type": "person", "title": "Sam Rivera", "frontmatter": { "summary": "The owner of this brain.", "aliases": ["Sam", "sam@studio.example"], "sources": ["agent:claude-code/2026-11-11-identities-ruling"] }, "body": "" } ] }
J
  P=$(brain note new --input "$D/work/owner.json" --brain "$B" --json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d).data;const l=JSON.stringify(j);console.log(l.match(/per-[a-z0-9]{8}/)[0])})')
  b config set owner.person "\"$P\""
  for st in notion-mcp connect minutes-prompt brain-assistant identities; do log step=$st result=done; done
  b index; b views
  git -C "$B" add -A; git -C "$B" commit -q -m "harness: steps 3 to 5 done by the user in another session (synthetic)"; git -C "$B" push -q
fi
if at notion-lost; then
  log step=notion-mcp result=failed reason=notion-unreachable
  git -C "$B" add -A; git -C "$B" commit -q -m "setup: notion-mcp"; git -C "$B" push -q
fi
if at seeded; then
  log step=notion-mcp result=done
  b modules on domains
  b note new --input "$IN/run3-seed.json"
  b index; b views
  git -C "$B" add -A; git -C "$B" commit -q -m "setup: seed my work"
  log step=seeding result=done notes=16 documents=0
  git -C "$B" add -A; git -C "$B" commit -q -m "setup: seeding"; git -C "$B" push -q
  cp "$IN/harbor-lane-site-notes.md" "$D/home/Documents/brain-dropbox/"
fi
if at resumed; then
  log step=first-value result=failed reason=first-value-unresolved tasks=unsuitable report=pass organised=fail answer=unsuitable
  b modules off tasks
  git -C "$B" add -A; git -C "$B" commit -q -m "setup: first-value, then modules: tasks off"; git -C "$B" push -q
  rm -f "$D/home/Documents/brain-dropbox/harbor-lane-site-notes.md"
  cp "$IN/harbor-lane-worktops.md" "$D/home/Documents/brain-dropbox/"
fi
brain status --brain "$B" | head -1; echo "stage $STAGE"
