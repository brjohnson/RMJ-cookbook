/* Admin-only, best-effort diagnostics. Never send messages, stacks, URLs,
   form values, recipe text, screenshots, passwords, or user identifiers. */
(() => {
  "use strict";
  const BUILD = "admin-errors-v1";
  const KINDS = new Set(["runtime", "unhandled_rejection", "resource_load", "ocr_scan", "ocr_empty", "url_import", "photo_upload", "save_recipe"]);
  const NAMES = new Set(["Error", "TypeError", "ReferenceError", "SyntaxError", "RangeError", "URIError", "EvalError", "AbortError", "NetworkError"]);
  const seen = new Map();
  let count = 0;
  let latest = 0;
  let banner;

  function show(text, sequence) {
    if (sequence !== latest) return;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => show(text, sequence), { once: true });
      return;
    }
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "admin-error-notice";
      banner.setAttribute("role", "status");
      banner.style.cssText = "padding:12px 16px;background:#fff3cd;color:#533f03;border:1px solid #d5ad46;margin:12px;font:14px/1.5 system-ui;";
      document.body.prepend(banner);
    }
    banner.textContent = text;
  }

  function endpoint() {
    if (typeof CONFIG === "undefined") return "";
    if (CONFIG.ADMIN_REPORT_URL) return CONFIG.ADMIN_REPORT_URL;
    if (!CONFIG.RECIPE_PROXY_URL) return "";
    return CONFIG.RECIPE_PROXY_URL.replace(/\/+$/, "") + "/report";
  }

  function report(kind, error, position = {}) {
    if (!KINDS.has(kind)) return;
    const name = NAMES.has(error?.name) ? error.name : "UnknownError";
    const line = Number.isSafeInteger(position.line) && position.line > 0 ? Math.min(position.line, 1000000) : 0;
    const column = Number.isSafeInteger(position.column) && position.column > 0 ? Math.min(position.column, 1000000) : 0;
    const key = [kind, name, line, column].join(":");
    const now = Date.now();
    if (seen.has(key) && now - seen.get(key) < 60000) return;
    seen.set(key, now);
    const sequence = ++latest;
    if (count >= 10) {
      show("An admin feature failed. The diagnostic limit for this page was reached. Please tell Barrett what you were doing.", sequence);
      return;
    }
    count++;
    let url;
    try { url = endpoint(); } catch (_) { url = ""; }
    if (!url) {
      show("An admin feature failed. Automatic reporting is not configured. Please tell Barrett what you were doing.", sequence);
      return;
    }
    show("An admin feature failed. Sending a limited diagnostic report. Your recipe and form contents are not included.", sequence);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // A rejected reporting request is handled here, never reported recursively.
    Promise.resolve().then(() => fetch(url, {
      method: "POST", credentials: "omit", referrerPolicy: "no-referrer", keepalive: true,
      headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ version: 1, build: BUILD, kind, name, line, column }),
    })).then(response => {
      if (response.status !== 202) throw new Error("Report not accepted");
      show("An admin feature failed. A limited diagnostic report was recorded, but this does not notify Barrett directly. Your recipe and form contents were not included.", sequence);
    }).catch(() => {
      show("An admin feature failed and its diagnostic report could not be sent. Please tell Barrett what you were doing.", sequence);
    }).finally(() => clearTimeout(timeout));
  }

  window.AdminErrors = Object.freeze({ report });
  window.addEventListener("error", event => {
    if (event.target && event.target !== window) {
      if (["SCRIPT", "LINK"].includes(event.target.tagName)) report("resource_load", null);
      return;
    }
    report("runtime", event.error, { line: event.lineno, column: event.colno });
  }, true);
  window.addEventListener("unhandledrejection", event => report("unhandled_rejection", event.reason));
})();
