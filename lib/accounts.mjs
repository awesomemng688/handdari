import { randomUUID } from 'node:crypto';
import { need, Problem } from './store.mjs';
import { hashPassword, verifyPassword } from './auth.mjs';
const PUBLIC_COLUMNS='id,email,name,role,status,phone,friendId,requestedRole,createdAt,lastLoginAt,mustChangePassword,revision';
function short(value,max,required=false){need(typeof value==='string'&&value.length<=max&&(!required||value.trim()),'Бүртгэлийн мэдээллээ шалгана уу.');return value.trim();}
function email(value){const normalized=short(value,254,true).toLowerCase();need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized),'Имэйл хаяг буруу байна.');return normalized;}
function idValue(value){need(typeof value==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(value),'Хэрэглэгчийн дугаар буруу байна.');return value;}
export function createAccounts(store){
  const {db,atomic,put,get,list}=store;
  const policy=()=>({enabled:get('settings','registrationPolicy')?.enabled!==false});
  const publicUser=id=>db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id=?`).get(id);
  function admin(id){const actor=db.prepare('SELECT * FROM users WHERE id=?').get(id);need(actor?.role==='admin'&&actor.status==='active'&&!actor.mustChangePassword,'Админы эрх шаардлагатай.',403);return actor;}
  const audit=(actor,kind,recordId)=>put('audit',randomUUID(),{actor,kind,recordId,createdAt:new Date().toISOString()});
  function conflict(error){if(String(error.message).includes('UNIQUE constraint'))throw new Problem('Имэйл эсвэл холбоотой найзын бүртгэл давхардлаа.',409);throw error;}
  async function register(input){
    need(policy().enabled,'Шинэ бүртгэл түр хаалттай байна.',403);need(!input.website,'Бүртгэлийн хүсэлт буруу байна.');
    const name=short(input.name,100,true),address=email(input.email),phone=short(input.phone||'',30);
    need(['customer','developer'].includes(input.requestedRole),'Найзын төрлөө сонгоно уу.');
    need(input.password===input.confirmPassword,'Нууц үг таарахгүй байна.');
    const encoded=await hashPassword(input.password),id=randomUUID();
    try{atomic(()=>{
      need(policy().enabled,'Шинэ бүртгэл түр хаалттай байна.',403);
      need(db.prepare("SELECT COUNT(*) AS n FROM users WHERE status='pending'").get().n<1000,'Бүртгэлийн хүсэлт түр дүүрсэн байна. Админтай холбогдоно уу.',503);
      db.prepare("INSERT INTO users(id,email,name,password,role,status,phone,requestedRole,createdAt) VALUES(?,?,?,?,?,'pending',?,?,?)").run(id,address,name,encoded,'customer',phone,input.requestedRole,new Date().toISOString());audit(id,'userRegistered',id);
    });}catch(e){conflict(e);}
    return {message:'Бүртгэлийн хүсэлт илгээгдлээ. Админ зөвшөөрсний дараа нэвтэрнэ үү.'};
  }
  async function confirmActor(actorId,password){
    const before=admin(actorId);need(await verifyPassword(password,before.password),'Админы одоогийн нууц үг буруу байна.',403);
    const after=admin(actorId);need(before.password===after.password&&before.revision===after.revision,'Админы бүртгэл өөрчлөгдсөн байна. Дахин нэвтэрнэ үү.',409);return before.password;
  }
  async function update(actorId,input){
    idValue(input.id);const actor=admin(actorId),before=publicUser(input.id);need(before,'Хэрэглэгч олдсонгүй.',404);
    const name=short(input.name,100,true),address=email(input.email),phone=short(input.phone||'',30),friendId=short(input.friendId||'',80);
    need(['admin','customer','developer'].includes(input.role)&&['pending','active','suspended'].includes(input.status),'Эрх эсвэл төлөв буруу байна.');
    const sensitive=(before.role==='admin'||input.role==='admin')&&(before.role!==input.role||before.status!==input.status);
    const confirmedHash=sensitive?await confirmActor(actorId,input.currentPassword):null;
    try{return atomic(()=>{
      const liveActor=admin(actorId),current=publicUser(input.id);need(current&&current.revision===input.revision,'Бүртгэл өөрчлөгдсөн байна. Дахин ачаална уу.',409);
      if(confirmedHash)need(liveActor.password===confirmedHash,'Дахин нэвтэрнэ үү.',403);
      need(input.id!==actor.id||(input.role===actor.role&&input.status==='active'),'Өөрийн админ эрхийг хасах эсвэл өөрийгөө түгжих боломжгүй.',409);
      if(current.role==='admin'&&current.status==='active'&&(input.role!=='admin'||input.status!=='active'))need(db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND status='active'").get().n>1,'Сүүлийн идэвхтэй админыг хасаж болохгүй.',409);
      need(!friendId||get('friends',friendId),'Холбох найз олдсонгүй.');
      db.prepare('UPDATE users SET name=?,email=?,phone=?,role=?,status=?,friendId=?,revision=revision+1 WHERE id=?').run(name,address,phone,input.role,input.status,friendId,input.id);
      db.prepare('DELETE FROM sessions WHERE userId=?').run(input.id);audit(actorId,'userUpdated',input.id);return {user:publicUser(input.id)};
    });}catch(e){conflict(e);}
  }
  async function create(actorId,input){
    admin(actorId);const name=short(input.name,100,true),address=email(input.email),phone=short(input.phone||'',30);
    need(['customer','developer','admin'].includes(input.role),'Эрх буруу байна.');
    const confirmedHash=input.role==='admin'?await confirmActor(actorId,input.currentPassword):null,encoded=await hashPassword(input.password),id=randomUUID();
    try{return atomic(()=>{
      const actor=admin(actorId);if(confirmedHash)need(actor.password===confirmedHash,'Дахин нэвтэрнэ үү.',403);
      db.prepare("INSERT INTO users(id,email,name,password,role,status,phone,requestedRole,createdAt,mustChangePassword) VALUES(?,?,?,?,?,'active',?,?,?,1)").run(id,address,name,encoded,input.role,phone,input.role,new Date().toISOString());audit(actorId,'userCreated',id);return {user:publicUser(id)};
    });}catch(e){conflict(e);}
  }
  async function resetPassword(actorId,input){
    idValue(input.id);need(actorId!==input.id,'Өөрийн нууц үгийг Миний булан хэсгээс солино уу.');
    const confirmedHash=await confirmActor(actorId,input.currentPassword),encoded=await hashPassword(input.password);
    return atomic(()=>{
      const actor=admin(actorId),target=publicUser(input.id);need(actor.password===confirmedHash,'Дахин нэвтэрнэ үү.',403);need(target,'Хэрэглэгч олдсонгүй.',404);need(target.revision===input.revision,'Бүртгэл өөрчлөгдсөн байна. Дахин ачаална уу.',409);
      db.prepare('UPDATE users SET password=?,mustChangePassword=1,revision=revision+1 WHERE id=?').run(encoded,input.id);db.prepare('DELETE FROM sessions WHERE userId=?').run(input.id);audit(actorId,'userPasswordReset',input.id);return {ok:true};
    });
  }
  function member(user){
    const friend=user.friendId?get('friends',user.friendId):null;
    const products=list('products').filter(p=>p.status==='active'&&p.memberVisible).map(p=>({id:p.id,name:p.name,category:p.category,description:p.description,image:p.image,price:p.price,available:p.stock>0}));
    const sales=friend?list('sales').filter(s=>s.buyerId===friend.id).map(s=>({id:s.id,date:s.date,productName:s.productName,qty:s.qty,total:s.total,status:s.status,paid:s.paymentTracking==='verified'?s.paid:null})):[];
    const orders=friend?list('orders').filter(o=>o.buyerId===friend.id).map(o=>({id:o.id,date:o.date,productName:o.productName,qty:o.qty,total:o.total,status:o.status,deliveryDate:o.deliveryDate})):[];
    return {profile:{name:user.name,email:user.email,phone:user.phone,role:user.role},linked:!!friend,products,sales,orders};
  }
  return {register,create,update,resetPassword,member,policy,publicUser,
    list:actorId=>{admin(actorId);return {users:db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,createdAt DESC`).all(),policy:policy()};},
    setPolicy:(actorId,input)=>atomic(()=>{admin(actorId);need(typeof input.enabled==='boolean','Тохиргоо буруу байна.');put('settings','registrationPolicy',{enabled:input.enabled});audit(actorId,'registrationPolicy','registrationPolicy');return policy();}),
    profile:(userId,input)=>atomic(()=>{const name=short(input.name,100,true),phone=short(input.phone||'',30);db.prepare('UPDATE users SET name=?,phone=?,revision=revision+1 WHERE id=?').run(name,phone,userId);return {user:publicUser(userId)};})
  };
}
