#!/usr/bin/env python3
"""Check a built prototype site against the Q1 and Q2 answer files.

    python3 prototypes/check_site.py <site_dir>

Reads every .html and .json file under <site_dir> as built (no JavaScript runs)
and checks the machine-check contract in prototypes/SPEC.md:

- every Panel A finding, gap and interaction, and every Panel B node, edge and
  gap has an element with the right data-* attributes, and the values equal the
  JSON values;
- no data-* id names something that is not in the JSON (invented content);
- every claim id in both evidence maps appears in the site with its quote;
- no script, stylesheet, image or font loads from another origin.

Q2 (answers/q2_created_marshes.json; skipped with a note if the file is missing):

- every Q2 finding and with_time finding has an element with data-finding-id
  and data-direction, data-certainty, data-studies, data-claims equal to the
  JSON; every Q2 gap has an element with data-gap-id. The data-finding-id and
  data-gap-id checks run once over the Q1 and Q2 items together, because the
  two questions share these attributes;
- each Q2 finding row in index.html shows its certainty_rationale verbatim
  (and, as a warning, its direction label); data-kind is "ref" for findings and
  "age" for with_time;
- each Q2 gap row says "No evidence", names no direction and carries no
  data-direction or data-certainty (a gap is not a negative result);
- every Q2 claim id and quote appears in the site; each row links to a claims
  page section that holds the quotes of that finding (the no-JS road);
- time to reference: the .q2-null element says "unknown" (or the JSON value if
  it is ever not null) and has no digit; no text in any page or in q2.js gives
  a number for time to reference; no class or id names an "arrival" marker;
  short_answer.time_to_reference_note, the question, every limitation and every
  lagging attribute appear verbatim in index.html;
- the Created marshes tab shows the pack counts (findings, claims, papers);
- a shipped JSON file with the Q2 id equals the answer file.

It also prints the size of every shipped file. Errors about Q2 start with "Q2";
the summary gives one verdict for Q1 and the site, and one for Q2.
Exit code 1 on any error.
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
Q2_PATH = REPO / "answers" / "q2_created_marshes.json"

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
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
        "param", "source", "track", "wbr"}
# Elements whose own text is scanned for a time-to-reference number (not the large
# containers, where the text of two separate cells runs together).
SCAN_TAGS = {"p", "li", "td", "th", "span", "em", "strong", "b", "small", "button", "a",
             "h1", "h2", "h3", "h4", "h5", "h6", "dd", "dt", "caption", "figcaption",
             "label", "summary", "blockquote", "option", "text", "title", "desc"}
# A number given as the time a created marsh takes to match its reference.
TTR_NUMBER = [
    re.compile(r"\btime\s+to\s+(?:reach\s+|match\s+)?(?:the\s+|a\s+)?(?:natural\s+)?reference\b[^.!?]{0,60}?\d", re.I),
    re.compile(r"\b(?:reach(?:es|ed|ing)?|match(?:es|ed|ing)?|arriv(?:e|es|ed|al)|catch(?:es)?\s+up|caught\s+up)\b"
               r"[^.!?]{0,60}?\b(?:after|in|by|within|at)\s+(?:about\s+|around\s+|~\s*)?\d+(?:\s*[-–]\s*\d+)?\s*(?:years?|yrs?|y)\b", re.I),
    re.compile(r"\b\d+(?:\s*[-–]\s*\d+)?\s*(?:years?|yrs?)\s+to\s+(?:reach|match|catch\s+up)\b", re.I),
]
ARRIVAL_NAME = re.compile(r"arriv", re.I)
JS_STRING = re.compile(r"'(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\]|\\.)*`")  # string literals
# Fixed UI copy for each direction (Q2 contract). Checked as a warning only.
Q2_DIR_LABEL = {
    "below_reference": "Below reference", "comparable": "Comparable to reference",
    "above_reference": "Above reference", "mixed": "Mixed (studies disagree)", "unclear": "Unclear",
    "no_effect": "No change with age", "increase": "Increases with age", "decrease": "Decreases with age",
}


class Collector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.elements = []  # (tag, attrs dict)
        self.text = []
        # For the Q2 checks: the text of each element (script and style content left
        # out), the page text, where each id starts in it, and each link with the
        # nearest finding or gap around it.
        self.nodes = []     # dicts: tag, attrs, parts, kids, text
        self.stack = []
        self.page = []
        self.id_at = {}
        self.links = []     # (href, ref of the nearest data-finding-id / data-gap-id)
        self.raw = 0

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, {k: (v if v is not None else "") for k, v in attrs}))
        a = self.elements[-1][1]
        if "id" in a and a["id"] not in self.id_at:
            self.id_at[a["id"]] = len(self.page)
        if tag == "a":
            ref = next((n["attrs"].get("data-finding-id") or n["attrs"].get("data-gap-id")
                        for n in reversed(self.stack)
                        if "data-finding-id" in n["attrs"] or "data-gap-id" in n["attrs"]), None)
            self.links.append((a.get("href", ""), ref))
        for n in self.stack:
            n["kids"] += 1
        if tag in ("script", "style"):
            self.raw += 1
        if tag not in VOID:
            node = {"tag": tag, "attrs": a, "parts": [], "kids": 0}
            self.stack.append(node)
            self.nodes.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.raw:
            self.raw -= 1
        if any(n["tag"] == tag for n in self.stack):
            while self.stack:
                if self.stack.pop()["tag"] == tag:
                    break

    def handle_data(self, data):
        self.text.append(data)
        if self.raw:
            return
        self.page.append(data)
        for n in self.stack:
            n["parts"].append(data)

    def finish(self):
        self.close()
        for n in self.nodes:
            n["text"] = norm("".join(n["parts"]))
            del n["parts"]
        self.page_text = norm("".join(self.page))
        return self


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


def plural(n, word):
    return f"{n} {word}" + ("" if n == 1 else "s")


def has_class(node, cls):
    return cls in node["attrs"].get("class", "").split()


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    site = Path(sys.argv[1]).resolve()
    errors, warnings, notes = [], [], []

    if not (site / "index.html").is_file():
        errors.append(f"no index.html in {site}")

    A = json.loads(A_PATH.read_text(encoding="utf-8"))
    B = json.loads(B_PATH.read_text(encoding="utf-8"))
    Q2 = json.loads(Q2_PATH.read_text(encoding="utf-8")) if Q2_PATH.is_file() else None
    if Q2 is None:
        notes.append(f"{Q2_PATH.relative_to(REPO)} not found: Q2 checks skipped")

    by_attr = defaultdict(list)  # attr name -> list of attrs dicts
    corpus_parts = []
    sizes = []
    pages = {}       # rel -> Collector, for the Q2 checks
    shipped_json = {}  # rel -> parsed object
    scripts = {}     # rel -> source text
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
            pages[rel] = p.finish()
            for tag, attrs in p.elements:
                for name in ("data-finding-id", "data-gap-id", "data-interaction-id", "data-node-id", "data-edge-id"):
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
                obj = json.loads(f.read_text(encoding="utf-8"))
                shipped_json[rel] = obj
                json_strings(obj, out)
                corpus_parts.append("\n".join(out))
            except Exception as e:  # noqa: BLE001
                errors.append(f"{rel}: not valid JSON ({e})")
        elif suffix in (".css", ".js", ".mjs"):
            raw = f.read_text(encoding="utf-8", errors="replace")
            scripts[rel] = raw
            if re.search(r"(@import|url\()\s*['\"]?(https?:)?//", raw):
                errors.append(f"{rel}: CSS/JS loads from another origin")
            if re.search(r"fetch\(\s*['\"`]https?://", raw):
                errors.append(f"{rel}: fetch() to another origin")
    corpus = norm("\n".join(corpus_parts))

    def check_items(attr, items, fields, label):
        # items: (id, expected) or (id, expected, label of that item)
        found = defaultdict(list)
        for a in by_attr[attr]:
            found[a[attr]].append(a)
        known = set()
        for item_id, expected, *own in items:
            lab = own[0] if own else label
            known.add(item_id)
            els = found.get(item_id, [])
            if not els:
                errors.append(f"{lab} {item_id!r}: no element with {attr}")
                continue
            if fields and not any(all(f"data-{k}" in e for k in fields) for e in els):
                errors.append(f"{lab} {item_id!r}: no element carries all of " + ", ".join(f"data-{k}" for k in fields))
            for e in els:
                for k in fields:
                    if f"data-{k}" in e and e[f"data-{k}"] != str(expected[k]):
                        errors.append(f"{lab} {item_id!r}: data-{k}={e[f'data-{k}']!r}, JSON says {expected[k]!r}")
        for item_id in found:
            if item_id not in known:
                lab = "Q2 item" if Q2 is not None and item_id.startswith("q2:") else label
                errors.append(f"{lab} {item_id!r}: {attr} names something not in the JSON")

    pooled = ["direction", "certainty", "studies", "claims"]
    q2_found = (Q2["findings"] + Q2["with_time"]) if Q2 else []
    q2_gaps = Q2["gaps"] if Q2 else []
    # data-finding-id is shared by Q1 Panel A and Q2: one call, so that neither
    # question's ids read as "not in the JSON" to the other.
    check_items("data-finding-id",
                [(f["id"], f, "Panel A finding") for f in A["findings"]]
                + [(f["id"], f, "Q2 finding") for f in q2_found],
                pooled, "Panel A finding")
    check_items("data-interaction-id", [(i["edge_id"], i) for i in A["interactions"]], ["direction"], "Panel A interaction")
    check_items("data-node-id", [(n["id"], n) for n in B["nodes"]], [], "Panel B node")
    check_items("data-edge-id", [(e["id"], e) for e in B["edges"]], pooled, "Panel B edge")
    # gaps: one attribute shared by both Q1 panels and Q2
    gap_items = ([(g["id"], g) for g in A["gaps"]] + [(g["id"], g) for g in B["gaps"]]
                 + [(g["id"], g, "Q2 gap") for g in q2_gaps])
    check_items("data-gap-id", gap_items, [], "Gap")

    evidence_sets = [("Panel A", A), ("Panel B", B)] + ([("Q2", Q2)] if Q2 else [])
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

    if Q2 is not None:
        check_q2(Q2, A, B, pages, shipped_json, scripts, errors, warnings)

    total = sum(s for _, s in sizes)
    print(f"Site: {site}")
    print(f"{'bytes':>10}  file")
    for rel, s in sizes:
        print(f"{s:>10}  {rel}")
    print(f"{total:>10}  TOTAL ({len(sizes)} files)")
    print()
    for n in notes:
        print("NOTE ", n)
    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    print()
    q2_err = [e for e in errors if e.startswith("Q2")]
    q1_err = [e for e in errors if not e.startswith("Q2")]
    print("Q1 and site checks: " + ("PASS" if not q1_err else f"FAIL ({len(q1_err)} errors)"))
    print("Q2 checks:          " + ("SKIPPED" if Q2 is None else "PASS" if not q2_err else f"FAIL ({len(q2_err)} errors)"))
    print("PASS" if not errors else f"FAIL ({len(errors)} errors)")
    return 1 if errors else 0


def check_q2(Q2, A, B, pages, shipped_json, scripts, errors, warnings):
    found = Q2["findings"] + Q2["with_time"]
    ref_ids = {f["id"] for f in Q2["findings"]}
    gap_ids = {g["id"] for g in Q2["gaps"]}
    ev = Q2["evidence"]
    idx = pages.get("index.html")
    if idx is None:
        errors.append("Q2: no index.html to check")
        return

    q1_ids = {f["id"] for f in A["findings"]} | {g["id"] for g in A["gaps"] + B["gaps"]}
    clash = sorted(q1_ids & ({f["id"] for f in found} | gap_ids))
    if clash:
        errors.append(f"Q2: ids also used by Q1, e.g. {clash[:3]}")

    rows = defaultdict(list)  # id -> index.html nodes that carry it
    for n in idx.nodes:
        rid = n["attrs"].get("data-finding-id") or n["attrs"].get("data-gap-id")
        if rid:
            rows[rid].append(n)

    # Findings: rationale in the row, kind of row, direction label (warning).
    for f in found:
        els = rows.get(f["id"], [])
        if not els:
            continue  # already an error from check_items
        if not any(norm(f["certainty_rationale"]) in n["text"] for n in els):
            errors.append(f"Q2 finding {f['id']!r}: certainty_rationale not shown verbatim in its row")
        want = "ref" if f["id"] in ref_ids else "age"
        for n in els:
            k = n["attrs"].get("data-kind")
            if k is not None and k != want:
                errors.append(f"Q2 finding {f['id']!r}: data-kind={k!r}, expected {want!r}")
        lab = Q2_DIR_LABEL.get(f["direction"])
        if lab and not any(lab.lower() in n["text"].lower() for n in els):
            warnings.append(f"Q2 finding {f['id']!r}: row does not show the direction label {lab!r}")

    # Gaps: drawn as gaps, never as findings.
    for p in pages.values():
        for tag, a in p.elements:
            if a.get("data-gap-id") in gap_ids:
                bad = [k for k in ("data-direction", "data-certainty") if k in a]
                if bad:
                    errors.append(f"Q2 gap {a['data-gap-id']!r}: element carries {', '.join(bad)} (a gap is not a finding)")
    for g in Q2["gaps"]:
        els = rows.get(g["id"], [])
        if not els:
            continue
        if not any("no evidence" in n["text"].lower() for n in els):
            errors.append(f"Q2 gap {g['id']!r}: row does not say 'No evidence'")
        for lab in Q2_DIR_LABEL.values():
            if any(lab.lower() in n["text"].lower() for n in els):
                errors.append(f"Q2 gap {g['id']!r}: row names the direction {lab!r} (a gap has no direction)")

    # No-JS road: each row links to a claims page section that holds its quotes.
    targets = defaultdict(set)  # page -> fragment ids that rows link to
    row_links = defaultdict(list)
    for href, ref in idx.links:
        if ref and "#" in href and not href.startswith("#") and not EXTERNAL.match(href):
            page, frag = href.split("#", 1)
            row_links[ref].append((page, frag))
            targets[page].add(frag)
    starts = {}
    for page, frags in targets.items():
        p = pages.get(page)
        if p:
            starts[page] = sorted(p.id_at[x] for x in frags if x in p.id_at)

    def section(page, frag):
        p = pages[page]
        i = p.id_at[frag]
        j = next((s for s in starts[page] if s > i), len(p.page))
        return norm("".join(p.page[i:j]))

    for item in found + Q2["gaps"]:
        if not rows.get(item["id"]):
            continue
        links = row_links.get(item["id"], [])
        ok = [(pg, fr) for pg, fr in links if pg in pages and fr in pages[pg].id_at]
        if not links:
            errors.append(f"Q2 {'gap' if item['id'] in gap_ids else 'finding'} {item['id']!r}: row has no link to a claims page")
            continue
        if not ok:
            errors.append(f"Q2 {'gap' if item['id'] in gap_ids else 'finding'} {item['id']!r}: link target {links[0][0]}#{links[0][1]} not found")
            continue
        if item["id"] in gap_ids:
            continue
        text = section(*ok[0])
        miss = [e for e in item["edge_ids"] if e not in ev or norm(ev[e]["quote"]) not in text]
        if miss:
            errors.append(f"Q2 finding {item['id']!r}: {len(miss)} quotes not in {ok[0][0]}#{ok[0][1]}, e.g. {miss[:2]}")

    # Time to reference: say "unknown" (or the JSON value); never give a number.
    sa = Q2["short_answer"]
    ttr = sa["time_to_reference"]
    nulls = [n for n in idx.nodes if has_class(n, "q2-null")]
    if not nulls:
        errors.append("Q2: no .q2-null element (time to reference)")
    for n in nulls:
        if ttr is None:
            if "unknown" not in n["text"].lower():
                errors.append(f"Q2: .q2-null says {n['text']!r}, not 'unknown' (time_to_reference is null)")
            if re.search(r"\d", n["text"]):
                errors.append(f"Q2: .q2-null gives a number: {n['text']!r}")
        elif str(ttr) not in n["text"]:
            errors.append(f"Q2: .q2-null says {n['text']!r}, JSON says {ttr!r}")
    if ttr is None:
        quotes = sorted({norm(e["quote"]) for d in (A, B, Q2) for e in d["evidence"].values()}, key=len, reverse=True)

        def ttr_hit(text):
            if not any(r.search(text) for r in TTR_NUMBER):
                return None
            for q in quotes:  # a source quote is the paper's own words, not our answer
                if q in text:
                    text = text.replace(q, " ")
            for r in TTR_NUMBER:
                m = r.search(text)
                if m:
                    return m.group(0)
            return None

        seen = set()
        for rel, p in pages.items():
            for n in p.nodes:
                if n["tag"] in SCAN_TAGS or (n["tag"] == "div" and not n["kids"]):
                    hit = ttr_hit(n["text"])
                    if hit and (rel, hit) not in seen:
                        seen.add((rel, hit))
                        errors.append(f"Q2: {rel} gives a number for time to reference: {hit!r}")
            for tag, a in p.elements:
                for k in ("class", "id"):
                    if ARRIVAL_NAME.search(a.get(k, "")):
                        errors.append(f"Q2: {rel}: <{tag} {k}=\"{a[k]}\"> names an arrival marker (no study reports an arrival year)")
                for k, v in a.items():
                    if k.startswith("data-") and re.search(r"time.?to.?ref|ttr|arriv", k) and re.search(r"\d", v):
                        errors.append(f"Q2: {rel}: <{tag} {k}=\"{v}\"> gives a number for time to reference")
        for rel, src in scripts.items():
            if rel.endswith(".js"):  # the UI text in a script is in its string literals
                for lit in JS_STRING.findall(src):
                    for r in TTR_NUMBER:
                        m = r.search(lit)
                        if m:
                            errors.append(f"Q2: {rel} gives a number for time to reference: {m.group(0)!r}")
            if rel.endswith(".css") and re.search(r"\.[\w-]*arriv", src, re.I):
                errors.append(f"Q2: {rel} styles an arrival marker")
    if norm(sa["time_to_reference_note"]) not in idx.page_text:
        errors.append("Q2: short_answer.time_to_reference_note not in index.html verbatim")

    # Verbatim pack text on the page.
    if norm(Q2["question"]) not in idx.page_text:
        errors.append("Q2: question not in index.html verbatim")
    for i, lim in enumerate(Q2["limitations"]):
        if norm(lim) not in idx.page_text:
            errors.append(f"Q2: limitation {i + 1} not in index.html verbatim: {lim[:60]!r}")
    lag_text = " ".join(n["text"] for n in idx.nodes if has_class(n, "q2-lags"))
    for lab in sa["lagging_attributes"]:
        if norm(lab) not in lag_text:
            errors.append(f"Q2: lagging attribute {lab!r} not in .q2-lags")

    # The tab shows the pack counts.
    tab = [n for n in idx.nodes if n["attrs"].get("id") == "tab-marshes"]
    if not tab:
        errors.append("Q2: no #tab-marshes tab")
    else:
        papers = len({e["document_id"] for e in ev.values()})
        for want in (plural(len(found), "finding"), plural(len(ev), "claim"), plural(papers, "paper")):
            if want not in tab[0]["text"]:
                errors.append(f"Q2: #tab-marshes does not say {want!r} (it says {tab[0]['text']!r})")

    # A shipped copy of the answer file is the answer file.
    for rel, obj in shipped_json.items():
        if isinstance(obj, dict) and obj.get("id") == Q2["id"] and obj != Q2:
            errors.append(f"Q2: {rel} differs from {Q2_PATH.relative_to(REPO)}")


if __name__ == "__main__":
    sys.exit(main())
