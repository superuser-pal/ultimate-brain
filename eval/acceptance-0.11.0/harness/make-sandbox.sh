#!/bin/sh
# Usage: make-sandbox.sh <install dir> <new dir> [<as_of YYYY-MM-DD>] [clean]
# A sandbox for the 0.11.0 acceptance (CC-67), on the isolated installation made by install.sh:
#   <dir>/brain    the reflection fixture (harness/fixture.mjs: synthetic names), made by the installed CLI's `brain init`
#                  with Documents on, its views and index generated, `brain lint` free of errors, and one commit. Notion is
#                  not configured: the skill's publish at "done" is skipped, and a "later" stays a pending proposal (the
#                  Review row it becomes at the next publish)
#   <dir>/bin      a gh that always fails (no real GitHub)
#   <dir>/env.sh   the installation's env.sh, then BRAIN_DIR and PATH
# as_of defaults to today; every date in the brain is as_of plus fixture.mjs's offsets. `clean` makes the brain with nothing
# to tidy. Nothing is written outside <dir> and the installation.
set -e
I="$1"; D="$2"; A="${3:-$(date +%F)}"; V="$4"
[ -f "$I/env.sh" ] || { echo "no installation at $I" >&2; exit 2; }
if [ -z "$D" ] || [ -e "$D" ]; then echo "$D exists or is missing: give a new folder" >&2; exit 2; fi
echo "$A" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' || { echo "as_of must be YYYY-MM-DD" >&2; exit 2; }
H=$(cd "$(dirname "$0")" && pwd); mkdir -p "$D/bin"; D=$(cd "$D" && pwd); I=$(cd "$I" && pwd)
. "$I/env.sh"
B="$D/brain"; INIT="$(node -e 'console.log(new Date(Date.parse(process.argv[1]+"T09:00:00Z")-160*86400000).toISOString().slice(0,19)+"Z")' "$A")"
brain init "$B" --owner "Robin Example" --no-git --now "$INIT" --json > /dev/null
brain modules on documents --brain "$B" --json > /dev/null
(cd "$H/../../.." && node --experimental-strip-types "$H/fixture.mjs" write "$B" "$A" $V)
brain views --brain "$B" --json > /dev/null
brain index --brain "$B" --json > /dev/null
brain lint --brain "$B" --json > "$D/lint.json" || { cat "$D/lint.json" >&2; exit 1; }
node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).data;const e=d.issues.filter(i=>i.severity==="error");if(e.length){console.error(JSON.stringify(e));process.exit(1)}' "$D/lint.json"
rm "$D/lint.json"
git -C "$B" init -q -b main
git -C "$B" -c user.name="Blind run" -c user.email=blind-run@brain.example add -A
GIT_AUTHOR_DATE="${A}T08:00:00Z" GIT_COMMITTER_DATE="${A}T08:00:00Z" git -C "$B" -c user.name="Blind run" -c user.email=blind-run@brain.example commit -q -m "Blind-run brain: the 0.11.0 reflection fixture${V:+ ($V)}"
git -C "$B" config user.name "Robin Example"; git -C "$B" config user.email robin@studio.example
printf '#!/bin/sh\necho "gh: not logged in to any GitHub hosts. Run gh auth login." >&2\nexit 1\n' > "$D/bin/gh"; chmod +x "$D/bin/gh"
{ cat "$I/env.sh"; printf 'export BRAIN_DIR=%s PATH=%s/bin:$PATH\n' "$B" "$D"; } > "$D/env.sh"
echo "sandbox: $D (as_of $A${V:+, $V})"
