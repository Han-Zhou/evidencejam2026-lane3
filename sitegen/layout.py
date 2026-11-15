"""Deterministic layered layout for the Q1 graphs. Python standard library only.

Lanes of nodes sit on even layers. Between two lanes is a "chip column" (odd
layer). An edge gets one dummy item in every layer it crosses, and its chip is
one of those dummies, so chips are stacked like nodes and cannot overlap. The
same input always gives the same picture: no randomness, no force layout.

Steps: build items and routes -> order each layer (barycenter sweeps, ties by
first-seen order) -> place items vertically (isotonic regression keeps the
order and the spacing) -> spread ports on node sides -> draw lines (straight
runs through chips and pass-through slots, flat cubic curves between them) ->
add a legend band above the graph -> check that no text, node, chip or line
overlaps another.
"""

import math
import re

CHIP_W, CHIP_H = 60, 24
GAP_W, GAP_H = 96, 24
NODE_W = 186
ARROW = 9
LABEL_PX = 14
SUB_PX = 12
TOP = 16
TITLE_PX = 15

# Legend band above the graph (all sizes in viewBox units). The graph keeps its
# coordinates: the legend sits at negative y, above a rule at RULE_Y, and the viewBox
# starts above the legend. The lane titles start TOP under the rule.
LG_PX = 12      # legend text size
LG_TITLE_PX = 14  # the heading of the legend ("How to read this graph")
LG_TITLE = 26   # heading line, above the columns
LG_ROW = 18     # one legend row
LG_LINE = 15    # each wrapped line after the first one in a row
LG_HEAD = 22    # column head, above the first row
LG_SW = 30      # swatch width
LG_SG = 9       # swatch to text
LG_GUT = 24     # between two columns
LG_VGAP = 14    # between two rows of columns
RULE_Y = 0      # the rule between the legend and the graph
LG_TOP = 14     # top of the viewBox to the legend heading
LG_BOT = 18     # legend text to the rule
BOLD = 1.08     # semibold text is a little wider
# text_w() is tuned to SF Pro / Helvetica. A wider sans (DejaVu Sans on Linux, or a
# fallback font in a copied PNG) is up to about 15% wider, so every legend width is
# estimated at LG_FIT times text_w(). The bounds check uses the same factor.
LG_FIT = 1.18


# Drawn line width by edge kind (style.css draws these widths; explore.css uses 2.1 too).
# Every evidence line has the same width: width does not show the number of studies.
LINE_W = {"effect": 2.1, "moderation": 3.0, "gap": 1.6}
ARROW_HW = 4.0  # half the height of an arrowhead


_NARROW = set("iljtfr.,;:!|'()[] I")
_WIDE = set("mwMW@%&")


def text_w(s, px):
    w = 0.0
    for ch in s:
        if ch in _NARROW:
            w += 0.31
        elif ch in _WIDE:
            w += 0.84
        elif ch.isupper():
            w += 0.66
        elif ch.isdigit():
            w += 0.56
        else:
            w += 0.54
    return w * px


def wrap(s, px, maxw):
    """Greedy word wrap with an estimated text width. Never drops text."""
    lines, cur = [], ""
    for word in s.split():
        t = (cur + " " + word).strip()
        if not cur or text_w(t, px) <= maxw:
            cur = t
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def _row_text(r):
    return ("%s %s" % (r["lead"], r["text"])) if r.get("lead") else r["text"]


def _line_w(line, r, first):
    """Estimated width of one legend line, with the LG_FIT margin; a bold lead is a little wider."""
    w = text_w(line, LG_PX)
    if first and r.get("lead") and r.get("bold", True):
        w += text_w(r["lead"], LG_PX) * (BOLD - 1)
    return w * LG_FIT


def _head_w(head):
    return text_w(head, LG_PX) * BOLD * LG_FIT if head else 0.0


def _wrap_fit(r, tw):
    """Wrap a legend row so that every line, with the LG_FIT margin and its bold lead,
    is at most tw wide. A single word wider than tw stays as it is; the bounds check
    in layout() then stops the build."""
    mw = tw / LG_FIT
    while True:
        lines = wrap(_row_text(r), LG_PX, mw)
        if mw < 40 or all(_line_w(l, r, i == 0) <= tw for i, l in enumerate(lines)):
            return lines
        mw *= 0.96


