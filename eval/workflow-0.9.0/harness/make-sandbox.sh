#!/bin/sh
# Usage: make-sandbox.sh <new dir>. Builds a synthetic brain (Acme fixture, Tasks and Documents on) at <dir>/brain,
# a working folder <dir>/acme-site with a Markdown plan, and a git repo <dir>/acme-api with docs and TASKS.md.
set -e
D="$1"; if [ -e "$D" ]; then echo "$D exists: give a new folder" >&2; exit 2; fi; mkdir -p "$D"
SRC=$(cd "$(dirname "$0")/../../.." && pwd)
cp -R "$SRC/tests/fixtures/brain-acme" "$D/brain"
cp "$SRC/templates/brain/AGENTS.md" "$D/brain/AGENTS.md"
node -e '
const fs=require("fs");const p=process.argv[1]+"/brain/brain.json";const c=JSON.parse(fs.readFileSync(p,"utf8"));
c.modules={domains:false,knowledge:true,orgs:true,documents:true,reports:true,tasks:true,planning:true};
fs.writeFileSync(p,JSON.stringify(c,null,2)+"\n");' "$D"
g() { git -C "$1" init -q -b main; git -C "$1" config user.email eval@acme.example; git -C "$1" config user.name Eval; git -C "$1" add -A; git -C "$1" commit -q -m init; }
g "$D/brain"
mkdir -p "$D/acme-site"
cat > "$D/acme-site/PLAN.md" <<'P'
# Acme site relaunch plan

- [x] Agree the page list with the client
- [/] Write the homepage copy
- [ ] Build the contact form
- [ ] Set up analytics
P
cat > "$D/acme-site/AGENTS.md" <<'P'
# How we work
Status lives in PLAN.md. Every page change is reviewed by the client before it goes live.
P
mkdir -p "$D/acme-api/docs" "$D/acme-api/decisions" "$D/acme-api/secrets"
printf '# acme-api\n\nPublic API for Acme.\n' > "$D/acme-api/README.md"
printf '# Use Postgres\n\nWe use Postgres.\n' > "$D/acme-api/decisions/0001-postgres.md"
printf '# Rate limits\n\nOne hundred requests a minute.\n' > "$D/acme-api/docs/rate-limits.md"
printf 'API_KEY=not-a-real-key\n' > "$D/acme-api/secrets/keys.txt"
printf '# Tasks\n\n- [x] Pick a database\n- [ ] Add rate limiting\n- [?] Decide on caching\n' > "$D/acme-api/TASKS.md"
printf '# How work is done\n\nDecisions in decisions/ first; small PRs.\n' > "$D/acme-api/AGENTS.md"
g "$D/acme-api"
# The CLI from this checkout (run `npm run build` first) and the Notion stand-in, on PATH through <dir>/env.sh.
mkdir -p "$D/bin" "$D/notion"
printf '#!/bin/sh\nexec node "%s/bin/brain.js" "$@"\n' "$SRC" > "$D/bin/brain"; chmod +x "$D/bin/brain"
cp "$SRC/eval/workflow-0.9.0/harness/notion-sim" "$D/bin/notion-sim"
PATH="$D/bin:$PATH" sh "$SRC/eval/workflow-0.9.0/harness/make-notion.sh" "$D/notion" "$D/brain"
printf 'export PATH=%s/bin:$PATH BRAIN_DIR=%s/brain NOTION_SIM_DIR=%s/notion\n' "$D" "$D" "$D" > "$D/env.sh"
echo "sandbox ready: $D (. $D/env.sh)"
