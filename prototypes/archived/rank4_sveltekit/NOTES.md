# Rank 4: SvelteKit (prerendered) + D3 modules

The Q1 site from `../SPEC.md`, built with SvelteKit 3 + Svelte 5 and
`@sveltejs/adapter-static`. Every page and endpoint is prerendered. The static
HTML holds both panels, both graph SVGs, the pooled tables and all machine-check
`data-*` attributes. Client hydration adds the interaction.

## v2 (2026-11-14): Kimi-like themes with a toggle, click-only graph focus

What changed for the new SPEC (sections 0, 2, 3.3 to 3.7, 4):

- **Themes (SPEC 4).** `src/app.css` is rewritten on the SPEC 4.1 tokens, exactly as
  given, for light and dark: a cool grey page, flat `--surface` cards with a 16 px radius
  and no shadow, a serif for headings and reading text (question, how built, rationales,
  quotes, limitations), sans for the UI, mono for numbers, counts, ids and dots, black
  `--pill` pills for the selected tab, segment and primary button. Colour is only in the
  data (`--inc`, `--dec`, `--mix`, `--null`, `--unc` on lines, arrowheads, chip outlines
  and chip glyphs). The SVG uses only CSS variables. Two extra tokens, not text colours:
  `--halo` (the selection band) and `--sel-fill` (the selected node's fill).
- **Theme toggle (SPEC 4.2).** A round button at the top right of a new top bar, with a
  moon and a sun inline SVG (CSS shows the right one, so nothing flashes on hydration),
  `aria-label` "Switch to dark theme" / "Switch to light theme" and `aria-pressed`. It sets
  `data-theme` on `<html>` and stores `q1-theme` in `localStorage` (in `try/catch`). The
  inline script in `src/app.html` applies a stored choice before first paint. With no
  stored choice the page follows `prefers-color-scheme`, also without JavaScript (then
  the toggle is hidden).
- **No hover.** `HoverCard.svelte` is deleted, and so are all hover and focus emphasis
  handlers in `Graph.svelte`, `Matrix.svelte` and `Panel.svelte`. Hover changes only the
  cursor and the hovered node, chip or gap label's own outline (CSS `:hover`). Keyboard
  focus shows only the focus ring. The one pointer listener left on the graph,
  `pointerenter`, loads d3-zoom so that the first drag already pans; it changes nothing
  on screen.
- **Click a node = its active pathways (SPEC 3.6.1).** `emphasis()` in `src/lib/panel.js`
  walks the effect edges breadth first, downstream from the node and upstream into it,
  and gives each edge hop 1 (attached to the node) or 2 (further). It adds the gaps that
  touch the node, a moderation edge from the node (and then its target edge) or onto an
  active edge, and the membership connector and combination node (or the members when the
  node is the combination). It only collects ids: nothing is added or multiplied along a
  path. One-step edges get a `--halo` band under the line; further edges keep a full chip
  but their line is at 50% opacity; the rest fades to 12%. The selected node gets a 3 px
  `--focus` outline and a tinted fill. Examples: Site preparation = 12 edges (5 direct, 7
  further); Competing vegetation = 8 edges (6 direct, 2 further).
- **Status line** above the graph (`aria-live`): "Pathways through **X**: 12 edges (5
  direct, 7 further)", the path-honesty sentence when there are further edges, and a
  Clear button. For an edge: "Selected edge: A → B · direction · certainty · N studies · M
  claims". With nothing selected it shows how to use the graph.
- **Clearing.** A second click (or Enter / Space) on the selected item, a click on empty
  canvas, Esc, Clear or the drawer's × clears it. A pan (mouse drag) is not a canvas
  click: d3-zoom swallows the click after a drag, and a 4 px pointer-distance check is a
  second guard (tested: a drag keeps the selection; a plain canvas click clears it).
- **Hash.** `#network/node/<id>` and `#findings/node/<id>` record a selected node, as
  edges and gaps already did. Loading such a hash restores the selection.
