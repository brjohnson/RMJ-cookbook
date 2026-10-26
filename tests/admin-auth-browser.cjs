// Gate, token storage, inline re-sign-in and refresh against a stubbed Apps Script. Nothing touches the real sheet.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,req.url.split('?')[0]);try{const c=fs.readFileSync(f);res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(c)}catch{res.writeHead(404);res.end()}}).listen(8000);
const assert = (c, m) => { if (!c) { console.error('FAIL: ' + m); server.close(); process.exit(1); } };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const posts = []; let n = 0; let validToken = null;
  await page.route('**/report', r => r.fulfill({ status: 202, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' }));
  await page.route('https://script.google.com/**', async route => {
    const h = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...h, 'Access-Control-Allow-Headers': '*' } });
    const b = JSON.parse(route.request().postData()); posts.push(b);
    let out = { status: 'error', message: 'unauthorized' };
    if (b.action === 'login' && b.password === 'family-pw') { validToken = 'tok-' + (++n); out = { status: 'ok', token: validToken }; }
    else if (b.action === 'refresh' && b.token === validToken) { validToken = 'tok-' + (++n); out = { status: 'ok', token: validToken }; }
    else if (!['login', 'refresh'].includes(b.action) && b.token === validToken) out = { status: 'ok' };
    route.fulfill({ status: 200, headers: h, body: JSON.stringify(out) });
  });
  await page.goto('http://localhost:8000/admin.html', { waitUntil: 'networkidle' });
  assert(await page.isVisible('#pw-gate'), 'gate shown with no sign-in');
  await page.fill('#pw-input', 'wrong'); await page.click('#pw-gate button[type=submit]');
  await page.waitForFunction(() => document.getElementById('pw-error').textContent.includes("wasn't accepted"));
  assert(await page.isVisible('#pw-gate') && await page.evaluate(() => localStorage.getItem('jcb_admin_token')) === null, 'wrong password stays locked, nothing stored');
  await page.fill('#pw-input', 'family-pw'); await page.click('#pw-gate button[type=submit]');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('pw-gate')).display === 'none');
  assert(await page.evaluate(() => localStorage.getItem('jcb_admin_token')) === 'tok-1', 'token stored');
  assert(!(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).includes('family-pw'), 'password never stored');
  // a save sends the token and works
  let res = await page.evaluate(async () => { try { await postToSheet({ action: 'add', Name: 'zz', Slug: 'zz' }); return 'saved'; } catch (e) { return e.message; } });
  assert(res === 'saved' && posts.at(-1).token === 'tok-1', 'save carries token: ' + res);
  assert(!posts.some(p => p.action !== 'login' && 'password' in p), 'password only sent at login');
  // token goes bad (reset): box appears over the page, form kept, retry once after the password
  validToken = 'reset-elsewhere';
  await page.fill('#f-name', 'zz-keep');
  const saving = page.evaluate(async () => { try { await postToSheet({ action: 'add', Name: 'zz', Slug: 'zz' }); return 'saved'; } catch (e) { return e.message; } });
  await page.waitForSelector('#fp-input');
  assert(await page.inputValue('#f-name') === 'zz-keep', 'form kept while asking');
  await page.fill('#fp-input', 'family-pw'); await page.click('#fp-input ~ div button[type=submit]');
  assert(await saving === 'saved', 'saved after inline sign-in');
  // wrong password in the box: nothing saved, clear message
  validToken = 'reset-again';
  const saving2 = page.evaluate(async () => { try { await postToSheet({ action: 'add', Name: 'zz', Slug: 'zz' }); return 'saved'; } catch (e) { return e.message; } });
  await page.waitForSelector('#fp-input'); await page.fill('#fp-input', 'nope'); await page.click('#fp-input ~ div button[type=submit]');
  assert((await saving2).includes("wasn't accepted"), 'wrong inline password reported');
  // a new session on a browser with a stored token refreshes it quietly and goes straight in
  validToken = 'tok-keep'; await page.evaluate(() => { localStorage.setItem('jcb_admin_token', 'tok-keep'); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('pw-gate')).display === 'none');
  assert((await page.evaluate(() => localStorage.getItem('jcb_admin_token'))).startsWith('tok-') && (await page.evaluate(() => localStorage.getItem('jcb_admin_token'))) !== 'tok-keep', 'token renewed on open');
  assert(!errors.length, 'no page errors ' + errors);
  console.log('admin auth checks passed'); await browser.close(); server.close();
})();
