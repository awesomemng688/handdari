import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server.mjs';
import { openStore } from '../lib/store.mjs';
import { hashPassword } from '../lib/auth.mjs';
const password='account-test-password-long';
async function fixture(t) {
  const app=createApp({dbPath:':memory:'}),s=app.store;
  s.db.prepare('INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)').run('owner','owner@test.mn','Эзэмшигч',await hashPassword(password),'admin');
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));s.db.close()});
  const base='http://127.0.0.1:'+app.server.address().port;
  async function call(path,body,cookie='',origin='http://127.0.0.1:3100') {
    const response=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:origin}:{}),Cookie:cookie},body:body?JSON.stringify(body):undefined});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  return {s,call,owner:(await call('login',{email:'owner@test.mn',password})).cookie};
}
const registration=(email='friend@test.mn')=>({name:'Шинэ найз',email,phone:'99112233',requestedRole:'developer',password,confirmPassword:password,consent:'on'});
const op=body=>({...body,operationId:randomUUID()});

test('registration cannot grant privileges; approval, friend binding, member data isolation, suspension and promotion',async t=>{
  const {s,call,owner}=await fixture(t);
  assert.equal((await call('admin/users')).status,401);
  assert.equal((await call('register',{...registration(),role:'admin',status:'active',friendId:'victim'})).status,201);
  let u=s.db.prepare('SELECT * FROM users WHERE email=?').get('friend@test.mn');assert.equal(u.role,'customer');assert.equal(u.status,'pending');assert.equal(u.friendId,'');
  assert.equal((await call('login',{email:u.email,password})).status,403);
  assert.equal((await call('register',registration('evil@test.mn'),'','https://evil.example')).status,403);
  const f={id:'friend-1',surname:'Тест',name:'Найз',phone:'99112233',date:'2026-11-04',type:'customer',parentId:'',member:'',address:'',note:'',status:'active'};
  s.mutate({id:'owner',role:'admin'},'friend',op(f));
  let result=await call('admin/users/update',{id:u.id,name:u.name,email:u.email,phone:u.phone,friendId:f.id,role:'developer',status:'active',revision:u.revision},owner);assert.equal(result.status,200);
  u=result.body.user;assert.equal(u.role,'developer');
  let cookie=(await call('login',{email:u.email,password})).cookie;
  assert.equal((await call('admin/users',null,cookie)).status,403);assert.equal((await call('data',null,cookie)).status,403);
  assert.equal((await call('profile',{name:'Миний нэр',phone:'99000000',role:'admin',friendId:'victim',status:'active'},cookie)).status,200);
  assert.equal(s.db.prepare('SELECT role,friendId FROM users WHERE id=?').get(u.id).role,'developer');
  const p={id:'p',name:'Нийтэлсэн бараа',code:'PUBLIC',category:'Бусад',description:'Тайлбар',image:'',price:100,threshold:1,status:'active',memberVisible:true};
  s.mutate({id:'owner',role:'admin'},'product',op(p));s.mutate({id:'owner',role:'admin'},'product',op({...p,id:'hidden',code:'HIDDEN',name:'Нууц бараа',memberVisible:false}));
  s.mutate({id:'owner',role:'admin'},'inventory',op({productId:'p',type:'receive',qty:5,cost:50,date:'2026-11-04',note:'Test'}));
  const sale={productId:'p',qty:1,price:100,extra:0,payment:'cash',paid:50,buyerId:f.id,date:'2026-11-04',note:'private note'};
  s.mutate({id:'owner',role:'admin'},'sale',op(sale));s.mutate({id:'owner',role:'admin'},'sale',op({...sale,buyerId:'',paid:100}));
  const member=(await call('member',null,cookie)).body;assert.equal(member.products.length,1);assert.equal(member.products[0].name,p.name);assert.equal(member.sales.length,1);assert.equal(member.sales[0].paid,50);
  for(const key of ['cost','profit','costTotal','note','actor','buyerId'])assert.equal(key in member.sales[0],false);
  for(const key of ['cost','stock','threshold'])assert.equal(key in member.products[0],false);
  result=await call('admin/users',null,owner);assert.ok(result.body.users.every(row=>!('password' in row)));u=result.body.users.find(row=>row.id===u.id);
  const update={id:u.id,name:u.name,email:u.email,phone:u.phone,friendId:u.friendId,role:'developer',status:'suspended',revision:u.revision};
  assert.equal((await call('admin/users/update',update,owner)).status,200);assert.equal((await call('me',null,cookie)).status,401);assert.equal((await call('login',{email:u.email,password})).status,403);
  assert.equal((await call('admin/users/update',update,owner)).status,409);
  u=s.db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  assert.equal((await call('admin/users/update',{...update,status:'active',revision:u.revision},owner)).status,200);
  u=s.db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  const promote={...update,status:'active',role:'admin',revision:u.revision};
  assert.equal((await call('admin/users/update',{...promote,currentPassword:'wrong'},owner)).status,403);
  assert.equal((await call('admin/users/update',{...promote,currentPassword:password},owner)).status,200);
  const self=s.db.prepare('SELECT * FROM users WHERE id=?').get('owner');
  assert.equal((await call('admin/users/update',{id:self.id,name:self.name,email:self.email,phone:'',friendId:'',role:'customer',status:'active',revision:self.revision,currentPassword:password},owner)).status,409);
});

