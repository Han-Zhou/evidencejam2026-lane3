# Rank 1: Python standard library generator

## Build and serve

```bash
./build.sh            # writes site/ next to this file
./build.sh /tmp/out   # or any other directory
python3 -m http.server 8101 --directory site
```

`build.sh` runs `python3 build.py`. The build reads `../../answers/q1_tree_planting.json`
and `../../answers/q1_tree_planting_graph.json`. It makes no network call and no LLM call.
Two builds of the same input give byte-identical output.

## Dependencies

- Python 3.12 (tested with 3.12.4). Standard library only: `html`, `json`, `re`, `shutil`,
  `pathlib`, `collections`.
- No pip packages, no npm, no lock file. Nothing to install.
- No native binary. Nothing is specific to an architecture, so it runs on aarch64 Linux.
- The browser side is vanilla JS and CSS: `src/app.js` and `src/style.css` + `src/graph.css` on
  the first view; `src/explore.*`, `src/snap.js` and `src/export.js` load on first use. The build
  strips comments and indentation from them. No framework, no CDN, no web fonts.

## Build time

`time ./build.sh`: 0.08 s wall clock (0.04 s user), on an Apple Silicon laptop.
There is no install step.

## Files shipped (bytes)

| File | v6 bytes | v5 bytes | When it loads |
| --- | ---: | ---: | --- |
| `index.html` | 63,815 | 64,886 | first view |
| `style.css` | 24,199 | 22,434 | first view (`src/style.css` + `src/graph.css`) |
| `app.js` | 33,848 | 32,147 | first view |
| `explore.js` | 20,973 | 21,117 | on the first click on "Expand" |
| `explore.css` | 6,326 | 6,519 | the same |
| `snap.js` | 5,042 | 5,042 | on the first hover, focus or click on "Copy image" |
| `export.js` | 10,458 | 10,458 | on the first click on "Export CSV" or "Export XLSX" |
| `data/findings.json` | 119,781 | 119,781 | on the first click, search or matrix in Findings |
| `data/network.json` | 171,473 | 171,473 | the same, in Network |
| `claims-findings.html` | 181,974 | 181,974 | only when a reader follows a link (the no-JS road to every quote) |
| `claims-network.html` | 259,241 | 259,241 | the same |
| **Total** | 897,130 | 895,072 | |
| **First view** | **121,862** | **119,467** | `index.html` + `style.css` + `app.js` (not gzipped; `http.server` does not compress) |

v6 adds 2,395 bytes to the first view: the status-line descriptions, the pinned view bar, the
action row and the matrix stack. The line-width and system-theme code that was removed was smaller.

v5 cuts the first view by 52,989 bytes, because the tables, the glance strip and the HTML legend
are commented out. The in-graph legend adds about 6.6 KB back.

The first view grew by 5,219 bytes: the two theme token sets, the toggle, the status line and
the pathway code. The hover-card code that was removed was smaller than what was added.
v3 adds 1,590 bytes more (the faint-line rules, the compact strips and one legend line).
v4 adds 2,254 bytes more (the two Expand buttons, `data-label` on each node, the loader).
The expanded view itself (27,636 bytes) loads only when a reader opens it.

## Changes in v6

Six requests drove this version. Four agents did the work in parallel, each in its own git
worktree. The four branches were then merged.

**1. One line width.** Line width does not show the number of studies any more. Every evidence
line is 2.1 px (the old width for 1 study). Gap lines (1.6 px, dashed), moderation lines (3 px,
dotted) and membership lines keep their own styles. `stroke_w()` is gone from `layout.py`. In
its place, `LINE_W` holds the width for each line kind, and every arrowhead has one size
(`ARROW_HW`). Ports still spread, so lines do not merge. The edge paths have no
`stroke-width` attribute; CSS sets it. The "Line width" column is gone from the in-graph legend,
and the legend direction swatch is 2.1 px to match. The expanded view does the same. Study counts
stay in the chips' `aria-label`, the drawer, the status line and the exports.

