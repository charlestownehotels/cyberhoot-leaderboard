# CyberHoot Leaderboard

A public web leaderboard that ranks **every employee across all hotel properties by their
CyberHoot HootScore**. It shows only **name · property · HootScore · level** — no emails or
other personal details. A build step pulls each hotel's data from the CyberHoot API and
writes one aggregated JSON file; a dependency-free static page renders it.

- **No dependencies, no build tooling.** Requires only Node.js ≥ 18.
- **No login.** It's a public page. Because only names + property + score are published (no
  emails/contact info), and the page is marked `noindex`, this is a reasonable trade-off —
  but note that employee names and their training scores *are* visible to anyone with the
  URL. If you later want it gated, Netlify offers site password protection on paid plans, or
  I can add a lightweight passcode.
- **Keys never ship to the browser.** The 34 per-hotel API keys are read only at build time
  (from an environment variable in production). The browser only loads the aggregated,
  PII-free `leaderboard.json`.

## How it works

```
CyberHoot APIs.xlsx ─setup─▶ config/hotels.json ─┐
                                                 ├─(fetch)─▶ public/data/leaderboard.json ─▶ static page
              Netlify env var CYBERHOOT_HOTELS ──┘
```

- **Base URL:** `https://cmitsolutions.cyberhoot.com/api` (CMIT Solutions MSP portal; each
  hotel is a *customer* whose API key auto-scopes to it).
- **Auth:** `Authorization: Bearer <apiKey>`.
- **Ranking:** `GET /hoot-ranks/user/user-rankings.php`, re-sorted by `hoot_score`.
- **Property label:** each employee is labeled by the CyberHoot environment their key belongs
  to. **Corporate** is its own environment (customer id 1101, "Charlestowne Hotels") whose key
  isn't in the spreadsheet — it's added via `config/extra-hotels.json` (see below).
- **Dedupe:** the same person (by email) enrolled in multiple environments is collapsed to one
  entry — preferring the Corporate environment, otherwise keeping their highest HootScore.
  (Email is used only for this and is never written to the published file.)

## Local development

```bash
npm run setup   # "CyberHoot APIs.xlsx" -> config/hotels.json  (one time; re-run if keys change)
npm run fetch   # pull live data -> public/data/leaderboard.json
npm run serve   # http://localhost:4173
```

Or `npm start` to fetch once and then serve.

## Deploy to Netlify (automated — GitHub-connected)

The site auto-refreshes in the cloud: Netlify builds from a private GitHub repo, running
`node scripts/fetch-leaderboard.mjs` (which re-pulls from CyberHoot) on each build, and a
scheduled function triggers a rebuild every few hours. **No secrets in the repo** — the keys
and exclusions are Netlify environment variables.

### One-time setup

1. **Push to a private GitHub repo** (`.gitignore` already excludes all keys/PII):
   ```bash
   git remote add origin git@github.com:charlestownehotels/cyberhoot-leaderboard.git
   git push -u origin main
   ```
2. **Netlify → Add new site → Import an existing project → GitHub →** pick the repo.
   Build settings come from `netlify.toml` (build `node scripts/fetch-leaderboard.mjs`,
   publish `public`).
3. **Set environment variables** (Site configuration → Environment variables):
   - `CYBERHOOT_HOTELS` = the JSON array of hotel keys (contents of `config/hotels.json`).
     Easiest: `npx netlify-cli env:set CYBERHOOT_HOTELS "$(cat config/hotels.json)"`
   - `CYBERHOOT_EXCLUDE` = comma-separated emails to omit (e.g. `mspangler@charlestownehotels.com`).
4. **Deploy** (Netlify builds automatically on the import / next push).
5. **Auto-refresh:** Site configuration → Build & deploy → **Build hooks → Add build hook**,
   copy the URL, and add env var `BUILD_HOOK_URL` = that URL. The scheduled function
   `netlify/functions/refresh.mjs` (cron `0 */4 * * *`) then triggers a rebuild every 4 hours.
   Change the cadence by editing `config.schedule` in that file.

### Updating

Push to `main` (for code/design changes) — Netlify rebuilds. Data refreshes on its own via
the scheduled rebuild; no manual step. If you rotate an API key, update the `CYBERHOOT_HOTELS`
env var and trigger a redeploy.

### Alternative: manual drag-and-drop

Prefer no Git? Run `npm run pack` (refreshes data + builds `leaderboard-site.zip`) and drag
the `public/` folder or the zip onto Netlify's manual-deploy drop zone. Keys stay entirely on
your machine, but there's no automatic refresh — re-drop to update.

## Project layout

```
scripts/build-hotels-config.mjs   # xlsx -> config/hotels.json (dependency-free zip/xml reader)
scripts/cyberhoot.mjs             # API client: Bearer auth, retry/backoff, concurrency pool
scripts/fetch-leaderboard.mjs     # pull all hotels, classify/dedupe, write leaderboard.json
server.mjs                        # minimal static server for local dev
netlify.toml                      # build command, publish dir, noindex headers
netlify/functions/refresh.mjs     # scheduled rebuild trigger
public/index.html, styles.css, app.js   # the leaderboard UI
public/ch-logo.png                # Charlestowne logo (white via CSS on the dark header)
public/_headers                   # Netlify headers (noindex) for drag-and-drop deploys
config/extra-hotels.json          # hand-maintained secret: Corporate env (gitignored)
config/hotels.json                # GENERATED secret: spreadsheet + extras (gitignored)
public/data/leaderboard.json      # GENERATED locally by `npm run fetch`; names+scores, no emails
```

## Notes

- **Failed hotels are surfaced, not hidden.** A rejected key / erroring hotel is listed in the
  page footer, and `fetch` exits non-zero so a scheduler can alert — while still publishing the
  data it did get.
- **Only ranked users appear.** Users with no valid HootScore (`-1` / `n/a`) are excluded.
- **Excluding people (e.g. program admins).** Add their email to `config/exclude.json`
  (`emails` array), or set the `CYBERHOOT_EXCLUDE` env var to a comma-separated list. Matching
  is case-insensitive; excluded people are dropped before ranking.
- To show different columns or rank by another metric, edit `public/app.js` (columns) and the
  sort in `scripts/fetch-leaderboard.mjs`. Any column is also click-sortable in the UI.
