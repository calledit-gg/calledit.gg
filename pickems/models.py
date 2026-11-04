import secrets
import string

from django.core.exceptions import ValidationError
from django.db import models

from .formats import get_format


class Team(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    logo = models.ImageField(upload_to="teams/", blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Tournament(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    start_date = models.DateField(null=True, blank=True)
    is_published = models.BooleanField(
        default=False, help_text="Show on the site (turn on when the stages are ready)."
    )

    class Meta:
        ordering = ["-start_date", "name"]

    def __str__(self):
        return self.name


class Stage(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="stages")
    name = models.CharField(max_length=100, help_text="For example: Group A, Playoffs")
    format_key = models.CharField(max_length=50, verbose_name="Format")
    order = models.PositiveSmallIntegerField(default=0)
    teams = models.ManyToManyField(Team, through="StageTeam")

    class Meta:
        ordering = ["tournament", "order"]

    def __str__(self):
        return f"{self.tournament.name} - {self.name}"

    @property
    def format(self):
        return get_format(self.format_key)

    def clean(self):
        if self.format_key and self.format is None:
            raise ValidationError({"format_key": "Unknown format."})


class StageTeam(models.Model):
    """A team in a stage. Seed = position in the bracket as displayed (1, 2, 3...).
    Seeds 1+2 play each other in the first match, 3+4 in the second, and so on."""

    stage = models.ForeignKey(Stage, on_delete=models.CASCADE)
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    seed = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["stage", "seed"]
        constraints = [
            models.UniqueConstraint(fields=["stage", "seed"], name="unique_seed_per_stage"),
            models.UniqueConstraint(fields=["stage", "team"], name="unique_team_per_stage"),
        ]

    def __str__(self):
        return f"{self.stage} #{self.seed}: {self.team}"


def _new_code():
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


class Pick(models.Model):
    """One saved pick'em card for a tournament.
    picks = {"<stage_id>": {"<match_id>": <team_id>, ...}, ...}"""

    code = models.CharField(max_length=12, unique=True, editable=False)
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="picks")
    author = models.CharField(max_length=40, blank=True)
    picks = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.code:
            code = _new_code()
            while Pick.objects.filter(code=code).exists():
                code = _new_code()
            self.code = code
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} ({self.tournament})"
