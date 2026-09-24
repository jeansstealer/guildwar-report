"use strict";

// Renders report.json (a sanitized, public war report) into the page.
// All game text goes in through textContent, never innerHTML.

const root = document.getElementById("report");
const badge = document.getElementById("season-badge");
const updated = document.getElementById("updated");
const SVG_NS = "http://www.w3.org/2000/svg";

const isNum = v => v !== null && v !== "" && Number.isFinite(Number(v));
const count = v => isNum(v) ? Number(v).toLocaleString("en-US") : "—";
const pct = v => isNum(v) ? Math.round(Number(v) * 100) + "%" : "—";
const hours = v => isNum(v) ? Number(v).toFixed(1) + " h" : "—";
const short = v => {
  const n = Number(v);
  return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = String(text);
  return e;
}
function svg(tag, attrs, text) {
  const e = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, String(v)));
  if (text !== undefined) e.textContent = String(text);
  return e;
}
function section(title, aside) {
  const s = el("section");
  const head = el("div", "section-head");
  head.append(el("h2", "", title));
  if (aside) head.append(el("span", "aside", aside));
  s.append(head);
  return s;
}

// ---------- hero: result, scores, share of points, season form ----------
function hero(r) {
  const s = el("section", "hero");
  s.append(el("p", "meta", [r.date, "Battlefield level " + r.bfLevel].filter(Boolean).join("  ·  ")));
  s.append(el("h1", "result " + String(r.result || "").toLowerCase(), r.result));
  s.append(el("p", "margin", r.result === "DRAW" ? "Dead level" :
    (r.result === "VICTORY" ? "Won by " : "Lost by ") + count(r.margin) + " points"));

  const board = el("div", "board");
  const side = (g, cls) => {
    const d = el("div", "side " + cls);
    d.append(el("div", "name", g.name), el("strong", "score num", count(g.score)));
    return d;
  };
  board.append(side(r.us, "us"), el("span", "vs", "VS"), side(r.them, "them"));
  s.append(board);

  const total = Number(r.us.score) + Number(r.them.score);
  if (total > 0) {
    const share = el("div", "share");
    const a = el("span"), b = el("span");
    a.style.width = (r.us.score / total * 100) + "%";
    b.style.width = (r.them.score / total * 100) + "%";
    share.append(a, b);
    share.title = pct(r.us.score / total) + " of all points scored";
    s.append(share);
  }

  const strip = r.seasonStrip || {};
  const rec = strip.record || {};
  if ((strip.last5 || []).length) {
    const form = el("div", "record");
    form.append(el("span", "", "Season " + (r.season || "?")),
      el("strong", "", `${rec.w || 0}–${rec.l || 0}` + (rec.d ? `–${rec.d}` : "")));
    const pips = el("span", "pips");
    strip.last5.forEach(x => {
      const p = el("span", "pip " + String(x).toLowerCase(), x);
      p.title = x === "W" ? "Victory" : x === "L" ? "Defeat" : "Draw";
      pips.append(p);
    });
    form.append(pips);
    s.append(form);
  }
  return s;
}

// ---------- head to head: tug-of-war bars ----------
function headToHead(r) {
  const s = section("Head to head");
  const rows = el("div", "versus-rows");
  [
    ["Points per token", r.us.ppt, r.them.ppt, count, true],
    ["Lineups beaten", r.us.lineups, r.them.lineups, count, true],
    ["First-hit win rate", r.us.firstHitPct, r.them.firstHitPct, pct, true],
    ["First full wipe", r.us.wipeHours, r.them.wipeHours, hours, false],
  ].forEach(([label, a, b, fmt, higherBetter]) => {
    const row = el("div", "vrow");
    const has = isNum(a) && isNum(b);
    const usLead = has && (higherBetter ? a > b : a < b);
    const themLead = has && (higherBetter ? b > a : b < a);
    const bar = el("div", "vbar");
    bar.append(el("span", "label", label));
    const track = el("div", "track");
    const tu = el("span", "us" + (themLead ? " dim" : "")), tt = el("span", "them" + (usLead ? " dim" : ""));
    // For "first wipe" (lower is better) the faster side gets the longer bar.
    const ra = has ? (higherBetter ? a : 1 / a) : 1, rb = has ? (higherBetter ? b : 1 / b) : 1;
    const sum = (ra + rb) || 1;
    tu.style.flex = String(ra / sum); tt.style.flex = String(rb / sum);
    track.append(tu, tt);
    bar.append(track);
    row.append(el("span", "v us num" + (usLead ? " lead" : ""), fmt(a)), bar,
      el("span", "v them num" + (themLead ? " lead" : ""), fmt(b)));
    rows.append(row);
  });
  s.append(rows);
  return s;
}