- **Drawer never over the graph (SPEC 3.7).** Wide screens: a sticky side column, as
  before. At 860 px and below it is in the page flow under the graph and legend (the
  bottom sheet is gone). A "Details below ↓" button in the status line scrolls to it on
  narrow screens. A mouse click keeps focus and scroll where they are, so the
  highlighted pathways stay in view; Enter / Space moves focus to the drawer heading (and
  scrolls it into view on narrow screens); Esc and × return focus to the opener.
- **Weight.** Selecting a node or a gap no longer fetches `data/<panel>.json` (its drawer
  needs no quotes). Only edges, papers, claims, search and the claims table load it.
- **Fixed on the way.** The `.vh` labels in empty matrix cells are absolutely positioned
  and escaped the matrix scroll box, so the page scrolled sideways at 390 px with the
  matrix open (747 px wide). The scroll boxes now have `position: relative`. The drawer ×
  button had the same problem at phone width once the drawer moved into the flow.

Checked with headless Chrome (screenshots of both panels in light and dark, node clicks
on Site preparation and Competing vegetation, an edge click with quotes, a moderation
edge, hover on an edge and a node, the toggle, a stored theme against the system theme,
390 px, and keyboard Enter / Esc). Every text pair I use, including the new `--text` on
`--sel-fill` (15.3:1 light, 9.1:1 dark), is at least 4.8:1 in both themes.

## Build and serve

```bash
./build.sh            # writes site/ next to this file
./build.sh /tmp/out   # or any folder (relative paths resolve from the current directory)
python3 -m http.server 8104 --directory site
python3 ../check_site.py site    # PASS
```

- `build.sh` finds `../../answers/` from its own location (it exports `Q1_ANSWERS_DIR`).
- It runs `npm ci` only when `node_modules/` is missing. Then it runs `vite build`,
  deletes `build/__data.json` and copies `build/` to the output folder.
- It replaces the output folder only when that folder is empty or holds an earlier
  site (it has an `index.html`). Otherwise it stops.
- No LLM call. `BRINE_*` is not read.
- Asset paths are relative (`paths.relative`), so the site works from any folder.
- The output is deterministic: two builds give byte-identical files (checked with
  `shasum`). The version name is fixed in `vite.config.js`.

## Toolchain and dependencies

- Node v26.9.0, npm 11.19.1 (macOS 26, Apple silicon). SvelteKit 3 needs Node >= 22.17.
- All versions are exact in `package.json` and locked in `package-lock.json`
  (lockfile v3). `.npmrc` sets `save-exact=true`.

| Package | Version | Use |
| --- | --- | --- |
| @sveltejs/kit | 3.2.0 | framework, prerender |
| @sveltejs/adapter-static | 4.0.1 | static output |
| @sveltejs/vite-plugin-svelte | 7.3.1 | Svelte compiler plugin |
| svelte | 5.57.3 | components (runes) |
| vite | 8.3.8 | bundler (uses Rolldown 1.2.19 and Lightning CSS 1.33.0) |
| d3-shape | 3.2.1 | `curveBumpX` edge paths, at build time only (0 bytes on the client) |
| d3-zoom | 3.0.1 | pan and zoom, loaded on first use (pulls d3-transition, d3-interpolate, d3-drag ...) |
| d3-selection | 3.0.1 | needed by d3-zoom, loaded on first use |

No dagre, no Cytoscape, no force layout. The layout is my own code
(`src/lib/server/layout.js`, about 500 lines), so its size on the client is zero.

SvelteKit 3 notes: config lives in `vite.config.js` (`svelte.config.js` is no
longer read), and `$lib` is replaced by `#lib` subpath imports. I use relative
imports.

## Install and build time

Measured on this Mac (M-series, fast network).

| Step | Wall clock |
| --- | --- |
| `npm ci`, empty npm cache | 1.4 s (59 packages added) |
| `./build.sh`, no `node_modules/`, empty npm cache | 3.7 s |
| `./build.sh`, no `node_modules/`, warm npm cache | 4.3 s |
| `./build.sh`, `node_modules/` present (build only) | 1.3 to 1.8 s (v2: 1.8 s) |
| `./build.sh`, no `node_modules/` (v2, this worktree) | 4.0 s |

