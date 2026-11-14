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
- The output is deterministic. Two builds give byte-identical files (checked with `diff -r`).
- The build replaces its output directory only if the directory is empty or holds an earlier build (`index.html`). It refuses the prototype directory, the repo and their parents.

## Dependencies

| Package | Version | How | Native code |
| --- | --- | --- | --- |
| Jinja2 | 3.1.6 | Vendored source in `vendor/jinja2/` (from the py3-none-any wheel) | None |
| MarkupSafe | 3.0.4 | Vendored source in `vendor/markupsafe/` (`__init__.py`, `_native.py`) | None. The C speedups (`_speedups.c` and the `.so`) are left out. MarkupSafe then uses `_native.py`. |

- `requirements.txt` pins both with `==`. Nothing is installed at build time. There is no install step.
- `build.py` puts `vendor/` first on `sys.path`, so it imports the vendored copy even when another Jinja2 is installed.
- Nothing is a native binary, so aarch64 needs nothing extra.
- Vendored size: 506,580 bytes in 31 files (with the two license files). Python writes `__pycache__/` there at run time; `.gitignore` excludes it.
- Install time: none (0 s).

## Build time

Wall clock, `time ./build.sh`, on an Apple-silicon Mac:

- Warm (bytecode cached): 0.16 s.
- Cold (empty bytecode cache, as on a clean checkout): 0.21 s.

## Shipped files

| File | Bytes | When it loads |
| --- | --- | --- |
| `index.html` | 214,975 | First view |
| `assets/site.css` | 25,245 | First view |
| `assets/site.js` | 27,618 | First view |
| **First view total** | **267,838** | (was 704,476 in v1: −62%) |
| `data/findings.json` | 122,964 | On demand, once: first drawer, search or Claims table in Panel A |
| `data/network.json` | 188,488 | On demand, once: the same in Panel B |
| `claims-findings.html` | 143,412 | Only if the reader opens it (the no-JavaScript road to the quotes) |
| `claims-network.html` | 199,297 | The same for Panel B |
| Total on disk | 921,999 | |

`index.html` gzips to 27,813 bytes, but `python -m http.server` sends it uncompressed. There is no other request: no fonts, no images, no CDN. The only external URLs are DOI links.

Where the bytes in `index.html` go now:

| Part | Panel A | Panel B |
| --- | --- | --- |
| Findings / Edges table (with rationales) | 17,519 | 36,486 |
| SVG graph | 16,023 | 31,335 |
| Papers table | 21,854 | 28,780 |
| Matrix | 5,495 | 12,642 |
| JSON island (structure only, no text) | 2,564 | 6,828 |
| Interactions table (A: the 5 interaction quotes) | 4,994 | 2,630 |
| Legend | 2,066 | 3,205 |
| Claims section (link + empty host) | 555 | 551 |

## What changed in v2 (SPEC update: Kimi-like theme, click instead of hover)

### Request 1: light and dark theme in the Kimi blog style, with a toggle

- `static/site.css` uses the SPEC 4.1 tokens exactly: `--bg`, `--surface`, `--raised`, `--line`, `--line-strong`, `--text`, `--text-2`, `--text-3`, `--pill`, `--pill-text`, `--focus` and the five direction colours, for both themes.
- Dark tokens are set under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and again under `:root[data-theme="dark"]`. Without JavaScript the system theme still applies.
- Theme toggle: a round button at the top right of the header (inline SVG moon or sun), `aria-label` "Switch to dark theme" / "Switch to light theme", `aria-pressed` = dark is on. It sets `data-theme` on `<html>` and stores the choice in `localStorage` (`q1-theme`) inside `try/catch`. A tiny inline script in `<head>` (`templates/head.html.j2`) applies the stored choice before the first paint, so there is no flash. The button is hidden without JavaScript.
- The SVG takes every colour from the CSS variables: nodes, edges, chips, arrowheads, the moderation diamond, gaps, membership lines and lane titles.
- Look: cool grey page, flat `--surface` cards with a 1 px `--line` border and 16 px radius, no shadows, `--raised` nodes, chips and drawer. Serif stack for headings and reading text (question, ledes, rationales, quotes, limitations, how built), sans for UI, mono for numbers, counts, ids and certainty dots. Tabs, segments, lens, filter chips and buttons are pills. Selected segments and the Clear button are solid `--pill`. The selected panel card has a 1.5 px `--text` border. Links are `--text` with a `--line-strong` underline. Colour appears only in the data (direction glyphs, words, lines, chips).
- Contrast (WCAG AA, checked by script for every text/background pair used): lowest is 4.82:1 (dark, `--text-3` on `--raised`) and 4.84:1 (light, `--dec` on `--bg`). Pill text is 18.9:1 (light) and 16.4:1 (dark).