// ---------- score over time: drawn at the container's real width ----------
function timeline(r) {
  const s = section("How the war unfolded", "Cumulative points");
  const box = el("div", "chart-box");
  s.append(box);
  const ser = r.series || {};
  const hrs = ser.hours || [], us = ser.us || [], them = ser.them || [];
  if (!hrs.length || hrs.length !== us.length || hrs.length !== them.length) {
    box.append(el("p", "chart-note", "No score timeline yet."));
    return s;
  }
  const draw = () => {
    box.replaceChildren();
    const W = Math.max(280, box.clientWidth || 800), H = W < 520 ? 230 : 300;
    const L = 4, R = 46, T = 30, B = 24;
    const maxH = Math.max(1, ...hrs);
    const maxS = Math.max(1, ...us, ...them);
    const top = Math.ceil(maxS / 200000) * 200000;
    const x = h => L + h / maxH * (W - L - R);
    const y = v => H - B - v / top * (H - T - B);
    const g = svg("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
      "aria-label": `Score over ${maxH} hours: ${r.us.name} ${count(r.us.score)}, ${r.them.name} ${count(r.them.score)}` });
    const defs = svg("defs");
    const grad = svg("linearGradient", { id: "usFade", x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.append(svg("stop", { offset: "0", "stop-color": "#6fa597", "stop-opacity": ".22" }),
      svg("stop", { offset: "1", "stop-color": "#6fa597", "stop-opacity": "0" }));
    defs.append(grad); g.append(defs);

    for (let i = 1; i <= 4; i++) {
      const v = top * i / 4;
      g.append(svg("line", { class: "grid", x1: L, x2: W - R, y1: y(v), y2: y(v) }));
      g.append(svg("text", { x: L, y: y(v) - 5 }, short(v)));
    }
    const step = maxH > 30 ? 12 : 6;
    for (let h = 0; h <= maxH; h += step) g.append(svg("text", { x: x(h), y: H - 6, "text-anchor": h ? "middle" : "start" }, h + "h"));

    const pts = arr => arr.map((v, i) => `${x(hrs[i]).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    g.append(svg("polygon", { class: "area us", points: `${x(hrs[0])},${y(0)} ${pts(us)} ${x(hrs[hrs.length - 1])},${y(0)}` }));
    g.append(svg("polyline", { class: "line them", points: pts(them) }));
    g.append(svg("polyline", { class: "line us", points: pts(us) }));

    // Wipe markers: when each guild cleared the whole battlefield.
    [["us", r.us], ["them", r.them]].forEach(([cls, side], i) => {
      if (!isNum(side.wipeHours) || side.wipeHours > maxH) return;
      const xx = x(Number(side.wipeHours));
      g.append(svg("line", { class: "wipe " + cls, x1: xx, x2: xx, y1: T - 6, y2: H - B }));
      g.append(svg("text", { class: "wipe-label " + cls, x: xx + 5, y: T - 10 + i * 13 }, "WIPE " + hours(side.wipeHours)));
    });
    // Final scores at the line ends (nudged apart if they'd overlap).
    let yu = y(us[us.length - 1]) + 4, yt = y(them[them.length - 1]) + 4;
    if (Math.abs(yu - yt) < 14) { if (yu <= yt) yt = yu + 14; else yu = yt + 14; }
    g.append(svg("text", { class: "end-label us", x: W - R + 6, y: yu }, short(us[us.length - 1])));
    g.append(svg("text", { class: "end-label them", x: W - R + 6, y: yt }, short(them[them.length - 1])));
    box.append(g);
  };
  requestAnimationFrame(draw);
  let t;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(draw, 120); });
  return s;
}

// ---------- honours: attack + defence, no repeats ----------
function honours(r) {
  if (!r.usKnown) return null;
  const s = section("Honours", r.us.name);
  const grid = el("div", "honours");
  const card = (kind, title, who, what, cls) => {
    if (!who) return;
    const c = el("article", "honour" + (cls ? " " + cls : ""));
    c.append(el("span", "kind", kind), el("h3", "", title), el("strong", "who", who), el("p", "what", what));
    grid.append(c);
  };
  const byTitle = t => (r.mvps || []).find(m => m.title === t);
  ["Top Attacker", "Sharpshooter", "Giant Slayer", "Clean-up Crew"].forEach(t => {
    const m = byTitle(t);
    if (m) card("Attack", t, m.player, m.value);
  });
  const d = r.defense || {};
  const wall = (d.top || [])[0];
  if (wall) card("Defence", "Iron Wall", wall.player,
    (wall.broken ? "enemy needed " + wall.perBreak + " attacks to beat each lineup" : "survived " + wall.absorbed + " attacks unbeaten"), "def");
  else if (byTitle("Iron Wall")) card("Defence", "Iron Wall", byTitle("Iron Wall").player, byTitle("Iron Wall").value, "def");
  const most = d.mostAbsorbed;
  if (most && (!wall || most.player !== wall.player))
    card("Defence", "Held the Line", most.player, "took " + count(most.absorbed) + " enemy attacks", "def");
  s.append(grid);
  return s;
}

// ---------- player breakdown: token chart + sortable table (our guild only) ----------
const TOKENS = 10;
const ratio = (a, b) => b ? a / b : null;
const PLAYER_SORTS = {
  score: { label: "Score", key: p => p.score },
  win: { label: "Win rate", key: p => ratio(p.wins, p.attacks) ?? -1 },
  first: { label: "First-hit", key: p => ratio(p.firstWins, p.firstHits) ?? -1 },
  defence: { label: "Defence", key: p => p.broken ? p.perBreak : -1 },
};
// Defence order: attacks to beat, highest first. An unbeaten defender counts as
// "at least" their attacks taken (3 attacks, none lost = 3+), so one lucky
// unbeaten attack can't outrank a lineup that held off many. Ties go to whoever
// took more attacks; players never attacked go last.
const toBeat = d => d.taken / Math.max(1, d.lost);
function defenceOrder(da, db) {
  return (!da.taken) - (!db.taken) || toBeat(db) - toBeat(da) || db.taken - da.taken;
}
const plural = (n, one, many) => count(n) + " " + (Number(n) === 1 ? one : many);
const LINEUPS = 5;
// A player's defence in one round (enemy wipe to enemy wipe), or the whole war (round 0).
function defenceIn(p, round) {
  if (!round) return { taken: p.absorbed || 0, lost: p.broken || 0 };
  const d = (p.defenceRounds || []).find(x => x.round === round);
  return { taken: d ? d.taken : 0, lost: d ? d.lost : 0 };
}

function players(r) {
  const list = Array.isArray(r.ourPlayers) ? r.ourPlayers : [];
  if (!r.usKnown || !list.length) return null;
  const s = section("Player breakdown", r.us.name + " · " + list.length + " players");

  // Sort buttons shared by the chart and the table.
  let sortKey = "score", tableSort = null, tableDir = -1, showAll = list.length <= 12;
  const PREVIEW_ROWS = 10;
  const controls = el("div", "sorts");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Sort players by");
  Object.entries(PLAYER_SORTS).forEach(([k, v]) => {
    const b = el("button", "sort", v.label);
    b.type = "button";
    b.dataset.k = k;
    b.addEventListener("click", () => { sortKey = k; tableSort = null; paint(); });
    controls.append(b);
  });

  const roundsMeta = Array.isArray(r.defenceRounds) ? r.defenceRounds : [];
  let round = roundsMeta.length > 1 ? 1 : 0;
  const roundBar = el("div", "sorts rounds");
  roundBar.setAttribute("role", "group");
  roundBar.setAttribute("aria-label", "Defence round");
  roundsMeta.concat(roundsMeta.length > 1 ? [{ round: 0 }] : []).forEach(m => {
    const b = el("button", "sort", m.round ? "Round " + m.round : "Whole war");
    b.type = "button";
    b.dataset.r = m.round;
    b.title = !m.round ? "All rounds added together" : m.complete
      ? "Until the enemy wiped the battlefield at " + hours(m.endsHours)
      : "After the enemy's last wipe" + (roundsMeta.length > 1 ? " (not finished)" : "");
    b.addEventListener("click", () => { round = m.round; paint(); });
    roundBar.append(b);
  });
  const roundNote = el("p", "round-note");

  const legend = el("div", "token-legend");
  const LEGENDS = {
    attack: [["win", "Win"], ["loss", "Loss"], ["abandon", "Abandoned"], ["unused", "Unused"]],
    defence: [["held", "Enemy attack held off"], ["beaten", "Enemy attack that beat a lineup"]],
  };
  const chart = el("ol", "tokens-chart");
  const more = el("button", "show-all");
  more.type = "button";
  more.addEventListener("click", () => { showAll = !showAll; paint(); });

  // Full table (every column the sheet's Players tab has, plus defence).
  const cols = [
    ["Player", p => p.name, "text"],
    ["Lvl", p => p.level || null, "num"],
    ["Attacks", p => p.attacks, "num"],
    ["Wins", p => p.wins, "num"],
    ["Win %", p => ratio(p.wins, p.attacks), "pct"],
    ["First-hit %", p => ratio(p.firstWins, p.firstHits), "pct"],
    ["Cleanup wins", p => p.cleanupWins, "num"],
    ["Score", p => p.score, "num"],
    ["Avg power", p => p.avgPower, "num"],
    ["Hardest win", p => p.hardestWin || null, "num"],
    ["Abandoned", p => p.abandoned, "num"],
    ["Attacks taken", p => p.absorbed, "num"],
    ["Lineups lost", p => p.broken, "num"],
    ["Attacks to beat", p => p.broken ? p.perBreak : null, "dec", p => !p.broken && p.absorbed ? "Unbeaten" : null],
  ];
  if ((r.defenceRounds || []).length > 1) (r.defenceRounds || []).forEach(m => {
    const d = p => defenceIn(p, m.round);
    cols.push(["R" + m.round + " taken", p => d(p).taken, "num"]);
    cols.push(["R" + m.round + " lost", p => d(p).lost, "num"]);
    cols.push(["R" + m.round + " to beat", p => d(p).lost ? d(p).taken / d(p).lost : null, "dec",
      p => d(p).taken && !d(p).lost ? "Unbeaten" : null]);
  });
  const fmt = (v, t) => v === null || v === undefined ? "—" : t === "pct" ? pct(v) : t === "dec" ? Number(v).toFixed(1) : t === "num" ? count(v) : v;
  const tableWrap = el("div", "table-wrap");
  const table = el("table", "ptable num");
  const thead = el("thead"), headRow = el("tr");
  cols.forEach(([label], i) => {
    const th = el("th");
    const b = el("button", "", label);
    b.type = "button";
    b.addEventListener("click", () => {
      tableDir = tableSort === i ? -tableDir : (i === 0 ? 1 : -1);
      tableSort = i; paint();
    });
    th.append(b);
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = el("tbody");
  table.append(thead, tbody);
  tableWrap.append(table);

  function paint() {
    controls.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === sortKey && tableSort === null)));
    const defenceMode = sortKey === "defence" && tableSort === null;
    const byChart = defenceMode ? list.slice().sort((a, b) => defenceOrder(defenceIn(a, round), defenceIn(b, round)))
      : list.slice().sort((a, b) => PLAYER_SORTS[sortKey].key(b) - PLAYER_SORTS[sortKey].key(a) || b.score - a.score);
    legend.replaceChildren();
    LEGENDS[defenceMode ? "defence" : "attack"].forEach(([c, t]) => {
      const i = el("span"); i.append(el("i", "tok " + c), document.createTextNode(t)); legend.append(i);
    });
    chart.classList.toggle("defence", defenceMode);
    roundBar.hidden = !defenceMode || roundsMeta.length < 2;
    roundBar.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.r) === round)));
    const meta = roundsMeta.find(m => m.round === round);
    roundNote.hidden = roundBar.hidden;
    roundNote.textContent = !round ? "All rounds added together. A lineup comes back at full strength after each enemy wipe, so it can be lost more than once."
      : meta && meta.complete ? `Round ${round}: from the start until the enemy wiped the battlefield at ${hours(meta.endsHours)}. Every lineup gets beaten once.`
      : `Round ${round}: after the enemy's wipe. Not finished, so some lineups were never beaten.`;

    chart.replaceChildren();
    const maxScore = Math.max(1, ...list.map(p => p.score));
    more.hidden = list.length <= 12;
    more.textContent = showAll ? "Show top " + PREVIEW_ROWS : "Show all " + list.length + " players";
    (showAll ? byChart : byChart.slice(0, PREVIEW_ROWS)).forEach((p, i) => {
      const li = el("li", "tok-row");
      const bar = el("div", "tok-bar");
      if (defenceMode) {
        // One square per enemy attack on this player's lineups.
        const d = defenceIn(p, round);
        const held = Math.max(0, d.taken - d.lost);
        for (let k = 0; k < held; k++) bar.append(el("i", "tok held"));
        for (let k = 0; k < d.lost; k++) bar.append(el("i", "tok beaten"));
        bar.title = `${d.taken} enemy attacks: ${held} held off, ${d.lost} beat a lineup`;
        const figure = !d.taken ? "—" : d.lost ? toBeat(d).toFixed(1) : d.taken + "+";
        const pctEl = el("span", "tok-pct" + (d.lost ? "" : " unbeaten"), figure);
        pctEl.title = d.lost ? "Enemy attacks needed to beat each lineup"
          : "Unbeaten: the enemy needed more than " + plural(d.taken, "attack", "attacks");
        const standing = round ? Math.max(0, LINEUPS - d.lost) : 0;
        const lostText = !d.lost ? "unbeaten" : round ? `${d.lost} of ${LINEUPS} lineups lost` : plural(d.lost, "lineup lost", "lineups lost");
        li.append(el("span", "tok-rank", i + 1), el("span", "tok-name", p.name), bar, pctEl,
          el("span", "tok-meta", !d.taken ? "not attacked" + (round ? " this round" : "") :
            `${plural(d.taken, "attack", "attacks")} taken · ${lostText}` + (standing && d.lost ? ` · ${standing} still standing` : "")));
        chart.append(li);
        return;
      }
      const losses = p.attacks - p.wins;
      const unused = Math.max(0, TOKENS - p.attacks - p.abandoned);
      for (let k = 0; k < p.wins; k++) bar.append(el("i", "tok win"));
      for (let k = 0; k < losses; k++) bar.append(el("i", "tok loss"));
      for (let k = 0; k < p.abandoned; k++) bar.append(el("i", "tok abandon"));
      for (let k = 0; k < unused; k++) bar.append(el("i", "tok unused"));
      bar.title = `${p.wins} wins, ${losses} losses, ${p.abandoned} abandoned, ${unused} unused`;
      const sc = el("div", "tok-score");
      const fill = el("span");
      fill.style.width = (p.score / maxScore * 100) + "%";
      sc.append(el("b", "", count(p.score)), fill);
      li.append(el("span", "tok-rank", i + 1), el("span", "tok-name", p.name), bar,
        el("span", "tok-pct", pct(ratio(p.wins, p.attacks))), sc);
      chart.append(li);
    });

    let rows = byChart;
    if (tableSort !== null) {
      const [, get, type] = cols[tableSort];
      rows = list.slice().sort((a, b) => {
        const va = get(a), vb = get(b);
        if (type === "text") return tableDir * String(va).localeCompare(String(vb));
        return tableDir * ((va ?? -Infinity) - (vb ?? -Infinity));
      });
    }
    headRow.querySelectorAll("th").forEach((th, i) =>
      th.setAttribute("aria-sort", tableSort === i ? (tableDir > 0 ? "ascending" : "descending") : "none"));
    tbody.replaceChildren();
    rows.forEach(p => {
      const tr = el("tr");
      cols.forEach(([, get, type, label]) =>
        tr.append(el(type === "text" ? "th" : "td", "", (label && label(p)) || fmt(get(p), type))));
      tr.firstChild.setAttribute("scope", "row");
      tbody.append(tr);
    });
  }
  paint();

  s.append(controls, roundBar, roundNote, legend, chart, more, el("h3", "table-title", "All stats"), tableWrap,
    el("p", "chart-note", "First-hit = attacks on a fresh lineup; cleanup wins = wins on a lineup someone already weakened. " +
      "Attacks to beat = attacks taken ÷ lineups lost: how many enemy attacks it took, on average, to beat one of their lineups (higher is tougher). Score excludes sector points."));
  return s;
}

// ---------- best teams: guild-wide team compositions + single lineups ----------
// A "team" is the same 5 units, in any order, across every player who ran it.
function bestTeams(r) {
  const comps = r.teamComps || {};
  const singles = r.defenceTeams || {};
  const guilds = [["ours", r.us.name], ["theirs", r.them.name + " (enemy)"]];
  const MODES = [
    ["defence", "Defence teams", g => (comps[g] || {}).defence || []],
    ["attack", "Attack teams", g => (comps[g] || {}).attack || []],
    ["single", "Single lineups", g => singles[g] || []],
  ].filter(([, , get]) => guilds.some(([g]) => get(g).length));
  if (!MODES.length) return null;

  const s = section("Best teams", "Top 10");
  let mode = MODES[0][0], guild = "ours";
  const modeBar = el("div", "sorts");
  MODES.forEach(([k, label]) => {
    const b = el("button", "sort", label);
    b.type = "button"; b.dataset.k = k;
    b.addEventListener("click", () => { mode = k; paint(); });
    modeBar.append(b);
  });
  const guildBar = el("div", "sorts rounds");
  guilds.forEach(([k, label]) => {
    const b = el("button", "sort", label);
    b.type = "button"; b.dataset.k = k;
    b.addEventListener("click", () => { guild = k; paint(); });
    guildBar.append(b);
  });
  const note = el("p", "round-note");
  const list = el("ol", "teams-list");

  const chips = (units, mows) => {
    const box = el("div", "team-units");
    (units || []).forEach(u => box.append(el("span", "unit", u)));
    (mows || []).filter(Boolean).forEach(m => box.append(el("span", "unit mow", m)));
    return box;
  };
  const figure = (value, label, tip) => {
    const f = el("div", "team-figure");
    f.append(el("strong", "num", value), el("span", "", label));
    if (tip) f.title = tip;
    return f;
  };
  const story = t => {
    const st = t.stands || [];
    const times = st.length === 2 ? "twice" : st.length + " times";
    const parts = [];
    if (st.length) parts.push(st.length === 1 ? `Beaten after ${plural(st[0], "attack", "attacks")}`
      : `Beaten ${times}: ${st.slice(0, -1).join(", ")} and ${st[st.length - 1]} attacks`);
    if (t.standing) parts.push(st.length ? `still standing after ${t.standingAttacks} more`
      : `never beaten (${plural(t.standingAttacks, "attack", "attacks")})`);
    return parts.join(" · ");
  };

  const NOTES = {
    defence: "Every lineup that used these 5 units, added up. Attacks to beat = enemy attacks taken ÷ lineups lost. Held off = share of enemy attacks that failed. Teams used by 2+ lineups.",
    attack: "Every attack made with these 5 units, added up. Ranked by win rate, then by how often it was used. Teams used 3+ times.",
    single: "One player's lineup. Ranked by the most enemy attacks it needed before it fell, then its average across every time it was beaten.",
  };

  function row(t, i) {
    const li = el("li", "team-row" + (guild === "theirs" ? " enemy" : ""));
    const body = el("div", "team-lineup");
    if (mode === "defence") {
      const held = t.taken ? (t.taken - t.lost) / t.taken : 0;
      body.append(chips(t.units, t.mows),
        el("p", "team-where", `${plural(t.lineups, "defence", "defences")} by ${plural(t.players, "player", "players")}`),
        el("p", "team-story", `${plural(t.taken, "attack", "attacks")} taken · ${plural(t.lost, "lineup lost", "lineups lost")} · ${pct(held)} held off`));
      li.append(el("span", "team-rank", i + 1), body,
        figure(t.lost ? (t.taken / t.lost).toFixed(1) : t.taken + "+", "attacks to beat", "Enemy attacks needed per lineup lost"));
    } else if (mode === "attack") {
      body.append(chips(t.units, t.mows),
        el("p", "team-where", `${plural(t.uses, "attack", "attacks")} by ${plural(t.players, "player", "players")} · ${plural(t.wins, "win", "wins")}`),
        el("p", "team-story", `${t.firstHits ? pct(t.firstWins / t.firstHits) : "—"} on fresh lineups · ${count(t.avgScore)} average score`));
      li.append(el("span", "team-rank", i + 1), body, figure(pct(t.wins / t.uses), "win rate"));
    } else {
      body.append(chips(t.units, [t.mow]),
        el("p", "team-where", [t.owner, t.zone, count(t.power) + " power"].filter(Boolean).join(" · ")),
        el("p", "team-story", story(t)));
      li.append(el("span", "team-rank", i + 1), body,
        figure(t.bestStand + (t.standing && !(t.stands || []).length ? "+" : ""), "attacks", "Enemy attacks needed to beat this lineup"));
    }
    return li;
  }

  function paint() {
    modeBar.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === mode)));
    guildBar.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === guild)));
    const get = MODES.find(m => m[0] === mode)[2];
    note.textContent = NOTES[mode] + (mode === "single" && guild === "theirs" ? " Enemy lineups are shown without owners." : "");
    list.replaceChildren();
    const items = get(guild).slice(0, 10);
    if (!items.length) list.append(el("li", "chart-note", "Not enough repeated teams yet."));
    items.forEach((t, i) => list.append(row(t, i)));
  }
  paint();
  s.append(modeBar, guildBar, note, list);
  return s;
}

