"""Builds the data the templates need. Used by the dev views AND by export_site."""


def stages_data(tournament, media_prefix):
    stages = []
    for stage in tournament.stages.all():
        fmt = stage.format
        if fmt is None:
            continue
        teams = [
            {
                "seed": st.seed,
                "id": st.team_id,
                "name": st.team.name,
                "logo": (media_prefix + st.team.logo.name) if st.team.logo else "",
            }
            for st in stage.stageteam_set.select_related("team").order_by("seed")
        ]
        stages.append(
            {
                "id": stage.id,
                "name": stage.name,
                "ready": len(teams) == fmt["team_count"],
                "format": {"matches": fmt["matches"], "results": fmt["results"]},
                "teams": teams,
            }
        )
    return stages


def home_context(tournaments, root, home_url, tournament_url):
    """root: prefix for static files ("/" on the dev server, "" or "../../" in the export)."""
    return {
        "root": root,
        "home_url": home_url,
        "tournaments": [
            {
                "name": t.name,
                "url": tournament_url(t.slug),
                "start_date": t.start_date,
                "is_published": t.is_published,
            }
            for t in tournaments
        ],
    }


def tournament_context(tournament, root, home_url, media_prefix):
    return {
        "root": root,
        "home_url": home_url,
        "tournament": tournament,
        "stages": stages_data(tournament, media_prefix),
        "config": {"tournamentName": tournament.name},
    }
