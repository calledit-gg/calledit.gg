"""python manage.py export_site  ->  builds the static site into docs/ (for GitHub Pages)."""
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.template.loader import render_to_string

import pickems
from pickems.models import Tournament
from pickems.pages import home_context, tournament_context


class Command(BaseCommand):
    help = "Builds the static website (docs/ folder) from the published tournaments."

    def add_arguments(self, parser):
        parser.add_argument("--out", default=None, help="Output folder (default: <project>/docs)")

    def handle(self, *args, **options):
        out = Path(options["out"]) if options["out"] else Path(settings.BASE_DIR) / "docs"
        app_dir = Path(pickems.__file__).resolve().parent
        out.mkdir(parents=True, exist_ok=True)

        # remove the previous build (only the parts we generate)
        for name in ("index.html", "t", "static", "media"):
            target = out / name
            if target.is_dir():
                shutil.rmtree(target)
            elif target.exists():
                target.unlink()

        tournaments = list(Tournament.objects.filter(is_published=True))

        shutil.copytree(app_dir / "static" / "pickems", out / "static" / "pickems")

        html = render_to_string(
            "pickems/home.html",
            home_context(
                tournaments,
                root="",
                home_url="index.html",
                tournament_url=lambda slug: f"t/{slug}/index.html",
            ),
        )
        (out / "index.html").write_text(html, encoding="utf-8")

        copied = set()
        for t in tournaments:
            ctx = tournament_context(
                t, root="../../", home_url="../../index.html", media_prefix="../../media/"
            )
            page_dir = out / "t" / t.slug
            page_dir.mkdir(parents=True, exist_ok=True)
            (page_dir / "index.html").write_text(
                render_to_string("pickems/tournament.html", ctx), encoding="utf-8"
            )

            for stage in t.stages.all():
                for st in stage.stageteam_set.select_related("team"):
                    logo = st.team.logo
                    if not logo or logo.name in copied:
                        continue
                    src = Path(settings.MEDIA_ROOT) / logo.name
                    if not src.exists():
                        self.stderr.write(f"Missing logo file for {st.team.name}: {src}")
                        continue
                    dst = out / "media" / logo.name
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src, dst)
                    copied.add(logo.name)

        (out / ".nojekyll").touch()  # tell GitHub Pages not to process the files
        self.stdout.write(
            self.style.SUCCESS(
                f"Exported {len(tournaments)} tournament(s) and {len(copied)} logo(s) to {out}"
            )
        )
