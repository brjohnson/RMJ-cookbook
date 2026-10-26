// Runs the proposed updateRecipe() against a fake sheet to prove it keeps unmanaged columns.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const patch = fs.readFileSync('apps-script/update-recipe-preserve-columns.gs', 'utf8');
const headers = ['Name','Slug','Collection ID','Item ID','Archived','Draft','Published On','Author','Quantity','Brief description','Category','Main image','Ingredients','Instructions','Related recipes','Principal ingredients','Favorite?',"Chef's notes",'Needs edits?'];
const base = `
function getHeaders(sheet){return sheet.headers}
function addRecipe(sheet,data){sheet.rows.push(buildRow(getHeaders(sheet),data))}
function buildRow(headers, data) {
  const f = {"Name":data["Name"]||"","Slug":data["Slug"]||"","Author":data["Author"]||"","Quantity":data["Quantity"]||"","Brief description":data["Brief description"]||"","Category":data["Category"]||"","Main image":data["Main image"]||"","Ingredients":data["Ingredients"]||"","Instructions":data["Instructions"]||"","Related recipes":data["Related recipes"]||"","Principal ingredients":data["Principal ingredients"]||"","Chef's notes":data["Chef's notes"]||"","Published On":data["_preservedPublishedOn"]||data["Created On"]||"","Draft":data["Draft"]||"false","Archived":data["Archived"]||"false"};
  return headers.map(h => f.hasOwnProperty(h) ? f[h] : "");
}`;
const ctx = vm.createContext({});
vm.runInContext(base + patch, ctx);
const makeSheet = rows => ({ headers, rows,
  getLastRow() { return this.rows.length + 1; },
  getRange(r, c, nr, nc) { const s = this; return {
    getValues: () => r === 1 ? [headers] : s.rows.slice(r - 2, r - 2 + nr).map(x => x.slice(c - 1, c - 1 + nc)),
    setValues: v => { s.rows[r - 2] = v[0]; } }; } });
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