def legend_title_w(title):
    """Estimated width of the legend heading (serif, like title_box()), with the LG_FIT margin."""
    return text_w(title, LG_TITLE_PX) * 1.12 * LG_FIT if title else 0.0


def legend_place(lg, width):
    """Place the legend columns from left to right, under the optional heading
    lg['title']. A column that does not fit starts a new row. A 'fill' column
    takes the rest of its row, or the full width on a new row when the rest is
    narrower than its 'min'. A column with no head and no rows is left out.
    Positions are relative to the top left of the legend. Every value is
    computed, so the result is deterministic."""
    title = lg.get("title") or ""
    cols, x, y, row_h = [], 0.0, (LG_TITLE if title else 0.0), 0.0
    for c in lg["cols"]:
        if not c.get("head") and not c["rows"]:
            continue
        if c.get("fill"):
            rest = width - x
            if x > 0 and rest < c.get("min", 240):
                x, y, row_h, rest = 0.0, y + row_h + LG_VGAP, 0.0, width
            tw = rest - LG_SW - LG_SG
        else:
            tw = c.get("tw", 200)
        head_h = LG_HEAD if c.get("head") else 0
        w = _head_w(c.get("head"))
        rows, ry = [], head_h
        for r in c["rows"]:
            lines = _wrap_fit(r, tw)
            w = max([w] + [LG_SW + LG_SG + _line_w(l, r, i == 0) for i, l in enumerate(lines)])
            rows.append(dict(r, lines=lines, y=ry))
            ry += LG_ROW + LG_LINE * (len(lines) - 1)
        if c.get("fill"):
            w = tw + LG_SW + LG_SG
        elif x > 0 and x + w > width:
            x, y, row_h = 0.0, y + row_h + LG_VGAP, 0.0
        cols.append({"x": x, "y": y, "w": w, "h": ry, "head": c.get("head") or "", "rows": rows})
        x += w + LG_GUT
        row_h = max(row_h, ry)
    return {"title": title, "cols": cols, "h": y + row_h}


def path_points(d, step=8.0):
    """Sample points along a path made of M, L, C and Z commands, about every
    `step` units. Used by the overlap check for lines, arrowheads and diamonds."""
    tok = re.findall(r"[MLCZ]|-?\d+(?:\.\d+)?", d)
    pts, cur, start, i, cmd = [], (0.0, 0.0), (0.0, 0.0), 0, "M"
    while i < len(tok):
        t = tok[i]
        if t in "MLCZ":
            cmd = t
            i += 1
            if t == "Z":
                pts.append(start)
                cur = start
            continue
        if cmd == "M":
            cur = start = (float(tok[i]), float(tok[i + 1]))
            pts.append(cur)
            i += 2
            cmd = "L"
        elif cmd == "L":
            p = (float(tok[i]), float(tok[i + 1]))
            n = max(1, int(max(abs(p[0] - cur[0]), abs(p[1] - cur[1])) / step))
            pts += [(cur[0] + (p[0] - cur[0]) * k / n, cur[1] + (p[1] - cur[1]) * k / n) for k in range(1, n + 1)]
            cur = p
            i += 2
        else:
            c1 = (float(tok[i]), float(tok[i + 1]))
            c2 = (float(tok[i + 2]), float(tok[i + 3]))
            p = (float(tok[i + 4]), float(tok[i + 5]))
            span = abs(c1[0] - cur[0]) + abs(c2[0] - c1[0]) + abs(p[0] - c2[0]) + \
                abs(c1[1] - cur[1]) + abs(c2[1] - c1[1]) + abs(p[1] - c2[1])
            n = max(4, int(span / step))
            for k in range(1, n + 1):
                s = k / n
                u = 1 - s
                pts.append((u * u * u * cur[0] + 3 * u * u * s * c1[0] + 3 * u * s * s * c2[0] + s * s * s * p[0],
                            u * u * u * cur[1] + 3 * u * u * s * c1[1] + 3 * u * s * s * c2[1] + s * s * s * p[1]))
            cur = p
            i += 6
    return pts


