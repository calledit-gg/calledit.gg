/* Draws a shareable PNG card for ONE stage on a <canvas>. No dependencies. */
(function (root) {
  var SCALE = 2, PAD = 28, COLW = 210, GAP = 30, ROWH = 34, CELLH = 88;
  var ROUNDH = 28, SECTH = 34, HEADH = 92, FOOTH = 54, RESROW = 32;
  var C = { bg: "#14171c", panel: "#1d222a", panel2: "#262d37", text: "#e8ebef", muted: "#8b95a3",
            accent: "#f5a524", line: "#3d4756", winBg: "#2a4540", win: "#2e7d4f", lose: "#8a3b3b" };
  var FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

  var imgCache = {};
  function loadImage(url) {
    if (!imgCache[url]) {
      imgCache[url] = new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { resolve(null); };
        img.src = url;
      });
    }
    return imgCache[url];
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fit(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + "…").width > maxW) text = text.slice(0, -1);
    return text + "…";
  }

  function text(ctx, str, x, y, font, color, align) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || "left";
    ctx.textBaseline = "middle";
    ctx.fillText(str, x, y);
  }

  function logo(ctx, img, x, cy, size) {
    if (!img) return;
    var k = Math.min(size / img.width, size / img.height);
    var w = img.width * k, h = img.height * k;
    ctx.drawImage(img, x + (size - w) / 2, cy - h / 2, w, h);
  }

  /* One row of a match: state is "won" | "lost" | "idle" | "empty" */
  function drawRow(ctx, x, y, w, team, state) {
    ctx.fillStyle = state === "won" ? C.winBg : C.panel2;
    ctx.fillRect(x, y, w, ROWH);
    if (state === "won") { ctx.fillStyle = C.win; ctx.fillRect(x, y, 4, ROWH); }
    if (state === "lost") { ctx.fillStyle = C.lose; ctx.fillRect(x, y, 4, ROWH); }
    var cy = y + ROWH / 2;
    if (!team) { text(ctx, "TBD", x + 14, cy, "italic 13px " + FONT, C.muted); return; }
    var color = state === "lost" ? C.muted : C.text;
    var weight = state === "won" ? "600" : "400";
    var tx = x + 14;
    if (team.logo && root.__logos[team.logo]) { logo(ctx, root.__logos[team.logo], x + 12, cy, 22); tx = x + 42; }
    ctx.font = weight + " 14px " + FONT;
    text(ctx, fit(ctx, team.name, x + w - tx - 8), tx, cy, weight + " 14px " + FONT, color);
  }

  function drawMatch(ctx, x, cy, res) {
    var top = cy - ROWH;
    ctx.save();
    rr(ctx, x, top, COLW, ROWH * 2, 8);
    ctx.clip();
    var sa = "idle", sb = "idle";
    if (res.winner) { sa = res.winner.id === res.a.id ? "won" : "lost"; sb = sa === "won" ? "lost" : "won"; }
    drawRow(ctx, x, top, COLW, res.a, res.a ? sa : "empty");
    drawRow(ctx, x, top + ROWH, COLW, res.b, res.b ? sb : "empty");
    ctx.fillStyle = C.panel; ctx.fillRect(x, cy - 0.5, COLW, 1);
    ctx.restore();
  }

  function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function sectionSize(section) {
    var maxN = Math.max.apply(null, section.rounds.map(function (r) { return r.matches.length; }));
    var n = section.rounds.length;
    return { w: n * COLW + (n - 1) * GAP, h: (section.name ? SECTH : 0) + ROUNDH + maxN * CELLH + 16, maxN: maxN };
  }

  function drawSection(ctx, section, x0, y0, computed) {
    var size = sectionSize(section), y = y0;
    if (section.name) {
      text(ctx, (section.name + " bracket").toUpperCase(), x0, y + 14, "bold 14px " + FONT, C.accent);
      y += SECTH;
    }
    var totalH = size.maxN * CELLH;
    ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    section.rounds.forEach(function (round, ri) {
      var x = x0 + ri * (COLW + GAP);
      var prev = section.extra ? null : section.rounds[ri - 1];
      var next = section.extra ? null : section.rounds[ri + 1];
      var n = round.matches.length;
      var feedsNext = next && (next.matches.length === n || next.matches.length * 2 === n);
      var fedByPrev = prev && (prev.matches.length === n || prev.matches.length === n * 2);
      var halves = feedsNext && next.matches.length * 2 === n;
      if (section.extra) text(ctx, round.name, x, y + 12, "bold 14px " + FONT, C.accent, "left");
      else text(ctx, round.name, x + COLW / 2, y + 12, "13px " + FONT, C.muted, "center");
      round.matches.forEach(function (m, mi) {
        var slotH = totalH / n;
        var cy = y + ROUNDH + (mi + 0.5) * slotH;
        drawMatch(ctx, x, cy, computed[m.id]);
        if (feedsNext) line(ctx, x + COLW, cy, x + COLW + GAP / 2, cy);
        if (fedByPrev) line(ctx, x - GAP / 2, cy, x, cy);
        if (halves && mi % 2 === 0) line(ctx, x + COLW + GAP / 2, cy, x + COLW + GAP / 2, cy + slotH);
      });
    });
    return y + ROUNDH + totalH + 16 - y0;
  }

  function slug(s) { return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  /* stage: stage object, picks: {matchId: teamId}, meta: {tournament, author} -> Promise<canvas> */
  function draw(stage, picks, meta) {
    var p = Object.assign({}, picks);
    var computed = BracketEngine.compute(stage, p);
    var results = BracketEngine.results(stage, computed);
    var sections = BracketEngine.layout(stage);

    root.__logos = {};
    var urls = meta.noLogos ? [] : stage.teams.map(function (t) { return t.logo; }).filter(Boolean);
    return Promise.all(urls.map(function (u) {
      return loadImage(u).then(function (img) { root.__logos[u] = img; });
    })).then(function () {
      var sizes = sections.map(sectionSize);
      var contentW = Math.max(520, Math.max.apply(null, sizes.map(function (s) { return s.w; })));
      var bodyH = sizes.reduce(function (a, s) { return a + s.h; }, 0);
      var resH = 46 + results.length * RESROW;
      var W = contentW + PAD * 2, H = HEADH + bodyH + resH + FOOTH;

      var canvas = document.createElement("canvas");
      canvas.width = W * SCALE; canvas.height = H * SCALE;
      var ctx = canvas.getContext("2d");
      ctx.scale(SCALE, SCALE);
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

      // header
      text(ctx, fit(ctx, meta.tournament || "", W - PAD * 2), PAD, PAD + 14, "bold 26px " + FONT, C.text);
      var sub = stage.name + (meta.author ? "  ·  picks by " + meta.author : "");
      text(ctx, sub, PAD, PAD + 46, "600 17px " + FONT, C.accent);
      ctx.fillStyle = C.panel2; ctx.fillRect(PAD, HEADH - 8, W - PAD * 2, 1);

      // bracket
      var y = HEADH;
      sections.forEach(function (sec) { y += drawSection(ctx, sec, PAD, y, computed); });

      // results
      ctx.fillStyle = C.panel2; ctx.fillRect(PAD, y, W - PAD * 2, 1);
      text(ctx, "RESULT", PAD, y + 24, "bold 14px " + FONT, C.muted);
      results.forEach(function (r, i) {
        var cy = y + 46 + i * RESROW + RESROW / 2 - 4;
        text(ctx, r.label, PAD, cy, "14px " + FONT, C.muted);
        var tx = PAD + 270;
        if (r.team) {
          if (r.team.logo && root.__logos[r.team.logo]) { logo(ctx, root.__logos[r.team.logo], tx, cy, 22); tx += 30; }
          text(ctx, r.team.name, tx, cy, "600 15px " + FONT, C.text);
        } else text(ctx, "-", tx, cy, "14px " + FONT, C.muted);
      });

      // footer / watermark
      ctx.font = "bold 20px " + FONT; ctx.textAlign = "right";
      var gg = ctx.measureText(".gg").width;
      text(ctx, ".gg", W - PAD, H - 26, "bold 20px " + FONT, C.accent, "right");
      text(ctx, "CalledIt", W - PAD - gg, H - 26, "bold 20px " + FONT, C.text, "right");
      return canvas;
    });
  }

  /* Returns a Promise; rejects if the browser refuses to export the canvas
     (e.g. page opened from file:// with logo images). */
  function download(canvas, name) {
    return new Promise(function (resolve, reject) {
      try {
        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error("empty image")); return; }
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = name + ".png";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
          resolve();
        }, "image/png");
      } catch (e) { reject(e); }
    });
  }

  var api = { draw: draw, download: download, slug: slug, _internals: { sectionSize: sectionSize } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BracketCard = api;
})(this);