**2. Light is the default theme.** The page does not follow `prefers-color-scheme` any more.
Dark shows only when the reader selects it with the toggle (`localStorage` `q1-theme`, applied
before first paint as before). Without JS the page is always light. The one dark token block is
`:root[data-theme="dark"]` (the same values, with `color-scheme: dark`).

**3. The view bar is pinned at the top.** The row above the graph has three parts: Graph | Matrix,
Expand and the status line. It is sticky. With the toolbar at the top, the row stays directly
under the toolbar (`top: calc(var(--dockh) + 16px)`, `z-index` 19, under the toolbar's 20, so
search results stay on top). With the toolbar at the bottom, left or right, the row stays at
8 px from the top. Below 1100 px only the status line stays (`.vbar` is `display: contents`).
When a node gets keyboard focus under the pinned row, the page scrolls so the node shows.

**4. The status line describes the selection.** It uses only values from the pack. Direction is
shown as a glyph and a word, and certainty as dots and a grade, never by colour alone:
- Edge: `Mycorrhizal or soil inoculation → Seedling survival · ↕ Mixed (studies disagree) ·
  ●●●○ Moderate certainty · 2 studies · 4 claims`
- Moderation: `Fertilization at planting changes the effect of Site preparation → Seedling
  growth & size · ↑ Increase · ●○○○ Very low certainty · 1 study · 2 claims`
- Gap: `… → Seedling survival · No evidence · No study in this corpus tested this pairing. This
  is a gap, not a negative result.`
- Node: `Site preparation · Site treatment · Pathways: 12 edges (5 direct, 7 further)`. A second,
  smaller line keeps the path note: "Lighter lines are further steps. Edges beyond the first
  step are separate bodies of evidence. A path is not one tested effect."
- Paper: `Paper: <title> (<year>) · cited by 6 edges`. Interaction claim (Findings): one claim,
  not a pooled finding, not drawn in the graph.

The live region (`.sd`, `role="status"`) holds only this text. Clear (and "Details below" under
900 px) sit outside it. The text is rewritten only when it changes.

**5. Copy image, Export CSV and Export XLSX are at the bottom right.** They are a right-aligned
row (`.gact`) at the bottom of a new graph card (`.gcard`). The row is not over the graph. The
`data-act` hooks and the lazy loading of `snap.js` and `export.js` are as before. "CSV" and
"XLSX" are now "Export CSV" and "Export XLSX". In Matrix view, "Copy image" is hidden, because
it copies the graph, and the graph is not on the screen.

Items 4 and 5 make the area above the graph one short row: the status line no longer wraps
beside six buttons. On Network at 1440 × 900 the graph card starts at 408 px (before: 428 px).

**6. The matrix uses the same box as the graph.** At start-up, `stack()` in `app.js` puts `.gbox`
and `.mbox` into one grid cell (`.vstack`). Thus the cell is as tall as the graph. In Matrix view
the graph has `visibility: hidden`. It keeps its size, but it is not in the tab order or the
accessibility tree. The browser keeps the two sizes the same on resize, on a tab change and in
every dock position. No JS measures them. The table fills the width and the height: the row-header
column is 11rem (8rem at 700 px or less) and the target columns share the rest. Below the minimum
width, the box scrolls sideways, and the row labels stay in view. Box sizes at 1440 × 900: Network
984 × 997, Findings 984 × 844, for the graph and for the matrix. Before, the Findings matrix was
460 px wide.

**Checks.** `check_site.py` PASS. Two builds are byte-identical. Headless Chrome with a dark
system setting: the page opens light. Effect lines are all 2.1 px. The graph box and the matrix box
are the same size in both panels. A matrix cell writes its description to the status line. After a
scroll, the status line stays at 116 px. CSV download works. There is no horizontal scroll at
390 px and there are no page errors. Each agent also tested its own part. Lighthouse and axe-core
were not run.

## Changes in v5

Seven requests drove this version. Four agents did the work in parallel, each in its own files.

