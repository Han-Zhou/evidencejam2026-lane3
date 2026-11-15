# Rank 3 prototype: Eleventy (11ty)

Static Q1 site built with Eleventy 3, Nunjucks templates, inline SVG and one
small vanilla JavaScript file. It follows `../SPEC.md` (the version with the
Kimi-like light and dark themes and click-only graph focus).

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
- Serve over HTTP. The drawer, the search and the claims table fetch `data/<panel>.json`; from `file://` that
  fetch fails and the page points to the static claims pages instead.

## What changed in this revision

1. **Themes (SPEC 4).** All colours are the SPEC 4.1 tokens. Light is the default; dark comes from
   `prefers-color-scheme` (`:root:not([data-theme="light"])`) or from `:root[data-theme="dark"]`. A round
   theme button sits at the top right of the header (moon/sun inline SVG, `aria-label` "Switch to dark
   theme" / "Switch to light theme", `aria-pressed` = dark is on). It sets `data-theme` on `<html>` and
   stores `q1-theme` in `localStorage` (every storage call in `try/catch`). A one-line script in `<head>`
   applies the stored choice before the first paint. Without JS the button is hidden and the system theme
   applies. The SVG uses only CSS variables for colour. Type: the serif stack for headings and reading text
   (question, how built, rationales, limitations, quotes, the path note), the sans stack for UI, the mono
   stack for numbers and ids. Pills for tabs, segments, chips and buttons; the selected segment is a solid
   `--pill`. Cards are flat `--surface`, radius 16, no shadow.
2. **No hover (SPEC 3.6, 3.7).** The hover card (`#hc`), its CSS, and all `pointerover`/`pointermove`/
   `pointerout`/`focusin`/`focusout` handlers are gone. Hover changes only the cursor and the hovered mark's
   own stroke (node border, chip border, edge opacity). Keyboard focus shows only the focus ring.
   **Click (or Enter/Space) a node** to select it:
   - Active pathways: every effect edge downstream of the node and every edge upstream into it, gaps that
     touch it, moderation edges from it or onto an active edge (plus that target edge), and the membership
     links (the combination node when it is a member, the members when it is the combination).
   - Active edges, chips and end nodes stay at full strength; the rest fade to 12%. The node gets a 3.5 px
     `--focus` outline and a bold label.
   - Edges that touch the node are drawn at full width. Edges two or more steps away are thinner (40% of
     their width + 0.6 px) and at 55% stroke opacity; their chips stay readable.
   - Status line above the graph (`aria-live`): for example "Pathways through Site preparation: 12 edges
     (5 direct, 7 further) · member of a combination · Clear", then a small line key (one step / further
     steps) and "Edges beyond the first step are separate bodies of evidence. A path is not one tested
     effect." Counts are counts of edges. Nothing is added or multiplied.
   - The drawer lists the node's kind text, members or "member of", the path note for a condition, edges
     in and out, gaps, and "Further along its pathways" (each item selects that edge).
   - A second click on the node, a click on empty canvas, Esc, or Clear resets the view.
   - **Click an edge, its chip or the diamond:** the edge and its two end nodes stay bright (moderation:
     its source, diamond, target edge and that edge's ends). The drawer shows its claims with quotes and
     lists any moderation that changes its effect.
   - Hash: `#network/node/<id>`, `#findings/node/<id>`, `#network/edge/<id>`, `#…/gap/…`, `#…/paper/…`,
     `#…/claim/…`. Switching tabs keeps each panel's selection in the hash.
3. **The drawer never covers the graph.** Wide screens: a sticky column beside the graph. At 960 px and
   below it sits in the page flow under the graph (hidden while empty). No bottom sheet, no overlay. On
   narrow screens a graph click does not scroll the page; the status line has a "Details below" button.
4. **Page weight.** The two claims tables (with all quotes) left `index.html`:
   - `data/findings.json` and `data/network.json` hold each panel's claims (subject, predicate, object,
     direction, grade, evidence types, comparator, quote, paper) and papers. `app.js` fetches a panel's file
     the first time a drawer, the search or the Claims section needs quotes. The first view fetches no JSON
     (checked with the Resource Timing API).
   - `claims-findings.html` and `claims-network.html` are static pages for readers without JS: every claim
     with its quote, grouped by finding/edge, then by paper, each group with direction, certainty and the
     certainty rationale. The "From" cell of each Findings/Edges row is a link to its group there, so without
     JS the quotes are one click from a row. With JS the same link opens the drawer.
   - The Claims section in `index.html` is a `<details>`. With JS it starts closed and builds the table from
     the JSON when opened (paper groups, 25 rows then "Show all", linked to the filters and search).
   - Each claim is now shipped once per panel in the JSON and once per panel in its claims page. The 238
     claims shared by the two answer files stay in both panels (SPEC rule 5).
