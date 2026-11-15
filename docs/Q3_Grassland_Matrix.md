# Q3 Prototype: Grassland Research Gaps

> An interactive heat map of grassland restoration in Canada, showing which intervention-outcome combinations have little or no evidence, and where the research is densest.

| | |
|---|---|
| **Question** | Q3: For grassland restoration in Canada, which intervention-outcome combinations have little or no evidence, and where is the graph densest? |
| **Data source** | `answers/q3_grassland_gaps.json` |
| **Primary view** | Intervention-outcome heat map |
| **Accent colour** | Electric indigo |
| **Audience** | Land managers, industry practitioners and researchers |

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [Getting Started: the "Want Help?" Tour](#2-getting-started-the-want-help-tour)
3. [Design Philosophy: Breadth First, Then Depth](#3-design-philosophy-breadth-first-then-depth)
4. [Page Structure](#4-page-structure)
5. [Reading the Heat Map](#5-reading-the-heat-map)
6. [Colour, Symbols and Legends](#6-colour-symbols-and-legends)
7. [Key Features](#7-key-features)
8. [Filtering, Sorting and Tidying the Heat Map](#8-filtering-sorting-and-tidying-the-heat-map)
9. [Room for Growth](#9-room-for-growth)

---

## 1. Motivation

### 1.1 The question this page answers

> **For grassland restoration in Canada, which intervention-outcome combinations have little or no evidence, and where is the graph densest?**

The question has two halves, and each maps directly onto what the heat map shows:

| Part of the question | How the heat map answers it |
|---|---|
| **"Little or no evidence"** | **Unshaded cells** mark pairings that no study in this corpus tested. **Light indigo cells** mark pairings with only a few studies. Together they are the gaps. |
| **"Where is the graph densest?"** | **Deep indigo cells** mark pairings with many studies. Sorting by **density** or **most studies** gathers these into one region at the top of the map. |

### 1.2 Why we chose this data representation

We chose a **heat map** because the central question is which intervention-outcome pairings have received the most research and which the least. A heat map places every intervention against every outcome, so heavily studied pairings appear as deep colour and unstudied pairings stand out as empty space.

Filters are built in so that users can concentrate on what matters to them:

- **Surface the strongest evidence:** sort so that the pairings with the highest number of studies sit at the top of the heat map.
- **Hide the empty relationships:** remove rows and columns with no studies so the view focuses on what has been tested.
- **Keep the gaps findable:** switch the empty-row and column filter off to see exactly what has never been studied.

### 1.3 Value to industry

This view shows which intervention-outcome pairings have been tested the most, and therefore which interventions have the strongest evidence of working. Industry workers can identify proven options quickly, which makes the research process faster when choosing practices for a given area or project.

### 1.4 Value to research

This view makes every gap in the research visible at once. Pairings with little or no evidence mark clear opportunities, so the heat map can guide where future studies are most needed.

---

## 2. Getting Started: the "Want Help?" Tour

First-time visitors face a dense grid, several controls and a detail drawer. To make the page approachable, it includes a **Want Help?** button, an interactive, guided walkthrough that introduces each part of the page in the order a new user needs it.

**What it provides.** Selecting **Want Help?** launches a step-by-step overlay. Each step dims the rest of the page, spotlights one interface element, and explains in plain language what it is and how to use it. Users can advance with *Next*, return with *Back*, or leave at any time with *Skip* (or `Esc`). The tour can be relaunched at any point.

| Step | Tour stop | What the user learns |
|:---:|---|---|
| 1 | **What this map shows** | The purpose of the heat map: it displays how much research exists for each intervention-outcome pairing, so users can see at a glance where evidence is strong, thin or missing. |
| 2 | **Read the colours** | Electric indigo marks studied pairings, with deeper shades indicating more research. An **unshaded** cell means no study in this corpus tested that pairing: a gap, not a negative result. |
| 3 | **Rows, columns and cells** | Rows are interventions and columns are outcomes. Each cell is one intervention-outcome pairing. |
| 4 | **Sort and filter** | Filter by rows and columns, sort by density, alphabetical order or most studies, and remove empty rows and columns to focus on what has been studied. |
| 5 | **Select a cell** | Clicking a cell highlights its intervention and outcome and opens the detail drawer. Clicking a row or column label highlights all of its cells. |
| 6 | **Details, claims and quotes** | The right-hand drawer gives the verdict, the reason for its certainty level, and a study-direction bar, then lists the supporting papers ranked by grade. Each paper expands to show its claims and quotes, so users can verify the evidence independently. |
| 7 | **Limitations and methods** | How the map was built and how to interpret it responsibly: the view reflects only the studies in this corpus, and an empty cell marks an untested pairing, not an ineffective one. |

---

## 3. Design Philosophy: Breadth First, Then Depth

The page is a **ladder**. The reader starts with the whole picture, descends one step at a time, and can always climb back up. Each rung is exactly one click from the next.

| Level | Where it lives | What the user sees |
|---|---|---|
| **Breadth** | Controls at the top; heat map below | The complete overview of the data is the **default**: every intervention, every outcome, every gap. Filters and sorting narrow and reorder it. |
| **Depth** | Right-hand drawer, opened by clicking any label or cell | The sources and claims behind the selection. The **background colour of the sources section reflects the majority sentiment** of those claims, so the weight of evidence is visible before a single quote is read. |

No one is dropped into detail without context, and no detail is ever more than one click away.

---

## 4. Page Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│  TOOLBAR   Row & column filters · Sort · Remove empty · Want Help?       │
├────────────────────────────────────────────────┬───────────────────────┤
│                                                │  DETAIL DRAWER        │
│   HEAT MAP                                     │                       │
│                 Outcome A  Outcome B  Outcome C│  Selected label or    │
│   Intervention 1   ▓▓▓       ░░░               │  cell:                │
│   Intervention 2             ▓▓▓       ▒▒▒     │  summary, certainty,  │
│   Intervention 3   ▒▒▒                 ▓▓▓     │  sources, claims      │
│                                                │                       │
├────────────────────────────────────────────────┴───────────────────────┤
│  LEGEND   Shading scale · Unshaded = gap                                 │
└────────────────────────────────────────────────────────────────────────┘
```

| Region | Purpose |
|---|---|
| **Toolbar** | Controls breadth: filtering by rows and columns, sorting, removing empty rows and columns, and launching the tutorial. |
| **Heat map** | The default overview. Every cell is either shaded (studied) or unshaded (gap). |
| **Detail drawer** | Controls depth. Slides out on the right when a label or cell is selected, showing the verdict, certainty rationale, study breakdown and expandable claims by paper (see [Section 7.2](#72-the-detail-drawer)). |
| **Legend** | Always-available decoder for the shading scale and the meaning of an unshaded cell (see [Section 6](#6-colour-symbols-and-legends)). |

---

## 5. Reading the Heat Map

- **Rows** are interventions and **columns** are outcomes, as defined in `q3_grassland_gaps.json`.
- **Each cell** is one intervention-outcome pairing, shaded by the amount of research behind it.
- **Default order** follows first-seen order in the JSON, so the same input always produces the same picture.
- **Layout is computed from the data.** Row and column positions are never hard-coded.
- The heat map **scales to its container** and scrolls within its own frame when it is larger than the page, so the page itself never scrolls sideways.

---

## 6. Colour, Symbols and Legends

### 6.1 Why electric indigo

The heat map uses a single hue, **electric indigo**, for all evidence. It was chosen for accessibility and for a modern look:

| Reason | Detail |
|---|---|
| **Strong contrast** | Indigo stands out clearly against a white or light background, keeping shaded cells easy to see. |
| **Colour-blind safe** | A single-hue scale does not depend on telling red from green, so it reads correctly for the most common forms of colour-vision deficiency. |
| **Intensity carries meaning** | Because depth of shade, not hue, communicates quantity, the scale still works in greyscale or on a low-quality display. |
| **Modern aesthetic** | A saturated indigo gives the interface a clean, contemporary identity. |

Colour is never the only signal. Cell details are always available on selection, so no information depends on perceiving shade alone.

### 6.2 Cell states

| Cell appearance | Meaning |
|---|---|
| **Light indigo** | Few studies tested this intervention-outcome pairing. |
| **Medium indigo** | A moderate number of studies tested this pairing. |
| **Deep indigo** | Many studies tested this pairing. |
| **Unshaded** | *No study in this corpus tested this pairing.* This is a **gap**, not a negative result. |

---

## 7. Key Features

### 7.1 Interaction

| Action | Result |
|---|---|
| **Click an intervention or outcome** (row or column label) | All cells involving that label are highlighted. The drawer opens with its relationships across the corpus, each with its direction and certainty. |
| **Click a relationship** (a shaded cell) | The two affected topics are highlighted. The drawer summarises the **overall direction, number of studies and claims, certainty, and sentiment of claims**, followed by **every individual claim** so users can validate the information independently. |

### 7.2 The Detail Drawer

The drawer is the **depth** half of the ladder. It slides in on the right when a row, column or cell is selected, and it is designed to answer three questions in order: *what is the verdict, how much should I trust it, and where does it come from?* The example below shows a selected intervention-outcome pairing.

```
┌──────────────────────────────────────────┐
│ Intervention → Outcome               [✕] │  ① Title
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
│ From Intervention to Outcome             │  ⑥ Linked endpoints
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
| ① | **Title and close button** | Names the selected pairing (*intervention → outcome*). The **✕** closes the drawer and returns the user to the full overview. |
| ② | **Verdict line** | The headline answer: overall direction glyph and word, followed by the certainty dots and level (e.g. *↓ Decrease · ●●●● High certainty*). |
| ③ | **Certainty rationale** | A one-line, plain-language explanation of *why* the certainty level was assigned, following the GRADE-style logic of a starting level plus adjustments (e.g. *"start high (best design in the body of evidence); +1 3 studies agree -> high"*). It makes the rating auditable rather than a black box. |
| ④ | **Evidence counts** | The number of independent studies and individual claims behind the pairing, so users can tell a well-replicated finding from a single study at a glance. |
| ⑤ | **Study directions bar** | A stacked bar showing how the studies split by direction (increase, decrease, mixed, no effect). A single-colour bar means the studies agree; a multi-colour bar signals disagreement. |
| ⑥ | **Linked endpoints** | The intervention and the outcome appear as links. Selecting either one jumps to that label's own relationships, allowing movement through the heat map without returning to the grid. |
| ⑦ | **Claims by paper** | The supporting literature, grouped by paper and **ranked by claim grade, highest first**, so the strongest evidence is read first. |

**Paper cards.** Each paper in the evidence list shows:

- the **title and publication year**;
- the **grade** of that paper's claims (certainty dots and level) and the **number of claims** it contributes;
- a **direction tally** (e.g. *↓ Decrease 2*);
- a **tinted background** that reflects the direction of its claims, so the balance of evidence can be read by colour before any text;
- an **expand control (⌄)** that reveals the individual claims and their supporting quotes, so users can verify each statement against the source themselves.

**Companion status chip.** While a pairing is selected, the toolbar shows a summary chip with the same key facts (*direction · certainty · studies · claims*) and a **Clear** button, so the selection remains visible and easy to dismiss even when the drawer is closed.

---

## 8. Filtering, Sorting and Tidying the Heat Map

These controls manage a large heat map. None of them change the underlying data; they change what is displayed and in what order.

| Control | What it does | Why it helps |
|---|---|---|
| **Filter by columns** | Show only selected outcomes. | Focus on the outcomes of interest. |
| **Filter by rows** | Show only selected interventions. | Compare a chosen set of interventions side by side. |
| **Sort rows and columns** | Order by **density**, **alphabetical order** or **most studies**. | Most studies brings the highest-evidence pairings to the top; density groups well-studied areas together and pushes gaps to one side; alphabetical order makes a label easy to find. |
| **Remove empty rows and columns** | Hide any row or column with no shaded cells. | Focus on what has been studied. Turn it off to see entire rows and columns with *no* evidence, which are often the most important gaps. |

Ties in any sort break by first-seen order in the JSON, so results are always reproducible.

> **Tip.** To find research priorities, sort by **density** with **Remove empty** switched off. The sparse areas that result are the gaps.

---

## 9. Room for Growth

| Proposed feature | Benefit |
|---|---|
| **Glossary of terms** | The list of interventions is long, and some industry workers may not be familiar with all of the terminology. A glossary would explain each intervention in plain language, improving understanding of the options and making the heat map accessible to a wider audience. |

---