**1. Minimal text above the graph.** Above the graph there is now only the `h1` with the theme
toggle, the question, two compact tabs (name and one counts line), the toolbar and the view
bar. The eyebrow, the "At a glance" strip, the tab descriptions, the search hint, the visible
"Search / Lens / Direction / Certainty" labels and "View as table" are gone. The panel `h2` and
the "Search" and "Certainty" labels stay for screen readers only. Certainty options say
"Any certainty", "Low certainty or higher" and so on.

**2. Everything after the graph is commented out, not deleted.**
- `build.py`: in `panel_html()` the HTML legend, the "Tables" heading and all `<details>`
  sections, Limitations, the how-built link, `.vat` and the glance strip; in `index_html()` the
  footer.
- `app.js` (block marked "tables (switched off)"): `renderClaims`, `renderPapers`, `sortable`,
  `moreBtn`, `pageTables`, `sortBy`, the details toggles and the table parts of `refresh()`.
- `style.css`: the rules that styled only those parts.
- The drawer stays. It is beside the graph and it is the route to every quote.
- The 5 Panel A interactions now carry `data-interaction-id` and `data-direction` in
  `claims-findings.html`, so `check_site.py` still passes without the interactions table.
- A hidden `#pathnote-network` stays, because `explore.js` reads it for its footer.
- A no-JS link "All claims and quotes" sits in the heading row (hidden when JS runs).

**3. Sticky toolbar with a position switch (experimental).** Four icon buttons in the toolbar
set the position: top, bottom, left or right (`aria-pressed`; the group label names the
position). `localStorage` key `q1-dock`; `DOCK_JS` in the head script applies it before first
paint. Top: sticky. Bottom: the panel is a flex column and the toolbar uses `order`, so it sticks
to the bottom. Left / right: a 256 px column that scrolls inside itself. Search results use fixed
positioning and open below, above or beside the bar. `scroll-margin` keeps focused items out
from under the bar. Left and right fall back to top below 1100 px (the graph column gets too
narrow), and those two buttons hide there. Below 701 px the bar is one row that scrolls
sideways. The code is one CSS section and one JS block, so it is easy to remove.

**4. Copy image (`src/snap.js`).** "Copy image" puts a PNG of the panel graph, as it shows now
(theme, highlight, filters, lens, search), on the clipboard. It clones the SVG and writes the
computed styles inline, so `var()` is resolved. Scale is at least 2 (Network about
2032 × 2059 px). If the Clipboard API is missing or refuses, it downloads
`q1-<panel>-graph.png`. A hidden polite live region announces the result. `app.js` loads
`snap.js` on the first hover or focus of the button, so Safari keeps the write inside the first
click.

**5. CSV / XLSX export of the highlighted data (`src/export.js`).**
- Rows: with a selection, the items `related()` lights (filtered-out items are left out, so the
  count matches the status line); with no selection, every visible edge (filters, lens, search).
- Columns: panel, edge id, kind, from, to, from id, to id, step (exact, from the new `R.hop` in
  `related()`), step note, direction, direction label, certainty, certainty label,
  certainty_rationale, studies, claims, study directions, claim directions, searched_for, claim
  ids, document ids. A gap's direction is its pack `status` (`no_evidence`).
- CSV: RFC 4180, CRLF, UTF-8 with BOM. A text cell that starts with `=`, `+`, `-`, `@`, tab or
  CR gets a leading `'` (formula guard). No pack value triggers it today.
- XLSX: a plain-JS Office Open XML writer (ZIP store method, CRC-32), sheets "Edges" and
  "Claims" (one row per claim with quote, paper, year, DOI), bold frozen header, inline strings.
  Checked with Python `zipfile` and `xml.etree`, and macOS Quick Look. Not opened in Excel.
- File names: `q1-<panel>-<selection or all/visible>[-lens-…][-search-…][-no-…].csv|xlsx`.

**6. Chip column titles.** "Effect · certainty" with "arrow: direction · dots: certainty" sits
above the Findings chip column and above each chip column between lanes in Network. The Network
layout is unchanged (the user chose this). The legend explains the chips that sit in the
Conditions lane: they are edges that go straight from a stock or treatment to an outcome.

