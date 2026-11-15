# Rank 1: Python standard library generator

Rank 1 is the official site. Its code was in `prototypes/rank1_stdlib/` and is now in
`sitegen/`. These notes are the release notes of each version, so older sections still
name the old paths.

## Build and serve

```bash
./build.sh site/      # from the repo root; runs sitegen/build.py
python3 -m http.server 8101 --directory site
```

The build reads `answers/*.json` and `groups/lane3_groups.yaml`. It makes no network
call and no LLM call.
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

| File | v7 bytes | v6 bytes | When it loads |
| --- | ---: | ---: | --- |
| `index.html` | 66,569 | 63,815 | first view |
| `style.css` | 21,838 | 24,199 | first view (`src/style.css` + `src/graph.css`) |
| `app.js` | 31,497 | 33,848 | first view |
| `explore.js` | 8,010 | 20,973 | on the first click on "Expand" |
| `explore.css` | 2,106 | 6,326 | the same |
| `snap.js` | 5,042 | 5,042 | on the first hover, focus or click on "Copy image" |
| `export.js` | 10,458 | 10,458 | on the first click on "Export CSV" or "Export XLSX" |
| `data/findings.json` | 119,781 | 119,781 | on the first click, search or matrix in Findings |
| `data/network.json` | 171,473 | 171,473 | the same, in Network |
| `claims-findings.html` | 181,974 | 181,974 | only when a reader follows a link (the no-JS road to every quote) |
| `claims-network.html` | 259,241 | 259,241 | the same |
| **Total** | 877,989 | 897,130 | |
| **First view** | **119,904** | **121,862** | `index.html` + `style.css` + `app.js` (not gzipped; `http.server` does not compress) |

v7 cuts the first view by 1,958 bytes. The dock code that was removed is larger than the
Limitations lists and the legend heading that were added. The expanded view is 17,183 bytes
smaller, because the force layout is gone.

v6 adds 2,395 bytes to the first view: the status-line descriptions, the pinned view bar, the
action row and the matrix stack. The line-width and system-theme code that was removed was smaller.

v5 cuts the first view by 52,989 bytes, because the tables, the glance strip and the HTML legend
are commented out. The in-graph legend adds about 6.6 KB back.

The first view grew by 5,219 bytes: the two theme token sets, the toggle, the status line and
the pathway code. The hover-card code that was removed was smaller than what was added.
v3 adds 1,590 bytes more (the faint-line rules, the compact strips and one legend line).
v4 adds 2,254 bytes more (the two Expand buttons, `data-label` on each node, the loader).
The expanded view itself (27,636 bytes) loads only when a reader opens it.

## Panel tours ("Want help?")

One **Want help?** button sits right after the page title. The title changes with the open tab,
and the button opens a short guided tour of the open panel only. Each step dims the page, lights
one part, and shows a small card beside it: the panel's tab name and the step number, a title,
one to three short sentences, sometimes a "Limit:" line, and Back / Next (Done on the last step).
The tours do not share steps.

| Panel | Steps file | Steps |
| --- | --- | ---: |
| Findings | `src/tour-findings.js` | 6 |
| Network | `src/tour-network.js` | 7 |
| Created marshes | `src/tour-marshes.js` | 7 |
| Gap map | `src/tour-gapmap.js` | 7 |

**Step order.** Findings sets the pattern: first how to read the panel and its findings, then the
details with the claims and quotes, then the tools, and the limitations last.
- **Findings:** how to read the graph, the findings, details (claims and quotes), views and the
  status line, search and filter, export and limitations.
- **Created marshes** follows the same order:
  1. The short answer.
  2. Evidence by marsh age (the coverage bar).
  3. The findings (one row; its limit gives the gap rule).
  4. When was it measured? The tour opens the fold-out under a row and closes it again on the
     next step. A fold-out the reader opened stays open.
  5. Details: claims and quotes.
  6. Filter the list.
  7. Limitations and method.
- **Gap map:** what the map shows, the colours, rows and columns, sort and filter, select a cell,
  details (claims and quotes), and the limitations and "How this map was built" (`.q3foot`).

**Files.**
- `src/tour.js` is the engine. The comment at its top gives the step format: `target` (a
  selector inside the panel, a function, or `null` for a centred card), `title`, `text`, `limit`,
  `place`, `pad`, `before` / `after`, and the tour-level `start` / `end`.
