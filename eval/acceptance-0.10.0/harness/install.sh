#!/bin/sh
# Usage: install.sh <new dir>. An isolated installation for the 0.10.0 acceptance (CC-140), copied from
# eval/acceptance-0.9.0/harness/install.sh with one change: it packs this checkout's HEAD at the version in its
# package.json, instead of setting one, so the vendored skills' CLI range always admits it (0.9.0's sets 0.9.0, which
# today's skills refuse).
#   <dir>/home        HOME, with empty ~/.claude/skills, ~/.agents/skills and ~/.codex/skills
#   <dir>/npm-cache   npm's cache
#   <dir>/pkg/        ultimate-brain-<version>.tgz, packed from a copy of this checkout's HEAD
#   <dir>/prefix      the packed CLI, installed globally into this prefix
#   <dir>/env.sh      HOME, npm's cache and PATH (prefix/bin first); BRAIN_DIR is set per sandbox
# Nothing is written outside <dir>.
set -e
D="$1"; if [ -z "$D" ] || [ -e "$D" ]; then echo "$D exists or is missing: give a new folder" >&2; exit 2; fi
mkdir -p "$D/home/.claude/skills" "$D/home/.agents/skills" "$D/home/.codex/skills" "$D/npm-cache" "$D/pkg" "$D/src"
D=$(cd "$D" && pwd); SRC=$(cd "$(dirname "$0")/../../.." && pwd)
export HOME="$D/home" npm_config_cache="$D/npm-cache" npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
git -C "$SRC" archive HEAD | tar -x -C "$D/src"
(cd "$D/src" && npm ci --silent >/dev/null && npm pack --silent --pack-destination "$D/pkg" >/dev/null)
rm -rf "$D/src"
npm install -g --silent --prefix "$D/prefix" "$D"/pkg/ultimate-brain-*.tgz >/dev/null
printf 'export HOME=%s/home npm_config_cache=%s/npm-cache npm_config_update_notifier=false PATH=%s/prefix/bin:$PATH\n' "$D" "$D" "$D" > "$D/env.sh"
. "$D/env.sh"
echo "installed: $(brain --version) at $(command -v brain)"