**7. Legend inside the graph.** A band under each graph, inside the SVG, below a thin rule
(`layout.legend_place()`, `build.py` `legend_spec` / `svg_legend`, styles in `src/graph.css`).
The viewBox grows downward; the graph scale does not change. Content: direction, certainty
dots, line width, "No evidence" with `GAP_NOTE`, the JS-only faded-line row; Network also has
moderation, member link, node kinds, the lane-chip note and `limitations[0]` word for word.
It uses only its own classes under `.glg`, no hook attributes, so it never fades, is not
focusable and does not leak into Expand. `role="group" aria-label="Legend"`. The copied PNG
includes it. Text widths are estimated at 1.18 × the SF Pro estimate, so wider Linux fonts still
fit. The build now also stops when a title or legend line can pass the viewBox, or when legend
text overlaps a node, chip, label or line.

**Checks.** `check_site.py` PASS. Two builds are byte-identical. One headless Chrome run with all
features: no page errors (only a `favicon.ico` 404, as before); node click: "12 edges
(5 direct, 7 further)"; edge click: 4 quotes; CSV 12 rows with steps 1 and 2; XLSX downloads;
"Copy image" puts the PNG on the clipboard; all four dock positions; no horizontal scroll at
390 px. Lighthouse and axe-core were not run.

## Changes in v4

Two requests drove this version.

**1. The faded parts keep their colour.**

- With JS on, every line, arrowhead and moderation diamond draws in its own direction colour at
  `--fade` opacity (`.3` light, `.4` dark), not in grey. Chip outlines are at 45%; chip glyphs
  and dots keep full colour and contrast. Membership connectors are at 50%.
- Active items (the `.on` class) go to full opacity. Further-step lines keep the 42% opacity.
  The `--faint` token is gone.
- The hint now says "Click a node to highlight its pathways." The legend line says "Faded line:
  an edge that is not selected. Select a node or an edge to show it at full strength."

**2. An expanded view in a note-graph style, with zoom and node search.**

- An "Expand" button sits beside Graph | Matrix in both panels. It opens a full-screen dialog
  (`role="dialog"`, `aria-modal`). The page behind it is `inert` while it is open.
- `src/explore.js` and `src/explore.css` hold all of it. `app.js` loads both on the first click
  only, so the first view does not carry them.
- Look: a plain white or `#1E1E1E` canvas, round grey nodes sized by number of edges, straight
  lines, labels under the nodes, and a purple accent for the selected node and search matches.
  Node kinds differ by shape: filled circle (planting stock, factor), filled square (site
  treatment), hollow ring (condition), circle with an outer ring (outcome), dashed ring
  (combination). Every text pair passes AA (lowest 4.70, dark `--text-3` on `#262626`).
- Same content as the panel: the view reads nodes, edges, gaps, membership links, directions,
  grades, line widths and `aria-label`s from the panel's own SVG (plus a new `data-label` on
  each node). Every edge keeps its chip (glyph + dots), arrowhead and line width. A gap is a
  dashed line with a "No evidence" chip. A moderation line ends in a diamond on the border of
  its target edge's chip. A combination node's label names its members, and thin dotted
  lines join it to them.
