import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, unlinkSync, rmdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../lib/store.mjs';
import { runDailyBackup, decryptSnapshot } from '../lib/backup.mjs';
import { createApp } from '../server.mjs';
import { hashPassword } from '../lib/auth.mjs';
const admin={id:'owner',role:'admin'},op=b=>({...b,operationId:randomUUID()});
const friend={id:'friend',surname:'Тест',name:'Найз',phone:'99112233',date:'2026-11-04',type:'customer',parentId:'',member:'',address:'Хаяг',note:'',status:'active'};
const product={id:'product',name:'Бараа',code:'P1',category:'Бусад',description:'',image:'',price:100,threshold:2,status:'active'};
const receive={productId:'product',type:'receive',qty:5,cost:50,date:'2026-11-04',note:'Тест'};
const sale={productId:'product',qty:2,price:100,extra:0,buyerId:'friend',payment:'transfer',paid:50,date:'2026-11-04',note:''};
function setup(path=':memory:'){const s=openStore(path);s.mutate(admin,'friend',op(friend));s.mutate(admin,'product',op(product));s.mutate(admin,'inventory',op(receive));return s;}
function cleanup(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory()){for(const file of readdirSync(path))unlinkSync(join(path,file));rmdirSync(path)}else unlinkSync(path)}rmdirSync(dir)}

test('partial payments, overpayment, idempotency, cancellation refund, and preserved customer history',()=>{
  const s=setup();try{
    const id=s.mutate(admin,'sale',op(sale)).id;
    assert.equal(s.get('sales',id).paid,50);assert.equal(s.list('payments').length,1);
    const payment=op({saleId:id,amount:100,method:'cash',date:'2026-11-04',note:'Second payment'});
    s.mutate(admin,'payment',payment);s.mutate(admin,'payment',payment);assert.equal(s.get('sales',id).paid,150);
    assert.throws(()=>s.mutate(admin,'payment',op({...payment,amount:51})),/үлдэгдлээс/);
    assert.equal(s.get('sales',id).paid,150);
    assert.throws(()=>s.mutate(admin,'sale',op({...sale,buyerId:''})),/найз/);
    assert.throws(()=>s.mutate(admin,'deleteFriend',op({id:'friend'})),/түүхтэй/);
    s.mutate(admin,'cancelSale',op({id,note:'Буцаалт'}));assert.equal(s.get('products','product').stock,5);assert.equal(s.get('sales',id).paid,150);
    assert.throws(()=>s.mutate(admin,'payment',op({...payment,amount:1})),/цуцлагдсан/);
    const refund=op({saleId:id,amount:100,method:'transfer',date:'2026-11-04',note:'Actual refund'});
    s.mutate(admin,'refundPayment',refund);s.mutate(admin,'refundPayment',refund);assert.equal(s.get('sales',id).paid,50);
    assert.throws(()=>s.mutate(admin,'refundPayment',op({...refund,amount:51})),/үлдэгдлээс/);
    assert.equal(s.list('payments').filter(p=>p.type==='refund').length,1);
  }finally{s.db.close()}
});

test('orders only create one sale on delivery, enforce transitions and rollback insufficient stock',()=>{
  const s=setup();try{
    const order=op({buyerId:'friend',productId:'product',qty:3,price:100,phone:'99112233',address:'Улаанбаатар',date:'2026-11-04',deliveryDate:'',note:''});
    const id=s.mutate(admin,'order',order).id;assert.equal(s.get('products','product').stock,5);assert.equal(s.list('sales').length,0);
    assert.throws(()=>s.mutate(admin,'orderStatus',op({id,expectedStatus:'new',status:'delivered'})),/шилжилт/);
    s.mutate(admin,'orderStatus',op({id,expectedStatus:'new',status:'prepared'}));
    const deliver=op({id,expectedStatus:'prepared',status:'delivered',paid:100,extra:0,payment:'transfer',date:'2026-11-04'});
    s.mutate(admin,'orderStatus',deliver);s.mutate(admin,'orderStatus',deliver);
    assert.equal(s.get('products','product').stock,2);assert.equal(s.list('sales').length,1);assert.equal(s.list('sales')[0].paid,100);assert.ok(s.get('orders',id).saleId);
    assert.throws(()=>s.mutate(admin,'orderStatus',op({id,expectedStatus:'prepared',status:'delivered',paid:0,extra:0,payment:'cash',date:'2026-11-04'})),/өөрчлөгдсөн/);
    const second=s.mutate(admin,'order',op({...order,qty:3})).id;
    s.mutate(admin,'orderStatus',op({id:second,expectedStatus:'new',status:'prepared'}));
    assert.throws(()=>s.mutate(admin,'orderStatus',op({...deliver,id:second})),/хүрэлцэхгүй/);
    assert.equal(s.get('orders',second).status,'prepared');assert.equal(s.get('products','product').stock,2);assert.equal(s.list('sales').length,1);
  }finally{s.db.close()}
});

test('stock notifications resolve on receipt, reappear on low stock and can be acknowledged',()=>{
  const s=setup();try{
    assert.ok(s.get('notifications','stock-product').resolvedAt);
    s.mutate(admin,'sale',op({...sale,qty:3,paid:300}));let alert=s.get('notifications','stock-product');assert.equal(alert.stock,2);assert.equal(alert.resolvedAt,null);
    s.mutate(admin,'ackNotification',op({id:'stock-product'}));assert.ok(s.get('notifications','stock-product').readAt);
    s.mutate(admin,'sale',op({...sale,qty:1,paid:100}));assert.equal(s.get('notifications','stock-product').readAt,null);
    s.mutate(admin,'inventory',op(receive));assert.ok(s.get('notifications','stock-product').resolvedAt);
  }finally{s.db.close()}
});

