#!/usr/bin/env python3

"""Preview the Q1 site of every git worktree on one local port.

    python3 prototypes/preview.py                  build all previews and write the gallery
    python3 prototypes/preview.py serve [port]     build, then serve http://127.0.0.1:8899/
    python3 prototypes/preview.py note <slug> "…"  set the one-line idea note of a worktree
    python3 prototypes/preview.py note <slug>      show the note

Each worktree is built with its own prototypes/rank1_stdlib/build.py into
.claude/preview/<slug>/ (gitignored). The agent's own site/ folder is not touched.
If a build fails, the last good preview stays and the gallery marks it as stale.

The gallery (.claude/preview/index.html) shows one row per worktree: the idea note,
the branch, commits ahead of and behind main, changed files, the last commit, the
build result and the first-view weight. compare.html shows two previews side by side.
While "serve" runs, the "Rebuild all" button rebuilds without a restart.

A worktree with no work beyond main is hidden: all its commits are in main (it is
merged, or its agent has not committed yet) and it has no uncommitted files. It is not
built, and the gallery lists it by name at the bottom. It comes back when it has new work.

Notes are git branch descriptions. All worktrees share them, and they never go into
the files you merge. An agent sets its own note with:
    git config branch."$(git branch --show-current)".description "Edge labels on hover"

BRINE_* variables are removed from the build environment, so previews never call the
LLM. Python standard library only.
"""

import html
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BUILD = Path("prototypes/rank1_stdlib/build.py")  # relative to each worktree
BASE = "main"
PORT = 8899
HERE = Path(__file__).resolve().parent


def git(*args, cwd, strip=True):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        return ""
    return r.stdout.strip() if strip else r.stdout


def worktrees():
    """Entries of `git worktree list --porcelain`. The first one is the main worktree."""
    out, cur = [], {}
    for line in git("worktree", "list", "--porcelain", cwd=HERE).splitlines() + [""]:
        if not line:
            if cur:
                out.append(cur)
            cur = {}
            continue
        key, _, val = line.partition(" ")
        cur[key] = val
    return out


MAIN = Path(worktrees()[0]["worktree"])
OUT = MAIN / ".claude" / "preview"
LOCK = threading.Lock()


def slug_of(path):
    if path == MAIN:
        return "main"
    name = path.name
    m = re.fullmatch(r"agent-([0-9a-f]+)", name)
    return m.group(1)[:7] if m else re.sub(r"[^A-Za-z0-9._-]", "-", name)


def info(wt):
    path = Path(wt["worktree"])
    branch = wt.get("branch", "").removeprefix("refs/heads/")
    head = wt.get("HEAD", "")
    is_main = path == MAIN
    status = git("status", "--porcelain", cwd=path, strip=False).splitlines()
    dirty = [l[3:] for l in status if l.strip()]
    changed = set(dirty)
    if not is_main:
        mb = git("merge-base", BASE, head, cwd=MAIN)
        if mb:
            changed |= set(git("diff", "--name-only", mb, cwd=path).splitlines())
    return {
        "slug": slug_of(path),
        "path": "." if is_main else str(path.relative_to(MAIN)) if path.is_relative_to(MAIN) else str(path),
        "abs": path,
        "branch": branch or "(detached)",
        "note": git("config", "branch.%s.description" % branch, cwd=MAIN) if branch else "",
        "main": is_main,
        "ahead": 0 if is_main else int(git("rev-list", "--count", "%s..%s" % (BASE, head), cwd=MAIN) or 0),
        "behind": 0 if is_main else int(git("rev-list", "--count", "%s..%s" % (head, BASE), cwd=MAIN) or 0),
        "dirty": len(dirty),
        "changed": sorted(c for c in changed if c),
        "last": git("log", "-1", "--format=%h\t%s\t%cr", cwd=path).split("\t") + ["", "", ""],
    }


def build(d):
    """Build into a temp folder, then swap it in. A failed build keeps the old preview."""
    script = d["abs"] / BUILD
    dest = OUT / d["slug"]
    tmp = OUT / (".build-" + d["slug"])
    d.update(build_ok=False, build_msg="", first_kb=None, stale=False, log=None, secs=0.0)
    if not script.is_file():
        d["build_msg"] = "no %s" % BUILD
        if dest.exists():
            shutil.rmtree(dest)
        return
    env = {k: v for k, v in os.environ.items() if not k.startswith("BRINE_")}
    t0 = time.time()
    try:
        r = subprocess.run([sys.executable, str(script), str(tmp)], cwd=script.parent, env=env,
                           capture_output=True, text=True, timeout=300)
        code, text = r.returncode, r.stdout + r.stderr
    except subprocess.TimeoutExpired:
        code, text = -1, "build timed out after 300 s"
    d["secs"] = time.time() - t0
    if code == 0 and (tmp / "index.html").is_file():
        if dest.exists():
            shutil.rmtree(dest)
        tmp.rename(dest)
        d["build_ok"] = True
        m = re.search(r"(\d+)\s+total, (\d+)\s+first view", text)
        if m:
            d["first_kb"] = int(m.group(2)) / 1024
        return
    if tmp.exists():
        shutil.rmtree(tmp)
    log = OUT / ("%s.build.log" % d["slug"])
    log.write_text(text, encoding="utf-8")
    d["log"] = log.name
    d["build_msg"] = (text.strip().splitlines() or ["exit %d" % code])[-1][:200]
    d["stale"] = (dest / "index.html").is_file()


