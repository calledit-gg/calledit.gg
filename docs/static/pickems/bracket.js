(function () {
  var stages = JSON.parse(document.getElementById("tournament-data").textContent);
  var config = JSON.parse(document.getElementById("page-config").textContent);
  var rootEl = document.getElementById("stages");

  // A link with #...picks... opens the page in read-only "shared picks" mode.
  var shared = BracketEngine.parseHash(location.hash);
  var readonly = shared.any;
  var state = {}; // stageId -> {matchId: teamId}
  stages.forEach(function (s) {
    state[s.id] = readonly && shared.stages[s.id] != null
      ? BracketEngine.decodeStage(s, shared.stages[s.id])
      : {};
  });

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function teamLabel(team) {
    var span = el("span", "team-label");
    if (team.logo) {
      var img = el("img", "team-logo");
      img.src = team.logo; img.alt = "";
      span.appendChild(img);
    }
    span.appendChild(el("span", "team-name", team.name));
    return span;
  }

  function slotButton(stage, match, team, computed) {
    var btn = el("button", "slot");
    btn.type = "button";
    if (!team) {
      btn.classList.add("empty");
      btn.disabled = true;
      btn.appendChild(el("span", "team-name", "TBD"));
      return btn;
    }
    btn.appendChild(teamLabel(team));
    var res = computed[match.id];
    if (res.winner) btn.classList.add(res.winner.id === team.id ? "won" : "lost");
    if (!(res.a && res.b) || readonly) btn.disabled = true;
    btn.addEventListener("click", function () {
      var picks = state[stage.id];
      if (picks[match.id] === team.id) delete picks[match.id];
      else picks[match.id] = team.id;
      render();
    });
    return btn;
  }

  function renderStage(stage) {
    var box = el("section", "stage");
    var head = el("div", "stage-head");
    head.appendChild(el("h2", null, stage.name));
    box.appendChild(head);

    if (!stage.ready) {
      box.appendChild(el("p", "muted", "Teams for this stage are not set yet."));
      return box;
    }

    var actions = el("div", "stage-actions");
    var dl = el("button", "reset", "Download image");
    dl.type = "button";
    dl.addEventListener("click", function () {
      var nick = document.querySelector(".author-input");
      var meta = {
        tournament: config.tournamentName,
        author: readonly ? shared.author : (nick ? nick.value.trim() : "")
      };
      dl.disabled = true; dl.textContent = "Preparing...";
      var fileName = BracketCard.slug(config.tournamentName + " " + stage.name) || "calledit-picks";
      var make = function () {
        return BracketCard.draw(stage, state[stage.id], meta).then(function (canvas) {
          return BracketCard.download(canvas, fileName);
        });
      };
      make().catch(function () {
        meta.noLogos = true; // fallback: some browsers block exporting images with logos
        return make();
      }).catch(function () {
        alert("Could not create the image, please try again.");
      }).then(function () { dl.disabled = false; dl.textContent = "Download image"; });
    });
    actions.appendChild(dl);
    if (!readonly) {
      var reset = el("button", "reset", "Reset");
      reset.type = "button";
      reset.addEventListener("click", function () { state[stage.id] = {}; render(); });
      actions.appendChild(reset);
    }
    head.appendChild(actions);

    var computed = BracketEngine.compute(stage, state[stage.id]);

    BracketEngine.layout(stage).forEach(function (section) {
      if (section.name) box.appendChild(el("h3", "section-name", section.name + " bracket"));
      var cols = el("div", section.extra ? "rounds extra" : "rounds");
      section.rounds.forEach(function (round, ri) {
        var prev = section.extra ? null : section.rounds[ri - 1];
        var next = section.extra ? null : section.rounds[ri + 1];
        var n = round.matches.length;
        var feedsNext = next && (next.matches.length === n || next.matches.length * 2 === n);
        var fedByPrev = prev && (prev.matches.length === n || prev.matches.length === n * 2);
        var halves = feedsNext && next.matches.length * 2 === n;

        var col = el("div", "round");
        col.appendChild(el("div", "round-name", round.name));
        var cells = el("div", "cells");
        round.matches.forEach(function (m, mi) {
          var cell = el("div", "cell");
          if (feedsNext) cell.classList.add("has-next");
          if (fedByPrev) cell.classList.add("has-prev");
          if (halves && mi % 2 === 0) cell.appendChild(el("div", "vline"));
          var card = el("div", "match");
          card.appendChild(slotButton(stage, m, computed[m.id].a, computed));
          card.appendChild(slotButton(stage, m, computed[m.id].b, computed));
          cell.appendChild(card);
          cells.appendChild(cell);
        });
        col.appendChild(cells);
        cols.appendChild(col);
      });
      box.appendChild(cols);
    });

    var out = el("div", "results");
    out.appendChild(el("h3", null, "Result"));
    BracketEngine.results(stage, computed).forEach(function (r) {
      var row = el("div", "result-row");
      row.appendChild(el("span", "result-label", r.label));
      if (r.team) row.appendChild(teamLabel(r.team));
      else row.appendChild(el("span", "muted", "-"));
      out.appendChild(row);
    });
    box.appendChild(out);
    return box;
  }

  function render() {
    rootEl.textContent = "";
    stages.forEach(function (s) { rootEl.appendChild(renderStage(s)); });
  }
  render();

  /* ---- shared (read-only) banner ---- */
  var plainUrl = location.href.split("#")[0];
  // on a real website "…/t/slug/index.html" and "…/t/slug/" are the same page: share the short one
  if (/^https?:$/.test(location.protocol)) plainUrl = plainUrl.replace(/index\.html$/, "");

  if (readonly) {
    var bannerSlot = document.getElementById("banner-slot");
    var hint = document.getElementById("edit-hint");
    if (hint) hint.hidden = true;
    if (bannerSlot) {
      var banner = el("div", "banner");
      banner.appendChild(document.createTextNode(shared.author ? "Picks by " : "Shared picks"));
      if (shared.author) banner.appendChild(el("b", null, shared.author));
      var again = el("a", null, "Make your own picks");
      again.href = plainUrl;
      banner.appendChild(again);
      bannerSlot.appendChild(banner);
    }
  }
  window.addEventListener("hashchange", function () { location.reload(); });

  /* ---- share bar (editable page only) ---- */
  function showLink(box, url) {
    box.textContent = "";
    box.appendChild(el("div", "save-ok", "Link ready! Send it to your friends:"));
    var row = el("div", "link-row");
    var input = el("input", "link-input");
    input.type = "text"; input.readOnly = true; input.value = url;
    var copy = el("button", "save-btn", "Copy");
    copy.type = "button";
    copy.addEventListener("click", function () {
      input.select();
      var done = function () { copy.textContent = "Copied"; };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(done, function () { document.execCommand("copy"); done(); });
      } else { document.execCommand("copy"); done(); }
    });
    var open = el("a", "open-link", "Open");
    open.href = url;
    row.appendChild(input); row.appendChild(copy); row.appendChild(open);
    box.appendChild(row);
  }

  function buildShareBar(slot) {
    var bar = el("div", "save-bar");
    var row = el("div", "save-row");
    var name = el("input", "author-input");
    name.type = "text"; name.maxLength = 40; name.placeholder = "Your nickname (optional)";
    var btn = el("button", "save-btn primary", "Create share link");
    btn.type = "button";
    var msg = el("div", "save-msg");
    btn.addEventListener("click", function () {
      var hash = BracketEngine.buildHash(stages, state, name.value.trim());
      if (hash === null) { msg.textContent = "Make at least one pick first."; return; }
      showLink(msg, plainUrl + "#" + hash);
    });
    row.appendChild(name); row.appendChild(btn);
    bar.appendChild(row); bar.appendChild(msg);
    slot.appendChild(bar);
  }

  var slot = document.getElementById("save-bar-slot");
  if (slot && !readonly) buildShareBar(slot);
})();
