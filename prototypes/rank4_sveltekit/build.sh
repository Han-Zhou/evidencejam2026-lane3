#!/usr/bin/env bash
# Build the Q1 rank-4 prototype (SvelteKit + adapter-static, prerendered) into a
# folder of static files.
#
#   ./build.sh [out_dir]      default: site/ next to this script
#
# Reads ../../answers/q1_tree_planting.json and q1_tree_planting_graph.json.
# Network: only `npm ci` (npm registry), and only when node_modules/ is missing.
# No LLM call: BRINE_* variables are not read.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/site}"
case "$OUT" in /*) ;; *) OUT="$PWD/$OUT" ;; esac
Q1_ANSWERS_DIR="$(cd "$HERE/../../answers" && pwd)"
export Q1_ANSWERS_DIR

cd "$HERE"
if [ ! -d node_modules ]; then
	echo "build.sh: node_modules/ missing, running npm ci (downloads from the npm registry)" >&2
	npm ci --no-audit --no-fund --loglevel=error
fi

rm -rf build .svelte-kit/output
node node_modules/vite/bin/vite.js build --logLevel warn
# __data.json repeats the page data for client-side navigation. This site has
# one page and never navigates on the client, so the file is never requested.
rm -f build/__data.json

# copy the output; only replace a folder that is empty or holds an earlier site
if [ -e "$OUT" ]; then
	if [ -f "$OUT/index.html" ] || [ -z "$(ls -A "$OUT")" ]; then
		rm -rf "$OUT"
	else
		echo "build.sh: $OUT exists and is not an earlier site; not overwriting it" >&2
		exit 1
	fi
fi
mkdir -p "$(dirname "$OUT")"
cp -R build "$OUT"
echo "build.sh: wrote $OUT"
