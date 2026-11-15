#!/usr/bin/env python3
"""Build the Q1 prototype site. Rank 1 stack: Python 3.12 standard library only.

    python3 build.py [out_dir]          (default: site/ next to this file)

Reads ../../answers/q1_tree_planting.json (Panel A, "Findings") and
../../answers/q1_tree_planting_graph.json (Panel B, "Network"). Writes static
HTML, CSS, one small JS file and one JSON file per panel. No network, no LLM.
Every direction, certainty, rationale, count, label, quote, title, year and DOI
is copied from the JSON. The page only counts, sorts, filters and groups them.
"""

import html
import json
import re
import shutil
import sys
from collections import Counter, defaultdict
from pathlib import Path

from layout import CHIP_H, CHIP_W, GAP_H, GAP_W, LG_LINE, LG_SG, LG_SW, LG_TITLE_PX, layout

HERE = Path(__file__).resolve().parent
ANSWERS = HERE.parent.parent / "answers"

DIR = {
    "increase": ("↑", "Increase"),
    "decrease": ("↓", "Decrease"),
    "mixed": ("↕", "Mixed (studies disagree)"),
    "no_effect": ("=", "No effect (tested)"),
    "unclear": ("?", "Unclear"),
}
DIR_ORDER = ["increase", "decrease", "mixed", "no_effect", "unclear"]
CERT = {"high": (4, "High"), "moderate": (3, "Moderate"), "low": (2, "Low"), "very_low": (1, "Very low")}
CERT_ORDER = ["high", "moderate", "low", "very_low"]
ARROW_TXT = "→"

# Fixed UI copy for lane titles. Subtitles are the node_kinds text, verbatim.
KIND_TITLE = {
    "planting_stock": "Planting stock",
    "site_treatment": "Site treatments",
    "combination": "Combined treatments",
    "condition": "Conditions",
    "outcome": "Outcomes",
}
KIND_LANE = {"planting_stock": 0, "site_treatment": 0, "combination": 0, "condition": 1, "outcome": 2}
LANE0_GROUPS = ["planting_stock", "site_treatment", "combination"]
# Variant B: the start state of "Show all edges" in each panel. True: every edge shows (the v6
# look). False: with JS the graph shows nodes only until a selection.
EDGES_ALL = {"findings": True, "network": False}

GAP_NOTE = "No study in this corpus tested this pairing. This is a gap, not a negative result."
DRAWER_EMPTY = "Select a node or an edge. Its details, claims and quotes show here."

# Applied in <head> before the stylesheet, so a stored theme shows with no flash (SPEC 4.2).
THEME_JS = ('try{var t=localStorage.getItem("q1-theme");'
            'if(t=="dark"||t=="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}')
THEME_BTN = (
    '<button type="button" class="theme" aria-pressed="false" aria-label="Switch to dark theme">'
    '<svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>'
    '<svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/>'
    '<path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>'
    '</button>')
MEMBER_NOTE = "member of a combination — not an evidence edge"
XICON = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>')


def esc(s):
    return html.escape(str(s), quote=True)


def slug(s):
    return re.sub(r"[^A-Za-z0-9_-]", "-", s)


def plural(n, one, many):
    return "%d %s" % (n, one if n == 1 else many)


def fmt(v):
    return ("%.1f" % v).rstrip("0").rstrip(".")


def mini(text):
    """Very small, safe CSS/JS minifier: drop comment lines, indentation and blank lines."""
    out = []
    in_block = False
    for line in text.splitlines():
        s = line.strip()
        if in_block:
            if "*/" in s:
                in_block = False
                s = s.split("*/", 1)[1].strip()
            else:
                continue
        if s.startswith("/*"):
            if "*/" not in s:
                in_block = True
                continue
            s = s.split("*/", 1)[1].strip()
        if not s or s.startswith("//"):
            continue
        out.append(s)
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------------------
# Models: one per panel, each from its own file only (SPEC 1.5)
# ---------------------------------------------------------------------------

def papers_of(evidence):
    papers = {}
    for cid, ev in evidence.items():
        doc = ev["document_id"]
        rec = (ev["title"], ev["year"], ev["doi"])
        if doc in papers:
            assert papers[doc] == rec, "paper fields differ for %s" % doc
        papers[doc] = rec
    return papers


def model_a(A):
    nodes, seen = [], set()

    def add(ref, lane):
        if ref["id"] not in seen:
            seen.add(ref["id"])
            nodes.append({"id": ref["id"], "label": ref["label"], "lane": lane, "group": None,
                          "shape": "factor" if lane == 0 else "outcome"})

    for f in A["findings"]:
        add(f["subject"], 0)
    for g in A["gaps"]:
        add(g["subject"], 0)
    for f in A["findings"]:
        add(f["outcome"], 1)
    for g in A["gaps"]:
        add(g["outcome"], 1)
    items = []
    for f in A["findings"]:
        items.append({
            "ref": "finding:" + f["id"], "ty": "finding", "id": f["id"], "kind": "effect",
            "src": f["subject"]["id"], "tgt": f["outcome"]["id"], "te": None,
            "sl": f["subject"]["label"], "tl": f["outcome"]["label"],
            "dir": f["direction"], "cert": f["certainty"], "rat": f["certainty_rationale"],
            "studies": f["studies"], "claims": f["claims"], "sd": f["study_directions"],
            "cd": f["claim_directions"], "ids": f["edge_ids"], "docs": f["document_ids"], "dm": None,
        })
    gaps = []
    for g in A["gaps"]:
        gaps.append({"ref": "gap:" + g["id"], "ty": "gap", "id": g["id"], "src": g["subject"]["id"],
                     "tgt": g["outcome"]["id"], "sl": g["subject"]["label"], "tl": g["outcome"]["label"],
                     "sf": g["searched_for"], "status": g["status"]})
    return {
        "key": "findings", "name": "Findings", "file": "q1_tree_planting.json", "src": A,
        "nodes": nodes, "items": items, "gaps": gaps, "evidence": A["evidence"],
        "papers": papers_of(A["evidence"]), "item_word": ("finding", "findings"),
        "claims_page": "claims-findings.html",
    }


def model_b(B):
    labels = {n["id"]: n["label"] for n in B["nodes"]}
    nodes = []
    for n in B["nodes"]:
        k = n["kind"]
        nodes.append({"id": n["id"], "label": n["label"], "lane": KIND_LANE[k],
                      "group": k if KIND_LANE[k] == 0 else None, "shape": "combo" if k == "combination" else k,
                      "kind": k, "members": n.get("members"),
                      "member_labels": [labels[m] for m in n.get("members") or []]})
    edge_label = {}
    for e in B["edges"]:
        if e["kind"] == "effect":
            edge_label[e["id"]] = "%s %s %s" % (labels[e["source"]], ARROW_TXT, labels[e["target"]])
    items = []
    for e in B["edges"]:
        mod = e["kind"] == "moderation"
        items.append({
            "ref": "edge:" + e["id"], "ty": "edge", "id": e["id"], "kind": e["kind"],
            "src": e["source"], "tgt": e["target"], "te": e.get("target_edge"),
            "sl": labels[e["source"]],
            "tl": edge_label[e["target_edge"]] if mod else labels[e["target"]],
            "dir": e["direction"], "cert": e["certainty"], "rat": e["certainty_rationale"],
            "studies": e["studies"], "claims": e["claims"], "sd": e["study_directions"],
            "cd": e["claim_directions"], "ids": e["edge_ids"], "docs": e["document_ids"],
            "dm": e.get("direction_meaning"),
        })
    gaps = []
    for g in B["gaps"]:
        gaps.append({"ref": "gap:" + g["id"], "ty": "gap", "id": g["id"], "src": g["source"],
                     "tgt": g["target"], "sl": labels[g["source"]], "tl": labels[g["target"]],
                     "sf": g["searched_for"], "status": g["status"]})
    return {
        "key": "network", "name": "Network", "file": "q1_tree_planting_graph.json", "src": B,
        "nodes": nodes, "items": items, "gaps": gaps, "evidence": B["evidence"],
        "papers": papers_of(B["evidence"]), "item_word": ("edge", "edges"),
        "claims_page": "claims-network.html", "labels": labels,
    }


