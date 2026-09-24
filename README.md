# Guild War Report

Public, read-only website for the latest Tacticus guild war report.

GitHub Pages publishes only the `site/` directory. A scheduled GitHub Actions
workflow fetches the latest sanitized report from a Google Apps Script feed.
No capture script, spreadsheet access credential, or raw war payload is stored
in this repository.

The public report includes guild names and **our own guild's** players: their
names, per-player attack and defence stats, honours and lineups. The enemy guild
appears only as totals and team compositions (units, never owners); enemy player
names are never published. The feed is rejected at deploy time if it contains the
spreadsheet's private per-player field.

Page sections: result and scoreboard, head to head, score over time (from the
first battle, with wipe markers), honours, player breakdown (attack and defence
by round), best teams (defence teams, attack teams, single lineups), war history,
and a folded full breakdown.

See [site/README.md](site/README.md) for the update flow and setup.
