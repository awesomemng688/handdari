export function createFeatures(ctx) {
  const { $, esc, money, count, day, sum, icon, action, heading, panel, table, empty, field, openForm, saveAction, api, toast, requireAdmin, csv, actions } = ctx;
  const getData = ctx.getData;
  const states = { new: 'Шинэ', prepared: 'Бэлтгэсэн', delivered: 'Хүргэсэн', cancelled: 'Цуцлагдсан' };
  const methods = [['cash', 'Бэлэн мөнгө'], ['transfer', 'Шилжүүлэг'], ['card', 'Карт']];
  const paid = s => s.paymentTracking === 'verified' ? s.paid : null;
  const balance = s => s.status === 'confirmed' && paid(s) !== null ? Math.max(0, Math.round((s.total - s.paid) * 100) / 100) : 0;
  const refunds = () => getData().sales.filter(s => s.status === 'cancelled' && s.paymentTracking === 'verified' && s.paid > 0);
  function paymentButtons(s) {
    if (!ctx.ready()) return '';
    if (paid(s) === null) return `<button class="button secondary small" data-action="reconcile:${s.id}">Төлбөр баталгаажуулах</button>`;
    if (balance(s) > 0) return `<button class="button secondary small" data-action="payment:${s.id}">Төлбөр авах</button>`;
    if (s.status === 'cancelled' && s.paid > 0) return `<button class="button secondary small" data-action="refund:${s.id}">Төлбөр буцаах</button>`;
    return '';
  }
  function paymentCell(s) {
    return paid(s) === null ? '<span class="badge gold">Баталгаажаагүй</span>' : `<span>${money(s.paid)}</span><br><small>${s.status === 'cancelled' ? 'Буцаах: ' + money(s.paid) : 'Үлдсэн: ' + money(balance(s))}</small>`;
  }
  function openPayment(id, kind) {
    if (!requireAdmin()) return;
    const s = getData().sales.find(s => s.id === id); if (!s) return;
    const reconcile = kind === 'reconcilePayment', refund = kind === 'refundPayment';
    openForm(reconcile ? 'Хуучин төлбөр баталгаажуулах' : refund ? 'Төлбөр буцаалт бүртгэх' : 'Төлбөр хүлээн авах', [
      field('amount', reconcile ? 'Өмнө нь бодитоор төлсөн нийт дүн ₮' : 'Бодитоор шилжүүлсэн дүн ₮', 'number', reconcile ? 0 : refund ? s.paid : balance(s)),
      field('method', 'Төлбөрийн хэлбэр', 'text', 'transfer', methods), field('date', 'Төлбөрийн огноо', 'date', day()),
      field('note', 'Тэмдэглэл / Баримтын дугаар', 'textarea', '', null, false, true)
    ], b => saveAction(kind, { ...b, saleId: id }), `${s.buyerName} · ${s.productName} · Нийт ${money(s.total)}. ${reconcile ? 'Энэ нь хуучин төлбөрийн эхний үлдэгдэл баталгаажуулалт; өнөөдрийн шинэ орлого гэж үзэхгүй.' : refund ? 'Мөнгийг худалдан авагчид бодитоор буцаасны дараа бүртгэнэ. Банкны шилжүүлэг хийхгүй.' : 'Мөнгийг бодитоор хүлээн авсны дараа бүртгэнэ.'}`);
  }
  function receivables() {
    const d = getData(), owing = d.sales.filter(s => balance(s) > 0), unknown = d.sales.filter(s => paid(s) === null), returning = refunds();
    const groups = new Map();
    for (const s of owing) { const g = groups.get(s.buyerId) || { name: s.buyerName, total: 0, paid: 0, due: 0 }; g.total += s.total; g.paid += s.paid; g.due += balance(s); groups.set(s.buyerId, g); }
    const rows = [...groups.entries()].sort((a,b) => b[1].due-a[1].due);
    return heading('Авлага ба төлбөр', 'Хэн хэдийг төлсөн, хэд үлдсэнийг нэг дороос.') +
      `<div class="stats">${ctx.stat('Нийт авлага', ctx.ready() ? money(owing.reduce((n,s)=>n+balance(s),0)) : '—', 'Зөвхөн баталгаажсан төлбөртэй борлуулалт', 'wallet')}${ctx.stat('Авлагатай найз', ctx.ready() ? count(groups.size) : '—', 'Бүртгэлтэй худалдан авагч', 'friends')}${ctx.stat('Буцаах төлбөр', ctx.ready() ? money(sum(returning,'paid')) : '—', 'Цуцлагдсан борлуулалтын бодит үлдэгдэл', 'sales')}${ctx.stat('Баталгаажуулах', ctx.ready() ? count(unknown.length) : '—', 'Хуучин борлуулалтын төлсөн дүн тодорхойгүй', 'reports')}</div>` +
      panel('Найз тус бүрийн авлага', table(['Найз','Нийт дүн','Төлсөн','Үлдсэн','Түүх'], rows.map(([id,g])=>`<tr><td>${esc(g.name)}</td><td>${money(g.total)}</td><td>${money(g.paid)}</td><td><span class="badge red">${money(g.due)}</span></td><td><button class="button secondary small" data-action="history:${id}">Харах</button></td></tr>`))) +
      `<div class="section-space">${panel('Төлбөр хүлээгдэж буй борлуулалт', table(['Огноо','Найз / Бүтээгдэхүүн','Төлсөн / Үлдсэн','Үйлдэл'], [...owing,...unknown,...returning].map(s=>`<tr><td>${esc(s.date)}</td><td>${esc(s.buyerName)}<br><small>${esc(s.productName)}</small></td><td>${paymentCell(s)}</td><td>${paymentButtons(s)}</td></tr>`)))}</div>` +
      `<div class="section-space">${paymentHistory(d.payments)}</div>`;
  }
  function paymentHistory(rows) {
    const labels = { payment: 'Хүлээн авсан', refund: 'Буцаасан', opening: 'Хуучин төлбөрийн баталгаа' };
    return panel('Төлбөрийн түүх', table(['Огноо','Худалдан авагч','Төрөл','Дүн','Тэмдэглэл'], rows.map(p=>`<tr><td>${esc(p.date)}</td><td>${esc(p.buyerName)}</td><td><span class="badge ${p.type==='refund'?'red':'green'}">${esc(labels[p.type])}</span></td><td>${money(p.amount)}</td><td>${esc(p.note)}</td></tr>`)));
  }
  let historyId = '';
  function history() {
    const d=getData(), f=d.friends.find(f=>f.id===historyId);
    if(!f)return heading('Худалдан авалтын түүх','Найзын жагсаалтаас «Түүх» сонгоно уу.')+empty();
    const sales=d.sales.filter(s=>s.buyerId===f.id), confirmed=sales.filter(s=>s.status==='confirmed'), orders=d.orders.filter(o=>o.buyerId===f.id);
    return heading(esc(`${f.surname} ${f.name}`),'Худалдан авалт, авлага, төлбөр, захиалгын нэгтгэл.','<a class="button secondary" href="#friends">← Найзууд</a>')+
      `<div class="stats">${ctx.stat('Нийт худалдан авалт',money(sum(confirmed,'total')),'Баталгаажсан борлуулалт','sales')}${ctx.stat('Төлсөн дүн',money(sum(confirmed.filter(s=>paid(s)!==null),'paid')),'Төлбөр нь баталгаажсан борлуулалт','wallet')}${ctx.stat('Авлага',money(confirmed.reduce((n,s)=>n+balance(s),0)),'Баталгаажаагүй төлбөр орохгүй','reports')}${ctx.stat('Захиалгын тоо',count(orders.length),'Бүх төлөвийн захиалга','products')}</div>`+
      (sales.some(s=>paid(s)===null)?'<div class="notice">Энэ найзын хуучин төлбөр баталгаажаагүй байна. Төлсөн дүнг авлагын хэсэгт баталгаажуулна уу.</div>':'')+
      panel('Худалдан авалтын түүх',table(['Огноо','Бүтээгдэхүүн','Нийт','Төлсөн / Үлдсэн','Төлөв'],sales.map(s=>`<tr><td>${esc(s.date)}</td><td>${esc(s.productName)} · ${s.qty} ш</td><td>${money(s.total)}</td><td>${paymentCell(s)}</td><td>${s.status==='confirmed'?'Баталгаажсан':'Цуцлагдсан'}</td></tr>`)))+
      `<div class="section-space">${paymentHistory(d.payments.filter(p=>p.buyerId===f.id))}</div>`+
      `<div class="section-space">${panel('Захиалга ба хүргэлт',orderTable(orders))}</div>`;
  }
  function orderTable(rows) {
    return table(['Огноо / Хүргэх','Найз / Утас','Бүтээгдэхүүн','Дүн','Хаяг','Төлөв','Үйлдэл'],rows.map(o=>`<tr><td>${esc(o.date)}<br><small>${esc(o.deliveryDate||'Хугацаа товлоогүй')}</small></td><td>${esc(o.buyerName)}<br><small>${esc(o.phone)}</small></td><td>${esc(o.productName)} · ${o.qty} ш</td><td>${money(o.total)}</td><td class="wrap-cell">${esc(o.address)}</td><td><span class="badge ${o.status==='delivered'?'green':o.status==='cancelled'?'red':'gold'}">${esc(states[o.status])}</span>${o.saleId?'<br><small>Борлуулалттай холбогдсон</small>':''}</td><td>${o.status==='new'?`<button class="button secondary small" data-action="prepare:${o.id}">Бэлтгэсэн</button>`:o.status==='prepared'?`<button class="button small" data-action="deliver:${o.id}">Хүргэсэн</button>`:''} ${['new','prepared'].includes(o.status)?`<button class="button ghost small" data-action="cancelOrder:${o.id}">Цуцлах</button>`:''}</td></tr>`));
  }
  let orderFilter='';
  function orders() {
    return heading('Захиалга ба хүргэлт','Шинэ → Бэлтгэсэн → Хүргэсэн. Хүргэх үед борлуулалт, үлдэгдэл хамт хадгалагдана.',action('order','Захиалга'))+
      `<div class="toolbar"><label>Төлөв<select id="orderFilter"><option value="">Бүх төлөв</option>${Object.entries(states).map(([v,l])=>`<option value="${v}" ${orderFilter===v?'selected':''}>${l}</option>`).join('')}</select></label><span class="spacer"></span>${action('exportOrders','Захиалга CSV','secondary','down')}</div>`+
      '<div class="notice neutral">Шинэ болон бэлтгэсэн захиалга нөөцийг захиалж түгжихгүй. «Хүргэсэн» болгож батлахад хүрэлцэх нөөцийг шалган хасаж, борлуулалт үүсгэнэ.</div>'+
      panel('Захиалгууд',orderTable(getData().orders.filter(o=>!orderFilter||o.status===orderFilter)));
  }
  function orderForm() {
    if(!requireAdmin())return;
    const d=getData(),products=d.products.filter(p=>p.status==='active');
    if(!d.friends.length||!products.length)return toast('Эхлээд найз болон бүтээгдэхүүн нэмнэ үү.');
    const f=d.friends[0],p=products[0];
    openForm('Шинэ захиалга',[
      field('buyerId','Найз','text',f.id,d.friends.map(f=>[f.id,`${f.surname} ${f.name}`])),field('productId','Бүтээгдэхүүн','text',p.id,products.map(p=>[p.id,p.name])),
      field('qty','Тоо ширхэг','number',1),field('price','Нэгжийн үнэ ₮','number',p.price),field('phone','Холбогдох утас','tel',f.phone||'',null,false),field('date','Захиалгын огноо','date',day()),
      field('deliveryDate','Хүргэх огноо','date','',null,false),field('address','Хүргэлтийн хаяг','textarea',f.address||'',null,true,true),field('note','Тэмдэглэл','textarea','',null,false,true)
    ],b=>saveAction('order',b));
    $('#form').elements.buyerId.addEventListener('change',()=>{const f=getData().friends.find(f=>f.id===$('#form').elements.buyerId.value);$('#form').elements.phone.value=f.phone||'';$('#form').elements.address.value=f.address||'';});
    $('#form').elements.productId.addEventListener('change',()=>$('#form').elements.price.value=getData().products.find(p=>p.id===$('#form').elements.productId.value).price);
  }
  function changeOrder(id,status) {
    if(!requireAdmin())return;const o=getData().orders.find(o=>o.id===id);if(!o)return;
    const delivered=status==='delivered';
    openForm(delivered?'Хүргэлт, борлуулалт баталгаажуулах':status==='prepared'?'Захиалга бэлтгэсэн':'Захиалга цуцлах',delivered?[
      field('paid','Бодитоор төлсөн дүн ₮','number',o.total),field('extra','Холбогдох зардал ₮','number',0),field('payment','Төлбөрийн хэлбэр','text','transfer',methods),field('date','Борлуулалт / Хүргэлтийн огноо','date',day())
    ]:[],b=>saveAction('orderStatus',{...b,id,expectedStatus:o.status,status}),`${o.buyerName} · ${o.productName} · ${o.qty} ш · ${money(o.total)}. ${delivered?'Нөөц хасагдаж, борлуулалт болон төлбөр давхардахгүйгээр бүртгэгдэнэ.':'Төлөвийг өөрчлөхөө баталгаажуулна уу.'}`);
  }
  function notifications() {
    const rows=getData().notifications.filter(n=>!n.resolvedAt);
    return heading('Нөөцийн мэдэгдэл','Анхааруулах хэмжээнд хүрсэн бүтээгдэхүүнүүд.')+
      panel('Идэвхтэй мэдэгдлүүд',rows.length?`<div class="panel-body alert-list">${rows.map(n=>`<article class="stock-notification"><span class="stat-icon">${icon('inventory')}</span><div><strong>${esc(n.productName)}</strong><p>Үлдэгдэл ${n.stock} ш · Анхааруулах хэмжээ ${n.threshold} ш</p><small>${esc(day(new Date(n.createdAt)))}</small></div>${n.readAt?'<span class="badge">Уншсан</span>':`<button class="button secondary small" data-action="readAlert:${n.id}">Уншсан</button>`}</article>`).join('')}</div>`:empty(ctx.ready()?'Нөөцийн идэвхтэй анхааруулга алга.':'Эхлээд нэвтэрнэ үү.'))+
      '<div class="notice neutral section-space">Мэдэгдэл апп дотор хадгалагдана. Нөөц нэмэгдэхэд анхааруулга автоматаар хаагдана. Апп хаалттай үед push/SMS илгээхгүй.</div>';
  }
  function backupStatus() {
    const status=getData().settings.find(s=>s.id==='backupStatus');
    const labels={'remote-success':'Шифрлэж, гаднын серверт хуулсан','local-only':'Локал нөөц бэлэн · Гаднын сервер тохируулаагүй',failed:'Сүүлийн нөөцлөлт амжилтгүй'};
    return panel('Автомат нөөцлөлтийн төлөв',`<div class="panel-body copy">${status?`<span class="badge ${status.status==='remote-success'?'green':status.status==='failed'?'red':'gold'}">${esc(labels[status.status]||status.status)}</span><h3>Сүүлийн оролдлого</h3><p>${esc(new Date(status.startedAt).toLocaleString('sv-SE',{timeZone:'Asia/Ulaanbaatar'}))} · Улаанбаатар</p><p>Локал: ${status.localComplete?'Бэлэн':'Амжилтгүй'} · Гаднын хуулалт: ${status.remoteComplete?'Бэлэн':'Хийгдээгүй'}</p>${status.error?`<p>${esc(status.error)}</p>`:''}`:'<p>Нөөцлөлт ажилласан бүртгэл хараахан алга. Ubuntu дээр өдөр тутмын timer болон SSH хадгалалтын хаягийг тохируулсны дараа төлөв энд харагдана.</p>'}<p class="attachment-note">Өдөр тутмын Ubuntu хуваарь: 03:00–03:05, Улаанбаатар. Шифрлэсэн нөөцөд байршуулсан бүтээгдэхүүний зургууд хамт орно.</p></div>`);
  }
  let selectedPhoto=null, photoPending=null, photoGeneration=0;
  function productUpload(p) {
    selectedPhoto=null;photoPending=null;photoGeneration++;
    const box=document.createElement('div');box.className='wide photo-upload';
    box.innerHTML=`<div class="photo-controls"><label class="button secondary">Камераар авах<input id="cameraPhoto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden></label><label class="button secondary">Зураг сонгох<input id="galleryPhoto" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><button type="button" id="clearPhoto" class="button ghost">Сонголт болих</button></div><img id="photoPreview" alt="Сонгосон бүтээгдэхүүний зураг" ${p.image?`src="${esc(p.image)}"`:'hidden'}><p id="photoStatus" class="form-help">Зураг сонговол 1600px хүртэл багасгаж хадгална. Камер болон зургийн сангаас сонгож болно.</p>`;
    $('#fields').append(box);
    const choose=e=>{
      const file=e.target.files[0];if(!file)return;
      const current=++photoGeneration;
      photoPending=(async()=>{
        selectedPhoto=null;$('#photoStatus').textContent='Зургийг бэлдэж байна…';
        if(file.size>20*1024*1024)throw new Error('Эх зураг 20 MB-аас бага байна.');
        if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPG, PNG эсвэл WebP зураг сонгоно уу.');
        const image=await createImageBitmap(file);
        const scale=Math.min(1,1600/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
        const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);image.close();
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));if(!blob)throw new Error('Зургийг боловсруулж чадсангүй.');
        if(current!==photoGeneration||!$('#modal').open)return;
        selectedPhoto={blob,url:null};$('#photoPreview').src=canvas.toDataURL('image/jpeg',.85);$('#photoPreview').hidden=false;$('#photoStatus').textContent=`Бэлэн · ${canvas.width}×${canvas.height} · ${Math.ceil(blob.size/1024)} KB. Хадгалах үед серверт байршуулна.`;
      })().catch(e=>{if(current===photoGeneration&&$('#photoStatus')){selectedPhoto=null;$('#photoStatus').textContent=e.message;}throw e;});
      photoPending.catch(()=>{});
    };
    $('#cameraPhoto').onchange=choose;$('#galleryPhoto').onchange=choose;
    $('#clearPhoto').onclick=()=>{photoGeneration++;selectedPhoto=null;photoPending=null;$('#cameraPhoto').value='';$('#galleryPhoto').value='';$('#photoPreview').hidden=!p.image;if(p.image)$('#photoPreview').src=p.image;$('#photoStatus').textContent='Зургийн шинэ сонголтыг цуцаллаа.';};
  }
  async function uploadSelectedImage(original) {
    if(photoPending)await photoPending;
    if(!selectedPhoto)return original;
    if(!selectedPhoto.url){const response=await fetch('/api/images',{method:'POST',credentials:'same-origin',headers:{'Content-Type':selectedPhoto.blob.type},body:selectedPhoto.blob});const result=await response.json();if(!response.ok)throw new Error(result.error||'Зураг хадгалагдсангүй.');selectedPhoto.url=result.url;}
    return selectedPhoto.url;
  }
  Object.assign(actions,{
    order:orderForm,
    exportOrders:()=>csv('захиалга',['Огноо','Хүргэх','Найз','Утас','Хаяг','Бүтээгдэхүүн','Тоо','Дүн','Төлөв'],getData().orders.map(o=>[o.date,o.deliveryDate,o.buyerName,o.phone,o.address,o.productName,o.qty,o.total,states[o.status]]))
  });
  async function dispatch(kind){
    const [name,id]=kind.split(':');
    if(name==='payment')return openPayment(id,'payment');
    if(name==='refund')return openPayment(id,'refundPayment');
    if(name==='reconcile')return openPayment(id,'reconcilePayment');
    if(name==='history'){if(requireAdmin()){historyId=id;location.hash='history';ctx.render();}return;}
    if(name==='prepare')return changeOrder(id,'prepared');
    if(name==='deliver')return changeOrder(id,'delivered');
    if(name==='cancelOrder')return changeOrder(id,'cancelled');
    if(name==='readAlert'){if(requireAdmin()){await api('action/ackNotification',{id,operationId:crypto.randomUUID()});await ctx.refresh();}return;}
  }
  document.addEventListener('change',e=>{if(e.target.id==='orderFilter'){orderFilter=e.target.value;ctx.render();}});
  return {pages:{receivables,orders,notifications,history},paymentCell,paymentButtons,backupStatus,productUpload,uploadSelectedImage,dispatch,balance};
}