- `src/tour.css` holds the veil, the lit box and the card. It uses the page tokens, so the card
  follows the theme.
- `HELP_BTN` in `build.py` is the button (`button.helpbtn[data-tour=""]`, js-only). `index_html()`
  puts it after the `<h1>` in `.htitle`. The h1 is inline there, so the button follows the last
  word of the title at every width; it goes to the next line only when that line is full.
  `TOUR_PANELS` lists the four steps files that `build.py` ships.
- `app.js` (block "panel tours"): an empty `data-tour` means the open tab (`cur`). On the first
  click it loads `tour.js`, `tour.css` and that panel's steps file with `need()`. Nothing loads on
  the first view.
- The card takes the panel name from its tab (`#tab-<key>`), so it follows a tab rename. The
  `title` in each steps file is only the fallback.

**How it works.**
- **Lit part:** a fixed `.tour-hole` with a very wide shadow is the dark veil. A transparent
  `.tour-veil` under it takes the clicks.
- **Focus and keyboard:** every other child of `<body>` is `inert` while the tour is open. The
  card is `role="dialog"` and `aria-modal="true"`. The focus goes to its heading when the tour
  opens, then stays on Back or Next. A polite live region reads each new step. Esc closes, the
  arrow keys step, and Tab stays inside the card. The page keys (Esc, "/") wait while the tour is
  open. On close the page scroll goes back to where it was, and the focus goes back to the button.
- **Position loop:** one loop keeps the lit box on its part while the page scrolls, resizes or
  draws late (q2.js, gapmap.js and the drawers). The targets are read again every 400 ms. The
  lit box is cut to any parent box that scrolls (the graph and the gap map on a phone).
- **Scrolling:** the page scrolls only when the part is not in view. It keeps the part below
  the pinned toolbar and view bar, and scrolls again when the part grows in the first moments.
- **Card position:** right, left, below or above the part. When no side has room, the card goes
  to the corner that covers the least of the part. Below 700 px it docks at the bottom or the top.
- **Reduced motion:** no glide and no smooth scroll. **Forced colours:** an outline marks the lit part.

**State.** Each tour puts the panel back as the reader left it: view, lens, "Show all edges",
filters, selection, URL hash and scroll. When a step needs a selection and the reader has none,
the tour selects one example and clears it on the next step. It uses the hash (Q1 panels),
`Q2.go()` (Q2) or a cell click (Q3). A selection the reader made is never changed. The details
show one closed dropdown per paper (`details.pp`), so each Details step opens the first paper, to
light a claim and its quote, and closes it again. A paper that was open already stays open.

**Content rules.**
- The steps text has no numbers from the data, because those change when the pack rebuilds.
- The limits come from each answer file's `limitations` or from the judging rules:
  - A gap is not a negative result.
  - Mixed and no effect are findings.
  - A path through a condition is not one tested effect.
  - The gap map colour is study count, not direction or certainty.
- The Q2 tour says that time to reference is unknown. Its text has no digits, so `check_site.py`
  stays clean.

**Size.** The tours add about 1.4 KB to the first view: the one button, its CSS and the loader
(one button is 461 bytes less than the four panel buttons before it). On the first click: `tour.js` 10,652, `tour.css` 2,900, and one steps file of 4,055 to
6,728 bytes.

**How it was built.** One agent wrote the engine and the button. Then four agents worked at the
same time, one for each panel. Each one edited only its own steps file and tested it in its own
browser tab.

**Checks.**
- `check_site.py` PASS. Two builds are byte-identical.
- Browser at 1440 × 900 and 390 × 844, light and dark: every step of every tour lights its part.
- At 1440 the card covers none of the lit part. The one exception is Gap map step 3: the map
  fills the screen, and the card covers 6% of it.
- On a phone, a part that is taller than the screen is partly under the docked card (the graph,
  the drawers, the full map).
- After Done, × or Esc, the hash, scroll, view, edges toggle and selection were as before. No
  `inert` was left, and the focus was on "Want help?". No console errors.
- Lighthouse and axe-core were not run.
- In a hidden or background tab the browser slows its animation frames, so the lit box can lag
  until the tab shows.

