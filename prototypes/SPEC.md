# Q1 prototype site — shared design spec

Four generators build the **same site** from the same two files. Only the stack is
different (see `../tech_stack.md`). Hold the design below constant, so the user can
compare the stacks and not four unrelated designs.

Inputs (read only, never modify):

- `answers/q1_tree_planting.json` → **Panel A, "Findings"**
- `answers/q1_tree_planting_graph.json` → **Panel B, "Network"**

Read `README.md` (sections "The answer files", "The Q1 graph", "Five things to get
right", "Provenance") and `CLAUDE.md` before you start.

## 0. Founding principle: breadth first, then depth

Every panel is a ladder. The reader starts with the whole picture and goes down one
step at a time, and can always go back up. Each step must stay one click from the
next.

| Level | What the reader sees | Where |
| --- | --- | --- |
| L0 Breadth | Question, the two panel cards with headline counts | Top of page |
| L1 Summary | "At a glance" strip for the open panel: counts by direction and by certainty, gaps, how it was built | Top of the panel |
| L2 Structure | The graph (node-link), with a Matrix toggle | Middle of the panel |
| L3 Focus | Click a node: only its active pathways stay bright (section 3.6). Click an edge: that edge and its ends stay bright | In the graph itself. Nothing floats over the graph |
| L4 Detail | Detail drawer: all claims of an edge, grouped by paper, or all edges of a node | Side column (in the page flow under the graph on narrow screens). Never over the graph |
| L5 Source | The quote, paper title, year, DOI link | Inside the drawer and in the tables |

The tables (section 5) are a second road down to L4/L5 for readers who prefer rows.

**Two-click rule:** from any edge or table row, the reader reaches the source
sentence in two clicks or fewer (click edge → drawer shows quotes → click DOI).

## 1. Accuracy rules (hard)

1. Every direction, certainty, certainty_rationale, study count, claim count, label,
   quote, title, year and DOI shown on the page comes **verbatim** from the JSON.
   Do not pool, re-grade, average, multiply or re-derive any of them.
2. Allowed derived values: counts made by counting JSON entries (for example "13
   findings", "29 papers" = distinct `document_id` in `evidence`), sorting, filtering,
   and grouping claims by `document_id`.
3. Prose on the page is one of: (a) a JSON string shown verbatim (`question`,
   `how_built`, `limitations`, `certainty_rationale`, `searched_for`, `why`,
   `node_kinds`, `edge_kinds`, `direction_meaning`), (b) fixed UI copy (headings,
   legends, help text that explains the encoding), or (c) a mechanical template
   that restates fields, for example `Site preparation → Seedling growth: mixed,
   certainty high, 11 studies, 68 claims`. **No invented findings, no adjectives
   such as "strong" or "promising", no advice, no LLM.** Do not call the BRINE LLM.
4. Display names for enums are a fixed 1:1 map: `increase`→"Increase",
   `decrease`→"Decrease", `mixed`→"Mixed (studies disagree)", `no_effect`→"No effect
   (tested)", `unclear`→"Unclear", `very_low`→"Very low", `low`→"Low",
   `moderate`→"Moderate", `high`→"High". Node kinds use the `node_kinds` text.
5. Panels are independent. Panel A uses only `q1_tree_planting.json`; Panel B uses
   only `q1_tree_planting_graph.json`. Do not copy data across files (for example,
   do not give Panel A nodes the `kind` field from the graph file).
6. A gap is **not** a negative result. Draw it as a gap (section 3.5). `mixed` and
   `no_effect` are findings, not gaps.
7. A path through a `condition` node joins two separate bodies of evidence. Never
   draw, highlight or describe a path as one effect, and never show a combined
   strength. Show the first `limitations` string of the graph file next to the graph.
8. Some evidence entries have no `doi`. Show `document_id` as text; link only when a
   DOI exists (`https://doi.org/<doi>`). A DOI link is the only external URL allowed.
9. `set_aside[*].edge_id` in the graph file is **not** in its `evidence` map. Show the
   id and `why`; do not invent a quote.
10. Panel A has 5 `interactions` (claim id + direction). They are single claims, not
    pooled findings. List them as claims (subject → object, quote, paper) with their
    own direction. Do not draw them as pooled edges.
11. Panel A has 5 evidence entries that no finding references (the interaction
    claims). They must still be reachable (via the Interactions table).

### Machine-check contract (required)

`prototypes/check_site.py <site_dir>` verifies the built site. It reads every
`.html` and `.json` file under the site directory **as built** (no JavaScript is
run), so the elements below must exist in the static HTML. Put the attributes on
the table rows (section 5); you may also put them on SVG elements.

| Element | Attributes (values exactly as in the JSON) |
| --- | --- |
| Each Panel A finding | `data-finding-id`, `data-direction`, `data-certainty`, `data-studies`, `data-claims` |
| Each Panel A gap | `data-gap-id` |
| Each Panel A interaction | `data-interaction-id` (= `edge_id`), `data-direction` |
| Each Panel B node | `data-node-id` |
| Each Panel B edge | `data-edge-id`, `data-direction`, `data-certainty`, `data-studies`, `data-claims` |
| Each Panel B gap | `data-gap-id` |

Every claim id (`camo:edge_…`) in both `evidence` maps must appear somewhere in the
site files (HTML or JSON), together with its quote. Run the checker until it passes.

## 2. Page structure

```
┌───────────────────────────────────────────────────────────────┐
│ Q1 · Tree planting in Canadian forest restoration             │  header (serif title)
│ <question, verbatim>                                          │
│ ┌─────────────────────────┐ ┌─────────────────────────┐       │  L0 panel cards
│ │ Findings                │ │ Network                 │       │  (tablist; the
│ │ 13 findings · 1 gap     │ │ 12 nodes · 29 edges     │       │   selected card
│ │ 239 claims · 29 papers  │ │ 330 claims · 33 papers  │       │   is the open panel)
│ └─────────────────────────┘ └─────────────────────────┘       │
├───────────────────────────────────────────────────────────────┤
│ At a glance  [direction counts] [certainty counts] [gaps]     │  L1
│ How this was built ▸ (details/summary, verbatim how_built)    │
│ Search [______________]  Lens: All | Direct | Via conditions… │  toolbar
│ Filters: direction chips · min certainty · show gaps          │
│ ┌───────────────────────────────────────────┐ ┌────────────┐  │
│ │ Graph  |  Matrix                          │ │ Drawer     │  │  L2 + L4
│ │                                           │ │ (pinned    │  │
│ │                                           │ │  item)     │  │
│ └───────────────────────────────────────────┘ └────────────┘  │
│ Legend (always visible) + limitation note                     │
│ Tables: Findings · Gaps · Interactions · Papers · Claims      │  L3–L5 (rows)
│ Limitations (verbatim)                                        │
└───────────────────────────────────────────────────────────────┘
```

- The two panel cards are a tab list (`role="tablist"`, arrow keys move between
  tabs). Each card shows the panel name, one line of fixed copy, and counts. The URL
  hash records the open panel (`#findings`, `#network`) and the pinned item
  (`#network/edge/site_preparation->growth`) so a view can be linked.
- **Page weight:** keep the first view small. Do not inline all 330 quotes into the
  graph markup twice. A good pattern: put pooled rows in the HTML, and put the claim
  quotes once in the claims table or in one minified JSON file per panel
  (`data/findings.json`, `data/network.json`) loaded when needed. No CDN, no web
  fonts, no external requests. Report the byte size of each file you ship.
- Without JavaScript (ranks 1–3), the page must still show both panels stacked, the
  static graph SVG, and all tables with quotes. JavaScript adds tabs, click
  highlighting, the drawer, search, filters, the matrix toggle and the theme toggle.
- The URL hash also records a selected node (`#network/node/site_preparation`).

## 3. The graph (both panels)

### 3.1 Layout: lanes, deterministic

Layered, left to right, in lanes by role. Compute the layout from the JSON (do not
hard-code coordinates for named nodes), and make it deterministic: the same input
gives the same picture. No force layout.

- Panel B lanes: **Planting stock** and **Site treatments** (lane 1, two labelled
  groups stacked; the `combination` node sits in this lane under the site
  treatments) → **Conditions** (lane 2) → **Outcomes** (lane 3). Lane titles use
  `node_kinds` text as a subtitle.
- Panel A lanes: **Factor** (the finding/gap subjects, in first-seen order) →
  **Outcome** (survival, growth). It is a bipartite graph of 13 edges plus the gap.
- Order nodes inside a lane to reduce crossings (for example, 2–4 passes of the
  barycenter heuristic). Ties break by first-seen order in the JSON.
- Edges are smooth curves (cubic Bézier). An edge that skips a lane (lane 1 →
  lane 3) curves around the lane-2 nodes, not through their labels. An edge inside
  one lane (`competing_vegetation → seedling_nutrients`) is an arc on the lane's
  right side.
- The SVG has a `viewBox` and scales to its container. Pan and zoom are optional
  (if you add them, add a "Reset view" button and keep keyboard access).

### 3.2 Nodes

- Rounded rectangles with the label as SVG `<text>` (wrap long labels on two
  lines). Lane groups differ by shape detail or icon, not by colour only.
- `combination` node: a node that shows its `members` inside it as two small
  stacked chips ("Fertilization at planting" / "+ Site preparation"). Draw thin
  dotted **membership** connectors, with no arrowheads, from each member node to it.
  The legend says "member of a combination — not an evidence edge".

### 3.3 Edges: encode without colour alone

Each edge carries an always-visible **chip** at its midpoint:

```
 ┌───────────┐
 │ ↑  ●●●●   │   direction glyph + certainty dots
 └───────────┘
```

- Direction glyph and word: `↑` Increase, `↓` Decrease, `↕` Mixed, `=` No effect,
  `?` Unclear. Colour is redundant only. Use the direction tokens of section 4
  (`--inc` blue, `--dec` red, `--mix` amber, `--null` grey, `--unc` grey) for the
  line, the arrowhead, the chip outline and the chip text, in both themes.
- Certainty as GRADE-style dots (filled of 4): High ●●●●, Moderate ●●●○, Low ●●○○,
  Very low ●○○○. The chip has an `aria-label` / `<title>` with the full words.
- Line width = number of studies (for example 1.5 px + 0.6 px per study, capped).
  Say so in the legend: "Line width = number of studies".
- Arrowhead at the target.
- Chips must not overlap. Use a simple collision pass (slide a chip along its curve,
  or offset it) and test it on Panel B.

### 3.4 Moderation edge

`fertilization_at_planting~>site_preparation->growth` has `target: null` and
`target_edge: "site_preparation->growth"`. Draw it as a **dotted** curve from the
source node that ends with a diamond marker (◆) **on the chip of the target edge**.
Its own chip shows its direction and certainty. Its drawer entry shows
`direction_meaning` verbatim and names the target edge.

### 3.5 Gaps

Draw each gap as a **dashed, hollow** link (no arrowhead, light stroke) with a text
label "No evidence" on it. Clicking it opens the drawer with: "No study in this
corpus tested this pairing. This is a gap, not a negative result." plus
`searched_for` verbatim. Never draw a gap like a weak or negative edge.

### 3.6 Focus + context (scalability)

These are what keep a large graph readable. Implement all of them:

1. **Click to highlight active pathways (no hover).** Hover changes nothing in
   the graph except the cursor (`pointer`) and a thin outline on the hovered
   element itself. **No hover cards, no tooltips over the graph, no hover fading.**
   Keyboard focus shows only the focus ring. (SVG `<title>` elements stay for
   screen readers, but do not build any custom floating card.)

   **Click a node** (or Enter / Space on it) to select it:

   - The **active pathways** of node N are the effect edges on any directed path
     that passes through N: every edge reachable downstream from N, plus every
     edge that leads upstream into N. Also include: gaps that touch N; a
     moderation edge whose source is N or whose `target_edge` is an active edge
     (and then also its target edge); the membership connectors and the
     combination node when N is a member, or the member nodes when N is the
     combination.
   - Active edges, their chips and their end nodes stay at full strength.
     Everything else fades to about 10–15% opacity. The selected node gets a
     strong outline.
   - **Path honesty:** edges attached to N (one step) are drawn at full width.
     Edges two or more steps away stay bright but are drawn visibly different
     (for example 65% opacity, or a thinner line), and the status line says:
     "Edges beyond the first step are separate bodies of evidence. A path is not
     one tested effect." Never add or multiply anything along a path.
   - A status line above the graph says what is selected, with counts made by
     counting edges, for example "Pathways through Site preparation: 9 edges (6
     direct, 3 further) · Clear". "Clear" resets the view.
   - The drawer shows the node's details (kind text from `node_kinds`, its
     edges, members for a combination, the path-honesty note for a condition).
   - Click the same node again, click empty canvas, press Esc, or press Clear to
     reset.

   **Click an edge or its chip** to select it: the edge, its two end nodes (for a
   moderation edge: its source, its diamond and its target edge) stay bright,
   the rest fades, and the drawer shows the edge's claims and quotes.
