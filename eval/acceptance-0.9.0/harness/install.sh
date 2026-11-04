#!/bin/sh
# Usage: install.sh <new dir>. An isolated installation for the 0.9.0 acceptance (CC-107):
#   <dir>/home        HOME, with empty ~/.claude/skills, ~/.agents/skills and ~/.codex/skills
#   <dir>/npm-cache   npm's cache
#   <dir>/pkg/        ultimate-brain-0.9.0.tgz, packed from a copy of this checkout's HEAD with version 0.9.0
#   <dir>/prefix-090  the packed 0.9.0, installed globally into this prefix
#   <dir>/env.sh      HOME, npm's cache and PATH (prefix-090/bin first); BRAIN_DIR is set per sandbox
# Nothing is written outside <dir>.
set -e
D="$1"; if [ -e "$D" ]; then echo "$D exists: give a new folder" >&2; exit 2; fi
mkdir -p "$D/home/.claude/skills" "$D/home/.agents/skills" "$D/home/.codex/skills" "$D/npm-cache" "$D/pkg" "$D/src"
D=$(cd "$D" && pwd); SRC=$(cd "$(dirname "$0")/../../.." && pwd)
export HOME="$D/home" npm_config_cache="$D/npm-cache" npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
git -C "$SRC" archive HEAD | tar -x -C "$D/src"
(cd "$D/src" && npm pkg set version=0.9.0 && npm ci --silent >/dev/null && npm pack --silent --pack-destination "$D/pkg" >/dev/null)
rm -rf "$D/src"
npm install -g --silent --prefix "$D/prefix-090" "$D/pkg/ultimate-brain-0.9.0.tgz" >/dev/null
printf 'export HOME=%s/home npm_config_cache=%s/npm-cache npm_config_update_notifier=false PATH=%s/prefix-090/bin:$PATH\n' "$D" "$D" "$D" > "$D/env.sh"
. "$D/env.sh"
echo "installed: $(brain --version) at $(command -v brain)"
