# Rank 3 prototype: Eleventy (11ty)

Static Q1 site built with Eleventy 3, Nunjucks templates, inline SVG and one
small vanilla JavaScript file. It follows `../SPEC.md`.

## Build and serve

```bash
./build.sh            # writes site/ next to this file
./build.sh /tmp/out   # or any other directory (relative paths resolve from the caller's cwd)
python3 -m http.server 8103 --directory site
```

- `build.sh` needs Node 18 or newer. It runs `npm ci` only when `node_modules/` is missing.
- `npm ci` is a network call to the npm registry. It is the main risk of this stack (see below).
- The build reads `../../answers/q1_tree_planting.json` and `../../answers/q1_tree_planting_graph.json`.
  The path is resolved from the location of `eleventy.config.js`.
- No LLM call. `BRINE_*` is not read.
- Check: `python3 prototypes/check_site.py prototypes/rank3_eleventy/site` (from the repo root) prints PASS.

## Files

| Path | What it does |
| --- | --- |
| `eleventy.config.js` | Loads the two JSON files as global data `q1`, sets Nunjucks autoescape on, adds the `rich` filter, copies `src/assets/`, strips indentation from the HTML. |
| `lib/model.js` | Builds the view model: counts, table rows, papers, claims grouped by paper, matrix cells. Copies values from the JSON. It does not re-derive any. |
| `lib/layout.js` | Deterministic layered layout at build time: lanes, barycenter ordering, dummy waypoints for edges that skip a lane, port slots, cubic routes, chip collision pass. |
| `src/index.njk`, `src/_includes/panel.njk`, `src/_includes/macros.njk` | Page, panel and SVG templates. |
| `src/assets/app.js` | Client script (tabs, hover card, drawer, search, lenses, filters, matrix, sorting, hash routes). |
| `src/assets/site.css` | All styles, light and dark. |

## Dependencies (exact)

- Direct: `@11ty/eleventy` **3.1.8** (current stable major), pinned in `package.json` with no range.
- `package-lock.json`: 113 packages. All come from Eleventy. Examples: `nunjucks@3.2.4`,
  `liquidjs@10.30.1`, `markdown-it@14.3.3`, `@11ty/eleventy-dev-server@2.1.2`,
  `@11ty/chokidar-with-glob-support@1.1.1` (with `chokidar@4.0.3`), `posthtml@0.16.7`, `luxon@3.7.2`.
- Tooling used here: Node v26.9.0, npm 11.19.1.
- No other dependency. No minifier, no bundler, no client library.

### Native binaries and aarch64

- I checked `npm ls --all`, the lock file, and every `package.json` in `node_modules/`.
- No `.node`, `.so`, `.dylib` or `binding.gyp` file. No `preinstall`, `install` or `postinstall` script.
  No package restricted by `os` or `cpu`. Eleventy 3 does not use esbuild or Rollup.
- So the install is pure JavaScript. It does not depend on the CPU. It installs on aarch64 Linux if Node 18+ is there.
- Note: the first `npm install` also put `chokidar@3` and `fsevents` (macOS only, with an install script)
  into the lock as extraneous entries. They come from an optional peer dependency of nunjucks.
  I ran `npm prune`. The committed lock has neither.

## Install and build times (this Mac, Apple silicon)

| Step | Wall time |
| --- | --- |
| `time ./build.sh`, no `node_modules`, warm npm cache (`npm ci` + build) | 1.63 s |
| `time ./build.sh`, no `node_modules`, empty npm cache | 1.31 s |
| `npm ci` alone | 0.6 to 1.0 s |
| `time ./build.sh` with `node_modules` present (3 runs) | 0.24 to 0.38 s |
| Eleventy's own report ("Wrote 1 file in ...") | 0.07 to 0.09 s |

- `node_modules/`: 21 MB (21,080 KB on disk), 113 packages.
- The network here was fast. On a slow or offline judging machine `npm ci` is slower or fails.

## Shipped files (bytes)

| File | Bytes |
| --- | --- |
| `index.html` | 453,966 |
| `assets/app.js` | 27,095 |
| `assets/site.css` | 19,173 |
| **Total, and first view** | **500,234** |

- All three files load on the first view. There are no other requests.
- `index.html` gzips to 71,328 bytes, but `python -m http.server` does not compress.
- Most of `index.html` is the two claims tables (about 120 KB for Findings and 165 KB for Network).
  The no-JS rule needs the quotes in the HTML. The panels are independent (SPEC rule 5), so 238 claims are
  in both tables.
- The DOM has about 7,400 elements. Lighthouse will likely flag "excessive DOM size".

## How the spec is met

- **Accuracy.** Every direction, certainty, rationale, count, label, quote, title, year and DOI comes from the JSON.
  Enum names use the fixed map in SPEC 1.4. Prose is JSON text, fixed UI copy, or a template that restates fields.
  Panel A reads only file A. Panel B reads only file B. The checker passes.
- **Machine-check attributes** are on the table rows (findings, edges, gaps, interactions) and on the SVG nodes
  (`data-node-id`). SVG edges carry only `data-pin`, so the values are not duplicated.
- **Titles and quotes** are escaped. Only `<i>`, `<b>`, `<em>`, `<strong>`, `<sub>`, `<sup>` and `<br>` from the papers
  become markup. Other tags (for example `<span id="page-4-0">`) show as text, so the quote stays verbatim.
