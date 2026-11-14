# Rank 2: Python 3.12 + Jinja2 (vendored)

This prototype builds the Q1 site of `../SPEC.md` with Python, Jinja2 templates, inline SVG and one small vanilla JavaScript file.

## Build and serve

```sh
./build.sh            # writes ./site
./build.sh /tmp/q1    # or any output directory
python3 -m http.server 8102 --directory site
python3 ../check_site.py site   # from prototypes/: prints PASS
```

- `build.sh` runs `python3 build.py`. It needs only `python3` (3.9 or newer). It was tested with 3.12.4.
- The build reads `../../answers/q1_tree_planting.json` (Panel A) and `../../answers/q1_tree_planting_graph.json` (Panel B). The path comes from the script location.
- The build makes no network call and no LLM call. It does not read `BRINE_*`.
- The output is deterministic. Two builds give byte-identical files.
- The build replaces its output directory only if the directory is empty or holds an earlier build (`index.html`). It refuses the prototype directory, the repo and their parents.

## Dependencies

| Package | Version | How | Native code |
| --- | --- | --- | --- |
| Jinja2 | 3.1.6 | Vendored source in `vendor/jinja2/` (from the py3-none-any wheel) | None |
| MarkupSafe | 3.0.4 | Vendored source in `vendor/markupsafe/` (`__init__.py`, `_native.py`) | None. The C speedups (`_speedups.c` and the `.so`) are left out. MarkupSafe then uses `_native.py`. |

- `requirements.txt` pins both with `==`. Nothing is installed at build time. There is no install step.
- `build.py` puts `vendor/` first on `sys.path`. The build runs with `python3 -S -I` (no site-packages), so it cannot pick up an installed copy by mistake.
- Nothing is a native binary, so aarch64 needs nothing extra.
- Vendored size: 506,580 bytes in 31 files (with the two license files). Python writes `__pycache__/` there at run time; `.gitignore` excludes it.
- Install time: none (0 s).

## Build time

Wall clock, `time ./build.sh`, on an Apple-silicon Mac:

- Warm (bytecode cached): 0.15 s.
- Cold (empty bytecode cache, as on a clean checkout): 0.35 s.

## Shipped files

| File | Bytes |
| --- | --- |
| `index.html` | 660,998 |
| `assets/site.js` | 22,349 |
| `assets/site.css` | 21,129 |
| **First view total** | **704,476** |

There is no other request. No fonts, no images, no CDN. The only external URLs are DOI links.

Where the bytes in `index.html` go:

| Part | Panel A | Panel B |
| --- | --- | --- |
| Claims table (every quote, once) | 151,024 | 210,718 |
| Card templates (hover card and drawer header) | 29,506 | 61,736 |
| Papers table | 21,814 | 28,740 |
| Findings / Edges table | 16,464 | 33,984 |
| SVG graph | 16,017 | 31,329 |
| Matrix | 5,467 | 12,614 |
| JSON island (structure only, no text) | 2,555 | 6,766 |

The quotes are the bulk. They are in the HTML once per panel because the spec asks that the page show all tables with quotes without JavaScript. The drawer reads its claim cards from those table rows, so no quote is sent twice in one panel.

## How the spec was met