// ---------- war history ----------
function history(r) {
  const rows = Array.isArray(r.history) ? r.history : [];
  if (!rows.length) return null;
  const s = section("War history", "Season " + (r.season || "?"));
  const list = el("div", "history");
  rows.slice().reverse().forEach(w => {
    const row = el("div", "hrow" + (w.current ? " current" : ""));
    const pip = el("span", "pip " + String(w.result).toLowerCase(), w.result);
    const opp = el("div", "opp");
    opp.append(document.createTextNode(w.opponent || "—"));
    if (w.current) opp.append(el("small", "", "This report"));
    const sc = el("div", "scores num");
    sc.append(el("span", "ours", count(w.ourScore)), document.createTextNode(" – "), el("span", "theirs", count(w.theirScore)));
    row.append(pip, el("span", "date", w.date), opp, sc, el("span", "ppt num", count(w.ppt) + " / token"));
    list.append(row);
  });
  s.append(list);
  if (rows.some(w => w.sample)) s.append(el("p", "sample-note", "Preview: rows marked Sample Guild are example data."));
  return s;
}

// ---------- everything else, folded away ----------
function more(r) {
  const d = el("details", "more");
  d.append(el("summary", "", "Full breakdown"));
  const grid = el("div", "more-grid");
  const block = (title, ...kids) => { const b = el("div"); b.append(el("h3", "", title), ...kids); grid.append(b); };
  const list = items => {
    const ul = el("ul", "list");
    items.forEach(([a, b]) => { const li = el("li"); li.append(el("span", "", a), el("span", "dim num", b)); ul.append(li); });
    return ul;
  };

  const def = (r.defense && r.defense.top) || [];
  if (def.length) block("Top defenders", list(def.map((x, i) =>
    [(i + 1) + ".  " + x.player, (x.broken ? x.perBreak : x.absorbed + "+") + " attacks to beat · " + x.absorbed + " taken"])));

  block("Overall", list([
    ["Tokens used", count(r.us.tokens) + " vs " + count(r.them.tokens)],
    ["Attack win rate", pct(r.us.winPct) + " vs " + pct(r.them.winPct)],
    ["Tokens to first wipe", count(r.us.wipeTokens) + " vs " + count(r.them.wipeTokens)],
  ]));

  const secs = r.sectors || [];
  if (secs.length) {
    const wrap = el("div");
    const max = Math.max(1, ...secs.map(x => Math.max(x.us, x.them)));
    secs.forEach(x => {
      const row = el("div", "sector");
      const bars = el("div", "bars");
      const a = el("span", "us"), b = el("span", "them");
      a.style.width = (x.us / max * 100) + "%"; b.style.width = (x.them / max * 100) + "%";
      a.title = r.us.name + ": " + x.us; b.title = r.them.name + ": " + x.them;
      bars.append(a, b);
      row.append(el("span", "", x.label + "  " + x.us + "–" + x.them), bars);
      wrap.append(row);
    });
    block("Sectors destroyed", wrap);
  }

  const teams = r.enemyTeams || [];
  if (teams.length) block("Enemy's favourite teams", list(teams.map(t =>
    [(t.units || []).join(", ") + (t.mow ? " + " + t.mow : ""), t.uses + " uses · " + pct(t.winPct)])));

  const full = r.fullTokens || [];
  if (r.usKnown && full.length) block(`All 10 tokens used (${full.length})`, el("p", "names", full.join(" · ")));

  d.append(grid);
  return d;
}

