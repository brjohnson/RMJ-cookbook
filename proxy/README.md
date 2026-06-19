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

- Only `GET` (plus `OPTIONS` preflight) is allowed.
- Only `http`/`https` target URLs are fetched.
- Cross-origin browser requests are restricted to the origins listed in
  `ALLOWED_ORIGINS` in `src/worker.js` (the live domain + localhost).
  Add or change domains there, then re-run `npx wrangler deploy`.

## Free tier

Cloudflare Workers' free plan allows 100,000 requests/day — far beyond
what recipe imports will ever use.
