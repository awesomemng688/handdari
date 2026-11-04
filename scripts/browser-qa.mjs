// Local QA with a preinstalled Chrome. All users/business data exist in memory only.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createApp } from '../server.mjs';
import { hashPassword } from '../lib/auth.mjs';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('..', import.meta.url)), qa = join(root, '.qa');
await mkdir(qa, { recursive: true }); const profile = join(qa, 'chrome-' + Date.now()); await mkdir(profile);
const qaPort = Number(process.env.QA_PORT || 3197);
const app = createApp({ dbPath: ':memory:', origin: 'http://127.0.0.1:' + qaPort });
const password = 'qa-password-temporary-only';
app.store.db.prepare('INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)').run('qa-owner', 'qa@example.test', 'Хандарь', await hashPassword(password), 'admin');
await new Promise(r => app.server.listen(qaPort, '127.0.0.1', r));
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore', windowsHide: true });
let socket;
const pause = ms => new Promise(r => setTimeout(r, ms));
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await pause(100); } }
  assert.ok(port, 'Chrome debugging endpoint unavailable');
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json', { signal: AbortSignal.timeout(5000) })).json();
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map(), exceptions = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); if (!p) return; pending.delete(message.id); clearTimeout(p.timer); if (message.error) p.reject(new Error(message.error.message)); else p.resolve(message.result); }
    else if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  };
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 10000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(50); } throw new Error('Timeout: ' + expression); };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const fill = (values, selector = '#form') => evaluate(`(()=>{const f=document.querySelector(${JSON.stringify(selector)});for(const [k,v] of Object.entries(${JSON.stringify(values)})){f.elements[k].value=v;f.elements[k].dispatchEvent(new Event('input',{bubbles:true}))}})()`);
  const submit = () => evaluate("document.querySelector('#form').requestSubmit()");
  const saved = () => wait("!document.querySelector('#modal').open && !document.querySelector('.notice[role=status]')");
  const navigate = async name => { await evaluate(`location.hash=${JSON.stringify(name)}`); await wait(`document.querySelector('#nav a.active')?.getAttribute('href')===${JSON.stringify('#' + name)}`); };
  const screenshot = async name => writeFile(join(qa, name + '.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: 'http://127.0.0.1:' + qaPort + '/#register' }); await wait("!!document.querySelector('#registerForm') && document.body.dataset.ready==='true'");
  await fill({name:'Шинэ гишүүн',email:'qa-member@example.test',phone:'99001122',requestedRole:'customer',password,confirmPassword:password},'#registerForm');
  await evaluate("document.querySelector('#registerForm').elements.consent.checked=true;document.querySelector('#registerForm').requestSubmit()");
  await wait("document.querySelector('#registrationSuccess')?.hidden===false");await screenshot('registration');
  await navigate('login');
  await fill({ email: 'qa@example.test', password }, '#loginForm'); await evaluate("document.querySelector('#loginForm').requestSubmit()");
  await wait("document.querySelector('#accountLabel')?.textContent==='Хандарь' && document.querySelector('.stat-value')?.textContent!=='—'");
  await click('[data-action=friend]'); await fill({ surname: 'Тест', name: 'Найз', phone: '99112233' }); await submit(); await saved();
  await navigate('friends'); assert.ok((await evaluate('document.querySelector("#content").textContent')).includes('99112233'));
  await click('[data-edit-friend]'); await fill({ name: 'Зассан найз' }); await submit(); await saved();
  await click('[data-mode=tree]'); assert.ok(await evaluate('!!document.querySelector(".friend-tree details")'));
  await screenshot('friends-tree');
  await navigate('products'); await click('[data-action=product]'); await fill({ name: 'QA бүтээгдэхүүн', code: 'QA-1', price: 15000, threshold: 9, memberVisible:'yes' });
  await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=8;c.height=8;c.getContext('2d').fillRect(0,0,8,8);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const file=new File([blob],'qa.png',{type:'image/png'});const dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('#galleryPhoto');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await wait("document.querySelector('#photoStatus')?.textContent.startsWith('Бэлэн')");await submit(); await saved();
  await wait("document.querySelector('.product-image img')?.complete && document.querySelector('.product-image img')?.naturalWidth>0");
  await navigate('inventory'); await click('[data-action=inventory]'); await fill({ qty: 10, cost: 10000, note: 'QA хүлээн авалт' }); await submit(); await saved();
  await navigate('sales'); await click('[data-action=sale]');
  const friendId = app.store.list('friends')[0].id;
  await fill({ qty: 2, extra: 1000, buyerId: friendId, paid: 10000 }); await submit(); await saved();
  await navigate('notifications');assert.ok((await evaluate('document.querySelector("#content").textContent')).includes('QA бүтээгдэхүүн'));
  await click('[data-action^="readAlert:"]');await wait("!!document.querySelector('.stock-notification .badge')");
  await navigate('receivables');await screenshot('receivables');await click('[data-action^="payment:"]');await fill({amount:5000,note:'QA partial'});await submit();await saved();
  assert.equal(app.store.list('sales')[0].paid,15000);
  await navigate('friends');await click('[data-mode=list]');await click('[data-action^="history:"]');assert.ok((await evaluate('document.querySelector("#content").textContent')).includes('QA бүтээгдэхүүн'));
  await navigate('orders');await click('[data-action=order]');await fill({address:'QA хүргэлтийн хаяг',qty:1});await submit();await saved();
  await click('[data-action^="prepare:"]');await submit();await saved();await click('[data-action^="deliver:"]');await fill({paid:0});await submit();await saved();
  assert.equal(app.store.list('orders')[0].status,'delivered');assert.equal(app.store.list('sales').length,2);await screenshot('orders');
  await navigate('reports'); assert.ok((await evaluate('document.querySelector("#content").textContent')).includes('QA бүтээгдэхүүн'));
  await click('[data-action=expense]'); await fill({ name: 'Тээвэр', amount: 2000 }); await submit(); await saved();
  await navigate('facebook'); await wait("document.querySelector('.qr-image')?.complete && document.querySelector('.qr-image')?.naturalWidth>0");
  // QR decoding when supported by this installed browser. Never infer an unverified target.
  const decoded = await evaluate("(async()=>{if(!('BarcodeDetector' in window))return null;const b=new BarcodeDetector({formats:['qr_code']});return (await b.detect(document.querySelector('.qr-image'))).map(x=>x.rawValue)})()");
  console.log('QR browser decoder:', JSON.stringify(decoded));
  await screenshot('facebook');
  await navigate('home'); await screenshot('desktop');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await pause(300);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'), true, 'Mobile overflow'); await screenshot('mobile');
  for (const name of ['friends', 'products', 'sales', 'receivables', 'orders', 'notifications', 'inventory', 'reports', 'facebook', 'settings','admin']) {
    await navigate(name); assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'), true, 'Mobile overflow: ' + name);
  }
  await click('#menu'); assert.equal(await evaluate('document.querySelector("#sidebar").classList.contains("open")'), true); await click('#overlay');
  await navigate('sales'); await click(`[data-cancel-sale="${app.store.list('sales').find(s=>s.paid>0).id}"]`); await fill({ note: 'QA буцаалт' }); await submit(); await saved();
  assert.ok((await evaluate('document.querySelector("#content").textContent')).includes('Цуцлагдсан'));
  await click('[data-action^="refund:"]');await fill({amount:5000});await submit();await saved();
  await navigate('admin');
  const registered=app.store.db.prepare('SELECT id FROM users WHERE email=?').get('qa-member@example.test');
  await click(`[data-action="editAccount:${registered.id}"]`);await fill({status:'active',role:'customer',friendId});await submit();await saved();
  assert.equal(app.store.db.prepare('SELECT status FROM users WHERE id=?').get(registered.id).status,'active');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await pause(250);await screenshot('admin-users');
  await click('[data-action=createAccount]');await fill({name:'QA анхны нууц үг',email:'qa-temporary@example.test',phone:'',role:'customer',password});await submit();await saved();
  await click('[data-action=toggleRegistration]');await submit();await saved();assert.equal(app.store.get('settings','registrationPolicy').enabled,false);
  await navigate('settings'); await click('[data-action=logout]'); await wait("!!document.querySelector('#loginForm')");
  assert.equal(await evaluate("document.querySelector('#content').textContent.includes('QA бүтээгдэхүүн')"), false);
  await fill({email:'qa-temporary@example.test',password},'#loginForm');await evaluate("document.querySelector('#loginForm').requestSubmit()");
  await wait("document.querySelector('#content')?.textContent.includes('Анхны нэвтрэлтийн нууц үгийг')");await click('[data-action=password]');
  await fill({current:password,password:'new-qa-temporary-password'});await submit();await wait("!!document.querySelector('#loginForm')");
  await fill({email:'qa-temporary@example.test',password:'new-qa-temporary-password'},'#loginForm');await evaluate("document.querySelector('#loginForm').requestSubmit()");await wait("document.querySelector('#accountLabel')?.textContent==='QA анхны нууц үг' && !!document.querySelector('.member-links')");
  await click('[data-action=logout]');await wait("!!document.querySelector('#loginForm')");
  await fill({email:'qa-member@example.test',password},'#loginForm');await evaluate("document.querySelector('#loginForm').requestSubmit()");await wait("document.querySelector('#accountLabel')?.textContent==='Шинэ гишүүн' && !!document.querySelector('.member-links')");
  assert.equal(await evaluate("!!document.querySelector('#nav a[href=\"#admin\"]')"),false);
  await navigate('memberCatalog');await wait("document.querySelector('.product-image img')?.naturalWidth>0");await screenshot('member-catalog');
  await navigate('memberHistory');assert.ok((await evaluate('document.querySelector("#content").textContent')).includes('QA бүтээгдэхүүн'));await screenshot('member-history');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  for(const name of ['home','memberCatalog','memberHistory','settings']){await navigate(name);assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true,'Member mobile overflow: '+name);}
  await click('[data-action=logout]');await wait("!!document.querySelector('#loginForm')");
  assert.equal(await evaluate("!!document.querySelector('.google-disabled:disabled')"),true,'Unconfigured Google button must not promise working sign-in');
  assert.deepEqual(exceptions, []);
  console.log('Browser QA PASS: registration/approval/member account, admin users/create/policy, required password change, member-only catalog/history, previous business flows, mobile pages; no runtime exceptions. Screenshots in .qa/');
} finally {
  socket?.close(); chrome.kill(); app.server.closeAllConnections(); await new Promise(r => app.server.close(r)); app.store.db.close();
}
