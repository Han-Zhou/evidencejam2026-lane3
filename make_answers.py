"""Build the barebones answers to the three Lane 3 questions from the graph.

    python make_answers.py            # writes answers/q1_*.json, q2_*.json, q3_*.json and answers.md

Deterministic and offline: no LLM, no network. Reads ``graph/causal_graph.yaml``
and ``groups/grouping_audit.csv``; everything else is in this file.

Each answer is a set of **findings**: one (subject, outcome) pair, the claims in
the graph that bear on it, pooled by study, with a direction and a certainty
grade. A pair with no claims is a **gap**, listed as such. Every finding keeps
its ``edge_ids`` and every edge in ``evidence`` keeps its quote and paper, so a
claim on a page can be traced to a sentence.

The rules below are deliberately simple and visible. They are the baseline,
not the last word: a team that finds a rule misreads the graph should say so.
"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import yaml

PACK = Path(__file__).resolve().parent
OUT = PACK / "answers"
RULE = "lane3-barebones-1"

GRADES = ["very_low", "low", "moderate", "high"]


# ---------------------------------------------------------------------------
# Reading one claim
# ---------------------------------------------------------------------------

UP = re.compile(r"^(increas|higher|greater|more|enhanc|improv|elevat|faster|larger|taller)", re.I)
DOWN = re.compile(r"^(decreas|lower|reduc|less|poor|fewer|slower|smaller|declin|suppress|inhibit)", re.I)
REVERSING_PREDICATES = {"prevents", "disrupts"}
ABSENT_SUBJECT = re.compile(r"^(absence of|no |without|lack of)", re.I)


def claim_direction(edge: dict, nodes: dict, flip_outcome: bool = False, read_moderation: bool = False) -> str:
    """What the claim says happens to the outcome: increase, decrease, no_effect or unclear.

    * A negated edge is a tested null: ``no_effect``.
    * Otherwise the direction is read from the outcome node's qualifier
      (``increased`` / ``decreased``), or from its name when the qualifier is
      missing ("Lower native cover ..."). ``causes`` alone carries no sign.
    * ``prevents`` / ``disrupts`` reverse it, and so does a cause stated as an
      absence ("absence of fertilization").
    * ``flip_outcome`` turns a mortality outcome into a survival one.
    * ``moderates`` (an interaction) is ``unclear`` here, unless ``read_moderation``: then the
      direction is what happens to the moderated effect ("increased effect of scarification").
    """
    if edge["negated"]:
        return "no_effect"
    if edge["predicate"] == "moderates" and not read_moderation:
        return "unclear"
    obj, subj = nodes[edge["object"]], nodes[edge["subject"]]
    qualifier = obj.get("state_or_change_qualifier")
    name = obj.get("name") or ""
    if qualifier == "unchanged":
        return "no_effect"
    if qualifier == "increased" or (qualifier not in ("decreased",) and UP.search(name)):
        sign = 1
    elif qualifier == "decreased" or DOWN.search(name):
        sign = -1
    else:
        return "unclear"
    if edge["predicate"] in REVERSING_PREDICATES:
        sign = -sign
    if subj.get("state_or_change_qualifier") in ("absent", "removed", "terminated") or ABSENT_SUBJECT.search(subj.get("name") or ""):
        sign = -sign
    if flip_outcome:
        sign = -sign
    return "increase" if sign > 0 else "decrease"


DESIGN_LEVEL = {  # best design in a body of evidence sets its starting grade
    "randomized_experiment": 2, "quasi_experiment": 2, "natural_experiment": 2, "observational_longitudinal": 2,
    "observational_cross_sectional": 1, "structural_equation_model": 1, "mechanistic_study": 1,
    "modeling_simulation": 0, "case_study": 0,
}
NO_COMPARATOR = {None, "not_reported"}


def comparator(edge: dict) -> str | None:
    return (edge.get("comparator") or [{}])[0].get("comparator_type")


def design_level(edge: dict) -> int:
    types = edge.get("evidential_basis", {}).get("evidence_types") or []
    level = max((DESIGN_LEVEL.get(t, 0) for t in types), default=0)
    if "randomized_experiment" in types and comparator(edge) == "untreated_control":
        level = 3
    return level


# ---------------------------------------------------------------------------
# Pooling claims into a finding
# ---------------------------------------------------------------------------


def majority(directions: list[str], mixed: str = "mixed") -> str:
    """The direction held by at least two thirds of the votes, else ``mixed``."""
    votes = [d for d in directions if d != "unclear"]
    if not votes:
        return "unclear"
    top, n = Counter(votes).most_common(1)[0]
    return top if n * 3 >= len(votes) * 2 else mixed


def pool(edges: list[dict], directions: dict[str, str]) -> dict:
    """Vote-count claims by study, then grade the body of evidence.

    Grade (rule ``lane3-barebones-1``): start from the best design (randomized
    against an untreated control: high; other randomized, quasi-experimental or
    controlled longitudinal: moderate; observational: low; modelling or case
    study: very low). Then -1 for a single study, -1 if no direction holds in
    two thirds of studies, -1 if most claims report no comparator; +1 if three
    or more studies agree, +1 if both mechanistic and difference-making
    evidence are present. A single study never exceeds moderate.
    """
    by_study: dict[str, list[str]] = defaultdict(list)
    for e in edges:
        by_study[e["source_document"]].append(directions[e["id"]])
    study_dirs = {d: majority(v) for d, v in by_study.items()}
    direction = majority(list(study_dirs.values()))
    n = len(by_study)

    start = max(design_level(e) for e in edges)
    grade, why = start, [f"start {GRADES[start].replace('_', ' ')} (best design in the body of evidence)"]
    if n == 1:
        grade -= 1
        why.append("-1 single study")
    if direction == "mixed":
        grade -= 1
        why.append("-1 studies disagree")
    if sum(comparator(e) in NO_COMPARATOR for e in edges) * 2 > len(edges):
        grade -= 1
        why.append("-1 most claims report no comparator")
    if n >= 3 and direction not in ("mixed", "unclear"):
        grade += 1
        why.append(f"+1 {n} studies agree")
    objects = {o for e in edges for o in e.get("evidential_basis", {}).get("evidence_objects") or []}
    if "both" in objects or {"mechanism", "correlation"} <= objects:
        grade += 1
        why.append("+1 mechanistic and difference-making evidence")
    grade = max(0, min(3, grade))
    if n == 1:
        grade = min(grade, 2)
    counts = Counter(study_dirs.values())
    return {
        "studies": n,
        "claims": len(edges),
        "direction": direction,
        "study_directions": dict(sorted(counts.items())),
        "claim_directions": dict(sorted(Counter(directions[e["id"]] for e in edges).items())),
        "certainty": GRADES[grade],
        "certainty_rationale": "; ".join(why) + f" -> {GRADES[grade].replace('_', ' ')}",
        "edge_ids": sorted(e["id"] for e in edges),
        "document_ids": sorted(by_study),
    }


# ---------------------------------------------------------------------------
# Shared output pieces
# ---------------------------------------------------------------------------


class Graph:
    def __init__(self):
        loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
        g = yaml.load((PACK / "graph" / "causal_graph.yaml").read_text(encoding="utf-8"), Loader=loader)
        self.nodes = {n["id"]: n for n in g["nodes"]}
        self.edges = g["edges"]
        self.docs = {d["document_id"]: d for d in g["source_documents"]}
        self.groups: dict[tuple[str, str], list[str]] = {}
        with open(PACK / "groups" / "grouping_audit.csv", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row["groups"]:
                    self.groups[(row["role"], row["node_id"])] = row["groups"].split(";")

    def text(self, node_id: str) -> str:
        n = self.nodes[node_id]
        return n.get("embedding_text") or n.get("name") or ""

    def evidence(self, edges: list[dict], directions: dict[str, str]) -> dict:
        """Per edge, what a page needs to show it and trace it: the quote and the paper."""
        out = {}
        for e in sorted(edges, key=lambda e: e["id"]):
            d = self.docs.get(e["source_document"], {})
            out[e["id"]] = {
                "subject": self.nodes[e["subject"]]["name"],
                "predicate": e["predicate"],
                "negated": e["negated"],
                "object": self.nodes[e["object"]]["name"],
                "direction": directions[e["id"]],
                "causal_language": e.get("causal_language"),
                "certainty_grade": e.get("certainty_grade"),
                "evidence_types": e.get("evidential_basis", {}).get("evidence_types") or [],
                "comparator": comparator(e),
                "ecosystem_context": e.get("ecosystem_context"),
                "quote": e.get("original_sentence"),
                "document_id": e["source_document"],
                "title": d.get("title"),
                "year": d.get("year"),
                "doi": d.get("doi"),
            }
        return out


def finding(question: str, subject: tuple[str, str], outcome: tuple[str, str], edges: list[dict],
            directions: dict[str, str]) -> dict:
    return {"id": f"{question}:{subject[0]}:{outcome[0]}",
            "subject": {"id": subject[0], "label": subject[1]},
            "outcome": {"id": outcome[0], "label": outcome[1]},
            **pool(edges, directions)}


def gap(question: str, subject: tuple[str, str], outcome: tuple[str, str], searched_for: str) -> dict:
    return {"id": f"{question}:{subject[0]}:{outcome[0]}",
            "subject": {"id": subject[0], "label": subject[1]},
            "outcome": {"id": outcome[0], "label": outcome[1]},
            "status": "no_evidence", "studies": 0, "searched_for": searched_for}


def first_match(text: str, options: list[tuple[str, str, re.Pattern]]) -> tuple[str, str] | None:
    for oid, label, pattern in options:
        if pattern.search(text):
            return oid, label
    return None


# ---------------------------------------------------------------------------
# Q1. Tree planting: stock traits, competing vegetation, site preparation
# ---------------------------------------------------------------------------

Q1_ID = "q1-tree-planting"
Q1_TEXT = ("For tree planting in Canadian forest restoration, how do planting-stock traits (seedling size, "
           "nursery fertilization, mycorrhizal inoculation) affect survival and growth, and how do competing "
           "vegetation and site preparation change that?")

#: First match wins: inoculation before stock type ("seedling type (control vs inoculated)"),
#: nursery fertilization before fertilization in general.
Q1_TRAITS = [
    ("inoculation", "Mycorrhizal or soil inoculation", re.compile(r"mycorrhiz|inocul", re.I)),
    ("seedling_size", "Seedling size & stock type",
     re.compile(r"seedling (size|height|morpholog)|\b(tall|short|large|small)(er)? seedlings?|stock ?type|"
                r"container (size|type)|bare-?root|height at planting|size at planting|multiple leaders", re.I)),
    ("nursery_fertilization", "Nursery fertilization (nutrient loading)",
     re.compile(r"exponential(ly)? fertili|nutrient[- ]load|nursery fertili|pre-?load", re.I)),
    ("fertilization_at_planting", "Fertilization at planting",
     re.compile(r"fertili[sz]|forest paks|\bnpk\b", re.I)),
]
Q1_MODIFIERS = [
    ("vegetation_control", "Vegetation control & release",
     re.compile(r"vegetation control|weed (removal|control)|weeding|herbicid|glyphosate|kalmia control|"
                r"(?<!controlled-)(?<!controlled )release(?! from (moose|deer|brows))|brushing|competitor removal",
                re.I)),
    ("site_preparation", "Site preparation",
     re.compile(r"scarif|site prep|mound|disc trench|trench|forest floor mixing|soil mixing|microsite (soil )?mix|"
                r"tillage|ripping|plough|plow|screef|bedding|ffmm|seedbed manipulation", re.I)),
    ("competing_vegetation", "Competing vegetation (more of it)",
     re.compile(r"compet|kalmia|fireweed|grass cover|shrub cover|ericaceous|herbaceous cover|weed (cover|density)", re.I)),
]
Q1_OUTCOMES = [
    ("survival", "Seedling survival", re.compile(r"surviv|mortal|death|dieback", re.I)),
    ("growth", "Seedling growth & size",
     re.compile(r"growth|height|diameter|biomass|volume|leader|increment|basal area|\bsize\b|\bmass\b|leaf area",
                re.I)),
]
Q1_TREES = re.compile(r"seedling|sapling|planted|\btrees?\b|spruce|pine|\bfir\b|tamarack|larch|aspen|poplar|birch|"
                      r"maple|\boak|\bash\b|beech|cedar|hemlock|fraxinus|acer|betula|picea|pinus|abies|populus|"
                      r"larix|quercus|conifer", re.I)
Q1_NOT_FOREST = {"temperate_subhumid_grasslands", "semi_desert_steppe", "derived_semi_natural_pastures_and_oldfields",
                 "sown_pastures_and_fields", "seasonal_floodplain_marshes", "permanent_marshes",
                 "coastal_saltmarshes_and_reedbeds", "annual_croplands"}
MORTALITY = re.compile(r"mortal|death|dieback|\bdied\b", re.I)


def q1(g: Graph) -> dict:
    subjects = Q1_TRAITS + Q1_MODIFIERS
    cells: dict[tuple, list[dict]] = defaultdict(list)
    interactions, directions = [], {}
    for e in g.edges:
        if e.get("ecosystem_context") in Q1_NOT_FOREST:
            continue
        s_text, o_text = g.text(e["subject"]), g.text(e["object"])
        # Taxa are often bare CURIEs ("applied to: wd:Q469576"), so the paper's title counts too.
        title = g.docs.get(e["source_document"], {}).get("title") or ""
        if not Q1_TREES.search(f"{o_text} {s_text} {title}"):
            continue
        outcome = q1_target(o_text)  # shared with q1_graph(): "Kalmia biomass" is not seedling growth
        if not outcome or outcome[0] not in ("survival", "growth"):
            continue
        traits = [t for t in Q1_TRAITS if t[2].search(s_text)]
        mods = [m for m in Q1_MODIFIERS if m[2].search(s_text)]
        if not traits and not mods:
            continue
        directions[e["id"]] = claim_direction(e, g.nodes, flip_outcome=outcome[0] == "survival" and bool(MORTALITY.search(o_text)))
        # A combined treatment or an interaction is not evidence on either factor alone.
        if e["predicate"] == "moderates" or (traits and mods):
            interactions.append(e)
            continue
        subject = first_match(s_text, subjects)
        cells[(subject, outcome)].append(e)

    findings, gaps = [], []
    for sid, slabel, _ in subjects:
        for oid, olabel, _ in Q1_OUTCOMES:
            edges = cells.get(((sid, slabel), (oid, olabel)))
            if edges:
                findings.append(finding("q1", (sid, slabel), (oid, olabel), edges, directions))
            else:
                gaps.append(gap("q1", (sid, slabel), (oid, olabel),
                                f"claims in forest or plantation settings whose cause matches '{slabel}' and whose "
                                f"effect is the {olabel.lower()} of tree seedlings or saplings"))
    used = [e for es in cells.values() for e in es] + interactions
    return {
        "id": Q1_ID, "question": Q1_TEXT, "rule": RULE,
        "how_built": ("Claims whose effect is the survival or growth of tree seedlings or saplings, outside grassland, "
                      "marsh and cropland settings, whose cause matches a planting-stock trait or a site factor (see "
                      "Q1_TRAITS and Q1_MODIFIERS in make_answers.py). Mortality outcomes are read as survival with "
                      "the sign flipped. Combined treatments and 'moderates' claims are listed under interactions, "
                      "not pooled."),
        "findings": findings,
        "gaps": gaps,
        "interactions": [{"edge_id": e["id"], "direction": directions[e["id"]]} for e in sorted(interactions, key=lambda e: e["id"])],
        "limitations": [
            "Matching is by keyword over node labels: a seedling-size claim worded unusually is missed, and a few "
            "natural (unplanted) seedlings are included where the paper does not say they were planted.",
            "Nursery fertilization and fertilization at planting are different practices; the question names the "
            "first, but most of the corpus is about the second. They are kept apart.",
            "'Competing vegetation (more of it)' and 'Vegetation control & release' describe the same factor from "
            "opposite ends. They are kept apart rather than flipping one, so each claim keeps its own wording.",
            "Growth pools height, diameter and biomass. A treatment can raise one and not another; open the claims.",
        ],
        "evidence": g.evidence(used, directions),
    }


# ---------------------------------------------------------------------------
# Q1 as a graph: practices, site treatments, conditions they act through, outcomes
# ---------------------------------------------------------------------------

#: Conditions between a treatment and the seedling: what the treatment changes on the way.
Q1_CONDITIONS = [
    ("competing_vegetation", "Competing vegetation",
     re.compile(r"compet|kalmia|fireweed|grass|shrub|ericaceous|herbaceous|weed|understor[ey]|non-crop|"
                r"vegetation (cover|biomass)", re.I)),
    ("seedling_nutrients", "Seedling nutrient status",
     re.compile(r"(foliar|leaf|needle|root|stem|tissue)\w*\b.{0,30}(nitrogen|\bn\b|phosph|potassium|nutrient|"
                r"concentration)|nitrogen (content|concentration|uptake)|nutrient (uptake|status)", re.I)),
    ("soil_conditions", "Soil & microsite conditions",
     re.compile(r"soil (temperature|moisture|water|nitrogen|nutrient|bulk density)|mineral soil|"
                r"forest floor (depth|thickness)|microsite", re.I)),
]
#: Words that make an effect node about the planted tree, not its surroundings.
TREE_OBJECT = re.compile(r"seedling|spruce|pine|aspen|\bfir\b|tamarack|larch|sapling|planted|poplar|birch|maple|"
                         r"\boak|beech|fraxinus|acer|betula|picea|pinus|abies|populus|larix|conifer", re.I)
Q1_FACTOR_IDS = {t[0] for t in Q1_TRAITS + Q1_MODIFIERS}
CONDITION_IDS = {"seedling_nutrients", "soil_conditions"}


def q1_target(o_text: str) -> tuple[str, str] | None:
    """What a claim's effect node is, for Q1: the seedling's survival or growth, or a condition.

    An effect that names the tree is about the seedling. Otherwise a condition word wins
    ("Kalmia biomass" is competing vegetation, not growth). Otherwise a survival or growth
    word is read as the seedling's, since taxa are often bare CURIEs ("applied to: wd:Q469576").
    """
    outcome = first_match(o_text, Q1_OUTCOMES)
    if TREE_OBJECT.search(o_text):
        return outcome or first_match(o_text, Q1_CONDITIONS[1:])
    return first_match(o_text, Q1_CONDITIONS) or outcome
NODE_KIND = {"inoculation": "planting_stock", "seedling_size": "planting_stock",
             "nursery_fertilization": "planting_stock", "fertilization_at_planting": "planting_stock",
             "vegetation_control": "site_treatment", "site_preparation": "site_treatment",
             "competing_vegetation": "condition", "seedling_nutrients": "condition", "soil_conditions": "condition",
             "survival": "outcome", "growth": "outcome"}


def q1_graph(g: Graph, q1_answer: dict) -> dict:
    """Q1's findings as a network, plus the links Q1 alone does not show.

    * effect edges: Q1's findings (practice or treatment -> survival / growth), unchanged,
      plus treatment -> condition and condition -> outcome / condition, pooled the same way;
    * combination nodes: combined treatments ("scarification and fertilization"), with
      ``members``, and their effect edges;
    * moderation edges: "X changes the effect of Y on Z" claims, whose target is another edge.
    """
    labels = {sid: lab for sid, lab, _ in Q1_TRAITS + Q1_MODIFIERS + Q1_CONDITIONS + Q1_OUTCOMES}
    labels["competing_vegetation"] = "Competing vegetation"  # one node, whether it is cause or condition
    subjects = Q1_TRAITS + Q1_MODIFIERS + Q1_CONDITIONS[1:]
    pairs: dict[tuple[str, str], list[dict]] = defaultdict(list)
    combos: dict[tuple[tuple[str, ...], str], list[dict]] = defaultdict(list)
    moderations: list[tuple[dict, str, tuple[str, str] | None]] = []
    directions: dict[str, str] = {}
    set_aside: list[dict] = []
    for e in g.edges:
        if e.get("ecosystem_context") in Q1_NOT_FOREST:
            continue
        s_text, o_text = g.text(e["subject"]), g.text(e["object"])
        title = g.docs.get(e["source_document"], {}).get("title") or ""
        if not Q1_TREES.search(f"{o_text} {s_text} {title}"):
            continue
        subject = first_match(s_text, subjects)
        target = q1_target(o_text)
        if not subject or not target:
            continue
        if subject[0] in CONDITION_IDS and g.nodes[e["subject"]].get("entity_type") == "management_intervention":
            continue  # "microsite mulching treatment" is a treatment Q1 does not model, not a soil condition
        traits = [t[0] for t in Q1_TRAITS if t[2].search(s_text)]
        mods = [m[0] for m in Q1_MODIFIERS if m[2].search(s_text)]
        flip = target[0] == "survival" and bool(MORTALITY.search(o_text))
        directions[e["id"]] = claim_direction(e, g.nodes, flip_outcome=flip, read_moderation=True)
        if traits and mods and re.search(r"\bor\b", g.nodes[e["subject"]]["name"], re.I):
            set_aside.append({"edge_id": e["id"], "why": "treatments joined by 'or': the claim does not say which acted"})
            continue
        if e["predicate"] == "moderates":
            # "fertilization moderates the effect of scarification on biomass": find the other factor.
            other = first_match(o_text, [t for t in Q1_TRAITS + Q1_MODIFIERS if t[0] != subject[0]])
            moderations.append((e, subject[0], (other[0], target[0]) if other else None))
            continue
        if traits and mods:  # the same rule q1() uses to set combined treatments aside
            members = sorted({first_match(s_text, Q1_TRAITS)[0], *mods})
            combos[(tuple(members), target[0])].append(e)
            continue
        if subject[0] == target[0]:
            continue
        if target[0] in ("survival", "growth") and subject[0] in Q1_FACTOR_IDS:
            continue  # Q1's own findings: taken from q1_answer below, so the two always agree
        pairs[(subject[0], target[0])].append(e)

    def edge(source: str, target: str, edges: list[dict]) -> dict:
        return {"id": f"{source}->{target}", "kind": "effect", "source": source, "target": target,
                **pool(edges, directions)}

    out_edges = []
    for f in q1_answer["findings"]:
        out_edges.append({"id": f"{f['subject']['id']}->{f['outcome']['id']}", "kind": "effect",
                          "source": f["subject"]["id"], "target": f["outcome"]["id"],
                          **{k: v for k, v in f.items() if k not in ("id", "subject", "outcome")}})
    for (s, t), edges in sorted(pairs.items()):
        out_edges.append(edge(s, t, edges))
    nodes = {nid: {"id": nid, "label": labels[nid], "kind": NODE_KIND[nid]} for nid in NODE_KIND}
    for (members, t), edges in sorted(combos.items()):
        cid = "+".join(members)
        nodes[cid] = {"id": cid, "label": " + ".join(labels[m] for m in members), "kind": "combination",
                      "members": list(members)}
        out_edges.append(edge(cid, t, edges))
    by_id = {x["id"]: x for x in out_edges}
    unresolved = []
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for e, source, target in moderations:
        if target and f"{target[0]}->{target[1]}" in by_id:
            grouped[(source, f"{target[0]}->{target[1]}")].append(e)
        else:
            unresolved.append(e["id"])
    for (source, target_edge), edges in sorted(grouped.items()):
        mod = edge(source, target_edge, edges)
        mod.update({"id": f"{source}~>{target_edge}", "kind": "moderation", "target": None,
                    "target_edge": target_edge,
                    "direction_meaning": "how the source changes the size of the target edge's effect"})
        out_edges.append(mod)
    used_nodes = {x["source"] for x in out_edges} | {x["target"] for x in out_edges if x["target"]}
    gap_edges = [{"id": f"{x['subject']['id']}->{x['outcome']['id']}", "source": x["subject"]["id"],
                  "target": x["outcome"]["id"], "status": "no_evidence", "searched_for": x["searched_for"]}
                 for x in q1_answer["gaps"]]
    used_nodes |= {x["source"] for x in gap_edges} | {x["target"] for x in gap_edges}
    claim_ids = {i for x in out_edges for i in x["edge_ids"]}
    claims = [e for e in g.edges if e["id"] in claim_ids]
    for i, v in q1_answer["evidence"].items():
        directions.setdefault(i, v["direction"])
    return {
        "id": "q1-tree-planting-graph", "question": Q1_TEXT, "rule": RULE,
        "how_built": ("Q1's findings as a directed graph. Effect edges from planting-stock traits and site "
                      "treatments to seedling survival and growth are exactly the findings in "
                      "q1_tree_planting.json. Added: edges from treatments to the conditions they change "
                      "(competing vegetation, seedling nutrient status, soil and microsite), edges from those "
                      "conditions to the seedling, combined treatments as combination nodes, and 'moderates' "
                      "claims as edges whose target is another edge. Every edge is pooled and graded like a "
                      "finding."),
        "node_kinds": {
            "planting_stock": "a trait of the seedling as planted",
            "site_treatment": "something done to the site",
            "condition": "a state of the site or seedling that treatments change and that affects the seedling",
            "outcome": "what the question asks about: seedling survival or growth",
            "combination": "two treatments applied together; 'members' names them",
        },
        "edge_kinds": {
            "effect": "source changes target; direction is what happens to the target",
            "moderation": "source changes the effect of 'target_edge'; 'target' is null",
        },
        "nodes": [nodes[n] for n in nodes if n in used_nodes],
        "edges": out_edges,
        "gaps": gap_edges,
        "set_aside": set_aside + [{"edge_id": i, "why": "a 'moderates' claim whose moderated effect could not be "
                                                        "matched to an edge"} for i in unresolved],
        "limitations": [
            "A path through a condition (site preparation -> competing vegetation -> growth) joins two separate "
            "bodies of evidence, usually from different papers. It is not a tested mediation: do not draw it as "
            "one effect or multiply the edges.",
            "No edge is a missing edge's opposite: two nodes with no edge between them were not tested together "
            "in this corpus.",
            "'Competing vegetation' is one node whether a claim treats it as a cause (more competition) or a "
            "result (a treatment reduced it). Edge direction is always read from the claim.",
            "Condition matching is by keyword, as in Q1. Open the claims behind an edge before relying on it.",
        ],
        "evidence": g.evidence(claims, directions),
    }


# ---------------------------------------------------------------------------
# Q2. Created marshes against natural reference wetlands
# ---------------------------------------------------------------------------

Q2_ID = "q2-created-marshes"
Q2_TEXT = ("How long do created marshes take to reach biodiversity and function comparable to natural reference "
           "wetlands, and which attributes lag?")

Q2_CONTEXTS = {"seasonal_floodplain_marshes", "permanent_marshes", "coastal_saltmarshes_and_reedbeds",
               "constructed_lacustrine_wetlands"}
Q2_TOPIC = re.compile(r"marsh|wetland|pond|pothole|slough", re.I)
REFERENCE_SIDE = re.compile(r"\breference\b|\bnatural\b|pristine|undisturbed|unaltered|intact", re.I)
CREATED_SIDE = re.compile(r"restor|creat|construct|reclaim|realign|engineer|tailings|process (material|water)|"
                          r"oil sands|\bbuilt\b|enhanced", re.I)
TIME = re.compile(r"\bage\b|years? (since|after)|time since|restoration age|site age|wetland age|older", re.I)
YEARS = re.compile(r"\b\d+(?:\s*(?:-|–|to)\s*\d+)?\s*(?:years?|yrs?)\b", re.I)
#: Outcome groups that answer "biodiversity" or "function". Others are kept but labelled as other.
Q2_BIODIVERSITY = {"richness_diversity", "community_composition", "plant_cover", "abundance_density",
                   "animal_abundance", "invasive_abundance", "reproduction", "growth_size", "survival_mortality",
                   "establishment_regeneration", "behaviour_habitat_use"}
OUTCOME_LABELS: dict[str, str] = {}


def versus_reference(edge: dict, nodes: dict, side: str, flip_outcome: bool = False) -> str:
    """Where the created marsh sits relative to the reference, from one claim."""
    d = claim_direction(edge, nodes, flip_outcome=flip_outcome)
    if d == "no_effect":
        return "comparable"
    if d == "unclear":
        return "unclear"
    created_higher = (d == "increase") == (side == "created")
    return "above_reference" if created_higher else "below_reference"


def q2(g: Graph) -> dict:
    comparisons: dict[str, list[dict]] = defaultdict(list)
    trajectories: dict[str, list[dict]] = defaultdict(list)
    vs_dir, time_dir, time_points = {}, {}, {}
    for e in g.edges:
        doc = g.docs.get(e["source_document"], {})
        about = f"{doc.get('title') or ''} {g.nodes[e['subject']]['name']}"
        if e.get("ecosystem_context") not in Q2_CONTEXTS or not Q2_TOPIC.search(about):
            continue
        groups = g.groups.get(("outcome", e["object"]))
        if not groups:
            continue
        outcome = groups[0]
        flip = outcome == "survival_mortality" and bool(MORTALITY.search(g.text(e["object"])))
        s_name = g.nodes[e["subject"]]["name"]
        ref, created = bool(REFERENCE_SIDE.search(s_name)), bool(CREATED_SIDE.search(s_name))
        timed = bool(TIME.search(s_name))
        years = sorted({re.sub(r"\s*(?:-|–|to)\s*", "-", re.sub(r"\s*(?:years?|yrs?)$", "", y, flags=re.I)) + " years"
                        for y in YEARS.findall(s_name + " " + (e.get("original_sentence") or ""))})
        if comparator(e) == "reference_undisturbed" or (ref and not created):
            if ref and created:
                continue  # "engineered structures or unaltered control": no side can be read
            side = "reference" if ref and not created else "created"
            if side == "created" and not (created or timed):
                continue
            vs_dir[e["id"]] = versus_reference(e, g.nodes, side, flip)
            comparisons[outcome].append(e)
        elif timed:
            time_dir[e["id"]] = claim_direction(e, g.nodes, flip_outcome=flip)
            trajectories[outcome].append(e)
        else:
            continue
        if years:
            time_points[e["id"]] = years

    subject = ("created_marsh", "Created or restored marsh vs natural reference")
    findings, gaps = [], []
    for oid in sorted(OUTCOME_LABELS):
        olabel = OUTCOME_LABELS[oid]
        if comparisons.get(oid):
            f = finding("q2", subject, (oid, olabel), comparisons[oid], vs_dir)
            f["direction_meaning"] = "created marsh relative to the natural reference"
            f["lags"] = f["direction"] == "below_reference"
            f["attribute_kind"] = "biodiversity" if oid in Q2_BIODIVERSITY else "function_or_abiotic"
            f["time_points"] = sorted({y for e in f["edge_ids"] for y in time_points.get(e, [])})
            findings.append(f)
        else:
            gaps.append(gap("q2", subject, (oid, olabel),
                            f"claims in marsh or constructed-wetland settings comparing a created or restored site "
                            f"with a natural reference on {olabel.lower()}"))
    with_time = []
    for oid, edges in sorted(trajectories.items()):
        f = finding("q2", ("time_since_creation", "Time since creation or restoration"), (oid, OUTCOME_LABELS[oid]),
                    edges, time_dir)
        f["direction_meaning"] = "change in the attribute as the created marsh ages"
        f["time_points"] = sorted({y for e in f["edge_ids"] for y in time_points.get(e, [])})
        with_time.append(f)
    lagging = [f["outcome"]["label"] for f in findings if f["lags"]]
    used = [e for es in comparisons.values() for e in es] + [e for es in trajectories.values() for e in es]
    directions = {**vs_dir, **time_dir}
    return {
        "id": Q2_ID, "question": Q2_TEXT, "rule": RULE,
        "how_built": ("Claims from marsh, prairie-pothole, salt-marsh and constructed-wetland papers (ecosystem "
                      "context plus a wetland word in the title). A claim is a comparison when its comparator is an "
                      "undisturbed reference or its cause names the natural or reference site; its direction is "
                      "turned into 'above_reference', 'comparable' or 'below_reference' for the created marsh. A "
                      "claim whose cause is site age or time since restoration is a trajectory. Outcomes are pooled "
                      "by outcome group."),
        "short_answer": {
            "time_to_reference": None,
            "time_to_reference_note": ("No study in this corpus reports how long a created marsh takes to match a "
                                       "reference. The few time points come from chronosequences of restored "
                                       "prairie wetlands and are listed with each finding."),
            "lagging_attributes": lagging,
        },
        "findings": findings,
        "with_time": with_time,
        "gaps": gaps,
        "limitations": [
            f"Thin evidence: {len({e['source_document'] for e in used})} papers in all, most of them observational.",
            "'Restored' and 'created' marshes are pooled; the corpus rarely says which, and drained-then-restored "
            "prairie potholes dominate.",
            "A reference comparison at one age says nothing about the trajectory; do not read a lag at 4-6 years "
            "as a lag at 20.",
            "Side reading is by keyword ('natural', 'reference' vs 'restored', 'reclaimed'): open the claims.",
        ],
        "evidence": g.evidence(used, directions),
    }


# ---------------------------------------------------------------------------
# Q3. Grassland evidence and gap map
# ---------------------------------------------------------------------------

Q3_ID = "q3-grassland-gaps"
Q3_TEXT = ("For grassland restoration in Canada, which intervention-outcome combinations have little or no evidence, "
           "and where is the graph densest?")
Q3_CONTEXTS = {"temperate_subhumid_grasslands", "derived_semi_natural_pastures_and_oldfields", "semi_desert_steppe",
               "sown_pastures_and_fields", "temperate_alpine_grasslands_and_shrublands",
               "coastal_shrublands_and_grasslands"}


def q3(g: Graph, interventions: list[tuple[str, str]], outcomes: list[tuple[str, str]]) -> dict:
    cells: dict[tuple[str, str], list[dict]] = defaultdict(list)
    directions, grassland, unpooled = {}, 0, Counter()
    for e in g.edges:
        if e.get("ecosystem_context") not in Q3_CONTEXTS:
            continue
        grassland += 1
        levers = g.groups.get(("intervention", e["subject"]))
        effect = g.groups.get(("outcome", e["object"]))
        if not levers:
            unpooled["cause is not an intervention group"] += 1
            continue
        if not effect:
            unpooled["effect is not an outcome group"] += 1
            continue
        flip = effect[0] == "survival_mortality" and bool(MORTALITY.search(g.text(e["object"])))
        directions[e["id"]] = claim_direction(e, g.nodes, flip_outcome=flip)
        for lever in levers:
            cells[(lever, effect[0])].append(e)

    findings, gaps = [], []
    for iid, ilabel in interventions:
        for oid, olabel in outcomes:
            edges = cells.get((iid, oid))
            if edges:
                f = finding("q3", (iid, ilabel), (oid, olabel), edges, directions)
                f["density"] = "thin" if f["studies"] == 1 else "some" if f["studies"] < 4 else "dense"
                findings.append(f)
            else:
                gaps.append(gap("q3", (iid, ilabel), (oid, olabel),
                                f"grassland claims whose cause is in '{ilabel}' and whose effect is in '{olabel}'"))
    densest = sorted(findings, key=lambda f: (-f["studies"], -f["claims"], f["id"]))[:10]
    used = {e["id"]: e for es in cells.values() for e in es}
    return {
        "id": Q3_ID, "question": Q3_TEXT, "rule": RULE,
        "how_built": ("Claims whose ecosystem context is a grassland, prairie, steppe or old-field type, pooled into "
                      "the 24 intervention groups x 16 outcome groups of groups/lane3_groups.yaml. A claim whose "
                      "cause is in two intervention groups counts in both. Density: thin = 1 study, some = 2-3, "
                      "dense = 4 or more."),
        "summary": {
            "grassland_claims": grassland,
            "claims_pooled": len(used),
            "claims_not_pooled": dict(unpooled),
            "cells": len(interventions) * len(outcomes),
            "filled": len(findings),
            "thin": sum(f["density"] == "thin" for f in findings),
            "empty": len(gaps),
            "densest": [f["id"] for f in densest],
        },
        "findings": findings,
        "gaps": gaps,
        "limitations": [
            "Grassland is read from each claim's ecosystem_context. A grassland paper whose claims were tagged "
            "otherwise is missed.",
            f"{sum(unpooled.values())} of {grassland} grassland claims fall outside the groups and are not in the map.",
            "An empty cell means no paper in this corpus tested that pairing. It is not a negative result.",
            "Study counts measure research effort, not effect size. A dense cell can still be mixed.",
        ],
        "evidence": g.evidence(list(used.values()), directions),
    }


# ---------------------------------------------------------------------------


def markdown(answers: list[dict]) -> str:
    out = ["# Lane 3 barebones answers", "",
           f"Built by `make_answers.py` (rule `{RULE}`). Every grade carries its rationale in the JSON.", ""]
    for a in answers:
        out += [f"## {a['question']}", "", f"*{a['how_built']}*", ""]
        if a.get("short_answer"):
            out += [f"**Time to reach reference:** {a['short_answer']['time_to_reference_note']}", "",
                    f"**Lagging attributes:** {', '.join(a['short_answer']['lagging_attributes']) or 'none found'}", ""]
        if a.get("summary"):
            s = a["summary"]
            out += [f"{s['filled']} of {s['cells']} cells have evidence ({s['thin']} from a single study); "
                    f"{s['empty']} are empty.", ""]
        rows = sorted(a["findings"], key=lambda f: (-f["studies"], f["id"]))
        out += ["| Subject | Outcome | Direction | Certainty | Studies | Claims |", "| --- | --- | --- | --- | --- | --- |"]
        out += [f"| {f['subject']['label']} | {f['outcome']['label']} | {f['direction']} | "
                f"{f['certainty'].replace('_', ' ')} | {f['studies']} | {f['claims']} |" for f in rows]
        for f in a.get("with_time", []):
            out.append(f"| {f['subject']['label']} | {f['outcome']['label']} | {f['direction']} | "
                       f"{f['certainty'].replace('_', ' ')} | {f['studies']} | {f['claims']} |")
        out += ["", f"**No evidence ({len(a['gaps'])}):** " +
                ("; ".join(f"{x['subject']['label']} x {x['outcome']['label']}" for x in a["gaps"][:40]) or "none") +
                (" ..." if len(a["gaps"]) > 40 else ""), ""]
        out += ["**Limits:**", ""] + [f"- {x}" for x in a["limitations"]] + [""]
    return "\n".join(out)


def graph_markdown(graph: dict) -> str:
    labels = {n["id"]: n["label"] for n in graph["nodes"]}
    out = ["## Q1 as a graph (`q1_tree_planting_graph.json`)", "", f"*{graph['how_built']}*", "",
           "Nodes: " + "; ".join(f"{n['label']} ({n['kind'].replace('_', ' ')})" for n in graph["nodes"]), "",
           "| From | To | Kind | Direction | Certainty | Studies |", "| --- | --- | --- | --- | --- | --- |"]
    for x in graph["edges"]:
        to = labels.get(x["target"]) if x["target"] else "effect of " + " -> ".join(
            labels[p] for p in x["target_edge"].split("->"))
        out.append(f"| {labels[x['source']]} | {to} | {x['kind']} | {x['direction']} | "
                   f"{x['certainty'].replace('_', ' ')} | {x['studies']} |")
    out += ["", "**Limits:**", ""] + [f"- {x}" for x in graph["limitations"]] + [""]
    return "\n".join(out)


def main() -> None:
    g = Graph()
    groups = yaml.safe_load((PACK / "groups" / "lane3_groups.yaml").read_text(encoding="utf-8"))
    interventions = [(x["id"], x["label"]) for x in groups["intervention_groups"]]
    outcomes = [(x["id"], x["label"]) for x in groups["outcome_groups"]]
    OUTCOME_LABELS.update(outcomes)
    answers = [q1(g), q2(g), q3(g, interventions, outcomes)]
    graph = q1_graph(g, answers[0])
    OUT.mkdir(exist_ok=True)
    for a, name in zip(answers, ("q1_tree_planting", "q2_created_marshes", "q3_grassland_gaps")):
        (OUT / f"{name}.json").write_text(json.dumps(a, indent=1, ensure_ascii=False), encoding="utf-8")
        print(f"{name}: {len(a['findings'])} findings, {len(a['gaps'])} gaps, {len(a['evidence'])} claims")
    (OUT / "q1_tree_planting_graph.json").write_text(json.dumps(graph, indent=1, ensure_ascii=False), encoding="utf-8")
    kinds = Counter(x["kind"] for x in graph["edges"])
    print(f"q1_tree_planting_graph: {len(graph['nodes'])} nodes, {dict(kinds)} edges, {len(graph['gaps'])} gaps")
    (OUT / "answers.md").write_text(markdown(answers) + graph_markdown(graph), encoding="utf-8")
    manifest = {
        "title": "Evidence Jam 2026 — Lane 3",
        "built_by": "make_answers.py",
        "rule": RULE,
        "source_graph": "graph/causal_graph.yaml",
        "schema": "graph/causalmosaic.yaml (CAMO 0.10.0)",
        "groups": "groups/lane3_groups.yaml",
        "graph": {"claims": len(g.edges), "nodes": len(g.nodes), "source_documents": len(g.docs)},
        "answers": {a["id"]: {"file": f"answers/{name}.json", "findings": len(a["findings"]) + len(a.get("with_time", [])),
                              "gaps": len(a["gaps"]), "claims": len(a["evidence"]),
                              "papers": len({v["document_id"] for v in a["evidence"].values()}),
                              "certainty": dict(sorted(Counter(f["certainty"] for f in a["findings"]).items()))}
                    for a, name in zip(answers, ("q1_tree_planting", "q2_created_marshes", "q3_grassland_gaps"))},
        "graph_answers": {graph["id"]: {"file": "answers/q1_tree_planting_graph.json", "nodes": len(graph["nodes"]),
                                        "edges": dict(sorted(kinds.items())), "gaps": len(graph["gaps"]),
                                        "claims": len(graph["evidence"]),
                                        "papers": len({v["document_id"] for v in graph["evidence"].values()})}},
    }
    (PACK / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