2. **Lenses** (preset views, a segmented control): `All` (default) · `Direct`
   (edges into outcomes from stock and treatments = the Q1 findings) · `Via
   conditions` (edges into and out of condition nodes) · `Interactions`
   (combination and moderation). A lens fades the edges outside it; it does not
   delete them.
3. **Filters** (chips): direction (multi-select), minimum certainty, "show gaps".
   Filters apply to the graph, the matrix and the tables together (linked views),
   and the counts in the toolbar update ("Showing 9 of 29 edges").
4. **Search.** One box per panel. It matches node labels, edge endpoints, claim
   subject/object, quote text and paper titles (case-insensitive). The result list
   is grouped (Nodes · Edges/Findings · Papers · Claims) with counts. Matching edges
   stay bright in the graph and the rest fade. Choosing a result pins it in the
   drawer. `/` focuses the search box; `Esc` clears.
5. **Matrix toggle.** A Graph | Matrix switch. The matrix is the scalable view for
   dense graphs: rows = sources, columns = targets, one cell per edge with the same
   glyph + dots. A listed gap is a hatched cell with the words "No evidence". An
   empty cell with no edge and no listed gap is blank with a `title` "No claims in
   this corpus link these two" — never a negative.

### 3.7 Drawer (L4)

There is no hover card. A click (or Enter / Space) selects an item (3.6) and
shows it in the drawer:

