import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('proxy/src/worker.js', 'utf8');
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const client = fs.readFileSync('admin-errors.js', 'utf8');
const good = { version: 1, build: 'admin-errors-v1', kind: 'ocr_scan', name: 'TypeError', line: 0, column: 0 };
const env = { REPORT_RATE_LIMITER: { limit: async () => ({ success: true }) } };
const req = (body = good, options = {}) => new Request('https://worker.test/report', { method: 'POST', headers: { Origin: 'https://thejohnsoncookbook.com', 'Content-Type': 'application/json', ...options.headers }, body: typeof body === 'string' ? body : JSON.stringify(body), ...options });
test('worker accepts only allowlisted diagnostic fields', async () => {
  const logs = []; const original = console.log; console.log = x => logs.push(x);
  try {
    const response = await worker.fetch(req({ ...good, message: 'SECRET', stack: 'SECRET', recipe: 'SECRET' }), env);
    assert.equal(response.status, 202);
    assert.deepEqual(JSON.parse(logs[0]), { event: 'admin_failure', ...good });
    assert.ok(!logs[0].includes('SECRET'));
  } finally { console.log = original; }
});
test('worker rejects invalid origin, method, MIME, JSON, schema, size and missing binding', async () => {
  assert.equal((await worker.fetch(req(good, { headers: { Origin: 'https://evil.test' } }), env)).status, 403);
  assert.equal((await worker.fetch(new Request('https://worker.test/report', { headers: { Origin: 'https://thejohnsoncookbook.com' } }), env)).status, 405);
  assert.equal((await worker.fetch(req('text', { headers: { Origin: 'https://thejohnsoncookbook.com', 'Content-Type': 'text/plain' } }), env)).status, 415);
  assert.equal((await worker.fetch(req('{'), env)).status, 400);
  assert.equal((await worker.fetch(req({ ...good, kind: 'arbitrary contents' }), env)).status, 400);
  assert.equal((await worker.fetch(req({ ...good, line: -1 }), env)).status, 400);
  assert.equal((await worker.fetch(req('x'.repeat(1025)), env)).status, 413);
  assert.equal((await worker.fetch(req(), {})).status, 503);
  assert.equal((await worker.fetch(req(), { REPORT_RATE_LIMITER: { limit: async () => ({ success: false }) } })).status, 429);
});
test('report preflight and original GET proxy still work', async () => {
  const preflight = await worker.fetch(new Request('https://worker.test/report', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8000' } }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('recipe page');
  try { assert.equal(await (await worker.fetch(new Request('https://worker.test/?url=https://example.com/recipe'), env)).text(), 'recipe page'); }
  finally { globalThis.fetch = original; }
});
function setup(fetchResult = () => Promise.resolve({ status: 202 }), configured = true) {
  const listeners = {}; const sent = []; const elements = [];
  const context = { CONFIG: { RECIPE_PROXY_URL: configured ? 'https://worker.test/' : '' }, AbortController, setTimeout, clearTimeout,
    document: { readyState: 'complete', createElement: () => ({ setAttribute() {}, style: {} }), body: { prepend: x => elements.push(x) } },
    window: { addEventListener: (kind, fn) => listeners[kind] = fn },
    fetch: (url, options) => { sent.push({ url, ...options }); return fetchResult(); } };
  vm.runInNewContext(client, context);
  return { ...context, listeners, sent, elements, report: context.window.AdminErrors.report };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 10));
test('client listeners, privacy and deduplication', async () => {
  const x = setup();
  x.listeners.error({ target: x.window, error: { name: 'TypeError', message: 'secret' }, lineno: 4, colno: 8 });
  x.listeners.error({ target: x.window, error: { name: 'TypeError', message: 'secret' }, lineno: 4, colno: 8 });
  x.listeners.unhandledrejection({ reason: { name: 'SECRET', message: 'SECRET' } });
  await flush();
  assert.equal(x.sent.length, 2);
  assert.equal(x.sent[0].url, 'https://worker.test/report');
  assert.equal(x.sent[0].credentials, 'omit');
  assert.equal(x.sent[0].referrerPolicy, 'no-referrer');
  assert.ok(!JSON.stringify(x.sent).includes('SECRET'));
  assert.equal(JSON.parse(x.sent[1].body).name, 'UnknownError');
  assert.match(x.elements[0].textContent, /does not notify Barrett directly/);
});
test('client limits reports and handles missing endpoint and failed reporting', async () => {
  const x = setup();
  for (let i = 1; i <= 15; i++) x.report('runtime', null, { line: i });
  await flush(); assert.equal(x.sent.length, 10);
  const missing = setup(undefined, false); missing.report('ocr_scan');
  assert.equal(missing.sent.length, 0); assert.match(missing.elements[0].textContent, /not configured/);
  const failed = setup(() => Promise.reject(new Error('offline'))); failed.report('ocr_scan');
  await flush(); assert.equal(failed.sent.length, 1); assert.match(failed.elements[0].textContent, /could not be sent/);
});
test('explicit scan/import hooks and early capture remain wired', () => {
  const html = fs.readFileSync('admin.html', 'utf8');
  assert.ok(html.indexOf('admin-errors.js') < html.indexOf('quill.min.js'));
  assert.match(html, /AdminErrors\?\.report\("ocr_scan", err\)/);
  assert.match(html, /AdminErrors\?\.report\("url_import", err\)/);
  assert.equal((html.match(/src="config.js"/g) || []).length, 1);
});
