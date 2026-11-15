#!/bin/sh
# Build the static site from the pack's answer files.
#   ./build.sh [out_dir]      default: site/ at the repo root
# Needs only python3 (3.12, standard library). No install, no network, no LLM call.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
exec python3 "$here/sitegen/build.py" "${1:-$here/site}"
