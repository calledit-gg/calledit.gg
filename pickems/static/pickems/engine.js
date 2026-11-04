/* Pure bracket logic, no DOM. A format is a graph of matches; each slot is
   {seed:N} | {winner:ID} | {loser:ID}. */
(function (root) {
  function resolveSlot(stage, ref, computed) {
    if ("seed" in ref) {
      return stage.teams.find(function (t) { return t.seed === ref.seed; }) || null;
    }
    if ("winner" in ref) return computed[ref.winner].winner;
    return computed[ref.loser].loser;
  }

  /* picks: {matchId: teamId}. Removes picks that are no longer valid
     (e.g. an earlier result changed) and returns {matchId: {a,b,winner,loser}}. */
  function compute(stage, picks) {
    var computed = {};
    stage.format.matches.forEach(function (m) {
      var a = resolveSlot(stage, m.a, computed);
      var b = resolveSlot(stage, m.b, computed);
      var chosen = picks[m.id];
      var winner = null, loser = null;
      if (a && b && (chosen === a.id || chosen === b.id)) {
        winner = chosen === a.id ? a : b;
        loser = chosen === a.id ? b : a;
      } else {
        delete picks[m.id];
      }
      computed[m.id] = { a: a, b: b, winner: winner, loser: loser };
    });
    return computed;
  }

  function results(stage, computed) {
    return stage.format.results.map(function (r) {
      var kind = Object.keys(r.source)[0];
      var id = r.source[kind];
      return { label: r.label, team: computed[id][kind] };
    });
  }

  /* Groups matches into sections ("Upper: final" -> section "Upper", round "final")
     and rounds, in order of first appearance. */
  function layout(stage) {
    var sections = [], extras = [];
    stage.format.matches.forEach(function (m) {
      if (m.extra) { extras.push(m); return; }   // e.g. 3rd place match: shown below the bracket
      var secName = "", roundName = m.round, i = m.round.indexOf(": ");
      if (i >= 0) { secName = m.round.slice(0, i); roundName = m.round.slice(i + 2); }
      var sec = sections.find(function (s) { return s.name === secName; });
      if (!sec) { sec = { name: secName, rounds: [] }; sections.push(sec); }
      var rnd = sec.rounds.find(function (r) { return r.name === roundName; });
      if (!rnd) { rnd = { name: roundName, matches: [] }; sec.rounds.push(rnd); }
      rnd.matches.push(m);
    });
    extras.forEach(function (m) {
      sections.push({ name: "", extra: true, rounds: [{ name: m.round, matches: [m] }] });
    });
    return sections;
  }

  /* ---- share links: picks are stored in the URL hash, no server needed ----
     #n=<nickname>&s<stageId>=<winner team id (base36) per match, in format order, comma separated> */
  function encodeStage(stage, picks) {
    return stage.format.matches.map(function (m) {
      return picks[m.id] != null ? Number(picks[m.id]).toString(36) : "";
    }).join(",");
  }

  function decodeStage(stage, str) {
    var res = {}, parts = String(str).split(",");
    stage.format.matches.forEach(function (m, i) {
      var id = parts[i] ? parseInt(parts[i], 36) : NaN;
      if (!isNaN(id)) res[m.id] = id;
    });
    return res;
  }

  function parseHash(hash) {
    var out = { author: "", stages: {}, any: false };
    String(hash || "").replace(/^#/, "").split("&").forEach(function (part) {
      var i = part.indexOf("=");
      if (i < 0) return;
      var key = part.slice(0, i), val = part.slice(i + 1);
      if (key === "n") {
        try { out.author = decodeURIComponent(val).slice(0, 40); } catch (e) { out.author = ""; }
      } else if (/^s\d+$/.test(key)) {
        out.stages[key.slice(1)] = val;
        out.any = true;
      }
    });
    return out;
  }

  /* Returns the hash string (without '#'), or null when nothing is picked. */
  function buildHash(stages, state, author) {
    var parts = [], any = false;
    if (author) parts.push("n=" + encodeURIComponent(author.slice(0, 40)));
    stages.forEach(function (s) {
      if (!s.ready) return;
      compute(s, state[s.id]); // drops invalid picks
      if (Object.keys(state[s.id]).length) {
        parts.push("s" + s.id + "=" + encodeStage(s, state[s.id]));
        any = true;
      }
    });
    return any ? parts.join("&") : null;
  }

  var api = { compute: compute, results: results, layout: layout,
    encodeStage: encodeStage, decodeStage: decodeStage, parseHash: parseHash, buildHash: buildHash };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BracketEngine = api;
})(this);
