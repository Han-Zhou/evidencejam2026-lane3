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
- The browser side is one vanilla JS file (`src/app.js`) and one CSS file (`src/style.css`).
  The build strips comments and indentation from them. No framework, no CDN, no web fonts.

## Build time

`time ./build.sh`: 0.08 s wall clock (0.04 s user), on an Apple Silicon laptop.
There is no install step.

## Files shipped (bytes)

| File | Bytes | Before v2 | When it loads |
| --- | ---: | ---: | --- |
| `index.html` | 114,193 | 112,763 | first view |
| `style.css` | 21,970 | 19,221 | first view |
| `app.js` | 32,449 | 31,409 | first view |
| `data/findings.json` | 119,781 | 119,781 | on the first click, search, matrix or table opening in Findings |
| `data/network.json` | 171,473 | 171,473 | the same, in Network |
| `claims-findings.html` | 181,620 | 181,432 | only when a reader follows a link (the no-JS road to every quote) |
| `claims-network.html` | 259,241 | 259,053 | the same |
| **Total** | 900,727 | 895,132 | |
| **First view** | **168,612** | **163,393** | `index.html` + `style.css` + `app.js` (not gzipped; `http.server` does not compress) |

The first view grew by 5,219 bytes: the two theme token sets, the toggle, the status line and
the pathway code. The hover-card code that was removed was smaller than what was added.

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
  Without JS the button is hidden and the system theme still works.
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
- Ports spread along each node side by line width, so thick lines do not merge.
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
  redundant. Line width = number of studies (1.5 px + 0.6 px per study, capped at 7.5 px).
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
- The status line is a live region that contains two buttons. It is rewritten only when its
  text changes, so a screen reader announces each new selection once.
- `app.js` is only whitespace-stripped (32 KB). A real minifier would cut it by about half,
  but that needs a tool outside the standard library.
- SVG label wrapping uses an estimated character width, not font metrics. A very wide
  fallback font could push a label past its node box.
- Some paper titles in the JSON contain literal `<i>` tags. They show as text, because the
  page shows titles verbatim and never parses data as HTML.
- `python3 -m http.server` sends no compression, so the byte counts above are also the
  transfer sizes.
