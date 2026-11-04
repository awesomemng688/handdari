import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openStore, need, Problem } from './lib/store.mjs';
import { verifyPassword, hashPassword, sessionToken, digest } from './lib/auth.mjs';
import { createAccounts } from './lib/accounts.mjs';
import { createGoogleAuth } from './lib/google.mjs';
import { createRecovery } from './lib/recovery.mjs';
const root = fileURLToPath(new URL('.', import.meta.url));
const dummyHash = await hashPassword('not-a-real-password-dummy');
const assets = {
  '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/accounts.js': 'accounts.js', '/google.js': 'google.js', '/recovery.js': 'recovery.js', '/features.js': 'features.js', '/styles.css': 'styles.css',
  '/sw.js': 'sw.js', '/manifest.webmanifest': 'manifest.webmanifest', '/icon.svg': 'icon.svg',
  '/icon-192.png': 'icon-192.png', '/icon-512.png': 'icon-512.png',
  '/assets/handari_logo.png': 'assets/handari_logo.png', '/assets/facebook_qr.png': 'assets/facebook_qr.png'
};
export function createApp({ dbPath = process.env.DB_PATH || join(root, 'data/handari.sqlite'), origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3100', googleClientId = process.env.GOOGLE_CLIENT_ID || '', verifyGoogleToken, recoveryMailer } = {}) {
  const store = openStore(dbPath), { db } = store, rates = new Map();
  const accounts = createAccounts(store);
  const google = createGoogleAuth(store,{clientId:googleClientId,verifyToken:verifyGoogleToken});
  const recovery=createRecovery(store,{origin,...(recoveryMailer?{mailer:recoveryMailer}:{})});
  let credentialJobs = 0;
  async function credentialWork(fn) { need(credentialJobs < 4,'Нэвтрэх үйлчилгээ ачаалалтай байна. Түр хүлээгээд дахин оролдоно уу.',503); credentialJobs++; try { return await fn(); } finally { credentialJobs--; } }
  function limit(req, purpose, max = 15, duration = 900000) {
    const ip = process.env.TRUST_PROXY === '1' ? String(req.headers['x-real-ip'] || req.socket.remoteAddress) : req.socket.remoteAddress;
    const now=Date.now(); for(const [key,rate] of rates) if(rate.reset<now) rates.delete(key);
    const key=purpose+':'+ip, rate=rates.get(key)||{count:0,reset:now+duration};
    need(rate.count<max,'Олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу.',429);rate.count++;rates.set(key,rate);
  }
  const cookie = (token, age = 604800) => `handari_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${origin.startsWith('https://') ? '; Secure' : ''}`;
  function reply(res, status, value) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  }
  const tokenOf = req => /handari_session=([\w-]+)/.exec(req.headers.cookie || '')?.[1];
  function getUser(req) {
    const token = tokenOf(req);
    return token ? db.prepare("SELECT u.id,u.email,u.name,u.role,u.status,u.phone,u.friendId,u.mustChangePassword,u.passwordEnabled FROM sessions s JOIN users u ON u.id=s.userId WHERE s.token=? AND s.expires>? AND u.status='active'").get(digest(token), Date.now()) : null;
  }
  async function body(req) {
    need(req.headers['content-type']?.split(';')[0] === 'application/json', 'JSON өгөгдөл шаардлагатай.', 415);
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; need(size <= 1024 * 1024, 'Өгөгдөл 1 MB-аас том байна.', 413); chunks.push(chunk); }
    let parsed; try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Problem('JSON өгөгдөл буруу байна.'); }
    need(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'Өгөгдлийн бүтэц буруу байна.');
    return parsed;
  }
  async function readImage(req) {
    const mime = req.headers['content-type'];
    need(['image/jpeg', 'image/png', 'image/webp'].includes(mime), 'JPG, PNG эсвэл WebP зураг оруулна уу.', 415);
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; need(size <= 5 * 1024 * 1024, 'Зураг 5 MB-аас их байна.', 413); chunks.push(chunk); }
    const bytes = Buffer.concat(chunks);
    const valid = mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
    need(valid && bytes.length > 20, 'Зургийн файл эсвэл төрөл буруу байна.');
    return { mime, bytes };
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy','same-origin-allow-popups');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' https: data:; connect-src 'self' https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    try {
      const path = new URL(req.url, origin).pathname;
      if (path.startsWith('/api/')) {
        need(['GET', 'POST'].includes(req.method), 'Хүсэлтийн арга зөвшөөрөгдөөгүй.', 405);
        if (req.method === 'POST') need(req.headers.origin === origin, 'Хүсэлтийн эх үүсвэр зөвшөөрөгдөөгүй. Хаягаа шалгана уу.', 403);
        if(path==='/api/auth/password/config'&&req.method==='GET')return reply(res,200,recovery.config());
        if(path==='/api/auth/password/forgot'&&req.method==='POST'){
          limit(req,'password-forgot',5,3600000);const input=await body(req);
          return reply(res,200,await credentialWork(()=>recovery.request(input)));
        }
        if(path==='/api/auth/password/reset'&&req.method==='POST'){
          limit(req,'password-reset',15);const input=await body(req);
          const result=await credentialWork(()=>recovery.reset(input));res.setHeader('Set-Cookie',cookie('',0));return reply(res,200,result);
        }
        if (path === '/api/auth/config' && req.method === 'GET') return reply(res,200,{google:google.config()});
        if (path === '/api/auth/google/nonce' && req.method === 'GET') {
          limit(req,'google-init',30);
          const intent=new URL(req.url,origin).searchParams.get('intent')||'signin',state=google.issue(intent,getUser(req));
          res.setHeader('Set-Cookie',`handari_google=${state.token}; Path=/api/auth/google; HttpOnly; SameSite=Strict; Max-Age=600${origin.startsWith('https://')?'; Secure':''}`);
          return reply(res,200,{nonce:state.nonce});
        }
        if (path === '/api/auth/google' && req.method === 'POST') {
          limit(req,'google-login',15);const input=await body(req),nonceCookie=/handari_google=([\w-]+)/.exec(req.headers.cookie||'')?.[1];
          const result=await credentialWork(()=>google.signin(input,nonceCookie,()=>accounts.policy().enabled));
          if(result.pending)return reply(res,202,result);
          const token=sessionToken(),now=Date.now();
          db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
          db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),result.userId,now+604800000);
          db.prepare('UPDATE users SET lastLoginAt=? WHERE id=?').run(new Date().toISOString(),result.userId);
          res.setHeader('Set-Cookie',cookie(token));
          return reply(res,200,{user:getUser({...req,headers:{...req.headers,cookie:'handari_session='+token}})});
        }
        if (path === '/api/registration' && req.method === 'GET') return reply(res,200,accounts.policy());
        if (path === '/api/register' && req.method === 'POST') {
          limit(req,'register',5,3600000);const input=await body(req);
          return reply(res,201,await credentialWork(()=>accounts.register(input)));
        }
        if (path === '/api/login' && req.method === 'POST') {
          const ip = process.env.TRUST_PROXY === '1' ? String(req.headers['x-real-ip'] || req.socket.remoteAddress) : req.socket.remoteAddress;
          const now = Date.now();
          for (const [key, rate] of rates) if (rate.reset < now) rates.delete(key);
          const rate = rates.get(ip) || { count: 0, reset: now + 900000 };
          need(rate.count < 15, 'Олон удаа оролдлоо. 15 минутын дараа дахин оролдоно уу.', 429);
          rate.count++; rates.set(ip, rate);
          const input = await body(req);
          need(typeof input.email === 'string' && input.email.length < 255, 'Имэйл хаяг оруулна уу.');
          const u = db.prepare('SELECT * FROM users WHERE email=?').get(input.email.trim().toLowerCase());
          const valid = await credentialWork(()=>verifyPassword(input.password, u?.password || dummyHash));
          need(u && u.passwordEnabled && valid && db.prepare('SELECT password FROM users WHERE id=?').get(u.id)?.password === u.password, 'Имэйл эсвэл нууц үг буруу байна.', 401);
          const current=db.prepare('SELECT status FROM users WHERE id=?').get(u.id);
          need(current.status==='active',current.status==='pending'?'Таны бүртгэл админы зөвшөөрөл хүлээж байна.':'Таны бүртгэлийг түр түгжсэн байна. Админтай холбогдоно уу.',403);
          const token = sessionToken();
          db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
          db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), u.id, now + 604800000);
          res.setHeader('Set-Cookie', cookie(token));
          db.prepare('UPDATE users SET lastLoginAt=? WHERE id=?').run(new Date().toISOString(),u.id);
          return reply(res, 200, { user: getUser({...req,headers:{...req.headers,cookie:'handari_session='+token}}) });
        }
        const user = getUser(req); need(user, 'Нэвтэрнэ үү.', 401);
        if (path === '/api/me' && req.method === 'GET') return reply(res, 200, { user });
        if (path === '/api/logout' && req.method === 'POST') {
          db.prepare('DELETE FROM sessions WHERE token=?').run(digest(tokenOf(req)));
          res.setHeader('Set-Cookie', cookie('', 0)); return reply(res, 200, { ok: true });
        }
        if (path === '/api/password' && req.method === 'POST') {
          limit(req,'password',10);
          const b = await body(req), u = db.prepare('SELECT password FROM users WHERE id=?').get(user.id);
          need(await verifyPassword(b.current, u.password), 'Одоогийн нууц үг буруу байна.');
          const hash = await hashPassword(b.password);
          store.atomic(() => { need(getUser(req) && db.prepare('SELECT password FROM users WHERE id=?').get(user.id)?.password===u.password,'Бүртгэл өөрчлөгдсөн байна. Дахин нэвтэрнэ үү.',401); db.prepare('UPDATE users SET password=?,passwordEnabled=1,mustChangePassword=0,revision=revision+1 WHERE id=?').run(hash, user.id); db.prepare('DELETE FROM sessions WHERE userId=?').run(user.id); });
          res.setHeader('Set-Cookie', cookie('', 0)); return reply(res, 200, { ok: true });
        }
        need(!user.mustChangePassword,'Эхлээд анхны нууц үгээ шинэчилнэ үү.',403);
        if(path==='/api/auth/providers' && req.method==='GET')return reply(res,200,google.providers(user));
        if(path==='/api/auth/google/link' && req.method==='POST'){
          limit(req,'google-link',10);const input=await body(req),fresh=getUser(req);need(fresh,'Дахин нэвтэрнэ үү.',401);
          const nonceCookie=/handari_google=([\w-]+)/.exec(req.headers.cookie||'')?.[1];
          return reply(res,200,await credentialWork(()=>google.link(fresh,input,nonceCookie)));
        }
        if(path==='/api/member' && req.method==='GET') return reply(res,200,accounts.member(user));
        if(path==='/api/profile' && req.method==='POST') { const input=await body(req);need(getUser(req),'Дахин нэвтэрнэ үү.',401);return reply(res,200,accounts.profile(user.id,input)); }
        need(user.role === 'admin', 'Энэ хэсгийг зөвхөн админ үзнэ.', 403);
        if(path==='/api/admin/users' && req.method==='GET')return reply(res,200,accounts.list(user.id));
        if(path.startsWith('/api/admin/') && req.method==='POST') {
          const input=await body(req);need(getUser(req),'Дахин нэвтэрнэ үү.',401);
          if(input.currentPassword)limit(req,'admin-password',10);
          if(path==='/api/admin/users/update')return reply(res,200,await credentialWork(()=>accounts.update(user.id,input)));
          if(path==='/api/admin/users/create')return reply(res,201,await credentialWork(()=>accounts.create(user.id,input)));
          if(path==='/api/admin/users/password')return reply(res,200,await credentialWork(()=>accounts.resetPassword(user.id,input)));
          if(path==='/api/admin/registration')return reply(res,200,accounts.setPolicy(user.id,input));
          throw new Problem('Хаяг олдсонгүй.',404);
        }
        if (path === '/api/images' && req.method === 'POST') {
          const image = await readImage(req), id = randomUUID();
          need(getUser(req)?.role==='admin','Админы эрх шаардлагатай.',403);
          db.prepare('INSERT INTO images VALUES(?,?,?,?)').run(id, image.mime, image.bytes, new Date().toISOString());
          return reply(res, 201, { url: '/media/' + id });
        }
        if (path === '/api/data' && req.method === 'GET') return reply(res, 200, Object.fromEntries(['friends', 'products', 'sales', 'inventoryMovements', 'expenses', 'audit', 'legacySales', 'payments', 'orders', 'notifications', 'settings'].map(k => [k, store.list(k)])));
        if (path.startsWith('/api/action/') && req.method === 'POST') {const input=await body(req);return reply(res, 200, store.mutate(getUser(req), path.slice(12), input));}
        throw new Problem('Хаяг олдсонгүй.', 404);
      }
      need(req.method === 'GET' || req.method === 'HEAD', 'Хүсэлтийн арга зөвшөөрөгдөөгүй.', 405);
      if (path.startsWith('/media/')) {
        const user = getUser(req); need(user, 'Нэвтэрнэ үү.', 401); need(!user.mustChangePassword,'Нууц үгээ шинэчилнэ үү.',403);
        need(user.role === 'admin' || store.list('products').some(p=>p.memberVisible&&p.status==='active'&&p.image===path), 'Зураг үзэх эрхгүй байна.', 403);
        need(/^\/media\/[a-f0-9-]{36}$/.test(path), 'Зураг олдсонгүй.', 404);
        const image = db.prepare('SELECT mime,data FROM images WHERE id=?').get(path.slice(7)); need(image, 'Зураг олдсонгүй.', 404);
        res.writeHead(200, { 'Content-Type': image.mime, 'Cache-Control': 'no-store', 'Content-Length': image.data.length });
        return res.end(req.method === 'HEAD' ? undefined : Buffer.from(image.data));
      }
      const file = assets[path]; need(file, 'Хаяг олдсонгүй.', 404);
      const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css', webmanifest: 'application/manifest+json', svg: 'image/svg+xml', png: 'image/png' };
      const content = await readFile(join(root, 'public', file));
      res.writeHead(200, { 'Content-Type': mime[file.split('.').pop()] + '; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (!error.status) console.error(error);
      if (!res.headersSent) reply(res, error.status || 500, { error: error.status ? error.message : 'Серверийн алдаа гарлаа. Дахин оролдоно уу.' });
      else res.end();
    }
  });
  server.requestTimeout = 30000; server.headersTimeout = 15000;
  return { server, store };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { server, store } = createApp();
  server.listen(Number(process.env.PORT || 3100), process.env.HOST || '127.0.0.1', () => console.log('HANDARI: ' + (process.env.APP_ORIGIN || 'http://127.0.0.1:3100')));
  const shutdown = () => { server.close(() => { store.db.close(); process.exit(0); }); setTimeout(() => process.exit(1), 5000).unref(); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