### Request 2: no hover in the graph; a click highlights a node's active pathways

- Deleted: the hover card element, its CSS and its code, and every `pointerover` / `pointerout` / `focusin` / `focusout` handler. The hover-only parts of the cards (top-3 papers, "+K more", the "Click to pin" hint) are gone.
- Hover now changes only the cursor and the hovered element's own outline (node border, chip border, a faint band on the edge itself). Keyboard focus shows only the focus ring. No `<title>` tooltips are drawn on the graph (labels are `aria-label`).
- Click a node, or press Enter / Space on it: `pathways()` in `site.js` walks every effect edge downstream of the node and every edge upstream into it. It adds the gaps that touch the node, a moderation edge whose source is the node (and then its target edge) or whose target edge is active, and the membership lines and the combination node (or the members, when the node is the combination). Active edges, chips and end nodes stay at full strength. Everything else fades to 12%. The selected node gets a 3 px `--focus` outline.
- Path honesty: edges that touch the node are drawn at full width. Edges two or more steps away stay bright but are thin (1.4 px) and at 60% opacity. Their chips stay fully readable. Nothing is added or multiplied along a path.
- A status line above the graph says what is selected, with counts made by counting edges: "Pathways through Site preparation: 12 edges (6 direct, 6 further)", plus gaps if any. When there are further edges, or the node is a condition, it adds "Edges beyond the first step are separate bodies of evidence. A path is not one tested effect." It has a Clear button (and "Details below" on narrow screens).
- A second click on the same node, a click on empty canvas, Esc, Clear or the drawer's close button resets the view. Esc and Clear return focus to the item that opened the selection.
- Click an edge chip, an edge line, a gap label or a matrix cell: the edge and its two end nodes stay bright (a moderation edge keeps its source, its diamond, its target edge and that edge's ends). The drawer shows the claims and quotes.
- The hash records the selection: `#network/node/<id>`, `#findings/node/<id>`, `#network/edge/<id>`, `#findings/finding/<id>`, `…/gap/<id>`, `…/paper/<doi>`. A link with a selection opens the panel, applies it and scrolls to the graph.
- The legend has a line for the encoding: full lines are one step from the clicked node, thin light lines are further steps.
- Checked counts: Site preparation 12 edges (6 direct incl. the moderation edge onto Site preparation → growth, 6 further); Seedling nutrient status 11 (8 direct, 3 further); Vegetation control & release 9 (4, 5); Competing vegetation 8 (6, 2).

### The drawer never covers the graph

- At 1100 px and wider it is a sticky column beside the graph (CSS grid areas `stage drawer / foot drawer`).
- Below 1100 px it sits in the page flow directly under the graph, before the limitation note and the legend. It is hidden while empty. There is no bottom sheet and no overlay.
- Search results also sit in the page flow under the toolbar. Nothing floats over the graph.

### Page weight: quotes moved out of the first view

- `index.html` keeps the pooled rows (findings/edges with rationales, gaps, interactions, papers), the SVG and the matrix. It no longer holds the 569 claim rows or the 85 card templates.
- `data/<panel>.json` holds the drawer cards (rendered at build time from the same Jinja macros, autoescaped), every claim (subject, predicate, object, negated, direction, grade, evidence types, comparator, quote, document id), the papers and the claim groups. `site.js` fetches it once, from this site, the first time the reader opens a drawer, types a search or opens the Claims table. The Claims table is then built from it with the same columns, filters and paging as before.
- `claims-findings.html` and `claims-network.html` are static pages with every claim and quote, grouped by finding/edge. Each group links back to its row on the main page. Without JavaScript, each finding/edge row links straight to its group on that page (one click to the quotes). The checker reads these pages and the JSON, and passes.

## How the rest of the spec was met

- **Templates.** `templates/macros.html.j2` holds the repeated parts: direction glyph, certainty dots, study-direction numbers and bar, paper reference, finding/edge row, claim row, claim text, drawer cards (edge, moderation, gap, node), SVG chip, SVG node, node badge and the theme button. `head.html.j2` is shared by the three pages. Autoescape is on. `StrictUndefined` makes a missing field fail the build.
- **Layout.** `build.py` computes the layered layout at build time. Lanes come from node `kind` (Panel B) or from subject/outcome (Panel A). Nothing is placed by node id. Long edges (lane 1 to lane 3) get a dummy point in lane 2, as in Sugiyama layouts. The barycenter heuristic runs four passes and keeps the order with the fewest crossings (21 in A with the fixed first-seen order, 74 in B). A 1-D least-squares pass then places nodes and corridors. Ports are spread along each node side. Busy nodes grow taller.
- **Edges.** Cubic Béziers. A long edge runs through its own corridor in the conditions lane, so it never crosses a condition label. Its chip sits in that corridor. The in-lane edge (competing vegetation → seedling nutrient status) is an arc on the lane's right side. Other chips slide along their curve until they hit no chip and no node.
- **Encoding.** Chip = direction glyph + four dots (filled = certainty), `--raised` fill, 1 px border in the direction colour. Colour repeats the glyph and is never the only cue. Line width = 1.5 px + 0.6 px per study, capped at 7 px. Arrowhead at the target.
- **Moderation.** Dotted curve from Fertilization at planting that ends with a ◆ touching the chip of Site preparation → growth. Its own chip has a dashed border. Its drawer card shows `direction_meaning` verbatim and names the target edge.
- **Combination.** The node shows its members as two stacked chips. Dotted membership connectors (no arrowheads) run on the left of lane 1. The legend says "Member of a combination — not an evidence edge".
- **Gaps.** A dashed, hollow link in `--text-3` with a "No evidence" label. No arrowhead. Hatched cell in the matrix. The drawer says the gap is not a negative result and shows `searched_for`.
- **Path honesty.** The first `limitations` string of the graph file is next to the graph, in the status line rule above, and in the drawer of every condition node. No path strength is computed.
- **Focus + context.** Click selection (above), lenses (Panel B: All, Direct, Via conditions, Interactions), direction chips, minimum certainty, show gaps, search with grouped results (Nodes, Edges/Findings, Papers, Claims), and the Graph | Matrix toggle. Filters and search are linked across graph, matrix and tables. The toolbar shows "Showing N of M". A selection also highlights its cells in the matrix.
- **Drawer.** Edge: title, direction, certainty, rationale, studies and claims, study-direction bar, then the claims grouped by paper (most claims first), each with subject → predicate → object, direction, grade, evidence types, comparator, claim id and the quote. Node: kind text, its edges (each selects that edge), members, the path note for conditions. Close button and Esc return focus to the opener.
- **Without JavaScript.** Both panels stack. Each shows its SVG graph, its matrix and all tables (findings/edges with rationales, gaps, interactions with quotes, papers). The quotes of the pooled findings/edges are one click away on the static claims page. The toolbar, status line, drawer, view switch and theme button are hidden. The system theme still applies.
- **Accessibility.** Landmarks, one `h1` per page, ordered headings, skip link, `lang`, title, meta description. Tabs follow the ARIA tab pattern with arrow keys. Every SVG node and chip is focusable, has `role="button"` and a full `aria-label`. The status line is an `aria-live` region. Visible focus rings. "View as table" by each graph. Real tables with captions, `th scope` and sortable headers with `aria-sort`. Motion is off with `prefers-reduced-motion`.

## Not done, or done differently

- The spec says that without JavaScript the page shows "all tables with quotes". The pooled claims' quotes now live on `claims-<panel>.html` (one click from each row), not inline in `index.html`. This cut the first view by 62%. The 5 Panel A interaction quotes are still inline.
- Panel A has no lens control. All its edges are direct findings, so a lens would change nothing.
- The combination node is highlighted when a member is clicked, but its own edge (combination → growth) is not, because it is not on a path through the member. The spec names only the node and the membership lines.
- A moderation edge counts as "direct" when its source is the clicked node or when the edge it changes touches the clicked node.
- The Claims table filters use each claim's own direction and grade, not its edge's. A note above the table says so.
- Only the Claims tables page at 25 rows ("Show all N claims"). Findings/Edges and Papers show all rows.
- There is no pan or zoom. On a phone the graph scrolls sideways inside its box.
- A filter or lens that fades an edge also fades it when it is selected; the selection does not override the filters.
- Missing years show as "–". Missing DOIs show the `document_id` as text.
- CSS and JS are squeezed at build time (comments and indentation removed, lines never joined). There is no real minifier.

## Known issues

- Opening `index.html` from `file://` (not through a server) blocks the `fetch` of `data/*.json` in most browsers. The drawer then shows a link to the static claims page. The spec serves the site with `python -m http.server`, where it works.
- Panel B is dense: 74 crossings remain between lanes 1 and 2. The click highlight, the matrix and the lenses are the way out.
- Faded items (12% opacity during a selection) are deliberately below text contrast. Everything on an active pathway, and every chip of a further edge, keeps full contrast.
- Label wrapping uses a width estimate for system fonts. A very wide fallback font could make a label touch its node border.
- Five paper titles contain literal `<i>…</i>` tags in the JSON. They are shown as text, verbatim.
- Lighthouse and axe-core were not run here (not installed, no network at build). Contrast, labels, focus and landmarks were checked by script and by eye in headless Chrome (light, dark, 390 px, no JavaScript).
