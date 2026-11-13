#!/usr/bin/env python3
"""Demo server: serves this folder and answers chat questions with the Brine LLM.

The LLM only sees the pack's precomputed answers (answers/*.json) plus the
source quotes that best match the question. The API key stays on the server.

Settings come from BRINE_URL, BRINE_MODEL and BRINE_API_KEY (environment, or
the repo's .env file as a fallback).

    python3 temp_demo/server.py [port]     # default 8767
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
DATA = HERE / "data"
FILES = ["q1_tree_planting", "q2_created_marshes", "q3_grassland_gaps"]
MAX_QUOTES = 12
MAX_HISTORY = 6


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*([A-Za-z_]\w*)\s*[=:]\s*(.*)", line)
        if m and not line.lstrip().startswith("#"):
            os.environ.setdefault(m.group(1), m.group(2).strip().strip("'\""))


def fmt_finding(f, evidence):
    # A few raw claim subjects, so the model can match words like "herbicide" to "Vegetation control".
    examples = list(dict.fromkeys(evidence[e]["subject"].lower() for e in f["edge_ids"] if e in evidence))[:3]
    return (f"- [{f['id']}] {f['subject']['label']} -> {f['outcome']['label']}: "
            f"{f['direction']}, certainty {f['certainty']} ({f['certainty_rationale']}); "
            f"{f['studies']} studies, {f['claims']} claims; e.g. {'; '.join(examples)}")


def build_knowledge():
    """Compact text summary of every answer, plus a flat list of quotes for retrieval."""
    parts, quotes, topics = [], [], []
    for name in FILES:
        d = json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))
        labels = {x["subject"]["label"] for x in d["findings"] + d["gaps"]} | {x["outcome"]["label"] for x in d["findings"] + d["gaps"]}
        topics.append(f"- {d['question']}\n  Topics: {'; '.join(sorted(labels))}")
        parts.append(f"## {d['id']}\nQuestion: {d['question']}\nHow built: {d['how_built']}")
        if "short_answer" in d:
            s = d["short_answer"]
            parts.append(f"Time to reference: {s['time_to_reference']} (null = not answerable). "
                         f"{s['time_to_reference_note']}\nLagging attributes: {', '.join(s['lagging_attributes'])}")
        if "summary" in d:
            s = d["summary"]
            parts.append(f"Gap map: {s['cells']} cells, {s['filled']} with evidence ({s['thin']} thin), "
                         f"{s['empty']} empty. Grassland claims {s['grassland_claims']}, pooled {s['claims_pooled']}.")
        parts.append("Findings:\n" + "\n".join(fmt_finding(f, d["evidence"]) for f in d["findings"]))
        if d.get("with_time"):
            parts.append("Effect of time since creation:\n" + "\n".join(fmt_finding(f, d["evidence"]) for f in d["with_time"]))
        if d.get("interactions"):
            ev = d["evidence"]
            parts.append("Interactions / combined treatments (kept out of findings):\n" + "\n".join(
                f"- {ev[i['edge_id']]['subject']} -> {ev[i['edge_id']]['object']}: {i['direction']}"
                for i in d["interactions"] if i["edge_id"] in ev))
        gaps = d.get("gaps", [])
        if gaps:
            parts.append(f"Gaps (no study tested the pairing; NOT a negative result), {len(gaps)} total:\n" +
                         "; ".join(f"{g['subject']['label']} -> {g['outcome']['label']}" for g in gaps))
        parts.append("Limitations:\n" + "\n".join(f"- {x}" for x in d["limitations"]))
        counts_in = {}
        for f in d["findings"] + d.get("with_time", []):
            for eid in f["edge_ids"]:
                counts_in.setdefault(eid, []).append(f["id"])
        for eid, e in d["evidence"].items():
            text = f"{e['subject']} {e['predicate']} {e['object']} {e['quote']}"
            e = dict(e, findings=counts_in.get(eid, []))
            quotes.append((d["id"], eid, e, set(re.findall(r"[a-z]{4,}", text.lower()))))
    return "\n\n".join(parts), quotes, "\n".join(topics)


def retrieve(question, quotes):
    words = set(re.findall(r"[a-z]{4,}", question.lower()))
    scored = sorted(((len(words & w), qid, eid, e) for qid, eid, e, w in quotes), key=lambda t: -t[0])
    seen, out = set(), []
    for score, qid, eid, e in scored:
        if score == 0 or len(out) >= MAX_QUOTES:
            break
        if eid in seen:
            continue
        seen.add(eid)
        where = ", ".join(e["findings"]) or f"{qid}, not in a pooled finding"
        out.append(f"- [{eid}] (counts in: {where}) {e['subject']} -> {e['object']} ({e['direction']}). "
                   f"Quote: \"{e['quote']}\" Source: {e['title']} ({e['year']}), doi:{e['doi']}")
    return "\n".join(out) or "(no matching source quotes)"


SYSTEM = """You answer questions from restoration practitioners using ONLY the evidence summary below, \
which was precomputed from a corpus of Canadian restoration studies. Rules:
- Quote directions, certainty grades and study/claim counts exactly as given; never invent numbers.
- A gap means no study tested that pairing; it is not evidence of no effect. 'mixed' and 'no_effect' are findings.
- The corpus does not say how long created marshes take to reach reference condition; say so if asked.
- Cite finding ids like [q1:...] or edge ids like [camo:edge_...] for claims you make.
- If the summary does not cover the question, say the evidence pack does not answer it.
- Be concise: a short paragraph or a few bullets, plain language.

