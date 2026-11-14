#!/usr/bin/env bash
# Build the Q1 site with Eleventy.
#   ./build.sh [out_dir]      default out_dir: site/ next to this script
# Reads ../../answers/q1_tree_planting.json and q1_tree_planting_graph.json.
# Needs Node >= 18. Runs `npm ci` (a network call) only when node_modules
# is missing; the install is pinned by package-lock.json.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/site}"
case "$OUT" in /*) ;; *) OUT="$PWD/$OUT" ;; esac
cd "$HERE"

command -v node >/dev/null 2>&1 || { echo "build.sh: node (>= 18) is required" >&2; exit 1; }
if [ ! -f node_modules/@11ty/eleventy/package.json ]; then
  echo "build.sh: node_modules missing, running npm ci (network)" >&2
  npm ci --no-audit --no-fund --no-update-notifier --loglevel=error
fi

# Remove only what this build writes, then build.
rm -rf "${OUT:?}/index.html" "${OUT:?}/assets" "${OUT:?}/data" "${OUT:?}"/claims-*.html
node node_modules/@11ty/eleventy/cmd.cjs --quiet --output="$OUT"
echo "build.sh: wrote $OUT/index.html"
