#!/bin/sh
# Build the Q1 prototype site (rank 1: Python 3.12 standard library only).
#   ./build.sh [out_dir]      default: site/ next to this script
set -eu
here=$(cd "$(dirname "$0")" && pwd)
out=${1:-"$here/site"}
exec python3 "$here/build.py" "$out"