- `node_modules/`: 42,896 KiB from `du -sk` (about 44 MB), 59 packages installed.
  The lock file lists 90 entries (it also lists the platform builds for other systems).
- Downloaded into an empty npm cache: 14.5 MB.

## Native binaries (the aarch64 question)

Installed on this darwin-arm64 machine:

| Package | Binary | Size |
| --- | --- | --- |
| @rolldown/binding-darwin-arm64 1.2.19 | `rolldown-binding.darwin-arm64.node` | 18.2 MB |
| lightningcss-darwin-arm64 1.33.0 | `lightningcss.darwin-arm64.node` | 8.5 MB |
| fsevents 2.3.3 | `fsevents.node` (macOS file watcher, optional, not used by the build) | 0.16 MB |

- There is no esbuild: Vite 8 uses Rolldown and Oxc. esbuild is only an optional peer.
- The lock file has `@rolldown/binding-linux-arm64-gnu@1.2.19` and
  `lightningcss-linux-arm64-gnu@1.33.0` as optional dependencies with `os: linux`,
  `cpu: arm64`, `libc: glibc`, a `resolved` URL and an `integrity` hash. Both
  tarballs exist on the registry (unpacked 18.9 MB and 8.9 MB). Musl builds and a
  `@rolldown/binding-wasm32-wasi` fallback are also listed.
- `npm ci` on aarch64 Linux should install the `-linux-arm64-gnu` builds from the lock file.
  **Not tested on real aarch64 Linux:** the Docker daemon on this Mac was not
  running, so I could not run a `linux/arm64` container.

## Main risks of this stack

1. **`npm ci` is a network call at build time.** README allows only the LLM
   call. The first build on a clean checkout downloads about 15 MB from the npm
   registry. Ways around it: commit an npm cache with the linux-arm64 tarballs
   and run `npm ci --offline`, or vendor `node_modules/` built on aarch64.
   Both add tens of MB to the repo.
2. **Node must be on the judging machine** (>= 22.17). README does not promise it.
3. **Page weight.** About 145 KB of JavaScript in the first view (raw, see below)
   and the hydration data inline in the HTML. `python -m http.server` sends no
   compression, so raw bytes are what a viewer downloads.

## Shipped files (bytes)

"First" = loaded on the first view (`index.html` + its `modulepreload` and stylesheet links).

| File | Raw | Gzip | First | What |
| --- | ---: | ---: | :---: | --- |
v2 numbers (gzip = `gzip -9`, for reference only; `python -m http.server` sends raw bytes).

| File | Raw | Gzip | First | What |
| --- | ---: | ---: | :---: | --- |
| index.html | 184,251 | 27,396 | yes | both panels, SVGs, pooled tables; 53,866 B of it is the inline hydration data, 483 B the head script |
| _app/immutable/assets/0.*.css | 22,608 | 5,467 | yes | all styles, both themes |
| _app/immutable/chunks/DchPjM34.js | 44,842 | 17,165 | yes | Svelte 5 runtime |
| _app/immutable/chunks/hAT5IqU3.js | 42,136 | 15,395 | yes | SvelteKit client |
| _app/immutable/nodes/2.*.js | 44,038 | 15,077 | yes | page code (panel, graph, selection, status line, edge table, legend, toggle) |
| 9 small first-view chunks | 13,538 | 6,600 | yes | SvelteKit entry, format.js, panel.js, badges |
| _app/immutable/chunks/BSGT7-wo.js | 39,693 | 13,928 | lazy | d3-zoom + d3-transition + deps |
| _app/immutable/chunks/Bwfy7SLc.js | 13,271 | 4,251 | lazy | d3-selection |
| drawer, matrix, search, papers, claims chunks (5) | 21,717 | 9,270 | lazy | loaded when first used |
| error page chunks (2) | 1,687 | 903 | no | SvelteKit error page |
| data/findings.json | 123,183 | 20,301 | lazy | Panel A claims with quotes |
| data/network.json | 170,987 | 28,435 | lazy | Panel B claims with quotes |
| _app/version.json | 22 | 42 | no | SvelteKit version check |
| **Total, 26 files** | **721,973** | 164,230 | | |

