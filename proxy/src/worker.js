// ============================================================
//  The Johnson Cookbook — recipe-fetch CORS proxy
//
//  Fetches a recipe page server-side (so the browser isn't blocked
//  by CORS) and returns the HTML with the right CORS headers. Used
//  by the "Import from a URL" tool on admin.html.
//
//  Browser cross-origin requests are restricted to the origins in
//  ALLOWED_ORIGINS below — other sites can't borrow this proxy.
// ============================================================

const ALLOWED_ORIGINS = [
  "https://thejohnsoncookbook.com",
  "https://www.thejohnsoncookbook.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

export default {
  async fetch(request, env = {}) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (new URL(request.url).pathname === "/report") {
      return handleReport(request, env, origin, cors);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }

    const target = new URL(request.url).searchParams.get("url");
    if (!target) {
      return new Response("Missing ?url= parameter", { status: 400, headers: cors });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response("Invalid url", { status: 400, headers: cors });
    }
    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
      return new Response("Only http(s) URLs are allowed", { status: 400, headers: cors });
    }

    try {
      const upstream = await fetch(targetUrl.toString(), {
        headers: {
          // A real browser UA — many recipe sites 403 the default fetch UA.
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        // Don't hang on sites that stall automated fetches — fail fast so the
        // admin page can report a timeout instead of spinning forever.
        signal: AbortSignal.timeout(12000),
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...cors,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      });
    } catch (err) {
      const isTimeout = err && (err.name === "TimeoutError" || err.name === "AbortError");
      return new Response(
        isTimeout
          ? "Upstream site did not respond within 12 seconds"
          : "Upstream fetch failed: " + (err && err.message),
        { status: isTimeout ? 504 : 502, headers: cors },
      );
    }
  },
};

function corsHeaders(origin) {
  // Reflect the request origin only if it's on the allowlist; otherwise
  // fall back to the canonical site so the response is still valid.
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

// This public endpoint is diagnostic telemetry, not authentication or an audit
// trail. Origin checks reduce browser abuse; non-browser clients can forge them.
const REPORT_KINDS = new Set(["runtime", "unhandled_rejection", "resource_load", "ocr_scan", "ocr_empty", "url_import"]);
const REPORT_NAMES = new Set(["Error", "TypeError", "ReferenceError", "SyntaxError", "RangeError", "URIError", "EvalError", "AbortError", "NetworkError", "UnknownError"]);

async function handleReport(request, env, origin, cors) {
  const headers = { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };
  const reply = (text, status) => new Response(text, { status, headers });
  if (!ALLOWED_ORIGINS.includes(origin)) return reply("Origin not allowed", 403);
  if (request.method === "OPTIONS") return reply(null, 204);
  if (request.method !== "POST") return reply("Method not allowed", 405);
  // A required, per-IP Workers rate limiter prevents unbounded report logging.
  // It fails closed if not bound; this never affects recipe proxy GET requests.
  if (!env.REPORT_RATE_LIMITER) return reply("Reporting not configured", 503);
  try {
    const { success } = await env.REPORT_RATE_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") || "unknown" });
    if (!success) return reply("Too many reports", 429);
  } catch (_) { return reply("Reporting temporarily unavailable", 503); }
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) return reply("JSON required", 415);
  // Bound the bytes actually read, including chunked requests without a length.
  const reader = request.body?.getReader();
  if (!reader) return reply("Body required", 400);
  let size = 0;
  const chunks = [];
  while (true) {
    let part;
    try { part = await reader.read(); } catch (_) { return reply("Invalid body", 400); }
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 1024) { await reader.cancel(); return reply("Report too large", 413); }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let data;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch (_) { return reply("Invalid JSON", 400); }
  if (!data || data.version !== 1 || data.build !== "admin-errors-v1" || !REPORT_KINDS.has(data.kind) || !REPORT_NAMES.has(data.name) ||
      !Number.isInteger(data.line) || data.line < 0 || data.line > 1000000 ||
      !Number.isInteger(data.column) || data.column < 0 || data.column > 1000000) return reply("Invalid report", 400);
  // Allowlist fields again server-side. Ignore arbitrary extra fields entirely.
  console.log(JSON.stringify({ event: "admin_failure", version: 1, build: data.build,
    kind: data.kind, name: data.name, line: data.line, column: data.column }));
  return reply(null, 202);
}