- **Templates.** `templates/macros.html.j2` holds the repeated parts: direction glyph, certainty dots, study-direction numbers and bar, paper reference, finding/edge row, claim row, claim text, hover/drawer cards (edge, moderation, gap, node), SVG chip, SVG node and node badge. Autoescape is on. `StrictUndefined` makes a missing field fail the build.
- **Layout.** `build.py` computes the layered layout at build time. Lanes come from node `kind` (Panel B) or from subject/outcome (Panel A). Nothing is placed by node id. Long edges (lane 1 to lane 3) get a dummy point in lane 2, as in Sugiyama layouts. The barycenter heuristic runs four passes and keeps the order with the fewest crossings (21 in A with the fixed first-seen order, 74 in B). A 1-D least-squares pass then places nodes and corridors. Ports are spread along each node side. Busy nodes grow taller.
- **Edges.** Cubic Béziers. A long edge runs through its own corridor in the conditions lane, so it never crosses a condition label. Its chip sits in that corridor. The in-lane edge (competing vegetation → seedling nutrient status) is an arc on the lane's right side. Other chips slide along their curve until they hit no chip and no node.
- **Encoding.** Chip = direction glyph + four dots (filled = certainty). Colour repeats the glyph and is never the only cue. Line width = 1.5 px + 0.6 px per study, capped at 7 px. Arrowhead at the target. All text pairs pass WCAG AA in both themes (lowest is 4.74:1).
- **Moderation.** Dotted curve from Fertilization at planting. It runs through the gap, then along a strip kept free next to the target chip, and ends with a ◆ that touches the chip of Site preparation → growth. Its own chip has a dashed border. Its card shows `direction_meaning` verbatim and names the target edge.
- **Combination.** The node shows its members as two stacked chips. Dotted membership connectors (no arrowheads) run on the left of lane 1. The legend says "Member of a combination — not an evidence edge".
- **Gaps.** A dashed, hollow link with a "No evidence" label. No arrowhead. Hatched cell in the matrix. The card says the gap is not a negative result and shows `searched_for`.
- **Path honesty.** The first `limitations` string of the graph file is next to the graph. Focus or hover on a condition node shows in-edges with a solid halo and out-edges with a dashed halo, and the card repeats the same limitation. No path strength is computed.
- **Focus + context.** Hover/focus highlight, lenses (Panel B: All, Direct, Via conditions, Interactions), direction chips, minimum certainty, show gaps, search with grouped results (Nodes, Edges/Findings, Papers, Claims), and the Graph | Matrix toggle. Filters and search are linked across graph, matrix and tables. The toolbar shows "Showing N of M".
- **Drawer.** Click, Enter or Space pins an item. The drawer shows the card, then the claims grouped by paper (most claims first). Each claim shows subject → predicate → object, its direction, grade, evidence types, comparator, claim id and the quote. Esc or the close button returns focus to the opener. At 1100 px and wider the drawer is a sticky side column. Below that it is a bottom sheet.
- **Hash.** `#findings`, `#network`, `#network/edge/<id>`, `#findings/finding/<id>`, `…/node/<id>`, `…/gap/<id>`, `…/paper/<doi>` all open the panel and pin the item.
- **Without JavaScript.** Both panels stack. Each shows its SVG graph, its matrix and all tables, with the Papers and Claims tables open. The toolbar, drawer and view switch are hidden. Table links jump to the claim group of each finding.
- **Accessibility.** Landmarks, one `h1`, ordered headings, skip link, `lang`, title, meta description. Tabs follow the ARIA tab pattern with arrow keys. Every SVG node and chip is focusable, has `role="button"` and a full `aria-label`. Visible focus rings. A "View as table" link sits by each graph. Real tables with captions, `th scope` and sortable headers with `aria-sort`. No duplicate ids. Motion is off with `prefers-reduced-motion`.

## Not done, or done differently

- Panel A has no lens control. All its edges are direct findings, so a lens would change nothing.
- The Claims table filters use each claim's own direction and grade, not its edge's. A note above the table says so.
- Only the Claims tables page at 25 rows ("Show all N claims"). Findings/Edges (13 and 29 rows) and Papers (29 and 33 rows) show all rows.
- There is no pan or zoom. On a phone the graph scrolls sideways inside its box.
- The hover card does not open on touch. A tap pins the item instead.
- Missing years show as "–". Missing DOIs show the `document_id` as text.
- CSS and JS are squeezed at build time (comments and indentation removed, lines never joined). There is no real minifier.

## Known issues

- `index.html` is 661 KB, mostly quotes. `python -m http.server` does not compress it.
- Panel B is dense: 74 crossings remain between lanes 1 and 2. The matrix and the lenses are the way out.
- Label wrapping uses a width estimate for system fonts. A very wide fallback font could make a label touch its node border.
- Five paper titles contain literal `<i>…</i>` tags in the JSON. They are shown as text, verbatim.
- Lighthouse and axe-core were not run here (not installed, no network at build). Contrast, ids, labels and landmarks were checked by script and by eye.
- Headless Chrome on macOS clamps the window width, so the 390 px view was tested inside a 390 px iframe.
- Dark mode follows `prefers-color-scheme` only. There is no theme switch.