test('old sales migrate as unverified and reconciliation does not pretend an opening amount is new income',()=>{
  const dir=mkdtempSync(join(tmpdir(),'handari-migration-')),path=join(dir,'db.sqlite');let s=setup(path);
  const id=s.mutate(admin,'sale',op(sale)).id;const old=s.get('sales',id);delete old.paid;delete old.paymentTracking;s.put('sales',id,old);s.db.exec('PRAGMA user_version=1');s.db.close();
  try{
    s=openStore(path);assert.equal(s.get('sales',id).paymentTracking,'unverified');assert.equal(s.get('sales',id).paid,0);
    assert.throws(()=>s.mutate(admin,'payment',op({saleId:id,amount:100,method:'cash',date:'2026-11-04',note:''})),/баталгаажуулна/);
    s.mutate(admin,'reconcilePayment',op({saleId:id,amount:100,method:'cash',date:'2026-11-04',note:''}));assert.equal(s.get('sales',id).paid,100);assert.equal(s.list('payments')[0].type,'opening');
  }finally{s.db.close();cleanup(dir)}
});

test('photo upload checks login, role, origin and magic bytes; photos are private and valid for products',async t=>{
  const {server,store:s}=createApp({dbPath:':memory:'});const hash=await hashPassword('image-test-password');
  s.db.prepare('INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)').run('admin','admin@test.mn','Admin',hash,'admin');
  s.db.prepare('INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)').run('customer','customer@test.mn','Friend',hash,'customer');
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));s.db.close()});
  const base='http://127.0.0.1:'+server.address().port;let cookie='';
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=','base64');
  const upload=(bytes=image,type='image/png',origin='http://127.0.0.1:3100')=>fetch(base+'/api/images',{method:'POST',headers:{Origin:origin,'Content-Type':type,Cookie:cookie},body:bytes});
  assert.equal((await upload()).status,401);
  const login=async role=>{const r=await fetch(base+'/api/login',{method:'POST',headers:{Origin:'http://127.0.0.1:3100','Content-Type':'application/json'},body:JSON.stringify({email:role+'@test.mn',password:'image-test-password'})});cookie=r.headers.get('set-cookie').split(';')[0]};
  await login('customer');assert.equal((await upload()).status,403);await login('admin');assert.equal((await upload(image,'image/png','https://evil.example')).status,403);
  assert.equal((await upload(Buffer.from('<svg>hello</svg>'),'image/svg+xml')).status,415);assert.equal((await upload(Buffer.alloc(24))).status,400);
  const r=await upload();assert.equal(r.status,201);const url=(await r.json()).url;
  assert.equal((await fetch(base+url)).status,401);const fetched=await fetch(base+url,{headers:{Cookie:cookie}});assert.equal(fetched.status,200);assert.equal(fetched.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await fetched.arrayBuffer()),image);
  s.mutate(admin,'product',op({...product,image:url}));assert.equal(s.get('products','product').image,url);
});

test('encrypted daily backup includes photos, authenticates before restore, and reports remote failure honestly',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'handari-encrypted-')),source=join(dir,'db.sqlite'),keyFile=join(dir,'key'),directory=join(dir,'backups'),key=randomBytes(32);writeFileSync(keyFile,key);
  const s=setup(source);s.db.prepare('INSERT INTO images VALUES(?,?,?,?)').run('photo','image/png',Buffer.from('private-photo-data'),'now');
  try{
    let sent=0;const config={source,keyFile,directory,remote:{host:'backup.test'},retentionDays:30};
    const result=await runDailyBackup(config,async local=>{assert.ok(readFileSync(local).subarray(0,8).equals(Buffer.from('HANDARI2')));sent++});assert.equal(sent,1);assert.equal(result.remoteComplete,true);
    assert.equal(s.get('settings','backupStatus').status,'remote-success');const destination=join(dir,'restored.sqlite');await decryptSnapshot(result.destination,destination,key);
    const restored=openStore(destination);try{assert.equal(restored.get('products','product').stock,5);assert.equal(Buffer.from(restored.db.prepare('SELECT data FROM images WHERE id=?').get('photo').data).toString(),'private-photo-data')}finally{restored.db.close()}
    const tampered=join(dir,'tampered.hbk'),bytes=readFileSync(result.destination);bytes[bytes.length-1]^=1;writeFileSync(tampered,bytes);
    const bad=join(dir,'bad.sqlite');await assert.rejects(decryptSnapshot(tampered,bad,key));assert.equal(existsSync(bad),false);
    await assert.rejects(decryptSnapshot(result.destination,destination,key));assert.ok(existsSync(destination));
    await assert.rejects(runDailyBackup(config,async()=>{throw new Error('SSH unavailable')}),/SSH unavailable/);const status=s.get('settings','backupStatus');assert.equal(status.status,'failed');assert.equal(status.localComplete,true);assert.equal(status.remoteComplete,false);
    assert.equal(readdirSync(directory).filter(n=>n.endsWith('.hbk')).length,2);assert.ok(readdirSync(directory).every(n=>!n.endsWith('.partial')));
  }finally{s.db.close();cleanup(dir)}
});
