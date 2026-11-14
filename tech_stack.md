# Tech stack selection

Status: proposed. Decision pending.
Date: 2026-11-14

## Decision drivers

1. The build makes no network call except to the LLM. Every other dependency must be pinned and vendored or installed from a lock file.
2. Judges run the build on ARM64 (aarch64) Linux. Every dependency must install there.
3. Build energy is scored. Use less compute and fewer LLM tokens.
4. Page weight per view is scored. Ship little JavaScript and no CDN assets.
5. The site must be a directory of static files. It is served with `python -m http.server`.
6. The Q1 graph needs DOM text labels, direction and certainty readable without colour, selectable edges, a moderation edge that points at its target edge, and a combination node that shows its members.
7. Deadline: last commit before 6 p.m. EST, Sunday, November 15, 2026.

## Ranking

| Rank | Stack | Build tooling | Client JS | Main risk |
| --- | --- | --- | --- | --- |
| 1 | Python stdlib generator, static HTML and CSS, inline SVG, small vanilla JS | Python 3.12 only | Minimal | Hand-written templates and layout |
| 2 | Rank 1 plus Jinja2 (pinned) | Python and Jinja2 | Minimal | Install step, small gain |
| 3 | Eleventy or Astro | Node and npm lock file | Minimal | npm downloads at build, native binaries on arm64 |
| 4 | SvelteKit (static) or Vite and Preact, with D3 or Cytoscape | Node and npm | Larger | Bundle weight, canvas labels, unstable layout |

## 1. Python stdlib generator (recommended)

Design:

- `build.sh` runs `build.py`.
- `build.py` reads `answers/*.json` and writes `site/index.html` and one page per question.
- The Q1 graph is inline SVG. Positions are fixed and layered, and they are computed at build time.
- Vanilla JavaScript adds selection and the evidence panel. Each page stays readable without JavaScript.
- The optional LLM call uses `urllib`, as in `temp_demo/server.py`. Its text is written into the output as plain text.

Pros:

- No install step. Nothing fails on aarch64.
- Lowest build energy and lowest page weight.
- Works without JavaScript, which helps Lighthouse and axe-core.
- Same language as `make_answers.py` and `temp_demo/server.py`.
- Full control of each SVG mark, so the gap, moderation and combination rules hold.

Cons:

- Templates are Python strings. Escape all text with `html.escape`.
- Layout and edge routing are written by hand.
- No components and no hot reload.

Notes:

- If the build also reruns `make_answers.py`, it needs PyYAML. Pin it (`PyYAML==<version>`) and confirm the aarch64 wheel installs.
- Pin the Python version in the README.

## 2. Rank 1 plus Jinja2

Pros:

- Cleaner templates, with auto-escape and macros for finding cards and certainty badges.
- Pure Python. It installs on aarch64.

Cons:

- Adds an install step. The build downloads it unless the package is vendored.
- The gain is small for about five templates.

## 3. Eleventy or Astro

Pros:

- Components, a lock file and static output with little client JavaScript.

Cons:

- `npm install` downloads packages at build time.
- Judges need Node. The README does not state that Node is installed on the judging machine.
- Native binaries (esbuild, Rollup) need arm64 testing.
- Setup takes time that the deadline does not allow.

## 4. SvelteKit (static) or Vite and Preact, with D3 or Cytoscape

Pros:

- The richest interaction.
- Fast for a developer who already knows the framework.

Cons:

- The same npm risks as rank 3.
- A larger JavaScript bundle lowers the Lighthouse score and adds page weight.
- Cytoscape draws on a canvas by default. That breaks the rule that labels must be DOM text.
- A force layout moves between builds. Twelve nodes do not need one.

## Rejected

- Streamlit, Dash, Flask and server-rendered Next.js. Each needs a server at view time.
- Libraries from a CDN. The site must work offline.
- The `/api/chat` endpoint in `temp_demo/server.py`. It calls the LLM at view time. Use it for testing only.
- `litellm` (used in `try_brine.py`). It is a heavy dependency for one HTTP request. Use `urllib`.

## Rules for any stack

- Split the evidence by view. Each page loads only what it needs. Sizes in `answers/`:
  - Q1 answer file: 222 KB. Its evidence map: 189 KB, 239 claims.
  - Q1 graph file: 313 KB, 330 claims.
  - Q2 answer file: 40 KB. Its evidence map: 23 KB, 27 claims.
  - Q3 answer file: 771 KB. Its evidence map: 504 KB, 663 claims.
- The LLM is optional. The build must work with `BRINE_URL`, `BRINE_MODEL` and `BRINE_API_KEY` unset. Use fixed template text in that case.
- The LLM writes plain-language summaries only. Directions, certainty grades and study counts come from the answer JSON, unchanged.
- Make LLM calls in batches. Record the token count of each build.
- Read secrets from the environment only. `.env` is already in `.gitignore`. Do not commit keys.

## Open decisions

1. Confirm rank 1 (no npm).
2. Does the build regenerate `answers/` with `make_answers.py`, or only read it? The answer depends on whether PyYAML must be pinned.
3. Should the LLM write summaries? If yes, which fields?
4. Which Python version do the judges use? Pin it.