5. **Smaller fixes.** Clicking anywhere in a table row selects it (not while text is selected). Paper and
   claim selections light the edges that cite them. `<link rel="icon" href="data:,">` stops a favicon 404.

## Files

| Path | What it does |
| --- | --- |
| `eleventy.config.js` | Loads the two JSON files as global data `q1`, sets Nunjucks autoescape on, adds the `rich` filter, copies `src/assets/`, strips indentation from the HTML. |
| `lib/model.js` | Builds the view model: counts, table rows, papers, matrix cells, claim groups for the claims pages, and the data JSON string. Copies values from the JSON. It does not re-derive any. |
| `lib/layout.js` | Deterministic layered layout at build time (unchanged in this revision). |
| `src/index.njk`, `src/_includes/panel.njk`, `src/_includes/macros.njk` | Page, panel and SVG templates. Edge stroke width is now a CSS variable (`--w`) so further-step edges can be drawn thinner. |
| `src/_includes/theme-head.njk` | The inline no-flash theme script (shared by all pages). |
| `src/claims.njk` | Paginated over the panels: `claims-findings.html`, `claims-network.html`. |
| `src/data.njk` | Paginated over the panels: `data/findings.json`, `data/network.json`. |
| `src/assets/app.js` | Client script: tabs, click selection and active pathways, status line, drawer, lazy claims data, search, lenses, filters, matrix, sorting, hash routes, theme toggle. |
| `src/assets/site.css` | All styles, SPEC 4.1 tokens, light and dark. |

## Dependencies (exact)

- Direct: `@11ty/eleventy` **3.1.8**, pinned in `package.json` with no range. Unchanged in this revision.
- `package-lock.json`: 113 packages, all from Eleventy (for example `nunjucks@3.2.4`, `liquidjs@10.30.1`,
  `markdown-it@14.3.3`, `@11ty/eleventy-dev-server@2.1.2`, `chokidar@4.0.3`, `posthtml@0.16.7`, `luxon@3.7.2`).
- Tooling used here: Node v26.9.0, npm 11.19.1. No minifier, no bundler, no client library.

### Native binaries and aarch64

- No `.node`, `.so`, `.dylib` or `binding.gyp` file; no install scripts; no package restricted by `os` or `cpu`.
  Eleventy 3 does not use esbuild or Rollup. The install is pure JavaScript and installs on aarch64 Linux with
  Node 18+.

## Install and build times (this Mac, Apple silicon)

| Step | Wall time |
| --- | --- |
| `./build.sh`, no `node_modules` (`npm ci` + build), measured once at the start of this revision | 1.4 s |
| `./build.sh` with `node_modules` present (3 runs) | 0.23 to 0.31 s |
| Eleventy's own report ("Wrote 5 files in ...") | 0.09 s |

- `node_modules/`: 21 MB, 113 packages.

## Shipped files (bytes)

| File | Before | Now | Loaded |
| --- | --- | --- | --- |
| `index.html` | 453,966 | 166,149 | first view |
| `assets/app.js` | 27,095 | 36,255 | first view |
| `assets/site.css` | 19,173 | 25,335 | first view |
| **First view total** | **500,234** | **227,739** | |
| `data/findings.json` | – | 94,760 | on demand (Findings drawer, search, claims table) |
| `data/network.json` | – | 129,680 | on demand (Network drawer, search, claims table) |
| `claims-findings.html` | – | 155,023 | separate page (no-JS road to the quotes) |
| `claims-network.html` | – | 226,683 | separate page |
| **All files** | 500,234 | 833,885 | |