# Evidence summary
{knowledge}"""


GENERAL = """You are a helpful assistant on a website about restoration-ecology evidence. The user's message is \
not about that evidence, so answer it helpfully and concisely from general knowledge. Do not claim your answer \
comes from the site's evidence pack."""

GATE = """You are a router for a chat assistant that also has the restoration-ecology evidence below. \
Reply ON if the user's latest message asks about, or follows up on, these questions or their topics \
(restoration practices, ecological outcomes, the studies, certainty, gaps or methods behind the answers). \
Reply OFF for anything else (general knowledge, coding, chit-chat and so on). \
Reply with one word: ON or OFF.

# What the assistant covers
{scope}"""


def on_topic(history):
    """Cheap routing call (~1k tokens): only on-topic messages get the 17k-token evidence context."""
    convo = "\n".join(f"{m['role'].upper()}: {m['content'][:500]}" for m in history[-3:])
    try:
        verdict, _ = ask_llm([{"role": "system", "content": GATE.format(scope=SCOPE)},
                              {"role": "user", "content": convo}], max_tokens=3)
    except Exception:
        return True  # routing failure: use the grounded prompt, which still handles general questions
    return not verdict.strip().upper().startswith("OFF")


def ask_llm(messages, max_tokens=700):
    url = os.environ["BRINE_URL"].rstrip("/") + "/chat/completions"
    body = json.dumps({"model": os.environ["BRINE_MODEL"], "messages": messages, "temperature": 0.2, "max_tokens": max_tokens,
                       # Qwen3 on vLLM: skip hidden reasoning, which otherwise takes minutes on a 15k-token context
                       "chat_template_kwargs": {"enable_thinking": False}}).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {os.environ['BRINE_API_KEY']}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.load(r)
    text = resp["choices"][0]["message"].get("content") or ""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip(), resp.get("usage")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(HERE), **kw)

    def do_POST(self):
        if self.path != "/api/chat":
            return self.send_error(404)
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            history = [m for m in req.get("messages", []) if m.get("role") in ("user", "assistant")][-MAX_HISTORY:]
            question = history[-1]["content"]
            if not on_topic(history):
                answer, usage = ask_llm([{"role": "system", "content": GENERAL}] + history)
                return self._json(200, {"answer": answer, "usage": usage, "grounded": False})
            system = SYSTEM.format(knowledge=KNOWLEDGE) + "\n\n# Source quotes most relevant to the latest question\n" + retrieve(question, QUOTES)
            answer, usage = ask_llm([{"role": "system", "content": system}] + history)
            self._json(200, {"answer": answer, "usage": usage, "grounded": True})
        except urllib.error.HTTPError as e:
            self._json(502, {"error": f"LLM endpoint returned {e.code}"})
        except Exception as e:  # demo server: report, don't crash
            self._json(500, {"error": f"{type(e).__name__}: {e}"})

    def _json(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    load_dotenv(REPO / ".env")
    missing = [k for k in ("BRINE_URL", "BRINE_MODEL", "BRINE_API_KEY") if not os.environ.get(k)]
    if missing:
        sys.exit(f"Missing {', '.join(missing)} (set them or add them to {REPO / '.env'})")
    KNOWLEDGE, QUOTES, SCOPE = build_knowledge()
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8767
    print(f"Knowledge summary: {len(KNOWLEDGE)} chars, {len(QUOTES)} quotes. Serving on http://localhost:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
