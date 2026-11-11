#!/bin/sh
# Usage: [FORK_SKILLS="…"] [CLI_SKILLS="…"] make-sandbox.sh <new dir> <fork checkout> <fork commit> [notion|no-notion]
# A synthetic sandbox for blind runs of brain-setup (CC-191):
# - the CLI built from product commit $CLI_COMMIT (default d0c52cf, CC-190's last commit; `brain --version` prints
#   0.12.0, and `brain upgrade` refuses an unreleased build, so the runs stay on it), in a scratch clone;
# - a fresh brain from `brain init`, a local bare repository for its remote, an isolated HOME and global Git config;
# - a gh stub that always fails, and a file-based Notion stand-in (eval/workflow-0.9.0's notion-sim, plus `search`);
# - the skills under test from <fork commit> of the ultimate-brain-skills fork, the others from the CLI's snapshot;
# - RULES.md for the run's agent. `no-notion` (runs 1 and 2) tells it the session has no Notion tools.
# Nothing reaches a real Notion, a real gh or a real remote. Then: start-state.sh for the run's starting state.
set -e
D="$1"; F="$2"; FC="$3"; MODE="${4:-notion}"; C="${CLI_COMMIT:-d0c52cf}"
if [ -z "$FC" ]; then sed -n '2,11p' "$0" >&2; exit 2; fi
if [ -e "$D" ]; then echo "$D exists: give a new folder" >&2; exit 2; fi
SRC=$(cd "$(dirname "$0")/../../.." && pwd); H="$SRC/eval/setup-skill-0.14/harness"
mkdir -p "$D/bin" "$D/home" "$D/notion" "$D/skills" "$D/work"; D=$(cd "$D" && pwd)
git clone -q "$SRC" "$D/cli"; git -C "$D/cli" checkout -q "$C"
(cd "$D/cli" && npm ci --silent && npm run build --silent)
printf '#!/bin/sh\nexec node "%s/cli/bin/brain.js" "$@"\n' "$D" > "$D/bin/brain"
printf '#!/bin/sh\necho "gh: not available in this sandbox (stub)" >&2\nexit 1\n' > "$D/bin/gh"
cp "$SRC/eval/workflow-0.9.0/harness/notion-sim" "$D/bin/notion-sim-core"; cp "$H/notion-search.cjs" "$D/bin/"
{ echo '#!/bin/sh'
  echo '# The Notion stand-in, plus "search <title>" (the MCP search).'
  echo "if [ \"\$1\" = search ]; then exec node $D/bin/notion-search.cjs \"\$2\"; fi"
  echo "if [ \"\$1\" = help ] || [ -z \"\$1\" ]; then node $D/bin/notion-sim-core help; echo '  notion-sim search <title>   pages whose title contains <title> (the MCP search)'; exit 0; fi"
  echo "exec node $D/bin/notion-sim-core \"\$@\""; } > "$D/bin/notion-sim"
chmod +x "$D/bin/"*
NODE_DIR=$(dirname "$(command -v node)")
echo "export HOME=$D/home GIT_CONFIG_GLOBAL=$D/home/.gitconfig GIT_CONFIG_NOSYSTEM=1 PATH=$D/bin:$NODE_DIR:/usr/bin:/bin BRAIN_DIR=$D/brain NOTION_SIM_DIR=$D/notion" > "$D/env.sh"
. "$D/env.sh"
brain init "$D/brain" --owner "Sam Rivera" >/dev/null
git init -q --bare "$D/remote.git"
# The user's duplicated Notion space: Brain Data, its System page (Template version: 0024) and the twelve databases.
for k in inbox meetings projects areas people review decisions questions orgs documents domains tasks; do
  echo "$k $(node -e 'console.log(crypto.randomUUID())')"; done > "$D/dbs.txt"
node "$H/notion-state.cjs" "$D"
# The skills the run's agent can read: FORK_SKILLS from <fork commit>, CLI_SKILLS from the CLI's vendored snapshot
# (defaults: runs 6 and 7; RESULTS.md gives each run's sets).
for k in ${FORK_SKILLS-brain-setup brain-connect-notion ultimate-assistant brain-ingest brain-catch-up brain-notion-change}; do
  git -C "$F" archive "$FC" "brain/$k" | tar -x -C "$D/skills" --strip-components=1; done
for k in ${CLI_SKILLS-brain-apply brain-query brain-sync brain-workflow-adopt}; do
  cp -R "$D/cli/.agents/skills/$k" "$D/skills/"; done
sed "s#@SANDBOX@#$D#g" "$H/RULES.md" > "$D/RULES.md"
if [ "$MODE" = no-notion ]; then
  node -e 'const f=process.argv[1],fs=require("fs");const s=fs.readFileSync(f,"utf8").replace(/^3\. \*\*Notion\.\*\*.*$/m,"3. **Notion.** Never call any tool whose name contains `notion` (they reach a real workspace). For this run, this session has no Notion tools: treat the Notion MCP as not connected.");fs.writeFileSync(f,s)' "$D/RULES.md"
fi
echo "sandbox ready: $D (CLI $C, skills at fork $FC, $MODE)"
