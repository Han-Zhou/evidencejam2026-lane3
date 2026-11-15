# Accessibility Statement and Design Notes

> How the Q1, Q2 and Q3 evidence explorers are designed so that more people can read, navigate and trust the information, whatever their vision, device, input method or familiarity with the subject.

| Project | Topic | Data source | Colour scheme |
|---|---|---|---|
| **Q1, Panel A: Findings** | Tree planting: factors and outcomes | `answers/q1_tree_planting.json` | Direction colours (green, red, amber, grey) with glyphs and dots |
| **Q1, Panel B: Network** | Tree planting: stock, treatments, conditions, outcomes | `answers/q1_tree_planting_graph.json` | Direction colours (green, red, amber, grey) with glyphs and dots |
| **Q2** | Created marshes | `answers/q2_created_marshes.json` | Burgundy plum |
| **Q3** | Grassland gaps | `answers/q3_grassland_gaps.json` | Electric indigo |

---

## Table of Contents

1. [Our Approach](#1-our-approach)
2. [Principles Shared by All Projects](#2-principles-shared-by-all-projects)
3. [Colour and Visual Design](#3-colour-and-visual-design)
4. [Keyboard and Input](#4-keyboard-and-input)
5. [Understanding Without Expertise](#5-understanding-without-expertise)
6. [Representing Gaps and Uncertainty Honestly](#6-representing-gaps-and-uncertainty-honestly)
7. [Layout, Responsiveness and Alternative Views](#7-layout-responsiveness-and-alternative-views)
8. [Project-by-Project Summary](#8-project-by-project-summary)
9. [Known Limitations](#9-known-limitations)
10. [Verification Checklist](#10-verification-checklist)
11. [Room for Growth](#11-room-for-growth)

---

## 1. Our Approach

These projects present dense research evidence to two audiences with different needs: **industry practitioners** who want quick, trustworthy answers, and **researchers** who want to find gaps. Accessibility is treated as part of that purpose. If a person cannot perceive a colour, reach a control without a mouse, or understand a term, the evidence is not available to them.

Our approach rests on three commitments:

| Commitment | Meaning |
|---|---|
| **Never rely on one signal** | Every meaning is carried by more than one cue, such as colour plus a symbol plus text. |
| **Show the whole picture first** | Every page opens on a complete overview and lets the user move deeper one step at a time, so no one is dropped into detail without context. |
| **Be honest about what is unknown** | Gaps and low certainty are displayed clearly rather than hidden, so no one is misled by an apparently complete picture. |

> **Scope note.** This document describes the accessibility features **designed** into the projects and the checks still needed to confirm them. It is not a formal conformance claim. See [Section 10](#10-verification-checklist) for what should be verified before one is made.

---

## 2. Principles Shared by All Projects

| Principle | How it appears in the design |
|---|---|
| **Redundant encoding** | Direction, certainty and gaps are always expressed in at least two ways (see [Section 3](#3-colour-and-visual-design)). |
| **Breadth first, then depth** | A ladder structure: the complete overview is the default, and detail is one click away in the right-hand drawer. |
| **Guided onboarding** | A **Want Help?** button launches a step-by-step tour that spotlights each part of the page and explains it in plain language. |
| **Predictable layout** | Layouts are computed from the data and are deterministic: the same input always gives the same picture, so the page behaves consistently. |
| **Verifiable evidence** | Every summary is backed by the individual claims and quotes, so users can check information independently. |
| **Consistent structure** | Each project uses the same regions: toolbar, visualization, detail drawer and legend. |

---

## 3. Colour and Visual Design

### 3.1 Colour is never the only signal

| Meaning | Colour cue | Additional cues |
|---|---|---|
| **Direction (Q1)** | Green, red, amber, grey | A direction glyph (↑ ↓ ↕ = ?) and the direction word in the legend and drawer |
| **Certainty (Q1)** | n/a | GRADE-style dots (●●●●, ●●●○, ●●○○, ●○○○) and a level name (High, Moderate, Low, Very low) |
| **Gap (Q1)** | Light, hollow stroke | A dashed line with the text label **"No evidence"**; in the matrix, a hatched cell with the same words |
| **Evidence amount (Q3)** | Depth of electric indigo | Cell details in the drawer, and an unshaded cell for a gap |
| **Position and certainty (Q2)** | Burgundy plum accents | Slider position, certainty markers and text values |

### 3.2 Colour schemes by project

| Project | Scheme | Accessibility rationale |
|---|---|---|
| **Q1 (A and B)** | Green, red, amber, grey for direction | Red and green can be hard to tell apart for some users, so colour is **always paired** with a glyph, a word and certainty dots. The direction is readable without colour. |
| **Q2** | Burgundy plum | Strong contrast against light backgrounds, and a single warm-purple family that does not depend on distinguishing red from green. |
| **Q3** | Electric indigo | Strong contrast, a single-hue scale that avoids red-green confusion, and shade intensity (not hue) carrying quantity, so the scale survives greyscale or a low-quality display. |

### 3.3 Themes

Pages are designed to work in the viewer's light or dark setting, with colours defined as variables and an explicit background, so text always sits on a surface chosen for it.

---

## 4. Keyboard and Input

| Feature | Behaviour |
|---|---|
| **Search shortcut** | `/` focuses the search box (Q1). |
| **Clear** | `Esc` clears the search, and leaves the guided tour. |
| **Tour navigation** | *Next*, *Back* and *Skip* controls move through the **Want Help?** tour, and it can be relaunched at any time. |
| **Pan and zoom (optional)** | If pan and zoom are added to a graph, a **Reset view** button and full **keyboard access** are required. |
| **Close the drawer** | The **✕** control closes the detail drawer and returns to the full overview. |
| **Clear a selection** | A **Clear** button in the toolbar dismisses the current selection. |

Interactive controls are standard buttons, toggles and chips, so they can be operated without a mouse and remain usable on touch devices.

---

## 5. Understanding Without Expertise

| Feature | Benefit |
|---|---|
| **Want Help? tour** | New users are walked through every part of the page, in order, in plain language. Each project has its own tailored sequence. |
| **Always-visible legend** | A permanent decoder for glyphs, colours, certainty dots and gap notation, so no symbol has to be memorised. |
| **Plain-language certainty rationale** | The drawer explains in one line *why* a certainty level was assigned, making ratings auditable rather than opaque. |
| **Direction words, not just symbols** | Every glyph is paired with its word (Increase, Decrease, Mixed, No effect, Unclear). |
| **Tooltips on empty cells** | In matrices, an empty cell reads *"No claims in this corpus link these two"*, so a blank is explained rather than ambiguous. |
| **Limitations and methods step** | Each tour ends by explaining how to interpret the data responsibly. |

---

## 6. Representing Gaps and Uncertainty Honestly

Misreading absence as failure is an accessibility problem of its own, because it leads people to the wrong conclusion. Across all projects:

| Situation | How it is shown | What it means |
|---|---|---|
| **No study tested the pairing** | Dashed, hollow link labelled "No evidence" (Q1); unshaded cell (Q3); unshaded or empty marker (Q2) | A **gap**, not a negative result. |
| **Few studies or low certainty** | Light shading, few certainty dots, low-certainty label | More research is needed, not that the intervention fails. |
| **Studies disagree** | Mixed (↕) direction, multi-colour study-direction bar in the drawer | The evidence is divided. |
| **Empty cell with no listed gap** | Blank with an explanatory tooltip | No claims link the two; never interpreted as a negative. |

**Q2 in particular** is built to answer the unknown: low-certainty and unresolved claims are displayed prominently, because questions that cannot yet be answered should be represented, not omitted.

---

## 7. Layout, Responsiveness and Alternative Views

| Feature | Detail |
|---|---|
| **Responsive scaling** | The graph SVG declares a `viewBox` and scales to its container. |
| **No sideways page scroll** | Wide content such as matrices and heat maps scrolls inside its own frame, so the page itself never scrolls horizontally. |
| **Safe areas on phones** | Pages are designed to keep content clear of system bars on mobile devices. |
| **Alternative view of the same data** | Q1 offers a **Graph | Matrix** switch. The matrix is a structured tabular alternative that is easier to scan for dense data. |
| **Linked views** | Filters apply to the graph, matrix and tables together, with a live status line (e.g. "Showing 9 of 29 edges") that reports what is displayed. |
| **Controls for large data** | Q3 provides row and column filters, sorting by density, alphabetical order or most studies, and removal of empty rows and columns. Q2 provides filtering by attribute and certainty and ordering by certainty. |

---

## 8. Project-by-Project Summary

| Feature | Q1 Panel A | Q1 Panel B | Q2 | Q3 |
|---|:---:|:---:|:---:|:---:|
| **Want Help? tour** | ✓ | ✓ | ✓ | ✓ |
| **Always-visible legend** | ✓ | ✓ | ✓ | ✓ |
| **Colour paired with other cues** | ✓ | ✓ | ✓ | ✓ |
| **Colour-blind-conscious palette** | Paired cues | Paired cues | ✓ | ✓ |
| **Detail drawer with claims and quotes** | ✓ | ✓ | ✓ | ✓ |
| **Gaps shown explicitly** | ✓ | ✓ | ✓ | ✓ |
| **Matrix or tabular alternative** | ✓ | ✓ | n/a | Primary view |
| **Search with `/` and `Esc`** | ✓ | ✓ | n/a | n/a |
| **Lenses** | n/a | ✓ | n/a | n/a |
| **Filtering and sorting** | Direction, certainty, gaps | Direction, certainty, gaps | Attribute, certainty, order | Rows, columns, sort, remove empty |

---

## 9. Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| **Red and green in Q1** | Some users may find these hard to tell apart. | Glyphs, words and certainty dots carry the same information. A future palette review could also adjust hues. |
| **Technical vocabulary** | Intervention and outcome terms may be unfamiliar to some practitioners. | A **glossary of terms** is proposed (see [Section 11](#11-room-for-growth)). |
| **Dense networks** | Many edges can be hard to follow visually. | Lenses, filters, selection-based highlighting and the matrix alternative. |
| **Time-series data in Q2** | Limited time data means time coverage is incomplete. | Time scales are shown where they exist, and the page does not imply coverage that is missing. |
| **Screen reader experience of graphs** | Visual graphs are inherently harder to convey in audio. | The matrix, drawer and tables provide text equivalents. Dedicated testing is still required. |
| **Language** | Content is currently in English only. | Not yet addressed. |

---

## 10. Verification Checklist

The features above are design intentions. Before claiming conformance to a standard such as WCAG 2.2 AA, each item below should be tested and recorded.

| Area | Check | Status |
|---|---|:---:|
| **Contrast** | Text, glyphs, dots, sliders and shaded cells meet minimum contrast ratios against their backgrounds in light and dark themes, including every step of the indigo and burgundy plum scales. | ☐ |
| **Colour independence** | Each page remains fully understandable in greyscale and with simulated colour-vision deficiencies. | ☐ |
| **Keyboard** | Every control, node, edge, cell and drawer action can be reached and operated using only the keyboard, with a visible focus indicator. | ☐ |
| **Focus management** | Opening the drawer moves focus sensibly, closing it returns focus, and the tour traps and releases focus correctly. | ☐ |
| **Screen readers** | Nodes, edges, cells, chips, status-line updates and the drawer are announced meaningfully with labels and roles. | ☐ |
| **Text alternatives** | Graphs and heat maps have accessible names and text equivalents for their key findings. | ☐ |
| **Zoom and reflow** | Pages remain usable at 200% zoom and on narrow screens, without loss of content. | ☐ |
| **Motion** | Any animation respects the user's reduced-motion setting. | ☐ |
| **Touch targets** | Controls are large enough to tap reliably on mobile. | ☐ |
| **Tour** | The **Want Help?** tour is operable by keyboard, can be skipped, and does not hide the page from assistive technology. | ☐ |

---

## 11. Room for Growth

| Proposed improvement | Benefit |
|---|---|
| **Glossary of terms** (Q3) | Explains the long list of interventions in plain language for users who are unfamiliar with them. |
| **Geographic data** (Q1) | Helps practitioners see what applies in their region of Canada, and reveals regional gaps. |
| **Seedling type** (Q1) | Lets users judge how findings apply to the specific seedlings they use. |
| **More time-series data and a time-period filter** (Q2) | Helps practitioners see which applications work over which time periods. |
| **Formal accessibility audit** | Completes the checklist above and supports a documented conformance statement. |
| **Language support** | Makes the evidence available to speakers of other languages, including French. |

---

<sub>Accessibility Statement · Q1 (Panels A and B), Q2 and Q3 · Prototype</sub>