- **Graph without JS.** The SVG is rendered at build time. Lanes: Planting stock, Site treatments and Combination
  stacked in lane 1, then Conditions, then Outcomes. Lane subtitles are the `node_kinds` text. Labels are SVG `<text>`
  (one or two lines).
- **Layout.** Barycenter ordering (4 passes, keeps the ordering with the fewest crossings, ties by first-seen order).
  Panel A keeps the factors in first-seen order. Edges that skip the Conditions lane pass between its nodes through
  a dummy waypoint, so they never cross a label. The in-lane edge `competing_vegetation -> seedling_nutrients` is an
  arc on the lane's right side. Lanes 2 and 3 are stretched to 80% of lane 1's height so that converging edges
  have room. Result: 0 chip collisions in both panels.
- **Edge encoding.** Each chip shows a glyph (↑ ↓ ↕ = ?) and 4 certainty dots. Colour is redundant. Line width is
  1.5 px + 0.6 px per study, capped at 10 studies. Arrowheads are drawn as polygons sized to the line.
- **Moderation.** Dotted curve from Fertilization at planting to the chip of `site_preparation->growth`,
  ending in a ◆ on that chip. Its own chip shows its direction and certainty. The card and drawer show
  `direction_meaning` verbatim and name the target edge (with a button to open it).
- **Combination.** The node shows its members as two chips. Dotted membership arcs (no arrowheads) join it to its
  members on the left of the lane. The legend says "Member of a combination — not an evidence edge".
- **Gap.** Dashed, hollow link, no arrowhead, label "No evidence". Card and drawer say it is a gap, not a negative
  result, and show `searched_for`. In the matrix it is a hatched cell with "No evidence".
- **Paths.** The first `limitations` string of the graph file is shown under the Network graph and in the card and
  drawer of each condition node. Hovering a condition node draws in-edges dashed and out-edges solid.
- **Focus + context.** Hover/focus highlight, lenses, filters, search with grouped results, Graph | Matrix toggle.
  `/` focuses search. `Esc` clears search, then closes the drawer.
- **Hover card (L3)** on mouse hover and keyboard focus. **Drawer (L4/L5)** on click, Enter or Space: claims grouped by
  paper (most claims first), each with subject, predicate (with "not" when negated), object, direction, grade,
  evidence types, comparator, claim id and quote. The DOI is one click from the drawer. Close button and Esc return
  focus to the opener. On phones the drawer is a bottom sheet.
- **URL hash.** `#findings`, `#network`, and pinned items such as `#network/edge/site_preparation->growth`,
  `#network/node/<id>`, `#network/gap/<id>`, `#network/paper/<doc>`, `#findings/claim/<claim id>`.
- **Tables.** Findings/Edges (sortable, `aria-sort`), Gaps, Interactions (A) or Interactions & set aside (B), Papers
  (with "cited by" links that pin), Claims (grouped by paper), Limitations. Real `<table>` with `<caption>` and
  `<th scope>`. Papers and Claims show 25 rows and a "Show all" button when JS runs.
- **No JS.** Both panels stack. The graph, the matrix and all tables with all quotes show. Toolbar and drawer hide.
- **Style.** Warm off-white and near-black, clay accent, system font stacks, dark theme by `prefers-color-scheme`,
  motion off with `prefers-reduced-motion`.
- **Accessibility.** Landmarks, one `h1`, skip link, `lang`, title, meta description. Chips and nodes are
  `role="button"` with `tabindex="0"` and a full `aria-label`. axe-core 4.10.2 (run from a scratch install, not a site
  dependency) found 0 violations in 5 runs: Findings, Network with a pinned edge, Network dark, Findings at 390 px,
  Findings dark with the matrix open. Lighthouse was not run.

## Not done, or done differently

- **Panel A lenses** are All · Seedling survival · Seedling growth & size. The spec's lenses (Direct, Via conditions,
  Interactions) only make sense for the Network.
- **Filters hide** filtered edges in the graph (and their rows). Lenses and search **fade** instead.
- **Lenses** apply to the graph and the matrix, not to the tables. Filters and search apply to all three.
- **Glyphs and dots in HTML** come from CSS generated content with empty alt text, to save bytes. The words are real
  text. The SVG chips keep the glyph as SVG `<text>`.
- **No data JSON files.** The drawer reads claims from the claims tables in the page. Nothing is fetched.
- **No pan or zoom.** On phones the graph scrolls sideways inside its own box (900 px wide).
- **Hover card** has no delay.
- **Phone table cards:** only the Findings/Edges table adds field labels.
- `app.js` is not minified (no extra dependency).

## Known issues

- **`npm ci` needs the network.** The README allows no download at build time except the LLM. A clean checkout
  without `node_modules/` breaks that rule. Options: commit `node_modules/` (21 MB, pure JS, so the same files work
  on aarch64), or vendor an npm cache and run `npm ci --offline --cache <dir>`.
- **Node must be on the judging machine.** The README does not say that it is.
- **Label width is estimated at build time** (7.0 px per character at 14.5 px; DejaVu Sans is about 6.9). A wider
  fallback font could push a long label past its node edge.
- The moderation edge's dotted line passes behind several chips on its way to its target chip.
- The browser percent-encodes `>` in the hash, so a pinned edge shows as `site_preparation-%3Egrowth`.
  Both forms load.
- The page is long without JS (all 569 claim rows show).