def item_label(it):
    if it.get("kind") == "moderation":
        return "%s %s effect of %s" % (it["sl"], ARROW_TXT, it["tl"])
    return "%s %s %s" % (it["sl"], ARROW_TXT, it["tl"])


def item_aria(it):
    head = ("%s changes the effect of %s" % (it["sl"], it["tl"])) if it.get("kind") == "moderation" \
        else "%s to %s" % (it["sl"], it["tl"])
    return "%s: %s, certainty %s, %s, %s" % (
        head, DIR[it["dir"]][1], CERT[it["cert"]][1],
        plural(it["studies"], "study", "studies"), plural(it["claims"], "claim", "claims"))


def gap_aria(g):
    return "%s to %s: no evidence. %s" % (g["sl"], g["tl"], GAP_NOTE)


# ---------------------------------------------------------------------------
# Small HTML pieces
# ---------------------------------------------------------------------------

def glyph(d):
    return '<span class="gl d-%s" aria-hidden="true">%s</span>' % (d, DIR[d][0])


def dir_html(d):
    return '%s %s' % (glyph(d), esc(DIR[d][1]))


def dots_txt(c):
    n = CERT[c][0]
    return "●" * n + "○" * (4 - n)


def cert_html(c):
    return '<span class="dots" aria-hidden="true">%s</span> %s' % (dots_txt(c), CERT[c][1])


def sd_html(sd):
    vis = " ".join('<i class="d-%s">%s%d</i>' % (d, DIR[d][0], sd[d]) for d in DIR_ORDER if sd.get(d))
    words = ", ".join("%s %d" % (DIR[d][1], sd[d]) for d in DIR_ORDER if sd.get(d))
    return '<span class="sdx" aria-hidden="true">%s</span><span class="vh">%s</span>' % (vis, esc(words))


def doi_html(doc, doi):
    if doi:
        return '<a href="https://doi.org/%s">%s</a>' % (esc(doi), esc(doi))
    return '<span class="mono">%s</span>' % esc(doc)


def paper_line(title, year):
    return "%s%s" % (esc(title), (" (%s)" % year) if year is not None else "")


# ---------------------------------------------------------------------------
# SVG graph
# ---------------------------------------------------------------------------

def layout_spec(M):
    edges = []
    for it in M["items"]:
        edges.append({"ref": it["ref"], "kind": it["kind"], "source": it["src"], "target": it["tgt"],
                      "target_edge": ("edge:" + it["te"]) if it["te"] else None})
    for g in M["gaps"]:
        edges.append({"ref": g["ref"], "kind": "gap", "source": g["src"], "target": g["tgt"],
                      "target_edge": None})
    if M["key"] == "findings":
        return {"lanes": [{"title": "Factor", "subtitle": ""},
                          {"title": "Outcome", "subtitle": ""}],
                "nodes": M["nodes"], "edges": edges, "cg": 160,
                "chip_title": CHIP_TITLE, "legend": dict(legend_spec(M), title=LEGEND_TITLE)}
    kinds = M["src"]["node_kinds"]
    groups = [{"key": k, "title": KIND_TITLE[k], "subtitle": kinds[k]} for k in LANE0_GROUPS
              if any(n["kind"] == k for n in M["nodes"])]
    return {"lanes": [None,
                      {"title": KIND_TITLE["condition"], "subtitle": kinds["condition"]},
                      {"title": KIND_TITLE["outcome"], "subtitle": kinds["outcome"]}],
            "groups": groups, "nodes": M["nodes"], "edges": edges, "cg": 94,
            "chip_title": CHIP_TITLE, "legend": dict(legend_spec(M), title=LEGEND_TITLE)}


# Title above each chip column (the pill on each edge). Fixed UI copy.
CHIP_TITLE = {"title": "Effect · certainty", "parts": ["arrow: direction", "dots: certainty"]}
# Heading of the legend band at the top of each graph. Fixed UI copy.
LEGEND_TITLE = "How to read this graph"
SHAPE_KEY = [("planting_stock", "Planting stock:", "round"),
             ("site_treatment", "Site treatment:", "square"),
             ("condition", "Condition:", "side bar"),
             ("outcome", "Outcome:", "double line"),
             ("combination", "Combination:", "dashed")]


def legend_spec(M):
    """Content of the legend inside the graph. layout.legend_place() places it and
    svg_legend() draws it. The path note is the pack's own text (limitations[0])."""
    cols = [
        {"head": "Direction", "tw": 175, "rows": [
            {"sw": "dir", "dir": d, "lead": DIR[d][0], "bold": False, "text": DIR[d][1]} for d in DIR_ORDER]},
        {"head": "Certainty", "tw": 80, "rows": [
            {"sw": "cert", "n": CERT[c][0], "text": CERT[c][1]} for c in CERT_ORDER]},
    ]
    gap = {"sw": "gap", "lead": "No evidence:", "text": GAP_NOTE}
    fade = {"sw": "fade", "lead": "Faded line:", "js": True,
            "text": "not selected. Click a node or an edge to show it at full strength."}
    # Variant B: with JS the edges are hidden until a selection (style.css "variant B"),
    # unless "Show all edges" is on. EDGES_ALL sets its start state for each panel.
    hid = {"sw": None, "lead": "Edges:", "js": True,
           "text": "all show at the start. Turn off “Show all edges” to see only the edges of the node or edge you select."
           if EDGES_ALL[M["key"]] else
           "hidden until you select a node or an edge, or use “Show all edges”."}
    if M["key"] == "findings":
        cols.append({"head": "Other marks", "fill": True, "min": 200, "rows": [gap, fade, hid]})
        return {"cols": cols}
    cols.append({"head": "Other lines", "tw": 190, "rows": [
        {"sw": "mod", "lead": "Moderation:", "text": "changes the effect of the edge at the ◆"},
        {"sw": "mem", "text": MEMBER_NOTE[0].upper() + MEMBER_NOTE[1:]},
        dict(fade, text="not selected")]})
    cols.append({"head": "Node kinds", "tw": 170, "rows": [
        {"sw": "shape", "shape": k, "lead": lead, "text": text} for k, lead, text in SHAPE_KEY]})
    # Notes: always a full-width row under the columns.
    cols.append({"head": "", "fill": True, "min": 600, "rows": [
        gap, hid,
        {"sw": "chip", "lead": "Chips in the right column:",
         "text": "some are for edges from a stock or treatment straight to an outcome. "
                 "These lines go between the conditions."},
        {"sw": None, "lead": "Paths through a condition:", "text": M["src"]["limitations"][0]},
    ]})
    return {"cols": cols}