// Reports from older sheet code start the clock at the first zone claim, about
// a day before any fighting. Trim those empty hours from the chart. Their wipe
// times were measured from the claims too and can only be corrected to the
// hour, so they are hidden rather than shown slightly wrong.
function fromFirstBattle(r) {
  const ser = r.series || {};
  const us = ser.us || [], them = ser.them || [], hrs = ser.hours || [];
  let k = 0;
  while (k + 1 < hrs.length && !us[k + 1] && !them[k + 1]) k++;
  if (k < 2) return r;  // already starts at the first battle
  const shift = Number(hrs[k]);
  const side = s => Object.assign({}, s, { wipeHours: null });
  return Object.assign({}, r, {
    us: side(r.us), them: side(r.them),
    series: { hours: hrs.slice(k).map(h => h - shift), us: us.slice(k), them: them.slice(k) },
  });
}

function render(r) {
  if (!r || !r.us || !r.them) throw new Error("Invalid report");
  r = fromFirstBattle(r);
  badge.textContent = "Season " + (r.season || "?");
  if (r.generatedAt) updated.textContent = "Updated " + new Date(r.generatedAt).toLocaleString();
  root.replaceChildren(...[hero(r), headToHead(r), timeline(r), honours(r), players(r), bestTeams(r), history(r), more(r)].filter(Boolean));
}

function empty(msg) { root.replaceChildren(el("p", "loading", msg)); }

fetch("./report.json", { cache: "no-store" })
  .then(res => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
  .then(p => {
    if (p.status === "no_report") empty("No war report yet. It appears after the first captured war.");
    else if (p.status === "ok") render(p.report);
    else throw new Error("bad feed");
  })
  .catch(() => empty("The report is temporarily unavailable. Try again after the next update."));