- Edge or finding: `Source → Target`, direction glyph + word, certainty dots +
  word, `certainty_rationale` verbatim, "N studies · M claims", a small bar of
  `study_directions` (numbers printed, not colour only). Then its claims grouped
  by paper (paper title, year, DOI link or document_id), each claim with
  `subject` → `predicate` → `object`, its own direction, `certainty_grade`,
  `evidence_types`, `comparator`, and the **quote** in a block quote. Order papers
  by number of claims.
- Node: label, kind text from `node_kinds`, all its edges (each one selects that
  edge), members for a combination, and for a condition node the path-honesty
  note.
- Gap / moderation: as in 3.4 and 3.5.
- **The drawer never covers the graph.** On wide screens it is a column beside
  the graph. On narrow screens it sits in the page flow under the graph (no
  bottom sheet, no overlay). It has a close button, traps nothing, and returns
  focus to the item that opened it. Esc closes it.

## 4. Visual style: cool monochrome editorial (Kimi-like)

The look follows the Kimi blog (kimi.ai/blog): a cool grey page, flat near-white
cards, near-black text with grey secondary text, serif reading text, sans UI, mono
numbers, black pill buttons, and vivid colour only in the data. Do not copy any
logo, name or brand asset.

### 4.1 Tokens (use exactly these; all text pairs pass WCAG AA)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#E8E8E8` | `#0F151A` | page background |
| `--surface` | `#F7F7F7` | `#161D23` | cards, graph canvas, table body |
| `--raised` | `#FFFFFF` | `#1D252C` | drawer, inputs, chips, nodes |
| `--line` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.08)` | hairlines, card borders |
| `--line-strong` | `rgba(0,0,0,.18)` | `rgba(255,255,255,.20)` | node borders, inputs |
| `--text` | `#1A1A1A` | `#DADCDE` | headings, labels, numbers |
| `--text-2` | `#555555` | `#9EA4AA` | reading text, secondary |
| `--text-3` | `#636363` | `#8A9097` | captions, hints (smallest text) |
| `--pill` / `--pill-text` | `#111111` / `#FFFFFF` | `#F2F2F2` / `#0F151A` | selected tab, selected segment, primary button |
| `--focus` | `#0B6FE8` | `#1A88FF` | 2 px focus ring, selected node outline |
| `--inc` | `#0A5FC2` | `#4DA3FF` | Increase |
| `--dec` | `#C21F33` | `#FF6B76` | Decrease |
| `--mix` | `#8F5100` | `#F5A524` | Mixed |
| `--null` | `#5F6368` | `#A3A9AF` | No effect |
| `--unc` | `#626262` | `#8E949A` | Unclear |
| `--t1` / `--t1-fg` | `#F1E6FF` / `#1A1A1A` | `#311465` / `#FFFFFF` | Density thin (Q3 gap map cell fill / text) |
| `--t2` / `--t2-fg` | `#D7B8FF` / `#1A1A1A` | `#440E95` / `#FFFFFF` | Density some |
| `--t3` / `--t3-fg` | `#B47AFF` / `#1A1A1A` | `#5A07CA` / `#FFFFFF` | Density dense |
| `--t4` / `--t4-fg` | `#6F00FF` / `#FFFFFF` | `#6F00FF` / `#FFFFFF` | Density densest (electric indigo) |

