// Scheduled function: triggers a fresh site build every few hours so the
// leaderboard data is re-pulled from CyberHoot.
//
// Netlify's build is what actually runs the fetch (see netlify.toml). A
// scheduled function can't rebuild the site itself, so it POSTs to a Netlify
// "build hook" URL, which kicks off a new deploy.
//
// Setup:
//   1. Netlify site → Site configuration → Build & deploy → Build hooks →
//      "Add build hook". Copy the URL.
//   2. Site configuration → Environment variables → add BUILD_HOOK_URL = <that URL>.
//
// Change the cadence by editing the cron in `config.schedule` below.

export const config = {
  schedule: '0 */4 * * *', // every 4 hours, on the hour (UTC)
};

export default async () => {
  const hook = process.env.BUILD_HOOK_URL;
  if (!hook) {
    console.error('BUILD_HOOK_URL is not set — cannot trigger a rebuild.');
    return new Response('BUILD_HOOK_URL not set', { status: 500 });
  }
  const res = await fetch(hook, { method: 'POST' });
  const msg = `Triggered rebuild: HTTP ${res.status}`;
  console.log(msg);
  return new Response(msg, { status: res.ok ? 200 : 502 });
};
