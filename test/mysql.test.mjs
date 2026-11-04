import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {createApp} from '../server.mjs';
import {hashPassword} from '../lib/auth.mjs';
import {mysqlConfig} from '../lib/database.mjs';
import {runDailyBackup,decryptSnapshot} from '../lib/backup.mjs';
import {initializeLocal,tableDigest,dataTables,mysqlSnapshot} from '../lib/transfer.mjs';
test('real MariaDB: verified migration, login, transactions, stock rollback, recovery and portable backup', {skip:process.env.RUN_MYSQL_TESTS!=='1'},async()=>{
  const config=mysqlConfig();assert.match(config.database,/^handari_qa/,'Integration tests require a dedicated handari_qa database');
  const folder=mkdtempSync(join(tmpdir(),'handari-mysql-')),source=join(folder,'source.sqlite'),password='mysql-test-password-long';let original,app,snapshot;
  try{
    original=initializeLocal(source);const hash=await hashPassword(password);
    original.db.prepare('INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)').run('owner','owner@example.com','Монгол нэр',hash,'admin');
    original.db.prepare('INSERT INTO googleIdentities VALUES(?,?,?)').run('google-subject','owner','owner@example.com');
    original.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('old-session','owner',Date.now()+60000);
    original.db.prepare('INSERT INTO images VALUES(?,?,?,?)').run('photo','image/png',Buffer.from([0,1,2,255]),new Date().toISOString());
    const owner={id:'owner',role:'admin'},op=input=>({...input,operationId:randomUUID()});
    original.mutate(owner,'product',op({id:'p',name:'Бодит тестийн бараа',code:'TEST',category:'Бусад',description:'Монгол',image:'',price:150,threshold:2,status:'active'}));
    original.mutate(owner,'inventory',op({productId:'p',type:'receive',qty:10,cost:100,date:'2026-11-04',note:'Opening receipt'}));
    const expected=Object.fromEntries(dataTables.map(table=>[table,tableDigest(original.db,table)]));original.db.close();original=null;
    execFileSync(process.execPath,['scripts/migrate-mysql.mjs',source,join(folder,'migration')],{cwd:new URL('..',import.meta.url),env:{...process.env,DB_DRIVER:'sqlite'},stdio:'inherit'});
    const sent=[];app=createApp({dbPath:':mysql:',databaseOptions:{driver:'mysql',mysql:config},recoveryMailer:{enabled:true,send:async mail=>sent.push(mail)}});
    for(const table of dataTables)assert.deepEqual(tableDigest(app.store.db,table),expected[table]);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);
    assert.equal(app.store.db.prepare("SELECT password FROM users WHERE id='owner'").get().password,hash);
    assert.equal(app.store.db.prepare("SELECT name FROM users WHERE id='owner'").get().name,'Монгол нэр');
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;let cookie='';
    async function call(path,body){const res=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{Origin:'http://127.0.0.1:3100','Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
    let response=await call('login',{email:'owner@example.com',password});assert.equal(response.status,200);cookie=response.cookie;assert.equal((await call('admin/database')).body.engine,'mysql');
    const sale=op({productId:'p',qty:7,price:150,extra:0,payment:'cash',paid:1050,buyerId:'',date:'2026-11-04',note:''});
    response=await call('action/sale',sale);assert.equal(response.status,200);const saleId=response.body.id;
    assert.equal((await call('action/sale',sale)).status,200);assert.equal(app.store.get('products','p').stock,3);
    assert.equal((await call('action/sale',op({...sale,qty:4,paid:600}))).status,409);assert.equal(app.store.get('products','p').stock,3);
    assert.equal((await call('action/cancelSale',op({id:saleId,note:'Return'}))).status,200);assert.equal(app.store.get('products','p').stock,10);
    assert.equal((await call('auth/password/forgot',{email:'owner@example.com'})).status,200);assert.equal(sent.length,1);
    const token=new URLSearchParams(new URL(sent[0].url).hash.split('?')[1]).get('token');
    assert.equal((await call('auth/password/reset',{token,password:'changed-mysql-password',confirmPassword:'changed-mysql-password'})).status,200);
    assert.equal((await call('me')).status,401);assert.equal((await call('login',{email:'owner@example.com',password:'changed-mysql-password'})).status,200);
    const competing=()=>new Promise((resolve,reject)=>{
      const code=`import {openStore} from './lib/store.mjs';const s=openStore(':mysql:',{driver:'mysql'});try{s.mutate({id:'owner',role:'admin'},'sale',${JSON.stringify(op({productId:'p',qty:7,price:150,extra:0,payment:'cash',paid:1050,buyerId:'',date:'2026-11-04',note:''}))});console.log('sold')}catch(e){console.log('rejected:'+e.status)}finally{s.db.close()}`;
      const child=spawn(process.execPath,['--input-type=module','-e',code],{cwd:new URL('..',import.meta.url),env:process.env,stdio:['ignore','pipe','pipe']});let text='';child.stdout.on('data',chunk=>text+=chunk);child.on('error',reject);child.on('close',code=>code?reject(new Error('Concurrent DB process failed')):resolve(text.trim()));
    });
    assert.deepEqual((await Promise.all([competing(),competing()])).sort(),['rejected:409','sold']);assert.equal(app.store.get('products','p').stock,3);
    const backup=join(folder,'mysql-backup.sqlite');mysqlSnapshot(app.store,backup);snapshot=initializeLocal(backup);
    for(const table of dataTables)assert.deepEqual(tableDigest(snapshot.db,table),tableDigest(app.store.db,table));
    assert.deepEqual(Buffer.from(snapshot.db.prepare("SELECT data FROM images WHERE id='photo'").get().data),Buffer.from([0,1,2,255]));
    const key=randomBytes(32),keyFile=join(folder,'backup.key');writeFileSync(keyFile,key,{mode:0o600});
    const daily=await runDailyBackup({driver:'mysql',source:source,directory:join(folder,'encrypted'),keyFile,retentionDays:30});assert.equal(daily.localComplete,true);
    const restored=join(folder,'decrypted.sqlite');await decryptSnapshot(daily.destination,restored,key);const checked=initializeLocal(restored);
    try{assert.equal(checked.get('products','p').stock,3);assert.equal(checked.db.prepare('SELECT COUNT(*) n FROM images').get().n,1);}finally{checked.db.close();}
    assert.throws(()=>execFileSync(process.execPath,['scripts/migrate-mysql.mjs',source,join(folder,'retry')],{cwd:new URL('..',import.meta.url),stdio:'pipe'}));
    console.log('MariaDB integration verified; migration refused nonempty destination.');
  }finally{snapshot?.db.close();original?.db.close();if(app){await new Promise(resolve=>app.server.close(resolve));app.store.db.close();}rmSync(folder,{recursive:true,force:true});}
});

