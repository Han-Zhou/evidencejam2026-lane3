# Rank 4: SvelteKit (prerendered) + D3 modules

The Q1 site from `../SPEC.md`, built with SvelteKit 3 + Svelte 5 and
`@sveltejs/adapter-static`. Every page and endpoint is prerendered. The static
HTML holds both panels, both graph SVGs, the pooled tables and all machine-check
`data-*` attributes. Client hydration adds the interaction.

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
| `./build.sh`, `node_modules/` present (build only) | 1.3 to 1.5 s |

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
3. **Page weight.** About 141 KB of JavaScript in the first view (raw, see below)
   and the hydration data inline in the HTML. `python -m http.server` sends no
   compression, so raw bytes are what a viewer downloads.

## Shipped files (bytes)

"First" = loaded on the first view (`index.html` + its `modulepreload` and stylesheet links).

| File | Raw | Gzip | First | What |
| --- | ---: | ---: | :---: | --- |
| index.html | 181,713 | 26,747 | yes | both panels, SVGs, pooled tables; 53,849 B of it is the inline hydration data |
| _app/immutable/assets/0.*.css | 19,101 | 4,998 | yes | all styles |
| _app/immutable/chunks/CkZSJqV-.js | 45,570 | 17,417 | yes | Svelte 5 runtime |
| _app/immutable/chunks/_mEqLy9Z.js | 42,128 | 15,419 | yes | SvelteKit client |
| _app/immutable/nodes/2.*.js | 41,553 | 14,040 | yes | page code (panel, graph, edge table, legend) |
| 10 small first-view chunks | 12,327 | 6,264 | yes | SvelteKit entry, format.js, panel.js, badges |
| _app/immutable/chunks/BSGT7-wo.js | 39,693 | 13,928 | lazy | d3-zoom + d3-transition + deps |
| _app/immutable/chunks/Bwfy7SLc.js | 13,271 | 4,251 | lazy | d3-selection |
| drawer, hover card, matrix, search, papers, claims chunks | 26,695 | 11,376 | lazy | loaded when first used |
| error page chunks (2) | 1,687 | 903 | no | SvelteKit error page |
| data/findings.json | 123,183 | 20,301 | lazy | Panel A claims with quotes |
| data/network.json | 170,987 | 28,435 | lazy | Panel B claims with quotes |
| _app/version.json | 22 | 42 | no | SvelteKit version check |
| **Total, 28 files** | **717,930** | 164,121 | | |

- **First view: 342,392 B raw (84,885 B gzip) in 15 files.** Of this, JS is
  141,578 B raw (53,140 B gzip) in 13 files, HTML 181,713 B, CSS 19,101 B.
- All JS (first view + lazy): 222,924 B raw (83,598 B gzip) in 23 files.
- Pinning an edge in the Network panel adds the drawer and claims-table chunks and
  `data/network.json` (about 185 KB raw).

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
- The drawer, hover card, matrix, search results, papers table and claims table
  are separate chunks loaded on first use (Svelte `{#await import()}`).
- d3-zoom and d3-selection load on the first mouse hover over a graph or the first
  zoom button press.
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
  `site_preparation->growth`. Its own chip and hover card show
  `direction_meaning` verbatim and name the target edge.
- **Combination (3.2).** The node shows its members as two stacked chips, joined
  by dotted member connectors (no arrowheads) on the left of the lane. The legend
  says "Member of a combination — not an evidence edge".
- **Gaps (3.5).** A dashed, hollow link with no arrowhead and a "No evidence"
  pill. Its hover card uses the fixed gap text and `searched_for`. In the matrix a
  gap is a hatched cell, and a blank cell has the title "No claims in this corpus
  link these two".
- **Focus and context (3.6).** Hover or focus emphasis. On a condition node,
  in-edges get a solid band and out-edges a beaded band, and the hover card shows
  the path note (first `limitations` string). Lenses (Panel B), direction chips,
  minimum certainty and "Show gaps" act on the graph, the matrix and the tables
  together, with a "Showing N of M" count. Search is grouped (Nodes, Edges or
  Findings, Gaps, Papers, Claims): `/` focuses it and Esc clears it. Graph |
  Matrix toggle.
- **Hover card and drawer (3.7).** The hover card opens on mouse hover and on
  keyboard focus. Click, Enter or Space pins the item. The drawer shows claims
  grouped by paper (most claims first), each with subject → predicate → object,
  direction, grade, evidence types, comparator, the quote and the claim id. Esc or
  × closes it and focus returns to the opener. Two clicks reach a quote: click a
  chip, and the drawer shows quotes with DOI links.
- **URL hash.** `#findings`, `#network`, `#network/edge/<id>`, `#…/node/<id>`,
  `#…/gap/<id>`, `#…/paper/<id>`, `#…/claim/<id>`. A pinned hash opens the panel,
  pins the item and scrolls to the graph. An inline script in `app.html` hides the
  other panel before first paint, so there is no flash.
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
  unlabelled inputs and no heading jumps. Colours are chosen for AA text contrast
  in both themes.
- **Style (4).** Warm off-white, hairlines, clay accent, system fonts only. Dark
  theme via `prefers-color-scheme`. Motion is off with `prefers-reduced-motion`.
  At phone width the drawer is a bottom sheet, the graph scrolls inside its box
  (no page scroll at 390 px) and tables become stacked cards.

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
- The hover card is on the graph and the matrix, not on table rows (rows pin the drawer).
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
- The hover card can cover part of the graph next to the hovered item.
- Browsers percent-encode `>` in the hash (`%3E`). The page decodes it.
- SvelteKit 3.2.0 is new. If the deadline build hits a problem, SvelteKit 2.70.4
  (`version-2` tag) with `svelte.config.js` is the fallback.