CSS = """
:root{--bg:#fafaf9;--fg:#1c1917;--muted:#57534e;--line:#d6d3d1;--card:#fff;--ok:#166534;--bad:#b91c1c;--warn:#92400e;--link:#1d4ed8;--chip:#f5f5f4}
@media (prefers-color-scheme:dark){:root{--bg:#1c1917;--fg:#f5f5f4;--muted:#a8a29e;--line:#44403c;--card:#292524;--ok:#86efac;--bad:#fca5a5;--warn:#fcd34d;--link:#93c5fd;--chip:#3a3532}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,sans-serif}
a{color:var(--link)}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:16px}
h1{font-size:20px;margin:0}
.muted{color:var(--muted)}
.wrap{padding:0 16px 24px;overflow-x:auto}
table{border-collapse:collapse;width:100%;background:var(--card);border:1px solid var(--line)}
th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--line)}
th{font-weight:600;white-space:nowrap}
code{background:var(--chip);padding:1px 4px;border-radius:3px;font-size:12px}
.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}
.slug{font-weight:600;font-size:15px}
.note{max-width:34ch}
button,select{font:inherit;padding:6px 12px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--fg);cursor:pointer}
details summary{cursor:pointer}
ul.files{margin:4px 0 0;padding-left:18px;font-size:12px}
footer{padding:0 16px 24px}
"""


def gallery(rows, hidden):
    e = html.escape
    sha = git("rev-parse", "--short", BASE, cwd=MAIN)
    trs = []
    for d in rows:
        s = d["slug"]
        link = '<a class="slug" href="%s/">%s</a>' % (e(s), e(s)) if (d["build_ok"] or d["stale"]) else '<span class="slug">%s</span>' % e(s)
        note = e(d["note"]) if d["note"] else '<span class="muted">No note</span>'
        if d["main"]:
            vs = '<span class="muted">base</span>'
        else:
            vs = "%d ahead" % d["ahead"]
        if d["behind"]:
            vs += '<br><span class="warn">%d behind main</span>' % d["behind"]
        n = len(d["changed"])
        if n:
            ch = "<details><summary>%d file%s%s</summary><ul class=files>%s</ul></details>" % (
                n, "" if n == 1 else "s", " (%d uncommitted)" % d["dirty"] if d["dirty"] else "",
                "".join("<li><code>%s</code></li>" % e(f) for f in d["changed"][:40]))
        else:
            ch = '<span class="muted">none</span>'
        h, subj, when = d["last"][:3]
        last = "<code>%s</code> %s<br><span class=muted>%s · <code>%s</code></span>" % (e(h), e(subj), e(when), e(d["branch"]))
        if d["build_ok"]:
            b = '<span class="ok">✓ built</span>'
            if d["first_kb"] is not None:
                b += '<br><span class="muted">first view %.0f KB</span>' % d["first_kb"]
        elif d["log"]:
            b = '<span class="bad">✗ failed</span> <a href="%s">log</a><br><span class="muted">%s</span>' % (e(d["log"]), e(d["build_msg"]))
            if d["stale"]:
                b += '<br><span class="warn">Link shows the last good build</span>'
        else:
            b = '<span class="muted">%s</span>' % e(d["build_msg"])
        cmp_ = "" if d["main"] or not (d["build_ok"] or d["stale"]) else '<a href="compare.html#a=main&amp;b=%s">vs main</a>' % e(s)
        trs.append("<tr><td>%s</td><td class=note>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>"
                   % (link, note, last, vs, ch, b, cmp_))
    hid = ("<p>Hidden, no work beyond %s (merged, or nothing committed yet): %s</p>"
           % (e(BASE), ", ".join("<code>%s</code>" % e(d["slug"]) for d in hidden))) if hidden else ""
    return """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Worktree previews</title><style>%s</style></head><body>
<header><div><h1>Worktree previews</h1><div class="muted">Built %s · base <code>%s</code> at <code>%s</code> · %d shown, %d hidden</div></div>
<form method="post" action="/__rebuild"><button type="submit">Rebuild all</button> <a href="compare.html">Compare two</a></form></header>
<div class="wrap"><table><thead><tr><th scope=col>Preview</th><th scope=col>Idea</th><th scope=col>Last commit · branch</th><th scope=col>vs main</th><th scope=col>Changed files</th><th scope=col>Build</th><th scope=col>Compare</th></tr></thead>
<tbody>%s</tbody></table></div>
<footer class="muted">%s<p>Set a note from inside a worktree: <code>git config branch."$(git branch --show-current)".description "Your idea"</code>
or from the main checkout: <code>python3 prototypes/preview.py note &lt;slug&gt; "Your idea"</code>.</p>
<p>"Rebuild all" works only under <code>python3 prototypes/preview.py serve</code>. Accept an idea: merge its branch. Abandon it: <code>git worktree remove</code> and delete the branch.</p></footer>
</body></html>
""" % (CSS, time.strftime("%H:%M:%S"), e(BASE), e(sha), len(rows), len(hidden), "\n".join(trs), hid)