- **First view: 351,413 B raw (87,100 B gzip) in 14 files.** Of this, JS is
  144,554 B raw (54,237 B gzip) in 12 files, HTML 184,251 B, CSS 22,608 B.
- v1 for comparison: 342,392 B raw (84,885 B gzip) in 15 files; JS 141,578 B raw
  (53,140 B gzip). v2 adds 9,021 B raw (2,215 B gzip): the second set of theme
  tokens and the new rules in CSS (+3.5 KB), the selection logic and the status line
  in the page chunk (+2.5 KB), the toggle, legend row, status hint and head script in
  the HTML (+2.5 KB). Deleting the hover card took 3.6 KB out of the lazy chunks.
- All JS (first view + lazy): 220,922 B raw (82,589 B gzip) in 21 files.
- Selecting an edge in the Network panel adds the drawer and claims chunks and
  `data/network.json` (about 182 KB raw). Selecting a node adds only the drawer
  chunk (about 11 KB); it does not fetch the quotes.

### What I did to keep the weight down

- Claim quotes ship **once**, in `data/<panel>.json`. They are not in the HTML
  and not in the hydration data. The page fetches the file the first time the
  reader pins an item, focuses the search box or opens the Claims table. The one
  exception: the 5 Panel A interaction claims (small) are in the HTML, the
  hydration data and `findings.json`.
- The pooled model (nodes, edges, geometry, rationales, paper list) is
  necessarily in the HTML twice: once rendered, once as hydration data (54 KB).
  That is the cost of hydration.
- Layout runs at build time. d3-shape runs only at build time.
- The drawer, matrix, search results, papers table and claims table are separate
  chunks loaded on first use (Svelte `{#await import()}`).
- d3-zoom and d3-selection load when a mouse pointer first enters a graph box, or
  on the first zoom button press. Nothing on screen changes at that moment.
- Node and gap selections do not fetch `data/<panel>.json`.
- The SVG draws the halo and hit-area paths only after hydration, and the
  certainty dots are `<use>` references, which saves about 15 KB of HTML.
- Mobile table labels come from CSS, not from a `data-label` on every cell.
- `__data.json` (45 KB, data for client-side navigation) is deleted. The site
  has one page and never navigates on the client.
- These steps took the HTML from 266 KB to 182 KB and the first-view JS from
  163 KB to 141 KB (raw).

## How the spec items were met

- **Accuracy (SPEC 1).** All values come verbatim from the two JSON files. Panel A
  reads only `q1_tree_planting.json`. Panel B reads only `q1_tree_planting_graph.json`.
  Derived values are counts (findings, claims = evidence entries, papers =
  distinct `document_id`), sorts and groupings. Display names use the fixed map in
  `src/lib/format.js`. Templates restate fields only.
- **Machine check.** `data-finding-id`/`data-edge-id` + direction, certainty,
  studies, claims on the table rows. `data-gap-id` on the gap rows and the SVG gap
  labels. `data-interaction-id` + `data-direction` on the Panel A interaction rows.
  `data-node-id` on the Panel B SVG nodes. The SVG chips carry the id only. Claim
  ids and quotes are in `data/*.json`. `check_site.py` prints PASS.
- **Layout (3.1).** Lanes by role. Panel B lane 1 stacks planting stock, site
  treatments, then the combination node. Barycenter sweeps (4 passes, best kept,
  ties by JSON order) order the nodes, and isotonic regression places them.
  Lane-skipping edges get a waypoint in the conditions lane, so they pass between
  condition nodes, never through a label. The waypoint also holds the chip. The
  intra-lane edge (competing vegetation → seedling nutrients) is an arc on the
  lane's right side. Curves use d3 `curveBumpX`.
