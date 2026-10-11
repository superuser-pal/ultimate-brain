#!/usr/bin/env bash
# Shallow-clone (or update) the repos under review into sources/.
# Usage: scripts/fetch-sources.sh [name]   (names: see REPOS below)
set -euo pipefail

cd "$(dirname "$0")/../sources"

REPOS=(
  "claude-obsidian|https://github.com/AgriciDaniel/claude-obsidian"
  "obsidian-wiki|https://github.com/Ar9av/obsidian-wiki"
  "obsidian-mind|https://github.com/breferrari/obsidian-mind"
  "obsidian-second-brain|https://github.com/eugeniughelbur/obsidian-second-brain"
  "llm_wiki|https://github.com/nashsu/llm_wiki"
)

want="${1:-}"
found=0
for entry in "${REPOS[@]}"; do
  name="${entry%%|*}"; url="${entry#*|}"
  [[ -n "$want" && "$want" != "$name" ]] && continue
  found=1
  if [[ -d "$name/.git" ]]; then
    echo "Updating $name"; git -C "$name" pull --ff-only --depth 1
  else
    echo "Cloning $name"; git clone --depth 1 "$url" "$name"
  fi
done

[[ -n "$want" && $found -eq 0 ]] && { echo "Unknown repo: $want" >&2; exit 1; }
exit 0