def title_box(t):
    """Estimated box of a lane title, group header or chip column title with its subtitle lines."""
    w = max([text_w(t["title"], TITLE_PX) * 1.12] + [text_w(s, SUB_PX) for s in t["sub"]])
    x0 = t["x"] - w / 2 if t.get("anchor") == "middle" else t["x"]
    return (x0, t["y"], x0 + w, t["y"] + 20 + 15 * len(t["sub"]))


class Item:
    def __init__(self, key, layer, typ, h, first, node=None, edge=None, w=0):
        self.key, self.layer, self.typ, self.h, self.first = key, layer, typ, h, first
        self.node, self.edge, self.w = node, edge, w
        self.y = 0.0
        self.xt = self.xb = 0.0  # extra free space above / below
        self.segs = []
        self.group = 0


class Seg:
    def __init__(self, a, b, edge, a_side, b_side):
        self.a, self.b, self.edge, self.a_side, self.b_side = a, b, edge, a_side, b_side

    def other(self, it):
        return self.b if it is self.a else self.a


def _pava(values, weights):
    blocks = []
    for v, w in zip(values, weights):
        blocks.append([v * w, w, 1])
        while len(blocks) > 1 and blocks[-2][0] / blocks[-2][1] > blocks[-1][0] / blocks[-1][1]:
            s, w2, c = blocks.pop()
            blocks[-1][0] += s
            blocks[-1][1] += w2
            blocks[-1][2] += c
    out = []
    for s, w, c in blocks:
        out += [s / w] * c
    return out


def _gap_between(a, b):
    if a.typ == "pass" and b.typ == "pass":
        return 3
    if a.typ == "node" and b.typ == "node":
        return 14
    return 8