test('admin-created/reset passwords force change, sessions are revoked, registration can be closed, and member links stay unique',async t=>{
  const {s,call,owner}=await fixture(t);
  let result=await call('admin/users/create',{name:'Админаас үүсгэсэн',email:'created@test.mn',role:'customer',phone:'',password},owner);assert.equal(result.status,201);
  const id=result.body.user.id;let cookie=(await call('login',{email:'created@test.mn',password})).cookie;
  assert.equal((await call('me',null,cookie)).body.user.mustChangePassword,1);assert.equal((await call('member',null,cookie)).status,403);
  assert.equal((await call('password',{current:password,password:'my-new-password-strong'},cookie)).status,200);assert.equal((await call('me',null,cookie)).status,401);
  cookie=(await call('login',{email:'created@test.mn',password:'my-new-password-strong'})).cookie;assert.equal((await call('member',null,cookie)).status,200);
  let u=s.db.prepare('SELECT * FROM users WHERE id=?').get(id);
  assert.equal((await call('admin/users/password',{id,revision:u.revision,password:'new-reset-password-long',currentPassword:'wrong'},owner)).status,403);
  assert.equal((await call('admin/users/password',{id,revision:u.revision,password:'new-reset-password-long',currentPassword:password},owner)).status,200);assert.equal((await call('me',null,cookie)).status,401);
  assert.equal((await call('admin/registration',{enabled:false},owner)).status,200);assert.equal((await call('registration')).body.enabled,false);assert.equal((await call('register',registration())).status,403);
  assert.equal((await call('admin/registration',{enabled:true},owner)).status,200);assert.equal((await call('register',registration())).status,201);
  const friend={id:'unique',surname:'',name:'Unique',phone:'',date:'2026-11-04',type:'customer',parentId:'',member:'',address:'',note:'',status:'active'};s.mutate({id:'owner',role:'admin'},'friend',op(friend));
  const update=row=>({id:row.id,name:row.name,email:row.email,phone:'',friendId:'unique',role:'customer',status:'active',revision:row.revision});
  u=s.db.prepare('SELECT * FROM users WHERE id=?').get(id);assert.equal((await call('admin/users/update',update(u),owner)).status,200);
  const other=s.db.prepare('SELECT * FROM users WHERE email=?').get('friend@test.mn');assert.equal((await call('admin/users/update',update(other),owner)).status,409);
  assert.equal((await call('admin/users/create',{name:'Bad',email:'bad@test.mn',role:'admin',phone:'',password,currentPassword:'wrong'},owner)).status,403);
});

test('v1.2 five-column users migrate without changing password, role, session or data',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'handari-users-')),path=join(dir,'old.sqlite'),hash=await hashPassword(password),old=new DatabaseSync(path);
  old.exec('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL);PRAGMA user_version=2;');
  old.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('old-owner','old@test.mn','Owner',hash,'admin');old.close();const s=openStore(path);
  try{const u=s.db.prepare('SELECT * FROM users WHERE id=?').get('old-owner');assert.equal(u.password,hash);assert.equal(u.role,'admin');assert.equal(u.status,'active');assert.equal(u.mustChangePassword,0);assert.equal(u.createdAt,'');assert.equal(s.db.prepare('PRAGMA user_version').get().user_version,4);}
  finally{s.db.close();for(const file of readdirSync(dir))unlinkSync(join(dir,file));rmdirSync(dir);}
});

test('registration has rate limits and does not accept malformed emails or short passwords',async t=>{
  const {call}=await fixture(t);
  assert.equal((await call('register',{...registration(),email:'bad'})).status,400);
  assert.equal((await call('register',{...registration(),password:'short',confirmPassword:'short'})).status,400);
  assert.equal((await call('register',{...registration(),requestedRole:'admin'})).status,400);
  assert.equal((await call('register',{...registration(),confirmPassword:'mismatch'})).status,400);
  assert.equal((await call('register',registration())).status,201);
  assert.equal((await call('register',registration('sixth@test.mn'))).status,429);
});
