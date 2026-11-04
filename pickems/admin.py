from django import forms
from django.contrib import admin
from django.utils.html import format_html_join
from django.utils.safestring import mark_safe

from .formats import format_choices
from .models import Stage, StageTeam, Team, Tournament


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "logo")
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}


class StageForm(forms.ModelForm):
    format_key = forms.ChoiceField(label="Format")

    class Meta:
        model = Stage
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["format_key"].choices = format_choices()


class StageInline(admin.TabularInline):
    model = Stage
    form = StageForm
    fields = ("name", "format_key", "order")
    extra = 1
    show_change_link = True  # open the stage to assign teams


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ("name", "start_date", "is_published")
    list_filter = ("is_published",)
    prepopulated_fields = {"slug": ("name",)}
    inlines = [StageInline]


class StageTeamInline(admin.TabularInline):
    model = StageTeam
    extra = 8
    autocomplete_fields = ("team",)


@admin.register(Stage)
class StageAdmin(admin.ModelAdmin):
    form = StageForm
    list_display = ("__str__", "format_key", "teams_filled")
    list_filter = ("tournament",)
    inlines = [StageTeamInline]
    readonly_fields = ("seed_guide",)

    @admin.display(description="Seed guide")
    def seed_guide(self, obj):
        fmt = obj.format if obj and obj.pk else None
        if not fmt:
            return "Save the stage first to see which seed goes where."
        where = {}
        for m in fmt["matches"]:
            for side in ("a", "b"):
                if "seed" in m[side]:
                    where[m[side]["seed"]] = f'{m["round"]} ({m["id"]})'
        return format_html_join(mark_safe("<br>"), "Seed {}: {}", sorted(where.items()))

    @admin.display(description="Teams")
    def teams_filled(self, obj):
        fmt = obj.format
        needed = fmt["team_count"] if fmt else "?"
        return f"{obj.stageteam_set.count()}/{needed}"
