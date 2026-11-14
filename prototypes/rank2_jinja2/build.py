#!/usr/bin/env python3
"""Build the Q1 prototype site (rank 2: Python 3.12 + vendored Jinja2).

    python3 build.py [out_dir]          # default: ./site next to this file

Panel A reads answers/q1_tree_planting.json, Panel B reads
answers/q1_tree_planting_graph.json. Every number, label and quote is copied
from those files. The graph layout is computed here, at build time, so the
SVG shows without JavaScript. No network, no LLM, deterministic output.

Output:
    index.html                 both panels: graph, matrix, tables (no quotes
                               except the 5 interaction claims)
    claims-findings.html       every claim of a panel with its quote, as a
    claims-network.html        static page (the no-JavaScript road to L5)
    data/findings.json         drawer cards, claims, quotes and papers, fetched
    data/network.json          by site.js only when the reader first needs them
    assets/site.css, site.js
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "vendor"))  # vendored Jinja2 + MarkupSafe (pure Python)

import jinja2  # noqa: E402
from markupsafe import Markup  # noqa: E402

REPO = HERE.parent.parent
A_PATH = REPO / "answers" / "q1_tree_planting.json"
B_PATH = REPO / "answers" / "q1_tree_planting_graph.json"

# ---------------------------------------------------------------- fixed maps
DIR_WORD = {
    "increase": "Increase",
    "decrease": "Decrease",
    "mixed": "Mixed (studies disagree)",
    "no_effect": "No effect (tested)",
    "unclear": "Unclear",
}
DIR_GLYPH = {"increase": "↑", "decrease": "↓", "mixed": "↕", "no_effect": "=", "unclear": "?"}
DIR_ORDER = ["increase", "decrease", "mixed", "no_effect", "unclear"]
CERT_WORD = {"high": "High", "moderate": "Moderate", "low": "Low", "very_low": "Very low"}
CERT_DOTS = {"high": 4, "moderate": 3, "low": 2, "very_low": 1}
CERT_ORDER = ["high", "moderate", "low", "very_low"]

# Panel B: lane and group come from the node's `kind` (never from its id).
LANE_OF_KIND = {"planting_stock": 0, "site_treatment": 0, "combination": 0, "condition": 1, "outcome": 2}
GROUP_TITLE = {
    "planting_stock": "Planting stock",
    "site_treatment": "Site treatments",
    "combination": "Combined treatments",
    "condition": "Conditions",
    "outcome": "Outcomes",
}
GROUP_ORDER0 = ["planting_stock", "site_treatment", "combination"]

# ---------------------------------------------------------------- geometry
NODE_W = 196
LABEL_PX, LABEL_LH = 13, 16
SUB_PX, SUB_LH = 11, 13
CHIP_W, CHIP_H = 58, 20
GAPL_W, GAPL_H = 84, 20
ARROW = 11
LEFT, RIGHT = 70, 24
TEXT_X = 34  # label start inside a node (after the badge)


def num(x):
    """Compact number for SVG attributes."""
    r = round(float(x), 1)
    return str(int(r)) if r == int(r) else f"{r:.1f}"


def text_w(s, px):
    """Rough width of system sans text. Used only to wrap labels."""
    w = 0.0
    for ch in s:
        if ch in "il.,:;'|!()[]j ":
            w += 0.29
        elif ch in "frt-":
            w += 0.37
        elif ch in "mwMW":
            w += 0.86
        elif ch.isupper() or ch in "&+":
            w += 0.68
        else:
            w += 0.56
    return w * px


def wrap(s, px, maxw):
    lines, cur = [], ""
    for word in s.split():
        t = f"{cur} {word}".strip()
        if not cur or text_w(t, px) <= maxw:
            cur = t
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def plural(n, one, many):
    return f"{n} {one if n == 1 else many}"


# ---------------------------------------------------------------- cubic helpers
def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    )


def cpath(p0, p1, p2, p3):
    return f"M{num(p0[0])} {num(p0[1])}C{num(p1[0])} {num(p1[1])} {num(p2[0])} {num(p2[1])} {num(p3[0])} {num(p3[1])}"


def overlap(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    return w * h if w > 0 and h > 0 else 0.0


def place_1d(items):
    """Order-keeping least-squares placement of boxes on one axis.

    items: dicts with want (desired centre), h, mt, mb (half-gaps above/below).
    Returns the top of each box. Clusters that overlap are merged and centred
    on the mean of their wishes (a 1-D overlap removal)."""
    off = [0.0] * len(items)
    clusters = []
    for i, it in enumerate(items):
        c = {"ix": [i], "len": it["h"], "acc": it["want"] - it["h"] / 2, "cnt": 1}
        c["top"] = c["acc"]
        while clusters:
            p = clusters[-1]
            gap = items[p["ix"][-1]]["mb"] + items[c["ix"][0]]["mt"]
            if p["top"] + p["len"] + gap <= c["top"] + 1e-9:
                break
            shift = p["len"] + gap
            for j in c["ix"]:
                off[j] += shift
            p["acc"] += c["acc"] - shift * c["cnt"]
            p["cnt"] += c["cnt"]
            p["len"] += gap + c["len"]
            p["ix"] += c["ix"]
            p["top"] = p["acc"] / p["cnt"]
            clusters.pop()
            c = p
        clusters.append(c)
    tops = [0.0] * len(items)
    for c in clusters:
        for j in c["ix"]:
            tops[j] = c["top"] + off[j]
    return tops


# ---------------------------------------------------------------- layout
def layout(P):
    """Layered left-to-right layout for one panel.

    P has: prefix, lanes (list of {title, sub}), nodes (ordered dicts with id,
    label, lane, group, kind, members), groups0 (ordered list of
    (group key, title, sub)), effects (edges node->node: key, src, tgt, studies,
    claims, gap flag), mods (moderation: key, src, target_key), fixed0
    (keep lane-0 order as given), lane_gap.
    Returns the geometry the SVG template draws."""
    nodes = {n["id"]: n for n in P["nodes"]}
    nl = len(P["lanes"])
    lane_gap = P["lane_gap"]
    lane_x = [LEFT + i * (NODE_W + lane_gap) for i in range(nl)]
    width = lane_x[-1] + NODE_W + RIGHT

    links = P["effects"]  # effect edges and gaps
    by_key = {e["key"]: e for e in links}
    for e in links:
        e["span"] = nodes[e["tgt"]]["lane"] - nodes[e["src"]]["lane"]
        if e["span"] not in (0, 1, 2):
            raise SystemExit(f"layout: edge {e['key']} goes backwards or skips too far")
        if e["span"] == 2 and nl != 3:
            raise SystemExit("layout: long edge needs three lanes")
    mods = P["mods"]
    for m in mods:
        if m["target_key"] not in by_key:
            raise SystemExit(f"layout: moderation {m['key']} points at an unknown edge")
    members = [(mem, n["id"]) for n in P["nodes"] for mem in (n.get("members") or [])]

    # ---- node sizes (port count drives the height of busy nodes)
    left_n, right_n = Counter(), Counter()
    for e in links:
        right_n[e["src"]] += 1
        if e["span"] == 0:
            right_n[e["tgt"]] += 1
        else:
            left_n[e["tgt"]] += 1
    for m in mods:
        right_n[m["src"]] += 1
    for mem, combo in members:
        left_n[mem] += 1
        left_n[combo] += 1
    for n in P["nodes"]:
        if n.get("members"):
            labels = [nodes[m]["label"] for m in n["members"]]
            n["chips"] = [{"text": (("+ " if i else "") + t)} for i, t in enumerate(labels)]
            text_h = 12 + 14 + 6 + len(labels) * 24 + 6
            n["lines"] = []
        else:
            n["lines"] = wrap(n["label"], LABEL_PX, NODE_W - TEXT_X - 12)
            text_h = 2 * 13 + len(n["lines"]) * LABEL_LH
        k = max(left_n[n["id"]], right_n[n["id"]])
        n["h"] = max(text_h, (k + 1) * 10, 44)
        n["w"] = NODE_W

    # ---- lane title blocks
    def title_block(title, sub, x):
        sub_lines = wrap(sub, SUB_PX, NODE_W) if sub else []
        return {"title": title, "sub": sub_lines, "x": x, "h": 18 + len(sub_lines) * SUB_LH}

    lane_titles = []
    for i, lane in enumerate(P["lanes"]):
        lane_titles.append(title_block(lane["title"], lane["sub"], lane_x[i]))
    content_top = max(t["h"] for t in lane_titles) + 16

    # ---- items per lane (nodes + one dummy per lane-skipping link)
    lanes = [[] for _ in range(nl)]
    groups0 = [g[0] for g in P["groups0"]]
    for n in P["nodes"]:
        lanes[n["lane"]].append(("n", n["id"]))
    long_links = [e for e in links if e["span"] == 2]
    for e in long_links:
        lanes[1].append(("d", e["key"]))

    def seg_pairs():
        """Segments between adjacent lanes, as (upper item, lower item, lane)."""
        segs = []
        for e in links:
            if e["span"] == 1:
                segs.append((("n", e["src"]), ("n", e["tgt"]), nodes[e["src"]]["lane"]))
            elif e["span"] == 2:
                segs.append((("n", e["src"]), ("d", e["key"]), 0))
                segs.append((("d", e["key"]), ("n", e["tgt"]), 1))
        for m in mods:
            t = by_key[m["target_key"]]
            if t["span"] == 2 and nodes[m["src"]]["lane"] == 0:
                segs.append((("n", m["src"]), ("d", t["key"]), 0))
        return segs

    segs = seg_pairs()

    def crossings(orders):
        pos = [{it: i for i, it in enumerate(o)} for o in orders]
        total = 0
        for L in range(nl - 1):
            s = [(pos[L][a], pos[L + 1][b]) for a, b, lane in segs if lane == L]
            for i in range(len(s)):
                for j in range(i + 1, len(s)):
                    if (s[i][0] - s[j][0]) * (s[i][1] - s[j][1]) < 0:
                        total += 1
        return total

    def group_of(it):
        return nodes[it[1]]["group"] if it[0] == "n" else None

    def reorder(orders, L, ref_L):
        pos_ref = {it: i for i, it in enumerate(orders[ref_L])}
        cur = {it: i for i, it in enumerate(orders[L])}
        nb = {it: [] for it in orders[L]}
        for a, b, lane in segs:
            if lane == min(L, ref_L) and max(L, ref_L) == lane + 1:
                mine, other = (a, b) if L < ref_L else (b, a)
                if mine in nb and other in pos_ref:
                    nb[mine].append(pos_ref[other])

        def key(it):
            v = nb[it]
            return (sum(v) / len(v) if v else cur[it], cur[it])

        if L == 0:
            if P["fixed0"]:
                return orders[L]
            out = []
            for g in groups0:  # groups stay stacked; order inside each group
                out += sorted([it for it in orders[L] if group_of(it) == g], key=key)
            return out
        return sorted(orders[L], key=key)

    orders = [list(o) for o in lanes]
    best, best_c = [list(o) for o in orders], crossings(orders)
    for _ in range(4):
        for L in range(1, nl):
            orders[L] = reorder(orders, L, L - 1)
        for L in range(nl - 2, -1, -1):
            orders[L] = reorder(orders, L, L + 1)
        c = crossings(orders)
        if c < best_c:
            best, best_c = [list(o) for o in orders], c
    orders = best

    # ---- vertical positions
    y = {}  # item -> top
    h_of = {}

    def item_h(it):
        if it[0] == "n":
            return nodes[it[1]]["h"]
        return GAPL_H if by_key[it[1]].get("gap") else CHIP_H

    for L in range(nl):
        for it in orders[L]:
            h_of[it] = item_h(it)

    group_heads = []
    cy = content_top
    first = True
    for g, title, sub in P["groups0"]:
        members_g = [it for it in orders[0] if group_of(it) == g]
        if not members_g:
            continue
        if not first:
            cy += 10
            tb = title_block(title, sub, lane_x[0])
            tb["y"] = cy
            group_heads.append(tb)
            cy += tb["h"] + 10
        first = False
        for it in members_g:
            y[it] = cy
            cy += h_of[it] + 16

    # moderation target dummies get extra room on the side the dotted edge comes from
    extra = {}
    for m in mods:
        t = by_key[m["target_key"]]
        if t["span"] == 2:
            src_c = y[("n", m["src"])] + h_of[("n", m["src"])] / 2
            tgt_c = y[("n", t["src"])] + h_of[("n", t["src"])] / 2
            extra[("d", t["key"])] = "top" if src_c <= tgt_c else "bot"

    def centre(it):
        return y[it] + h_of[it] / 2

    def nbr_centres(it, lanes_ok):
        out = []
        for a, b, lane in segs:
            for mine, other in ((a, b), (b, a)):
                if mine == it and other in y and other in lanes_ok:
                    out.append(centre(other))
        return out

    def place_lane(L, ref_lanes):
        ok = set()
        for r in ref_lanes:
            ok |= set(orders[r])
        items = []
        for it in orders[L]:
            c = nbr_centres(it, ok)
            want = sum(c) / len(c) if c else (y[it] + h_of[it] / 2 if it in y else content_top)
            m = 8 if it[0] == "n" else 4
            e = extra.get(it)
            items.append({"want": want, "h": h_of[it], "mt": m + (26 if e == "top" else 0), "mb": m + (26 if e == "bot" else 0)})
        tops = place_1d(items)
        for it, t in zip(orders[L], tops):
            y[it] = t

    if nl == 2:
        place_lane(1, [0])
    else:
        place_lane(1, [0])
        place_lane(2, [1])
        place_lane(1, [0, 2])
        place_lane(2, [1])
    for L in range(1, nl):
        low = min(y[it] for it in orders[L])
        if low < content_top:
            for it in orders[L]:
                y[it] += content_top - low

    for n in P["nodes"]:
        it = ("n", n["id"])
        n["x"], n["y"] = lane_x[n["lane"]], y[it]
    dummy = {}
    for e in long_links:
        it = ("d", e["key"])
        dummy[e["key"]] = (lane_x[1] + NODE_W / 2, y[it] + h_of[it] / 2)

    # ---- ports: spread the ends along each side, sorted by the other end
    def ncentre(nid):
        n = nodes[nid]
        return n["y"] + n["h"] / 2

    side = {}  # (node, "L"/"R") -> list of (other_y, tiebreak, port key)
    def add_port(nid, s, other_y, pkey):
        side.setdefault((nid, s), []).append((other_y, len(side.get((nid, s), [])), pkey))

    for e in links:
        if e["span"] == 2:
            dy = dummy[e["key"]][1]
            add_port(e["src"], "R", dy, (e["key"], "s"))
            add_port(e["tgt"], "L", dy, (e["key"], "t"))
        elif e["span"] == 1:
            add_port(e["src"], "R", ncentre(e["tgt"]), (e["key"], "s"))
            add_port(e["tgt"], "L", ncentre(e["src"]), (e["key"], "t"))
        else:
            add_port(e["src"], "R", ncentre(e["tgt"]), (e["key"], "s"))
            add_port(e["tgt"], "R", ncentre(e["src"]), (e["key"], "t"))
    for m in mods:
        t = by_key[m["target_key"]]
        ty = dummy[t["key"]][1] if t["key"] in dummy else (ncentre(t["src"]) + ncentre(t["tgt"])) / 2
        add_port(m["src"], "R", ty, (m["key"], "s"))
    for mem, combo in members:
        add_port(mem, "L", ncentre(combo), (f"{mem}>{combo}", "s"))
        add_port(combo, "L", ncentre(mem), (f"{mem}>{combo}", "t"))
    port = {}
    for (nid, s), lst in side.items():
        n = nodes[nid]
        lst.sort()
        k = len(lst)
        for i, (_, _, pkey) in enumerate(lst):
            px = n["x"] + (n["w"] if s == "R" else 0)
            port[pkey] = (px, n["y"] + n["h"] * (i + 1) / (k + 1))

    # ---- paths
    obstacles = [(n["x"] - 4, n["y"] - 4, n["x"] + n["w"] + 4, n["y"] + n["h"] + 4) for n in P["nodes"]]
    for tb in lane_titles:
        obstacles.append((tb["x"], 0, tb["x"] + NODE_W, tb["h"]))
    for tb in group_heads:
        obstacles.append((tb["x"], tb["y"], tb["x"] + NODE_W, tb["y"] + tb["h"]))
    placed = []  # chip rects already placed
    chip_of = {}

    def curve(e):
        """Returns (path d, list of candidate cubic segments for the chip)."""
        p0, p3 = port[(e["key"], "s")], port[(e["key"], "t")]
        end = 0 if e.get("gap") else ARROW
        if e["span"] == 2:
            dx, dy = dummy[e["key"]]
            xl, xr = lane_x[1], lane_x[1] + NODE_W
            a = (p0, (p0[0] + (xl - p0[0]) * 0.5, p0[1]), (xl - (xl - p0[0]) * 0.5, dy), (xl, dy))
            q3 = (p3[0] - end, p3[1])
            b = ((xr, dy), (xr + (q3[0] - xr) * 0.5, dy), (q3[0] - (q3[0] - xr) * 0.5, q3[1]), q3)
            d = cpath(*a) + f"L{num(xr)} {num(dy)}" + cpath(*b)[cpath(*b).index("C"):]
            return d, None
        if e["span"] == 0:
            bulge = 64
            q3 = (p3[0] + end, p3[1])
            seg = (p0, (p0[0] + bulge, p0[1]), (p3[0] + bulge, p3[1]), q3)
            return cpath(*seg), seg
        q3 = (p3[0] - end, p3[1])
        dx = (q3[0] - p0[0]) * 0.5
        seg = (p0, (p0[0] + dx, p0[1]), (q3[0] - dx, q3[1]), q3)
        return cpath(*seg), seg

    def place_chip(key, seg, w, h, fixed=None):
        if fixed is not None:
            x, yv = fixed
        else:
            best_r, best_o = None, None
            for t in (0.5, 0.42, 0.58, 0.34, 0.66, 0.27, 0.73, 0.21, 0.79, 0.16, 0.84):
                x, yv = bez(*seg, t)
                r = (x - w / 2 - 3, yv - h / 2 - 3, x + w / 2 + 3, yv + h / 2 + 3)
                o = sum(overlap(r, b) for b in placed) + sum(overlap(r, b) for b in obstacles)
                if best_o is None or o < best_o:
                    best_r, best_o = (x, yv), o
                if o == 0:
                    break
            x, yv = best_r
        placed.append((x - w / 2, yv - h / 2, x + w / 2, yv + h / 2))
        chip_of[key] = (x, yv)
        return x, yv

    for e in long_links:  # fixed chips first: they sit in the lane-2 corridors
        w = GAPL_W if e.get("gap") else CHIP_W
        place_chip(e["key"], None, w, CHIP_H, fixed=dummy[e["key"]])
    geo = {}
    for e in links:
        geo[e["key"]] = curve(e)
    pending = [e for e in links if e["span"] != 2]
    pending.sort(key=lambda e: (0 if e.get("gap") else 1, -e["claims"], e["key"]))
    for e in pending:
        w = GAPL_W if e.get("gap") else CHIP_W
        place_chip(e["key"], geo[e["key"]][1], w, CHIP_H)

    # Moderation: a dotted edge from its source onto the chip of the edge it
    # changes. It ends with a diamond that touches the chip's top (or bottom)
    # border. For a corridor chip it runs through the gap, then along the room
    # reserved next to that chip, so it never crosses a lane-2 node.
    mod_geo = {}
    for m in mods:
        p0 = port[(m["key"], "s")]
        cx, cy = chip_of[m["target_key"]]
        sgn = -1 if p0[1] <= cy else 1
        ex = cx - CHIP_W / 2 + 16
        tip = (ex, cy + sgn * (CHIP_H / 2 + 6.5))  # diamond centre; its far point touches the chip
        if by_key[m["target_key"]]["span"] == 2:
            ry = cy + sgn * (CHIP_H / 2 + 16)
            a = (lane_x[1] - 8, ry)
            dx = (a[0] - p0[0]) * 0.5
            seg = (p0, (p0[0] + dx, p0[1]), (a[0] - dx, ry), a)
            b = (ex - 14, ry)
            d = (cpath(*seg) + f"L{num(b[0])} {num(b[1])}"
                 + f"C{num(ex - 4)} {num(ry)} {num(ex)} {num((ry + tip[1]) / 2)} {num(tip[0])} {num(tip[1])}")
        else:
            seg = (p0, (p0[0] + (ex - p0[0]) * 0.55, p0[1]), (ex, tip[1] + sgn * 30), tip)
            d = cpath(*seg)
        mod_geo[m["key"]] = (d, seg)
        place_chip(m["key"], seg, CHIP_W, CHIP_H)

    mem_paths = []
    for mem, combo in members:
        p0, p3 = port[(f"{mem}>{combo}", "s")], port[(f"{mem}>{combo}", "t")]
        b = 34 + abs(p3[1] - p0[1]) * 0.06
        mem_paths.append({"d": cpath(p0, (p0[0] - b, p0[1]), (p3[0] - b, p3[1]), p3), "member": mem, "combo": combo})

    bottom = max([n["y"] + n["h"] for n in P["nodes"]] + [r[3] for r in placed])
    height = bottom + 20
    return {
        "width": width,
        "height": height,
        "lane_titles": lane_titles,
        "group_heads": group_heads,
        "geo": geo,
        "mod_geo": mod_geo,
        "chip_of": chip_of,
        "mem_paths": mem_paths,
        "crossings": best_c,
    }


# ---------------------------------------------------------------- view models
def stroke_w(studies):
    return min(1.5 + 0.6 * studies, 7.0)


def docs_by_count(cids, evidence):
    """Paper ids of these claims, most claims first (ties: first seen)."""
    c = Counter(evidence[cid]["document_id"] for cid in cids)
    first = {}
    for cid in cids:
        first.setdefault(evidence[cid]["document_id"], len(first))
    return sorted(c, key=lambda d: (-c[d], first[d])), c


def paper_rows(evidence, items, item_key, label_of):
    """One row per distinct document_id."""
    papers = {}
    for cid, ev in evidence.items():
        d = ev["document_id"]
        if d not in papers:
            papers[d] = {"doc": d, "title": ev["title"], "year": ev["year"], "doi": ev["doi"], "claims": 0, "cites": [], "order": len(papers)}
        papers[d]["claims"] += 1
    for it in items:
        seen = set()
        for cid in it["edge_ids"]:
            d = evidence[cid]["document_id"]
            if d not in seen:
                seen.add(d)
                papers[d]["cites"].append({"key": item_key(it), "label": label_of(it), "anchor": it["anchor"]})
    return sorted(papers.values(), key=lambda p: (-p["claims"], p["order"]))


def count_dirs(items):
    c = Counter(it["direction"] for it in items)
    return [(d, c[d]) for d in DIR_ORDER if c[d]]


def count_certs(items):
    c = Counter(it["certainty"] for it in items)
    return [(k, c[k]) for k in CERT_ORDER if c[k]]


def island(obj):
    """JSON for a <script type=application/json> block, safe inside HTML."""
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return Markup(s.replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e"))


def build_panel_a(A):
    pre = "a"
    ev = A["evidence"]
    nodes, seen = [], {}

    def add(ref, lane):
        if ref["id"] not in seen:
            seen[ref["id"]] = {"id": ref["id"], "label": ref["label"], "lane": lane, "group": "factor" if lane == 0 else "outcome",
                               "role": "Factor" if lane == 0 else "Outcome"}
            nodes.append(seen[ref["id"]])

    for f in A["findings"] + A["gaps"]:
        add(f["subject"], 0)
    for f in A["findings"] + A["gaps"]:
        add(f["outcome"], 1)
    label = {n["id"]: n["label"] for n in nodes}

    items = []
    for i, f in enumerate(A["findings"]):
        it = dict(f)
        # "kind" here is an internal role for the templates; it is never printed for Panel A.
        it.update(key="e:" + f["id"], kind="finding", src=f["subject"]["id"], tgt=f["outcome"]["id"], anchor=f"{pre}-f{i}", group=f"{pre}-cg{i}")
        items.append(it)
    gaps = []
    for i, g in enumerate(A["gaps"]):
        gaps.append(dict(g, key="g:" + g["id"], src=g["subject"]["id"], tgt=g["outcome"]["id"], anchor=f"{pre}-g{i}"))

    effects = [{"key": it["key"], "src": it["src"], "tgt": it["tgt"], "claims": it["claims"]} for it in items]
    effects += [{"key": g["key"], "src": g["src"], "tgt": g["tgt"], "claims": 0, "gap": True} for g in gaps]
    geo = layout({
        "prefix": pre,
        "lanes": [{"title": "Factor", "sub": ""}, {"title": "Outcome", "sub": ""}],
        "nodes": nodes,
        "groups0": [("factor", "Factor", "")],
        "effects": effects,
        "mods": [],
        "fixed0": True,
        "lane_gap": 300,
    })
    return finish_panel(pre, "findings", A, nodes, label, items, gaps, [], geo, ev)


def build_panel_b(B):
    pre = "b"
    ev = B["evidence"]
    kinds = B["node_kinds"]
    nodes = []
    for n in B["nodes"]:
        if n["kind"] not in LANE_OF_KIND:
            raise SystemExit(f"unknown node kind {n['kind']!r}")
        nodes.append({"id": n["id"], "label": n["label"], "lane": LANE_OF_KIND[n["kind"]], "group": n["kind"], "kind": n["kind"],
                      "role": GROUP_TITLE[n["kind"]], "kind_text": kinds.get(n["kind"], ""), "members": n.get("members")})
    label = {n["id"]: n["label"] for n in nodes}

    items, mods = [], []
    for i, e in enumerate(B["edges"]):
        it = dict(e)
        it.update(key="e:" + e["id"], src=e["source"], tgt=e["target"], anchor=f"{pre}-e{i}", group=f"{pre}-cg{i}")
        items.append(it)
        if e["kind"] == "moderation":
            mods.append({"key": it["key"], "src": e["source"], "target_key": "e:" + e["target_edge"]})
    gaps = []
    for i, g in enumerate(B["gaps"]):
        gaps.append(dict(g, key="g:" + g["id"], src=g["source"], tgt=g["target"], anchor=f"{pre}-g{i}"))

    effects = [{"key": it["key"], "src": it["src"], "tgt": it["tgt"], "claims": it["claims"]} for it in items if it["kind"] == "effect"]
    effects += [{"key": g["key"], "src": g["src"], "tgt": g["tgt"], "claims": 0, "gap": True} for g in gaps]
    geo = layout({
        "prefix": pre,
        "lanes": [
            {"title": GROUP_TITLE["planting_stock"], "sub": kinds["planting_stock"]},
            {"title": GROUP_TITLE["condition"], "sub": kinds["condition"]},
            {"title": GROUP_TITLE["outcome"], "sub": kinds["outcome"]},
        ],
        "nodes": nodes,
        "groups0": [(g, GROUP_TITLE[g], kinds.get(g, "")) for g in GROUP_ORDER0],
        "effects": effects,
        "mods": mods,
        "fixed0": False,
        "lane_gap": 200,
    })
    return finish_panel(pre, "network", B, nodes, label, items, gaps, mods, geo, ev)


def finish_panel(pre, key, D, nodes, label, items, gaps, mods, geo, ev):
    is_b = key == "network"
    node_by = {n["id"]: n for n in nodes}
    item_by = {it["key"]: it for it in items}

    # pooled items: labels, aria text, papers
    for it in items:
        it["src_label"] = label[it["src"]]
        if it.get("kind") == "moderation":
            t = item_by["e:" + it["target_edge"]]
            it["tgt_label"] = f"{label[t['src']]} → {label[t['tgt']]}"
            it["target_anchor"] = t["anchor"]
            it["aria"] = (f"{it['src_label']} changes the effect of {label[t['src']]} on {label[t['tgt']]}: "
                          f"{DIR_WORD[it['direction']]}, certainty {CERT_WORD[it['certainty']]}, "
                          f"{plural(it['studies'], 'study', 'studies')}, {plural(it['claims'], 'claim', 'claims')}")
        else:
            it["tgt_label"] = label[it["tgt"]]
            it["aria"] = (f"{it['src_label']} to {it['tgt_label']}: {DIR_WORD[it['direction']]}, certainty "
                          f"{CERT_WORD[it['certainty']]}, {plural(it['studies'], 'study', 'studies')}, "
                          f"{plural(it['claims'], 'claim', 'claims')}")
        docs, cnt = docs_by_count(it["edge_ids"], ev)
        it["papers"] = [{"title": ev_doc(ev, d)["title"], "year": ev_doc(ev, d)["year"], "n": cnt[d]} for d in docs]
        it["sd"] = [(d, it["study_directions"][d]) for d in DIR_ORDER if it["study_directions"].get(d)]
        it["sd_total"] = sum(n for _, n in it["sd"])
        it["width"] = stroke_w(it["studies"])
        if it.get("kind") != "moderation":
            it["d"] = geo["geo"][it["key"]][0]
        else:
            it["d"] = geo["mod_geo"][it["key"]][0]
        it["chip"] = geo["chip_of"][it["key"]]
    for g in gaps:
        g["src_label"], g["tgt_label"] = label[g["src"]], label[g["tgt"]]
        g["d"] = geo["geo"][g["key"]][0]
        g["chip"] = geo["chip_of"][g["key"]]
        g["aria"] = f"{g['src_label']} to {g['tgt_label']}: no evidence. No study in this corpus tested this pairing."

    # nodes: in/out lists (gaps included, marked)
    for n in nodes:
        n["out"], n["in"] = [], []
        for opt in ("chips", "member_labels", "members", "kind", "kind_text"):
            n.setdefault(opt, None)
    for it in items:
        node_by[it["src"]]["out"].append(it)
        if it.get("kind") != "moderation":
            node_by[it["tgt"]]["in"].append(it)
    for n in nodes:
        n["gaps"] = [g for g in gaps if n["id"] in (g["src"], g["tgt"])]
        n["aria"] = (f"{n['label']}, {n['role'].lower()}: {plural(len(n['in']), 'in-edge', 'in-edges')}, "
                     f"{plural(len(n['out']), 'out-edge', 'out-edges')}")
        if n.get("members"):
            n["member_labels"] = [label[m] for m in n["members"]]

    # claims grouped by item, papers by claim count inside each group
    claim_groups = []
    used = set()
    for it in items:
        docs, _ = docs_by_count(it["edge_ids"], ev)
        rank = {d: i for i, d in enumerate(docs)}
        cids = sorted(it["edge_ids"], key=lambda c: (rank[ev[c]["document_id"]], it["edge_ids"].index(c)))
        claim_groups.append({"id": it["group"], "title": f"{it['src_label']} → {it['tgt_label']}", "key": it["key"], "cids": cids})
        used.update(cids)
    rest = [cid for cid in ev if cid not in used]
    interactions = []
    if not is_b:
        for x in D["interactions"]:
            interactions.append({"cid": x["edge_id"], "direction": x["direction"], "ev": ev[x["edge_id"]]})
        if rest:
            claim_groups.append({"id": f"{pre}-cg-int", "title": "Interactions (listed, not pooled)", "key": None, "cids": rest})
    elif rest:
        claim_groups.append({"id": f"{pre}-cg-rest", "title": "Other claims", "key": None, "cids": rest})
    claim_group_of = {}
    for g in claim_groups:
        for cid in g["cids"]:
            claim_group_of[cid] = g

    papers = paper_rows(ev, items, lambda it: it["key"], lambda it: f"{it['src_label']} → {it['tgt_label']}")

    # matrix: rows = sources, columns = targets (effects + gaps; moderation listed under it)
    effect_items = [it for it in items if it.get("kind") != "moderation"]
    rows = [n for n in nodes if any(it["src"] == n["id"] for it in effect_items) or any(g["src"] == n["id"] for g in gaps)]
    cols = [n for n in nodes if any(it["tgt"] == n["id"] for it in effect_items) or any(g["tgt"] == n["id"] for g in gaps)]
    cells = {}
    for it in effect_items:
        cells[(it["src"], it["tgt"])] = ("e", it)
    for g in gaps:
        cells[(g["src"], g["tgt"])] = ("g", g)
    matrix = {"rows": rows, "cols": cols, "cells": cells}

    # lenses (Panel B): from node kinds only
    lens = None
    if is_b:
        kind = {n["id"]: n["kind"] for n in nodes}
        direct, via, inter = [], [], []
        for it in items:
            ks, kt = kind[it["src"]], kind.get(it["tgt"])
            if it["kind"] == "moderation" or ks == "combination":
                inter.append(it["key"])
            elif ks in ("planting_stock", "site_treatment") and kt == "outcome":
                direct.append(it["key"])
            if "condition" in (ks, kt):
                via.append(it["key"])
        for g in gaps:
            if kind[g["src"]] in ("planting_stock", "site_treatment") and kind[g["tgt"]] == "outcome":
                direct.append(g["key"])
        lens = {"direct": direct, "via": via, "inter": inter}

    data = {
        "key": key,
        "nodes": {n["id"]: dict({"l": n["label"], "k": n.get("kind") or n["group"]}, **({"m": n["members"]} if n.get("members") else {}))
                  for n in nodes},
        "edges": {it["key"][2:]: {"s": it["src"], "t": it.get("target") if is_b else it["tgt"], "te": it.get("target_edge"),
                                  "k": it["kind"], "d": it["direction"], "c": it["certainty"], "a": it["anchor"]}
                  for it in items},
        "gaps": {g["key"][2:]: {"s": g["src"], "t": g["tgt"], "a": g["anchor"]} for g in gaps},
        "lens": lens,
        "total": len(items),
        "noun": "edges" if is_b else "findings",
    }

    claim_count = len(ev)
    stats = {
        "dirs": count_dirs(items),
        "certs": count_certs(items),
        "n_items": len(items),
        "n_gaps": len(gaps),
        "n_claims": claim_count,
        "n_papers": len({e["document_id"] for e in ev.values()}),
        "n_nodes": len(nodes),
    }
    if is_b:
        stats["edge_kinds"] = sorted(Counter(it["kind"] for it in items).items(), key=lambda kv: -kv[1])
        stats["node_kinds"] = [(k, sum(1 for n in nodes if n["kind"] == k)) for k in LANE_OF_KIND if any(n["kind"] == k for n in nodes)]
    else:
        stats["n_interactions"] = len(D["interactions"])

    return {
        "pre": pre,
        "key": key,
        "is_b": is_b,
        "claims_page": f"claims-{key}.html",
        "item_by": item_by,
        "D": D,
        "nodes": nodes,
        "its": items,
        "gaps": gaps,
        "mods": [it for it in items if it.get("kind") == "moderation"],
        "combos": [n for n in nodes if n.get("members")],
        "geo": geo,
        "claim_groups": claim_groups,
        "claim_group_of": claim_group_of,
        "interactions": interactions,
        "papers": papers,
        "matrix": matrix,
        "data": island(data),
        "stats": stats,
        "label": label,
        "ev": ev,
    }


def ev_doc(ev, doc, _cache={}):
    key = (id(ev), doc)
    if key not in _cache:
        _cache[key] = next(v for v in ev.values() if v["document_id"] == doc)
    return _cache[key]


# ---------------------------------------------------------------- render
def squeeze_html(s):
    """Drop indentation and blank lines (never inside a line)."""
    return "\n".join(line.strip() for line in str(s).splitlines() if line.strip())


def panel_json(p, M):
    """data/<panel>.json: what the drawer, the search and the JS claims table
    need beyond the page. Loaded on demand, once. Claim arrays are
    [subject, predicate, object, negated, direction, certainty_grade,
    evidence_types, comparator, quote, document_id]; papers are
    [title, year, doi]; groups are [tbody id, item key, title, claim ids]."""
    ev = p["ev"]
    cards = {}
    for it in p["its"]:
        cards[it["key"]] = squeeze_html(M.card_item(it, p))
    for g in p["gaps"]:
        cards[g["key"]] = squeeze_html(M.card_gap(g, p))
    for n in p["nodes"]:
        cards["n:" + n["id"]] = squeeze_html(M.card_node(n, p))
    claims = {}
    for g in p["claim_groups"]:
        for cid in g["cids"]:
            e = ev[cid]
            claims[cid] = [e["subject"], e["predicate"], e["object"], 1 if e["negated"] else 0, e["direction"],
                           e["certainty_grade"], ", ".join(e["evidence_types"]), e["comparator"], e["quote"], e["document_id"]]
    if set(claims) != set(ev):
        raise SystemExit(f"{p['key']}: claim groups do not cover the evidence map")
    out = {
        "cards": cards,
        "claims": claims,
        "papers": {pp["doc"]: [pp["title"], pp["year"], pp["doi"]] for pp in p["papers"]},
        "groups": [[g["id"], g["key"], g["title"], g["cids"]] for g in p["claim_groups"]],
    }
    return json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n"


def squeeze(src, js):
    """Cheap, safe size cut for our own CSS/JS: drop /* */ blocks, whole-line
    // comments, indentation and blank lines. Lines are never joined, so JS
    automatic semicolon insertion is unchanged."""
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    out = []
    for line in src.splitlines():
        t = line.strip()
        if not t or (js and t.startswith("//")):
            continue
        out.append(t)
    return "\n".join(out) + "\n"


def main(argv):
    out = Path(argv[1]).resolve() if len(argv) > 1 else HERE / "site"
    A = json.loads(A_PATH.read_text(encoding="utf-8"))
    B = json.loads(B_PATH.read_text(encoding="utf-8"))

    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(HERE / "templates")),
        autoescape=True,
        trim_blocks=True,
        lstrip_blocks=True,
        undefined=jinja2.StrictUndefined,
    )
    env.filters["n"] = num
    env.globals.update(
        DIR_WORD=DIR_WORD, DIR_GLYPH=DIR_GLYPH, DIR_ORDER=DIR_ORDER, CERT_WORD=CERT_WORD, CERT_DOTS=CERT_DOTS,
        CERT_ORDER=CERT_ORDER, CHIP_W=CHIP_W, CHIP_H=CHIP_H, GAPL_W=GAPL_W, GAPL_H=GAPL_H, TEXT_X=TEXT_X,
        LABEL_LH=LABEL_LH, SUB_LH=SUB_LH, plural=plural, wrap=wrap,
    )
    pa, pb = build_panel_a(A), build_panel_b(B)
    pages = {"index.html": squeeze_html(env.get_template("index.html.j2").render(A=A, B=B, panels=[pa, pb], pa=pa, pb=pb)) + "\n"}
    claims_t = env.get_template("claims.html.j2")
    M = env.get_template("macros.html.j2").module
    data = {}
    for p in (pa, pb):
        pages[p["claims_page"]] = squeeze_html(claims_t.render(p=p)) + "\n"
        data[f"data/{p['key']}.json"] = panel_json(p, M)

    if out.exists():
        # Replace only an earlier build (or an empty directory), never anything else.
        if out in (HERE, REPO) or out in HERE.parents or not out.is_dir():
            raise SystemExit(f"refusing to overwrite {out}")
        if any(out.iterdir()) and not (out / "index.html").is_file():
            raise SystemExit(f"refusing to overwrite {out}: not empty and not an earlier build")
        shutil.rmtree(out)
    (out / "assets").mkdir(parents=True)
    (out / "data").mkdir()
    for name, text in list(pages.items()) + list(data.items()):
        (out / name).write_text(text, encoding="utf-8")
    for name in ("site.css", "site.js"):
        src = (HERE / "static" / name).read_text(encoding="utf-8")
        (out / "assets" / name).write_text(squeeze(src, js=name.endswith(".js")), encoding="utf-8")
    print(f"wrote {out}  (crossings: findings {pa['geo']['crossings']}, network {pb['geo']['crossings']})")
    for f in sorted(out.rglob("*")):
        if f.is_file():
            print(f"{f.stat().st_size:>9}  {f.relative_to(out).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
