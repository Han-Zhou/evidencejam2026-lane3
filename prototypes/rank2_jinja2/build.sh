#!/bin/sh
# One command: ./build.sh [out_dir]   (default: ./site next to this script)
# Needs only python3 (3.9 or newer). Jinja2 and MarkupSafe are vendored in ./vendor.
# No network call. No LLM call.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
exec python3 "$here/build.py" "$@"
