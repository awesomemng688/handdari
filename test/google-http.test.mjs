import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
test('Google HTTP flow binds a cookie nonce, blocks foreign origins, creates a session immediately, and rejects replay',async t=>{
  let payload;
  const clientId='test.apps.googleusercontent.com',app=createApp({dbPath:':memory:',googleClientId:clientId,verifyGoogleToken:async()=>payload});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.store.db.close();});
  const base='http://127.0.0.1:'+app.server.address().port;
  async function call(path,body,cookie='',origin='http://127.0.0.1:3100'){
    const res=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{Origin:origin,'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  }
  assert.equal((await call('auth/config')).body.google.enabled,true);
  async function start(){const state=await call('auth/google/nonce');payload={sub:'http-sub',email:'http@example.com',email_verified:true,iss:'accounts.google.com',aud:clientId,exp:Date.now()/1000+600,nonce:state.body.nonce};return state.cookie;}
  let cookie=await start();
  assert.equal((await call('auth/google',{credential:'signed'},cookie,'https://evil.example')).status,403);
  assert.equal((await call('auth/google',{credential:'signed'})).status,403);
  let result=await call('auth/google',{credential:'signed'},cookie);assert.equal(result.status,200);assert.ok(result.cookie);assert.equal((await call('me',null,result.cookie)).status,200);
  cookie=await start();result=await call('auth/google',{credential:'signed'},cookie);
  assert.equal(result.status,200);assert.equal(result.body.user.role,'customer');assert.equal(result.body.user.passwordEnabled,0);
  assert.equal((await call('me',null,result.cookie)).status,200);
  assert.equal((await call('auth/google',{credential:'signed'},cookie)).status,403);
});
