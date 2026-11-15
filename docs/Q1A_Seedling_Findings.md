# Q1 Prototype, Panel A: Findings

> An interactive, evidence-linked map of what the literature says about which tree-planting factors affect seedling **survival** and **growth**, how strongly, and where the research gaps remain.

| | |
|---|---|
| **Question** | Q1: For tree planting in Canadian forest restoration, how do planting-stock traits (seedling size, nursery fertilization, mycorrhizal inoculation) affect survival and growth, and how do competing vegetation and site preparation change that? |
| **Panel** | A, "Findings" |
| **Data source** | `answers/q1_tree_planting.json` |
| **Audience** | Forestry industry practitioners and researchers |

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [Getting Started: the "Want Help?" Tour](#2-getting-started-the-want-help-tour)
3. [Design Philosophy: Breadth First, Then Depth](#3-design-philosophy-breadth-first-then-depth)
4. [Page Structure](#4-page-structure)
5. [The Graph](#5-the-graph)
6. [Symbols and Legends](#6-symbols-and-legends)
7. [Key Features](#7-key-features)
8. [Matrix View](#8-matrix-view)
9. [Future Expansions](#9-future-expansions)

---

## 1. Motivation

### 1.1 Why we chose this data representation

The Panel A data links many tree-planting factors to two outcomes, seedling survival and seedling growth. A flow chart (a node-and-edge graph) is the natural fit because it shows **which factors influence which outcomes**, and how strongly the literature supports each link. The design goals were:

- **Pathway highlighting:** users can trace any factor to its outcomes with a click.
- **Evidence on demand:** the supporting literature is one interaction away.
- **Directional clarity:** the direction of each impact is visible at a glance.
- **Honest certainty:** users can distinguish techniques that are proven to work, and at what level of certainty, from those that need more study.

### 1.2 Value to industry

Industry practitioners can immediately see which techniques are supported by strong evidence and therefore carry a higher likelihood of success. This shortens the research phase when selecting best management practices for a given area or project.

### 1.3 Value to research

Researchers can see precisely where the evidence is thin. A claim with low certainty signals that its true impact is not yet established, and an explicitly marked gap signals that no study has tested the pairing at all. Both point directly to productive research opportunities.

---

## 2. Getting Started: the "Want Help?" Tour

First-time visitors face a dense interface: a graph, filters, a matrix and a detail drawer. To make the page approachable, it includes a **Want Help?** button, an interactive, guided walkthrough that introduces each part of the page in the order a new user needs it.

**What it provides.** Selecting **Want Help?** launches a step-by-step overlay. Each step dims the rest of the page, spotlights one interface element, and explains in plain language what it is and how to use it. Users can advance with *Next*, return with *Back*, or leave at any time with *Skip* (or `Esc`). The tour can be relaunched at any point.

| Step | Tour stop | What the user learns |
|:---:|---|---|
| 1 | **How to read the graph** | Factors sit in the left lane and outcomes (seedling survival and growth) in the right lane. Each edge carries a chip with a direction glyph and certainty dots, and a dashed "No evidence" link marks a gap rather than a negative result. |
| 2 | **The findings** | Clicking a factor highlights every edge to and from it. Clicking an edge highlights the two nodes it joins and shows that finding's overall direction and certainty. |
| 3 | **Details, claims and quotes** | The right-hand drawer gives the verdict, the reason for its certainty level, and a study-direction bar, then lists the supporting papers ranked by grade. Each paper expands to show its claims and quotes, so users can verify the evidence independently. |
| 4 | **Views and the status line** | The **Graph / Matrix** toggle switches between the network and the tabular view of the same data. The status line in the toolbar reports what is currently shown, e.g. "Showing 9 of 13 findings", and updates as filters change. |
| 5 | **Search and filter** | One search box covers nodes, findings, claims, quotes and paper titles (press `/` to focus, `Esc` to clear). Filter chips narrow by direction, minimum certainty and whether gaps are shown, applying to the graph and matrix together. |
| 6 | **Limitations and export** | How to interpret the data responsibly: the view reflects only the studies in this corpus, a gap means untested rather than ineffective, and certainty levels indicate how settled a finding is. Also how to export the current view for use outside the site. |

---

## 3. Design Philosophy: Breadth First, Then Depth

The panel is a **ladder**. The reader starts with the whole picture, descends one step at a time, and can always climb back up. Each rung is exactly one click from the next.

| Level | Where it lives | What the user sees |
|---|---|---|
| **Breadth** | Filters at the top; visualization below | The complete overview of the data is the **default**. Filters narrow it. |
| **Depth** | Right-hand drawer, opened by clicking any factor or edge | The sources and claims behind the selection. The **background colour of the sources section reflects the majority sentiment** of those claims, so the weight of evidence is visible before a single quote is read. |

No one is dropped into detail without context, and no detail is ever more than one click away.

---

## 4. Page Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOOLBAR   Search · Filter chips · Graph|Matrix · Want Help?           │
│            "Showing 9 of 13 findings"                                  │
├───────────────────────────────────────────────┬──────────────────────┤
│                                               │  DETAIL DRAWER       │
│   VISUALIZATION                               │                      │
│   Factors  ──►  Outcomes   (or Matrix)        │  Selected factor or  │
│                                               │  relationship:       │
│                                               │  summary, certainty, │
│                                               │  sources, claims     │
├───────────────────────────────────────────────┴──────────────────────┤
│  LEGEND   Direction · Colour · Certainty · Gap                         │
└──────────────────────────────────────────────────────────────────────┘
```

| Region | Purpose |
|---|---|
| **Toolbar** | Controls breadth: search, filters, view toggle and tutorial launcher, plus live counts. |
| **Visualization** | The default overview, shown as the lane-based graph or the matrix. |
| **Detail drawer** | Controls depth. Slides out on the right when a factor, edge or search result is selected, showing the verdict, certainty rationale, study breakdown and expandable claims by paper (see [Section 7.2](#72-the-detail-drawer)). |
| **Legend** | Always-available decoder for symbols and colours (see [Section 6](#6-symbols-and-legends)). |

---

## 5. The Graph

### 5.1 Structure

Panel A is a **bipartite graph** of **13 edges plus one documented gap**, arranged left to right in two lanes:

| Lane 1: Factor | Lane 2: Outcome |
|---|---|
| The subjects of each finding or gap, in **first-seen order** from the JSON | Seedling **survival** and seedling **growth** |

Lane titles use the `node_kinds` text as a subtitle.

### 5.2 Layout rules

- The layout is **computed from the JSON**. Coordinates for named nodes are never hard-coded.
- The layout is **deterministic**: identical input always produces an identical picture. No force-directed layout is used.
- Nodes within a lane are ordered to reduce crossings using 2 to 4 passes of the **barycenter heuristic**. Ties break by first-seen order in the JSON.
- Edges are smooth **cubic Bézier curves**.
- The SVG declares a `viewBox` and scales responsively to its container.
- Pan and zoom are optional. If added, a **Reset view** button and full keyboard access are required.

---

## 6. Symbols and Legends

Each edge carries an **always-visible chip** at its midpoint, combining a direction glyph with certainty dots:

```
 ┌───────────┐
 │ ↑  ●●●●   │    direction glyph + certainty dots
 └───────────┘
```

### 6.1 Direction

| Glyph | Meaning | Colour |
|:---:|---|---|
| ↑ | **Increase** | 🟩 Green |
| ↓ | **Decrease** | 🟥 Red |
| ↕ | **Mixed** | 🟨 Amber |
| = | **No effect** | ⬜ Grey |
| ? | **Unclear** | ⬜ Grey |

### 6.2 Certainty (GRADE-style, filled dots out of four)

| Level | Dots | Interpretation |
|---|:---:|---|
| **High** | ●●●● | Further research is unlikely to change the conclusion. |
| **Moderate** | ●●●○ | Further research may change the conclusion. |
| **Low** | ●●○○ | Further research is likely to change the conclusion. |
| **Very low** | ●○○○ | The conclusion is very uncertain; more research is needed. |

### 6.3 Gaps

| Visual | Meaning |
|---|---|
| **Dashed, hollow link** (no arrowhead, light stroke) labelled **"No evidence"** | *No study in this corpus tested this pairing.* This is a **gap**, not a negative result. |

---

## 7. Key Features

### 7.1 Interaction

| Action | Result |
|---|---|
| **Click a factor** | All arrows to and from the factor are highlighted. The drawer opens with that factor's relationships across the corpus, each with its glyph and certainty. |
| **Click a relationship** | The two affected nodes are highlighted. The drawer summarises the **overall direction, number of studies and claims, certainty, and sentiment of claims**, followed by **every individual claim** so users can validate the information independently. |

### 7.2 The Detail Drawer

The drawer is the **depth** half of the ladder. It slides in on the right when a factor, edge or search result is selected, and it is designed to answer three questions in order: *what is the verdict, how much should I trust it, and where does it come from?* The example below is the relationship **Competing vegetation (more of it) → Seedling survival**.

```
┌──────────────────────────────────────────┐
│ Competing vegetation (more of it)    [✕] │  ① Title
│ → Seedling survival                      │
│                                          │
│ ↓ Decrease · ●●●● High certainty         │  ② Verdict
│ start high (best design in the body of   │  ③ Certainty rationale
│ evidence); +1 3 studies agree -> high    │
│                                          │
│ 3 studies · 4 claims                     │  ④ Evidence counts
│ Study directions                         │
│ [██████████████ ↓3 ██████████████]       │  ⑤ Direction bar
│ Decrease 3                               │
│                                          │
│ From Competing vegetation → Seedling     │  ⑥ Linked endpoints
│ survival                                 │
│                                          │
│ Claims by paper (3 papers)               │  ⑦ Evidence list
│ Ranked by claim grade, highest first.    │
│ ┌──────────────────────────────────────┐ │
│ │ Paper title (year)                 ⌄ │ │
│ │ ●●●○ Moderate · 2 claims             │ │
│ │ ↓ Decrease 2                         │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

| # | Element | Purpose |
|:---:|---|---|
| ① | **Title and close button** | Names the selected relationship (*factor → outcome*). The **✕** closes the drawer and returns the user to the full overview. |
| ② | **Verdict line** | The headline answer: overall direction glyph and word, followed by the certainty dots and level (e.g. *↓ Decrease · ●●●● High certainty*), coloured with the same scheme as the graph. |
| ③ | **Certainty rationale** | A one-line, plain-language explanation of *why* the certainty level was assigned, following the GRADE-style logic of a starting level plus adjustments (e.g. *"start high (best design in the body of evidence); +1 3 studies agree -> high"*). It makes the rating auditable rather than a black box. |
| ④ | **Evidence counts** | The number of independent studies and individual claims behind the relationship, so users can tell a well-replicated finding from a single study at a glance. |
| ⑤ | **Study directions bar** | A stacked bar showing how the studies split by direction (increase, decrease, mixed, no effect). A single-colour bar means the studies agree; a multi-colour bar signals disagreement. |
| ⑥ | **Linked endpoints** | The source factor and the target outcome appear as links. Selecting either one jumps to that node's own relationships, allowing movement through the graph without returning to the canvas. |
| ⑦ | **Claims by paper** | The supporting literature, grouped by paper and **ranked by claim grade, highest first**, so the strongest evidence is read first. |

**Paper cards.** Each paper in the evidence list shows:

- the **title and publication year**;
- the **grade** of that paper's claims (certainty dots and level) and the **number of claims** it contributes;
- a **direction tally** (e.g. *↓ Decrease 2*);
- a **tinted background** that reflects the direction of its claims, so the balance of evidence can be read by colour before any text (for example, a uniformly red-tinted list indicates that every paper reports a decrease);
- an **expand control (⌄)** that reveals the individual claims and their supporting quotes, so users can verify each statement against the source themselves.

**Companion status chip.** While a relationship is selected, the toolbar shows a summary chip with the same key facts (*direction · certainty · studies · claims*) and a **Clear** button, so the selection remains visible and easy to dismiss even when the drawer is closed.

### 7.3 Filters

Filter chips: **direction** (multi-select), **minimum certainty**, and **show gaps**.

Filters are **linked views**: they apply simultaneously to the graph, the matrix and the tables, and the toolbar counts update accordingly (e.g. *"Showing 9 of 13 findings"*).

### 7.4 Search

One search box, case-insensitive, matching:

- node labels and edge endpoints
- claim subjects and objects
- quote text
- paper titles

Results are **grouped** with counts: **Nodes · Findings · Papers · Claims**. Matching edges stay bright in the graph while the rest fade. Choosing a result **pins it in the drawer**.

| Key | Action |
|:---:|---|
| `/` | Focus the search box |
| `Esc` | Clear the search |

---

## 8. Matrix View

A **Graph | Matrix** switch offers a structured, tabular representation of the same findings, which is easiest to scan when comparing many factors at once.

- **Rows** are factors.
- **Columns** are the two outcomes: **Seedling growth** and **Seedling survival**.
- Each cell represents one edge and uses the **same glyph and certainty dots** as the graph.

| Cell state | Appearance | Meaning |
|---|---|---|
| **Edge** | Glyph + certainty dots | A relationship supported by the corpus. |
| **Listed gap** | Hatched cell reading *"No evidence"* | No study tested this pairing. A gap, not a negative result. |
| **Empty** | Blank; tooltip *"No claims in this corpus link these two"* | No edge and no listed gap. Never interpreted as a negative result. |

Example layout:

| Factor | Seedling growth | Seedling survival |
|---|:---:|:---:|
| *Factor 1* | ↑ ●●●○ | ↑ ●●○○ |
| *Factor 2* | ↕ ●●○○ | `No evidence` |
| *Factor 3* | | = ●○○○ |

---

## 9. Future Expansions

| Proposed feature | Benefit |
|---|---|
| **Geographic data** showing where each study took place across Canada | Lets practitioners see what works in *their* region, and reveals regional research gaps that can guide future studies. |
| **Seedling type** recorded for each study | Lets users judge how findings apply to the specific seedlings used in their project. |

---

<sub>Q1 Prototype · Panel A: Findings · Data source: `answers/q1_tree_planting.json`</sub>
</EOF
