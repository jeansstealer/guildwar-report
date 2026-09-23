# Guild War Report

Public, read-only website for the latest Tacticus guild war report.

GitHub Pages publishes only the `site/` directory. A scheduled GitHub Actions
workflow fetches the latest sanitized report from a Google Apps Script feed.
No capture script, spreadsheet access credential, or raw war payload is stored
in this repository.

The public report includes guild names and our guild's MVP and Full Tokens
player names. Enemy player names and detailed per-player statistics are omitted.

See [site/README.md](site/README.md) for the update flow and setup.
