# CyberHoot Leaderboard

**Live:** https://cyberhoot-leaderboard.netlify.app — auto-refreshes from CyberHoot every 4 hours.

A public web leaderboard that ranks **every employee across all hotel properties by their
CyberHoot HootScore**. It shows only **name · property · HootScore · level** — no emails or
other personal details. A build step pulls each hotel's data from the CyberHoot API and
writes one aggregated JSON file; a dependency-free static page renders it.

- **No dependencies, no build tooling.** Requires only Node.js ≥ 18.
- **Mobile-friendly.** On phones the ranking table reflows into stacked cards (rank · name ·
  property on top, score · level below) with no sideways scrolling; the header, podium, and
  scoring explainer adapt to small screens.
- **No login.** It's a public page. Because only names + property + score are published (no
  emails/contact info), and the page is marked `noindex`, this is a reasonable trade-off —
  but note that employee names and their training scores *are* visible to anyone with the
  URL. If you later want it gated, Netlify offers site password protection on paid plans, or
  I can add a lightweight passcode.
- **Keys never ship to the browser.** The 35 per-environment API keys (34 hotels + Corporate)
  are read only at build time (from an environment variable in production). The browser loads the
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
- **Ranking:** `GET /hoot-ranks/user/user-rankings.php`, re-sorted by `hoot_score`. Ties break, in
  order, by Level → most assignments completed → fewest late submissions → fewest quiz attempts →
  name (A–Z). This is one total ordering over everyone, so a whole group sharing a score is ranked
  consistently, not in isolated pairs. The page's collapsible "How scoring & levels work" panel
  spells out the same ladder for end users.
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

## Hosting (already live on Netlify)

The site is deployed and auto-refreshing — you don't need to set it up again. Details:

- **Live URL:** https://cyberhoot-leaderboard.netlify.app
- **Repo:** `github.com/charlestownehotels/cyberhoot-leaderboard` (private), branch `main`.
- **Netlify site:** `cyberhoot-leaderboard` (team *Charlestowne Hotels*), git-connected. Build
  runs `node scripts/fetch-leaderboard.mjs` and publishes `public/` (see `netlify.toml`).
- **Secrets live in Netlify env vars, never in the repo:**
  - `CYBERHOOT_HOTELS` — minified JSON of all 35 hotel keys (contents of `config/hotels.json`).
  - `CYBERHOOT_EXCLUDE` — comma-separated emails to omit from the board.
  - `BUILD_HOOK_URL` — the build hook the scheduled function pings.
- **Auto-refresh:** `netlify/functions/refresh.mjs` (cron `0 */4 * * *`) POSTs to the build
  hook every 4 hours → Netlify rebuilds → re-pulls from CyberHoot.

### Operating it

- **Change the design or logic:** edit files, `git push` to `main` → Netlify rebuilds.
- **Force a refresh now:** Netlify UI *Deploys → Trigger deploy*, or
  `npx netlify-cli api createSiteBuild --data '{"site_id":"3559bf93-14f2-4d4d-9846-54973657dd70"}'`.
- **Exclude more people:** update the `CYBERHOOT_EXCLUDE` env var (comma-separated), then redeploy.
- **Rotate / add a hotel key:** update `CYBERHOOT_HOTELS` (paste the new `config/hotels.json`), redeploy.
- **Change cadence:** edit `config.schedule` in `netlify/functions/refresh.mjs` and push.
- **Custom domain:** Netlify → Domain management (e.g. `leaderboard.charlestownehotels.com`).

> **Env-var gotcha:** set Netlify env vars *without* `--scope` — a scoped set did not reach the
> production build. `env:get`/`env:list` default to the "dev" context and hide them; verify with
> `npx netlify-cli env:list --context production --json`.

### Re-running / first-time setup (reference)

If the site ever needs rebuilding from scratch: create a private GitHub repo, push this folder,
import it in Netlify, set the three env vars above, add a build hook, and set `BUILD_HOOK_URL`.

### Alternative: manual drag-and-drop (no Git)

`npm run pack` refreshes data + builds `leaderboard-site.zip`; drag the `public/` folder or the
zip onto Netlify's manual-deploy drop zone. Keys stay on your machine, but there's no auto-refresh.

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