Links are `--text` with a 1 px underline in `--line-strong` (thicker on hover), not a
coloured link. Gaps use `--text-3` dashes.

### 4.2 Light and dark themes with a toggle

- Default follows the system: `@media (prefers-color-scheme: dark)` sets the dark
  tokens under `:root:not([data-theme="light"])`; `:root[data-theme="dark"]` sets
  them too.
- A small theme toggle button sits at the top right of the header (sun / moon
  icon as inline SVG, `aria-label="Switch to dark theme"` / `"... light theme"`,
  `aria-pressed`). It sets `data-theme` on `<html>` and stores the choice in
  `localStorage` (wrap every storage call in `try/catch`; the page works without
  it). Apply the stored choice in a tiny inline script in `<head>` so there is no
  flash. Without JavaScript, the system theme still works.
- The graph SVG uses the CSS variables (no hard-coded colours), so both themes
  apply to nodes, edges, chips, markers and lane titles.

### 4.3 Type, shape, space

- No web fonts. Headings and reading text (question, how built, limitations,
  rationales, quotes) use a serif stack close to Lora: `"Iowan Old Style",
  "Palatino Linotype", Charter, Georgia, ui-serif, serif`. Headings weight 500,
  letter-spacing -0.02em; h1 about 40 px, h2 about 28 px. Reading text in
  `--text-2`, 16–17 px, line height 1.6.
