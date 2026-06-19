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
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

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
        },
        redirect: "follow",
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
      return new Response("Upstream fetch failed: " + (err && err.message), {
        status: 502,
        headers: cors,
      });
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
