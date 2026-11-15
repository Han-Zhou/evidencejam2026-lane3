#!/usr/bin/env python3
"""Build the site: Q1 (Findings, Network), Q2 (Created marshes), Q3 (Gap map).
Python 3.12 standard library only. Run it through ../build.sh.

    python3 build.py [out_dir]          (default: site/ at the repo root)

Reads ../answers/q1_tree_planting.json (Panel A, "Findings"),
../answers/q1_tree_planting_graph.json (Panel B, "Network") and
../answers/q2_created_marshes.json (the Q2 tab, "Created marshes") and
../answers/q3_grassland_gaps.json (the Q3 tab, "Gap map"). The group order of
the gap map (rows and columns) comes from ../groups/lane3_groups.yaml. Writes
static HTML, CSS, small JS files and JSON files per panel. No network, no LLM.
Every direction, certainty, rationale, count, label, quote, title, year, DOI and
time point is copied from the JSON. The page only counts, sorts, filters and groups them.
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
ANSWERS = HERE.parent / "answers"

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

# Fixed UI copy: the title and plain-language subtitle of each question. The header shows the
# pair for the open tab. The pack's exact "question" text stays in the Q2 and Q3 section heads
# (screen readers, no-JS) and on every claims page.
HEAD = {
    "q1": ("Tree Planting: How Seedlings Survive and Grow",
           "How planting-stock traits (seedling size, nursery fertilization, mycorrhizal inoculation) "
           "affect survival and growth, and how it is changed by competing vegetation and site "
           "preparation in the Canadian forest restoration context."),
    "q2": ("Created Marshes: Time to Functional Biodiversity",
           "How long created marshes take to reach biodiversity and functionality when compared to "
           "natural wetlands, and which attributes lag behind."),
    "q3": ("Grassland Restoration: Combined Interventions",
           "Which intervention-outcome combinations have little evidence, which have no evidence, "
           "and which have the most evidence."),
}
# Tab names (fixed UI copy), in tab order: Q1 list, Q1 graph, Q2, Q3. A tab shows its name only.
TAB = {"findings": "Seedling findings", "network": "Seedling story",
       "marshes": "Marsh timelines", "gapmap": "Grassland matrix"}


def tab_html(k):
    return ('<a class="card" id="tab-%s" href="#panel-%s" data-tab="%s"><span class="cn">%s</span></a>'
            % (k, k, k, esc(TAB[k])))


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
# Panels with a "Want help?" tour: each has its own steps file, src/tour-<key>.js.
TOUR_PANELS = ("findings", "network", "marshes", "gapmap")

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


def group_order():
    """Ids of the intervention groups and the outcome groups, in the order of lane3_groups.yaml.
    Standard library only: the ids are read line by line ("  - id: seeding")."""
    text = (ANSWERS.parent / "groups" / "lane3_groups.yaml").read_text(encoding="utf-8")
    out, cur = {}, None
    for line in text.splitlines():
        m = re.match(r"^([a-z_]+):\s*$", line)
        if m:
            cur = out.setdefault(m.group(1), [])
            continue
        m = re.match(r"^\s+-\s+id:\s*([A-Za-z0-9_]+)\s*$", line)
        if m and cur is not None:
            cur.append(m.group(1))
    return out.get("intervention_groups", []), out.get("outcome_groups", [])


def model_q3(C):
    """Q3 gap map: rows are outcome groups, columns are intervention groups (pack order)."""
    iv_order, oc_order = group_order()
    cells = C["findings"] + C["gaps"]
    rl, cl = {}, {}
    for x in cells:
        cl.setdefault(x["subject"]["id"], x["subject"]["label"])
        rl.setdefault(x["outcome"]["id"], x["outcome"]["label"])

    def ordered(labels, order):
        known = [i for i in order if i in labels]
        return [(i, labels[i]) for i in known + [i for i in labels if i not in known]]

    rows, cols = ordered(rl, oc_order), ordered(cl, iv_order)
    pairs = {(x["outcome"]["id"], x["subject"]["id"]) for x in cells}
    assert len(pairs) == len(cells) == len(rows) * len(cols), "Q3 cells do not fill the grid"
    for f in C["findings"]:
        assert f["direction"] in DIR and f["certainty"] in CERT, f["id"]
        assert all(e in C["evidence"] for e in f["edge_ids"]), f["id"]
    return {"src": C, "rows": rows, "cols": cols, "findings": C["findings"], "gaps": C["gaps"],
            "evidence": C["evidence"], "papers": papers_of(C["evidence"])}


def q3_summary(M):
    s = M["src"]["summary"]
    return ("%d cells: %d with evidence (%d of them from a single study) and %d with no evidence. "
            "%d of the %d grassland claims are in the map.") % (
        s["cells"], s["filled"], s["thin"], s["empty"], s["claims_pooled"], s["grassland_claims"])


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
        '<div class="filters" role="group" aria-label="Filters">%s'
        '<label class="sel"><span class="vh">Certainty</span><select data-min><option value="0">Any certainty</option>%s</select></label>'
        # The count sits in the filter group, so it shares a row with the last filters.
        '<label class="cb"><input type="checkbox" data-gaps checked> Show gaps</label>'
        '<p class="count" aria-live="polite"></p></div></div>'
    ) % (key, key, key, chips, certs)


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


def lim_boxes(lims):
    """The limitations as a row of boxes, one per string, word for word. .limw is the CSS
    container that sets 4, 2 or 1 boxes per row. role="list" keeps the list semantics that
    Safari drops with list-style: none. gapmap.js makes the same markup for the Q3 map."""
    return '<div class="limw"><ul class="liml" role="list">%s</ul></div>' % "".join("<li>%s</li>" % esc(l) for l in lims)


def limits_html(M):
    """Limitations under the graph: every string of this panel's own file, word for word (v7).
    HTML, not SVG, so it shows without JS and in both Graph and Matrix views."""
    return ('<div class="limh"><h4>Limitations</h4>'
            '<p class="lsrc">From the pack\'s answer file <code>%s</code> (field <code>limitations</code>).</p></div>'
            '%s') % (esc(M["file"]), lim_boxes(M["src"]["limitations"]))


# "Want help?" right after the page title: one button for all panels. It opens the guided tour of
# the open panel only (app.js passes the open tab, because data-tour is empty). tour.js, tour.css
# and that panel's steps (src/tour-<key>.js) load on the first click.
HELP_BTN = ('<button type="button" class="helpbtn js-only" data-tour="" aria-haspopup="dialog" aria-expanded="false">'
            '<span class="hq" aria-hidden="true">?</span>Want help?</button>')


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


def q3_panel_html(M):
    """Panel C, the Q3 gap map. gapmap.js draws the map into .q3host when the tab first opens.
    Without JS the panel is a short summary and a link to the claims page (every finding,
    gap and quote)."""
    C = M["src"]
    lims = lim_boxes(C["limitations"])
    return (
        '<section class="panel" id="panel-gapmap" data-q3panel aria-labelledby="h-gapmap">'
        '<div class="phead"><h2 id="h-gapmap">%s</h2><p class="nojs"><a href="claims-gapmap.html">Every finding, gap and quote</a></p></div>'
        '<div class="q3nojs"><p class="q">%s</p><p>%s</p>'
        '<p>The gap map needs JavaScript. Every finding, with its direction, certainty, rationale and quotes, and every gap '
        'is on the <a href="claims-gapmap.html">Q3 claims page</a>.</p><h3>Limitations</h3>%s</div>'
        '<div class="q3host js-only" aria-busy="true"><p class="muted">Loading the gap map…</p></div>'
        '</section>'
    ) % (esc(HEAD["q3"][0]), esc(C["question"]), esc(q3_summary(M)), lims)


def index_html(MA, MB, ga, gb, M3, Q=None):
    """M3: the Q3 gap map model. Q: the Q2 answer file; with Q=None there is no Q2 tab."""
    # Tabs: the name only (TAB), centred in the tab. The tab row is the first row of the header.
    # The tab counts and the longer descriptions are switched off.
    cards = tab_html("findings") + tab_html("network")
    # Q2: a third tab, the class "mr" on <html> for #marshes hashes, and its section after the Q1 panels.
    mr, q2 = "", ""
    if Q is not None:
        cards += tab_html("marshes")
        mr = '+(/^#marshes/.test(location.hash)?" mr":"")'
        q2 = q2_section(Q)
    # Q3: the fourth tab, the class "q3" on <html> for #gapmap hashes, and its panel last.
    cards += tab_html("gapmap")
    q3 ='+(/^#(panel-)?gapmap/.test(location.hash)?" q3":"")'
    # The title and subtitle follow the open tab: Q1 for Findings and Network, Q2 for Created
    # marshes, Q3 for the gap map (the classes mr and q3 on <html>; see ".hq1" in style.css).
    qs = ("q1", "q2", "q3") if Q is not None else ("q1", "q3")
    # "Want help?" follows the title text (.htitle), and the theme toggle stays at the right.
    head = ('<div class="htitle"><h1>%s</h1>%s</div>%s</div>%s') % (
        "".join('<span class="h%s">%s</span>' % (k, esc(HEAD[k][0])) for k in qs), HELP_BTN, THEME_BTN,
        "".join('<p class="q h%s">%s</p>' % (k, esc(HEAD[k][1])) for k in qs))
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<title>Q1 · Tree planting evidence</title>'
        '<meta name="description" content="Evidence on how planting-stock traits and site treatments affect seedling survival and growth in Canadian forest restoration: findings, certainty, gaps and source quotes.">'
        '<script>document.documentElement.className="js"+(/^#network/.test(location.hash)?" nw":"")%s%s;%s</script>'
        '<link rel="stylesheet" href="style.css">'
        '<script src="app.js" defer></script></head><body>'
        '<a class="skip" href="#main">Skip to content</a>'
        # '<header class="top"><div class="bar"><p class="eyebrow">Evidence Jam 2026 · Lane 3 · Question 1</p>%s</div>'
        # '<h1>Tree planting in Canadian forest restoration</h1><p class="q">%s</p>'
        '<header class="top"><nav aria-label="Panels"><div class="cards">%s</div></nav>'
        '<div class="hrow">%s</header>'
        '<main id="main">%s%s%s%s</main>'
        # '<footer><p>Built from <code>answers/q1_tree_planting.json</code> and <code>answers/q1_tree_planting_graph.json</code>. '
        # 'Certainty rule <code>%s</code>. No text on this page is generated by a language model.</p></footer>'
        '</body></html>\n'
    ) % (mr, q3, THEME_JS, cards, head, panel_html(MA, ga), panel_html(MB, gb), q2, q3_panel_html(M3))
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


def grade_rank(g):
    return CERT_ORDER.index(g) if g in CERT_ORDER else len(CERT_ORDER)


def by_paper(ids, evidence):
    """Claims grouped by paper, ranked by claim grade (each claim's certainty_grade, unchanged):
    the most claims at the highest grade first, then at the next grade, and so on. In a paper,
    the claims go from the highest grade down. A tie keeps the order of the ids.
    The same order as rankPapers() in src/app.js, so the drawer and the claims pages agree."""
    groups = defaultdict(list)
    order = []
    pos = {}
    for i, cid in enumerate(ids):
        pos.setdefault(cid, i)
        d = evidence[cid]["document_id"]
        if d not in groups:
            order.append(d)
        groups[d].append(cid)
    first = {d: i for i, d in enumerate(order)}
    for d in order:
        groups[d].sort(key=lambda c: (grade_rank(evidence[c]["certainty_grade"]), pos[c]))
    counts = {d: Counter(evidence[c]["certainty_grade"] for c in groups[d]) for d in order}
    order.sort(key=lambda d: (tuple(-counts[d][g] for g in CERT_ORDER), first[d]))
    return [(d, groups[d]) for d in order]


def grades_html(cids, evidence):
    """The paper's grades: "Moderate", or "Moderate (3), Low (1)". The dots show the highest grade."""
    n = Counter(evidence[c]["certainty_grade"] for c in cids)
    ks = [g for g in CERT_ORDER if n[g]]
    if not ks:
        return ""
    words = ", ".join(CERT[g][1] + (" (%d)" % n[g] if len(ks) > 1 else "") for g in ks)
    return '<span class="dots" aria-hidden="true">%s</span> %s · ' % (dots_txt(ks[0]), esc(words))


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
            parts.append('<section class="paper"><h3>%s</h3><p class="pm">%s%s · %s</p><ol class="claims">%s</ol></section>' % (
                paper_line(title, year), grades_html(cids, ev), doi_html(d, doi), plural(len(cids), "claim", "claims"),
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
        '<header class="top"><div class="bar"><p class="eyebrow"><a href="index.html#%s">← Back to the Q1 site</a></p></div><h1>%s</h1><p class="q">%s</p><p>The papers in each section are ranked by claim grade, highest first.</p>'
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


DENSITY = {"thin": "thin (1 study)", "some": "some (2 to 3 studies)", "dense": "dense (4 or more studies)"}


def q3_label(x):
    return "%s %s %s" % (x["subject"]["label"], ARROW_TXT, x["outcome"]["label"])


def q3_claims_page(M):
    """Every Q3 finding (by intervention, then outcome) with its claims and quotes, then every gap.
    A claim can count in two intervention groups, so it can show under two findings; claim items
    have no id here, so the page has no duplicate ids."""
    C, ev = M["src"], M["evidence"]
    col_ix = {c: i for i, (c, _) in enumerate(M["cols"])}
    row_ix = {r: i for i, (r, _) in enumerate(M["rows"])}
    key = lambda x: (col_ix[x["subject"]["id"]], row_ix[x["outcome"]["id"]])
    toc, body = [], []
    for cid, clabel in M["cols"]:
        fs = sorted((f for f in M["findings"] if f["subject"]["id"] == cid), key=key)
        gs = sorted((g for g in M["gaps"] if g["subject"]["id"] == cid), key=key)
        sid = slug("i-" + cid)
        toc.append('<li><a href="#%s">%s</a> <span class="muted">(%s, %s)</span></li>' % (
            sid, esc(clabel), plural(len(fs), "finding", "findings"), plural(len(gs), "gap", "gaps")))
        parts = ['<section class="cg" id="%s"><h2>%s</h2>' % (sid, esc(clabel))]
        for f in fs:
            parts.append(
                '<section class="paper" id="%s" data-q3-finding-id="%s" data-direction="%s" data-certainty="%s" '
                'data-studies="%d" data-claims="%d" data-density="%s"><h3>%s</h3>'
                '<p class="meta">%s · certainty %s · %s · %s · density %s</p><p class="rat">%s</p>' % (
                    slug("f-" + f["id"]), esc(f["id"]), esc(f["direction"]), esc(f["certainty"]), f["studies"], f["claims"],
                    esc(f["density"]), esc(q3_label(f)), dir_html(f["direction"]), cert_html(f["certainty"]),
                    plural(f["studies"], "study", "studies"), plural(f["claims"], "claim", "claims"),
                    esc(DENSITY.get(f["density"], f["density"])), esc(f["certainty_rationale"])))
            for d, cids in by_paper(f["edge_ids"], ev):
                title, year, doi = M["papers"][d]
                parts.append('<h4>%s</h4><p class="pm">%s%s · %s</p><ol class="claims">%s</ol>' % (
                    paper_line(title, year), grades_html(cids, ev), doi_html(d, doi), plural(len(cids), "claim", "claims"),
                    "".join(re.sub(r'^<li id="[^"]*">', "<li>", claim_li(c, ev[c])) for c in cids)))
            parts.append("</section>")
        if gs:
            parts.append('<h3>No evidence</h3><p>%s</p><ul>%s</ul>' % (esc(GAP_NOTE), "".join(
                '<li id="%s" data-q3-gap-id="%s"><b>%s</b>: no evidence <span class="mono">(%s)</span>. '
                '<span class="muted">Searched for: %s</span></li>' % (
                    slug("g-" + g["id"]), esc(g["id"]), esc(g["outcome"]["label"]), esc(g["status"]), esc(g["searched_for"]))
                for g in gs)))
        parts.append("</section>")
        body.append("".join(parts))
    title = "Claims behind the gap map"
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        '<title>%s · Q3</title><meta name="description" content="Every finding, gap, claim and source quote behind the Q3 grassland gap map.">'
        '<script>%s</script><link rel="stylesheet" href="style.css"></head><body class="cp"><a class="skip" href="#main">Skip to content</a>'
        '<header class="top"><div class="bar"><p class="eyebrow"><a href="index.html#gapmap">← Back to the gap map</a></p></div><h1>%s</h1><p class="q">%s</p><p>The papers in each section are ranked by claim grade, highest first.</p>'
        '<p>%s</p><nav aria-label="Interventions"><ol class="toc">%s</ol></nav></header>'
        '<main id="main">%s</main><footer><p>From <code>answers/q3_grassland_gaps.json</code>. Certainty rule <code>%s</code>.</p></footer></body></html>\n'
    ) % (title, THEME_JS, title, esc(C["question"]), esc(q3_summary(M)), "".join(toc), "".join(body), esc(C["rule"]))


def q3_data_json(M):
    """data/gapmap.json: what the map needs (loaded when the tab opens)."""
    C = M["src"]
    return json.dumps({
        "q": C["question"], "rule": C["rule"], "how": C["how_built"], "lims": C["limitations"],
        "summary": q3_summary(M), "densest": C["summary"]["densest"],
        "rows": [list(r) for r in M["rows"]], "cols": [list(c) for c in M["cols"]],
        "f": [{"id": f["id"], "r": f["outcome"]["id"], "c": f["subject"]["id"], "dir": f["direction"],
               "cert": f["certainty"], "rat": f["certainty_rationale"], "st": f["studies"], "n": f["claims"],
               "den": f["density"], "sd": f["study_directions"], "cd": f["claim_directions"]} for f in M["findings"]],
        "g": [[g["id"], g["outcome"]["id"], g["subject"]["id"], g["status"]] for g in M["gaps"]],
    }, ensure_ascii=False, separators=(",", ":"))


def q3_claims_json(M):
    """data/gapmap-claims.json: claims, quotes and papers (loaded on the first cell click or export)."""
    claims = {}
    for cid, ev in M["evidence"].items():
        claims[cid] = {"s": ev["subject"], "p": ev["predicate"], "n": ev["negated"], "o": ev["object"],
                       "d": ev["direction"], "g": ev["certainty_grade"], "et": ev["evidence_types"],
                       "c": ev["comparator"], "q": ev["quote"], "doc": ev["document_id"]}
    return json.dumps({
        "ids": {f["id"]: f["edge_ids"] for f in M["findings"]},
        "docs": {f["id"]: f["document_ids"] for f in M["findings"]},
        "sf": {g["id"]: g["searched_for"] for g in M["gaps"]},
        "claims": claims, "papers": {d: list(v) for d, v in M["papers"].items()}, "gapNote": GAP_NOTE,
    }, ensure_ascii=False, separators=(",", ":"))
# ---------------------------------------------------------------------------
# Q2 panel: created marshes (answers/q2_created_marshes.json). Its own section
# (#panel-marshes, not a [data-panel]), its own claims page and data file.
# The Q1 helpers above are not changed; the Q2 code only calls some of them.
# ---------------------------------------------------------------------------

Q2_FILE = "q2_created_marshes.json"
Q2_PAGE = "claims-marshes.html"
# Fixed UI copy: one glyph and one label per direction (ref rows and with-age rows).
Q2DIR = {
    "below_reference": ("↓", "Below reference"),
    "comparable": ("=", "Comparable to reference"),
    "above_reference": ("↑", "Above reference"),
    "mixed": ("↕", "Mixed (studies disagree)"),
    "unclear": ("?", "Unclear"),
    "no_effect": ("=", "No change with age"),
    "increase": ("↑", "Increases with age"),
    "decrease": ("↓", "Decreases with age"),
}
# Mark slot on the 3-slot meter. "none": no mark (unclear).
Q2SLOT = {"below_reference": "left", "decrease": "left", "above_reference": "right", "increase": "right",
          "comparable": "mid", "mixed": "mid", "no_effect": "mid", "unclear": "none"}
Q2KIND = {"ref": ("q2-k-ref", "Vs reference"), "age": ("q2-k-age", "With age")}
Q2SCALE = {"ref": ("Below", "Same", "Above"), "age": ("Down", "None", "Up")}
Q2_AGE = re.compile(r"(\d+)\s*(?:-\s*(\d+))?")
Q2_TITLE = HEAD["q2"][0]
Q2_DRAWER_EMPTY = "Select a finding or a gap. Its claims and quotes show here."


def q2_dir_html(d):
    return '<span class="gl d-%s" aria-hidden="true">%s</span> %s' % (d, Q2DIR[d][0], esc(Q2DIR[d][1]))


def q2_counts_txt(c):
    """Direction counts as text, e.g. "Below reference 2, Above reference 1" (JSON order)."""
    return ", ".join("%s %d" % (Q2DIR[d][1], n) for d, n in c.items())


def q2_all(Q):
    """Every finding with its kind: "ref" (findings, vs reference) or "age" (with_time)."""
    return [(f, "ref") for f in Q["findings"]] + [(f, "age") for f in Q["with_time"]]


def q2_sort(rows):
    """Certainty rank (high to very low), then outcome label, then ref before age."""
    return sorted(rows, key=lambda r: (CERT_ORDER.index(r[0]["certainty"]), r[0]["outcome"]["label"].casefold(),
                                       r[0]["outcome"]["label"], 0 if r[1] == "ref" else 1))


def q2_gaps(Q):
    return sorted(Q["gaps"], key=lambda g: (g["outcome"]["label"].casefold(), g["outcome"]["label"]))


def q2_ages(points):
    """Parse "4-6 years" or "11 years" into (lo, hi). A string that does not parse stays in the text only."""
    out = []
    for t in points:
        m = Q2_AGE.search(t)
        if m:
            a, b = int(m.group(1)), int(m.group(2) or m.group(1))
            out.append((min(a, b), max(a, b)))
    return out


def q2_ymax(Q):
    """Axis end: the largest parsed age, rounded up to a multiple of 5. Not an arrival year."""
    hi = max([h for f, _ in q2_all(Q) for _, h in q2_ages(f["time_points"])] or [0])
    return max(5, -(-hi // 5) * 5)


def q2_pct(y, ymax):
    return "%.2f%%" % (100.0 * y / ymax)


def q2_ages_txt(f):
    return ", ".join(f["time_points"])


# Warning sign (yellow triangle, dark "!"). Its colours are in q2.css (.q2-wt, .q2-wm).
WICON = ('<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="q2-wt" d="M12 2.8 22.6 21H1.4Z"/>'
         '<path class="q2-wm" d="M12 9.2v5.6M12 17.6v.1"/></svg>')


def q2_warn(t):
    """Warning label next to "Time to reference: unknown". Only when the JSON value is null.
    The icon is decoration; the word "Warning" gives the meaning, so it is not colour alone. No digits."""
    if t is not None:
        return ""
    return '<p class="q2-warn">%s<span><strong>Warning:</strong> no answer in the evidence</span></p>' % WICON


def q2_clock(Q):
    sa = Q["short_answer"]
    t = sa["time_to_reference"]
    lags = "".join('<li class="q2-lag">Lags: %s</li>' % esc(l) for l in sa["lagging_attributes"])
    return ('<div class="q2-clock"><div class="q2-chead"><p class="q2-null">Time to reference: <em>%s</em></p>%s</div>'
            '<p class="q2-cnote">%s</p><ul class="q2-lags" aria-label="Lagging attributes">%s</ul></div>') % (
        "unknown" if t is None else esc(t), q2_warn(t), esc(sa["time_to_reference_note"]), lags)


def q2_filters(Q):
    labels = sorted({f["outcome"]["label"] for f, _ in q2_all(Q)} | {g["outcome"]["label"] for g in Q["gaps"]},
                    key=lambda s: (s.casefold(), s))
    # No value attribute: an option's value is its text, which equals the rows' data-attr.
    attrs = "".join("<option>%s</option>" % esc(l) for l in labels)
    certs = "".join('<option value="%s">%s</option>' % (c, CERT[c][1]) for c in CERT_ORDER)
    return ('<div class="q2-filters js-only"><label>Attribute <select class="q2-fa"><option value="">All attributes</option>%s</select></label>'
            '<label>Certainty <select class="q2-fc"><option value="">All levels</option>%s</select></label>'
            '<p class="q2-count" role="status" aria-live="polite"></p></div>') % (attrs, certs)


def q2_has_when(f, kind):
    """A row gets a "When was it measured?" dropdown when it lists ages, or when it is a with-age finding."""
    return kind == "age" or bool(f["time_points"])


def q2_bins(Q):
    """5-year spans of the age axis, each with the number of findings that have a measurement in it.
    A range counts in a span that it overlaps; a single age counts in the span that holds it."""
    ymax, out = q2_ymax(Q), []
    for lo in range(0, ymax, 5):
        hi = lo + 5

        def hit(a, b):
            return (a < hi and b > lo) if a < b else (lo <= a < hi or (hi == ymax and a == hi))
        n = sum(1 for f, _ in q2_all(Q) if any(hit(a, b) for a, b in q2_ages(f["time_points"])))
        out.append((lo, hi, n))
    return out


def q2_coverage(Q):
    """Evidence coverage bar: findings measured in each 5-year span since creation. A span with
    no finding is drawn as a gap (hatched, "0"), not as a light shade. Static: all findings."""
    ymax, bins = q2_ymax(Q), q2_bins(Q)
    top = max([n for _, _, n in bins] or [0])
    cells = []
    for lo, hi, n in bins:
        tier = 0 if n == 0 else -(-4 * n // top)  # 1 to 4: a quarter of the busiest span each
        cells.append('<li class="q2-cb q2-cb%d"><span class="vh">%d to %d years: </span><b>%d</b><span class="vh"> %s</span></li>' % (
            tier, lo, hi, n, "findings" if n != 1 else "finding"))
    ticks = "".join('<span style="left:%s">%d</span>' % (q2_pct(y, ymax), y) for y in range(0, ymax + 1, 5))
    with_ages = sum(1 for f, _ in q2_all(Q) if q2_ages(f["time_points"]))
    return (
        '<section class="q2-cov" aria-labelledby="q2-covh"><h3 id="q2-covh">Evidence coverage by marsh age</h3>'
        '<ol class="q2-covbar" aria-labelledby="q2-covh">%s</ol>'
        '<div class="q2-covx" aria-hidden="true"><div class="q2-ticks">%s</div><span class="q2-tlxl">Years since creation</span></div>'
        '<p class="q2-note">Each cell counts the findings with a measurement in that 5-year span (%s of %s list ages). '
        'Darker: more findings. Hatched: no finding, a gap and not a negative result. '
        'These are measurement ages, not an arrival year: no study in this corpus reports '
        'the year a created marsh matches the reference.</p></section>'
    ) % ("".join(cells), ticks, with_ages, plural(len(q2_all(Q)), "finding", "findings"))


def q2_board(Q):
    ymax = q2_ymax(Q)
    out = ['<table class="q2-board"><caption>Created marshes: one row per pooled finding, then the gaps. '
           'Select an attribute to read its claims.</caption><thead><tr><th scope="col">Attribute</th>'
           '<th scope="col">Type</th><th scope="col">Finding</th><th scope="col">Certainty</th></tr></thead><tbody>']
    for f, kind in q2_sort(q2_all(Q)):
        d, c, fid, lab = f["direction"], f["certainty"], f["id"], f["outcome"]["label"]
        slot = Q2SLOT[d]
        mark = "" if slot == "none" else '<span class="q2-mk d-%s"></span>' % d
        when = q2_has_when(f, kind)
        out.append(
            '<tr class="q2-row%s" data-finding-id="%s" data-direction="%s" data-certainty="%s" data-studies="%d" data-claims="%d" '
            'data-kind="%s" data-attr="%s" data-q2-ref="%s">'
            '<th scope="row"><a class="q2-sel" href="%s#%s" data-q2-ref="%s">%s</a>%s<span class="q2-sub">%s · %s</span></th>'
            '<td><span class="q2-kind %s">%s</span></td>'
            '<td><div class="q2-meter q2-m-%s" aria-hidden="true">%s</div>'
            '<span class="q2-scale" aria-hidden="true"><span>%s</span> <span>%s</span> <span>%s</span></span>'
            '<span class="q2-dir d-%s"><span class="gl" aria-hidden="true">%s</span> %s</span></td>'
            '<td>%s<p class="q2-rat">%s</p></td></tr>' % (
                " q2-hasw" if when else "", esc(fid), esc(d), esc(c), f["studies"], f["claims"], kind, esc(lab), esc(fid),
                Q2_PAGE, "f-" + slug(fid), esc(fid), esc(lab),
                ' <span class="q2-lagb">lags</span>' if f.get("lags") else "",
                plural(f["studies"], "study", "studies"), plural(f["claims"], "claim", "claims"),
                Q2KIND[kind][0], Q2KIND[kind][1], slot, mark, *Q2SCALE[kind], esc(d), Q2DIR[d][0], esc(Q2DIR[d][1]),
                cert_html(c), esc(f["certainty_rationale"])))
        if when:
            out.append(q2_when(f, kind, ymax))
    for g in q2_gaps(Q):
        gid, lab = g["id"], g["outcome"]["label"]
        out.append(
            '<tr class="q2-gap" data-gap-id="%s" data-attr="%s" data-q2-ref="%s">'
            '<th scope="row"><a class="q2-sel" href="%s#%s" data-q2-ref="%s">%s</a><span class="q2-sub">%s · 0 claims</span></th>'
            '<td><span class="q2-kind q2-k-gap">Gap</span></td>'
            '<td><div class="q2-meter q2-m-empty" aria-hidden="true"></div><span class="q2-nodata">No evidence: not tested</span></td>'
            '<td><span aria-hidden="true">—</span><span class="vh">No certainty grade: not tested</span></td></tr>' % (
                esc(gid), esc(lab), esc(gid), Q2_PAGE, "g-" + slug(gid), esc(gid), esc(lab),
                plural(g["studies"], "study", "studies")))
    out.append("</tbody></table>")
    return "".join(out)


Q2_WHEN_KEY = {
    "ref": "Solid marks: the ages at which studies compared the created marsh with the reference.",
    "age": "Dashed bar: the span of ages in this with-age finding. Solid marks: each age measured.",
}


def q2_when(f, kind, ymax):
    """The "When was it measured?" dropdown: a full-width row under its finding row, with its own
    axis. Native <details>, so it opens without JS. The filters hide it with its row (data-attr,
    data-certainty); the selection marks it with its row (data-q2-ref, no data-finding-id)."""
    d, c, fid = f["direction"], f["certainty"], f["id"]
    ranges = q2_ages(f["time_points"])
    marks = []
    if kind == "age" and ranges:
        lo, hi = min(r[0] for r in ranges), max(r[1] for r in ranges)
        marks.append('<span class="q2-tm q2-tm-traj d-%s" style="left:%s;width:%s"></span>' % (
            d, q2_pct(lo, ymax), q2_pct(hi - lo, ymax)))
    for lo, hi in ranges:
        if lo == hi:
            marks.append('<span class="q2-tm q2-tm-pt d-%s" style="left:%s"></span>' % (d, q2_pct(lo, ymax)))
        else:
            marks.append('<span class="q2-tm q2-tm-rg d-%s" style="left:%s;width:%s"></span>' % (
                d, q2_pct(lo, ymax), q2_pct(hi - lo, ymax)))
    if not f["time_points"]:
        marks.append('<span class="q2-tnone">No ages listed</span>')
    ages = ("Ages: " + q2_ages_txt(f)) if f["time_points"] else "No ages listed"
    ticks = "".join('<span style="left:%s">%d</span>' % (q2_pct(y, ymax), y) for y in range(0, ymax + 1, 5))
    return ('<tr class="q2-when" data-q2-ref="%s" data-kind="%s" data-attr="%s" data-certainty="%s"><td colspan="4">'
            '<details class="q2-wd"><summary>When was it measured? <span class="q2-wa">%s</span></summary>'
            '<div class="q2-wbox" style="--q2-step:%s"><div class="q2-ticks" aria-hidden="true">%s</div>'
            '<div class="q2-track" aria-hidden="true">%s</div>'
            '<p class="q2-wk"><span>Years since creation.</span> %s</p></div></details></td></tr>') % (
        esc(fid), kind, esc(f["outcome"]["label"]), esc(c), esc(ages), q2_pct(5, ymax), ticks, "".join(marks),
        esc(Q2_WHEN_KEY[kind]) if f["time_points"] else "This finding does not list the ages of the marshes.")


def q2_section(Q):
    return (
        '<section class="q2" id="panel-marshes" aria-labelledby="h-marshes">'
        '<div class="q2-head"><h2 id="h-marshes">%s</h2><p class="q2-q">%s</p>'
        '<p class="nojs"><a href="%s">All claims and quotes</a></p></div>'
        '%s%s<div class="q2-layout"><div class="q2-main">%s'
        '<h3>Findings</h3><p class="q2-note">Two kinds of rows. <b>Vs reference</b>: a created or restored marsh compared with a '
        'natural reference marsh. <b>With age</b>: how the attribute changes as the created marsh gets older. '
        'A <b>gap</b> means that no study tested that attribute. A gap is not a negative result. '
        'Open <b>When was it measured?</b> under a row to see the marsh ages that its studies measured.</p>%s'
        '<div class="q2-foot">%s<details class="q2-built"><summary>How this was built</summary><p>%s</p>'
        '<p>Certainty rule: <code>%s</code>. Source file: <code>answers/%s</code>.</p></details></div></div>'
        '<aside class="q2-dcol js-only"><section class="q2-drawer" aria-labelledby="q2-drh">'
        '<div class="dr-head"><h3 id="q2-drh" tabindex="-1">Details</h3><button type="button" class="q2-x" aria-label="Close details">×</button></div>'
        '<div class="q2-body"><p class="muted">%s</p></div></section></aside></div></section>'
    ) % (esc(Q2_TITLE), esc(Q["question"]), Q2_PAGE, q2_clock(Q), q2_coverage(Q), q2_filters(Q), q2_board(Q),
         limits_html({"file": Q2_FILE, "src": Q}), esc(Q["how_built"]), esc(Q["rule"]), Q2_FILE, Q2_DRAWER_EMPTY)


def q2_claim_li(cid, ev):
    return ('<li id="%s"><p class="spo">%s</p><p class="cm">%s · grade %s · %s · comparator: %s · <code>%s</code></p>'
            '<blockquote>%s</blockquote></li>') % (
        slug("c-" + cid.split("_")[-1]), spo_html(ev), q2_dir_html(ev["direction"]), esc(CERT[ev["certainty_grade"]][1]),
        esc(", ".join(t.replace("_", " ") for t in ev["evidence_types"])), esc(ev["comparator"].replace("_", " ")),
        esc(cid), esc(ev["quote"]))


def q2_claims_page(Q):
    """No-JS road to every quote: one section per finding (f-<slug>) and per gap (g-<slug>)."""
    ev = Q["evidence"]
    papers = papers_of(ev)
    sa = Q["short_answer"]
    toc, body = [], []
    t = sa["time_to_reference"]
    body.append('<section class="cg" id="time"><h2>Time to reference: %s</h2>%s<p>%s</p><p class="rat">Lagging attributes: %s</p></section>' % (
        "unknown" if t is None else esc(t), q2_warn(t), esc(sa["time_to_reference_note"]), esc(", ".join(sa["lagging_attributes"]))))
    for f, kind in q2_sort(q2_all(Q)):
        sid = "f-" + slug(f["id"])
        name = "%s (%s)" % (f["outcome"]["label"], Q2KIND[kind][1].lower())
        toc.append('<li><a href="#%s">%s</a></li>' % (sid, esc(name)))
        parts = ['<section class="cg" id="%s"><h2>%s</h2><p class="meta">%s</p>'
                 '<p class="meta">%s · certainty %s · %s · %s%s</p><p class="rat">%s</p><p class="rat">Direction means: %s</p>'
                 '<p class="rat">Study directions: %s. Claim directions: %s.</p>%s' % (
                     sid, esc(name), esc(f["subject"]["label"]), q2_dir_html(f["direction"]), cert_html(f["certainty"]),
                     plural(f["studies"], "study", "studies"), plural(f["claims"], "claim", "claims"),
                     " · lags" if f.get("lags") else "", esc(f["certainty_rationale"]), esc(f["direction_meaning"]),
                     esc(q2_counts_txt(f["study_directions"])), esc(q2_counts_txt(f["claim_directions"])),
                     ('<p class="rat">Ages: %s</p>' % esc(q2_ages_txt(f))) if f["time_points"] else "")]
        for d, cids in by_paper(f["edge_ids"], ev):
            title, year, doi = papers[d]
            parts.append('<section class="paper"><h3>%s</h3><p class="pm">%s%s · %s</p><ol class="claims">%s</ol></section>' % (
                paper_line(title, year), grades_html(cids, ev), doi_html(d, doi), plural(len(cids), "claim", "claims"),
                "".join(q2_claim_li(c, ev[c]) for c in cids)))
        parts.append("</section>")
        body.append("".join(parts))
    for g in q2_gaps(Q):
        sid = "g-" + slug(g["id"])
        toc.append('<li><a href="#%s">%s (gap)</a></li>' % (sid, esc(g["outcome"]["label"])))
        body.append('<section class="cg gap" id="%s"><h2>%s: no evidence</h2><p class="meta">%s</p><p>%s</p>'
                    '<p class="rat">Searched for: %s</p></section>' % (
                        sid, esc(g["outcome"]["label"]), esc(g["subject"]["label"]), esc(GAP_NOTE), esc(g["searched_for"])))
    body.append('<section class="cg" id="limitations"><h2>Limitations</h2><ul>%s</ul><p class="rat">How this was built: %s</p>'
                '<p class="rat">Certainty rule: <code>%s</code>.</p></section>' % (
                    "".join("<li>%s</li>" % esc(l) for l in Q["limitations"]), esc(Q["how_built"]), esc(Q["rule"])))
    owner = {c: f for f, _ in q2_all(Q) for c in f["edge_ids"]}
    pl = []
    for d in sorted(papers, key=lambda d: papers[d][0].lower()):
        title, year, doi = papers[d]
        cids = [c for c, e in ev.items() if e["document_id"] == d]
        cites = []
        for f, kind in q2_sort(q2_all(Q)):
            if d in f["document_ids"]:
                cites.append('<a href="#f-%s">%s (%s)</a>' % (slug(f["id"]), esc(f["outcome"]["label"]), Q2KIND[kind][1].lower()))
        assert all(c in owner for c in cids), "a Q2 claim is in no finding"
        links = ", ".join('<a href="#%s">%s</a>' % (slug("c-" + c.split("_")[-1]), esc(c)) for c in cids)
        pl.append('<li id="%s"><b>%s</b> · %s<br>Cited by: %s<br>Claims: %s</li>' % (
            slug("p-" + d), paper_line(title, year), doi_html(d, doi), "; ".join(cites), links))
    body.append('<section class="cg" id="papers"><h2>Papers</h2><ul class="plist">%s</ul></section>' % "".join(pl))
    title = "Claims behind the created-marsh findings"
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        '<title>%s · Q2</title><meta name="description" content="Every claim and source quote behind the Q2 created-marsh findings, grouped by finding and paper.">'
        '<script>%s</script><link rel="stylesheet" href="style.css"></head><body class="cp"><a class="skip" href="#main">Skip to content</a>'
        '<header class="top"><div class="bar"><p class="eyebrow"><a href="index.html#marshes">← Back to the site</a></p></div><h1>%s</h1><p class="q">%s</p><p>The papers in each section are ranked by claim grade, highest first.</p>'
        '<nav aria-label="Contents"><ol class="toc"><li><a href="#time">Time to reference</a></li>%s'
        '<li><a href="#limitations">Limitations</a></li><li><a href="#papers">Papers</a></li></ol></nav></header>'
        '<main id="main">%s</main><footer><p>From <code>answers/%s</code>.</p></footer></body></html>\n'
    ) % (title, THEME_JS, title, esc(Q["question"]), "".join(toc), "".join(body), Q2_FILE)


def q2_data_json(Q):
    """The answer file verbatim (compact), for q2.js."""
    return json.dumps(Q, ensure_ascii=False, separators=(",", ":"))


def q2_check(Q):
    """Ids must give unique anchors, and every edge id must resolve in the evidence map."""
    sl = ["f-" + slug(f["id"]) for f, _ in q2_all(Q)] + ["g-" + slug(g["id"]) for g in Q["gaps"]]
    assert len(sl) == len(set(sl)), "Q2 anchor slugs collide"
    for f, _ in q2_all(Q):
        for c in f["edge_ids"]:
            assert c in Q["evidence"], "Q2 edge id %s not in evidence" % c
        assert f["direction"] in Q2DIR and f["certainty"] in CERT


def src_opt(name):
    """Read src/<name>, or "" when it does not exist yet (a warning goes to stderr)."""
    p = HERE / "src" / name
    if not p.exists():
        print("warning: src/%s is missing; shipping it empty" % name, file=sys.stderr)
        return ""
    return p.read_text(encoding="utf-8")


def src_text(*names):
    """Read one or more files from src/ and join them in order."""
    return "\n".join((HERE / "src" / n).read_text(encoding="utf-8") for n in names)


def main():
    repo = HERE.parent
    out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else repo / "site"
    # The build deletes out/ first. Refuse a folder that holds the repo or its sources.
    keep = [repo / n for n in ("answers", "graph", "groups", "sitegen", "tools", "docs", ".git")]
    if out == repo or out in repo.parents or any(out == k or k in out.parents for k in keep):
        sys.exit("build.py: refusing to write the site into %s (it would delete repo files)" % out)
    A = json.loads((ANSWERS / "q1_tree_planting.json").read_text(encoding="utf-8"))
    B = json.loads((ANSWERS / "q1_tree_planting_graph.json").read_text(encoding="utf-8"))
    Q = json.loads((ANSWERS / Q2_FILE).read_text(encoding="utf-8"))
    q2_check(Q)
    C3 = json.loads((ANSWERS / "q3_grassland_gaps.json").read_text(encoding="utf-8"))
    MA, MB, M3 = model_a(A), model_b(B), model_q3(C3)
    ga, gb = layout(layout_spec(MA)), layout(layout_spec(MB))
    for name, g in (("findings", ga), ("network", gb)):
        if g["overlaps"]:
            print("layout overlap in %s: %s" % (name, g["overlaps"]), file=sys.stderr)
            sys.exit(1)
    if out.exists():
        shutil.rmtree(out)
    (out / "data").mkdir(parents=True)
    files = {
        "index.html": index_html(MA, MB, ga, gb, M3, Q),
        "claims-findings.html": claims_page(MA),
        "claims-network.html": claims_page(MB),
        "claims-marshes.html": q2_claims_page(Q),
        "claims-gapmap.html": q3_claims_page(M3),
        "data/findings.json": data_json(MA),
        "data/network.json": data_json(MB),
        "data/marshes.json": q2_data_json(Q),
        "data/gapmap.json": q3_data_json(M3),
        "data/gapmap-claims.json": q3_claims_json(M3),
        # graph.css (in-graph legend, chip column title) and q2.css (the Q2 panel) are part of
        # the first-view stylesheet. Same text as src_text("style.css", "graph.css", "q2.css").
        "style.css": mini(src_text("style.css", "graph.css") + "\n" + src_opt("q2.css")),
        "app.js": mini(src_text("app.js")),
        # Loaded on first use only (see need() in app.js).
        "explore.js": mini(src_text("explore.js")),
        "explore.css": mini(src_text("explore.css")),
        "snap.js": mini(src_text("snap.js")),
        "export.js": mini(src_text("export.js")),
        # Q3 gap map: loaded the first time its tab opens.
        "gapmap.js": mini(src_text("gapmap.js")),
        "gapmap.css": mini(src_text("gapmap.css")),
        # The Q2 panel's behaviour: loaded by need('q2') on the first visit to the Q2 tab.
        "q2.js": mini(src_opt("q2.js")),
        # Panel tours ("Want help?"): the engine and its styles, then one steps file per panel.
        # app.js loads tour.js, tour.css and the open panel's steps on the first click.
        "tour.js": mini(src_text("tour.js")),
        "tour.css": mini(src_text("tour.css")),
        **{"tour-%s.js" % k: mini(src_opt("tour-%s.js" % k)) for k in TOUR_PANELS},
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