- **Chips (3.3).** Each chip shows a glyph and 4 dots, with colour as a second cue
  only. A collision pass slides each chip along its curve. No chips overlap; the
  closest pair is 4 px apart. Line width is 1.5 + 0.6 × studies, capped at 7.
- **Moderation (3.4).** A dotted curve ends in a ◆ on the chip of
  `site_preparation->growth`. Its own chip shows direction and certainty; its
  drawer shows `direction_meaning` verbatim and links the target edge.
- **Combination (3.2).** The node shows its members as two stacked chips, joined
  by dotted member connectors (no arrowheads) on the left of the lane. The legend
  says "Member of a combination — not an evidence edge".
- **Gaps (3.5).** A dashed, hollow link with no arrowhead and a "No evidence"
  pill. A click opens the drawer with the fixed gap text and `searched_for`. In the matrix a
  gap is a hatched cell, and a blank cell has the title "No claims in this corpus
  link these two".
- **Focus and context (3.6).** Click selection only, as described in the v2
  section: node = active pathways with one-step and further edges drawn
  differently, a status line with counts and Clear; edge = the edge and its ends
  (for a moderation edge: its source, its ◆ and its target edge). A condition
  node's drawer shows the path note (first `limitations` string). Lenses (Panel B), direction chips,
  minimum certainty and "Show gaps" act on the graph, the matrix and the tables
  together, with a "Showing N of M" count. Search is grouped (Nodes, Edges or
  Findings, Gaps, Papers, Claims): `/` focuses it and Esc clears it. Graph |
  Matrix toggle.
- **Drawer (3.7).** Click, Enter or Space selects the item and shows it in the
  drawer, beside the graph on wide screens and under it on narrow ones. The drawer shows claims
  grouped by paper (most claims first), each with subject → predicate → object,
  direction, grade, evidence types, comparator, the quote and the claim id. Esc or
  × closes it and focus returns to the opener. Two clicks reach a quote: click a
  chip, and the drawer shows quotes with DOI links.
- **URL hash.** `#findings`, `#network`, `#network/edge/<id>`, `#…/node/<id>`,
  `#…/gap/<id>`, `#…/paper/<id>`, `#…/claim/<id>`. A pinned hash opens the panel,
  selects the item and scrolls to the graph. An inline script in `app.html` hides the
  other panel and applies a stored theme before first paint, so there is no flash.
- **Tables (5).** Findings or Edges: sortable `<th><button>` with `aria-sort`,
  rationale under the certainty, an Open button that pins. Gaps. Interactions
  (A: the 5 claims with quotes; B: the combination node, its edge, the moderation
  edge, and `set_aside` with id and `why`). Papers. Claims, with direction and
  grade filters. Tables longer than 25 rows show "Show all N". Limitations and
  "How this was built" are verbatim.
- **Accessibility (6).** Landmarks, one `h1`, ordered headings, skip link,
  `lang`, title, meta description and viewport. The graph buttons are focusable
  `<g role="button">` with full `aria-label`s, and a "View as table" link.
  A DOM audit over both panels found no duplicate ids, no unnamed controls, no
  unlabelled inputs and no heading jumps. Graph nodes, chips and gap labels have
  `aria-pressed` after hydration (true for the selected one); the status line is
  `aria-live`. All text pairs are at least 4.8:1 in both themes (v2 check).
- **Style (4).** SPEC 4.1 tokens in both themes, the 4.2 toggle and the 4.3 type,
  shape and spacing (see the v2 section). System fonts only. Motion is 160 ms and
  off with `prefers-reduced-motion`. At phone width the drawer is in the page flow
  under the graph, the graph scrolls inside its box (no page scroll at 390 px, also
  with the matrix or the drawer open) and tables become stacked cards.

## Not done or done differently