- Layout: a small force simulation (many-body repulsion, link springs, a pull towards the
  node's lane and a pull to the middle row). It starts from the panel layout, so it is
  deterministic. It runs 320 steps before the first paint. The settings came from a grid
  search for a wide shape with few chip overlaps. After each frame, chips slide along their
  own lines until they are off nodes, labels and other chips.
- Zoom: wheel or trackpad pinch (at the pointer), two-finger pinch on touch, the − / + / Fit
  buttons, and the keys + − 0 when the canvas has focus. Range 20% to 500%. Chips and labels
  keep a readable size when zoomed out. Pan: drag the canvas, or arrow keys.
- Drag a node to move it. The layout reacts while you drag and settles when you let go, as in
  note-graph apps. Under `prefers-reduced-motion` there is no animation and the node stays
  where you drop it.
- Node search: a search box at the top left. Matches get a purple ring and everything else
  dims. A list shows the matches (arrow keys move through it). Enter or a click centres and
  zooms on the node and selects it.
- Shared state: the view's elements join the panel's index, so selection, pathway highlight,
  the drawer, the hash and the toolbar filters and lens all act on both graphs. While the
  dialog is open, the drawer column and the status line move into it (the drawer is a side
  column, under the canvas below 900 px). The footer has a short legend, the controls and the
  path note. A click on empty canvas clears the selection. Esc clears the search first, then
  closes. Closing puts the drawer and status line back and returns focus to "Expand".
- Tested in headless Chrome: open, keyboard select of a node and an edge (8 pathway edges lit
  in both graphs, 4 quotes in the drawer), + zoom (91% → 114%), Esc close (no `inert` left,
  drawer and status line back, focus on Expand), node drag, wheel zoom, search and the narrow
  layout. Animation frames do not run in headless virtual time, so a timer also sets the
  final view of each zoom animation.

## Changes in v3

Three requests drove this version.

**1. The graph has more weight on the page.**

- The page is wider: `max-width` 1320 px → 1560 px. The drawer column is 340 px (was 360 px),
  so the graph column gets the rest.
- The SVG can grow to 1.2 times its layout width (`max-width` on the `<svg>`), so it fills a
  wide column. The Findings layout is wider (`cg` 120 → 160), so its curves are gentler.
- Less chrome above the graph. The panel cards show the name and the description on one line
  and all counts on a second line. "At a glance" is one strip: heading, counts and the
  "How this was built" toggle share two rows (it opens to full width). The toolbar, panel and
  header spacing is tighter. The status line now sits in the view bar, between
  Graph | Matrix and "View as table", not in a row of its own.
- At 1440 × 900 the Network graph starts at about 665 px from the top (was about 1020 px).

**2. Blue is now green.**

- `--inc` (Increase) is `#0B6E4F` light and `#48D5A6` dark. Contrast: 5.10 or more on every
  background (light), 8.38 or more (dark); `--pill-text` on it is 6.25 (light) and 9.93 (dark).
  Of the greens tested, these keep the most distance from `--dec` red under simulated
  deuteranopia and protanopia. The glyphs (↑ ↓ ↕ = ?) still carry direction without colour.
- `--focus` was also blue. It is now the text colour (`#1A1A1A` light, `#DADCDE` dark), not
  green, because green now means Increase. A green outline on a red chip would mislead. The
  focus ring and the selected outline match the black (white in dark) pills. Contrast: 14.2
  or more (light), 11.29 or more (dark).
- The "Show gaps" checkbox uses `accent-color: var(--pill)`, so it is not system blue.

**3. Connections are faint until they are active.**

- With JS on, every line, arrowhead, moderation diamond and membership connector draws in
  `--faint` (`#C5C9CE` light, `#3A444E` dark). Chips draw with a `--line-strong` outline and a
  `--text-2` glyph and dots, so direction and certainty stay readable with no colour.
- An item is active when it is on the pathway of the selected node, or it is the selected edge,
  gap or paper's edge (the `.on` class that `highlight()` already sets). Active lines,
  arrowheads, diamonds and chips take their direction colour. Further-step lines keep the 42%
  opacity. An active gap line goes back to `--text-3` dashes. The rest still fades to 12%.
- Without JS nothing can be selected, so the graph keeps its full colours.
- The hint says "Click a node to colour its pathways." The legend has a new line: "Grey line:
  an edge that is not selected. Select a node or an edge to show its direction colour."
- The faint lines are about 1.6:1 against the canvas. This is on purpose (the user asked for a
  faint shade). The information is in the chips, which keep full text contrast.

## Changes in v2 (SPEC sections 0, 2, 3.3 to 3.7 and 4)

Two requests drove this version.

**1. Light and dark themes in a cool monochrome editorial style, with a toggle.**

- `style.css` uses the SPEC 4.1 tokens exactly, for both themes. The default follows the
  system (`prefers-color-scheme` under `:root:not([data-theme="light"])`), and
  `:root[data-theme="dark"]` sets the dark tokens too.
- A round toggle button sits at the top right of the header (moon or sun as inline SVG,
  `aria-label` "Switch to dark theme" / "Switch to light theme", `aria-pressed`). It sets
  `data-theme` on `<html>` and stores the choice in `localStorage` (`q1-theme`, every call in
  `try/catch`). A one-line inline script in `<head>`, before the stylesheet, applies the stored
  choice, so there is no flash. The claims pages run the same line, so they follow the choice.
  Without JS the button is hidden and the system theme still works. (v6: the system theme is
  not used any more. Light is the default; see v6.)
- The SVG has no hard-coded colour. Nodes, edges, chips, markers, gaps and lane titles use the
  CSS variables, so both themes apply to the graph.
- Look: cool grey page, flat near-white cards with 16 px radius and no shadow, serif for
  headings and reading text (question, how built, rationales, quotes, limitations), sans for UI,
  mono with tabular numbers for counts, ids and certainty dots. Selected tabs and segments and
  the Clear button are solid black pills (white pills in dark). Links are text colour with a
  hairline underline. Colour appears only in the data (direction lines, arrowheads, chip
  outlines and chip text).
- The selected panel card has a 1.5 px text-colour border.

**2. No hover in the graph. A click on a node lights only its active pathways.**

- All hover-card code is gone (the `#hc` element, `showCard`/`hideCard`/`placeCard`/`card`,
  the `mousemove`, `mouseleave`, `focusin` and `focusout` handlers and the hover fading).
  Hover now changes only the cursor and the hovered element's own outline (node border, chip
  border, gap border, or a faint band along an edge line). Keyboard focus shows only the
  focus ring. SVG `aria-label`s stay for screen readers.
