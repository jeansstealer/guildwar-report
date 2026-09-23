# War Report website

This directory is the only content deployed to GitHub Pages. It contains a
placeholder `report.json` so the site can go live before the first report.

`Code.gs` serves the latest sanitized `_report` cell through `doGet`. The
GitHub Actions workflow fetches that JSON every 30 minutes and on manual runs,
validates that it contains no `players` field, and deploys this directory.
The website itself reads only its local `report.json`; it never contacts the
Google spreadsheet from a visitor's browser.

## One-time setup

1. Add the current `Code.gs` and `Report.gs` to the spreadsheet's Apps Script
   project, then deploy a **new version** of the web app. Its access must be
   **Anyone**, because GitHub Actions fetches the public report without a
   Google login. The POST capture still requires `SHARED_SECRET`.
2. In the GitHub repository, save the existing web app URL as an Actions
   repository secret named `REPORT_FEED_URL`. Use the `/exec` URL; the GET
   endpoint returns only the public report JSON.
3. In **Settings → Pages**, select **GitHub Actions** as the build and
   deployment source. Run **Publish War Report** once from the Actions tab.

The report updates at minutes 17 and 47 of each hour. GitHub may delay
scheduled workflows; use **Run workflow** for an immediate refresh. A failed
fetch does not replace the last successfully deployed report.

Do not add local `capture.py`, `dumps/`, or `tests/fixtures/` to the site.
