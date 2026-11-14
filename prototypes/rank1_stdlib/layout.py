"""Deterministic layered layout for the Q1 graphs. Python standard library only.

Lanes of nodes sit on even layers. Between two lanes is a "chip column" (odd
layer). An edge gets one dummy item in every layer it crosses, and its chip is
one of those dummies, so chips are stacked like nodes and cannot overlap. The
same input always gives the same picture: no randomness, no force layout.

Steps: build items and routes -> order each layer (barycenter sweeps, ties by
first-seen order) -> place items vertically (isotonic regression keeps the
order and the spacing) -> spread ports on node sides -> draw cubic curves.
"""

CHIP_W, CHIP_H = 60, 24
GAP_W, GAP_H = 96, 24
NODE_W = 186
ARROW = 9
LABEL_PX = 14
SUB_PX = 12
TOP = 16


def stroke_w(studies):
    """Line width grows with the number of studies (capped)."""
    return round(min(1.5 + 0.6 * studies, 7.5), 2)


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
                    'target_edge', 'studies'}
    cg: distance from a lane edge to the next chip column centre
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

    edges = spec["edges"]
    for e in edges:
        if e["kind"] == "moderation":
            continue
        a, b = nitem[e["source"]], nitem[e["target"]]
        e["sw"] = 1.5 if e["kind"] == "gap" else stroke_w(e["studies"])
        if b.layer == a.layer:  # inside one lane: arc on the right side, chip in its own slot
            c = new_item("chip:" + e["ref"], a.layer + 1, "arc", CHIP_H, edge=e, w=CHIP_W)
            route = [a, c, b]
            chip_of[e["ref"]] = c
            e["arc"] = True
            link(route, e, arc=True)
        else:
            assert b.layer > a.layer, "edges must point to a later lane"
            mid = (a.layer + b.layer) // 2
            if (b.layer - a.layer) % 4 == 0:  # chip on the middle lane, not its edge
                mid = (a.layer + b.layer) // 2
            elif mid % 2 == 0:
                mid -= 1
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
        e["sw"] = stroke_w(e["studies"])
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
    def thick(s, it):
        e = s.edge
        t = e["sw"]
        if s.b is it and e["kind"] == "effect":
            t = max(t, 2 * max(4.0, e["sw"] / 2 + 2.5))
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

    def sort_layer(k, side):
        # Sort by the barycenter on the swept side; break ties by the other side,
        # then by first-seen order in the JSON.
        layer = layers[k]
        if k == 0:
            layer.sort(key=lambda it: (it.group, bary(it, side), bary(it, -side), it.first))
        else:
            layer.sort(key=lambda it: (bary(it, side), bary(it, -side), it.first))
        for i, it in enumerate(layer):
            pos[it] = i

    for _ in range(4):
        for k in range(1, n_layers):
            sort_layer(k, -1)
        for k in range(n_layers - 2, -1, -1):
            sort_layer(k, +1)

    # --- titles ----------------------------------------------------------------
    titles = []
    band = TOP
    for i, lane in enumerate(spec["lanes"]):
        if not lane:
            continue
        sub = wrap(lane.get("subtitle") or "", SUB_PX, NODE_W)
        titles.append({"x": lane_left(i), "y": TOP, "title": lane["title"], "sub": sub})
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
        layer = [it for it in layers[k] if it.typ != "arc"]
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
        # an arc chip sits halfway between its two ports, beside the lane
        for layer in layers:
            for it in layer:
                if it.typ == "arc":
                    a, b = it.segs[0].a, it.segs[1].b
                    it.y = (port.get((a, it.segs[0]), a.y) + port.get((b, it.segs[1]), b.y)) / 2

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
            if it.typ == "arc":
                it.x = lane_left((it.layer - 1) // 2) + NODE_W + 32
            elif it.typ != "node":
                it.x = col_x(it.layer)

    def f(v):
        return str(int(round(v)))

    def bez(p0, m0, p1, m1, k=0.45):
        dx = p1[0] - p0[0]
        c1 = (p0[0] + dx * k, p0[1] + dx * k * m0)
        c2 = (p1[0] - dx * k, p1[1] - dx * k * m1)
        return "C%s %s %s %s %s %s" % (f(c1[0]), f(c1[1]), f(c2[0]), f(c2[1]), f(p1[0]), f(p1[1]))

    out_edges = {}
    for e in edges:
        ref = e["ref"]
        route = routes[ref]
        a = route[0]
        s0 = [s for s in a.segs if s.a is a and s.edge is e][0]
        start = (a.x + NODE_W, port[(a, s0)])
        geo = {"chip": None, "arrow": None, "diamond": None}
        if e.get("arc"):
            c, b = route[1], route[2]
            s1 = [s for s in b.segs if s.b is b and s.edge is e][0]
            py = port[(b, s1)]
            tip = (b.x + NODE_W, py)
            end = (tip[0] + ARROW, py)
            sgn = 1 if py > start[1] else -1
            kx = (c.x - start[0]) * 0.6
            ky1 = abs(c.y - start[1]) * 0.6
            ky2 = abs(py - c.y) * 0.6
            d = "M%s %s C%s %s %s %s %s %s C%s %s %s %s %s %s" % (
                f(start[0]), f(start[1]), f(start[0] + kx), f(start[1]), f(c.x), f(c.y - sgn * ky1),
                f(c.x), f(c.y), f(c.x), f(c.y + sgn * ky2), f(end[0] + kx * 0.8), f(py), f(end[0]), f(py))
            ah = max(4.0, e["sw"] / 2 + 2.5)
            geo["arrow"] = "M%s %sL%s %sL%s %sZ" % (f(tip[0]), f(py), f(end[0]), f(py - ah), f(end[0]), f(py + ah))
            geo["chip"] = (c.x, c.y)
            geo["d"] = d
            out_edges[ref] = geo
            continue
        pts = [(start, 0.0)]
        for it in route[1:-1]:
            pts.append(((it.x, it.y), None))
        b = route[-1]
        mod_side = 0
        if e["kind"] == "moderation":
            # The diamond sits on the top (or bottom) border of the target edge's chip,
            # left of centre; the line reaches it diagonally through the free space.
            prev = pts[-1][0]
            mod_side = -1 if prev[1] <= b.y else 1
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
                ah = max(4.0, e["sw"] / 2 + 2.5)
                geo["arrow"] = "M%s %sL%s %sL%s %sZ" % (f(b.x), f(py), f(end[0]), f(py - ah), f(end[0]), f(py + ah))
        # tangents: flat at ends and chips, slope at pass-throughs
        full = [p for p, _ in pts] + [end]
        ms = []
        for i, p in enumerate(full):
            it = route[i] if i < len(route) else None
            if i == 0 or i == len(full) - 1 or (it is not None and it.typ != "pass"):
                ms.append(0.0)
            else:
                ms.append((full[i + 1][1] - full[i - 1][1]) / (full[i + 1][0] - full[i - 1][0]))
        d = "M%s %s" % (f(full[0][0]), f(full[0][1]))
        for i in range(len(full) - 1):
            if e["kind"] == "moderation" and i == len(full) - 2:
                p0, p1 = full[i], full[i + 1]
                dx = p1[0] - p0[0]
                d += "C%s %s %s %s %s %s" % (f(p0[0] + dx * 0.5), f(p0[1] + dx * 0.5 * ms[i]),
                                             f(p1[0] - 22), f(p1[1] + mod_side * 22), f(p1[0]), f(p1[1]))
            else:
                d += bez(full[i], ms[i], full[i + 1], ms[i + 1])
        geo["d"] = d
        c = chip_of.get(ref)
        if c is not None:
            geo["chip"] = (c.x, c.y)
        out_edges[ref] = geo

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

    # overlap self-check: chips, gap labels and nodes must not overlap
    boxes = []
    for nid, g in nodes.items():
        boxes.append(("node:" + nid, g["x"], g["y"], g["x"] + g["w"], g["y"] + g["h"]))
    for ref, it in chip_of.items():
        w = GAP_W if it.typ == "gap" else CHIP_W
        boxes.append(("chip:" + ref, it.x - w / 2, it.y - it.h / 2, it.x + w / 2, it.y + it.h / 2))
    overlaps = []
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i], boxes[j]
            if a[1] < b[3] and b[1] < a[3] and a[2] < b[4] and b[2] < a[4]:
                overlaps.append((a[0], b[0]))

    return {"width": width, "height": bottom + 24, "nodes": nodes, "edges": out_edges,
            "members": members, "titles": titles, "overlaps": overlaps}
