// Runs the real apps-script/Code.gs against a fake sheet and fake Apps Script services.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const headers = ['Name','Slug','Collection ID','Item ID','Archived','Draft','Published On','Author','Quantity','Brief description','Category','Main image','Ingredients','Instructions','Related recipes','Principal ingredients','Favorite?',"Chef's notes",'Needs edits?'];
let props = {};
const fakeSheet = { headers, rows: [], getName() { return 'recipes'; }, getActiveSheet() { return this; } };
const ctx = vm.createContext({
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheets: () => [fakeSheet], getActiveSheet: () => fakeSheet }) },
  Utilities: { computeHmacSha256Signature: (v, k) => crypto.createHmac('sha256', k).update(v).digest(), base64EncodeWebSafe: b => Buffer.from(b).toString('base64url') + '=', sleep: () => {} },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ t, setMimeType() { return this; } }) },
});
vm.runInContext(code, ctx);
const makeSheet = rows => ({ headers, rows,
  getLastRow() { return this.rows.length + 1; }, getLastColumn() { return headers.length; }, getName() { return 'recipes'; },
  appendRow(r) { this.rows.push(r); }, deleteRow(n) { this.rows.splice(n - 2, 1); },
  getRange(r, c, nr, nc) { const s = this; return {
    getValues: () => r === 1 ? [headers] : s.rows.slice(r - 2, r - 2 + nr).map(x => x.slice(c - 1, c - 1 + nc)),
    setValues: v => { s.rows[r - 2] = v[0]; } }; } });
Object.assign(fakeSheet, makeSheet(fakeSheet.rows), { rows: fakeSheet.rows });
const row = (slug, extra = {}) => headers.map(h => ({ Name: 'N', Slug: slug, 'Collection ID': 'C1', 'Item ID': 'I1', Draft: 'TRUE', Archived: 'FALSE', 'Published On': 'old-date', 'Favorite?': 'TRUE', 'Needs edits?': 'TRUE', ...extra })[h] ?? '');
test('edit keeps unmanaged columns, Published On, and applies managed fields', () => {
  const sheet = makeSheet([row('a'), row('b')]);
  vm.runInContext('updateRecipe', ctx)(sheet, { originalSlug: 'b', Name: 'New', Slug: 'b', Ingredients: '<p>x</p>', Draft: 'true', Archived: 'false', 'Created On': 'now' });
  const m = Object.fromEntries(headers.map((h, i) => [h, sheet.rows[1][i]]));
  assert.equal(m['Collection ID'], 'C1'); assert.equal(m['Item ID'], 'I1');
  assert.equal(m['Favorite?'], 'TRUE'); assert.equal(m['Needs edits?'], 'TRUE');
  assert.equal(m['Published On'], 'old-date'); assert.equal(m.Name, 'New'); assert.equal(m.Ingredients, '<p>x</p>'); assert.equal(m.Draft, 'true');
  assert.equal(sheet.rows[0][0], 'N');
});
test('editing a missing slug fails loudly instead of adding a row', () => {
  const sheet = makeSheet([row('a')]);
  assert.throws(() => vm.runInContext('updateRecipe', ctx)(sheet, { originalSlug: 'zzz', Name: 'x' }), /not found/);
  assert.equal(sheet.rows.length, 1);
});

