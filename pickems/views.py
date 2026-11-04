from django.conf import settings
from django.shortcuts import get_object_or_404, render
from django.urls import reverse

from .models import Tournament
from .pages import home_context, tournament_context


def _visible_tournaments(request):
    # Unpublished tournaments are visible to staff only (handy for testing).
    if request.user.is_staff:
        return Tournament.objects.all()
    return Tournament.objects.filter(is_published=True)


def home(request):
    ctx = home_context(
        _visible_tournaments(request),
        root="/",
        home_url="/",
        tournament_url=lambda slug: reverse("tournament", args=[slug]),
    )
    return render(request, "pickems/home.html", ctx)


def tournament(request, slug):
    t = get_object_or_404(_visible_tournaments(request), slug=slug)
    ctx = tournament_context(t, root="/", home_url="/", media_prefix=settings.MEDIA_URL)
    return render(request, "pickems/tournament.html", ctx)
