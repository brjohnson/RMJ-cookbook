# Recipe-fetch proxy (Cloudflare Worker)

A tiny Cloudflare Worker that fetches a recipe page server-side and returns
its HTML with CORS headers, so the **Import from a URL** tool on `admin.html`
works reliably (instead of depending on flaky public CORS proxies).

## Deploy

From this `proxy/` folder:

```bash
npx wrangler login      # one-time, opens a browser to authorize
npx wrangler deploy
```

`deploy` prints a URL like:

```
https://johnson-cookbook-proxy.<your-subdomain>.workers.dev
```

Copy that URL into `../config.js` as `RECIPE_PROXY_URL`.

## How it's locked down

- Recipe fetching allows only `GET` (plus `OPTIONS` preflight).
- `/report` accepts bounded admin failure reports by `POST`; see [REPORTING.md](REPORTING.md) for deployment, privacy, logs, limits, and notification options.
- Only `http`/`https` target URLs are fetched.
- Cross-origin browser requests are restricted to the origins listed in
  `ALLOWED_ORIGINS` in `src/worker.js` (the live domain + localhost).
  Add or change domains there, then re-run `npx wrangler deploy`.

## Free tier

Cloudflare Workers' free plan allows 100,000 requests/day — far beyond
what recipe imports will ever use.

## If an import still fails

Some recipe sites (NYT Cooking is the known one) block server-side fetching
entirely — no proxy will help, including this one. The admin page detects that
case and tells the user to use the **Scan recipe screenshots** tool instead,
which works no matter what the site allows.

The worker gives up on an unresponsive site after 12 seconds and returns
HTTP 504, so the admin page can show a timeout message instead of hanging.