// ---- access control ----
const post = body => JSON.parse(vm.runInContext('doPost', ctx)({ postData: { contents: JSON.stringify(body) } }).t);
const reset = () => { fakeSheet.rows = [row('a')]; };
const add = extra => ({ action: 'add', Name: 'New', Slug: 'new', ...extra });
const CFG = { FAMILY_PASSWORD: 'pw-1', SESSION_SECRET: 'sec-1' };
const login = () => post({ action: 'login', password: 'pw-1' });
test('login: right password returns a token, wrong or missing does not, unset config refuses', () => {
  props = { ...CFG };
  const ok = login(); assert.equal(ok.status, 'ok'); assert.match(ok.token, /^v1\.\d+\.[A-Za-z0-9_-]+$/); assert.ok(!ok.token.includes('='));
  assert.equal(post({ action: 'login', password: 'nope' }).message, 'unauthorized');
  assert.equal(post({ action: 'login' }).message, 'unauthorized');
  props = { FAMILY_PASSWORD: 'pw-1' }; assert.equal(post({ action: 'login', password: 'pw-1' }).status, 'error');
  props = { SESSION_SECRET: 'x' }; assert.equal(post({ action: 'login', password: '' }).status, 'error');
});
test('permissive mode: no token still works (rollout), valid token works', () => {
  props = { ...CFG }; reset();
  assert.equal(post(add()).status, 'ok');
  assert.equal(post(add({ Slug: 'new2', token: login().token })).status, 'ok');
  assert.equal(fakeSheet.rows.length, 3);
});
test('strict mode: missing, garbage, expired, forged or wrong-secret tokens are refused and nothing changes', () => {
  props = { ...CFG, STRICT: 'true' }; reset();
  const good = login().token; const [v, exp, sig] = good.split('.');
  const expired = (() => { const e = Math.floor(Date.now() / 1000) - 10; return `v1.${e}.` + crypto.createHmac('sha256', 'sec-1').update('v1.' + e).digest('base64url'); })();
  const otherSecret = `v1.${exp}.` + crypto.createHmac('sha256', 'other').update('v1.' + exp).digest('base64url');
  for (const token of [undefined, '', 'pw-1', 'garbage', `v1.${Number(exp) + 100}.${sig}`, expired, otherSecret]) {
    for (const body of [add({ token }), { action: 'delete', originalSlug: 'a', token }, { action: 'update', originalSlug: 'a', Name: 'x', token }, { type: 'article', Name: 'x', Slug: 'y', token }]) {
      const out = post(body); assert.equal(out.status, 'error'); assert.equal(out.message, 'unauthorized');
    }
  }
  assert.equal(post(add({ password: 'pw-1' })).message, 'unauthorized', 'password alone is not a credential for writes');
  assert.equal(fakeSheet.rows.length, 1); assert.equal(fakeSheet.rows[0][0], 'N');
});
test('strict mode with nothing configured refuses everything (fails closed)', () => {
  props = { STRICT: 'true' }; reset();
  assert.equal(post(add({ token: 'v1.9999999999.abc' })).status, 'error'); assert.equal(fakeSheet.rows.length, 1);
});
test('strict mode: a valid token can add, edit and delete; token and password are never written to the sheet', () => {
  props = { ...CFG, STRICT: 'true' }; reset();
  const token = login().token;
  assert.equal(post(add({ token, password: 'pw-1' })).status, 'ok');
  const dump = JSON.stringify(fakeSheet.rows);
  assert.ok(!dump.includes('v1.') && !dump.includes('pw-1'));
  assert.equal(post({ action: 'update', originalSlug: 'new', Name: 'Newer', Slug: 'new', token }).status, 'ok');
  assert.equal(post({ action: 'delete', originalSlug: 'new', token }).status, 'ok');
  assert.equal(fakeSheet.rows.length, 1);
});
test('rotating SESSION_SECRET signs every old token out; changing the password does not', () => {
  props = { ...CFG, STRICT: 'true' }; reset();
  const token = login().token;
  props = { ...CFG, FAMILY_PASSWORD: 'pw-2', STRICT: 'true' };
  assert.equal(post(add({ token })).status, 'ok');
  props = { ...CFG, SESSION_SECRET: 'sec-2', STRICT: 'true' };
  assert.equal(post(add({ Slug: 'z', token })).message, 'unauthorized');
});
test('refresh swaps a valid token for a new one and refuses a bad one; writes nothing', () => {
  props = { ...CFG, STRICT: 'true' }; reset();
  const r = post({ action: 'refresh', token: login().token }); assert.equal(r.status, 'ok'); assert.ok(r.expires > Date.now() / 1000);
  assert.equal(post({ action: 'refresh', token: 'x' }).status, 'error');
  assert.equal(fakeSheet.rows.length, 1);
});
test('a stray request with no Name/Slug no longer appends a blank row', () => {
  props = { ...CFG }; reset();
  assert.equal(post({ foo: 1 }).status, 'error'); assert.equal(fakeSheet.rows.length, 1);
});
