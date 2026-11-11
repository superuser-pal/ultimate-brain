#!/bin/sh
# Usage: prepare-run7.sh <sandbox>, on a sandbox whose brain went through run 6 (or start-state.sh seeded).
# Run 7's four copies of the brain, each with its own local remote:
#   brainA  first value unresolved (organised fail)          brainB  first value passed, no first-meeting line yet
#   brainC  template version 0024                            brainD  no template version (unknown)
set -e
D=$(cd "$1" && pwd); . "$D/env.sh"
mk(){ rm -rf "$D/$1" "$D/$1.git"; cp -R "$D/brain" "$D/$1"; git init -q --bare "$D/$1.git"
  git -C "$D/$1" remote set-url origin "file://$D/$1.git"; git -C "$D/$1" push -q -u origin HEAD; }
for x in brainA brainB brainC brainD; do mk $x; done
brain log setup - step=first-value result=failed reason=first-value-unresolved tasks=pass report=pass organised=fail answer=pass --brain "$D/brainA" --json >/dev/null
git -C "$D/brainA" commit -q -am "setup: first-value"
brain log setup - step=first-value result=done tasks=pass report=pass organised=pass answer=pass --brain "$D/brainB" --json >/dev/null
git -C "$D/brainB" commit -q -am "setup: first-value"
node -e 'const f=process.argv[1]+"/brainD/brain.json",fs=require("fs");const c=JSON.parse(fs.readFileSync(f));delete c.notion.template_version;fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")' "$D"
git -C "$D/brainD" commit -q -am "harness: template version unknown"
for x in brainA brainB brainC brainD; do echo "$x: $(grep -h 'step=first-value' "$D/$x"/log/*.md | tail -1 | cut -c1-90)"; done
