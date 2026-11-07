#!/bin/sh
# Usage: make-sandbox.sh <install dir> <new dir> [<as_of YYYY-MM-DD>]
# A sandbox for the 0.10.0 acceptance (CC-140), on the isolated installation made by install.sh:
#   <dir>/brain    the studio fixture brain (harness/fixture.mjs: synthetic names, every module on, Domains on), made by the
#                  installed CLI's `brain init`, its views and index generated, every note recorded as published, and its
#                  Git history dated: each note is committed on its `created` day, the publish on the day before as_of
#   <dir>/notion   the Notion stand-in's state (eval/acceptance-0.9.0/harness/notion-sim, called unchanged): Domains, Areas,
#                  Projects, Tasks and the other databases, with the problems ../planted.json lists; `as_of` is in it
#   <dir>/bin      notion-sim, and a gh that always fails (no real GitHub)
#   <dir>/env.sh   the installation's env.sh, then BRAIN_DIR, NOTION_SIM_DIR and PATH
# as_of defaults to planted.json's; every date in the sandbox is as_of plus fixture.mjs's offsets, so a sandbox made with
# today's date (`date +%F`) looks the same to an agent as one made at the default does to the check.
# Nothing is written outside <dir> and the installation.
set -e
I="$1"; D="$2"
[ -f "$I/env.sh" ] || { echo "no installation at $I" >&2; exit 2; }
if [ -z "$D" ] || [ -e "$D" ]; then echo "$D exists or is missing: give a new folder" >&2; exit 2; fi
H=$(cd "$(dirname "$0")" && pwd)
A="${3:-$(node -p 'require(process.argv[1]).as_of' "$H/../planted.json")}"
echo "$A" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' || { echo "as_of must be YYYY-MM-DD" >&2; exit 2; }
mkdir -p "$D/bin" "$D/notion"; D=$(cd "$D" && pwd); I=$(cd "$I" && pwd)
. "$I/env.sh"
B="$D/brain"
set -- $(node "$H/build-fixture.mjs" times "$A"); INIT="$1"; NOW="$2"
brain init "$B" --owner "Robin Example" --no-git --now "$INIT" --json > "$D/init.json" || { cat "$D/init.json" >&2; exit 1; }
node "$H/build-fixture.mjs" write "$B" "$D/notion" "$A"
export BRAIN_DIR="$B"
brain views --brain "$B" --now "$NOW" --json > /dev/null
brain index --brain "$B" --now "$NOW" --json > /dev/null
for pass in 1 2 3; do
  brain sync render --changed --brain "$B" --now "$NOW" --json > "$D/render.json"
  node -e '
const fs=require("fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).data;
const missing=d.items.filter(i=>!i.page_id).map(i=>i.id);
if(missing.length){console.error("no page id for "+missing.join(", "));process.exit(1);}
fs.writeFileSync(process.argv[2],JSON.stringify({records:d.items.map(i=>({id:i.id,notion:i.page_id,synced_at:process.argv[3],published:i.published}))}));' "$D/render.json" "$D/record.json" "$NOW"
  node "$H/build-fixture.mjs" publish "$D/notion" "$D/render.json"
  brain sync record --brain "$B" --input "$D/record.json" --now "$NOW" --json > /dev/null
done
rm "$D/init.json" "$D/render.json" "$D/record.json"
brain index --brain "$B" --now "$NOW" --json > /dev/null
node "$H/build-fixture.mjs" commit "$B" "$A"
cp "$H/../../acceptance-0.9.0/harness/notion-sim" "$D/bin/notion-sim"; chmod +x "$D/bin/notion-sim"
# A `gh` that always fails (CC-110): a runner following the brain's AGENTS.md (file a dogfood issue) or fetching a linked
# repo's issues never reaches the real GitHub.
printf '#!/bin/sh\necho "gh: not logged in to any GitHub hosts. Run gh auth login." >&2\nexit 1\n' > "$D/bin/gh"; chmod +x "$D/bin/gh"
{ cat "$I/env.sh"; printf 'export BRAIN_DIR=%s NOTION_SIM_DIR=%s/notion PATH=%s/bin:$PATH\n' "$B" "$D" "$D"; } > "$D/env.sh"
brain lint --strict --brain "$B" --now "$NOW" --json > "$D/lint.json" || { cat "$D/lint.json" >&2; exit 1; }
rm "$D/lint.json"
git -C "$B" status --porcelain | grep -q . && { echo "brain not clean after setup" >&2; exit 1; }
echo "sandbox ready: $D (as_of $A; . $D/env.sh)"