def svg_defs(key):
    """Chip outline and the four certainty dot rows, referenced with <use> to keep the page small."""
    out = ['<defs><rect id="%s-cr" x="%d" y="%d" width="%d" height="%d" rx="%d"/>' % (
        key[0], -CHIP_W // 2, -CHIP_H // 2, CHIP_W, CHIP_H, CHIP_H // 2)]
    for n in range(1, 5):
        out.append('<g id="%s-c%d">%s</g>' % (key[0], n, "".join(
            '<circle cx="%s" r="3.1" %s/>' % (fmt(-1 + 7.6 * i), 'fill="currentColor"' if i < n else
                                              'fill="none" stroke="currentColor" stroke-width="1.2"')
            for i in range(4))))
    out.append("</defs>")
    return "".join(out)


def svg_chip(key, it, x, y, attrs):
    cls = "chip d-%s%s" % (it["dir"], " mod" if it["kind"] == "moderation" else "")
    return ('<g class="%s" %s transform="translate(%s %s)"><use class="r" href="#%s-cr"/>'
            '<text x="-15" y="5.5">%s</text><use href="#%s-c%d"/></g>') % (
        cls, attrs, fmt(x), fmt(y), key[0], DIR[it["dir"]][0], key[0], CERT[it["cert"]][0])


def svg_graph(M, geo):
    key = M["key"]
    W, H = geo["width"], geo["height"]
    # The legend sits above the graph at negative y, so the viewBox starts at geo["top"] (<= 0).
    out = ['<svg class="graph" id="svg-%s" viewBox="0 %s %d %d" width="%d" height="%d" role="group" '
           'aria-labelledby="gh-%s" style="max-width:%dpx">' % (key, fmt(geo["top"]), W, H, W, H, key, round(W * 1.2)), svg_defs(key)]
    # The legend comes first in the DOM, so a screen reader meets it before the graph.
    if geo.get("legend"):
        out.append(svg_legend(key, geo["legend"]))
    # lane titles, and the title above each chip column (centred on the column)
    out.append('<g class="lt">')
    for t in geo["titles"]:
        anc = ' text-anchor="middle"' if t.get("anchor") == "middle" else ""
        out.append('<text class="lt1" x="%s" y="%s"%s>%s</text>' % (fmt(t["x"]), fmt(t["y"] + 13), anc, esc(t["title"])))
        for i, line in enumerate(t["sub"]):
            out.append('<text class="lt2" x="%s" y="%s"%s>%s</text>' % (fmt(t["x"]), fmt(t["y"] + 31 + 15 * i), anc, esc(line)))
    out.append("</g>")
    # membership connectors
    if geo["members"]:
        out.append('<g class="mems" aria-hidden="true">')
        for m in geo["members"]:
            out.append('<path class="mem" data-m="%s" data-c="%s" d="%s"/>' % (esc(m["member"]), esc(m["combo"]), m["d"]))
        out.append("</g>")
    # lines
    out.append('<g class="lines">')
    for it in M["items"]:
        g = geo["edges"][it["ref"]]
        cls = "ln d-%s%s" % (it["dir"], " mod" if it["kind"] == "moderation" else "")
        extra = ' data-te="%s"' % esc("edge:" + it["te"]) if it["te"] else ""
        tgt = it["tgt"] or ""
        out.append('<g class="%s" data-ref="%s" data-s="%s" data-t="%s"%s>' % (cls, esc(it["ref"]), esc(it["src"]), esc(tgt), extra))
        # One line width for every edge (style.css). Width does not encode the number of studies.
        out.append('<path class="hit" d="%s"/><path class="p" d="%s"/>' % (g["d"], g["d"]))
        if g["arrow"]:
            out.append('<path class="ah" d="%s"/>' % g["arrow"])
        out.append("</g>")
    for gp in M["gaps"]:
        g = geo["edges"][gp["ref"]]
        out.append('<g class="ln gap" data-ref="%s" data-s="%s" data-t="%s"><path class="hit" d="%s"/><path class="p" d="%s"/></g>' % (
            esc(gp["ref"]), esc(gp["src"]), esc(gp["tgt"]), g["d"], g["d"]))
    out.append("</g>")
    # nodes
    out.append('<g class="nodes">')
    ins, outs = Counter(), Counter()
    for it in M["items"]:
        outs[it["src"]] += 1
        if it["tgt"]:
            ins[it["tgt"]] += 1
    for n in M["nodes"]:
        g = geo["nodes"][n["id"]]
        shape = n["shape"]
        kind_txt = KIND_TITLE.get(n.get("kind"), "Factor" if shape == "factor" else "Outcome")
        aria = "%s (%s): %s, %s" % (n["label"], kind_txt, plural(ins[n["id"]], "edge in", "edges in"),
                                   plural(outs[n["id"]], "edge out", "edges out"))
        if key == "network":
            attrs = 'data-node-id="%s" data-kind="%s"' % (esc(n["id"]), esc(n["kind"]))
        else:
            attrs = 'data-ref="node:%s"' % esc(n["id"])
        attrs += ' data-label="%s" tabindex="0" role="button" aria-label="%s"' % (esc(n["label"]), esc(aria))
        w, h = g["w"], g["h"]
        rx = {"site_treatment": 3}.get(shape, 12)
        out.append('<g class="nd k-%s" %s transform="translate(%s %s)">' % (shape, attrs, fmt(g["x"]), fmt(g["y"])))
        out.append('<rect class="bx" width="%d" height="%s" rx="%d"/>' % (w, fmt(h), rx))
        tx = 16
        if shape == "condition":
            out.append('<rect class="bar" x="7" y="9" width="4" height="%s" rx="2"/>' % fmt(h - 18))
            tx = 20
        if shape == "outcome":
            out.append('<rect class="in" x="4" y="4" width="%d" height="%s" rx="5"/>' % (w - 8, fmt(h - 8)))
        if shape == "combo":
            y0 = h / 2 - (2 * 22 + 6) / 2
            for j, lab in enumerate(n["member_labels"]):
                yy = y0 + j * 28
                out.append('<rect class="mc" x="12" y="%s" width="%d" height="22" rx="5"/>' % (fmt(yy), w - 24))
                out.append('<text class="mct" x="21" y="%s">%s%s</text>' % (fmt(yy + 15.5), "+ " if j else "", esc(lab)))
        else:
            lines = g["lines"]
            y0 = h / 2 - 18 * len(lines) / 2 + 13
            out.append('<text class="nl" x="%d" y="%s">' % (tx, fmt(y0)))
            for i, line in enumerate(lines):
                out.append('<tspan x="%d"%s>%s</tspan>' % (tx, ' dy="18"' if i else "", esc(line)))
            out.append("</text>")
        out.append("</g>")
    out.append("</g>")
    # chips on top of everything
    out.append('<g class="chips">')
    for it in M["items"]:
        x, y = geo["edges"][it["ref"]]["chip"]
        attrs = 'data-%s-id="%s" data-direction="%s" data-certainty="%s" data-studies="%d" data-claims="%d" tabindex="0" role="button" aria-label="%s"' % (
            "finding" if key == "findings" else "edge", esc(it["id"]), esc(it["dir"]),
            esc(it["cert"]), it["studies"], it["claims"], esc(item_aria(it)))
        out.append(svg_chip(key, it, x, y, attrs))
    for gp in M["gaps"]:
        x, y = geo["edges"][gp["ref"]]["chip"]
        out.append('<g class="gapl" data-gap-id="%s" tabindex="0" role="button" aria-label="%s" transform="translate(%s %s)">'
                   '<rect x="%d" y="%d" width="%d" height="%d" rx="%d"/><text y="4.5">No evidence</text></g>' % (
                       esc(gp["id"]), esc(gap_aria(gp)), fmt(x), fmt(y),
                       -GAP_W // 2, -GAP_H // 2, GAP_W, GAP_H, GAP_H // 2))
    out.append("</g>")
    # moderation diamonds sit on top of the target chip
    for it in M["items"]:
        g = geo["edges"][it["ref"]]
        if g["diamond"]:
            out.append('<path class="dia d-%s" data-ref="%s" d="%s"/>' % (it["dir"], esc(it["ref"]), g["diamond"]))
    out.append("</svg>")
    return "".join(out)


def legend_swatch(key, r, y):
    """One legend swatch, LG_SW wide, centred on the line y. Classes are legend-only
    (see graph.css), so the selection fade in app.js and style.css never reaches them."""
    sw, Y = r.get("sw"), fmt(y)
    if sw == "dir":
        return ('<path class="ls d-%s" d="M0 %sH21"/><path class="la d-%s" d="M30 %sL21 %sV%sZ"/>' % (
            r["dir"], Y, r["dir"], Y, fmt(y - 4.5), fmt(y + 4.5)))
    if sw == "cert":
        return '<use class="ldt" href="#%s-c%d" x="4" y="%s"/>' % (key[0], r["n"], Y)
    if sw in ("gap", "mem", "fade"):
        return '<path class="%s" d="M0 %sH30"/>' % ({"gap": "lg", "mem": "lmem", "fade": "lfnt"}[sw], Y)
    if sw == "mod":
        return '<path class="lm" d="M1 %sH19"/><path class="ld" d="M24.5 %sL30 %sL24.5 %sL19 %sZ"/>' % (
            Y, fmt(y - 5.5), Y, fmt(y + 5.5), Y)
    if sw == "chip":
        return '<rect class="lsh" x="1" y="%s" width="28" height="14" rx="7"/>' % fmt(y - 7)
    if sw == "shape":
        k = r["shape"]
        out = '<rect class="lsh%s" x="1" y="%s" width="28" height="16" rx="%s"/>' % (
            " lcb" if k == "combination" else "", fmt(y - 8), "1.5" if k == "site_treatment" else "5")
        if k == "condition":
            out += '<rect class="lsb" x="4.5" y="%s" width="2.5" height="10" rx="1"/>' % fmt(y - 5)
        if k == "outcome":
            out += '<rect class="lsi" x="3.5" y="%s" width="23" height="11" rx="3"/>' % fmt(y - 5.5)
        return out
    return ""


def svg_legend(key, L):
    """The legend band above the graph, drawn in the SVG: labels are SVG <text>, so they
    are DOM text and a copied image of the graph carries them. Not focusable, no hooks.
    Heading, columns, then the rule that separates the legend from the graph."""
    tx = LG_SW + LG_SG
    # font-size as an attribute too: a clone of the SVG without the style sheet keeps the size the layout assumed.
    out = ['<g class="glg" role="group" aria-label="Legend" font-size="12">']
    if L["title"]:
        out.append('<text class="lhd" x="%s" y="%s" font-size="%d">%s</text>' % (
            fmt(L["x"]), fmt(L["y"] + 15), LG_TITLE_PX, esc(L["title"])))
    for c in L["cols"]:
        out.append('<g transform="translate(%s %s)">' % (fmt(L["x"] + c["x"]), fmt(L["y"] + c["y"])))
        if c["head"]:
            out.append('<text class="lh" y="12">%s</text>' % esc(c["head"]))
        for r in c["rows"]:
            y = r["y"]
            row = [legend_swatch(key, r, y + 9), '<text x="%d" y="%s">' % (tx, fmt(y + 13))]
            for i, line in enumerate(r["lines"]):
                lead = r.get("lead")
                if i == 0 and lead and line.startswith(lead):
                    # A direction glyph is coloured and hidden from screen readers (the word follows it).
                    at = ('class="g d-%s" aria-hidden="true"' % r["dir"]) if r.get("sw") == "dir" else 'class="lb"'
                    row.append('<tspan %s>%s</tspan>%s' % (at, esc(lead), esc(line[len(lead):])))
                elif i == 0:
                    row.append(esc(line))
                else:
                    row.append('<tspan x="%d" dy="%d">%s</tspan>' % (tx, LG_LINE, esc(line)))
            row.append("</text>")
            out.append(('<g class="js-only">%s</g>' if r.get("js") else "%s") % "".join(row))
        out.append("</g>")
    out.append('<path class="lgr" d="M%s %sH%s"/>' % (fmt(L["rule"][0]), fmt(L["rule"][1]), fmt(L["rule"][2])))
    out.append("</g>")
    return "".join(out)


# ---------------------------------------------------------------------------
# Panel sections
# ---------------------------------------------------------------------------

def glance(M):
    key = M["key"]
    items = M["items"]
    dc = Counter(it["dir"] for it in items)
    cc = Counter(it["cert"] for it in items)
    word = M["item_word"][1]
    d_pills = "".join('<li>%s <b>%d</b></li>' % (dir_html(d), dc[d]) for d in DIR_ORDER if dc[d])
    c_pills = "".join('<li>%s <b>%d</b></li>' % (cert_html(c), cc[c]) for c in CERT_ORDER if cc[c])
    src = M["src"]
    extra = ""
    if key == "findings":
        extra = '<div><dt>Interactions</dt><dd><ul><li>%s, listed, not pooled</li></ul></dd></div>' % plural(len(src["interactions"]), "claim", "claims")
    else:
        extra = '<div><dt>Set aside</dt><dd><ul><li>%s</li></ul></dd></div>' % plural(len(src["set_aside"]), "claim", "claims")
    kinds = ""
    if key == "network":
        kinds = "<h4>Node kinds</h4><dl class=\"kinds\">%s</dl><h4>Edge kinds</h4><dl class=\"kinds\">%s</dl>" % (
            "".join("<div><dt>%s</dt><dd>%s</dd></div>" % (esc(k), esc(v)) for k, v in src["node_kinds"].items()),
            "".join("<div><dt>%s</dt><dd>%s</dd></div>" % (esc(k), esc(v)) for k, v in src["edge_kinds"].items()))
    return (
        '<div class="glance"><h3 id="ag-%s">At a glance</h3><dl class="stats">'
        '<div><dt>%s by direction</dt><dd><ul>%s</ul></dd></div>'
        '<div><dt>%s by certainty</dt><dd><ul>%s</ul></dd></div>'
        '<div><dt>Gaps</dt><dd><ul><li>%s <span class="muted">(no study tested the pairing)</span></li></ul></dd></div>%s</dl>'
        '<details class="built" id="built-%s"><summary>How this was built</summary><p>%s</p>'
        '<p>Certainty rule: <code>%s</code>. Source file: <code>answers/%s</code>.</p>%s</details></div>'
    ) % (key, word.capitalize(), d_pills, word.capitalize(), c_pills, len(M["gaps"]), extra,
         key, esc(src["how_built"]), esc(src["rule"]), esc(M["file"]), kinds)


def toolbar(M):
    key = M["key"]
    items = M["items"]
    dc = Counter(it["dir"] for it in items)
    lens = ""
    if key == "network":
        lens = ('<div class="seg lens" role="group" aria-label="Lens">'
                '<button type="button" data-lens="all" aria-pressed="true">All</button>'
                '<button type="button" data-lens="direct" aria-pressed="false">Direct</button>'
                '<button type="button" data-lens="via" aria-pressed="false">Via conditions</button>'
                '<button type="button" data-lens="inter" aria-pressed="false">Interactions</button></div>')
    chips = "".join('<button type="button" class="fchip" data-dir="%s" aria-pressed="true">%s %s <span class="n">%d</span></button>' % (
        d, glyph(d), esc(DIR[d][1]), dc[d]) for d in DIR_ORDER)
    # The labels "Search" and "Certainty" are for screen readers only: the placeholder and the
    # option text already say what the control does. "/" focuses the search (aria-keyshortcuts).
    certs = "".join('<option value="%d">%s certainty%s</option>' % (CERT[c][0], CERT[c][1], "" if c == "high" else " or higher")
                    for c in reversed(CERT_ORDER[:-1]))
    return (
        '<div class="toolbar js-only">'
        '<div class="srch"><label class="vh" for="q-%s">Search</label><input type="search" id="q-%s" placeholder="Search labels, quotes, papers" autocomplete="off" aria-keyshortcuts="/">'
        '<div class="sres" id="sr-%s" hidden></div></div>'
        '%s'
        '<div class="filters" role="group" aria-label="Filters">%s'
        '<label class="sel"><span class="vh">Certainty</span><select data-min><option value="0">Any certainty</option>%s</select></label>'
        # The count sits in the filter group, so it shares a row with the last filters.
        '<label class="cb"><input type="checkbox" data-gaps checked> Show gaps</label>'
        '<p class="count" aria-live="polite"></p></div></div>'
    ) % (key, key, key, lens, chips, certs)


def legend(M):
    key = M["key"]
    rows = []
    sw = ''.join(
        '<li><svg width="34" height="14" aria-hidden="true"><path class="ls d-%s" d="M2 7H24"/><path class="la d-%s" d="M32 7L23 2.5V11.5Z"/></svg>%s</li>' % (d, d, dir_html(d))
        for d in DIR_ORDER)
    rows.append('<div><h4>Direction <span class="muted">(arrowhead at the target)</span></h4><ul>%s</ul></div>' % sw)
    rows.append('<div><h4>Certainty</h4><ul>%s</ul></div>' % "".join("<li>%s</li>" % cert_html(c) for c in CERT_ORDER))
    other = ['<li><svg width="34" height="14" aria-hidden="true"><path class="lg" d="M2 7H32"/></svg><span><b>No evidence</b>: %s</span></li>' % esc(GAP_NOTE)]
    if key == "network":
        other.append('<li><svg width="34" height="14" aria-hidden="true"><path class="lm" d="M2 7H24"/><path class="ld" d="M29 2.5L33.5 7L29 11.5L24.5 7Z"/></svg>'
                     'Dotted line ending in ◆ on a chip: changes the effect of that edge (moderation)</li>')
        other.append('<li><svg width="34" height="14" aria-hidden="true"><path class="lmem" d="M2 7H32"/></svg>Thin dotted line, no arrow: %s</li>' % esc(MEMBER_NOTE))
        other.append('<li class="shapes"><span class="sh">Planting stock: round corners</span> <span class="sh s-st">Site treatment: square corners</span> '
                     '<span class="sh s-co">Condition: side bar</span> <span class="sh s-ou">Outcome: double border</span> '
                     '<span class="sh s-cb">Combination: dashed, shows members</span></li>')
    else:
        other.append('<li class="shapes"><span class="sh">Factor</span> <span class="sh s-ou">Outcome: double border</span></li>')
    other.append('<li class="js-only"><svg width="34" height="14" aria-hidden="true"><path class="lfnt" d="M2 7H32"/></svg>'
                 'Faded line: an edge that is not selected. Select a node or an edge to show it at full strength.</li>')
    other.append('<li class="js-only"><svg width="34" height="14" aria-hidden="true"><path class="lfar" d="M2 7H32"/></svg>'
                 'After a click on a node: full lines are one step from it, lighter lines are further steps. '
                 'A path is not one tested effect.</li>')
    rows.append('<div class="wide"><h4>Other marks</h4><ul>%s</ul></div>' % "".join(other))
    return '<div class="legend" aria-label="Legend" role="group">%s</div>' % "".join(rows)


def sort_th(label, k, num=False):
    return '<th scope="col"%s><button type="button" data-k="%d">%s</button></th>' % (' class="num"' if num else "", k, label)


def items_table(M):
    key = M["key"]
    page = M["claims_page"]
    word = M["item_word"]
    attr = "finding" if key == "findings" else "edge"
    head = "".join([sort_th("From", 0), sort_th("To", 1), sort_th("Direction", 2), sort_th("Certainty", 3),
                    sort_th("Studies", 4, True), sort_th("Claims", 5, True), '<th scope="col">Study directions</th>'])
    # Mobile card labels for this table come from CSS (.ti), not per-cell attributes.
    out = ['<table class="tbl sortable ti" id="tbl-%s"><caption>%s: one row per pooled %s. Select a row to read its claims.</caption>'
           '<thead><tr>%s</tr></thead><tbody>' % (key, word[1].capitalize(), word[0], head)]
    for it in M["items"]:
        tl = it["tl"]
        if it["kind"] == "moderation":
            tl = "Effect of " + it["tl"]
        out.append(
            '<tr data-%s-id="%s" data-direction="%s" data-certainty="%s" data-studies="%d" data-claims="%d">'
            '<th scope="row"><a href="%s#%s">%s</a>%s</th>'
            '<td>%s</td><td data-v="%d">%s</td>'
            '<td data-v="%d">%s<span class="rat">%s</span></td>'
            '<td class="num">%d</td><td class="num">%d</td>'
            '<td>%s</td></tr>' % (
                attr, esc(it["id"]), esc(it["dir"]), esc(it["cert"]), it["studies"], it["claims"],
                page, slug("f-" + it["id"]), esc(it["sl"]),
                ' <span class="tag">moderation</span>' if it["kind"] == "moderation" else "",
                esc(tl), DIR_ORDER.index(it["dir"]), dir_html(it["dir"]),
                CERT[it["cert"]][0], cert_html(it["cert"]), esc(it["rat"]),
                it["studies"], it["claims"], sd_html(it["sd"])))
    out.append("</tbody></table>")
    return "".join(out)


def gaps_table(M):
    page = M["claims_page"]
    out = ['<p class="note">%s</p><table class="tbl" id="tbl-gaps-%s"><caption>Gaps: pairings that were looked for and not found</caption>'
           '<thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Status</th><th scope="col">Searched for</th></tr></thead><tbody>' % (esc(GAP_NOTE), M["key"])]
    for g in M["gaps"]:
        out.append('<tr data-gap-id="%s"><th scope="row" data-label="From"><a href="%s#%s">%s</a></th>'
                   '<td data-label="To">%s</td><td data-label="Status">No evidence <span class="mono">(%s)</span></td><td data-label="Searched for">%s</td></tr>' % (
                       esc(g["id"]), page, slug("g-" + g["id"]), esc(g["sl"]),
                       esc(g["tl"]), esc(g["status"]), esc(g["sf"])))
    out.append("</tbody></table>")
    return "".join(out)


def spo_html(ev):
    neg = " (negated)" if ev["negated"] else ""
    return '%s <span class="pr">%s %s%s %s</span> %s' % (esc(ev["subject"]), ARROW_TXT, esc(ev["predicate"]), neg, ARROW_TXT, esc(ev["object"]))


def interactions_a(M):
    A = M["src"]
    ev = M["evidence"]
    out = ['<p class="note">Each row is one claim, not a pooled finding. The direction is the claim\'s own.</p>'
           '<table class="tbl" id="tbl-inter-findings"><caption>Interactions: claims on combined treatments or on one factor changing another</caption>'
           '<thead><tr><th scope="col">Claim</th><th scope="col">Direction</th><th scope="col">Quote</th><th scope="col">Paper</th></tr></thead><tbody>']
    for i in A["interactions"]:
        e = ev[i["edge_id"]]
        out.append('<tr data-interaction-id="%s" data-direction="%s"><th scope="row" data-label="Claim">'
                   '<a href="%s#%s">%s</a> <span class="mono small">%s</span></th>'
                   '<td data-label="Direction">%s</td><td data-label="Quote"><blockquote>%s</blockquote></td>'
                   '<td data-label="Paper">%s<br>%s</td></tr>' % (
                       esc(i["edge_id"]), esc(i["direction"]), M["claims_page"],
                       slug("c-" + i["edge_id"].split("_")[-1]), spo_html(e), esc(i["edge_id"]),
                       dir_html(i["direction"]), esc(e["quote"]), paper_line(e["title"], e["year"]),
                       doi_html(e["document_id"], e["doi"])))
    out.append("</tbody></table>")
    return "".join(out)


def interactions_b(M):
    B = M["src"]
    page = M["claims_page"]
    labels = M["labels"]
    out = []
    combos = [n for n in M["nodes"] if n.get("members")]
    out.append('<table class="tbl" id="tbl-combo"><caption>Combination nodes: treatments applied together</caption>'
               '<thead><tr><th scope="col">Combination</th><th scope="col">Members</th><th scope="col">Its edges</th></tr></thead><tbody>')
    for n in combos:
        mem = ", ".join('<a href="#panel-network" data-ref="node:%s">%s</a>' % (esc(m), esc(labels[m])) for m in n["members"])
        eds = "; ".join('<a href="%s#%s" data-ref="%s">%s</a> (%s, %s)' % (
            page, slug("f-" + it["id"]), esc(it["ref"]), esc(item_label(it)), esc(DIR[it["dir"]][1]), esc(CERT[it["cert"]][1]))
            for it in M["items"] if it["src"] == n["id"])
        out.append('<tr><th scope="row" data-label="Combination"><a href="#panel-network" data-ref="node:%s">%s</a></th><td data-label="Members">%s</td><td data-label="Its edges">%s</td></tr>' % (
            esc(n["id"]), esc(n["label"]), mem, eds))
    out.append("</tbody></table>")
    out.append('<table class="tbl" id="tbl-mod"><caption>Moderation edges: a factor that changes the effect of another edge</caption>'
               '<thead><tr><th scope="col">Source</th><th scope="col">Changes the effect of</th><th scope="col">Direction</th>'
               '<th scope="col">Certainty</th><th scope="col">Meaning of direction</th></tr></thead><tbody>')
    for it in M["items"]:
        if it["kind"] != "moderation":
            continue
        out.append('<tr><th scope="row" data-label="Source"><a href="%s#%s" data-ref="%s">%s</a></th>'
                   '<td data-label="Changes the effect of"><a href="%s#%s" data-ref="edge:%s">%s</a></td>'
                   '<td data-label="Direction">%s</td><td data-label="Certainty">%s<span class="rat">%s</span></td><td data-label="Meaning of direction">%s</td></tr>' % (
                       page, slug("f-" + it["id"]), esc(it["ref"]), esc(it["sl"]), page, slug("f-" + it["te"]), esc(it["te"]),
                       esc(it["tl"]), dir_html(it["dir"]), cert_html(it["cert"]), esc(it["rat"]), esc(it["dm"])))
    out.append("</tbody></table>")
    out.append('<table class="tbl" id="tbl-aside"><caption>Set aside: claims left out of every edge</caption>'
               '<thead><tr><th scope="col">Claim id</th><th scope="col">Why</th></tr></thead><tbody>')
    for s in B["set_aside"]:
        out.append('<tr><th scope="row" data-label="Claim id" class="mono">%s</th><td data-label="Why">%s <span class="muted">(this claim is not in this file\'s evidence, so no quote is shown)</span></td></tr>' % (
            esc(s["edge_id"]), esc(s["why"])))
    out.append("</tbody></table>")
    return "".join(out)


def papers_table(M):
    page = M["claims_page"]
    # The rows are built in the browser from data/<panel>.json when the section opens.
    # Without JS, the claims page has the same list with "cited by" links.
    return ('<p>Every paper with its claims and the %s that cite it: <a href="%s#papers">Papers on the claims page</a>.</p>'
            '<div class="pp-host js-only"></div>' % (M["item_word"][1], page)), len(M["papers"])


def limits_html(M):
    """Limitations under the graph: every string of this panel's own file, word for word (v7).
    HTML, not SVG, so it shows without JS and in both Graph and Matrix views."""
    return ('<div class="limh"><h4>Limitations</h4>'
            '<p class="lsrc">From the pack\'s answer file <code>%s</code> (field <code>limitations</code>).</p></div>'
            '<ul class="liml">%s</ul>') % (esc(M["file"]), "".join("<li>%s</li>" % esc(l) for l in M["src"]["limitations"]))


def panel_html(M, geo):
    key = M["key"]
    src = M["src"]
    word = M["item_word"]
    page = M["claims_page"]
    # Everything after the graph is switched off (v5): legend and tables. (v7: the limitations are
    # back, inside the graph card: limits_html().) To restore the rest,
    # uncomment these lines, the matching lines of the format string and its keys below, the
    # "tables" code in app.js and the "tables" rules in style.css.
    # ptable, n_docs = papers_table(M)
    # inter = interactions_a(M) if key == "findings" else interactions_b(M)
    # inter_title = ("Interactions (%d)" % len(src["interactions"])) if key == "findings" else \
    #     "Interactions &amp; set aside (%d combination, %d moderation, %d set aside)" % (
    #         sum(1 for n in M["nodes"] if n.get("members")), sum(1 for i in M["items"] if i["kind"] == "moderation"), len(src["set_aside"]))
    return (
        '<section class="panel%(ea)s" id="panel-%(k)s" data-panel="%(k)s" aria-labelledby="h-%(k)s">'
        # With JS the heading row is for screen readers only (the tab names the panel).
        # Without JS the drawer is not there, so the row links to the claims page (every quote).
        '<div class="phead"><h2 id="h-%(k)s">%(name)s</h2><p class="nojs"><a href="%(page)s">All claims and quotes</a></p></div>'
        # '<div class="phead"><h2 id="h-%(k)s">%(name)s</h2><p class="muted">From <code>answers/%(file)s</code></p></div>'
        # '%(glance)s'
        '%(toolbar)s'
        '<div class="stage"><div class="viz"><h3 id="gh-%(k)s" class="vh-h">Graph of the %(name_l)s</h3>'
        # The view bar is one row: Graph | Matrix, Expand and the status line. It sticks under the toolbar.
        '<div class="vbar"><div class="vtools"><div class="seg vt js-only" role="group" aria-label="View"><button type="button" data-view="graph" aria-pressed="true">Graph</button>'
        '<button type="button" data-view="matrix" aria-pressed="false">Matrix</button></div>'
        '<button type="button" class="xbtn js-only" aria-haspopup="dialog">%(xicon)sExpand</button>'
        # Variant B: when this toggle is off, the graph shows nodes only until a selection (app.js).
        # Its start state comes from EDGES_ALL, together with the panel's "ea" class.
        '<button type="button" class="tbtn eab js-only" aria-pressed="%(eap)s">Show all edges</button></div>'
        # Status line: the buttons float at the right; only the text after them is the live region.
        '<div class="selbar js-only" id="st-%(k)s"><div class="acts" hidden><button type="button" class="tod">Details below</button>'
        '<button type="button" class="clr">Clear</button></div><div class="sd" role="status" aria-live="polite"></div></div></div>'
        # '<a class="vat" href="#tbl-%(k)s">View as table</a></div>'
        # The graph card holds the graph, the matrix and, under them, the footer: the actions row
        # at the right and the limitations of this panel's file.
        '<div class="gcard"><div class="gbox">%(svg)s</div><div class="mbox js-only"></div><div class="gfoot">'
        # Copy image (snap.js) and export of the highlighted data (export.js). app.js loads each module on first use.
        '<div class="gact js-only"><button type="button" class="tbtn" data-act="copy">Copy image</button>'
        '<div class="seg xp" role="group" aria-label="Download the highlighted data">'
        '<button type="button" class="tbtn" data-act="csv">Export CSV</button>'
        '<button type="button" class="tbtn" data-act="xlsx">Export XLSX</button></div></div>%(lims)s</div></div></div>'
        '<div class="dcol js-only"><section class="drawer" id="dr-%(k)s" aria-labelledby="drh-%(k)s"><div class="dr-head"><h3 id="drh-%(k)s" tabindex="-1">Details</h3>'
        '<button type="button" class="x" aria-label="Close details">×</button></div>'
        '<div class="dr-body"><p class="muted">%(empty)s</p></div></section></div></div>'
        # '%(legend)s'
        # '<h3 class="th">Tables</h3>'
        # '<details class="tb" open><summary>%(Words)s (%(n)d)</summary>%(items)s<button type="button" class="more js-only" hidden></button></details>'
        # '<details class="tb"><summary>Gaps (%(ng)d)</summary>%(gaps)s</details>'
        # '<details class="tb"><summary>%(inter_title)s</summary>%(inter)s</details>'
        # '<details class="tb papers"><summary>Papers (%(nd)d)</summary>%(papers)s</details>'
        # '<details class="tb claims"><summary>Claims (%(nc)d)</summary><p>All claims with their quotes, grouped by %(w0)s and paper: '
        # '<a href="%(page)s">open the claims page</a>.</p><div class="cl-host js-only"></div></details>'
        # '<p class="muted">How this was built: see <a href="#built-%(k)s">the note at the top of this panel</a>.</p>'
        '</section>'
    ) % {
        "k": key, "name": M["name"], "name_l": M["name"].lower(), "page": page,
        # "file": M["file"], "glance": glance(M),
        "toolbar": toolbar(M), "svg": svg_graph(M, geo), "lims": limits_html(M),
        # "legend": legend(M), "Words": word[1].capitalize(), "n": len(M["items"]), "items": items_table(M),
        # "ng": len(M["gaps"]), "gaps": gaps_table(M), "inter_title": inter_title, "inter": inter,
        # "nd": n_docs, "papers": ptable, "nc": len(M["evidence"]), "w0": word[0],
        "empty": DRAWER_EMPTY, "xicon": XICON,
        "ea": " ea" if EDGES_ALL[key] else "", "eap": "true" if EDGES_ALL[key] else "false",
    }


def index_html(MA, MB, ga, gb):
    A, B = MA["src"], MB["src"]
    a_docs = len(MA["papers"])
    b_docs = len(MB["papers"])
    # Compact tabs: the name and one short counts line. The longer descriptions are switched off.
    cards = (
        '<a class="card" id="tab-findings" href="#panel-findings" data-tab="findings"><span class="cn">Findings</span>'
        # '<span class="cd">Each stock trait or site factor against survival and growth.</span>'
        '<span class="cc">%s · %s · %s</span></a>'
        '<a class="card" id="tab-network" href="#panel-network" data-tab="network"><span class="cn">Network</span>'
        # '<span class="cd">The same question as a graph, with the conditions in between.</span>'
        '<span class="cc">%s · %s · %s</span></a>'
    ) % (plural(len(MA["items"]), "finding", "findings"),
         plural(len(A["evidence"]), "claim", "claims"), plural(a_docs, "paper", "papers"),
         plural(len(MB["items"]), "edge", "edges"),
         plural(len(B["evidence"]), "claim", "claims"), plural(b_docs, "paper", "papers"))
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<title>Q1 · Tree planting evidence</title>'
        '<meta name="description" content="Evidence on how planting-stock traits and site treatments affect seedling survival and growth in Canadian forest restoration: findings, certainty, gaps and source quotes.">'
        '<script>document.documentElement.className="js"+(/^#network/.test(location.hash)?" nw":"");%s</script>'
        '<link rel="stylesheet" href="style.css">'
        '<script src="app.js" defer></script></head><body>'
        '<a class="skip" href="#main">Skip to content</a>'
        # '<header class="top"><div class="bar"><p class="eyebrow">Evidence Jam 2026 · Lane 3 · Question 1</p>%s</div>'
        # '<h1>Tree planting in Canadian forest restoration</h1><p class="q">%s</p>'
        '<header class="top"><div class="hrow"><h1>Tree planting in Canadian forest restoration</h1>%s</div><p class="q">%s</p>'
        '<nav aria-label="Panels"><div class="cards">%s</div></nav></header>'
        '<main id="main">%s%s</main>'
        # '<footer><p>Built from <code>answers/q1_tree_planting.json</code> and <code>answers/q1_tree_planting_graph.json</code>. '
        # 'Certainty rule <code>%s</code>. No text on this page is generated by a language model.</p></footer>'
        '</body></html>\n'
    ) % (THEME_JS, THEME_BTN, esc(A["question"]), cards, panel_html(MA, ga), panel_html(MB, gb))
    # ) % (THEME_JS, THEME_BTN, esc(A["question"]), cards, panel_html(MA, ga), panel_html(MB, gb), esc(A["rule"]))


# ---------------------------------------------------------------------------
# Static claims pages (no-JS road to every quote) and data JSON (for JS)
# ---------------------------------------------------------------------------

def claim_li(cid, ev):
    return ('<li id="%s"><p class="spo">%s</p><p class="cm">%s · grade %s · %s · comparator: %s · <code>%s</code></p>'
            '<blockquote>%s</blockquote></li>') % (
        slug("c-" + cid.split("_")[-1]), spo_html(ev), dir_html(ev["direction"]), esc(CERT[ev["certainty_grade"]][1]),
        esc(", ".join(t.replace("_", " ") for t in ev["evidence_types"])), esc(ev["comparator"].replace("_", " ")),
        esc(cid), esc(ev["quote"]))


def by_paper(ids, evidence):
    groups = defaultdict(list)
    order = []
    for cid in ids:
        d = evidence[cid]["document_id"]
        if d not in groups:
            order.append(d)
        groups[d].append(cid)
    first = {d: i for i, d in enumerate(order)}
    order.sort(key=lambda d: (-len(groups[d]), first[d]))
    return [(d, groups[d]) for d in order]


def claims_page(M):
    src = M["src"]
    ev = M["evidence"]
    key = M["key"]
    toc, body = [], []
    for it in M["items"]:
        sid = slug("f-" + it["id"])
        toc.append('<li><a href="#%s">%s</a></li>' % (sid, esc(item_label(it))))
        parts = ['<section class="cg" id="%s"><h2>%s</h2><p class="meta">%s · certainty %s · %s · %s</p><p class="rat">%s</p>' % (
            sid, esc(item_label(it)), dir_html(it["dir"]), cert_html(it["cert"]),
            plural(it["studies"], "study", "studies"), plural(it["claims"], "claim", "claims"), esc(it["rat"]))]
        if it.get("dm"):
            parts.append('<p class="rat">Direction means: %s</p>' % esc(it["dm"]))
        for d, cids in by_paper(it["ids"], ev):
            title, year, doi = M["papers"][d]
            parts.append('<section class="paper"><h3>%s</h3><p class="pm">%s · %s</p><ol class="claims">%s</ol></section>' % (
                paper_line(title, year), doi_html(d, doi), plural(len(cids), "claim", "claims"),
                "".join(claim_li(c, ev[c]) for c in cids)))
        parts.append("</section>")
        body.append("".join(parts))
    for g in M["gaps"]:
        body.append('<section class="cg gap" id="%s"><h2>%s %s %s: no evidence</h2><p>%s</p><p class="rat">Searched for: %s</p></section>' % (
            slug("g-" + g["id"]), esc(g["sl"]), ARROW_TXT, esc(g["tl"]), esc(GAP_NOTE), esc(g["sf"])))
    if key == "findings":
        lis = []
        for i in src["interactions"]:
            e = ev[i["edge_id"]]
            title, year, doi = M["papers"][e["document_id"]]
            # Machine-check attributes: the interactions table on index.html is switched off,
            # so this list carries data-interaction-id and data-direction (values from the JSON).
            li = claim_li(i["edge_id"], e).replace("<li ", '<li data-interaction-id="%s" data-direction="%s" ' % (
                esc(i["edge_id"]), esc(i["direction"])), 1)
            lis.append(li.replace("</blockquote></li>", "</blockquote><p class=\"pm\">Listed direction: %s · %s · %s</p></li>" % (
                dir_html(i["direction"]), paper_line(title, year), doi_html(e["document_id"], doi))))
        body.append('<section class="cg" id="interactions"><h2>Interactions</h2><p>Each is one claim, not a pooled finding.</p><ol class="claims">%s</ol></section>' % "".join(lis))
    else:
        body.append('<section class="cg" id="set-aside"><h2>Set aside</h2><ul>%s</ul></section>' % "".join(
            '<li><code>%s</code>: %s</li>' % (esc(s["edge_id"]), esc(s["why"])) for s in src["set_aside"]))
    # papers index: links to claim anchors, no repeated quotes
    where = {}
    for it in M["items"]:
        for c in it["ids"]:
            where[c] = it
    pl = []
    for d in sorted(M["papers"], key=lambda d: M["papers"][d][0].lower()):
        title, year, doi = M["papers"][d]
        cids = [c for c, e in ev.items() if e["document_id"] == d]
        cites = []
        for it in M["items"]:
            if d in it["docs"]:
                cites.append('<a href="#%s">%s</a>' % (slug("f-" + it["id"]), esc(item_label(it))))
        if any(c not in where for c in cids):
            cites.append('<a href="#%s">%s</a>' % ("interactions" if key == "findings" else "set-aside",
                                                   "Interactions" if key == "findings" else "Set aside"))
        links = ", ".join('<a href="#%s">%s</a>' % (slug("c-" + c.split("_")[-1]), esc(c)) for c in cids)
        pl.append('<li id="%s"><b>%s</b> · %s<br>Cited by: %s<br>Claims: %s</li>' % (
            slug("p-" + d), paper_line(title, year), doi_html(d, doi), "; ".join(cites), links))
    body.append('<section class="cg" id="papers"><h2>Papers</h2><ul class="plist">%s</ul></section>' % "".join(pl))
    title = "Claims behind the findings" if key == "findings" else "Claims behind the network edges"
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        '<title>%s · Q1</title><meta name="description" content="Every claim and source quote behind the Q1 %s, grouped by %s and paper.">'
        '<script>%s</script><link rel="stylesheet" href="style.css"></head><body class="cp"><a class="skip" href="#main">Skip to content</a>'
        '<header class="top"><div class="bar"><p class="eyebrow"><a href="index.html#%s">← Back to the Q1 site</a></p></div><h1>%s</h1><p class="q">%s</p>'
        '<nav aria-label="Contents"><ol class="toc">%s<li><a href="#papers">Papers</a></li></ol></nav></header>'
        '<main id="main">%s</main><footer><p>From <code>answers/%s</code>.</p></footer></body></html>\n'
    ) % (title, M["name"].lower(), M["item_word"][0], THEME_JS, key, title, esc(src["question"]), "".join(toc), "".join(body), esc(M["file"]))


def data_json(M):
    items = {}
    ins, outs = defaultdict(list), defaultdict(list)
    for it in M["items"]:
        items[it["ref"]] = {k: it[k] for k in ("ty", "id", "kind", "src", "tgt", "te", "sl", "tl", "dir", "cert", "rat",
                                               "studies", "claims", "sd", "cd", "ids", "docs", "dm")}
        outs[it["src"]].append(it["ref"])
        if it["tgt"]:
            ins[it["tgt"]].append(it["ref"])
    for g in M["gaps"]:
        items[g["ref"]] = {k: g[k] for k in ("ty", "id", "src", "tgt", "sl", "tl", "sf", "status")}
        outs[g["src"]].append(g["ref"])
        ins[g["tgt"]].append(g["ref"])
    kinds = M["src"].get("node_kinds", {})
    for n in M["nodes"]:
        k = n.get("kind")
        items["node:" + n["id"]] = {"ty": "node", "id": n["id"], "label": n["label"], "kind": k,
                                    "kt": kinds.get(k) if k else ("Factor" if n["shape"] == "factor" else "Outcome"),
                                    "kn": KIND_TITLE.get(k) if k else None,
                                    "members": n.get("members"), "ins": ins[n["id"]], "outs": outs[n["id"]]}
    if M["key"] == "findings":
        for i in M["src"]["interactions"]:
            items["inter:" + i["edge_id"]] = {"ty": "inter", "id": i["edge_id"], "dir": i["direction"]}
    claims = {}
    for cid, ev in M["evidence"].items():
        claims[cid] = {"s": ev["subject"], "p": ev["predicate"], "n": ev["negated"], "o": ev["object"],
                       "d": ev["direction"], "g": ev["certainty_grade"], "et": ev["evidence_types"],
                       "c": ev["comparator"], "q": ev["quote"], "doc": ev["document_id"]}
    data = {"panel": M["key"], "items": items, "claims": claims,
            "papers": {d: list(v) for d, v in M["papers"].items()},
            "page": M["claims_page"], "gapNote": GAP_NOTE}
    if M["key"] == "network":
        data["pathNote"] = M["src"]["limitations"][0]
        data["setAside"] = M["src"]["set_aside"]
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def src_text(*names):
    """Read one or more files from src/ and join them in order."""
    return "\n".join((HERE / "src" / n).read_text(encoding="utf-8") for n in names)


def main():
    out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else HERE / "site"
    A = json.loads((ANSWERS / "q1_tree_planting.json").read_text(encoding="utf-8"))
    B = json.loads((ANSWERS / "q1_tree_planting_graph.json").read_text(encoding="utf-8"))
    MA, MB = model_a(A), model_b(B)
    ga, gb = layout(layout_spec(MA)), layout(layout_spec(MB))
    for name, g in (("findings", ga), ("network", gb)):
        if g["overlaps"]:
            print("layout overlap in %s: %s" % (name, g["overlaps"]), file=sys.stderr)
            sys.exit(1)
    if out.exists():
        shutil.rmtree(out)
    (out / "data").mkdir(parents=True)
    files = {
        "index.html": index_html(MA, MB, ga, gb),
        "claims-findings.html": claims_page(MA),
        "claims-network.html": claims_page(MB),
        "data/findings.json": data_json(MA),
        "data/network.json": data_json(MB),
        # graph.css (in-graph legend, chip column title) is part of the first-view stylesheet.
        "style.css": mini(src_text("style.css", "graph.css")),
        "app.js": mini(src_text("app.js")),
        # Loaded on first use only (see need() in app.js).
        "explore.js": mini(src_text("explore.js")),
        "explore.css": mini(src_text("explore.css")),
        "snap.js": mini(src_text("snap.js")),
        "export.js": mini(src_text("export.js")),
    }
    for rel, text in files.items():
        (out / rel).write_text(text, encoding="utf-8")
    total = 0
    for rel in files:
        n = (out / rel).stat().st_size
        total += n
        print("%9d  %s" % (n, rel))
    first = sum((out / r).stat().st_size for r in ("index.html", "style.css", "app.js"))
    print("%9d  total, %d  first view (index.html + style.css + app.js)" % (total, first))
    print("wrote %s" % out)


if __name__ == "__main__":
    main()