- First view is 54% smaller. A view that opens one Network edge adds 129,680 bytes once.
- The DOM of `index.html` dropped from about 7,400 elements to about 2,600.
- `python -m http.server` does not compress; all sizes are uncompressed.

## How the spec is met (unchanged parts in short)

- **Accuracy.** Every direction, certainty, rationale, count, label, quote, title, year and DOI comes from the
  JSON (in the HTML, the data JSON and the claims pages). Enum names use the fixed map. Panel A reads only file
  A; Panel B only file B. The checker passes.
- **Machine-check attributes** are on the table rows (findings, edges, gaps, interactions) and on the SVG nodes.
- **Titles and quotes** are escaped; only `<i>`, `<b>`, `<em>`, `<strong>`, `<sub>`, `<sup>`, `<br>` become
  markup. `app.js` applies the same rule to the JSON text.
- **Graph.** Build-time SVG, lanes, barycenter ordering, waypoints, chip collision pass, moderation diamond,
  combination with members, gap as a dashed hollow link with "No evidence", line width = studies. 0 chip
  collisions in both panels.
- **Focus + context.** Click selection (above), lenses, filters, search with grouped results, Graph | Matrix.
  `/` focuses search; Esc clears search, then the selection.
- **Tables.** Findings/Edges (sortable, `aria-sort`), Gaps, Interactions (A, with quotes inline) or
  Interactions & set aside (B), Papers (25 rows, then "Show all"), Claims (on demand), Limitations.
- **No JS.** Both panels stack. The graph, matrix and every table show. The Claims section shows a link to
  the panel's claims page, and every Findings/Edges row links to its group there.
- **Accessibility.** axe-core 4.10.2 (scratch install, not a site dependency) found 0 violations in 6 runs:
  Findings light, Network with a node selected, Network dark with an edge drawer and the claims table open,
  Network dark matrix, the Network claims page dark, Findings at 390 px. Lighthouse was not run.
- **Contrast.** All SPEC tokens pass AA on `--bg`, `--surface` and `--raised` in both themes (lowest:
  dark `--text-3` on `--raised`, 4.82). Translucent `--line` fills lowered dark `--text-3` to 3.8, so no text
  sits on a `--line` fill: a selected table row uses `--raised` with a 3 px `--focus` bar, search hover uses
  `--surface`. The status-line "Clear" button is `--pill-text` on `--pill` (18.9 light, 16.4 dark).

## Not done, or done differently

- **No-JS quotes are on a second page.** SPEC 2 asks the no-JS page to show "all tables with quotes". The
  Claims table moved to `claims-<panel>.html` (one click from every row) to cut the first view. The
  Interactions table still has its quotes inline.
- **Claims table grouping.** The static claims pages group by finding/edge, then paper (so a row's link lands
  on its own claims). The JS Claims table in `index.html` groups by paper, as before.
- **Selected edge, not its moderation.** Selecting `site_preparation->growth` keeps only that edge and its ends
  bright (SPEC 3.6). The moderation that targets it is named in the drawer instead.
- **Combination member.** When a member node is selected, only its own membership link and the combination
  node light up, not the other member's link. The combination's own edge into growth is not part of the
  member's pathways.
- **Filters still hide** edges (lenses and search fade). Pathway counts include edges that filters hide; the
  status line then adds "N hidden by the filters".
- **Panel A lenses** are All · Seedling survival · Seedling growth & size.
- **No pan or zoom.** On phones the graph scrolls sideways inside its own box (900 px wide).
- `app.js` is not minified (no extra dependency).

## Known issues

- **`npm ci` needs the network.** A clean checkout without `node_modules/` breaks the "LLM is the only network
  call" rule. Options: commit `node_modules/` (21 MB, pure JS) or vendor an npm cache and use `npm ci --offline`.
- **Node must be on the judging machine.**
- **Label width is estimated at build time** (7.0 px per character); a wider fallback font could push a long
  label past its node edge.
- The moderation edge's dotted line passes behind several chips on its way to its target chip.
- The browser percent-encodes `>` in the hash (`site_preparation-%3Egrowth`). Both forms load.
- On a phone, the status line wraps to four lines when a node with further steps is selected.
- Opening `index.html` from `file://` cannot fetch the data JSON; the drawer then links to the claims page.
