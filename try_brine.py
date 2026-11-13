#!/usr/bin/env python3
"""Minimal script to test the Brine LiteLLM endpoint."""

import os
import sys
from pathlib import Path

import litellm


def load_dotenv_fallback(path: Path) -> None:
    """Populate missing env vars from .env (supports KEY=VALUE and KEY: VALUE)."""
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line and (":" not in line or line.index("=") < line.index(":")):
            key, value = line.split("=", 1)
        elif ":" in line:
            key, value = line.split(":", 1)
        else:
            continue
        key = key.strip()
        value = value.strip().strip("'\"")
        if key:
            os.environ.setdefault(key, value)


def main() -> int:
    load_dotenv_fallback(Path(__file__).resolve().parent / ".env")

    base_url = os.environ.get("BRINE_URL")
    model = os.environ.get("BRINE_MODEL")
    api_key = os.environ.get("BRINE_API_KEY")

    missing = [
        name
        for name, val in (
            ("BRINE_URL", base_url),
            ("BRINE_MODEL", model),
            ("BRINE_API_KEY", api_key),
        )
        if not val
    ]
    if missing:
        print(f"Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        return 1

    prompt = " ".join(sys.argv[1:]).strip() or "Say hello in one short sentence."
    litellm_model = model if "/" in model else f"openai/{model}"

    response = litellm.completion(
        model=litellm_model,
        api_base=base_url,
        api_key=api_key,
        messages=[{"role": "user", "content": prompt}],
    )

    content = response.choices[0].message.content or ""
    print(content.strip())
    if getattr(response, "usage", None):
        print(
            f"\n[tokens: prompt={response.usage.prompt_tokens}, "
            f"completion={response.usage.completion_tokens}, "
            f"total={response.usage.total_tokens}]",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
