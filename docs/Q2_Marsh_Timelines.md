# Q2 Prototype: Created Marshes

> An interactive evidence explorer showing how created-marsh interventions compare with the wetland baseline, how certain each claim is, and over what time scales the research was carried out. It treats "we do not yet know" as a finding in its own right.

| | |
|---|---|
| **Question** | Q2: Created marshes |
| **Data source** | `answers/q2_created_marshes.json` |
| **Primary view** | Intervention-outcome rows, each with a slider against the wetland baseline |
| **Colour scheme** | Burgundy plum |
| **Audience** | Restoration practitioners, industry and researchers |

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [Representing the Unknown](#2-representing-the-unknown)
3. [Getting Started: the "Want Help?" Tour](#3-getting-started-the-want-help-tour)
4. [Design Philosophy: Breadth First, Then Depth](#4-design-philosophy-breadth-first-then-depth)
5. [Page Structure](#5-page-structure)
6. [Reading the Sliders](#6-reading-the-sliders)
7. [Colour, Symbols and Legends](#7-colour-symbols-and-legends)
8. [Key Features](#8-key-features)
9. [Filtering and Ordering](#9-filtering-and-ordering)
10. [Room for Growth](#10-room-for-growth)

---

## 1. Motivation

### 1.1 Why we chose this data representation

We placed a **slider beside each intervention-outcome combination**. Each slider clearly shows two things at once:

- **Which interventions lagged behind the wetland baseline**, so users can see where created marshes fall short of the reference condition.
- **How certain the claims are**, so users can tell a firm result from a tentative one.

Where time-scale information is available for an intervention, we still wanted users to see **the time scales over which research exists**. This gives the full information in the data without hiding the time dimension.

Together, these choices display everything the data offers in a form that is easy to understand and does not overwhelm the user.

### 1.2 Value to industry

The view shows which applications work and over what time scale results can be expected. This is especially valuable in restoration work, where time data lets practitioners plan realistically and set expectations about when outcomes will appear.

### 1.3 Value to research

The view clearly shows which approaches have low certainty. These are the places where the evidence is not yet settled, which can guide researchers to their next research question.

---

## 2. Representing the Unknown

**This website is answering the unknown.** Much of what practitioners most want to know about created marshes has not been settled by the literature, and the page is built to say so honestly.

In academic work, questions that cannot yet be answered are often left out, because an absent result is easier to omit than to display. That makes the gaps invisible, and invisible gaps are never filled. We take the opposite view: **representing questions that cannot currently be answered is an essential part of academic communication.**

| Principle | How the page applies it |
|---|---|
| **An unanswered question is a result** | Low-certainty and unresolved claims are shown prominently, not filtered out by default. |
| **Uncertainty is displayed, not hidden** | Every claim carries its certainty beside it, so no finding appears more settled than it is. |
| **"Unknown" is not "ineffective"** | A low-certainty claim or an untested combination means more research is needed, not that an intervention fails. |
| **Gaps guide the field** | Surfacing what is unknown points researchers to the questions most worth asking next. |
| **Time coverage is shown as it is** | Where time scales are available they are displayed, and where they are missing the page does not imply otherwise. |

Showing what we do not know is what lets industry make cautious decisions and lets researchers decide where to look next.

---

## 3. Getting Started: the "Want Help?" Tour

First-time visitors face a dense set of rows, sliders and controls. To make the page approachable, it includes a **Want Help?** button, an interactive, guided walkthrough that introduces each part of the page in the order a new user needs it.

**What it provides.** Selecting **Want Help?** launches a step-by-step overlay. Each step dims the rest of the page, spotlights one interface element, and explains in plain language what it is and how to use it. Users can advance with *Next*, return with *Back*, or leave at any time with *Skip* (or `Esc`). The tour can be relaunched at any point.

| Step | Tour stop | What the user learns |
|:---:|---|---|
| 1 | **Start here: the short answer** | The headline takeaway of the page: how created-marsh interventions compare with the wetland baseline and how certain the evidence is, summarised before any detail. |
| 2 | **Evidence by marsh age** | How the research is distributed across the age of the created marshes, so users can see how long after creation outcomes were studied. |
| 3 | **The findings** | Each row is an intervention-outcome combination, and the slider beside it shows how that intervention compares with the wetland baseline, with the certainty of the claim shown alongside. |
| 4 | **When was it measured?** | Where time-scale information is available, the time scales covered by the research are shown, so users know over what period results were observed. Where it is missing, the page does not imply otherwise. |
| 5 | **Details, claims and quotes** | Clicking a combination opens the right-hand drawer, which summarises direction, number of studies and claims, certainty and sentiment, then lists every claim and its quote so users can verify the evidence independently. |
| 6 | **Filter the list** | Filter by attribute and certainty, and order rows by certainty to bring the firmest results or the biggest unknowns to the top. |
| 7 | **Limitations and export** | How to export the current view for use outside the site, and how to interpret the data responsibly: the view reflects only the studies in this corpus, and low certainty or an untested combination means more research is needed, not that an intervention fails. |

---

## 4. Design Philosophy: Breadth First, Then Depth

The page is a **ladder**. The reader starts with the whole picture, descends one step at a time, and can always climb back up. Each rung is exactly one click from the next.

| Level | Where it lives | What the user sees |
|---|---|---|
| **Breadth** | Filters and ordering at the top; sliders below | The complete overview of the data is the **default**: every intervention-outcome combination with its slider. Filters and ordering narrow and reorder it. |
| **Depth** | Right-hand drawer, opened by clicking any combination | The sources and claims behind the selection. The **background colour of the sources section reflects the majority sentiment** of those claims, so the weight of evidence is visible before a single quote is read. |

No one is dropped into detail without context, and no detail is ever more than one click away.

---

## 5. Page Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│  TOOLBAR   Filter by attribute · Filter by certainty · Order · Want Help?│
├────────────────────────────────────────────────┬───────────────────────┤
│                                                │  DETAIL DRAWER        │
│   INTERVENTION-OUTCOME ROWS                    │                       │
│                                                │  Selected combination:│
│   Intervention 1 → Outcome   ──●────|──  ●●●○  │  summary, certainty,  │
│   Intervention 2 → Outcome   ───●───|──  ●●○○  │  sources, claims      │
│   Intervention 3 → Outcome   ────●──|──  ●○○○  │                       │
│                         (baseline marker |)    │                       │
├────────────────────────────────────────────────┴───────────────────────┤
│  LEGEND   Slider · Wetland baseline · Certainty · Time scales            │
└────────────────────────────────────────────────────────────────────────┘
```

| Region | Purpose |
|---|---|
| **Toolbar** | Controls breadth: filtering by attribute and certainty, ordering, and launching the tutorial. |
| **Intervention-outcome rows** | The default overview. Each row is one combination with its slider, certainty and, where available, time scales. |
| **Detail drawer** | Controls depth. Slides out on the right when a combination is selected, showing direction, study and claim counts, certainty, sentiment and the full list of claims. |
| **Legend** | Always-available decoder for the slider, the wetland baseline, the certainty markers and the time scales (see [Section 7](#7-colour-symbols-and-legends)). |

---

## 6. Reading the Sliders

- **One row per combination.** Each row pairs an intervention with an outcome.
- **The slider** sits beside the combination and shows how that intervention compares with the **wetland baseline**, making it clear which interventions lagged behind.
- **Certainty** is displayed with each slider, so the strength of the claim is read together with its position.
- **Time scales** are shown for interventions that have time-scale information, indicating over what periods research exists.
- **Default order** follows first-seen order in the JSON, so the same input always produces the same picture.
- **Layout is computed from the data.** Row positions are never hard-coded, and the page scales to its container.

---

## 7. Colour, Symbols and Legends

### 7.1 Why burgundy plum

The page uses a **burgundy plum** colour scheme. It was chosen to give the page a calm, distinctive and professional identity while keeping every element readable:

| Reason | Detail |
|---|---|
| **Strong contrast** | Deep burgundy and plum tones stand out clearly against a white or light background, keeping sliders, markers and text easy to read. |
| **Colour-blind safe** | A single warm-purple family does not depend on telling red from green, so the page reads correctly for the most common forms of colour-vision deficiency. |
| **Suited to the subject** | Rich, earthy plum tones sit naturally alongside a wetland and restoration subject without implying "good" or "bad" results. |
| **Distinctive identity** | A burgundy plum palette gives the interface a mature, cohesive look. |

Colour is never the only signal. Certainty and position are always available as text and markers, so no information depends on perceiving colour alone.

### 7.2 Gaps

| Visual | Meaning |
|---|---|
| **Unshaded** | *No study in this corpus tested this pairing.* This is a **gap**, not a negative result. |

---

## 8. Key Features

Q2 is a list of intervention-outcome combinations rather than a network, so there are no connecting lines between topics to follow. Each combination stands on its own, and selecting one gives the full detail.

| Action | Result |
|---|---|
| **Click a combination** | The row is highlighted and the right-hand drawer opens. It summarises the **overall direction, number of studies and claims, certainty, and sentiment of claims**, followed by **every individual claim** so users can validate the information independently. |
| **Close the drawer** | The page returns to the full overview, with every combination visible again. |

---

## 9. Filtering and Ordering

These controls manage the list of combinations. None of them change the underlying data; they change what is displayed and in what order.

| Control | What it does | Why it helps |
|---|---|---|
| **Filter by attribute** | Show only combinations with the selected attributes. | Focus on the interventions and outcomes of interest. |
| **Filter by certainty** | Show only combinations at the selected certainty levels. | Isolate the firmest results for decisions, or the least certain for research planning. |
| **Order by certainty** | Sort rows from the most to the least certain, or the reverse. | Bring the strongest evidence, or the biggest unknowns, to the top. |

Ties in any ordering break by first-seen order in the JSON, so results are always reproducible.

> **Tip.** To find research priorities, order by certainty with the lowest first. The combinations at the top are the ones where the question is least answered.

---

## 10. Room for Growth

| Proposed feature | Benefit |
|---|---|
| **More time-series data and a time-period filter** | A filter showing which applications work in which time periods would help practitioners plan. With the limited time-series data currently available, a filter was not worth implementing, but more data would make it valuable. |

---

<sub>Q2 Prototype · Created Marshes · Data source: `answers/q2_created_marshes.json`</sub>