- UI (tabs, chips, buttons, tables, node labels, drawer meta) uses `-apple-system,
  BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, Arial, sans-serif`.
- Numbers, counts, ids and certainty dots use `"SF Mono", ui-monospace, Menlo,
  Monaco, Consolas, monospace` with `font-variant-numeric: tabular-nums`.
- Cards: `--surface`, radius 16 px, a 1 px `--line` border or none, **no shadow**.
  Buttons, tabs, segmented controls and filter chips are pills (radius 999 px). A
  selected tab or segment is a solid `--pill` pill with `--pill-text`; unselected
  ones are `--raised` with `--text-2` text.
- The two panel cards at the top: the selected card has a 1.5 px `--text` border;
  the other has a `--line` border.
- Graph nodes: `--raised` fill, `--line-strong` border, radius 12 px, `--text`
  label. Edge chips: `--raised` fill with a 1 px border in the direction colour.
- Lots of white space (section gaps 48–64 px). Motion 150–200 ms, off with
  `prefers-reduced-motion`.
- Responsive: the graph scrolls horizontally inside its own box (not the page);
  the drawer moves under the graph; tables become stacked cards.

## 5. Tables (L3–L5, the row road)

Each panel has these sections under the graph, as tabs or as `<details>` blocks:

- **Findings / Edges**: one row per finding (A) or edge (B). Columns: From, To,
  Direction (glyph + word), Certainty (dots + word), Studies, Claims, Study
  directions (numbers). Sortable headers (buttons in `<th>`, `aria-sort`). A row
  expands (or pins the drawer) to show `certainty_rationale` and the claims with
  quotes. Rows carry the machine-check attributes.
