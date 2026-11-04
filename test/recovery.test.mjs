import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {hashPassword,digest} from '../lib/auth.mjs';
const password='original-password-long',updated='updated-password-very-long';
async function fixture(t,mailer){
  const sent=[],app=createApp({dbPath:':memory:',recoveryMailer:mailer||{enabled:true,send:async message=>{sent.push(message);}}});
  app.store.db.prepare('INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)').run('owner','owner@example.com','Owner',await hashPassword(password),'admin');
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.store.db.close();});
  const base='http://127.0.0.1:'+app.server.address().port;
  async function call(path,body,cookie='',origin='http://127.0.0.1:3100'){
    const res=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{Origin:origin,'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  }
  const token=()=>new URLSearchParams(new URL(sent.at(-1).url).hash.split('?')[1]).get('token');
  return {app,sent,call,token};
}
test('reset links remain private, expire, change passwords once and revoke existing sessions',async t=>{
  const {app,sent,call,token}=await fixture(t);
  const session=(await call('login',{email:'owner@example.com',password})).cookie;
  assert.equal((await call('auth/password/forgot',{email:'owner@example.com'},'','https://attacker.example')).status,403);
  const unknown=await call('auth/password/forgot',{email:'missing@example.com'});
  const known=await call('auth/password/forgot',{email:'owner@example.com'});
  assert.deepEqual(known.body,unknown.body);assert.equal(sent.length,1);assert.equal(known.body.token,undefined);
  const first=token();assert.ok(sent[0].url.startsWith('http://127.0.0.1:3100/#reset?token='));
  assert.equal(app.store.db.prepare('SELECT token FROM passwordResets').get().token,digest(first));
  app.store.db.prepare('UPDATE passwordResets SET expires=0').run();
  assert.equal((await call('auth/password/reset',{token:first,password:updated,confirmPassword:updated})).status,400);
  await call('auth/password/forgot',{email:'owner@example.com'});const fresh=token();
  assert.equal((await call('auth/password/reset',{token:fresh,password:updated,confirmPassword:'mismatch'})).status,400);
  assert.equal((await call('auth/password/reset',{token:fresh,password:'short',confirmPassword:'short'})).status,400);
  const results=await Promise.all([1,2].map(()=>call('auth/password/reset',{token:fresh,password:updated,confirmPassword:updated})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
  assert.equal((await call('me',null,session)).status,401);
  assert.equal((await call('login',{email:'owner@example.com',password})).status,401);
  assert.equal((await call('login',{email:'owner@example.com',password:updated})).status,200);
  assert.equal(app.store.db.prepare("SELECT role FROM users WHERE id='owner'").get().role,'admin');
  assert.equal(app.store.db.prepare('SELECT COUNT(*) AS n FROM passwordResets').get().n,0);
});
test('suspended and Google-only users receive no password link; account and IP request rates are bounded',async t=>{
  const {app,sent,call}=await fixture(t);
  app.store.db.prepare("UPDATE users SET status='suspended' WHERE id='owner'").run();
  assert.equal((await call('auth/password/forgot',{email:'owner@example.com'})).status,200);assert.equal(sent.length,0);
  app.store.db.prepare("UPDATE users SET status='active',passwordEnabled=0 WHERE id='owner'").run();
  assert.equal((await call('auth/password/forgot',{email:'owner@example.com'})).status,200);assert.equal(sent.length,0);
  app.store.db.prepare("UPDATE users SET passwordEnabled=1 WHERE id='owner'").run();
  for(let i=0;i<3;i++)assert.equal((await call('auth/password/forgot',{email:'owner@example.com'})).status,200);
  assert.equal(sent.length,1);
  assert.equal((await call('auth/password/forgot',{email:'owner@example.com'})).status,429);
});
test('SMTP errors never expose a usable link or claim delivery, and disabled SMTP is explicit',async t=>{
  const {app,call}=await fixture(t,{enabled:true,send:async()=>{throw new Error('private SMTP detail');}});
  const response=await call('auth/password/forgot',{email:'owner@example.com'});
  assert.equal(response.status,200);assert.equal(JSON.stringify(response.body).includes('private SMTP detail'),false);
  assert.equal(app.store.db.prepare('SELECT COUNT(*) AS n FROM passwordResets').get().n,0);
  const disabled=await fixture(t,{enabled:false});
  assert.equal((await disabled.call('auth/password/config')).body.enabled,false);
  assert.equal((await disabled.call('auth/password/forgot',{email:'owner@example.com'})).status,503);
});
test('a password changed after issuance invalidates its old recovery link',async t=>{
  const {app,call,token}=await fixture(t);
  await call('auth/password/forgot',{email:'owner@example.com'});const old=token();
  app.store.db.prepare("UPDATE users SET password=? WHERE id='owner'").run(await hashPassword('another-new-password'));
  assert.equal((await call('auth/password/reset',{token:old,password:updated,confirmPassword:updated})).status,400);
});
