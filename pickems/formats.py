"""Loads and validates bracket format definitions from format_defs/*.json.

A format is a graph of matches. Each match slot (a / b) is one of:
  {"seed": N}        - the Nth team of the stage (by seed number)
  {"winner": "ID"}   - the winner of an earlier match
  {"loser": "ID"}    - the loser of an earlier match
"""
import json
from functools import lru_cache
from pathlib import Path

FORMATS_DIR = Path(__file__).resolve().parent / "format_defs"


class FormatError(ValueError):
    pass


def _validate(fmt, filename):
    def fail(msg):
        raise FormatError(f"{filename}: {msg}")

    for field in ("key", "name", "team_count", "matches", "results"):
        if field not in fmt:
            fail(f"missing field '{field}'")

    seen_ids = set()
    used_seeds = []

    def check_ref(ref, where):
        if len(ref) != 1:
            fail(f"{where}: reference must have exactly one key, got {ref}")
        kind, value = next(iter(ref.items()))
        if kind == "seed":
            used_seeds.append(value)
        elif kind in ("winner", "loser"):
            if value not in seen_ids:
                fail(f"{where}: refers to '{value}' which is not defined earlier")
        else:
            fail(f"{where}: unknown reference type '{kind}'")

    for match in fmt["matches"]:
        mid = match.get("id")
        if not mid or mid in seen_ids:
            fail(f"bad or duplicate match id: {mid!r}")
        check_ref(match["a"], f"match {mid} slot a")
        check_ref(match["b"], f"match {mid} slot b")
        seen_ids.add(mid)

    if sorted(used_seeds) != list(range(1, fmt["team_count"] + 1)):
        fail(f"seeds used {sorted(used_seeds)} do not match 1..{fmt['team_count']}")

    for res in fmt["results"]:
        check_ref(res["source"], f"result '{res.get('label')}'")


@lru_cache(maxsize=1)
def load_formats():
    """Returns {key: format_dict}. Raises FormatError if any file is invalid."""
    formats = {}
    for path in sorted(FORMATS_DIR.glob("*.json")):
        fmt = json.loads(path.read_text(encoding="utf-8"))
        _validate(fmt, path.name)
        if fmt["key"] in formats:
            raise FormatError(f"{path.name}: duplicate format key '{fmt['key']}'")
        formats[fmt["key"]] = fmt
    return formats


def get_format(key):
    return load_formats().get(key)


def format_choices():
    return [(key, fmt["name"]) for key, fmt in load_formats().items()]
