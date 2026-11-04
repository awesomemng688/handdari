import {hashPassword,digest,sessionToken} from './auth.mjs';
import {need} from './store.mjs';
import {createMailer} from './mailer.mjs';
export function createRecovery(store,{origin,mailer=createMailer(),now=Date.now}={}){
  const {db,atomic}=store;
  const canonical=new URL(origin);need(['http:','https:'].includes(canonical.protocol)&&!canonical.username&&!canonical.password,'APP_ORIGIN тохиргоо буруу байна.');
  if(db.dialect!=='mysql')db.exec('CREATE TABLE IF NOT EXISTS passwordResets(token TEXT PRIMARY KEY,userId TEXT NOT NULL,passwordSnapshot TEXT NOT NULL,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS recoveryRequests(id TEXT PRIMARY KEY,emailHash TEXT NOT NULL,created INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS recovery_request_time ON recoveryRequests(created);');
  const message='Хаяг бүртгэлтэй бөгөөд нууц үгээр нэвтэрдэг бол сэргээх имэйл хүлээн авна. Спам хавтсаа шалгана уу. Google-ээр бүртгүүлсэн бол Google товчоор нэвтэрнэ. Имэйл ирэхгүй бол админтай холбогдоно уу.';
  async function request(input){
    need(mailer.enabled,'Имэйл сэргээх үйлчилгээ хараахан тохируулагдаагүй. Админтай холбогдоно уу.',503);
    need(typeof input.email==='string'&&input.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()),'Имэйл хаягаа зөв оруулна уу.');
    const email=input.email.trim().toLowerCase(),stamp=now(),addressHash=digest(email);
    const allowed=atomic(()=>{
      db.prepare('DELETE FROM recoveryRequests WHERE created<=?').run(stamp-3600000);
      db.prepare('DELETE FROM passwordResets WHERE expires<=?').run(stamp);
      need(db.prepare('SELECT COUNT(*) AS n FROM recoveryRequests').get().n<100,'Сэргээх үйлчилгээ ачаалалтай байна. Дараа дахин оролдоно уу.',429);
      const recent=db.prepare('SELECT COUNT(*) AS n FROM recoveryRequests WHERE emailHash=?').get(addressHash).n;
      if(recent>=3)return false;
      db.prepare('INSERT INTO recoveryRequests VALUES(?,?,?)').run(sessionToken(),addressHash,stamp);return true;
    });
    const user=db.prepare("SELECT * FROM users WHERE email=? AND status='active' AND passwordEnabled=1").get(email);
    if(!allowed||!user)return {message};
    const token=sessionToken(),hashed=digest(token);
    db.prepare('INSERT INTO passwordResets VALUES(?,?,?,?)').run(hashed,user.id,user.password,stamp+1200000);
    const url=canonical.origin+'/#reset?token='+encodeURIComponent(token);
    try{await mailer.send({to:user.email,url});}
    catch{db.prepare('DELETE FROM passwordResets WHERE token=?').run(hashed);console.error('HANDARI: recovery SMTP delivery failed; check SMTP configuration.');}
    return {message};
  }
  async function reset(input){
    need(typeof input.token==='string'&&/^[\w-]{43}$/.test(input.token),'Сэргээх холбоос буруу эсвэл хугацаа дууссан байна.',400);
    need(input.password===input.confirmPassword,'Нууц үг таарахгүй байна.');
    const token=digest(input.token),valid=()=>db.prepare("SELECT r.*,u.password,u.status,u.passwordEnabled FROM passwordResets r JOIN users u ON u.id=r.userId WHERE r.token=?").get(token);
    const eligible=row=>row&&row.expires>now()&&row.status==='active'&&row.passwordEnabled&&row.password===row.passwordSnapshot;
    need(eligible(valid()),'Сэргээх холбоос ашиглагдсан эсвэл хугацаа дууссан байна. Шинэ холбоос авна уу.',400);
    const encoded=await hashPassword(input.password);
    atomic(()=>{
      const row=valid();need(eligible(row),'Сэргээх холбоос ашиглагдсан эсвэл хугацаа дууссан байна.',400);
      db.prepare('UPDATE users SET password=?,mustChangePassword=0,revision=revision+1 WHERE id=?').run(encoded,row.userId);
      db.prepare('DELETE FROM sessions WHERE userId=?').run(row.userId);
      db.prepare('DELETE FROM passwordResets WHERE userId=?').run(row.userId);
      db.prepare('DELETE FROM googleNonces WHERE userId=?').run(row.userId);
    });
    return {message:'Нууц үг шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.'};
  }
  return {request,reset,config:()=>({enabled:!!mailer.enabled})};
}