def layout(spec):
    """spec keys:
    lanes: list of {'title', 'subtitle'} per lane (lane 0 may be None: it uses groups)
    groups: list of {'key', 'title', 'subtitle'} for lane 0, in order
    nodes: list of {'id', 'label', 'lane', 'group', 'shape', 'members'(opt)}
    edges: list of {'ref', 'kind' (effect|moderation|gap), 'source', 'target',
                    'target_edge'}
    cg: distance from a lane edge to the next chip column centre
    chip_title (opt): {'title', 'parts'} drawn above each chip column; the parts
                      share one subtitle line when they fit, else one line each
    legend (opt): {'cols': [{'head', 'rows', 'tw' | 'fill' + 'min'}]} for legend_place();
                  each row is {'sw', 'lead', 'text', ...}, kept as given plus 'lines' and 'y'
    """
    cg = spec.get("cg", 95)
    margin_l = spec.get("margin_l", 44)
    n_lanes = len(spec["lanes"])
    n_layers = 2 * n_lanes - 1

    def lane_left(i):
        return margin_l + i * (NODE_W + 2 * cg)

    def col_x(layer):
        if layer % 2 == 0:
            return lane_left(layer // 2) + NODE_W / 2
        return lane_left(layer // 2) + NODE_W + cg

    layers = [[] for _ in range(n_layers)]
    first = [0]

    def new_item(*a, **k):
        it = Item(*a, first=first[0], **k)
        first[0] += 1
        layers[it.layer].append(it)
        return it

    # --- node items -----------------------------------------------------
    gi = {g["key"]: i for i, g in enumerate(spec.get("groups") or [])}
    nitem = {}
    for n in spec["nodes"]:
        it = new_item("node:" + n["id"], 2 * n["lane"], "node", 0, node=n, w=NODE_W)
        it.group = gi.get(n.get("group"), 0)
        nitem[n["id"]] = it

    # --- routes ------------------------------------------------------------
    routes = {}   # ref -> list of items
    chip_of = {}  # ref -> item that carries the edge's chip / gap label
    segs = []

    def link(route, e, arc=False, mod=False):
        for i in range(len(route) - 1):
            a, b = route[i], route[i + 1]
            a_side = "R" if a.typ == "node" else None
            if b.typ == "node":
                b_side = "R" if arc else "L"
            else:
                b_side = None
            s = Seg(a, b, e, a_side, b_side)
            a.segs.append(s)
            b.segs.append(s)
            segs.append(s)

    # Every chip and gap label sits in a chip column (odd layer), never in a lane.
    # An edge that skips a lane has its chip in the column next to its target
    # lane, so each column holds the chips of the edges that end in the lane on
    # its right (and the in-lane arcs of the lane on its left).
    edges = spec["edges"]
    for e in edges:
        if e["kind"] == "moderation":
            continue
        a, b = nitem[e["source"]], nitem[e["target"]]
        e["sw"] = LINE_W[e["kind"]]
        if b.layer == a.layer:  # inside one lane: arc on the right side, chip in the next column
            c = new_item("chip:" + e["ref"], a.layer + 1, "arc", CHIP_H, edge=e, w=CHIP_W)
            route = [a, c, b]
            chip_of[e["ref"]] = c
            e["arc"] = True
            link(route, e, arc=True)
        else:
            assert b.layer > a.layer, "edges must point to a later lane"
            mid = b.layer - 1
            route = [a]
            for L in range(a.layer + 1, b.layer):
                if L == mid:
                    typ = "gap" if e["kind"] == "gap" else "chip"
                    it = new_item("chip:" + e["ref"], L, typ, GAP_H if typ == "gap" else CHIP_H,
                                  edge=e, w=GAP_W if typ == "gap" else CHIP_W)
                    chip_of[e["ref"]] = it
                else:
                    it = new_item("pass:%s:%d" % (e["ref"], L), L, "pass", e["sw"] + 2, edge=e)
                route.append(it)
            route.append(b)
            link(route, e)
        routes[e["ref"]] = route

    for e in edges:
        if e["kind"] != "moderation":
            continue
        e["sw"] = LINE_W["moderation"]
        a = nitem[e["source"]]
        tgt = chip_of[e["target_edge"]]
        tgt.xt = tgt.xb = 26  # room for the line to reach the diamond
        span = tgt.layer - a.layer
        assert span >= 2
        mid = a.layer + span // 2
        if mid % 2 == 0:
            mid -= 1
        route = [a]
        for L in range(a.layer + 1, tgt.layer):
            if L == mid:
                it = new_item("chip:" + e["ref"], L, "chip", CHIP_H, edge=e, w=CHIP_W)
                chip_of[e["ref"]] = it
            else:
                it = new_item("pass:%s:%d" % (e["ref"], L), L, "pass", e["sw"] + 2, edge=e)
            route.append(it)
        route.append(tgt)
        e["mod_target"] = tgt
        link(route, e, mod=True)
        routes[e["ref"]] = route

    # --- node sizes ----------------------------------------------------------
    # Space that one line takes on a node side. An arrowhead is wider than its line.
    def thick(s, it):
        e = s.edge
        t = e["sw"]
        if s.b is it and e["kind"] == "effect":
            t = max(t, 2 * ARROW_HW)
        return t + 3

    for it in nitem.values():
        n = it.node
        if n.get("shape") == "combo":
            base = 2 * 22 + 6 + 2 * 11
            n["lines"] = []
        else:
            n["lines"] = wrap(n["label"], LABEL_PX, NODE_W - 30)
            base = max(52, 18 * len(n["lines"]) + 22)
        tl = sum(thick(s, it) for s in it.segs if s.b is it and s.b_side == "L")
        tr = sum(thick(s, it) for s in it.segs if (s.a is it) or (s.b is it and s.b_side == "R"))
        it.h = max(base, tl + 16, tr + 16)

    # --- ordering (barycenter) ---------------------------------------------
    pos = {}

    def reindex():
        for layer in layers:
            for i, it in enumerate(layer):
                pos[it] = i

    reindex()

    def bary(it, side):
        ps = [pos[s.other(it)] for s in it.segs
              if (s.other(it).layer < it.layer if side < 0 else s.other(it).layer > it.layer)]
        return sum(ps) / len(ps) if ps else float(pos[it])

    def linked(it, side):
        return any((s.other(it).layer < it.layer) if side < 0 else (s.other(it).layer > it.layer)
                   for s in it.segs)

    def sort_layer(k, side):
        # Sort by the barycenter on the swept side; break ties by the other side,
        # then by first-seen order in the JSON. An item with no line on the swept
        # side (an in-lane arc chip, on its way up) keeps its slot.
        layer = layers[k]
        if k == 0:
            key = lambda it: (it.group, bary(it, side), bary(it, -side), it.first)
        else:
            key = lambda it: (bary(it, side), bary(it, -side), it.first)
        free = iter(sorted([it for it in layer if linked(it, side)], key=key))
        layer[:] = [next(free) if linked(it, side) else it for it in layer]
        for i, it in enumerate(layer):
            pos[it] = i

    for _ in range(4):
        for k in range(1, n_layers):
            sort_layer(k, -1)
        for k in range(n_layers - 2, -1, -1):
            sort_layer(k, +1)

    # --- titles ----------------------------------------------------------------
    # Lane titles, and the same title above each chip column that holds chips
    # (centred on the column). In x order, so a screen reader reads them left to right.
    titles = []
    band = TOP
    ct = spec.get("chip_title")
    for i, lane in enumerate(spec["lanes"]):
        if lane:
            sub = wrap(lane.get("subtitle") or "", SUB_PX, NODE_W)
            titles.append({"x": lane_left(i), "y": TOP, "title": lane["title"], "sub": sub})
            band = max(band, TOP + 18 + 15 * len(sub) + 12)
        if ct and i < n_lanes - 1 and any(it.typ != "pass" for it in layers[2 * i + 1]):
            one = " · ".join(ct["parts"])
            sub = [one] if text_w(one, SUB_PX) <= 2 * cg - 30 else list(ct["parts"])
            titles.append({"x": col_x(2 * i + 1), "y": TOP, "title": ct["title"], "sub": sub,
                           "anchor": "middle"})
            band = max(band, TOP + 18 + 15 * len(sub) + 12)

    # lane 0 is a fixed stack: group header, then its nodes
    y = TOP
    headers = []
    prev_group = None
    for it in layers[0]:
        if spec.get("groups") and it.group != prev_group:
            g = spec["groups"][it.group]
            if prev_group is not None:
                y += 18
            sub = wrap(g.get("subtitle") or "", SUB_PX, NODE_W)
            hh = 18 + 15 * len(sub) + 8
            headers.append({"x": lane_left(0), "y": y, "title": g["title"], "sub": sub})
            y += hh
            prev_group = it.group
        elif prev_group is None and not spec.get("groups"):
            prev_group = -1
            y = band
        it.y = y + it.h / 2
        y += it.h + 14
    titles = headers + titles

    # --- vertical placement --------------------------------------------------
    port = {}

    def attach(other, s):
        if other.typ == "node":
            return port.get((other, s), other.y)
        return other.y

    def place(k, use_pred, use_succ):
        # An arc chip is stacked with the other chips of its column; it is pulled
        # halfway between its two ports. Its nodes are not pulled towards it.
        layer = layers[k]
        if not layer:
            return
        des, wts = [], []
        for it in layer:
            ys = []
            for s in it.segs:
                o = s.other(it)
                if o.typ == "arc":
                    continue
                if (o.layer < it.layer and use_pred) or (o.layer > it.layer and use_succ):
                    ys.append(attach(o, s))
            if ys:
                des.append(sum(ys) / len(ys))
                wts.append(float(len(ys)) * (2.0 if it.typ == "node" else 1.0))
            else:
                des.append(it.y)
                wts.append(0.01)
        sp = [0.0]
        for a, b in zip(layer, layer[1:]):
            sp.append(sp[-1] + a.h / 2 + a.xb + _gap_between(a, b) + b.h / 2 + b.xt)
        z = _pava([d - o for d, o in zip(des, sp)], wts)
        ys = [zi + o for zi, o in zip(z, sp)]
        ys[0] = max(ys[0], band + layer[0].h / 2 + layer[0].xt)
        for i in range(1, len(ys)):
            ys[i] = max(ys[i], ys[i - 1] + sp[i] - sp[i - 1])
        for it, yy in zip(layer, ys):
            it.y = yy

    def compute_ports():
        port.clear()
        for it in nitem.values():
            for side in ("L", "R"):
                ss = [s for s in it.segs
                      if (s.a is it and s.a_side == side) or (s.b is it and s.b_side == side)]
                ss.sort(key=lambda s: (s.other(it).y, s.edge["_i"]))
                total = sum(thick(s, it) for s in ss)
                yy = it.y - total / 2
                for s in ss:
                    t = thick(s, it)
                    port[(it, s)] = yy + t / 2
                    yy += t

    for i, e in enumerate(edges):
        e["_i"] = i
    for k in range(1, n_layers):
        place(k, True, False)
    for _ in range(3):
        for k in range(n_layers - 2, 0, -1):
            place(k, True, True)
        for k in range(1, n_layers):
            place(k, True, k < n_layers - 1)
    compute_ports()
    for _ in range(2):
        for k in range(1, n_layers):
            place(k, True, k < n_layers - 1)
        for k in range(n_layers - 2, 0, -1):
            place(k, True, True)
        compute_ports()

    # --- geometry ------------------------------------------------------------
    for it in nitem.values():
        it.x = lane_left(it.layer // 2)
    for layer in layers:
        for it in layer:
            if it.typ != "node":
                it.x = col_x(it.layer)

    def f(v):
        return str(int(round(v)))

    def bez(p0, p1, k=0.45):
        """Cubic curve that is flat at both ends."""
        dx = p1[0] - p0[0]
        return "C%s %s %s %s %s %s" % (f(p0[0] + dx * k), f(p0[1]), f(p1[0] - dx * k), f(p1[1]), f(p1[0]), f(p1[1]))

    def run(it):
        """Half the length of the straight run of a line through one of its route
        items: the lane width in a lane, the chip (or gap label) width in a column."""
        if it.layer % 2 == 0:
            return NODE_W / 2
        return (GAP_W if it.typ == "gap" else CHIP_W) / 2

    out_edges = {}
    for e in edges:
        ref = e["ref"]
        route = routes[ref]
        a = route[0]
        s0 = [s for s in a.segs if s.a is a and s.edge is e][0]
        start = (a.x + NODE_W, port[(a, s0)])
        geo = {"chip": None, "arrow": None, "diamond": None}
        if e.get("arc"):
            # Hairpin: out of the source's right side to the chip's left edge, and back
            # from the same edge to the target's right side. The two legs meet the
            # chip 10 units apart, so they do not cross.
            c, b = route[1], route[2]
            s1 = [s for s in b.segs if s.b is b and s.edge is e][0]
            py = port[(b, s1)]
            tip = (b.x + NODE_W, py)
            end = (tip[0] + ARROW, py)
            sgn = 1 if start[1] > py else -1
            x0 = c.x - CHIP_W / 2
            yi, yo = c.y + sgn * 5, c.y - sgn * 5
            d = "M%s %s%sL%s %sL%s %sL%s %s%s" % (
                f(start[0]), f(start[1]), bez(start, (x0, yi)), f(c.x), f(yi), f(c.x), f(yo),
                f(x0), f(yo), bez((x0, yo), end))
            ah = ARROW_HW
            geo["arrow"] = "M%s %sL%s %sL%s %sZ" % (f(tip[0]), f(py), f(end[0]), f(py - ah), f(end[0]), f(py + ah))
            geo["chip"] = (c.x, c.y)
            geo["d"] = d
            out_edges[ref] = geo
            continue
        b = route[-1]
        mod_side = 0
        if e["kind"] == "moderation":
            # The diamond sits on the top (or bottom) border of the target edge's chip,
            # left of centre; the line reaches it diagonally through the free space.
            prev = route[-2]
            mod_side = -1 if prev.y <= b.y else 1
            end = (b.x - 12, b.y + mod_side * CHIP_H / 2)
            geo["diamond"] = "M%s %sL%s %sL%s %sL%s %sZ" % (
                f(end[0]), f(end[1] - 6.5), f(end[0] + 6.5), f(end[1]),
                f(end[0]), f(end[1] + 6.5), f(end[0] - 6.5), f(end[1]))
        else:
            s1 = [s for s in b.segs if s.b is b and s.edge is e][0]
            py = port[(b, s1)]
            if e["kind"] == "gap":
                end = (b.x, py)
            else:
                end = (b.x - ARROW, py)
                ah = ARROW_HW
                geo["arrow"] = "M%s %sL%s %sL%s %sZ" % (f(b.x), f(py), f(end[0]), f(py - ah), f(end[0]), f(py + ah))
        # The line runs straight and flat through each of its route items: across
        # the full lane in a lane, across the full chip in a column (under the chip,
        # if it is its own). Curves join the runs. Thus a line never cuts a node box,
        # and it never runs under another edge's chip or gap label.
        d = "M%s %s" % (f(start[0]), f(start[1]))
        p = start
        for it in route[1:-1]:
            hw = run(it)
            d += bez(p, (it.x - hw, it.y)) + "L%s %s" % (f(it.x + hw), f(it.y))
            p = (it.x + hw, it.y)
        if e["kind"] == "moderation":
            dx = end[0] - p[0]
            d += "C%s %s %s %s %s %s" % (f(p[0] + dx * 0.5), f(p[1]),
                                         f(end[0] - 22), f(end[1] + mod_side * 22), f(end[0]), f(end[1]))
        else:
            d += bez(p, end)
        geo["d"] = d
        c = chip_of.get(ref)
        if c is not None:
            geo["chip"] = (c.x, c.y)
        out_edges[ref] = geo

    # Line check: no line may cut a node box other than its own two nodes, or run
    # under a chip or gap label other than its own (or, for a moderation, its
    # target's). Every chip must sit in a chip column (odd layer), never in a lane.
    cuts = []
    bx = [("node:" + k, it.x, it.y - it.h / 2, it.x + NODE_W, it.y + it.h / 2) for k, it in nitem.items()]
    for ref, it in chip_of.items():
        bx.append(("chip:" + ref, it.x - run(it), it.y - it.h / 2, it.x + run(it), it.y + it.h / 2))
        if it.layer % 2 == 0:
            cuts.append(("chip:" + ref, "a lane (chips go in a chip column)"))
    for e in edges:
        pts = path_points(out_edges[e["ref"]]["d"], 3.0)
        own = {"node:" + e["source"], "node:" + (e["target"] or ""), "chip:" + e["ref"],
               "chip:" + (e.get("target_edge") or "")}
        for name, x0, y0, x1, y1 in bx:
            if name not in own and any(x0 + 1 < px < x1 - 1 and y0 + 1 < py < y1 - 1 for px, py in pts):
                cuts.append(("line:" + e["ref"], name))

    # membership connectors: dotted arcs on the left side of lane 0
    members = []
    for n in spec["nodes"]:
        if not n.get("members"):
            continue
        c = nitem[n["id"]]
        for j, mid_ in enumerate(n["members"]):
            m = nitem[mid_]
            sy = m.y
            ey = c.y + (j - (len(n["members"]) - 1) / 2) * 10
            bulge = 16 + 0.05 * abs(ey - sy)
            members.append({"member": mid_, "combo": n["id"], "d": "M%s %sC%s %s %s %s %s %s" % (
                f(m.x), f(sy), f(m.x - bulge), f(sy), f(c.x - bulge), f(ey), f(c.x), f(ey))})

    nodes = {}
    for nid, it in nitem.items():
        nodes[nid] = {"x": it.x, "y": it.y - it.h / 2, "w": NODE_W, "h": it.h, "lines": it.node["lines"]}

    # bounding size
    bottom = 0
    for layer in layers:
        for it in layer:
            bottom = max(bottom, it.y + it.h / 2 + it.xb)
    width = lane_left(n_lanes - 1) + NODE_W + 24
    height = bottom + 24

    # legend: a band above the graph, from the left lane edge to the right one,
    # with a thin rule under it at RULE_Y. The graph keeps its coordinates and its
    # scale: the legend sits at negative y and the viewBox starts at 'top' (< 0).
    legend, top = None, 0
    if spec.get("legend"):
        x0, x1 = margin_l, width - 24
        legend = legend_place(spec["legend"], x1 - x0)
        legend.update({"x": x0, "y": RULE_Y - LG_BOT - legend["h"], "rule": (x0, RULE_Y, x1)})
        top = math.floor(legend["y"] - LG_TOP)
        height -= top

    # overlap self-check: nodes, chips, gap labels, titles and legend blocks must
    # not overlap each other, and no line, arrowhead or diamond may cross a text block.
    boxes = []
    for nid, g in nodes.items():
        boxes.append(("node:" + nid, g["x"], g["y"], g["x"] + g["w"], g["y"] + g["h"]))
    for ref, it in chip_of.items():
        w = GAP_W if it.typ == "gap" else CHIP_W
        boxes.append(("chip:" + ref, it.x - w / 2, it.y - it.h / 2, it.x + w / 2, it.y + it.h / 2))
    texts = []
    for t in titles:
        texts.append(("title:" + t["title"] + "@" + str(int(t["x"])),) + title_box(t))
    if legend:
        x0, y0 = legend["x"], legend["y"]
        if legend["title"]:
            texts.append(("legend:title", x0, y0, x0 + legend_title_w(legend["title"]), y0 + LG_TITLE - 6))
        for k, c in enumerate(legend["cols"]):
            texts.append(("legend:%d:%s" % (k, c["head"]), x0 + c["x"], y0 + c["y"],
                          x0 + c["x"] + c["w"], y0 + c["y"] + c["h"]))
        r = legend["rule"]
        texts.append(("legend:rule", r[0], r[1] - 1, r[2], r[1] + 1))
    overlaps = cuts
    allb = boxes + texts
    for i in range(len(allb)):
        for j in range(i + 1, len(allb)):
            a, b = allb[i], allb[j]
            if a[1] < b[3] and b[1] < a[3] and a[2] < b[4] and b[2] < a[4]:
                overlaps.append((a[0], b[0]))
    marks = []
    for e in edges:
        g = out_edges[e["ref"]]
        hw = e["sw"] / 2 + 1
        for d in (g["d"], g.get("arrow"), g.get("diamond")):
            if d:
                marks.append(("line:" + e["ref"], hw, path_points(d)))
    for m in members:
        marks.append(("member:%s>%s" % (m["member"], m["combo"]), 1.7, path_points(m["d"])))
    for name, hw, pts in marks:
        for t in texts:
            if any(t[1] - hw < px < t[3] + hw and t[2] - hw < py < t[4] + hw for px, py in pts):
                overlaps.append((name, t[0]))
    # bounds: every title and every legend line (estimated with the LG_FIT margin)
    # must lie inside the viewBox; legend lines must end at the rule's right end.
    for t in texts:
        if t[1] < 0 or t[3] > width or t[2] < top or t[4] > top + height:
            overlaps.append((t[0], "viewBox edge (box x %d..%d y %d..%d, viewBox x 0..%d y %d..%d)" % (
                t[1], t[3], t[2], t[4], width, top, top + height)))
    if legend:
        # The graph stays under the rule: no node, chip, title or line goes up into the legend.
        for b in boxes + [t for t in texts if not t[0].startswith("legend:")]:
            if b[2] <= RULE_Y + 1:
                overlaps.append((b[0], "above the legend rule (top %d, rule %d)" % (b[2], RULE_Y)))
        for name, hw, pts in marks:
            if any(py - hw <= RULE_Y + 1 for px, py in pts):
                overlaps.append((name, "above the legend rule (rule %d)" % RULE_Y))
        x1 = legend["rule"][2]
        if legend["x"] + legend_title_w(legend["title"]) > x1:
            overlaps.append(("legend title", "right edge (limit %d)" % x1))
        for c in legend["cols"]:
            cx = legend["x"] + c["x"]
            ends = [("head", cx + _head_w(c["head"]))]
            for r in c["rows"]:
                for i, l in enumerate(r["lines"]):
                    ends.append((l, cx + LG_SW + LG_SG + _line_w(l, r, i == 0)))
            for l, right in ends:
                if right > x1:
                    overlaps.append(("legend line %r" % l[:40], "right edge (ends at %d, limit %d)" % (right, x1)))

    return {"top": top, "width": width, "height": height, "nodes": nodes, "edges": out_edges,
            "members": members, "titles": titles, "legend": legend, "overlaps": overlaps}
