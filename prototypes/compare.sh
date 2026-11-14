#!/usr/bin/env bash
# Build every prototype, time it, run the accuracy checker, and print a summary.
#   ./prototypes/compare.sh            # all prototypes
#   ./prototypes/compare.sh rank1_stdlib rank3_eleventy
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
if [ $# -gt 0 ]; then DIRS=("$@"); else DIRS=(rank1_stdlib rank2_jinja2 rank3_eleventy rank4_sveltekit); fi

printf '%-18s %8s %8s %10s %10s %s\n' prototype build_s check files total_B first_view_B
for d in "${DIRS[@]}"; do
  if [ ! -x "$d/build.sh" ]; then printf '%-18s %s\n' "$d" "no build.sh"; continue; fi
  start=$(python3 -c 'import time; print(time.time())')
  if (cd "$d" && ./build.sh site >"$HERE/.build_$d.log" 2>&1); then
    secs=$(python3 -c "import time; print(f'{time.time()-$start:.2f}')")
  else
    secs="FAILED"
  fi
  if python3 check_site.py "$d/site" >"$HERE/.check_$d.log" 2>&1; then chk=PASS; else chk=FAIL; fi
  read -r files total < <(find "$d/site" -type f 2>/dev/null | python3 -c '
import os,sys
fs=[l.strip() for l in sys.stdin if l.strip()]
print(len(fs), sum(os.path.getsize(f) for f in fs))')
  # first view: index.html plus the scripts and stylesheets it references
  first=$(python3 - "$d/site" <<'EOF'
import re, sys
from pathlib import Path
site = Path(sys.argv[1])
idx = site / "index.html"
if not idx.is_file():
    print("-"); sys.exit()
html = idx.read_text(encoding="utf-8", errors="replace")
total = idx.stat().st_size
seen = set()
for m in re.finditer(r'<(?:script[^>]*\ssrc|link[^>]*\shref)="([^"#?]+)', html):
    ref = m.group(1)
    if ref.startswith(("http:", "https:", "//", "data:")) or ref in seen:
        continue
    seen.add(ref)
    p = (site / ref.lstrip("/")).resolve() if ref.startswith("/") else (idx.parent / ref).resolve()
    if p.is_file() and p.suffix in (".js", ".css", ".mjs"):
        total += p.stat().st_size
print(total)
EOF
)
  printf '%-18s %8s %8s %10s %10s %s\n' "$d" "$secs" "$chk" "$files" "$total" "$first"
done
echo
echo "Logs: prototypes/.build_<name>.log and prototypes/.check_<name>.log"
