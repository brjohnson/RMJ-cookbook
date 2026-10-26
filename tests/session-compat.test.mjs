// A token issued by the Apps Script must verify in the photo worker (same format, same secret).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const props = { FAMILY_PASSWORD: 'pw', SESSION_SECRET: 'shared-secret', STRICT: 'true' };
const ctx = vm.createContext({
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null }) },
  Utilities: { computeHmacSha256Signature: (v, k) => crypto.createHmac('sha256', k).update(v).digest(), base64EncodeWebSafe: b => Buffer.from(b).toString('base64url') + '=', sleep: () => {} },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ t, setMimeType() { return this; } }) },
  SpreadsheetApp: {},
});
vm.runInContext(fs.readFileSync('apps-script/Code.gs', 'utf8'), ctx);
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync('proxy/src/worker.js', 'utf8')).toString('base64'));
const call = body => JSON.parse(vm.runInContext('doPost', ctx)({ postData: { contents: JSON.stringify(body) } }).t);
const jpeg = () => { const b = new Uint8Array(100); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[98] = 0xff; b[99] = 0xd9; return b; };
const up = (token, secret) => worker.fetch(new Request('https://w.test/photo', { method: 'POST', headers: { Origin: 'https://thejohnsoncookbook.com', 'Content-Type': 'image/jpeg', Authorization: 'Bearer ' + token }, body: jpeg() }),
  { SESSION_SECRET: secret, PHOTOS: { put: async () => {} }, PHOTO_RATE_LIMITER: { limit: async () => ({ success: true }) } });
test('token from login and from refresh is accepted by the worker; wrong secret is not', async () => {
  const t1 = call({ action: 'login', password: 'pw' }).token;
  const t2 = call({ action: 'refresh', token: t1 }).token;
  assert.equal((await up(t1, 'shared-secret')).status, 201);
  assert.equal((await up(t2, 'shared-secret')).status, 201);
  assert.equal((await up(t1, 'different')).status, 401);
});
