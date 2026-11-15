#!/usr/bin/env python3
"""Check a built Q1 prototype site against the two Q1 answer files.

    python3 prototypes/check_site.py <site_dir>

Reads every .html and .json file under <site_dir> as built (no JavaScript runs)
and checks the machine-check contract in prototypes/SPEC.md:

- every Panel A finding, gap and interaction, and every Panel B node, edge and
  gap has an element with the right data-* attributes, and the values equal the
  JSON values;
- no data-* id names something that is not in the JSON (invented content);
- every claim id in both evidence maps appears in the site with its quote;
- no script, stylesheet, image or font loads from another origin.

When the site has a Q3 gap map (data-q3-* attributes or data/gapmap.json), it also checks
answers/q3_grassland_gaps.json the same way: every finding (data-q3-finding-id, with
direction, certainty, studies, claims and density), every gap (data-q3-gap-id), and every
claim id and quote.

It also prints the size of every shipped file. Exit code 1 on any error.
"""

import html
import json
import re
import sys
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
A_PATH = REPO / "answers" / "q1_tree_planting.json"
B_PATH = REPO / "answers" / "q1_tree_planting_graph.json"
C_PATH = REPO / "answers" / "q3_grassland_gaps.json"

EXTERNAL = re.compile(r"^\s*(https?:)?//", re.I)
LOADING_ATTRS = {
    "script": ["src"],
    "link": ["href"],
    "img": ["src", "srcset"],
    "source": ["src", "srcset"],
    "iframe": ["src"],
    "video": ["src", "poster"],
    "audio": ["src"],
    "image": ["href", "xlink:href"],
    "use": ["href", "xlink:href"],
}


