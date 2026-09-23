"use strict";

const root = document.getElementById("report");
const badge = document.getElementById("season-badge");
const updated = document.getElementById("updated");
const NS = "http://www.w3.org/2000/svg";
const count = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-US") : "—";
const percent = value => Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : "—";
const decimal = value => Number.isFinite(Number(value))
  ? Number(value).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : "—";
const text = value => value === null || value === undefined || value === "" ? "—" : String(value);

function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = text(content);
  return element;
}

function svg(tag, attrs) {
  const element = document.createElementNS(NS, tag);
  Object.entries(attrs || {}).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function panel(title) {
  const section = node("section", "panel section");
  section.append(node("h2", "section-title", title));
  return section;
}

function empty(message, detail) {
  root.replaceChildren();
  const section = node("section", "panel empty-state");
  section.append(node("p", "eyebrow", "Awaiting signal"), node("h2", "", message),
    node("p", "", detail));
  root.append(section);
}

function hero(report) {
  const section = node("section", "panel hero");
  const top = node("div", "hero-top");
  top.append(node("p", "eyebrow", "War dossier"),
    node("p", "meta", `${text(report.date)}  ·  Battlefield level ${text(report.bfLevel)}`));
  const board = node("div", "scoreboard");
  function guild(side, className) {
    const block = node("div", `guild ${className}`);
    block.append(node("div", "name", side.name), node("strong", "score", count(side.score)));
    return block;
  }
  board.append(guild(report.us, "us"), node("span", "versus", "VS"), guild(report.them, "them"));
  const result = node("div", `result-strip ${String(report.result || "").toLowerCase()}`);
  result.append(node("strong", "", report.result),
    node("span", "", `${count(report.margin)} point margin`));
  section.append(top, board, result);
  if (!report.usKnown) section.append(node("p", "note", "Our guild could not be identified. Open the guild war status screen before the next capture to enable player honours."));
  return section;
}

function season(report) {
  const section = node("section", "panel strip");
  const record = report.seasonStrip && report.seasonStrip.record || {};
  section.append(node("span", "label", "Season record"),
    node("strong", "record", `${count(record.w || 0)} W  ·  ${count(record.l || 0)} L  ·  ${count(record.d || 0)} D`));
  const pips = node("div", "pips");
  (report.seasonStrip && report.seasonStrip.last5 || []).forEach(result => {
    const pip = node("span", `pip ${String(result).toLowerCase()}`, result);
    pip.title = result === "W" ? "Victory" : result === "L" ? "Defeat" : "Draw";
    pips.append(pip);
  });
  section.append(pips);
  return section;
}

function stats(report) {
  const section = panel("War pulse");
  section.append(node("p", "section-intro", "Four numbers that tell the story of this matchup."));
  const grid = node("div", "stats");
  const rows = [
    ["Points per token", report.us.ppt, report.them.ppt, count],
    ["Lineups broken", report.us.lineups, report.them.lineups, count],
    ["First-hit win rate", report.us.firstHitPct, report.them.firstHitPct, percent],
    ["First wipe · hours", report.us.wipeHours, report.them.wipeHours, value => value == null ? "—" : text(value)],
  ];
  rows.forEach(([label, us, them, format]) => {
    const card = node("div", "stat");
    const values = node("div", "stat-values");
    values.append(node("strong", "", format(us)), node("span", "muted", "vs"), node("strong", "", format(them)));
    card.append(node("p", "label", label), values, node("p", "stat-legend", "Our guild · Opponent"));
    grid.append(card);
  });
  section.append(grid);
  return section;
}

function chart(report) {
  const section = panel("How the war unfolded");
  section.append(node("p", "section-intro", "Cumulative points from the opening hour to the final attack."));
  const series = report.series || {};
  const hours = Array.isArray(series.hours) ? series.hours : [];
  const ours = Array.isArray(series.us) ? series.us : [];
  const theirs = Array.isArray(series.them) ? series.them : [];
  if (!hours.length || hours.length !== ours.length || hours.length !== theirs.length) {
    section.append(node("p", "muted", "No score timeline is available yet."));
    return section;
  }

  const width = 780, height = 280, left = 65, right = 18, top = 14, bottom = 34;
  const maxHour = Math.max(1, ...hours.map(Number));
  const maxScore = Math.max(1, ...ours.map(Number), ...theirs.map(Number));
  const ceiling = Math.ceil(maxScore / 100000) * 100000 || 1;
  const x = hour => left + Number(hour) / maxHour * (width - left - right);
  const y = score => height - bottom - Number(score) / ceiling * (height - top - bottom);
  const graphic = svg("svg", { class: "chart", viewBox: `0 0 ${width} ${height}`, role: "img",
    "aria-label": `Cumulative score over ${maxHour} hours: ${text(report.us.name)} ${count(report.us.score)}, ${text(report.them.name)} ${count(report.them.score)}` });
  for (let i = 0; i <= 4; i++) {
    const score = ceiling * i / 4;
    const yy = y(score);
    graphic.append(svg("line", { class: "grid", x1: left, y1: yy, x2: width - right, y2: yy }));
    const label = svg("text", { x: left - 10, y: yy + 4, "text-anchor": "end" });
    label.textContent = score >= 1000 ? `${Math.round(score / 1000)}k` : String(Math.round(score));
    graphic.append(label);
  }
  [0, .25, .5, .75, 1].forEach(fraction => {
    const label = svg("text", { x: x(maxHour * fraction), y: height - 8, "text-anchor": "middle" });
    label.textContent = `${Math.round(maxHour * fraction)}h`;
    graphic.append(label);
  });
  const points = values => values.map((value, i) => `${x(hours[i])},${y(value)}`).join(" ");
  graphic.append(svg("polyline", { class: "them-line", points: points(theirs) }),
    svg("polyline", { class: "us-line", points: points(ours) }));
  const wrap = node("div", "chart-wrap");
  wrap.append(graphic);
  const legend = node("div", "legend");
  legend.append(node("span", "", report.us.name), node("span", "them-key", report.them.name));
  section.append(wrap, legend);
  return section;
}

function honours(report) {
  if (!report.usKnown) return null;
  const section = panel("Attack honours");
  const cards = node("div", "cards");
  (report.mvps || []).filter(mvp => mvp.title !== "Iron Wall" || !report.defense).forEach(mvp => {
    const card = node("article", "card");
    card.append(node("h3", "", mvp.title), node("span", "winner", mvp.player),
      node("p", "detail", mvp.value));
    cards.append(card);
  });
  section.append(cards);
  const fullTokens = Array.isArray(report.fullTokens) ? report.fullTokens : [];
  const full = node("details", "full-tokens");
  const summary = node("summary");
  summary.append(node("span", "", "Full-token players"), node("strong", "", count(fullTokens.length)),
    node("span", "muted", "Show names"));
  full.append(summary, node("p", "", fullTokens.length ? fullTokens.join(" · ") : "None yet"));
  section.append(full);
  return section;
}

function defense(report) {
  const data = report.defense;
  if (!data || !Array.isArray(data.top) || !data.top.length) return null;
  const section = panel("Defence standouts");
  section.classList.add("defense-section");
  section.append(node("p", "section-intro", `${count(data.totalAbsorbed)} enemy attacks faced across ${count(data.defendersCount)} defenders. Higher attacks per break means a tougher defence.`));

  const spotlights = node("div", "defense-spotlights");
  function spotlight(label, defender, number, unit, detail) {
    if (!defender) return;
    const card = node("article", "defense-spotlight");
    card.append(node("p", "eyebrow", label), node("h3", "", defender.player));
    const figure = node("div", "defense-figure");
    figure.append(node("strong", "", number), node("span", "", unit));
    card.append(figure, node("p", "spotlight-detail", detail));
    spotlights.append(card);
  }
  const hardest = data.top[0];
  spotlight("Hardest to break", hardest,
    hardest.broken ? decimal(hardest.perBreak) : `${count(hardest.absorbed)}+`,
    "attacks per break", `${count(hardest.absorbed)} attacks absorbed · Best stand ${count(hardest.bestStand)} attacks`);
  const most = data.mostAbsorbed;
  spotlight("Most pressure absorbed", most, count(most.absorbed), "enemy attacks",
    `${count(most.broken)} lineups broken · ${decimal(most.perBreak)} attacks per break`);
  section.append(spotlights);

  section.append(node("h3", "subheading", "Top defenders"));
  const list = node("ol", "defense-list");
  const ceiling = Math.max(1, ...data.top.map(d => Number(d.perBreak) || 0));
  data.top.forEach((defender, index) => {
    const item = node("li", "defender-row");
    item.append(node("span", "defender-rank", String(index + 1)),
      node("strong", "defender-name", defender.player));
    const meter = node("div", "defender-meter");
    const fill = node("span", "defender-meter-fill");
    fill.style.width = `${Math.max(0, Math.min(100, Number(defender.perBreak) / ceiling * 100))}%`;
    meter.append(fill);
    item.append(meter,
      node("strong", "defender-rate", defender.broken ? decimal(defender.perBreak) : `${count(defender.absorbed)}+`),
      node("span", "defender-meta", `${count(defender.absorbed)} faced · ${count(defender.broken)} broken`));
    list.append(item);
  });
  section.append(list, node("p", "fine-print", "Attacks per break = enemy attacks faced ÷ lineups broken. A + means the defender had not yet been broken."));
  return section;
}

function table(headers, rows) {
  const wrap = node("div", "table-scroll");
  const element = node("table");
  const head = node("thead");
  const headerRow = node("tr");
  headers.forEach(label => headerRow.append(node("th", "", label)));
  head.append(headerRow);
  const body = node("tbody");
  rows.forEach(values => {
    const row = node("tr");
    values.forEach(value => row.append(node("td", "", value)));
    body.append(row);
  });
  element.append(head, body);
  wrap.append(element);
  return wrap;
}

function details(report) {
  const disclosure = node("details", "panel deep-dive");
  const summary = node("summary", "deep-dive-summary");
  summary.append(node("span", "", "Detailed breakdown"),
    node("small", "", "Extra stats, sectors and enemy teams"));
  disclosure.append(summary);
  const content = node("div", "deep-dive-content");
  const extras = node("div", "extra-stats");
  [["Tokens used", report.us.tokens, report.them.tokens, count],
    ["Overall attack win rate", report.us.winPct, report.them.winPct, percent],
    ["First wipe · tokens", report.us.wipeTokens, report.them.wipeTokens,
      value => value == null ? "—" : count(value)]].forEach(([label, us, them, format]) => {
    const item = node("div", "extra-stat");
    item.append(node("span", "", label), node("strong", "", `${format(us)} vs ${format(them)}`));
    extras.append(item);
  });
  content.append(extras);
  const lower = node("div", "lower");
  const sectors = panel("Sectors destroyed");
  const sectorRows = (report.sectors || []).map(item => [item.label, count(item.us), count(item.them)]);
  sectors.append(sectorRows.length ? table(["Sector", "Our guild", "Enemy"], sectorRows)
    : node("p", "muted", "No sectors destroyed yet."));

  const enemy = panel("Enemy attack summary");
  const teams = (report.enemyTeams || []).map(team => [
    (team.units || []).join(", ") + (team.mow ? ` · ${team.mow}` : ""), count(team.uses), percent(team.winPct)
  ]);
  enemy.append(node("p", "muted", `${count(report.them.tokens)} tokens used · ${count(report.them.lineups)} lineups broken`));
  enemy.append(teams.length ? table(["Most-used team", "Uses", "Win %"], teams)
    : node("p", "muted", "No repeated enemy teams yet."));
  lower.append(sectors, enemy);
  content.append(lower);
  disclosure.append(content);
  return disclosure;
}

function render(report) {
  if (!report || !report.us || !report.them) throw new Error("Invalid report");
  badge.textContent = `Season ${report.season || "?"}`;
  if (report.generatedAt) updated.textContent = `Report generated ${new Date(report.generatedAt).toLocaleString()}`;
  root.replaceChildren(hero(report), season(report), stats(report), chart(report));
  const defenders = defense(report);
  if (defenders) root.append(defenders);
  const cards = honours(report);
  if (cards) root.append(cards);
  root.append(details(report));
}

fetch("./report.json", { cache: "no-store" })
  .then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then(payload => {
    if (payload.status === "no_report") empty("No war report yet", "Capture a war in Tacticus to publish the first report.");
    else if (payload.status === "ok") render(payload.report);
    else throw new Error("Report feed unavailable");
  })
  .catch(() => empty("Report temporarily unavailable", "Please try again after the next report update."));
