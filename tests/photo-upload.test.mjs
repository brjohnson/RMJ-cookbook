import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const source = fs.readFileSync('proxy/src/worker.js', 'utf8');
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const ORIGIN = 'https://thejohnsoncookbook.com';
const kv = () => { const m = new Map(); return { m, put: async (k, v) => { m.set(k, v); }, get: async k => (m.has(k) ? m.get(k).buffer.slice(0) : null) }; };
const tokenFor = (exp, secret = 'sec') => `v1.${exp}.` + crypto.createHmac('sha256', secret).update('v1.' + exp).digest('base64url');
const future = () => Math.floor(Date.now() / 1000) + 3600;
const makeEnv = (over = {}) => ({ SESSION_SECRET: 'sec', PHOTOS: kv(), PHOTO_RATE_LIMITER: { limit: async () => ({ success: true }) }, ...over });
const jpeg = (n = 100) => { const b = new Uint8Array(n); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[n - 2] = 0xff; b[n - 1] = 0xd9; return b; };
const post = (body, headers = {}) => new Request('https://worker.test/photo', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'image/jpeg', Authorization: 'Bearer ' + tokenFor(future()), ...headers }, body });

test('stores a valid JPEG and serves it back with long caching', async () => {
  const env = makeEnv();
  const res = await worker.fetch(post(jpeg()), env);
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const { url } = await res.json();
  assert.match(url, /^https:\/\/worker\.test\/photo\/[0-9a-f]{24}\.jpg$/);
  const got = await worker.fetch(new Request(url), env);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(got.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(got.headers.get('Cache-Control'), /immutable/);
  assert.deepEqual(new Uint8Array(await got.arrayBuffer()), jpeg());
});
test('each upload gets its own unguessable id', async () => {
  const env = makeEnv();
  const a = (await (await worker.fetch(post(jpeg()), env)).json()).url;
  const b = (await (await worker.fetch(post(jpeg()), env)).json()).url;
  assert.notEqual(a, b);
  assert.equal(env.PHOTOS.m.size, 2);
});
test('rejects bad origin, method, type, size, content, and missing config', async () => {
  const env = makeEnv();
  assert.equal((await worker.fetch(post(jpeg(), { Origin: 'https://evil.test' }), env)).status, 403);
  assert.equal((await worker.fetch(new Request('https://worker.test/photo', { headers: { Origin: ORIGIN } }), env)).status, 405);
  assert.equal((await worker.fetch(post(jpeg(), { 'Content-Type': 'text/html' }), env)).status, 415);
  assert.equal((await worker.fetch(post(jpeg(600 * 1024 + 1)), env)).status, 413);
  assert.equal((await worker.fetch(post(new Uint8Array(200)), env)).status, 400);
  assert.equal((await worker.fetch(post('<script>alert(1)</script>'), env)).status, 400);
  assert.equal((await worker.fetch(post(jpeg()), { PHOTO_RATE_LIMITER: env.PHOTO_RATE_LIMITER })).status, 503);
  assert.equal((await worker.fetch(post(jpeg()), { PHOTOS: env.PHOTOS })).status, 503);
  assert.equal((await worker.fetch(post(jpeg()), { ...env, SESSION_SECRET: undefined })).status, 503);
  assert.equal((await worker.fetch(post(jpeg(), { Authorization: 'Bearer wrong' }), env)).status, 401);
  assert.equal((await worker.fetch(post(jpeg(), { Authorization: '' }), env)).status, 401);
  assert.equal((await worker.fetch(post(jpeg(), { Authorization: 'Bearer ' + tokenFor(Math.floor(Date.now() / 1000) - 5) }), env)).status, 401, 'expired token');
  assert.equal((await worker.fetch(post(jpeg(), { Authorization: 'Bearer ' + tokenFor(future(), 'other-secret') }), env)).status, 401, 'token signed with another secret');
  const t = tokenFor(future()).split('.'); t[1] = String(Number(t[1]) + 99999);
  assert.equal((await worker.fetch(post(jpeg(), { Authorization: 'Bearer ' + t.join('.') }), env)).status, 401, 'expiry tampered');
  assert.equal((await worker.fetch(post(jpeg(), { Authorization: 'Bearer k3y' }), env)).status, 401, 'raw password style value');
  assert.equal((await worker.fetch(post(jpeg()), makeEnv({ PHOTO_RATE_LIMITER: { limit: async () => ({ success: false }) } }))).status, 429);
  assert.equal((await worker.fetch(post(jpeg()), makeEnv({ PHOTOS: { put: async () => { throw new Error('x'); } } }))).status, 503);
  assert.equal(env.PHOTOS.m.size, 0);
});
test('photo preflight works and only valid ids are served', async () => {
  const env = makeEnv();
  const pre = await worker.fetch(new Request('https://worker.test/photo', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8000' } }), env);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  for (const p of ['/photo/', '/photo/abc.jpg', '/photo/' + '0'.repeat(24) + '.jpg', '/photo/' + '0'.repeat(24) + '.html'])
    assert.equal((await worker.fetch(new Request('https://worker.test' + p), env)).status, 404);
});
test('photo_upload is an accepted diagnostic kind and the proxy GET path is unchanged', async () => {
  const rl = { REPORT_RATE_LIMITER: { limit: async () => ({ success: true }) } };
  const logs = []; const orig = console.log; console.log = x => logs.push(x);
  try {
    const r = await worker.fetch(new Request('https://worker.test/report', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, build: 'admin-errors-v1', kind: 'photo_upload', name: 'TypeError', line: 0, column: 0 }) }), rl);
    assert.equal(r.status, 202);
  } finally { console.log = orig; }
  assert.equal(JSON.parse(logs[0]).kind, 'photo_upload');
  const f = globalThis.fetch; globalThis.fetch = async () => new Response('page');
  try { assert.equal(await (await worker.fetch(new Request('https://worker.test/?url=https://example.com/r'), {})).text(), 'page'); }
  finally { globalThis.fetch = f; }
});