- **Without JavaScript** both panels show stacked, with both SVGs, the pooled
  tables, the 5 interaction quotes, limitations and "How this was built". The
  other quotes, the papers table and the claims table need JavaScript. The claims
  section links to `data/<panel>.json`. SPEC exempts rank 4 from the no-JS rule.
- **The Papers table is drawn on demand**, like the Claims table, to save 44 KB of
  HTML. The pooled tables (findings/edges, gaps, interactions) are in the static HTML.
- **Lenses only on Panel B.** Panel A has only direct findings, so its lens control
  is hidden.
- The Interactions lens also keeps `site_preparation->growth` bright, so the ◆ has context.
- The moderation edge appears in the matrix as an extra column ("Effect of Site
  preparation → Seedling growth & size").
- **Selection wins over lens, filters and search.** While a node, edge or gap is
  selected, the graph shows its emphasis only; Clear brings the lens and filter view
  back. The toolbar count still shows the filters.
- **Edge selection keeps a little context.** Besides the edge and its two ends, a
  moderation edge whose ◆ sits on the selected edge's chip stays bright, and so do
  the member connectors when the edge starts at the combination node.
- **A member node lights its own connector and the combination node**, not the
  combination's out-edge (SPEC 3.6.1 read literally). Clicking the combination node
  shows its edge and its members.
- **The moderation edge counts as "further"** when it lands on an active edge (it
  is not attached to the selected node), and its target edge counts as "further"
  when the moderation starts at the selected node.
- **Node shapes keep their corner radii** (planting stock 14, site treatment 3,
  condition a pill, outcome 8 with a heavy border) instead of one 12 px radius,
  because SPEC 3.2 asks lanes to differ by shape and not by colour only.
- **Direction filter chips** that are on are `--raised` pills with the coloured
  glyph, not black `--pill` pills: the direction colours on `#111` would fail
  contrast. Off chips are dashed and struck through. Tabs, segments and the Clear
  button use the black pill.
- **Focus after a selection.** A mouse click leaves focus on the clicked item and
  does not scroll. Enter / Space moves focus to the drawer heading, so keyboard
  readers reach the quotes in one step. The Clear button, Esc and × return focus
  to the item.
- **The theme toggle changes its label and `aria-pressed` together**, as SPEC 4.2
  asks. Screen readers then read "Switch to light theme, pressed" in dark mode,
  which is a little redundant.
- Fixed UI copy that I wrote: the card subtitles, Panel A lane subtitles ("the
  subject of each finding", "the outcome of each finding"), the group titles
  (Planting stock, Site treatments, Combination, Conditions, Outcomes), the legend
  and help notes. None of it states a finding.
- No Lighthouse or axe-core run: neither is installed here, and installing them
  is a new download. I ran the DOM audit above instead.

## Known issues

- With the drawer open on a 1440 px screen, the Network SVG scales to about 0.9,
  so node text renders at about 13 px. With no drawer, the SVG scales up to at most 1.12×.
- The Network graph has 90 edge crossings by the layout's own count. It is a dense
  bipartite-like graph, and barycenter ordering only reduces crossings.
- Some quotes and titles contain raw markup from the corpus (`<i>Kalmia</i>`,
  `![](_page_7_Picture_8.jpeg)`). They are shown verbatim on purpose.
- SvelteKit 3 fetches `_app/version.json` (same origin, 22 B) when the tab regains
  focus. `pollInterval: 0` stops the polling, but not this check. No request goes
  to another origin; DOI links are the only external URLs.
- Opening the drawer on a wide screen narrows the graph column, so the graph
  rescales and moves under the pointer by a few px. A second click on the same node
  still works, but the node is no longer exactly under the pointer.
- With a selection active, faded text (12% opacity) does not meet contrast. This
  is on purpose (it is the context, not the content), but an axe-core run made
  while something is selected would flag it. The page loads with nothing faded.
- Browsers percent-encode `>` in the hash (`%3E`). The page decodes it.
- SvelteKit 3.2.0 is new. If the deadline build hits a problem, SvelteKit 2.70.4
  (`version-2` tag) with `svelte.config.js` is the fallback.