class Collector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.elements = []  # (tag, attrs dict)
        self.text = []

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, {k: (v if v is not None else "") for k, v in attrs}))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_data(self, data):
        self.text.append(data)


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def json_strings(obj, out):
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, dict):
        for k, v in obj.items():
            out.append(str(k))
            json_strings(v, out)
    elif isinstance(obj, list):
        for v in obj:
            json_strings(v, out)


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    site = Path(sys.argv[1]).resolve()
    errors, warnings = [], []

    if not (site / "index.html").is_file():
        errors.append(f"no index.html in {site}")

    A = json.loads(A_PATH.read_text(encoding="utf-8"))
    B = json.loads(B_PATH.read_text(encoding="utf-8"))

    by_attr = defaultdict(list)  # attr name -> list of attrs dicts
    corpus_parts = []
    sizes = []
    for f in sorted(site.rglob("*")):
        if not f.is_file():
            continue
        rel = f.relative_to(site).as_posix()
        sizes.append((rel, f.stat().st_size))
        suffix = f.suffix.lower()
        if suffix in (".html", ".htm", ".svg"):
            raw = f.read_text(encoding="utf-8", errors="replace")
            p = Collector()
            p.feed(raw)
            for tag, attrs in p.elements:
                for name in ("data-finding-id", "data-gap-id", "data-interaction-id", "data-node-id", "data-edge-id",
                             "data-q3-finding-id", "data-q3-gap-id"):
                    if name in attrs:
                        by_attr[name].append(attrs)
                for name in LOADING_ATTRS.get(tag, []):
                    val = attrs.get(name, "")
                    if tag == "link" and attrs.get("rel", "").lower() not in ("stylesheet", "preload", "icon", "modulepreload", "manifest", "prefetch"):
                        continue
                    if val and EXTERNAL.match(val):
                        errors.append(f"{rel}: <{tag} {name}=\"{val}\"> loads from another origin")
                if tag == "a" and EXTERNAL.match(attrs.get("href", "")):
                    href = attrs["href"]
                    if not re.match(r"^https://doi\.org/", href):
                        warnings.append(f"{rel}: external link {href}")
            corpus_parts.append(html.unescape(raw))
            corpus_parts.append(" ".join(p.text))
        elif suffix == ".json":
            try:
                out = []
                json_strings(json.loads(f.read_text(encoding="utf-8")), out)
                corpus_parts.append("\n".join(out))
            except Exception as e:  # noqa: BLE001
                errors.append(f"{rel}: not valid JSON ({e})")
        elif suffix in (".css", ".js", ".mjs"):
            raw = f.read_text(encoding="utf-8", errors="replace")
            if re.search(r"(@import|url\()\s*['\"]?(https?:)?//", raw):
                errors.append(f"{rel}: CSS/JS loads from another origin")
            if re.search(r"fetch\(\s*['\"`]https?://", raw):
                errors.append(f"{rel}: fetch() to another origin")
    corpus = norm("\n".join(corpus_parts))

    def check_items(attr, items, fields, label):
        found = defaultdict(list)
        for a in by_attr[attr]:
            found[a[attr]].append(a)
        known = set()
        for item_id, expected in items:
            known.add(item_id)
            els = found.get(item_id, [])
            if not els:
                errors.append(f"{label} {item_id!r}: no element with {attr}")
                continue
            if fields and not any(all(f"data-{k}" in e for k in fields) for e in els):
                errors.append(f"{label} {item_id!r}: no element carries all of " + ", ".join(f"data-{k}" for k in fields))
            for e in els:
                for k in fields:
                    if f"data-{k}" in e and e[f"data-{k}"] != str(expected[k]):
                        errors.append(f"{label} {item_id!r}: data-{k}={e[f'data-{k}']!r}, JSON says {expected[k]!r}")
        for item_id in found:
            if item_id not in known:
                errors.append(f"{label} {item_id!r}: {attr} names something not in the JSON")

    pooled = ["direction", "certainty", "studies", "claims"]
    check_items("data-finding-id", [(f["id"], f) for f in A["findings"]], pooled, "Panel A finding")
    check_items("data-interaction-id", [(i["edge_id"], i) for i in A["interactions"]], ["direction"], "Panel A interaction")
    check_items("data-node-id", [(n["id"], n) for n in B["nodes"]], [], "Panel B node")
    check_items("data-edge-id", [(e["id"], e) for e in B["edges"]], pooled, "Panel B edge")
    # gaps: one attribute shared by both panels
    gap_items = [(g["id"], g) for g in A["gaps"]] + [(g["id"], g) for g in B["gaps"]]
    check_items("data-gap-id", gap_items, [], "Gap")

    evidence_sets = [("Panel A", A), ("Panel B", B)]
    if by_attr["data-q3-finding-id"] or by_attr["data-q3-gap-id"] or (site / "data" / "gapmap.json").is_file():
        C = json.loads(C_PATH.read_text(encoding="utf-8"))
        check_items("data-q3-finding-id", [(f["id"], f) for f in C["findings"]], pooled + ["density"], "Q3 finding")
        check_items("data-q3-gap-id", [(g["id"], g) for g in C["gaps"]], [], "Q3 gap")
        evidence_sets.append(("Q3", C))

    for label, data in evidence_sets:
        missing_id, missing_quote = [], []
        for cid, ev in data["evidence"].items():
            if cid not in corpus:
                missing_id.append(cid)
            if norm(ev["quote"]) not in corpus:
                missing_quote.append(cid)
        if missing_id:
            errors.append(f"{label}: {len(missing_id)} claim ids not in the site, e.g. {missing_id[:3]}")
        if missing_quote:
            errors.append(f"{label}: {len(missing_quote)} quotes not in the site verbatim, e.g. {missing_quote[:3]}")

    total = sum(s for _, s in sizes)
    print(f"Site: {site}")
    print(f"{'bytes':>10}  file")
    for rel, s in sizes:
        print(f"{s:>10}  {rel}")
    print(f"{total:>10}  TOTAL ({len(sizes)} files)")
    print()
    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    print()
    print("PASS" if not errors else f"FAIL ({len(errors)} errors)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
