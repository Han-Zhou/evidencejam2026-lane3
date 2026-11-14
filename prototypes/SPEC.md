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
step at a time, and can always go back up. Each step must stay one click (or one
hover) from the next.

| Level | What the reader sees | Where |
| --- | --- | --- |
| L0 Breadth | Question, the two panel cards with headline counts | Top of page |
| L1 Summary | "At a glance" strip for the open panel: counts by direction and by certainty, gaps, how it was built | Top of the panel |
| L2 Structure | The graph (node-link), with a Matrix toggle | Middle of the panel |
| L3 Preview | Hover card on any node or edge (also on keyboard focus) | Floats over the graph |
| L4 Detail | Pinned detail drawer: all claims of an edge, grouped by paper | Side drawer (bottom sheet on mobile) |
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
  static graph SVG, and all tables with quotes. JavaScript adds tabs, hover cards, the
  drawer, search, filters and the matrix toggle.

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
  `?` Unclear. Colour is redundant only: increase = teal, decrease = rust, mixed =
  ochre, no effect = slate grey, unclear = light grey. Check text contrast (WCAG AA)
  on both light and dark themes.
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
Its own chip shows its direction and certainty. Its hover card shows
`direction_meaning` verbatim and names the target edge.

### 3.5 Gaps

Draw each gap as a **dashed, hollow** link (no arrowhead, light stroke) with a text
label "No evidence" on it. Hover card: "No study in this corpus tested this pairing.
This is a gap, not a negative result." plus `searched_for` verbatim. Never draw a
gap like a weak or negative edge.

### 3.6 Focus + context (scalability)

These are what keep a large graph readable. Implement all of them:

1. **Hover / focus highlight.** Hovering or focusing a node keeps the node, its
   edges and its neighbours at full opacity and fades the rest to about 15%.
   Hovering an edge keeps the edge and its two ends (for a moderation edge: the
   source and the target edge). For a condition node, highlight in-edges and
   out-edges in two visibly different styles and show the path-honesty note.
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

### 3.7 Hover card (L3) and drawer (L4)

Hover card (on mouse hover, and on keyboard focus; a short delay is fine):

- Edge: `Source → Target`, direction glyph + word, certainty dots + word,
  `certainty_rationale` verbatim, "N studies · M claims", a small horizontal bar of
  `study_directions` (numbers printed, not colour only), and up to 3 paper titles
  (year) with "+K more". Footer hint: "Click to pin and read the quotes".
- Node: label, kind text from `node_kinds`, number of in-edges and out-edges, and a
  mini list of its edges (glyph + dots + other end). Combination: its members.
- Gap / moderation: as in 3.4 and 3.5.

Click (or Enter / Space) **pins** the item into the drawer:

- Edge or finding: the header as in the hover card, then its claims grouped by paper
  (paper title, year, DOI link or document_id), each claim with `subject` →
  `predicate` → `object`, its own direction, `certainty_grade`, `evidence_types`,
  `comparator`, and the **quote** in a block quote. Order papers by number of claims.
- Node: all its edges (each one opens that edge), and for a condition node the
  path-honesty note.
- The drawer has a close button, traps nothing, and returns focus to the item that
  opened it. Esc closes it.

## 4. Visual style: hip and minimal

Aim for a calm, editorial look (in the spirit of the Anthropic and Kimi sites), but
do not copy any brand, logo, name or font.

- Light theme: warm off-white page (about `#FAF9F5`), near-black text (about
  `#1F1E1D`), muted grey secondary text, 1 px hairline borders, 12–16 px radius
  cards, almost no shadow. One accent colour (a warm clay, about `#C96442`) for
  focus rings, the selected tab and links.
- Dark theme with `prefers-color-scheme: dark` (warm near-black background).
- Type: system stacks only (no web fonts). Headings `ui-serif, Georgia, "Iowan Old
  Style", serif`; body `ui-sans-serif, system-ui, -apple-system, "Segoe UI",
  sans-serif`; ids `ui-monospace, SFMono-Regular, Menlo, monospace`. Generous line
  height, max text width about 72 ch.
- Lots of white space. Motion is short (150–200 ms) and off with
  `prefers-reduced-motion`.
- Responsive: at phone width the drawer becomes a bottom sheet, the graph scrolls
  horizontally inside its own box (not the page), and tables become stacked cards.

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
