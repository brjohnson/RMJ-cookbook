// Real-browser check of the admin photo uploader against a fake /photo endpoint.
// Run: node tests/photo-upload-browser.cjs (needs Playwright and Chrome; see browser-smoke.cjs)
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,req.url.split('?')[0]);try{const c=fs.readFileSync(f);res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(c)}catch{res.writeHead(404);res.end()}}).listen(8000);
const assert=(c,m)=>{if(!c)throw Error('FAIL: '+m)};
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:960}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let prompts=0;page.on('dialog',d=>{prompts++;d.accept('k3y')});
await page.addInitScript(()=>{sessionStorage.setItem('jcb_admin_ok','1');localStorage.setItem('jcb_admin_token','test-token');});
let mode='ok';const uploads=[];
await page.route('**/photo',async route=>{
  const r=route.request();
  if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}});
  uploads.push({type:r.headers()['content-type'],auth:r.headers()['authorization'],body:r.postDataBuffer()});
  const h={'Access-Control-Allow-Origin':'*'};
  if(mode==='401')return route.fulfill({status:401,headers:h,body:'x'});
  if(mode==='429')return route.fulfill({status:429,headers:h,body:'x'});
  if(mode==='net')return route.abort();
  route.fulfill({status:201,headers:{...h,'Content-Type':'application/json'},body:JSON.stringify({url:'https://johnson-cookbook-proxy.johnson-cookbook.workers.dev/photo/aaaaaaaaaaaaaaaaaaaaaaaa.jpg'})});
});
await page.route('**/report',r=>r.fulfill({status:202,headers:{'Access-Control-Allow-Origin':'*'},body:''}));
await page.goto('http://localhost:8000/admin.html',{waitUntil:'networkidle'});
// A large, noisy 4000x3000 PNG standing in for a phone photo.
const big=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=4000;c.height=3000;const x=c.getContext('2d');for(let i=0;i<400;i++){x.fillStyle=`hsl(${i*7%360},70%,${30+i%40}%)`;x.fillRect((i*97)%4000,(i*61)%3000,400,300)}const b=await new Promise(r=>c.toBlob(r,'image/png'));return Array.from(new Uint8Array(await b.arrayBuffer()))});
const png=Buffer.from(big);
const status=()=>page.textContent('#photo-status');
await page.setInputFiles('#photo-file-input',{name:'dish.png',mimeType:'image/png',buffer:png});
await page.waitForFunction(()=>document.getElementById('photo-status').textContent.includes('uploaded'));
assert(uploads.length===1,'one upload');
const u=uploads[0];
assert(u.type==='image/jpeg','content type '+u.type);
assert(u.body[0]===0xff&&u.body[1]===0xd8,'jpeg magic');
assert(!u.body.includes(Buffer.from('Exif')),'no EXIF block');
assert(u.auth==='Bearer test-token'&&prompts===0,'saved token sent, no prompt');
assert(u.body.length<=500*1024,'size '+u.body.length);
console.log('original bytes',png.length,'uploaded bytes',u.body.length);
assert((await page.inputValue('#f-image')).endsWith('/photo/aaaaaaaaaaaaaaaaaaaaaaaa.jpg'),'f-image filled');
assert(await page.isVisible('#photo-preview'),'preview shown');
const dims=await page.evaluate(()=>{const i=document.getElementById('photo-preview');return [i.naturalWidth,i.naturalHeight]});
assert(Math.max(...dims)===1200,'resized '+dims);
// Key remembered: no second prompt. Wrong key (401) clears it.
await page.fill('#f-image','');
await page.setInputFiles('#photo-file-input',{name:'dish.png',mimeType:'image/png',buffer:png});
await page.waitForFunction(()=>document.getElementById('photo-status').textContent.includes('uploaded'));
assert(prompts===0,'no re-prompt');
mode='401';
// Expired sign-in: a password box appears over the page (form kept); cancelling leaves the field untouched.
await page.fill('#f-name','keep me');
await page.setInputFiles('#photo-file-input',{name:'dish.png',mimeType:'image/png',buffer:png});
await page.waitForSelector('#fp-input');
assert(await page.evaluate(()=>localStorage.getItem('jcb_admin_token'))===null,'rejected token cleared');
await page.click('#fp-cancel');
await page.waitForFunction(()=>document.getElementById('photo-status').textContent.includes('Upload cancelled'));
assert(await page.inputValue('#f-name')==='keep me','form kept');
mode='ok';
await page.evaluate(()=>localStorage.setItem('jcb_admin_token','test-token'));
// Failure: 429 keeps the old URL out of the field and shows a message.
await page.fill('#f-image','');mode='429';
await page.setInputFiles('#photo-file-input',{name:'dish.png',mimeType:'image/png',buffer:png});
await page.waitForFunction(()=>document.getElementById('photo-status').textContent.includes('Too many'));
assert((await page.inputValue('#f-image'))==='','f-image untouched on failure');
// Failure: network error.
mode='net';
await page.setInputFiles('#photo-file-input',{name:'dish.png',mimeType:'image/png',buffer:png});
await page.waitForFunction(()=>document.getElementById('photo-status').textContent.includes('reach'));
// Failure: not an image / undecodable.
mode='ok';const before=uploads.length;
await page.setInputFiles('#photo-file-input',{name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('hi')});
assert((await status()).includes("isn't an image"),'non-image message');
await page.setInputFiles('#photo-file-input',{name:'bad.jpg',mimeType:'image/jpeg',buffer:Buffer.from('not really a jpeg')});
await page.waitForFunction(()=>document.getElementById('photo-status').textContent.includes("Couldn't read"));
assert(uploads.length===before,'nothing uploaded for bad files');
// Save button is re-enabled after every outcome.
assert(!(await page.$eval('#submit-btn',b=>b.disabled)),'submit re-enabled');
// Save/delete confirmation is truthful. The Apps Script is always stubbed here: tests never touch production data.
let sheetReply={status:200,body:'{"status":"ok"}'};const posts=[];
await page.route('**script.google.com/**',route=>{posts.push(route.request().postData());if(sheetReply==='abort')return route.abort();route.fulfill({status:sheetReply.status,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'text/plain'},body:sheetReply.body})});
await page.fill('#f-name','Test dish');
const saveStatus=async()=>{await page.evaluate(()=>submitForm(new Event('submit')));await page.waitForFunction(()=>/Saved|NOT confirmed/.test(document.getElementById('submit-status').textContent));return page.textContent('#submit-status')};
assert((await saveStatus()).includes('confirmed it'),'ok reply shows confirmed');
sheetReply={status:200,body:'{"status":"error","message":"boom"}'};
let t=await saveStatus();assert(t.includes('NOT confirmed saved')&&t.includes('boom'),'error reply shown: '+t);
sheetReply={status:200,body:'<html>login</html>'};
t=await saveStatus();assert(t.includes('NOT confirmed saved'),'unreadable reply: '+t);
sheetReply='abort';
t=await saveStatus();assert(t.includes('NOT confirmed saved'),'network failure: '+t);
assert(posts.length===4&&posts.every(p=>JSON.parse(p).Name==='Test dish'),'only stubbed posts');
// Editing a hidden recipe keeps it hidden; a new recipe is public.
sheetReply={status:200,body:'{"status":"ok"}'};
await page.evaluate(()=>{switchMode('edit');searchMatches=[{Name:'Hidden one',Slug:'hidden-one',Draft:'TRUE',Archived:'FALSE'}];selectRecipeForEdit(0)});
await saveStatus();
let last=JSON.parse(posts[posts.length-1]);
assert(last.action==='update'&&last.Draft==='true'&&last.Archived==='false','edit keeps Draft: '+JSON.stringify([last.action,last.Draft,last.Archived]));
await page.evaluate(()=>{clearEditSelection();switchMode('add')});await page.fill('#f-name','New dish');await saveStatus();
last=JSON.parse(posts[posts.length-1]);assert(last.action==='add'&&last.Draft==='false','new recipe is not a draft');
assert(errors.length===0,'page errors: '+errors.join('|'));
console.log('photo upload browser checks passed');
await browser.close();server.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
