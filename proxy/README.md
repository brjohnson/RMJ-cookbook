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

## Recipe photos (`/photo`)

The admin page's "Recipe Photo" picker resizes the image to a JPEG in the browser
(this also drops EXIF/location data), uploads it to `POST /photo`, and fills in the
Image URL with the returned `/photo/<id>.jpg` address. Photos are stored in the
`PHOTOS` KV namespace and are public to anyone who has the URL (the URL ends up in
the public recipe sheet like any other image link).

One-time setup, before merging the PR that uses it:

1. `npx wrangler deploy` from `proxy/` (Wrangler 4.45+ creates the `PHOTOS` KV namespace
   and the `PHOTO_RATE_LIMITER` binding; change namespace id `1002` first if it is in use).
2. `npx wrangler secret put SESSION_SECRET` and paste the same long random string that is
   set as `SESSION_SECRET` in the Apps Script project's Script Properties. Uploads are refused
   (503) until this is set. The family signs in once per browser with the shared password
   (checked by the Apps Script); the browser keeps only a signed token (30 days, renewed each
   time the admin page is opened), which the worker verifies with this secret. Nothing secret
   is in the repo or `config.js`.

Limits and cost (Workers Free plan, https://developers.cloudflare.com/kv/platform/pricing/):
1 GB storage, 1,000 writes/day, 100,000 reads/day. Over the limit, operations fail
instead of billing. On the Paid plan overage is billed (storage $0.50/GB-month). Each
photo is capped at 600 KB, so 1 GB holds well over a thousand photos.

Removing a photo: `npx wrangler kv key delete --binding PHOTOS "photo:<id>" --remote`.
Signing everyone out: change `SESSION_SECRET` in both the Apps Script properties and here (`wrangler secret put SESSION_SECRET`); everyone is asked for the password again on their next save or upload.
Uploads accept only JPEGs under 600 KB with a valid key and are rate limited per IP.
