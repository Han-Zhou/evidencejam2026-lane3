# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The starter pack for **Evidence Jam 2026, Lane 3 (Decision Support)**. The task is to build a **static website** that answers three restoration-practitioner questions from precomputed evidence, and draws the Q1 answer as an interactive graph. The answers already exist in `answers/`. No site or build pipeline exists yet: that is the work. `README.md` is the challenge brief and the reference for the JSON shapes. Read it before designing anything.

## Commands

```bash
python3 make_answers.py   # rebuild answers/*.json, answers/answers.md and manifest.json (~4 s)
```

- Use `python3`. `python` is not on PATH on this machine. The only dependency is PyYAML (it uses `CSafeLoader` when available).
- The script is deterministic and offline: no LLM, no network. Rerunning it on an unmodified checkout gives byte-identical output, so `git status` after a run shows whether anything really changed.
- There are no tests, linters or other tooling in the pack.

## Data flow

```
graph/causal_graph.yaml ─┐
groups/grouping_audit.csv ┼─> make_answers.py ─> answers/q1_tree_planting.json
groups/lane3_groups.yaml ─┘                      answers/q1_tree_planting_graph.json
  (group ids/labels only)                        answers/q2_created_marshes.json
                                                 answers/q3_grassland_gaps.json
                                                 answers/answers.md, manifest.json
```

- **`graph/causal_graph.yaml`** (~340k lines, CAMO 0.10.0 schema in `graph/causalmosaic.yaml`) has three top-level lists: `nodes` (line ~12), `edges` (line ~135433) and `source_documents` (line ~337076). Each edge is one claim, with `subject`, `predicate`, `object`, `negated`, `original_sentence`, `source_document`, `evidential_basis`, `comparator` and `ecosystem_context`. Don't read the whole file. Grep or `sed -n` a range, or load it in Python.
- **Grouping gotcha:** Q2 and Q3 read node to group assignments from `groups/grouping_audit.csv`, not from the regexes in `lane3_groups.yaml`. `make_answers.py` reads the YAML only for the ordered list of group ids and labels. Nothing in this repo regenerates the CSV from the YAML, so changing a regex in the YAML alone has no effect on the answers. Q1 doesn't use the groups at all: its matching is the `Q1_TRAITS`, `Q1_MODIFIERS`, `Q1_CONDITIONS` and `Q1_OUTCOMES` regexes inside `make_answers.py`.

## How `make_answers.py` works

- `claim_direction()` reads one claim's sign. A `negated` claim is `no_effect`. Otherwise the sign comes from the object node's `state_or_change_qualifier`, or from its name (the `UP`/`DOWN` regexes). It is flipped by `prevents`/`disrupts`, by an absent subject, and by mortality outcomes, which are read as survival.
- `pool()` implements certainty rule `lane3-barebones-1`. Claims are vote-counted within each study, then across studies, and a direction holds at a ≥ ⅔ majority, else `mixed`. The grade starts from the best study design and is adjusted ±1. Every grade carries a `certainty_rationale` string.
- `q1()` puts combined treatments (a trait and a site factor in one subject) and `moderates` claims into `interactions`, not into findings.
- `q1_graph()` copies Q1's findings verbatim as the edges from stock traits and site treatments into survival and growth. It pools only the extra edges (treatment → condition, condition → outcome, combinations, moderations). This keeps the list view and the graph view of Q1 from disagreeing, so keep that invariant if you touch it.
- `q2()` maps directions onto `below_reference`/`comparable`/`above_reference`. `short_answer.time_to_reference` is deliberately `null`.
- `q3()` builds a 24 × 16 evidence gap map. Intervention groups are multi-label, so one claim can count in several cells.

## Hard requirements for the deliverable (from README)

These come from the judging rules. Breaking one costs points or disqualifies the build:

- **One build command from a clean checkout** (e.g. `./build.sh site/`) that goes from the pack's files to a finished site. Dependencies are pinned (lock file or `==`). Judges build on **ARM64 / aarch64 Linux** (NVIDIA DGX Spark), so every dependency has to install there.
- **The only network call at build time is the LLM**, and its settings come from `BRINE_URL`, `BRINE_MODEL` and `BRINE_API_KEY`. Never hardcode or commit them. The LLM is optional. Build energy, including LLM tokens, is scored, so use it sparingly.
- **The output is a directory of static files with an `index.html`.** It is served with `python -m http.server`, works fully offline, and makes no LLM or other calls at view time. It is tested with Lighthouse and axe-core, and page weight per view is scored. Any library must be bundled and served locally.
- **Serve the pack's numbers.** Directions, certainty grades and study and claim counts must come from the answer JSON unchanged, because judges' scripts check them. LLM text is limited to plain-language summaries and explanations. If you disagree with a rule, say so on the page next to the pack's number. Don't change the number.
- **Semantics that must survive into the UI:**
  - A gap (empty cell, `no_evidence`) means no study tested that pairing. It is **not** a negative result. Draw it as a gap, never as a weak or negative edge.
  - `mixed` and `no_effect` are findings, distinct from gaps.
  - Show `certainty` and its `certainty_rationale` next to each finding.
  - Q2's "how long?" has no answer in the corpus. Say so; never invent a number.
  - Provenance: every finding's `edge_ids` resolve in that file's `evidence` map (quote, title, year, DOI). A user should reach the source sentence in about two clicks.
- **Q1 graph view:**
  - Show every node and edge, with direction and certainty readable without hovering and not encoded by colour alone.
  - Selecting an edge reaches its claims and their quotes.
  - A `moderation` edge points at its `target_edge`, and a `combination` node shows its `members`.
  - A path through a `condition` node joins two separate bodies of evidence. Don't present it as one tested effect or multiply edge strengths.
  - Labels are DOM text (HTML or SVG `<text>`), not only canvas.
- **Deadline:** the last commit before 6 p.m. EST on Sunday, November 15, 2026 is judged.
