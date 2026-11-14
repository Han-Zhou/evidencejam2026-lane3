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

`time ./build.sh`: 0.09 s wall clock (0.05 s user), on an Apple Silicon laptop.
There is no install step.

## Files shipped (bytes)

| File | Bytes | When it loads |
| --- | ---: | --- |
| `index.html` | 112,763 | first view |
| `style.css` | 19,221 | first view |
| `app.js` | 31,409 | first view |
| `data/findings.json` | 119,781 | on the first hover, pin, search, matrix or table opening in Findings |
| `data/network.json` | 171,473 | the same, in Network |
| `claims-findings.html` | 181,432 | only when a reader follows a link (the no-JS road to every quote) |
| `claims-network.html` | 259,053 | the same |
| **Total** | 895,132 | |
| **First view** | **163,393** | `index.html` + `style.css` + `app.js` (not gzipped; `http.server` does not compress) |

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
- **Page structure (SPEC 2).** Header, question, two panel cards. Without JS the cards are
  links and both panels show stacked. With JS they become a tablist (arrow keys work) and
  the hash records the panel and the pinned item, for example
  `#network/edge/site_preparation->growth`.
- **Graph (SPEC 3).** Chips show a direction glyph and certainty dots. Colour is only
  redundant. Line width = number of studies (1.5 px + 0.6 px per study, capped at 7.5 px).
  Arrowheads sit at the target. Node kinds differ by shape: round corners, square corners,
  side bar, double border, dashed with member chips.
- **Moderation.** A dotted line in the edge's colour, with its own chip (dashed outline). It
  ends in a ◆ on the border of the target edge's chip. The hover card and the drawer show
  `direction_meaning` verbatim and link to the target edge.
- **Combination.** The node shows its two members as stacked chips. Thin dotted connectors
  without arrowheads join each member to it. The legend says "member of a combination — not
  an evidence edge".
- **Gaps.** A dashed, hollow, grey link with no arrowhead and a "No evidence" label. In the
  matrix, a gap is a hatched cell. An empty matrix cell is blank, with the title "No claims
  in this corpus link these two".
- **Path honesty.** The first `limitations` string of the graph file sits under the graph.
  The condition hover card and drawer repeat it. No path is drawn or scored as one effect.
- **Focus and context (SPEC 3.6).** Hover and focus highlight, lenses, filters, search with
  grouped results, and the Graph | Matrix toggle all work. Filters act on the graph, the
  matrix and the tables together, and the toolbar count updates ("Showing 8 of 29 edges").
  `/` focuses search and Esc clears it.
- **Hover card and drawer (SPEC 3.7).** They show on mouse hover and on keyboard focus.
  Click, Enter or Space pins an item. The drawer groups the claims by paper, most claims
  first. Each claim shows subject → predicate → object, its own direction, grade, evidence
  types, comparator and the quote. Esc or × closes the drawer and returns focus to the item
  that opened it. On a phone the drawer is a bottom sheet.
- **Tables (SPEC 5).** Findings or Edges (sortable, rationale in the row, 25 rows then
  "Show all"), Gaps, Interactions (Panel A: the 5 claims with their own directions) or
  Interactions & set aside (Panel B), Papers, Claims, Limitations.
- **Style and accessibility (SPEC 4, 6).** System fonts, warm light theme, dark theme under
  `prefers-color-scheme`. There is a skip link, the landmarks, one `h1`, unique ids and a
  visible focus ring. Every SVG button has an `aria-label` with the full content. Motion is
  off under `prefers-reduced-motion`.

## What I did differently or did not do

- **Papers and Claims tables are built from the JSON in the browser** when their section
  opens. This keeps the first view at 163 KB. Without JS, the section links to
  `claims-*.html`. That static page has every claim and quote, grouped by finding (or edge)
  and paper, plus a Papers list with "cited by" links. So no-JS readers reach every quote,
  but on a second page, not inside `index.html`.
- **The matrix is built in the browser** on the first click on "Matrix". Without JS there is
  no matrix. The tables carry the same content.
- **Lenses are on Panel B only.** Panel A has no node kinds. Using the graph file's kinds
  there would copy data across panels (SPEC 1.5).
- **No pan or zoom.** The graph fits its box on desktop. On a phone it scrolls sideways
  inside its own box.
- **Hover cards load the panel's JSON on the first hover.** Until it arrives (a few ms
  locally), the card shows the element's `aria-label` text.
- **The condition highlight uses two glows** (clay for edges in, dark for edges out). The
  side of the node and the card's "in:" and "out:" lists carry the same information without
  colour.
- **Paper data is stored once per document** in `data/*.json` (title, year, DOI), not once
  per claim. The values are unchanged. The build stops if two claims disagree on them.
- I did not run Lighthouse or axe-core (they are not installed and the build has no network).
  I checked these by hand: landmarks, heading order, unique ids, tab roles, focus return,
  and text contrast (AA in both themes).

## Known issues

- `app.js` is only whitespace-stripped (31 KB). A real minifier would cut it by about half,
  but that needs a tool outside the standard library.
- SVG label wrapping uses an estimated character width, not font metrics. A very wide
  fallback font could push a label past its node box.
- At 1440 px with the drawer open, the Network graph draws at about 0.89 scale, so chips are
  about 21 px tall. Their 8 px spacing still meets the WCAG 2.2 target-spacing rule.
- Some paper titles in the JSON contain literal `<i>` tags. They show as text, because the
  page shows titles verbatim and never parses data as HTML.
- With many edges, lines into the first chip column cross often. Chips stay readable
  because they are drawn on top and never overlap.
- `python3 -m http.server` sends no compression, so the byte counts above are also the
  transfer sizes.
