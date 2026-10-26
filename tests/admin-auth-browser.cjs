// Gate + save flow against a stubbed Apps Script. Nothing touches the real sheet.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,req.url.split('?')[0]);try{const c=fs.readFileSync(f);res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(c)}catch{res.writeHead(404);res.end()}}).listen(8000);
const assert = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const posts = []; let strictKey = 'good-key';
  await page.route('**/report', r => r.fulfill({ status: 202, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' }));
  await page.route('https://script.google.com/**', async route => {
    const h = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...h, 'Access-Control-Allow-Headers': '*' } });
    const b = JSON.parse(route.request().postData()); posts.push(b);
    const ok = b.key === strictKey;
    route.fulfill({ status: 200, headers: h, body: JSON.stringify(ok ? { status: 'ok' } : { status: 'error', message: 'unauthorized' }) });
  });
  await page.goto('http://localhost:8000/admin.html', { waitUntil: 'networkidle' });
  assert(await page.isVisible('#pw-gate'), 'gate shown with no key');
  // wrong key stays locked
  await page.fill('#pw-input', 'not-the-key'); await page.click('#pw-gate button[type=submit]');
  await page.waitForFunction(() => document.getElementById('pw-error').textContent.includes("wasn't accepted"));
  assert(await page.isVisible('#pw-gate'), 'old public password no longer opens the gate');
  assert(await page.evaluate(() => localStorage.getItem('jcb_admin_key')) === null, 'bad key not stored');
  // right key opens it and is stored
  await page.fill('#pw-input', 'good-key'); await page.click('#pw-gate button[type=submit]');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('pw-gate')).display === 'none');
  assert(await page.evaluate(() => localStorage.getItem('jcb_admin_key')) === 'good-key', 'key stored');
  // a save sends the key; with a rotated key the page asks inline, form is kept, and retries once
  strictKey = 'rotated';
  let prompts = 0; page.on('dialog', d => { prompts++; d.accept('rotated'); });
  await page.fill('#f-name', 'zz-auth-test');
  const res = await page.evaluate(async () => { try { await postToSheet({ action: 'add', Name: 'zz-auth-test', Slug: 'zz-auth-test' }); return 'saved'; } catch (e) { return e.message; } });
  assert(res === 'saved' && prompts === 1, 'inline re-prompt then saved: ' + res + ' prompts ' + prompts);
  assert(await page.inputValue('#f-name') === 'zz-auth-test', 'form kept');
  assert(posts.every(p => typeof p.key === 'string'), 'every post carries a key field');
  assert(errors.length === 0, 'no page errors ' + errors);
  console.log('admin auth checks passed'); await browser.close(); server.close();
})();