- A click (or Enter / Space) on a node selects it. `related()` in `app.js` walks the graph
  breadth-first downstream and upstream from the node, so each edge gets its step count. It
  adds gaps that touch the node, a moderation edge whose source is the node (plus its target
  edge) or whose target edge is active, and combination membership (the member's own connector
  and the combination node, or all members when the node is the combination). Active edges,
  their chips and their end nodes stay at full strength; the rest fades to 12%. The selected
  node gets a 3.5 px focus-colour outline.
- Path honesty: one-step edges draw at full strength. Lines and arrowheads two or more steps
  away draw at 42% opacity; their chips stay at full strength so their text stays readable.
  Nothing is added or multiplied along a path.
- A status line above the graph says what is selected, with counts made by counting edges,
  for example "Pathways through Site preparation: 12 edges (5 direct, 7 further)", plus gaps
  and "hidden by filters" when there are any, and a Clear button. When there are further edges,
  a second line says "Full lines are one step from Site preparation; lighter lines are further
  steps. Edges beyond the first step are separate bodies of evidence. A path is not one tested
  effect." With nothing selected it shows a one-line hint. It is a polite live region.
- A click on an edge, its chip or a gap selects it: the edge and its end nodes stay bright (for
  a moderation edge: its source, line, diamond, chip and the target edge with its ends).
- A second click on the same item, a click on empty canvas, Esc, Clear or the drawer's × clears
  the selection. Esc, Clear and × return focus to the item that opened it.
- The hash records the selection: `#network/node/site_preparation`,
  `#findings/node/survival`, `#network/edge/...`. Opening such a link restores the highlight and
  the drawer.
- Table rows, search results, drawer links and matrix cells select the same way, so the graph
  highlight follows them. A paper (from search or the Papers table) lights the edges that cite it.
- The drawer never covers the graph. On wide screens it is a column beside the graph, exactly as
  tall as the graph column, and a long drawer scrolls inside itself. Below 900 px it sits in the
  page flow under the graph (no bottom sheet, no overlay). There, a node click keeps the
  highlighted graph in view and the status line offers "Details below"; an edge click scrolls
  the drawer to the top of the screen, so the quotes are one click away.

