"""Server-side twin of static/pickems/engine.js: checks that saved picks are valid."""


def _resolve(ref, seed_to_team, computed):
    if "seed" in ref:
        return seed_to_team.get(ref["seed"])
    if "winner" in ref:
        return computed[ref["winner"]]["winner"]
    return computed[ref["loser"]]["loser"]


def sanitize_picks(fmt, seed_to_team, picks):
    """fmt: format dict. seed_to_team: {seed: team_id}. picks: {match_id: team_id}.
    Returns only the picks that are consistent with the bracket."""
    clean, computed = {}, {}
    for m in fmt["matches"]:
        a = _resolve(m["a"], seed_to_team, computed)
        b = _resolve(m["b"], seed_to_team, computed)
        chosen = picks.get(m["id"])
        winner = loser = None
        if a is not None and b is not None and chosen in (a, b) and not isinstance(chosen, bool):
            winner = chosen
            loser = b if chosen == a else a
            clean[m["id"]] = chosen
        computed[m["id"]] = {"winner": winner, "loser": loser}
    return clean
