// Minimal CyberHoot API client.
//
// All 34 hotel environments live under a single MSP portal. Each hotel has its
// own API key that auto-scopes every response to that hotel. Auth is a Bearer
// token in the Authorization header (confirmed live: `?key=` and an `apikey`
// header both return 401 missing_api_key).

export const BASE_URL = 'https://cmitsolutions.cyberhoot.com/api';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The API 301-redirects collection paths to add a trailing slash (e.g.
// /customers -> /customers/). `.php` endpoints are files and must NOT get one.
// We normalize up front to avoid the redirect round-trip.
function buildUrl(path) {
  const [p, query] = path.split('?');
  let pp = p;
  if (!pp.endsWith('/') && !pp.endsWith('.php')) pp += '/';
  return BASE_URL + pp + (query ? '?' + query : '');
}

/**
 * GET a JSON endpoint with Bearer auth, retrying transient failures.
 * @param {string} path e.g. "/customers" or "/hoot-ranks/user/user-rankings.php?customer_id=1103"
 * @param {string} apiKey the hotel's 64-char key
 * @param {{retries?:number, timeoutMs?:number}} [opts]
 */
export async function chGet(path, apiKey, opts = {}) {
  const { retries = 3, timeoutMs = 30000 } = opts;
  const url = buildUrl(path);
  let lastErr;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        redirect: 'follow',
        signal: ac.signal,
      });

      // Retry on rate-limit / server errors; fail fast on 4xx (bad key etc.).
      if (res.status === 429 || res.status >= 500) {
        throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, retryable: true });
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`), {
          status: res.status,
          retryable: false,
        });
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      const retryable = err.retryable !== false; // network/abort errors are retryable
      if (!retryable || attempt === retries) break;
      await sleep(400 * 2 ** (attempt - 1) + Math.floor(attempt * 100)); // 0.5s, 0.9s, ...
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

/** Run async tasks with a bounded concurrency, preserving input order. */
export async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
