// Runs the real apps-script/Code.gs against a fake sheet and fake Apps Script services.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const headers = ['Name','Slug','Collection ID','Item ID','Archived','Draft','Published On','Author','Quantity','Brief description','Category','Main image','Ingredients','Instructions','Related recipes','Principal ingredients','Favorite?',"Chef's notes",'Needs edits?'];
let props = {};
const fakeSheet = { headers, rows: [], getName() { return 'recipes'; }, getActiveSheet() { return this; } };
const ctx = vm.createContext({
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheets: () => [fakeSheet], getActiveSheet: () => fakeSheet }) },
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
test('permissive mode: no key still works (rollout), valid key works', () => {
  props = { ADMIN_KEY: 'k1' }; reset();
  assert.equal(post(add()).status, 'ok');
  assert.equal(post(add({ Slug: 'new2', key: 'k1' })).status, 'ok');
  assert.equal(fakeSheet.rows.length, 3);
});
test('strict mode: missing or wrong key is refused and nothing changes', () => {
  props = { ADMIN_KEY: 'k1', STRICT: 'true' }; reset();
  for (const body of [add(), add({ key: 'wrong' }), { action: 'delete', originalSlug: 'a' }, { action: 'update', originalSlug: 'a', Name: 'x', key: 'k1x' }, { type: 'article', Name: 'x', Slug: 'y' }]) {
    const out = post(body); assert.equal(out.status, 'error'); assert.equal(out.message, 'unauthorized');
  }
  assert.equal(fakeSheet.rows.length, 1); assert.equal(fakeSheet.rows[0][0], 'N');
});
test('strict mode with no ADMIN_KEY set refuses everything (fails closed, even an empty key)', () => {
  props = { STRICT: 'true' }; reset();
  assert.equal(post(add({ key: '' })).status, 'error'); assert.equal(fakeSheet.rows.length, 1);
});
test('strict mode: right key can add, edit and delete; the key is never written to the sheet', () => {
  props = { ADMIN_KEY: 'k1', STRICT: 'true' }; reset();
  assert.equal(post(add({ key: 'k1' })).status, 'ok');
  assert.ok(!JSON.stringify(fakeSheet.rows).includes('k1'));
  assert.equal(post({ action: 'update', originalSlug: 'new', Name: 'Newer', Slug: 'new', key: 'k1' }).status, 'ok');
  assert.equal(post({ action: 'delete', originalSlug: 'new', key: 'k1' }).status, 'ok');
  assert.equal(fakeSheet.rows.length, 1);
});
test('auth action only checks the key and writes nothing', () => {
  props = { ADMIN_KEY: 'k1', STRICT: 'true' }; reset();
  assert.equal(post({ action: 'auth', key: 'k1' }).status, 'ok');
  assert.equal(post({ action: 'auth', key: 'nope' }).status, 'error');
  assert.equal(fakeSheet.rows.length, 1);
});
test('a stray request with no Name/Slug no longer appends a blank row', () => {
  props = { ADMIN_KEY: 'k1' }; reset();
  assert.equal(post({ foo: 1, key: 'k1' }).status, 'error'); assert.equal(fakeSheet.rows.length, 1);
});
