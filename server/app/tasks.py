"""Task indexing and loading from data/task*.json."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from typing import Any

from .config import DATA_DIR

_TASK_RE = re.compile(r"^task(\d{3})\.json$")


@lru_cache(maxsize=1)
def list_tasks() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not DATA_DIR.is_dir():
        return out
    for p in sorted(DATA_DIR.iterdir()):
        m = _TASK_RE.match(p.name)
        if not m:
            continue
        num = int(m.group(1))
        try:
            with p.open() as f:
                t = json.load(f)
        except Exception:
            continue
        out.append({
            "num": num,
            "filename": p.name,
            "trainCount": len(t.get("train", [])),
            "testCount": len(t.get("test", [])),
            "arcGenCount": len(t.get("arc-gen", [])),
        })
    return out


def load_task(num: int) -> dict[str, Any] | None:
    name = f"task{num:03d}.json"
    p = DATA_DIR / name
    if not p.is_file():
        return None
    with p.open() as f:
        return json.load(f)
