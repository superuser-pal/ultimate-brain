#!/bin/sh
# Usage: prepare.sh <install dir> <new sandbox> weekly|setup-darwin|setup-win32
# A sandbox for CC-371's blind runs, on an installation made by eval/acceptance-0.10.0/harness/install.sh, built with
# make-sandbox.sh at today's date (the 0.10.0 studio fixture: synthetic names, its Notion stand-in), then:
#   weekly        three mechanical clean-up items planted (a meeting missing its side of a decision pair, a repeated alias,
#                 a learned draft from 1 Sep that nothing links to), settings.publish auto, and Weekly added to the
#                 Inbox's Kind options in the Notion stand-in
#   setup-*       the same brain with setup done up to step 8 (steps 1 to 7 logged done, the owner's person note, a local
#                 bare remote, the Drop folder and Language lines; prerequisites credits=no meetings=paste, so 7 of 7),
#                 a `gh` that answers only the backup's privacy check, and UB_SCHEDULE_PLATFORM with its scheduler folder
#                 (<sandbox>/scheduler) in env.sh; setup-win32 also gets stand-ins for codex.cmd and brain.cmd, which
#                 `brain schedule` looks for on Windows (add them after a first run to see AGENT_NOT_FOUND)
# Nothing is written outside <sandbox>.
set -e
I="$1"; D="$2"; V="$3"; H=$(cd "$(dirname "$0")" && pwd)
case "$V" in weekly|setup-darwin|setup-win32) ;; *) echo "variant: weekly, setup-darwin or setup-win32" >&2; exit 2;; esac
sh "$H/../acceptance-0.10.0/harness/make-sandbox.sh" "$I" "$D" "$(date +%F)" >/dev/null
D=$(cd "$D" && pwd); . "$D/env.sh"; B="$BRAIN_DIR"
[ "$B" = "$D/brain" ] || { echo "env.sh points elsewhere: $B" >&2; exit 1; }
cd "$B"
MEETING=knowledge/meetings/2026-11-09-newsletter-planning.md
if [ "$V" = weekly ]; then
  RID=$(brain id new reference --json | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).data.ids[0])')
  mkdir -p knowledge/references
  cat > knowledge/references/kiln-glaze-temperatures.md <<N
---
id: $RID
type: reference
title: Kiln glaze temperatures
summary: Rough firing temperatures noted from a supplier call.
lifecycle: draft
origin: learned
sources: [src-0a10e004]
created: 2026-09-01
updated: 2026-09-01
---
Stoneware glazes fire around 1220 C; earthenware around 1060 C (supplier call, 1 Sep).
N
  sed -i '' 's/^decisions: \[dec-0a10dc01\]$/decisions: []/' "$MEETING"
  sed -i '' 's/^aliases: \[Owen\]$/aliases: [Owen, Owen]/' knowledge/people/owen-halberd.md
  brain index --json >/dev/null; brain views --json >/dev/null
  git add -A; git commit -qm "notes of $(date +%F)"
  brain config set settings.publish '"auto"' --json >/dev/null; git commit -qam "settings: publish auto"
  node -e 'const fs=require("fs"),f=process.argv[1],s=JSON.parse(fs.readFileSync(f,"utf8"));
const inbox=Object.values(s.databases).find((d)=>(d.name||d.title)==="Inbox");inbox.properties.Kind.options.push("Weekly");
fs.writeFileSync(f,JSON.stringify(s,null,2));' "$D/notion/state.json"
  brain cleanup plan --json | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")).data;console.log("clean-up items: "+d.items.map((i)=>i.tidy).join(", "))'
  exit 0
fi
PL=${V#setup-}
mkdir -p "$D/remote.git" "$D/drop" "$D/scheduler"; git init -q --bare "$D/remote.git"; git remote add origin "$D/remote.git"
PID=$(brain id new person --json | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).data.ids[0])')
cat > knowledge/people/robin-example.md <<N
---
id: $PID
type: person
title: Robin Example
summary: Runs the studio.
lifecycle: reviewed
created: 2026-11-01
updated: 2026-11-01
---
Owner of the studio.
N
node -e 'const fs=require("fs"),f=process.argv[1],b=JSON.parse(fs.readFileSync(f,"utf8"));b.owner.person=process.argv[2];fs.writeFileSync(f,JSON.stringify(b,null,2)+"\n")' brain.json "$PID"
printf '\nDrop folder: %s\nLanguage: English\n' "$D/drop" >> AGENTS.md
for l in "started result=done" "prerequisites result=done credits=no meetings=paste" "settings result=done" "notion-mcp result=done" \
  "connect result=done examples=0" "identities result=done" "seeding result=done notes=0 documents=0" \
  "first-value result=done tasks=pass report=pass organised=pass answer=pass"; do
  set -- $l; S1="$1"; shift
  brain log setup - "step=$S1" "$@" --json >/dev/null
done
brain index --json >/dev/null; brain views --json >/dev/null
git add -A; git commit -qm "setup: up to the first value"
printf '#!/bin/sh\ncase "$*" in *"repo view"*isPrivate*) echo "{\\"isPrivate\\":true}"; exit 0;; esac\necho "gh: not logged in to any GitHub hosts." >&2\nexit 1\n' > "$D/bin/gh"; chmod +x "$D/bin/gh"
if [ "$PL" = win32 ]; then
  for f in codex.cmd brain.cmd; do printf '@echo off\r\nrem a stand-in for the Windows shim\r\n' > "$D/bin/$f"; chmod +x "$D/bin/$f"; done
  printf 'export UB_SCHEDULE_PLATFORM=win32 UB_WINDOWS_TASKS_DIR=%s/scheduler\n' "$D" >> "$D/env.sh"
else
  printf 'export UB_SCHEDULE_PLATFORM=darwin UB_LAUNCH_AGENTS_DIR=%s/scheduler\n' "$D" >> "$D/env.sh"
fi
. "$D/env.sh"
brain status --json | node -e 'const s=JSON.parse(require("fs").readFileSync(0,"utf8")).data.setup;console.log("setup: "+s.required.done+" of "+s.required.total+", next "+s.next)'