## Layout

`layout.py` computes the graph at build time and writes it as inline SVG. Without JavaScript,
the graph is still there.

- Lanes come from node `kind`. A chip column sits between two lanes. Every edge gets one
  item in each layer it crosses, and its chip is one of those items, so chips are stacked
  like nodes and do not overlap.
- Order in each layer: 4 barycenter sweeps (down and up). Ties break by the other side's
  barycenter, then by first-seen order in the JSON.
- Vertical places: isotonic regression (pool adjacent violators) keeps the order and the
  minimum spacing and pulls each item towards the mean of its neighbours.
- Ports spread along each node side, so lines do not merge. (Before v6 the spread followed the
  line width.)
- Curves are cubic Béziers. Edges that skip the condition lane pass through their own slot
  in that lane, not through a node label.
- The in-lane edge (Competing vegetation → Seedling nutrient status) is an arc on the lane's
  right side. Its chip sits in a free slot beside the lane.
- The build stops with an error if any chip, gap label or node box overlaps another.

## How the spec items were met

- **Accuracy (SPEC 1).** All directions, grades, rationales, counts, labels, quotes, titles,
  years and DOIs are copied from the JSON. The page only counts, sorts, filters and groups.
  Each panel reads only its own file. `check_site.py` prints PASS.
- **Machine-check attributes.** They are on the table rows and on the SVG chips, gap labels
  and Panel B nodes. The JavaScript uses the same attributes as its hooks.
- **Page structure (SPEC 2).** Header with the theme toggle, question, two panel cards. Without
  JS the cards are links and both panels show stacked. With JS they become a tablist (arrow
  keys work) and the hash records the panel and the selected item.
- **Graph (SPEC 3).** Chips show a direction glyph and certainty dots. Colour is only
  redundant. All evidence lines are 2.1 px (v6). Before v6, line width showed the number of
  studies (1.5 px + 0.6 px per study, capped at 7.5 px).
  Arrowheads sit at the target. Node kinds differ by shape: square corners for site
  treatments, a side bar for conditions, a double border for outcomes, a dashed border with
  member chips for the combination.
- **Moderation.** A dotted line in the edge's colour, with its own chip (dashed outline). It
  ends in a ◆ on the border of the target edge's chip. The drawer shows `direction_meaning`
  verbatim and links to the target edge.
- **Combination.** The node shows its two members as stacked chips. Thin dotted connectors
  without arrowheads join each member to it. The legend says "member of a combination — not
  an evidence edge".
- **Gaps.** A dashed, hollow link in `--text-3` with no arrowhead and a "No evidence" label. A
  click opens the drawer with the gap note and `searched_for`. In the matrix, a gap is a hatched
  cell. An empty matrix cell is blank, with the title "No claims in this corpus link these two".
- **Path honesty.** The first `limitations` string of the graph file sits under the graph. The
  condition drawer repeats it. The pathway status line says that further steps are separate
  bodies of evidence. No path is drawn or scored as one effect.
- **Focus and context (SPEC 3.6).** Click selection with active pathways, lenses, filters,
  search with grouped results, and the Graph | Matrix toggle all work. Filters act on the graph,
  the matrix and the tables together, and the toolbar count updates ("Showing 14 of 29 edges").
  `/` focuses search and Esc clears it.
- **Drawer (SPEC 3.7).** Edge: header, rationale, counts, study-direction bar with numbers,
  claims grouped by paper (most claims first), each with subject → predicate → object, its own
  direction, grade, evidence types, comparator and the quote. Node: kind text, members, the
  path note for a condition, and all its edges (each one selects that edge).
- **Tables (SPEC 5).** Findings or Edges (sortable, rationale in the row, 25 rows then
  "Show all"), Gaps, Interactions (Panel A: the 5 claims with their own directions) or
  Interactions & set aside (Panel B), Papers, Claims, Limitations.
