# Q1 prototypes: one site, four stacks

Four generators build the same Q1 site from `answers/q1_tree_planting.json`
(Panel A, "Findings") and `answers/q1_tree_planting_graph.json` (Panel B,
"Network"). The design is fixed in `SPEC.md`. Only the stack changes, so the
numbers below compare stacks, not designs. No generator calls the LLM.

## Run them

```bash
./prototypes/compare.sh                      # build, time and check all four
python3 prototypes/check_site.py prototypes/rank1_stdlib/site   # check one site
python3 -m http.server 8000 --directory prototypes/rank1_stdlib/site
```

Each prototype also builds alone: `cd prototypes/<dir> && ./build.sh [out_dir]`.
Ranks 3 and 4 run `npm ci` first when `node_modules/` is missing.

`check_site.py` reads the built files without running JavaScript. It checks that
every finding, gap, interaction, node and edge is on the page, with direction,
certainty, study count and claim count equal to the JSON. It also checks that every
claim id and quote is present, and that nothing loads from another origin.

## Results (macOS arm64, Node 26.9, Python 3.12.4)

| | Rank 1 | Rank 2 | Rank 3 | Rank 4 |
| --- | --- | --- | --- | --- |
| Stack | Python stdlib | Python + Jinja2 | Eleventy | SvelteKit + D3 |
| Directory | `rank1_stdlib/` | `rank2_jinja2/` | `rank3_eleventy/` | `rank4_sveltekit/` |
| `check_site.py` | PASS | PASS | PASS | PASS |
| Build, deps present | 0.10 s | 0.30 s | 0.49 s | 2.26 s |
| Build from clean checkout | 0.10 s | 0.35 s | 1.3–1.6 s | 3.7 s |
| Network at build | none | none | `npm ci` | `npm ci` (~15 MB) |
| Dependencies | none | Jinja2 3.1.6, MarkupSafe 3.0.4, vendored (507 KB) | @11ty/eleventy 3.1.8 (113 packages, 21 MB) | kit 3.2.0, svelte 5.57.3, vite 8.3.8, d3 modules (59 packages, 43 MB) |
| Native binaries | none | none | none | rolldown, lightningcss (linux-arm64 builds in the lock file, not tested) |
| Needs Node on judge machine | no | no | yes | yes (22.17+) |
| First view (bytes, uncompressed) | **168,612** | 267,838 | 227,739 | 351,413 |
| First view in v1 (before the quote split) | 163,393 | 704,476 | 500,234 | 342,392 |
| All shipped files (bytes) | 900,727 | 921,999 | 833,885 | 721,973 |
| Quotes without JS | on `claims-*.html` pages | on `claims-*.html` pages | on `claims-*.html` pages | mostly missing |
| Pan and zoom | no | no | no | yes |

`python -m http.server` does not compress, so the raw bytes are what a viewer
downloads. The build times above are for v2 (theme and click changes).

## v2 changes (all four)

- **Theme:** light and dark tokens taken from the Kimi blog's look (cool grey page,
  flat near-white cards, serif reading text, sans UI, mono numbers, black pills,
  colour only in the data). The default follows the system; a sun/moon toggle
  at the top right overrides it and is remembered. See `SPEC.md` section 4.
- **No hover:** hover cards and hover fading are gone, so nothing covers the
  pathways. Clicking a node keeps only its active pathways bright (upstream and
  downstream). Edges one step from the node are full strength; further edges stay
  visible but lighter, with a note that they are separate bodies of evidence.
  Clicking an edge shows its claims in the drawer. Esc, Clear, a second click or
  a click on empty canvas resets. See `SPEC.md` section 3.6.
- **Page weight:** ranks 2 and 3 now load quotes on demand, like rank 1.

## What the numbers say

- **Rank 1 is still the best fit.** It has no install, no network, the fastest
  build and the smallest first view. Its page-weight trick is worth keeping on any
  stack: pooled rows go in the HTML, quotes go in one JSON file per panel loaded on
  first use, and a static `claims-*.html` page keeps every quote readable without
  JavaScript.
- **Ranks 2 and 3 now use the same quote split** and dropped to 268 KB and
  228 KB. Their v1 first view (500–700 KB) came from inlining every quote, not
  from the stack.
- **Rank 3 has no native binaries.** But it still needs Node and a network
  `npm ci` at build time, which breaks decision driver 1 unless `node_modules/` is
  committed.
- **Rank 4 has the most polished graph** (larger type, zoom, a beaded band that
  marks a condition's out-edges). It also has the most risk: network at build, two
  native binaries untested on aarch64 Linux, 140 KB of JavaScript, and no quotes
  without JavaScript.

## Open issues in all four

- The "All" lens of Panel B is dense: 29 edges and 74–90 crossings. The lenses,
  click-to-highlight and matrix help. A next version should reduce crossings
  further, for example by bundling the direct edges into each outcome.
- Five paper titles contain literal `<i>` tags in the JSON. All four show them as
  text.
- Nobody ran Lighthouse. Only rank 3 ran axe-core (0 violations in 6 states in v2).
- While something is selected, faded text is below AA contrast by design.
- SVG label widths are estimated at build time. A wide fallback font can push a
  label past its box.

Each `NOTES.md` has the full details for its stack.
