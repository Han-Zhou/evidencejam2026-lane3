# Q1 Prototype, Panel B: Network

> An interactive, evidence-linked map of **how** tree-planting practices affect seedling survival and growth, including the **site conditions** that sit between a practice and its outcome.

| | |
|---|---|
| **Question** | Q1: For tree planting in Canadian forest restoration, how do planting-stock traits (seedling size, nursery fertilization, mycorrhizal inoculation) affect survival and growth, and how do competing vegetation and site preparation change that? |
| **Panel** | B, "Network" |
| **Data source** | `answers/q1_tree_planting_graph.json` |
| **Audience** | Forestry industry practitioners and researchers |
| **Companion panel** | Panel A, "Findings" (see `README.md`) |

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [How Panel B Differs from Panel A: Conditions](#2-how-panel-b-differs-from-panel-a-conditions)
3. [Getting Started: the "Want Help?" Tour](#3-getting-started-the-want-help-tour)
4. [Design Philosophy: Breadth First, Then Depth](#4-design-philosophy-breadth-first-then-depth)
5. [Page Structure](#5-page-structure)
6. [The Graph](#6-the-graph)
7. [Symbols and Legends](#7-symbols-and-legends)
8. [Key Features](#8-key-features)
9. [Matrix View](#9-matrix-view)
10. [Future Expansions](#10-future-expansions)

---

## 1. Motivation

### 1.1 Why we chose this data representation

The data behind Panel B contains many connections between variables. A flow chart (a node-and-edge graph) is the natural fit because it shows **which factors affect each other and how they interact**, not only what they do to the final outcomes. The design goals were:

- **Pathway highlighting:** users can trace routes between variables with a click.
- **Evidence on demand:** the supporting literature is one interaction away.
- **Directional clarity:** the direction of each impact is visible at a glance.
- **Honest certainty:** users can distinguish techniques that are proven to work, and at what level of certainty, from those that need more study.

### 1.2 Value to industry

Industry practitioners can immediately see which techniques are supported by strong evidence and therefore carry a higher likelihood of success. This shortens the research phase when selecting best management practices for a given area or project.

### 1.3 Value to research

Researchers can see precisely where the evidence is thin. A claim with low certainty signals that its true impact is not yet established, and an explicitly marked gap signals that no study has tested the pairing at all. Both point directly to productive research opportunities.

---

## 2. How Panel B Differs from Panel A: Conditions

Panel A answers a direct question: *does this factor change seedling survival or growth?* Panel B asks the follow-up that practitioners actually face: ***why*, and *under what circumstances*?**

The key addition is a new layer of nodes, **Conditions**: the environmental and site circumstances (for example, competing vegetation or seedling nutrients) that sit between a planting practice and its outcome. A practice rarely acts on survival directly. It changes a condition, and the condition then affects the seedling.

| | **Panel A: Findings** | **Panel B: Network** |
|---|---|---|
| **Question answered** | Does factor X affect survival or growth? | Through what conditions, and in combination with what, does X affect survival or growth? |
| **Data file** | `q1_tree_planting.json` | `q1_tree_planting_graph.json` |
| **Node layers** | 2: Factor → Outcome | 3: Planting stock and Site treatments → **Conditions** → Outcomes |
| **Lanes** | 2 | 3 |
| **Graph type** | Bipartite (13 edges plus one gap) | Layered network with direct, mediated and same-lane edges |
| **Relationship types** | Direct findings only | Direct, **via conditions**, and **interactions** (combination and moderation) |
| **Lenses** | Not needed | All, Direct, Via conditions, Interactions |
| **Same-lane edges** | None | Yes, e.g. `competing_vegetation` → `seedling_nutrients` |
| **Typical use** | Quick answer on what works | Understanding mechanisms and context |

### 2.1 Why conditions matter

- **They explain mechanisms.** A treatment that improves survival may do so by reducing competing vegetation. Panel A shows the result; Panel B shows the route.
- **They reveal context-dependence.** A practice may work under one condition and fail under another. Conditions make that visible instead of averaging it away.
- **They expose conditions that act on each other.** Some conditions influence other conditions (competing vegetation affecting seedling nutrients, for instance). These same-lane relationships only exist in a network that models conditions explicitly.
- **They locate deeper research gaps.** A direct effect may be well studied while the mechanism behind it is not. Gaps and low-certainty edges around condition nodes point to exactly that.
- **They support combinations.** A **combination node** represents treatments applied together, so interactions can be examined alongside single treatments.

### 2.2 Reading a path through the network

```
 LANE 1                         LANE 2                      LANE 3
 Planting stock &               Conditions                  Outcomes
 Site treatments

 [ Treatment ] ───────────────► [ Condition ] ────────────► [ Survival ]
        │                                                        ▲
        └────────────── direct effect ───────────────────────────┘
```

The same treatment can reach an outcome **directly** (an edge skipping lane 2) and **via a condition** (two edges through lane 2). Seeing both routes side by side, each with its own certainty, is the main benefit of Panel B.

---

## 3. Getting Started: the "Want Help?" Tour

First-time visitors face a dense interface: a three-lane graph, lenses, filters, a matrix and a detail drawer. To make the page approachable, it includes a **Want Help?** button, an interactive, guided walkthrough that introduces each part of the page in the order a new user needs it.

**What it provides.** Selecting **Want Help?** launches a step-by-step overlay. Each step dims the rest of the page, spotlights one interface element, and explains in plain language what it is and how to use it. Users can advance with *Next*, return with *Back*, or leave at any time with *Skip* (or `Esc`). The tour can be relaunched at any point.

| Step | Tour stop | What the user learns |
|:---:|---|---|
| 1 | **Search, lenses and filters** | The toolbar controls breadth. One search box covers nodes, edges, claims, quotes and paper titles (press `/` to focus, `Esc` to clear). The **lenses** (All, Direct, Via conditions, Interactions) focus on one type of relationship, and the filter chips narrow by direction, minimum certainty and whether gaps are shown. The status line, e.g. "Showing 9 of 29 edges", updates as these change. |
| 2 | **Edges: shown when you select** | Edges that are not selected appear faded. Clicking a node or an edge brings its connections to full strength, and the **Show all edges** option can be switched off so that only the edges of the current selection are displayed, keeping a dense network readable. |
| 3 | **How to read this graph** | The legend explains direction glyphs and colours, certainty dots, and the dashed "No evidence" link that marks a gap rather than a negative result. Each edge carries a chip combining glyph and dots. |
| 4 | **Conditions in the middle** | Lane 2 holds the **conditions** that sit between planting stock and site treatments (lane 1) and the outcomes (lane 3). The tour shows how a practice can reach an outcome directly, or via a condition, and how conditions can influence one another. |
| 5 | **Moderation and combinations** | The **Interactions** lens highlights moderation effects and the **combination node**, which represents treatments applied together. Users learn to compare combined effects with the effects of single treatments. |
| 6 | **Claims and quotes** | The right-hand drawer gives the verdict, the reason for its certainty level, and a study-direction bar, then lists the supporting papers ranked by grade. Each paper expands to show its claims and quotes, so users can verify the evidence independently. |
| 7 | **Export and limitations** | How to export the current view for use outside the site, and how to interpret the data responsibly: the view reflects only the studies in this corpus, a gap means untested rather than ineffective, and certainty levels indicate how settled a finding is. |

---

## 4. Design Philosophy: Breadth First, Then Depth

The panel is a **ladder**. The reader starts with the whole picture, descends one step at a time, and can always climb back up. Each rung is exactly one click from the next.

| Level | Where it lives | What the user sees |
|---|---|---|
| **Breadth** | Lenses and filters at the top; visualization below | The complete overview of the data is the **default**. Lenses and filters narrow it. |
| **Depth** | Right-hand drawer, opened by clicking any node or edge | The sources and claims behind the selection. The **background colour of the sources section reflects the majority sentiment** of those claims, so the weight of evidence is visible before a single quote is read. |

No one is dropped into detail without context, and no detail is ever more than one click away.

---

## 5. Page Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│  TOOLBAR  Search · Lenses · Filter chips · Graph|Matrix · Want Help?     │
│           "Showing 9 of 29 edges"                                        │
├────────────────────────────────────────────────┬───────────────────────┤
│                                                │  DETAIL DRAWER        │
│   VISUALIZATION                                │                       │
│   Stock & Treatments ► Conditions ► Outcomes   │  Selected node or     │
│              (or Matrix)                       │  relationship:        │
│                                                │  summary, certainty,  │
│                                                │  sources, claims      │
├────────────────────────────────────────────────┴───────────────────────┤
│  LEGEND   Direction · Colour · Certainty · Gap                           │
└────────────────────────────────────────────────────────────────────────┘
```

| Region | Purpose |
|---|---|
| **Toolbar** | Controls breadth: search, lenses, filters, view toggle and tutorial launcher, plus live counts. |
| **Visualization** | The default overview, shown as the three-lane graph or the matrix. |
| **Detail drawer** | Controls depth. Slides out on the right when a node, edge or search result is selected, showing the verdict, certainty rationale, study breakdown and expandable claims by paper (see [Section 8.2](#82-the-detail-drawer)). |
| **Legend** | Always-available decoder for symbols and colours (see [Section 7](#7-symbols-and-legends)). |

---

## 6. The Graph

### 6.1 Layout: lanes, deterministic

- **Layered, left to right**, organised in lanes by role.
- The layout is **computed from the JSON**. Coordinates for named nodes are never hard-coded.
- The layout is **deterministic**: identical input always produces an identical picture. No force-directed layout is used.

| Lane 1 | Lane 2 | Lane 3 |
|---|---|---|
| **Planting stock** and **Site treatments**: two labelled groups stacked; the **combination node** sits in this lane beneath the site treatments | **Conditions**: the intermediate site and seedling circumstances | **Outcomes**: seedling survival and growth |

Lane titles use the `node_kinds` text as a subtitle.

### 6.2 Ordering and edges

- **Crossing reduction:** nodes within a lane are ordered using 2 to 4 passes of the **barycenter heuristic**. Ties break by first-seen order in the JSON, which preserves determinism.
- **Smooth curves:** edges are cubic Bézier curves.
- **Lane-skipping edges** (lane 1 to lane 3, the direct effects) curve *around* the lane-2 condition nodes, never through their labels.
- **Same-lane edges** (e.g. `competing_vegetation` → `seedling_nutrients`, relationships between conditions) are drawn as an **arc on the lane's right side**.

### 6.3 Rendering

- The SVG declares a `viewBox` and scales responsively to its container.
- Pan and zoom are optional. If added, a **Reset view** button and full keyboard access are required.

---

## 7. Symbols and Legends

Each edge carries an **always-visible chip** at its midpoint, combining a direction glyph with certainty dots:

```
 ┌───────────┐
 │ ↑  ●●●●   │    direction glyph + certainty dots
 └───────────┘
```

### 7.1 Direction

| Glyph | Meaning | Colour |
|:---:|---|---|
| ↑ | **Increase** | 🟩 Green |
| ↓ | **Decrease** | 🟥 Red |
| ↕ | **Mixed** | 🟨 Amber |
| = | **No effect** | ⬜ Grey |
| ? | **Unclear** | ⬜ Grey |

### 7.2 Certainty (GRADE-style, filled dots out of four)

| Level | Dots | Interpretation |
|---|:---:|---|
| **High** | ●●●● | Further research is unlikely to change the conclusion. |
| **Moderate** | ●●●○ | Further research may change the conclusion. |
| **Low** | ●●○○ | Further research is likely to change the conclusion. |
| **Very low** | ●○○○ | The conclusion is very uncertain; more research is needed. |

### 7.3 Gaps

| Visual | Meaning |
|---|---|
| **Dashed, hollow link** (no arrowhead, light stroke) labelled **"No evidence"** | *No study in this corpus tested this pairing.* This is a **gap**, not a negative result. |

---

## 8. Key Features

### 8.1 Interaction

| Action | Result |
|---|---|
| **Click a node** | All arrows to and from the node are highlighted. The drawer opens with that node's relationships across the corpus, each with its glyph and certainty. For a condition node, this shows both what influences it and what it influences. |
| **Click a relationship** | The two affected nodes are highlighted. The drawer summarises the **overall direction, number of studies and claims, certainty, and sentiment of claims**, followed by **every individual claim** so users can validate the information independently. |

### 8.2 The Detail Drawer

The drawer is the **depth** half of the ladder. It answers three questions in order: *what is the verdict, how much should I trust it, and where does it come from?*

| # | Element | Purpose |
|:---:|---|---|
| ① | **Title and close button** | Names the selected relationship (*source → target*). The **✕** closes the drawer and returns the user to the full overview. |
| ② | **Verdict line** | Overall direction glyph and word with certainty dots and level (e.g. *↓ Decrease · ●●●● High certainty*), coloured as in the graph. |
| ③ | **Certainty rationale** | A one-line, plain-language explanation of *why* the certainty level was assigned, following GRADE-style logic of a starting level plus adjustments. It makes the rating auditable. |
| ④ | **Evidence counts** | The number of independent studies and individual claims behind the relationship. |
| ⑤ | **Study directions bar** | A stacked bar showing how studies split by direction. A single-colour bar indicates agreement; multiple colours signal disagreement. |
| ⑥ | **Linked endpoints** | The source and target appear as links. Selecting either jumps to that node's own relationships, so users can follow a pathway through conditions without returning to the canvas. |
| ⑦ | **Claims by paper** | The supporting literature grouped by paper and **ranked by claim grade, highest first**. Each card shows title and year, grade and claim count, a direction tally, and a background tinted by the majority direction. An expand control reveals the individual claims and quotes. |

### 8.3 Lenses

Lenses focus the graph on one class of relationship. In Panel B they matter most, because the network mixes direct, mediated and interacting effects. A lens **fades** edges outside it; it **never deletes** them.

| Lens | Shows | Question it answers |
|---|---|---|
| **All** *(default)* | Every relationship. | What does the whole network look like? |
| **Direct** | Relationships into outcomes from stock and treatments, as in the Q1 findings. | Does this practice affect survival or growth, regardless of mechanism? *(Equivalent to Panel A.)* |
| **Via conditions** | Relationships into and out of condition nodes. | Through which conditions does a practice act, and what do conditions affect? |
| **Interactions** | Combination and moderation effects. | Do treatments behave differently together, or depending on another factor? |

### 8.4 Filters

Filter chips: **direction** (multi-select), **minimum certainty**, and **show gaps**.

Filters are **linked views**: they apply simultaneously to the graph, the matrix and the tables, and the toolbar counts update accordingly (e.g. *"Showing 9 of 29 edges"*).

### 8.5 Search

One search box for the panel, case-insensitive, matching:

- node labels and edge endpoints
- claim subjects and objects
- quote text
- paper titles

Results are **grouped** with counts: **Nodes · Edges/Findings · Papers · Claims**. Matching edges stay bright in the graph while the rest fade. Choosing a result **pins it in the drawer**.

| Key | Action |
|:---:|---|
| `/` | Focus the search box |
| `Esc` | Clear the search |

---

## 9. Matrix View

A **Graph | Matrix** switch offers a structured, tabular representation of the same relationships. The matrix is the **scalable view for dense graphs**, which is valuable in Panel B where many edges converge on the condition and outcome nodes.

- **Rows** are sources.
- **Columns** are targets, covering conditions and the outcomes **Seedling growth** and **Seedling survival**.
- Each cell represents one edge and uses the **same glyph and certainty dots** as the graph.

| Cell state | Appearance | Meaning |
|---|---|---|
| **Edge** | Glyph + certainty dots | A relationship supported by the corpus. |
| **Listed gap** | Hatched cell reading *"No evidence"* | No study tested this pairing. A gap, not a negative result. |
| **Empty** | Blank; tooltip *"No claims in this corpus link these two"* | No edge and no listed gap. Never interpreted as a negative result. |

Example layout:

| Source | *Condition A* | *Condition B* | Seedling growth | Seedling survival |
|---|:---:|:---:|:---:|:---:|
| *Treatment 1* | ↓ ●●●○ | | ↑ ●●○○ | ↑ ●●●○ |
| *Treatment 2* | `No evidence` | ↑ ●●○○ | | ↕ ●●○○ |
| *Condition A* | | ↓ ●○○○ | | ↓ ●●●● |

---

## 10. Future Expansions

| Proposed feature | Benefit |
|---|---|
| **Geographic data** showing where each study took place across Canada | Lets practitioners see what works in *their* region, and reveals regional research gaps that can guide future studies. |
| **Seedling type** recorded for each study | Lets users judge how findings apply to the specific seedlings used in their project. |

---
