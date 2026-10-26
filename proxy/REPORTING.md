# Admin failure reports

This change records limited diagnostics. It does **not** send Barrett an email,
text, or push notification. Someone must review Cloudflare logs, or configure an
alerting consumer separately. External uptime/canary monitoring remains a separate
layer and cannot see every real-device failure.

## Enable after review and merge

1. Use Wrangler 4.36.0 or later. From `proxy/`, run `npx wrangler deploy` with
   your Cloudflare account. This deploy includes the `REPORT_RATE_LIMITER` binding
   and Workers Logs. Namespace `1001` must be unique to this limiter in your
   account; change it first if already used for another purpose.
2. Set `RECIPE_PROXY_URL` in `config.js` to the deployed worker base URL. Reports
   then go to `/report`. Alternatively set `ADMIN_REPORT_URL` to the full report
   endpoint, independently of the recipe-fetch setting. Deploy the worker FIRST,
   then publish the site configuration through a reviewed PR. Blank values disable
   sending and show a truthful notice if an error occurs. No keys belong in browser
   configuration. Keep the report URL on this trusted worker.
3. Open admin, trigger a controlled failed import, and inspect the worker's
   **Observability** logs for `admin_failure`. A 202 response means the worker
   emitted the diagnostic, not that a person has seen it. A notice on the page
   distinguishes recorded, unconfigured, and failed reporting.
4. For live debugging only: `npx wrangler tail`. This is not durable monitoring.

## What is captured

- Uncaught JS errors and unhandled promise rejections, installed before editor/OCR
  libraries load. A capture-phase error listener also flags script/stylesheet load
  failures. An unavailable reporting script itself cannot report its own failure.
- Explicit failed OCR scans (including individual screenshots in a partial scan),
  scans that yield no text (`ocr_empty`), and failed URL imports. Empty-input validation is not a
  failure. A partial import is not reported as a failure.
- Fixed version/build label, category, allowlisted exception type, line/column.
  No raw messages, stacks, full URLs, recipe text, screenshots, form values,
  passwords, email addresses, cookies, or persistent user/session IDs are sent
  by the reporting code. Unknown exception types become `UnknownError`.
- Cross-origin scripts may expose only an opaque runtime error. Line/column
  coordinates may be zero. The static build label identifies this reporting schema,
  not a unique deployment SHA.

Cloudflare necessarily receives network metadata (including the sending IP).
The IP is used transiently for rate limiting, not included in our custom log.
Invocation logs are disabled to avoid automatically recording recipe proxy query
URLs. Cloudflare's platform metadata and its own retention policies still apply.

## Safety and limits

The browser deduplicates matching errors for 60 seconds and attempts at most 10
reports per page load. Reporting times out after 5 seconds, never retries, never
recursively reports its own failure, and never blocks the user's operation.

The worker accepts POST JSON only from allowed origins, bounds the actual body to
1 KB, validates fields, and logs only allowlisted fields. The rate limiter allows
approximately 20 attempts/minute per IP per Cloudflare location. Shared networks
can hit that limit. It is approximate, not global protection. If the binding is
missing or unavailable, reporting fails closed (503); recipe proxy GETs still work.
CORS/Origin checks are not authentication: a non-browser client can forge an
allowed origin. Treat reports as untrusted signals, not verified incidents. Broad
abuse protection would need a stronger gateway or challenge.

The existing GET proxy behavior and Apps Script/Google Sheets flow are unchanged.
Logs are not a permanent error database. Review retention and plan limits in the
Cloudflare account. To disable sending, clear both reporting/proxy config URLs;
to disable just reports while keeping imports, remove the reporting script/hooks
in a follow-up PR or configure a separate disabled reporting endpoint.

## Optional proactive notifications (not enabled here)

Cloudflare supports Tail Workers or OpenTelemetry export for forwarding logs.
A small consumer can filter `event=admin_failure`, group repeated failures, and
send a notification to an explicitly selected recipient/channel. Configure secrets
in Cloudflare, never `config.js`. Do not wire a public /report endpoint directly to
an unlimited email/text sender: forged reports could spam the recipient or incur
costs. Choose the destination, throttling, and cost limits before enabling it.
No notification address, paid service, or secret is configured by this PR.

References:
- https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

## Local tests

From the repository root: `node --test tests/admin-errors.test.mjs`.
Tests exercise worker request validation, size/rate guards, privacy allowlisting,
client deduplication/caps, failed reporting, early error listeners, explicit hooks,
and the unchanged GET proxy path. For the optional real-browser fault-injection
smoke test, install Playwright in your development environment and run
`node tests/browser-smoke.cjs` (Chrome at `/usr/bin/google-chrome`, or set
`CHROME_PATH`). It serves the branch locally on port 8000 and mocks only report
transport and the deliberately failing import/OCR operations. It does not save
recipes or change production. Browser checks are also recorded in the PR.
