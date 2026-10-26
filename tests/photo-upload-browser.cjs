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
await page.addInitScript(()=>sessionStorage.setItem('jcb_admin_ok','1'));
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
assert(u.auth==='Bearer k3y'&&prompts===1,'key prompted once and sent');
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
assert(prompts===1,'no re-prompt');
mode='401';
await page.setInputFiles('#photo-file-input',{name:'dish.png',mimeType:'image/png',buffer:png});
await page.waitForFunction(()=>document.getElementById('photo-status').textContent.includes("key wasn't accepted"));
assert(await page.evaluate(()=>localStorage.getItem('jcb_photo_upload_key'))===null,'bad key cleared');
mode='ok';
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
assert(errors.length===0,'page errors: '+errors.join('|'));
console.log('photo upload browser checks passed');
await browser.close();server.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