def compare_page(rows):
    opts = [{"s": d["slug"], "l": d["slug"] + (" — " + d["note"] if d["note"] else "")}
            for d in rows if d["build_ok"] or d["stale"]]
    return """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Compare previews</title><style>%s
html,body{height:100%%}body{display:flex;flex-direction:column}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 16px;border-bottom:1px solid var(--line)}
.panes{flex:1;display:flex;min-height:0}.panes iframe{flex:1;border:0;border-right:1px solid var(--line);min-width:0;background:#fff}
@media (max-width:800px){.panes{flex-direction:column}.panes iframe{border-right:0;border-bottom:1px solid var(--line)}}
</style></head><body>
<div class="bar"><a href="./">← All previews</a>
<label>Left <select id="a"></select></label><button id="swap" type="button">⇄ Swap</button><label>Right <select id="b"></select></label></div>
<div class="panes"><iframe id="fa" title="Left preview"></iframe><iframe id="fb" title="Right preview"></iframe></div>
<script>
const O=%s,$=id=>document.getElementById(id);
for(const k of["a","b"])for(const o of O)$(k).add(new Option(o.l,o.s));
function read(){const p=new URLSearchParams(location.hash.slice(1));
 $("a").value=p.get("a")||(O[0]||{}).s;$("b").value=p.get("b")||(O[1]||O[0]||{}).s;show();}
function show(){for(const k of["a","b"]){const f=$("f"+k),u=$(k).value+"/";if(f.getAttribute("src")!==u)f.setAttribute("src",u);}}
function write(){history.replaceState(null,"","#a="+$("a").value+"&b="+$("b").value);show();}
$("a").onchange=$("b").onchange=write;
$("swap").onclick=()=>{const t=$("a").value;$("a").value=$("b").value;$("b").value=t;write();};
addEventListener("hashchange",read);read();
</script></body></html>
""" % (CSS, json.dumps(opts).replace("</", "<\\/"))


def build_all():
    with LOCK:
        OUT.mkdir(parents=True, exist_ok=True)
        found = [info(wt) for wt in worktrees() if Path(wt["worktree"]).is_dir()]
        # Merged (or not started) and clean: nothing to see beyond main.
        hidden = [d for d in found if not d["main"] and not d["ahead"] and not d["dirty"]]
        rows = [d for d in found if d not in hidden]
        for d in rows:
            build(d)
        keep = {d["slug"] for d in rows}
        for p in OUT.iterdir():  # drop previews of removed worktrees
            if p.is_dir() and p.name not in keep:
                shutil.rmtree(p)
            elif p.suffix == ".log" and p.name.removesuffix(".build.log") not in {d["slug"] for d in rows if d["log"]}:
                p.unlink()
        (OUT / "index.html").write_text(gallery(rows, hidden), encoding="utf-8")
        (OUT / "compare.html").write_text(compare_page(rows), encoding="utf-8")
        return rows, hidden


def report(rows, hidden):
    print("%-15s %-8s %5s %6s %5s  %s" % ("slug", "build", "ahead", "behind", "dirty", "note"))
    for d in rows:
        b = "ok" if d["build_ok"] else ("STALE" if d["stale"] else ("FAILED" if d["log"] else "-"))
        print("%-15s %-8s %5s %6s %5s  %s" % (d["slug"], b, d["ahead"] or "-", d["behind"] or "-",
                                              d["dirty"] or "-", d["note"] or "(no note)"))
    if hidden:
        print("hidden, no work beyond %s: %s" % (BASE, ", ".join(d["slug"] for d in hidden)))
    print("gallery: %s" % (OUT / "index.html"))


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/__rebuild":
            return self.send_error(404)
        report(*build_all())
        self.send_response(303)
        self.send_header("Location", "/")
        self.end_headers()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # always show the newest build
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


def main():
    args = sys.argv[1:]
    cmd = args[0] if args else "build"
    if cmd == "note":
        if len(args) < 2:
            sys.exit("usage: preview.py note <slug> [text]")
        for wt in worktrees():
            path = Path(wt["worktree"])
            branch = wt.get("branch", "").removeprefix("refs/heads/")
            if slug_of(path) == args[1] and branch:
                key = "branch.%s.description" % branch
                if len(args) > 2:
                    subprocess.run(["git", "config", key, " ".join(args[2:])], cwd=MAIN, check=True)
                print("%s (%s): %s" % (args[1], branch, git("config", key, cwd=MAIN) or "(no note)"))
                return
        sys.exit("no worktree with slug %r (run preview.py to list slugs)" % args[1])
    if cmd not in ("build", "serve"):
        sys.exit(__doc__)
    report(*build_all())
    if cmd == "serve":
        port = int(args[1]) if len(args) > 1 else PORT
        srv = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=str(OUT)))
        print("serving http://127.0.0.1:%d/  (Ctrl-C to stop)" % port, flush=True)
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