- **Gaps**: one row per gap with `searched_for`.
- **Interactions** (A) / **Interactions & set aside** (B): A lists the 5 interaction
  claims; B lists the combination node, the moderation edge and `set_aside`.
- **Papers**: one row per distinct `document_id`: title, year, DOI, number of claims,
  and which findings/edges cite it (links that pin them).
- **Claims**: every evidence entry, filterable by direction and certainty grade and by
  the search box: subject → object, direction, grade, quote, paper.
- **Limitations** and **How this was built**: verbatim.

Long tables: show the first 25 rows with a "Show all N" button, or paginate. Use
real `<table>` markup with `<th scope>` and a `<caption>`.

## 6. Accessibility (Lighthouse and axe-core are scored)

- Landmarks (`header`, `nav`, `main`, `footer`), one `h1`, ordered headings, a skip
  link, `lang="en"`, a `<title>`, a meta description, a viewport meta tag.
- Every interactive SVG element is focusable (`tabindex="0"`), has `role="button"`
  (or is inside an `<a>`), and has an `aria-label` that states the full content
  (for example "Site preparation to Seedling growth: mixed, certainty high, 11
  studies, 68 claims"). Visible focus ring.
- The graph also has a text alternative: the edges table is the accessible
  equivalent; link to it from the graph ("View as table").
- Colour contrast AA for all text, including chip text, in both themes.
- No `outline: none` without a replacement. Buttons are `<button>`.

## 7. Deliverables for each prototype

In `prototypes/<rank_dir>/`:

- `build.sh` — one command: `./build.sh [out_dir]` (default `site/` inside the
  prototype dir). It reads `../../answers/*.json` (resolve the path from the script
  location) and writes static files with an `index.html`. No network at build time
  except what the stack's lock-file install needs (ranks 3–4; record it).
- Pinned dependencies (`==`, lock file, or vendored source).
- `NOTES.md` — how to build and serve; dependency list with exact versions;
  whether anything is a native binary and whether it has an aarch64 build; build
  time (wall clock, `time ./build.sh`); install time and size (ranks 2–4); the size
  in bytes of each shipped file and the total for the first view; how the spec
  items were met and anything not done; known issues.
- The build output directory and `node_modules/` stay out of git (add a
  `.gitignore` in the prototype dir).
- Do not run `git commit`, `git add`, `git stash` or `git checkout`. The lead
  commits.
