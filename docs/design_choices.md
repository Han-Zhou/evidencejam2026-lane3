# Design choices

This page tells the judges what we built and why.

We built a small Python program that turns the pack's answer files into a static website.
One command builds it: `./build.sh site/`. The site has four tabs:

| Tab | Question | What it shows |
| --- | --- | --- |
| Seedling findings | Q1 | Each treatment and its effect on survival and growth |
| Seedling story | Q1 | The full Q1 graph, with conditions, combinations and the moderation edge |
| Marsh timelines | Q2 | How created marshes compare with reference marshes |
| Grassland matrix | Q3 | The 24 × 16 evidence gap map |

## The main choices

| Choice | Why |
| --- | --- |
| Python standard library only | Nothing to install, so nothing can fail on ARM64 |
| No LLM call | Zero tokens, lowest build energy, and no text that could contradict the pack |
| Read `answers/*.json`, never recompute | The page shows the pack's numbers unchanged |
| Plain HTML, CSS, SVG and a little vanilla JavaScript | Small pages, works offline, no CDN |
| Fixed graph layout, computed at build time | The graph looks the same on every build and every screen |
| Overview first, details on click | The reader is not flooded, and the source is always close |

## 1. Why this stack

We compared four stacks and built a Q1 prototype of each one before we chose.

| Stack | Result |
| --- | --- |
| **Python standard library (chosen)** | No install step. Builds in about 0.1 s. Smallest pages. |
| Python plus Jinja2 | Cleaner templates, but it adds an install step for a small gain. |
| Eleventy or Astro | `npm install` downloads packages at build time. Native binaries are a risk on ARM64. |
| SvelteKit or Vite, with D3 or Cytoscape | The same npm risks, a larger bundle, canvas labels, and a layout that moves between builds. |

The rules decided it:

- **The build may call only the LLM.** Our build calls nothing. There is no `pip` and no `npm`.
- **Judges build on ARM64 Linux.** Pure Python has no binary that is specific to a machine.
- **Build energy is scored.** The build takes about 0.1 s and uses no tokens.
- **Page weight is scored.** The first view is about 170 KB. Each tab loads its own data only when the reader opens it.
- **The site must be static.** We rejected Streamlit, Dash, Flask and Next.js, because each needs a server at view time.

Two builds of the same input give byte-identical files.

## 2. Why no LLM

The answers are already in the pack. An LLM could only reword them.

- Rewording costs tokens, and tokens count against the energy score.
- LLM text can drift from the pack's numbers. Fixed text cannot.
- The build gives the same output every time, so it is easy to check.

We wrote the plain-language text by hand. The build does not read `BRINE_URL`, `BRINE_MODEL` or `BRINE_API_KEY`.

## 3. Why the numbers can be trusted

- The build copies every direction, certainty grade, rationale and count from the answer JSON.
- The build does not run `make_answers.py`. It reads the committed answer files only.
- `python3 tools/check_site.py site` compares every finding, gap, node, edge and quote on the built pages with the answer files. It passes.

## 4. How a reader moves through the site

Each tab works the same way: start with the whole picture, then go down one step at a time.

1. **Overview.** The graph or the matrix shows everything at once.
2. **Focus.** Click a node, an edge or a cell. Only the related parts stay bright.
3. **Details.** A side panel lists the evidence, with one dropdown for each paper.
4. **Source.** Each claim shows its quote, paper title, year and DOI link.

A reader reaches the source sentence in about two clicks.

Other choices that apply to every tab:

- **No hover popups.** In our first version they covered the lines of the graph. A click now shows the same information in a status line and the side panel.
- **Never colour alone.** Direction is an arrow glyph and a word (↑ ↓ ↕ =). Certainty is dots and a grade. This also works for colour-blind readers.
- **Certainty and its rationale** sit next to each finding in the details.
- **Papers are ranked** by the grade of their claims, so the strongest evidence is at the top. A very pale green or red tint shows which direction most of a paper's claims take.
- **Limitations are always open**, each in its own box. The text comes from the pack's `limitations` field.
- **"Want help?"** starts a short guided tour of the open tab, for first-time readers.
- **Export.** The reader can copy the graph as an image, or download the data as CSV or XLSX.
- **Light theme by default**, with a dark theme toggle.
- **Works without JavaScript.** The findings stay readable, and separate plain pages list every claim and quote.

## 5. Choices for each tab

### Seedling findings and Seedling story (Q1)

- **Two tabs for one question.** The findings tab answers "what works?" with the short list. The story tab adds site conditions, combined treatments and the moderation edge. Both tabs show the same numbers for the shared edges.
- **Layered graph in columns:** treatments on the left, conditions in the middle, outcomes on the right. It reads from left to right, like a sentence.
- **Labels are real SVG text**, not canvas. Screen readers and page search can read them.
- **A gap is a dashed grey line** with the words "No evidence". It never looks like a weak or negative result.
- **`mixed` and `no effect` have their own glyphs**, so they read as findings and not as gaps.
- **All evidence lines have one width.** Width showed the number of studies in an early version. A reader can mistake it for the strength of the effect, so we removed it. The study counts are in the details.
- **The moderation edge is a dotted line that points at its target edge**, not at a node.
- **A combination node links to its members** with thin dotted lines.
- **A path through a condition node is two separate edges.** Each edge has its own chip and its own evidence. We never join them into one effect and never multiply them.
- **Edges in the story tab start hidden.** With 29 edges on 12 nodes, the lines crossed and were hard to read. Click a node to see its edges, or turn on "Show all edges" to see every edge at once. The findings tab shows all edges from the start.
- **Matrix view.** A toggle shows the same data as a table, for readers who prefer rows and columns.

### Marsh timelines (Q2)

- **"Time to reference: unknown" has a warning label.** No study in the corpus reports how long a created marsh takes to match a reference. We say so, and we show no number.
- **A coverage bar at the top** gives the overall picture before the reader opens a finding.
- **"When was it measured?"** is a dropdown inside each finding. The few time points stay next to the finding they belong to.

### Grassland matrix (Q3)

- **One matrix, no graph.** Q3 asks where evidence exists. A grid of 16 outcomes by 24 interventions answers that at a glance.
- **Colour depth shows how many studies a cell has:** thin (1), some (2 to 3), dense (4 or more), and the pack's ten densest cells.
- **Gaps are grey with a diagonal hatch and a dashed border.** A gap means that no study tested the pair. It is not a negative result.
- **Sort and filter** for rows and columns are in a bar at the top that stays in view.
- **Details open at the right side** and stay in view while the table scrolls. They show the direction, the certainty with its rationale, and the quotes.

## 6. What we tried and removed

| Removed | Why |
| --- | --- |
| A chat window that called the LLM | It called the LLM at view time. The rules forbid that. |
| A force-directed, zoomable graph | The layout moved between builds. Twelve nodes do not need it. |
| The three other stacks | See section 1. Git history keeps them. |
| A choice of where to put the toolbar | It was an experiment. One fixed place at the top is simpler. |
| Dots inside the Q3 cells | Colour depth was enough, and the grid became easier to scan. |

## 7. Known limits

- The story tab needs one click on "Show all edges" to show every edge at once.
- The matrix view needs JavaScript. Without it, the plain claims pages carry the same content.
- The JavaScript is whitespace-stripped only. A real minifier needs a tool outside the standard library, so we did not add one.
- Our own Lighthouse run gave 98 to 100 for performance, 100 for accessibility on the four tabs, 96 for best practices and 100 for SEO. The site has no favicon, which costs the best-practices points.
