from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("t/<slug:slug>/", views.tournament, name="tournament"),
]