## Q3 gap map panel (after v7)

The fourth tab, **Gap map** (after Q2's **Created marshes**), shows Q3 (`answers/q3_grassland_gaps.json`) as one matrix. It has
no graph view. When the tab is open, the page heading and question switch to Q3.

- **Rows** are the 16 outcome groups and **columns** are the 24 intervention groups, in the
  order of `groups/lane3_groups.yaml`. `build.py` reads only the group ids from it, line by line
  (standard library, no YAML parser).
- **Cells:** the fill is the density tier (the indigo tokens below). The four tiers, from lightest
  to darkest, are:
  - **thin:** 1 study (72 cells).
  - **some:** 2 to 3 studies (33 cells).
  - **dense:** 4 or more studies (8 cells).
  - **densest:** one of the pack's ten densest cells, `summary.densest` (10 cells).

  Thin, some and dense are the pack's own `density` values. All ten densest cells are dense in the
  pack. One cell outside the list has 5 studies, the same as the lowest cells in the list. The
  pack's list stops at ten, and the details of that cell say so.
- **No dots and no direction glyph are in the cell.** Colour alone shows the tier. Each cell's
  `aria-label` states the density, the studies, the direction, the certainty and the claims.
- **Certainty is not the fill, but it stays next to every finding:** in the status line, in the
  details (tier, dots and `certainty_rationale`), in the `aria-label` and in the exports. The
  judging rules require this.
- **Gaps** (`no_evidence`) have a neutral grey fill, a diagonal hatch and a dashed border, so they
  show as gaps. They never get an indigo fill and they never fade.
- **Sort and filter bar:** the first thing in the panel, like the Q1 toolbar (the same `.toolbar`
  box, sticky 8 px from the top). It has one group for the rows (outcomes) and one for the columns
  (interventions). Each group has a sort (pack order, A to Z, most filled cells, most studies) and
  a checklist of the rows or columns to show. Then come a minimum density (Any, Some or denser,
  Dense or denser, Densest only), "Hide empty rows and columns" and the count ("Showing 16 of 16
  outcomes, …"). "Most studies" adds the study counts of the cells, so a study that counts in two
  cells counts twice. Cells below the minimum density fade (they are not gaps) and leave the tab
  order. An open checklist moves left to stay inside the window. Keyboard focus is never left
  under the stuck bar: the page scrolls by the overlap, as `app.js` does for Q1. Below 701 px the
  bar wraps and does not stick (Q1's one-row bar that scrolls sideways would clip the
  checklists). The top-left cell of the table now only names the axes.
- **The legend** is above the table. Its heading is "Density". It shows the four tiers (swatch,
  name, meaning, then the count of cells in brackets, for example "Thin · 1 study (72)") and the
  gap entry. The legend entries wrap, so the legend never widens the page on a phone. **Export CSV, Export XLSX and Copy image** are
  at its top right. **Download PNG** is at the bottom right of the map.
- **Exports cover the map as shown** (rows, columns and density filter):
  - The CSV has one row per cell, with the pack values unchanged (direction, certainty, rationale,
    counts, density, `searched_for`, claim ids, document ids). A `density tier` column follows
    `density`.
  - The XLSX has three sheets. "Matrix" is the grid with indigo fills by density tier, and each
    cell says, for example, "Densest · 9 studies". "Cells" is the CSV rows and "Claims" has every
    claim with its quote.
  - The image is drawn on a canvas in the current theme. Its legend and its footer describe the
    density tiers. The footer also has the source, the gap note and the filters.
  - `export.js` now exports its CSV and ZIP writers. `sheet()` takes `{v, s}` cells and `book()`
    takes optional fills, so Q1's exports do not change.
- **Selecting a cell** shows a status line with "Go to details" and "Clear", and opens the details.
  The details show the density tier first, then the certainty with its dots, the rationale, the
  counts, the pack density, the study directions and the claims by paper with their quotes. A gap
  shows the gap note and `searched_for`.
- **Where the details show:** the details column is hidden until a cell is selected. From 900 px
  up, it opens at the right of the map (340 px, or 300 px below 1100 px) and sticks 12 px under
  the sort and filter bar while the page scrolls (`--q3tb`, the bar height, set by `gapmap.js`). A
  long drawer scrolls inside it. Below 900 px it opens under the map.
  The map keeps its cell size, so with the details open it scrolls sideways in its box. The row
  labels and the axis names stay at the left. When columns are hidden at the right, the
  right edge fades. The selected cell is scrolled clear of the row labels and of the fade. "Clear",
  ×, Escape or a second click on the cell closes the details, and focus goes back to the cell.
- **Files:**
  - `gapmap.js` and `gapmap.css` load the first time the tab opens. `data/gapmap.json` (64 KB)
    loads with them.
  - `data/gapmap-claims.json` (353 KB) loads on the first cell click or export.
  - The first view grew by 2.5 KB: the Gap map tab, the heading swap and the no-JS text.
- **Without JS**, the panel shows the question, the summary, the limitations and a link to
  `claims-gapmap.html`. That page lists every finding with its quotes and every gap, with
  `data-q3-finding-id` and `data-q3-gap-id`. `check_site.py` now checks those against the Q3 JSON
  (direction, certainty, studies, claims, density), and every Q3 claim id and quote.

**Density colours.** The fills are four tints of electric indigo (`#6F00FF`): the lightest tint
is thin and full indigo is densest. In dark mode, dim indigo is thin and bright indigo is densest.
The tokens are `--t1` (thin) to `--t4` (densest) in `style.css`, with `--t1-fg` to `--t4-fg` for
the text on them. Their values did not change. In `gapmap.css`, the `.k-thin`, `.k-some`,
`.k-dense` and `.k-densest` classes set them on a cell, and `.q3sw` is the legend swatch. The
`.t-*` certainty classes and `.cs` are removed from `style.css`. Gap cells use `--q3gap` (fill),
`--q3gap-line` (hatch) and `--q3gap-edge` (dashed border), with light and dark values in
`gapmap.css`. This grey is a little darker than the old gap grey. The PNG export uses the same
tokens. Every text pair passes AA in both themes (lowest: 6.0 to 1).

## Variant B: edges hidden until selected

Variant B is merged into main. Variants A (grey edges until selected) and C (non-planar graph,
faded Conditions lane) were not kept.

**Start state for each panel (after the merge).** "Show all edges" now has one setting for each
panel. `EDGES_ALL` in `build.py` sets the start state: Findings starts with every edge shown (the
button is pressed), and Network starts with the nodes only. The build writes the start state into
the HTML (class `ea` on `.panel`, and `aria-pressed` on its `.eab` button), so the first paint is
correct and no JS has to run first. The CSS rules are under `html.js .panel:not(.ea)`, not
`html.js:not(.ea)`. The status-line hint and the "Edges:" legend row follow the panel: Findings
says "Edges: all show at the start. Turn off “Show all edges” to see only the edges of the node or
edge you select." A click on the button changes only its own panel and writes the hint again. The
paragraphs below describe the variant as it was built. Where they say "both panels" or "one
setting", read them with this change. The README conflict below now applies only to Network.
Checks after the change: two builds byte-identical, `check_site.py` PASS, and headless Chrome
(Findings 14 of 14 lines at the start, 0 after the toggle; Network 0 of 30 at the start, 30 after
its toggle; the other panel does not change; no page errors).

**Merge with v7.** The v7 Expand moves the panel's own SVG into a dialog inside `.panel`, and the
"Show all edges" button stays outside the dialog. So the hiding rule now stops while
`html.xvopen` is set: Expand always shows every edge (30 of 30 in Network) and keeps the v6 hint.
When Expand closes, Network hides its edges again. The legend is part of the same SVG, so in
Expand the "Edges: hidden until…" row still shows. The "Edges:" row sits in the v7 legend at the
top of the graph, after "No evidence" and before v7's "Chips in the right column" row.

**Default state.** With JS, both panel graphs (Findings and Network) show the nodes only. Effect
lines, arrowheads, chips, gap lines and "No evidence" labels, moderation lines and diamonds and
membership lines are hidden. The layout does not change, so nothing moves when edges show. The
lane titles and the "Effect · certainty" chip column titles stay. The status line says "Click a
node to show its edges. Or use “Show all edges”."

**Selected state.** A node selection (click, Enter or Space, search, the hash, the drawer) shows
its pathway: the items that `related()` marks `.on`, in their direction colour, with their chips.
Further-step lines keep the 42% opacity. An edge selection (a chip, the drawer, search, the matrix,
the hash) shows that edge and its end nodes. A paper shows the edges that cite it. Esc, Clear,
the drawer's ×, a second click and a click on empty canvas hide the edges again.

**"Show all edges".** A toggle button (`.eab`, `aria-pressed`) sits in the view bar after Expand.
When it is on, `<html>` has the class `ea` and the graph looks and acts as in v6. One setting
applies to both panels. It is not stored.

**How it works.**
- `src/style.css`, section "variant B": under `html.js:not(.ea)`, every `.ln`, `.chip`, `.gapl`,
  `.dia` and `.mem` that is not `.on` has `visibility: hidden`. Thus a hidden chip is not in the
  tab order or the accessibility tree, and it cannot take a click. The `.hit` path of a line used
  `pointer-events: stroke`, which ignores visibility. With JS it is now `visibleStroke`.
- `src/app.js`, block "variant B": the toggle, the hint text and `keepFocus()`. When a focused chip
  hides (a second Enter on it), the focus goes to the source node of its edge. `clear()` does the
  same when the item that opened the selection is now hidden. A `MutationObserver` on the class of
  `<html>` writes the hint again when `ea` or `xvopen` changes.
- `build.py`: the `.eab` button in `panel_html()`, and one JS-only legend row in both panels:
  "Edges: hidden until you select a node or an edge, or use “Show all edges”." The legend
  overlap and bounds check still passes.
- Without JS, every edge shows, as before, and the toggle and the legend row are not shown.
- The expanded view (`.xg`) is not changed. It shows all its edges, and its status line keeps the
  v6 hint.
- Below 701 px the view buttons wrap, so the row is not wider than the screen.

**Size.** First view 124,014 bytes (v6: 121,862): `index.html` +520, `style.css` +572,
`app.js` +1,060.

**Conflict with the README.** The README asks the graph to "show every node and edge, with
direction and certainty readable without hovering". In its default state this variant does not do
that: the edges are hidden until a selection. This is on purpose. Every edge is one click away
("Show all edges"), and every edge is also in the matrix and in the drawer of its end nodes. A
judge who opens the page sees nodes only. If the variant is kept, "Show all edges" could be on by
default.

**Other effects.**
- "Copy image" copies what is on the screen, so in the default state the PNG has nodes only.
- "Export CSV / XLSX" with no selection still exports every edge that the filters leave, not the
  (empty) set of edges on the screen.
- The view bar has one more button, so the status line is about 130 px narrower at 1440 px. A
  long selection description wraps to two lines a little more often.
- No node cue was added (for example a count of edges on each node). The node `aria-label`
  already gives the edges in and out.

**Checks.** Two builds are byte-identical. `check_site.py` PASS. Headless Chrome at 1440 × 900,
light and dark theme, both panels: in the default state 0 of 30 lines and 0 of 29 chips show in
Network (0 of 14 and 0 of 13 in Findings), and all nodes show. Site preparation shows 12 lines and
12 chips (with the moderation diamond and one membership line). Seedling survival (Findings) shows
6 findings and the gap. "Show all edges" shows all items. A click on empty canvas, Esc and a
second Enter hide them again. Edge selection from the hash, search, the drawer and a matrix cell
shows one line and one chip. A paper from search shows 3 edges. Tab in the default state reaches
nodes only; with a node selected it reaches the 12 shown chips and never a hidden one. After a
second Enter on a chip, the focus is on the source node. A click on the place of a hidden chip
selects nothing. Expand shows 30 of 30 edges. Without JS all 44 lines show. No horizontal scroll
at 390 px. No page errors (only a `favicon.ico` 404). Lighthouse and axe-core were not run.

## Changes in v7

Five requests drove this version. Four agents did the work in parallel, each in its own git
worktree: A (items 1 and 2), B (item 3), C (item 5) and D (item 4). The four branches were then
merged into main.

**1. The toolbar stays at the top.** The switch for the toolbar position (top, bottom, left,
right) is removed: `DOCK_JS`, the `q1-dock` key, the four icon buttons and the bottom, left and
right CSS. The toolbar always sticks at the top, and the view bar stays pinned under it.
`app.js` measures the toolbar height into `--tbh` (was `--dockh`); the view bar and
`scroll-margin` use it. Below 1100 px only the status line pins. Below 701 px the toolbar is one
row that scrolls sideways. A stored `q1-dock` value has no effect.

**2. Limitations under the graph.** Each graph card has a "Limitations" block at the bottom
(`limits_html()` in `build.py`, in a new `.gfoot` that also holds Copy image and Export). It lists
every string of the panel's own file, word for word, read at build time:
- Findings: `limitations` in `answers/q1_tree_planting.json` (4 strings).
- Network: `limitations` in `answers/q1_tree_planting_graph.json` (4 strings).
A source line under the heading names the file and the field. The block is HTML, so it shows
without JS and in Matrix view. The hidden `#pathnote-network` element is removed (nothing reads
it now). `limitations[0]` of the graph file shows twice in Network on purpose: as the
"Paths through a condition" row of the legend (a reading rule) and in the full list.

**3. The legend is at the top of each graph.** The order inside the SVG is: the heading
"How to read this graph", the legend columns and notes, a thin rule, then the lane titles and
the graph. The graph keeps its coordinates and scale: the legend sits at negative y, and the
viewBox starts above it (`layout()` returns `top`; Findings starts at y -170, Network at -253).
The legend is first in DOM order, so a screen reader meets it before the graph. It keeps `.glg`,
has no hook attributes and is not focusable. A legend column with no head and no rows is left
out. The build also stops when a text box passes the top or bottom of the viewBox, or when a
node, chip, title or line goes above the rule. The copied PNG has the legend at the top. At
1440 × 900 the first node is about 200 to 250 px lower than in v6.

**4. Expand shows the same graph, large.** The force-directed note-graph view is removed: the
simulation, node drag, round nodes, chip sliding, node search and the footer legend.
`explore.js` now moves the panel's live SVG into a full-screen dialog and puts it back on close.
A blank SVG with the same viewBox and size holds the panel box, so the matrix in the same cell
keeps its size. No id is duplicated, and the handlers of `app.js` do the selection. Zoom and pan
change only the viewBox, so the graph stays sharp; Fit reads the full viewBox (also its negative
y) and is the view on each open. Range 20% to 500%. Wheel, pinch, − / + / Fit, the keys + − 0
and the arrows, and drag (also from a node) work. A drag is not a click. The drawer and the
status line move into the dialog; filters, lens and search stay. Esc closes and returns focus to
Expand. On a phone, Fit is small (Network about 36%); the reader pinches to zoom in.

**5. Two chip columns in Network.** Before, Network chips sat in three places: between the
stock and treatment lane and Conditions, inside the Conditions lane (edges that go straight
from a stock or treatment to an outcome) and between Conditions and Outcomes. Now an edge that
skips the Conditions lane has its chip in the column next to its target lane. So:
- Left column: 10 stock or treatment → condition chips and the moderation chip.
- Right column: 19 chips: 5 condition → outcome, 11 direct, the combination chip, the arc chip
  and the "No evidence" label.
Two is the minimum while each chip stays on its own line: an edge into a condition and an edge
out of one never cross the same vertical line. One column would need each condition drawn
twice. A line now runs straight through its own slot in a lane and through its own chip, with
flat curves between, so no line cuts a node or runs under another chip (v6 had 13). The arc
(Competing vegetation → Seedling nutrient status) is a hairpin to its chip in the right column.
"Effect · certainty" shows only above columns that hold chips. The legend row is now "Chips in
the right column: some are for edges from a stock or treatment straight to an outcome." The build
stops if a chip is in a lane or a line cuts a node or a chip. Network viewBox height 1015 → 990.
Findings is unchanged (one column).

**Checks.** `check_site.py` PASS. Two builds are byte-identical. Headless Chrome on the merged
site, both panels, light and dark, 1440 × 900 and 390 px: no page errors (only the old
`favicon.ico` 404), no horizontal scroll, no `data-dock` left, legend above the first node,
4 limitations with their source line under each graph, Network chips at exactly two x
positions, toolbar at 8 px and status line at 116 px (71 px at 390) after a scroll, Expand opens
with the graph and its legend, a chip click in the dialog shows 5 claims in the drawer, Esc
leaves no `inert` and puts the SVG back. Each agent also tested its own part. Lighthouse and
axe-core were not run.

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
- Lines run straight through their own slot in a lane and through their own chip, with flat
  cubic Béziers between (v7). Edges that skip the condition lane pass through their own slot
  in that lane, not through a node label.
- The in-lane edge (Competing vegetation → Seedling nutrient status) is a hairpin to its chip,
  which is stacked with the other chips in the right column (v7).
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
- **Path honesty.** The first `limitations` string of the graph file is a row of the legend at
  the top of the graph, and all `limitations` strings are listed under the graph (v7). The
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
- **Expanded view.** SPEC 0 says nothing floats over the graph. The expanded view is a
  full-screen dialog that covers the page on purpose. Since v7 it shows the panel's own layered
  graph (v4 to v6 used a force layout).
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

## Q2 panel

A third tab, "Created marshes", answers Q2 from `../../answers/q2_created_marshes.json`.
It follows the design of `q2_export/q2_marshes.html`: an "Evidence coverage by marsh age" bar
at the top, a "Time to reference" card, filters, one findings board and a details drawer. Each
board row that lists ages, and each with-age row, has a "When was it measured?" dropdown under it.

What was added:

- `build.py`: new `q2_*` functions. They render the tab, the Q2 section, `claims-marshes.html`
  and `data/marshes.json`. `index_html()` takes the Q2 file as an optional argument. With no
  argument its output is the old page.
- The Q2 section (`#panel-marshes`) is not a `[data-panel]`, so the Q1 code in `app.js` never
  sets it up. Its rows carry `data-finding-id`, `data-direction`, `data-certainty`,
  `data-studies` and `data-claims` (or `data-gap-id`) with the pack values.
- The coverage bar and the dropdown marks are placed in Python. The axis ends at the largest
  age in the file, rounded up to 5. There is no "arrival" line: no study reports the year a
  created marsh matches its reference, and the page says so.
- Coverage bar (`q2_coverage()`): one cell per 5-year span, with the number of findings that
  have a measurement in it as text. A range counts in each span that it overlaps; a single
  age counts in the span that holds it. The fill is the Q3 density tier (`--t1` to `--t4`),
  scaled to the busiest span. A span with no finding is hatched, like a gap. The bar counts
  all findings and does not follow the filters.
- "When was it measured?" (`q2_when()`): a native `<details>` in a full-width `tr.q2-when`
  under its finding row, so it opens without JS. The row has `data-q2-ref`, `data-attr` and
  `data-certainty` (no `data-finding-id`), so the filters hide it and the selection marks it
  with its finding row. On a phone the two rows show as one card.
- `src/app.js`: the tabs loop finds the Q2 section by id, `select()` sets the class `mr` and
  loads `q2.js`, `route()` accepts `#marshes` and `#marshes/<id>`, and the key and focus
  handlers stop early on the Q2 tab.
- `src/style.css`: the `mr` visibility rules, and three tab columns (two on a phone).
- `src/q2.js` (loaded on the first visit to the tab) and `src/q2.css` (bundled into
  `style.css`).

Bytes (this build; `q2.js` and `q2.css` can still change):

| File | Bytes | Before Q2 |
| --- | ---: | ---: |
| `index.html` | 94,575 | 67,156 |
| `style.css` (with `q2.css`) | 31,931 | 22,510 |
| `app.js` | 32,972 | 32,584 |
| `q2.js` | 9,679 | — |
| `data/marshes.json` | 34,820 | — |
| `claims-marshes.html` | 42,209 | — |
| **Total** | 1,004,271 | |
| **First view** | **159,478** | **122,250** |

How the Findings and Network outputs stay the same: the Q1 functions are not changed, and the
Q2 code only calls some of them. A check script compares a new build with the build from
before Q2. `claims-findings.html`, `claims-network.html`, `data/findings.json`,
`data/network.json`, `explore.js`, `explore.css`, `snap.js` and `export.js` are byte-identical,
and so are the `#panel-findings` and `#panel-network` sections of `index.html`. In headless
Chrome, the Q1 panels after a hash selection give the same DOM as before. Two builds are
byte-identical.
