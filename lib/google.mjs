import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword, digest, sessionToken } from './auth.mjs';
import { need } from './store.mjs';

export function createGoogleAuth(store, { clientId = '', verifyToken } = {}) {
  const { db, atomic, put }=store, client=new OAuth2Client(clientId);
  db.exec(`CREATE TABLE IF NOT EXISTS googleIdentities(subject TEXT PRIMARY KEY,userId TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,email TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS googleNonces(token TEXT PRIMARY KEY,nonce TEXT NOT NULL,intent TEXT NOT NULL,userId TEXT NOT NULL,expires INTEGER NOT NULL);`);
  const enabled=/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId);
  const config=()=>({enabled,clientId:enabled?clientId:null});
  function issue(intent,user) {
    need(enabled,'Google нэвтрэлт хараахан идэвхжээгүй байна.',503);
    need(['signin','link'].includes(intent),'Хүсэлт буруу байна.');
    if(intent==='link')need(user&&!user.mustChangePassword&&user.passwordEnabled,'Эхлээд имэйл, нууц үгээр нэвтэрнэ үү.',403);
    const token=sessionToken(),nonce=sessionToken();db.prepare('DELETE FROM googleNonces WHERE expires<=?').run(Date.now());
    db.prepare('INSERT INTO googleNonces VALUES(?,?,?,?,?)').run(digest(token),nonce,intent,intent==='link'?user.id:'',Date.now()+600000);
    return {token,nonce};
  }
  async function identity(input,token,intent,user) {
    need(enabled,'Google нэвтрэлт хараахан идэвхжээгүй байна.',503);
    need(typeof input.credential==='string'&&input.credential.length<20000,'Google нэвтрэлтийн мэдээлэл буруу байна.');
    const state=atomic(()=>{const row=db.prepare('SELECT * FROM googleNonces WHERE token=?').get(digest(token||''));need(row&&row.expires>Date.now()&&row.intent===intent&&(intent!=='link'||row.userId===user?.id),'Google хүсэлтийн хугацаа дууссан эсвэл тохирохгүй байна. Дахин оролдоно уу.',403);db.prepare('DELETE FROM googleNonces WHERE token=?').run(digest(token));return row;});
    let payload;
    try { payload=verifyToken?await verifyToken(input.credential,clientId):(await client.verifyIdToken({idToken:input.credential,audience:clientId})).getPayload(); }
    catch { need(false,'Google нэвтрэлтийг баталгаажуулж чадсангүй. Дахин оролдоно уу.',401); }
    need(payload&&['https://accounts.google.com','accounts.google.com'].includes(payload.iss)&&payload.aud===clientId&&payload.exp>Date.now()/1000&&payload.email_verified===true&&payload.nonce===state.nonce,'Google нэвтрэлтийн баталгаажуулалт буруу байна.',401);
    need(typeof payload.sub==='string'&&payload.sub.length>0&&payload.sub.length<256&&typeof payload.email==='string'&&payload.email.length<255&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email),'Google дансны мэдээлэл дутуу байна.');
    return {subject:payload.sub,email:payload.email.trim().toLowerCase(),name:typeof payload.name==='string'?payload.name.slice(0,100):payload.email.split('@')[0]};
  }
  const audit=(actor,kind)=>put('audit',randomUUID(),{actor,kind,recordId:actor,createdAt:new Date().toISOString()});
  async function signin(input,token,registrationEnabled) {
    const google=await identity(input,token,'signin');
    let linked=db.prepare('SELECT userId FROM googleIdentities WHERE subject=?').get(google.subject);
    if(!linked){
      need(registrationEnabled(),'Шинэ бүртгэл түр хаалттай байна.',403);
      need(!db.prepare('SELECT id FROM users WHERE email=?').get(google.email),'Энэ имэйлээр бүртгэлтэй байна. Имэйл, нууц үгээр нэвтрээд Миний булангаас Google дансаа холбоно уу.',409);
      const password=await hashPassword(sessionToken());
      linked=atomic(()=>{
        const previous=db.prepare('SELECT userId FROM googleIdentities WHERE subject=?').get(google.subject);if(previous)return previous;
        need(registrationEnabled(),'Шинэ бүртгэл түр хаалттай байна.',403);
        need(!db.prepare('SELECT id FROM users WHERE email=?').get(google.email),'Энэ имэйлээр бүртгэлтэй байна. Имэйл, нууц үгээр нэвтэрч Google дансаа холбоно уу.',409);
        need(db.prepare("SELECT COUNT(*) AS n FROM users WHERE status='pending'").get().n<1000,'Бүртгэл түр дүүрсэн байна.',503);
        const id=randomUUID(),requestedRole=input.requestedRole==='developer'?'developer':'customer';
        db.prepare("INSERT INTO users(id,email,name,password,role,status,passwordEnabled,requestedRole,createdAt) VALUES(?,?,?,?,'customer','pending',0,?,?)").run(id,google.email,google.name,password,requestedRole,new Date().toISOString());
        db.prepare('INSERT INTO googleIdentities VALUES(?,?,?)').run(google.subject,id,google.email);audit(id,'googleRegistered');return {userId:id};
      });
    }
    const user=db.prepare('SELECT * FROM users WHERE id=?').get(linked.userId);
    need(user&&user.status!=='suspended','Таны бүртгэлийг түр түгжсэн байна. Админтай холбогдоно уу.',403);
    if(user.status==='pending')return {pending:true,message:'Google бүртгэл баталгаажлаа. Админ зөвшөөрсний дараа Google товчоор нэвтэрнэ үү.'};
    return {pending:false,userId:user.id};
  }
  async function link(user,input,token) {
    const google=await identity(input,token,'link',user),before=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
    need(before?.status==='active'&&!before.mustChangePassword&&before.passwordEnabled&&await verifyPassword(input.currentPassword,before.password),'Одоогийн нууц үг буруу байна.',403);
    need(google.email===before.email,'Бүртгэлийн имэйлтэй ижил Google данс сонгоно уу.');
    return atomic(()=>{
      const current=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);need(current?.status==='active'&&current.password===before.password&&current.revision===before.revision,'Бүртгэл өөрчлөгдсөн байна. Дахин нэвтэрнэ үү.',409);
      need(!db.prepare('SELECT userId FROM googleIdentities WHERE subject=? OR userId=?').get(google.subject,user.id),'Google данс өмнө нь холбогдсон байна.',409);
      db.prepare('INSERT INTO googleIdentities VALUES(?,?,?)').run(google.subject,user.id,google.email);audit(user.id,'googleLinked');return {ok:true};
    });
  }
  return {config,issue,signin,link,providers:user=>({google:config(),linked:!!db.prepare('SELECT subject FROM googleIdentities WHERE userId=?').get(user.id),passwordEnabled:!!user.passwordEnabled})};
}
