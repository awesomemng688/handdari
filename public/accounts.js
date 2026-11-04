export function createAccountUI(ctx) {
  const { $, esc, money, day, count, sum, heading, panel, table, empty, stat, field, openForm, api, toast, actions }=ctx;
  const roles={admin:'Админ',customer:'Хэрэглэгч найз',developer:'Хөгжүүлэгч найз'};
  const statuses={pending:'Зөвшөөрөл хүлээж буй',active:'Идэвхтэй',suspended:'Түгжсэн'};
  let users=[],member=null,registrationEnabled=true,search='',statusFilter='';
  const memberTable=(headers,rows)=>rows.length?table(headers,rows):empty('Одоогоор бүртгэл алга.');
  function register() {
    if(!registrationEnabled)return heading('Бүртгүүлэх','HANDARI-ийн найзуудын хүрээлэл.')+'<div class="notice">Шинэ бүртгэл түр хаалттай байна. Админтай холбогдоно уу.</div><a class="button" href="#login">Нэвтрэх</a>';
    return `<section class="registration-shell"><div class="registration-intro"><span class="eyebrow">HANDARI BRAND · ХАМТДАА ӨСЬЕ</span><h1>Таны шинэ<br>боломж эндээс.</h1><p>Найзуудынхаа хүрээлэлд нэгдэж,<br>үнэ цэнийг хамтдаа бүтээгээрэй.</p><div class="registration-steps"><span>01 &nbsp; Бүртгэлээ илгээх</span><span>02 &nbsp; Админы зөвшөөрөл</span><span>03 &nbsp; Миний HANDARI-д нэвтрэх</span></div><div class="registration-mark" aria-hidden="true">H✧</div></div><div class="registration-form"><span class="eyebrow">ТАВТАЙ МОРИЛ</span><h2>Шинэ бүртгэл</h2><p class="subtitle">Хэдхэн алхам, шинэ эхлэл.</p><form id="registerForm"><div class="form-grid"><label class="field wide"><span>Нэр *</span><input name="name" required maxlength="100" autocomplete="name" placeholder="Таны нэр"></label><label class="field wide"><span>Имэйл *</span><input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="name@example.com"></label><label class="field"><span>Утас</span><input type="tel" name="phone" maxlength="30" autocomplete="tel" placeholder="Утасны дугаар"></label><label class="field"><span>Найзын төрөл *</span><select name="requestedRole"><option value="customer">Хэрэглэгч найз</option><option value="developer">Хөгжүүлэгч найз</option></select></label><label class="field wide"><span>Нууц үг — 12+ тэмдэгт *</span><input type="password" name="password" minlength="12" maxlength="256" autocomplete="new-password" required></label><label class="field wide"><span>Нууц үг давтах *</span><input type="password" name="confirmPassword" minlength="12" maxlength="256" autocomplete="new-password" required></label><label class="honeypot" aria-hidden="true">Вебсайт<input name="website" tabindex="-1" autocomplete="off"></label><label class="consent wide"><input type="checkbox" name="consent" required><span>Бүртгэл админы зөвшөөрлөөр идэвхжихийг ойлгож, нэр, имэйл, утсаа бүртгүүлэхийг зөвшөөрч байна.</span></label><p id="registerError" class="error wide" role="alert"></p><button class="button wide" type="submit">Бүртгэлийн хүсэлт илгээх →</button><p class="registration-login wide">Бүртгэлтэй юу? <a href="#login">Нэвтрэх</a></p></div></form><div id="registrationSuccess" hidden role="status"></div></div></section>`;
  }
  function adminPage() {
    if(ctx.getUser()?.role!=='admin')return heading('Админ самбар','Энэ хэсгийг зөвхөн админ ашиглана.');
    if(!ctx.ready())return heading('Админ самбар','Хэрэглэгчдийн мэдээлэл ачаалагдаж байна…');
    const rows=users.filter(u=>(u.name+' '+u.email+' '+u.phone).toLowerCase().includes(search.toLowerCase())&&(!statusFilter||u.status===statusFilter));
    return heading('Админ самбар','Хэрэглэгчид, бүртгэлийн хүсэлт, эрхийн удирдлага.','<button class="button" data-action="createAccount">＋ Хэрэглэгч үүсгэх</button>')+
      `<div class="stats">${stat('Нийт хэрэглэгч',count(users.length),'Бүх бүртгэл','friends')}${stat('Хүлээгдэж буй',count(users.filter(u=>u.status==='pending').length),'Таны зөвшөөрлийг хүлээж байна','reports')}${stat('Идэвхтэй',count(users.filter(u=>u.status==='active').length),'Зөвшөөрөгдсөн хэрэглэгчид','leaf')}${stat('Админ',count(users.filter(u=>u.role==='admin'&&u.status==='active').length),'Идэвхтэй удирдлагын эрх','settings')}</div>`+
      `<div class="notice ${registrationEnabled?'neutral':''}"><span>Олон нийтэд нээлттэй бүртгэл: <strong>${registrationEnabled?'Нээлттэй':'Хаалттай'}</strong> · Шинэ хүсэлтүүд админаар батлагдана.</span><button class="button secondary small" data-action="toggleRegistration">${registrationEnabled?'Бүртгэл хаах':'Бүртгэл нээх'}</button></div>`+
      `<div class="toolbar"><input id="accountSearch" aria-label="Хэрэглэгч хайх" value="${esc(search)}" placeholder="Нэр, имэйл, утсаар хайх…"><select id="accountStatus" aria-label="Хэрэглэгчийн төлөв"><option value="">Бүх төлөв</option>${Object.entries(statuses).map(([v,l])=>`<option value="${v}" ${statusFilter===v?'selected':''}>${l}</option>`).join('')}</select></div>`+
      panel('Хэрэглэгчдийн удирдлага',table(['Нэр / Имэйл','Эрх / Хүсэлт','Төлөв','Холбоотой найз','Сүүлд нэвтэрсэн','Үйлдэл'],rows.map(u=>`<tr><td>${esc(u.name)}<br><small>${esc(u.email)}</small><br><small>${esc(u.phone)}</small></td><td>${esc(roles[u.role])}${u.status==='pending'?`<br><small>Хүсэлт: ${esc(roles[u.requestedRole])}</small>`:''}</td><td><span class="badge ${u.status==='active'?'green':u.status==='pending'?'gold':'red'}">${esc(statuses[u.status])}</span>${u.mustChangePassword?'<br><small>Нууц үг шинэчлэх шаардлагатай</small>':''}</td><td>${esc(ctx.getData().friends.find(f=>f.id===u.friendId)?.name||'Холбоогүй')}</td><td>${esc(u.lastLoginAt?day(new Date(u.lastLoginAt)):'—')}</td><td><button class="button secondary small" data-action="editAccount:${u.id}">${u.status==='pending'?'Хянах / Батлах':'Удирдах'}</button> ${u.id!==ctx.getUser().id?`<button class="button ghost small" data-action="resetAccount:${u.id}">Нууц үг</button>`:''}</td></tr>`)));
  }
  async function adminSave(path,body) {
    await api('admin/'+path,body);$('#modal').close();toast('Хэрэглэгчийн бүртгэлийг шинэчиллээ.');await ctx.refresh();
  }
  function editAccount(id) {
    if(!ctx.requireAdmin())return;const u=users.find(u=>u.id===id);if(!u)return;
    openForm('Хэрэглэгчийн эрх, төлөв',[
      field('name','Нэр','text',u.name),field('email','Имэйл','email',u.email),field('phone','Утас','tel',u.phone,null,false),
      field('role','Эрх','text',u.status==='pending'?u.requestedRole:u.role,Object.entries(roles)),field('status','Төлөв','text',u.status==='pending'?'active':u.status,Object.entries(statuses)),
      field('friendId','Өмнөх найзын бүртгэлтэй холбох','text',u.friendId,[['','Холбоогүй'],...ctx.getData().friends.map(f=>[f.id,`${f.surname} ${f.name} · ${f.phone||'Утасгүй'}`])],false,true),
      field('currentPassword','Админ эрх / админы төлөв өөрчилбөл таны одоогийн нууц үг','password','',null,false,true)
    ],b=>adminSave('users/update',{...b,id,revision:u.revision}),'Найзтай холбох нь хэрэглэгчид тэр найзын худалдан авалтын түүхийг харуулах эрх өгнө. Хэн болохыг нь шалгаж холбогоорой. Хадгалахад тухайн хэрэглэгчийн хуучин нэвтрэлт хүчингүй болно.');
  }
  function createAccount() {
    if(!ctx.requireAdmin())return;
    openForm('Хэрэглэгч үүсгэх',[
      field('name','Нэр'),field('email','Имэйл','email'),field('phone','Утас','tel','',null,false),field('role','Эрх','text','customer',Object.entries(roles)),
      field('password','Анхны нууц үг — 12+ тэмдэгт','password','',null,true,true),field('currentPassword','Шинэ админ үүсгэх бол таны одоогийн нууц үг','password','',null,false,true)
    ],b=>adminSave('users/create',b),'Анхны нууц үгийг хэрэглэгчид аюулгүйгээр өөрөө дамжуулна. Имэйл автоматаар илгээхгүй. Эхний нэвтрэлтээр нууц үгээ заавал солино.');
  }
  function resetAccount(id) {
    if(!ctx.requireAdmin())return;const u=users.find(u=>u.id===id);if(!u)return;
    openForm('Нууц үг шинэчлэх',[
      field('password','Шинэ анхны нууц үг — 12+ тэмдэгт','password','',null,true,true),field('currentPassword','Таны админ нууц үг','password','',null,true,true)
    ],b=>adminSave('users/password',{...b,id,revision:u.revision}),`${u.name} · ${u.email}. Бүх хуучин session хүчингүй болж, хэрэглэгч дараагийн нэвтрэлтээр нууц үгээ солино.`);
  }
  function memberHome() {
    const u=ctx.getUser();
    if(!u)return heading('Миний HANDARI','Нэвтэрч өөрийн мэдээллээ хараарай.','<a class="button" href="#login">Нэвтрэх</a>');
    if(u.mustChangePassword)return heading('Нууц үгээ шинэчилнэ үү','Анхны нэвтрэлтийн нууц үгийг өөрийн нууц үгээр солино.')+panel('Таны бүртгэлийн хамгаалалт','<div class="panel-body copy"><p>Админаас өгсөн анхны нууц үгээ шинэчилсний дараа дахин нэвтэрнэ үү.</p><button class="button" data-action="password">Нууц үг шинэчлэх</button> <button class="button secondary" data-action="logout">Гарах</button></div>');
    if(!member)return heading('Миний HANDARI','Таны мэдээлэл хараахан ачаалагдаагүй байна.');
    const sales=(member?.sales||[]).filter(s=>s.status==='confirmed');
    return heading('Сайн байна уу, '+esc(u.name),'Таны HANDARI · Хувийн мэдээлэл, худалдан авалт, каталог.')+
      `<section class="hero"><div class="hero-copy"><span class="eyebrow">HANDARI BRAND · ТАВТАЙ МОРИЛ</span><h2>Итгэлээр холбогдож,<br>хамтдаа урагшилъя.</h2><p>${esc(roles[u.role])} · ${esc(u.email)}</p></div><div class="hero-seal" aria-hidden="true">H✧</div></section>`+
      `<div class="stats">${stat('Миний худалдан авалт',money(sum(sales,'total')),'Зөвхөн тантай холбоотой бүртгэл','sales')}${stat('Миний авлага',money(sales.reduce((n,s)=>n+(s.paid===null?0:Math.max(0,s.total-s.paid)),0)),'Төлбөр баталгаажсан бүртгэл','wallet')}${stat('Миний захиалга',count(member?.orders?.length||0),'Таны захиалгууд','products')}${stat('Каталог',count(member?.products?.length||0),'Админы зөвшөөрсөн бүтээгдэхүүн','leaf')}</div>`+
      (!member?.linked?'<div class="notice">Таны данс өмнөх найзын бүртгэлтэй холбогдоогүй байна. Худалдан авалтын түүхээ харахын тулд админтай холбогдоно уу.</div>':'')+
      `<div class="member-links"><a class="button" href="#memberCatalog">Каталог үзэх →</a><a class="button secondary" href="#memberHistory">Миний худалдан авалт</a><button class="button secondary" data-action="editProfile">Мэдээлэл засах</button><button class="button secondary" data-action="password">Нууц үг солих</button><button class="button ghost" data-action="logout">Гарах</button></div>`;
  }
  function catalog() {
    const rows=member?.products||[];
    return heading('Бүтээгдэхүүний каталог','Танд зориулж нийтэлсэн бүтээгдэхүүнүүд.')+(rows.length?`<div class="product-grid">${rows.map(p=>`<article class="product-card"><div class="product-image">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`:'◇'}</div><span class="badge">${esc(p.category)}</span><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="product-bottom"><strong>${money(p.price)}</strong><span class="badge ${p.available?'green':'gold'}">${p.available?'Бэлэн байгаа':'Нөөцгүй'}</span></div></article>`).join('')}</div>`:panel('Каталог',empty('Одоогоор нийтэлсэн бүтээгдэхүүн алга.')));
  }
  function memberHistory() {
    return heading('Миний худалдан авалт','Зөвхөн таны бүртгэлтэй холбоотой мэдээлэл.')+
      panel('Борлуулалт',memberTable(['Огноо','Бүтээгдэхүүн','Тоо','Нийт','Төлсөн / Үлдсэн','Төлөв'],(member?.sales||[]).map(s=>`<tr><td>${esc(s.date)}</td><td>${esc(s.productName)}</td><td>${s.qty}</td><td>${money(s.total)}</td><td>${s.paid===null?'Баталгаажаагүй':money(s.paid)+' / '+money(s.status==='confirmed'?Math.max(0,s.total-s.paid):0)}</td><td>${s.status==='confirmed'?'Баталгаажсан':'Цуцлагдсан'}</td></tr>`)))+
      `<div class="section-space">${panel('Миний захиалга',memberTable(['Огноо','Бүтээгдэхүүн','Тоо','Нийт','Төлөв'],(member?.orders||[]).map(o=>`<tr><td>${esc(o.date)}</td><td>${esc(o.productName)}</td><td>${o.qty}</td><td>${money(o.total)}</td><td>${esc({new:'Шинэ',prepared:'Бэлтгэсэн',delivered:'Хүргэсэн',cancelled:'Цуцлагдсан'}[o.status])}</td></tr>`)))}</div>`;
  }
  Object.assign(actions,{createAccount,toggleRegistration:()=>{if(!ctx.requireAdmin())return;openForm(registrationEnabled?'Шинэ бүртгэл хаах':'Шинэ бүртгэл нээх',[],b=>adminSave('registration',{enabled:!registrationEnabled}),'Одоо байгаа хэрэглэгчдийн нэвтрэлтэд нөлөөлөхгүй.');},editProfile:()=>{const u=ctx.getUser();if(!u)return;openForm('Миний мэдээлэл',[field('name','Нэр','text',u.name),field('phone','Утас','tel',u.phone||'',null,false)],async b=>{const result=await api('profile',b);ctx.setUser(result.user);$('#modal').close();toast('Мэдээлэл шинэчлэгдлээ.');await ctx.refresh();});}});
  document.addEventListener('submit',async event=>{
    if(event.target.id!=='registerForm')return;event.preventDefault();const form=event.target,button=form.querySelector('button[type=submit]');if(button.disabled)return;button.disabled=true;button.textContent='Илгээж байна…';$('#registerError').textContent='';
    try{const result=await api('register',Object.fromEntries(new FormData(form)));form.reset();form.hidden=true;$('#registrationSuccess').hidden=false;$('#registrationSuccess').innerHTML=`<div class="registration-success-mark">✓</div><h3>Хүсэлт илгээгдлээ</h3><p>${esc(result.message)}</p><a class="button" href="#login">Нэвтрэх хуудас →</a>`;}
    catch(e){$('#registerError').textContent=e.message;}finally{button.disabled=false;button.textContent='Бүртгэлийн хүсэлт илгээх →';}
  });
  document.addEventListener('input',e=>{if(e.target.id==='accountSearch'){const position=e.target.selectionStart;search=e.target.value;ctx.render();$('#accountSearch').focus();$('#accountSearch').setSelectionRange(position,position);}});
  document.addEventListener('change',e=>{if(e.target.id==='accountStatus'){statusFilter=e.target.value;ctx.render();}});
  return {pages:{register,admin:adminPage,member:memberHome,memberCatalog:catalog,memberHistory},
    dispatch:kind=>{const [name,id]=kind.split(':');if(name==='editAccount'){editAccount(id);return true;}if(name==='resetAccount'){resetAccount(id);return true;}return false;},
    setAdmin:result=>{users=result.users;registrationEnabled=result.policy.enabled;},setMember:result=>{member=result;},setPolicy:result=>registrationEnabled=result.enabled,
    reset:()=>{users=[];member=null;search='';statusFilter='';},memberHome};
}