- **Accessibility (SPEC 6).** Skip link, landmarks, one `h1`, unique ids, a 2 px focus ring in
  `--focus`. Every SVG button has an `aria-label` with the full content. Motion is off under
  `prefers-reduced-motion`.
- **Contrast.** All SPEC 4.1 text pairs pass AA on `--bg`, `--surface` and `--raised` in both
  themes (lowest: `--dec` on `--bg` light 4.84, `--text-3` on `--raised` dark 4.82). The one new
  pair is the study-direction bar: `--pill-text` on each direction colour, 5.94 or more in light
  and 6.00 or more in dark. The focus colour is at least 3.85:1 against every background.

## Deviations and items not done

- **Node corners.** Nodes have a 12 px radius (SPEC 4.3), except site treatments, which keep
  3 px square corners. This is the shape detail that SPEC 3.2 asks for so that the two lane-1
  groups differ by more than colour.
- **Chip border** is 1.25 px, not exactly 1 px, so the direction colour still shows when the
  graph draws at about 0.9 scale.
- **Further-step chips stay at full strength.** Only their lines and arrowheads are lighter.
  A 42% chip would fail the text-contrast rule.
- **Membership.** When a member node is selected, the combination node and the member's
  connector light up, but the combination's own edge does not (it is a separate body of
  evidence, and SPEC 3.6 lists only the connectors and the node).
- **Moderation steps.** A moderation edge lit because its target edge is active counts as a
  further step. When the selected node is the moderation source, the target edge also counts as
  a further step.
- **Paper selection lights its citing edges.** This is an addition, not in the spec.
- **Selected and focused look alike.** Both use `--focus`; the selected outline is thicker
  (3.5 px against 2.5 px).
- **v4 expanded view.** SPEC 0 says nothing floats over the graph. The expanded view is a
  full-screen dialog that covers the page on purpose; inside it, nothing covers the canvas
  except the search list while it is open. Its layout is a force layout, not the layered one,
  so it trades some order for the free look the user asked for. The panel graph is unchanged.
- **v3 token changes.** `--inc` is green and `--focus` is the text colour, not the SPEC 4.1
  blues. Lines are faded until active (v3: grey; v4: faded colour), which SPEC 3.3 does not describe (it asks for direction
  colour on every line). "At a glance" is still at the top of the panel (SPEC 0, L1), but as a
  compact strip.
- **Papers and Claims tables are built from the JSON in the browser** when their section
  opens. Without JS, the section links to `claims-*.html`, which has every claim and quote.
- **The matrix is built in the browser** on the first click on "Matrix". Without JS there is
  no matrix. The tables carry the same content.
- **Lenses are on Panel B only.** Panel A has no node kinds (SPEC 1.5).
- **No pan or zoom.** The graph fits its box on desktop. On a phone it scrolls sideways
  inside its own box.
- I did not run Lighthouse or axe-core (they are not installed and the build has no network).
  I checked the pages by hand and in headless Chrome: landmarks, heading order, unique ids, tab
  roles, focus return, no horizontal page scroll at 390 px, and text contrast (script above).

## Known issues

- On a viewport shorter than the graph column (about 870 px for Network), the bottom of the
  drawer column is below the fold; the page scrolls to it. The drawer is not sticky any more,
  because a sticky drawer taller than the graph scrolled its own header off the screen.
- A long selection description (most edges, gaps, the moderation edge, papers) uses two lines
  of the status line at 1440 px. When the line count changes, the graph moves down about 20 px.
  The full words "Mixed (studies disagree)" and "certainty" were kept on purpose.
- `app.js` is only whitespace-stripped (32 KB). A real minifier would cut it by about half,
  but that needs a tool outside the standard library.
- SVG label wrapping uses an estimated character width, not font metrics. A very wide
  fallback font could push a label past its node box.
- Some paper titles in the JSON contain literal `<i>` tags. They show as text, because the
  page shows titles verbatim and never parses data as HTML.
- `python3 -m http.server` sends no compression, so the byte counts above are also the
  transfer sizes.
