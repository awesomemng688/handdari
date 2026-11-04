import { createFeatures } from './features.js';
import { createAccountUI } from './accounts.js';
import { createGoogleUI } from './google.js';
import { createRecoveryUI } from './recovery.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = value => value === null ? '—' : new Intl.NumberFormat('mn-MN', { maximumFractionDigits: 0 }).format(value) + ' ₮';
const count = value => value === null ? '—' : new Intl.NumberFormat('mn-MN').format(value);
const day = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);
const paths = {
  home: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  friends: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2"/>',
  products: '<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10L3 7m9 5 9-5m-9 5v10M7 4.8l9 5"/>',
  sales: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h3M15 15h1"/>',
  inventory: '<path d="M3 21V9l9-6 9 6v12M3 10h18M7 21v-7h10v7M3 21h18"/>',
  reports: '<path d="M4 3v18h17M8 16v-4M13 16V8M18 16V5"/>',
  facebook: '<path d="M15 3h-3a4 4 0 0 0-4 4v14m-4-10h12l-1 4H4m4-4h6V7h3V3"/>',
  settings: '<path d="m9 3-1 3-3 1v4l2 1v2l-2 1v4l3 1 1 2h6l1-2 3-1v-4l-2-1v-2l2-1V7l-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', arrow: '<path d="M5 19 19 5M6 5h13v13"/>',
  down: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>', leaf: '<path d="M20 3C10 2 3 6 4 13c1 8 16 10 16-10ZM4 21l12-13"/>',
  wallet: '<path d="M3 7V5a2 2 0 0 1 2-2h13v4M3 7h17v14H3V7Zm17 5h-5v5h5"/>',
  tree: '<path d="M12 3v7M5 21v-5h14v5M12 16v-6M4 3h16v7H4ZM2 21h6m1 0h6m1 0h6"/>',
  star: '<path d="m12 3 2.6 5.9L21 10l-4.6 4.5 1 6.5L12 18l-5.4 3 1-6.5L3 10l6.4-1.1Z"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.products}</svg>`;
const menus = [['home', 'Нүүр'], ['friends', 'Найзууд'], ['products', 'Бүтээгдэхүүн'], ['sales', 'Борлуулалт'], ['inventory', 'Бараа материал'], ['reports', 'Тайлан'], ['facebook', 'Facebook & QR'], ['settings', 'Миний булан']];
menus.splice(4, 0, ['receivables', 'Авлага, төлбөр'], ['orders', 'Захиалга, хүргэлт']);
menus.splice(menus.length-1, 0, ['notifications', 'Нөөцийн мэдэгдэл']);
menus.push(['admin', 'Админ самбар']);
paths.admin = paths.settings; paths.register = paths.friends; paths.member = paths.home; paths.memberCatalog = paths.products; paths.memberHistory = paths.sales;
paths.receivables = paths.wallet; paths.orders = paths.sales; paths.notifications = paths.inventory;
const types = { customer: 'Хэрэглэгч найз', developer: 'Хөгжүүлэгч найз' };
const categories = ['Гоо сайхан', 'Арьс арчилгаа', 'Үс арчилгаа', 'Амны хөндийн арчилгаа', 'Гэр ахуй', 'Хүнсний бүтээгдэхүүн', 'Эрүүл мэндийн нэмэлт бүтээгдэхүүн', 'Бусад'];
const payments = { cash: 'Бэлэн мөнгө', transfer: 'Шилжүүлэг', card: 'Карт' };
const movements = { receive: 'Хүлээн авалт', count: 'Тооллого', sale: 'Борлуулалт', cancel: 'Цуцлалт' };
const actionLabels = { friend: 'Найз бүртгэсэн / зассан', product: 'Бүтээгдэхүүн бүртгэсэн / зассан', sale: 'Борлуулалт бүртгэсэн', inventory: 'Барааны хөдөлгөөн', cancelSale: 'Борлуулалт цуцалсан', expense: 'Зарлага бүртгэсэн', deleteFriend: 'Найзын бүртгэл устгасан', importLegacy: 'Хуучин мэдээлэл импортолсон' };
const blank = () => ({ friends: [], products: [], sales: [], inventoryMovements: [], expenses: [], audit: [], legacySales: [], payments: [], orders: [], notifications: [], settings: [] });
let user = null, data = blank(), loaded = false, loading = false, error = '', generation = 0, booting = true;
let search = '', category = '', friendView = 'list', period = 'month', fromDate = '', toDate = '', working = false, saveForm = null;
const page = () => location.hash.slice(1).split('?')[0] || 'home';
const ready = () => user?.role === 'admin' && loaded;
const activeSales = () => data.sales.filter(s => s.status === 'confirmed');
const action = (kind, label, style = '', symbol = 'plus') => `<button class="button ${style}" data-action="${kind}">${icon(symbol)}${label}</button>`;
const heading = (title, sub, buttons = '') => `<div class="page-heading"><div><h1>${title}</h1><p class="subtitle">${sub}</p></div><div class="heading-buttons">${buttons}</div></div>`;
const empty = (message = 'Одоогоор бүртгэл алга.') => `<div class="empty"><span class="empty-icon">◇</span>${esc(message)}</div>`;
const panel = (title, content, extra = '') => `<section class="panel"><div class="panel-heading"><h2>${title}</h2>${extra}</div>${content}</section>`;
function table(headers, rows) {
  return rows.length ? `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : empty(ready() ? 'Одоогоор бүртгэл алга.' : 'Мэдээлэл үзэхийн тулд админаар нэвтэрнэ үү.');
}
function stat(label, value, note, symbol = 'products', style = '') {
  return `<div class="stat ${style}"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon(symbol)}</span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div>`;
}
function toast(message) {
  $('#toast').textContent = message; $('#toast').hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').hidden = true, 4500);
}
async function api(path, body) {
  let response, json;
  try { response = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Сервертэй холбогдож чадсангүй. Холболтоо шалгаад дахин оролдоно уу.'); }
  try { json = await response.json(); } catch { throw new Error('Серверээс зөв хариу ирсэнгүй. Серверийн тохиргоог шалгана уу.'); }
  if (!response.ok) {
    if (response.status === 401 && path !== 'login' && path !== 'register') { generation++; user = null; data = blank(); loaded = false; loading = false; error = ''; accountUI.reset(); render(); }
    throw new Error(json.error || 'Хүсэлт амжилтгүй боллоо.');
  }
  return json;
}
async function refresh() {
  if (!user) return;
  const current = ++generation; loading = true; error = ''; render();
  try {
    const identity=await api('me'); if(current!==generation)return;user=identity.user;
    if(user.mustChangePassword){data=blank();accountUI.reset();loaded=false;return;}
    if(user.role==='admin'){
      const [result,accounts]=await Promise.all([api('data'),api('admin/users')]);if(current!==generation)return;data=result;accountUI.setAdmin(accounts);
    } else {const result=await api('member');if(current!==generation)return;data=blank();accountUI.setMember(result);}
    loaded = true;
  }
  catch (e) { if (current !== generation) return; data = blank(); accountUI.reset(); loaded = false; error = e.message; }
  finally { if (current === generation) { loading = false; render(); } }
}
function requireAdmin() {
  if (ready()) return true;
  if (!user) { location.hash = 'login'; toast('Эхлээд нэвтэрнэ үү.'); }
  else toast('Админы эрх болон серверийн холболт шаардлагатай.');
  return false;
}
function saleRows(sales, buttons = true) {
  return sales.map(s => `<tr><td>${esc(s.date)}</td><td>${esc(s.productName)}<br><small>${esc(s.buyerName)}</small></td><td>${s.qty}</td><td>${money(s.total)}${buttons ? '<br>' + feature.paymentCell(s) : ''}</td><td><span class="badge ${s.status === 'confirmed' ? 'green' : 'red'}">${s.status === 'confirmed' ? 'Баталгаажсан' : 'Цуцлагдсан'}</span></td>${buttons ? `<td>${feature.paymentButtons(s)} ${s.status === 'confirmed' ? `<button class="button secondary small" data-cancel-sale="${s.id}">Цуцлах</button>` : ''}</td>` : ''}</tr>`);
}
function home() {
  if(user && (user.role!=='admin' || user.mustChangePassword))return accountUI.memberHome();
  const sales = activeSales(), revenue = sum(sales, 'total'), cost = sum(sales, 'costTotal'), expenses = sum(data.expenses, 'amount') + sum(sales, 'extra');
  const metric = n => ready() ? money(n) : '—';
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 6 + i); return day(d); });
  const totals = days.map(d => sum(sales.filter(s => s.date === d), 'total')), max = Math.max(1, ...totals);
  return heading(`Сайн байна уу${user ? ', ' + esc(user.name) : ''} <span aria-hidden="true">☀</span>`, 'Өнөөдрийн жижиг алхам — маргаашийн том амжилт.', action('sale', 'Борлуулалт бүртгэх')) +
    `<section class="hero"><div class="hero-copy"><span class="eyebrow">HANDARI BRAND · ХАМТДАА ӨСӨХ ОРОН ЗАЙ</span><h2>Итгэлээр холбогдож,<br>үнэ цэнийг бүтээе.</h2><p>Найзууд, борлуулалт, бизнесийн тань бүх мэдээлэл нэг дор.</p><div class="hero-footer"><span><i class="dot"></i> Найз бүр үнэ цэнтэй</span><span><i class="dot"></i> Алхам бүр урагшаа</span></div></div><div class="hero-seal" aria-hidden="true">H<span>✧</span></div></section>` +
    `<div class="stats">${stat('Өнөөдрийн борлуулалт', metric(sum(sales.filter(s => s.date === day()), 'total')), 'Улаанбаатарын цагаар', 'arrow')}${stat('Нийт орлого', metric(revenue), 'Баталгаажсан борлуулалтын дүн', 'wallet')}${stat('Нийт зарлага', metric(cost + expenses), 'Борлуулсан барааны өртөг + зардал', 'sales')}${stat('Нийт ашиг', metric(revenue - cost - expenses), 'Орлого − өртөг − нэмэлт зардал', 'leaf', 'profit')}</div>` +
    `<div class="grid-two">${panel('Борлуулалтын тойм', `<div class="panel-body"><div class="chart-meta"><strong>${metric(sum(totals.map(total => ({ total })), 'total'))}</strong><span>Борлуулалтын орлого</span></div><div class="chart">${totals.map((n, i) => `<div class="chart-col" title="${days[i]}: ${money(n)}"><div class="bar" data-height="${ready() ? n / max * 100 : 0}"></div></div>`).join('')}</div><div class="chart-labels">${days.map(d => `<span>${d.slice(5).replace('-', '/')}</span>`).join('')}</div><p class="chart-note">${ready() ? 'Зөвхөн баталгаажсан борлуулалт · Цуцлагдсан дүн орохгүй' : 'Бодит өгөгдөл ачаалагдсаны дараа график харагдана'}</p></div>`, '<span class="badge">Сүүлийн 7 хоног</span>')}${panel('Хурдан бүртгэл', `<div class="panel-body">${[['friend', 'friends', 'Шинэ найз нэмэх', 'Харилцааныхаа хүрээг тэлээрэй'], ['sale', 'sales', 'Борлуулалт бүртгэх', 'Өнөөдрийн амжилтаа нэмээрэй'], ['inventory', 'inventory', 'Бараа хүлээн авах', 'Нөөцөө бүрдүүлж, урагшилъя']].map(([id, sym, label, note]) => `<button class="quick" data-action="${id}"><span class="quick-icon">${icon(sym)}</span><span><strong>${label}</strong><small>${note}</small></span><span class="arrow">↗</span></button>`).join('')}</div>`, '<span class="eyebrow">＋</span>')}</div>` +
    `<div class="stats">${stat('Нийт борлуулалт', ready() ? count(sales.length) : '—', 'Баталгаажсан бүртгэлийн тоо', 'sales')}${stat('Барааны үлдэгдэл', ready() ? count(sum(data.products, 'stock')) + ' ш' : '—', 'Нөөцийн үнэлгээ: ' + metric(data.products.reduce((n, p) => n + p.stock * p.cost, 0)), 'inventory')}${stat('Хэрэглэгч найз', ready() ? count(data.friends.filter(f => f.type === 'customer').length) : '—', 'Таны итгэлт хэрэглэгчид', 'friends')}${stat('Хөгжүүлэгч найз', ready() ? count(data.friends.filter(f => f.type === 'developer').length) : '—', 'Хамтдаа хөгжих найзууд', 'star')}</div>` +
    panel('Сүүлийн борлуулалтууд', table(['Огноо', 'Бүтээгдэхүүн / Худалдан авагч', 'Тоо', 'Нийт дүн', 'Төлөв'], saleRows(data.sales.slice(0, 5), false)), '<a href="#sales">Бүгдийг харах →</a>');
}
function friendTree(rows) {
  const visible = new Set(rows.map(f => f.id));
  for (const f of rows) { let p = f.parentId, depth = 0; while (p && depth++ < 100) { visible.add(p); p = data.friends.find(r => r.id === p)?.parentId; } }
  const branch = (parent, depth = 0) => depth > 100 ? '' : data.friends.filter(f => (f.parentId || '') === parent && visible.has(f.id)).map(f => `<details open><summary><span class="avatar">${esc(f.name.slice(0, 1))}</span><span>${esc(f.surname)} ${esc(f.name)}${f.phone ? `<br><small>${esc(f.phone)}</small>` : ''}</span><span class="badge ${f.type === 'developer' ? 'gold' : ''}">${esc(types[f.type])}</span></summary>${branch(f.id, depth + 1)}</details>`).join('');
  return `<div class="friend-tree"><div class="tree-root">${icon('tree')}<strong>${esc(user?.name || 'Миний сүлжээ')}</strong><small>${rows.length} найз</small></div>${branch('') || empty('Хайлтад тохирох найз алга.')}<p class="tree-caption">Мод нь таны бүртгэсэн «Урьсан найз» холбоосыг харуулна. Atomy-ийн албан ёсны спонсорын баталгаажуулалт биш.</p></div>`;
}
function friends() {
  const rows = data.friends.filter(f => `${f.surname} ${f.name} ${f.phone}`.toLowerCase().includes(search.toLowerCase()) && (!category || f.type === category));
  return heading('Миний найзууд', 'Харилцаанаас эхэлсэн үнэ цэнтэй хамтын аялал.', action('friend', 'Шинэ найз')) +
    `<div class="toolbar"><input id="search" aria-label="Найз хайх" placeholder="Нэр, утасны дугаараар хайх…" value="${esc(search)}"><select id="category" aria-label="Найзын төрөл"><option value="">Бүх найзууд</option>${Object.entries(types).map(([v, l]) => `<option value="${v}" ${category === v ? 'selected' : ''}>${l}</option>`).join('')}</select><div class="segmented"><button data-mode="list" class="${friendView === 'list' ? 'selected' : ''}">Жагсаалт</button><button data-mode="tree" class="${friendView === 'tree' ? 'selected' : ''}">Сүлжээний мод</button></div>${action('exportFriends', 'CSV', 'secondary', 'down')}</div>` +
    `<section class="panel"><div class="metric-inline">${ready() ? `Нийт ${data.friends.length} найз · Хайлтад ${rows.length}` : 'Бүртгэл ачаалагдаагүй'}</div>${friendView === 'tree' ? friendTree(rows) : table(['Найзын нэр', 'Утас', 'Төрөл', 'Урьсан найз', 'Төлөв', 'Үйлдэл'], rows.map(f => `<tr><td>${esc(f.surname)} ${esc(f.name)}<br><small>${esc(f.date)}</small></td><td>${esc(f.phone || '—')}</td><td><span class="badge ${f.type === 'developer' ? 'gold' : ''}">${esc(types[f.type])}</span></td><td>${esc(data.friends.find(r => r.id === f.parentId)?.name || 'Би')}</td><td><span class="badge ${f.status === 'active' ? 'green' : ''}">${f.status === 'active' ? 'Идэвхтэй' : 'Идэвхгүй'}</span></td><td><button class="button secondary small" data-action="history:${f.id}">Түүх</button> <button class="button secondary small" data-edit-friend="${f.id}">Засах</button> <button class="button ghost small" data-delete-friend="${f.id}">Устгах</button></td></tr>`))}</section>`;
}
function products() {
  const rows = data.products.filter(p => (p.name + ' ' + p.code).toLowerCase().includes(search.toLowerCase()) && (!category || p.category === category));
  return heading('Бүтээгдэхүүний каталог', 'Бодит мэдээлэл. Тодорхой үнэ. Эмх цэгцтэй нөөц.', action('product', 'Бүтээгдэхүүн')) +
    `<div class="toolbar"><input id="search" aria-label="Бүтээгдэхүүн хайх" placeholder="Нэр, барааны кодоор хайх…" value="${esc(search)}"><select id="category" aria-label="Ангилал"><option value="">Бүх ангилал</option>${categories.map(c => `<option ${c === category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>` +
    (rows.length ? `<div class="product-grid">${rows.map(p => `<article class="product-card"><div class="product-image">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer">` : '◇'}</div><span class="badge">${esc(p.category)}</span><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><p>Код: ${esc(p.code)} · ${p.status === 'active' ? 'Идэвхтэй' : 'Архивласан'}</p><div class="product-bottom"><strong>${money(p.price)}</strong><span class="badge ${p.stock <= p.threshold ? 'red' : 'green'}">${p.stock} ш үлдсэн</span></div><div class="product-bottom"><small>Өртөг: ${money(p.cost)}</small><button class="button secondary small" data-edit-product="${p.id}">Засах</button></div></article>`).join('')}</div>` : `<section class="panel">${empty(ready() ? 'Бүтээгдэхүүний бодит мэдээллээ нэмээрэй. Каталог хоосон байна.' : 'Каталог үзэхийн тулд нэвтэрнэ үү.')}</section>`);
}
function sales() {
  return heading('Борлуулалтын бүртгэл', 'Борлуулалт бүртгэхэд барааны үлдэгдэл автоматаар хасагдана.', action('sale', 'Борлуулалт')) +
    panel('Бүх борлуулалт', table(['Огноо', 'Бүтээгдэхүүн / Худалдан авагч', 'Тоо', 'Нийт дүн', 'Төлөв', 'Үйлдэл'], saleRows(data.sales))) +
    (data.legacySales.length ? `<div class="section-space">${panel('Хуучин хувилбарын архив', '<div class="metric-inline">Огноо, нөөцийн холбоосгүй тул санхүүгийн тайланд оруулахгүй.</div>' + table(['Нэр', 'Тоо', 'Нийт дүн', 'Хуучин тооцоолсон ашиг'], data.legacySales.map(s => `<tr><td>${esc(s.name)}</td><td>${s.qty}</td><td>${money(s.total)}</td><td>${money(s.profit)}</td></tr>`)))}</div>` : '');
}
function inventory() {
  const low = data.products.filter(p => p.status === 'active' && p.stock <= p.threshold);
  return heading('Бараа материал', 'Нөөцөө мэдэр. Хөдөлгөөн бүрээ хяна.', action('inventory', 'Хүлээн авах / Тооллого')) +
    (low.length ? `<div class="notice">${low.length} бүтээгдэхүүний нөөц бага байна: ${esc(low.map(p => p.name).join(', '))}</div>` : '') +
    `<div class="stats">${stat('Нийт үлдэгдэл', ready() ? count(sum(data.products, 'stock')) + ' ш' : '—', 'Бүх бүтээгдэхүүн', 'inventory')}${stat('Нөөцийн үнэлгээ', ready() ? money(data.products.reduce((n, p) => n + p.stock * p.cost, 0)) : '—', 'Жигнэсэн дундаж өртгөөр', 'wallet')}${stat('Нөөц багатай', ready() ? count(low.length) : '—', 'Анхааруулах хэмжээнд хүрсэн', 'products')}${stat('Хөдөлгөөний тоо', ready() ? count(data.inventoryMovements.length) : '—', 'Хүлээн авалт, борлуулалт, тооллого', 'reports')}</div>` +
    panel('Барааны үлдэгдэл', table(['Бүтээгдэхүүн', 'Код', 'Үлдэгдэл', 'Нэгжийн өртөг', 'Нөөцийн үнэлгээ'], data.products.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.code)}</td><td><span class="badge ${p.stock <= p.threshold ? 'red' : 'green'}">${p.stock} ш</span></td><td>${money(p.cost)}</td><td>${money(p.stock * p.cost)}</td></tr>`))) +
    `<div class="section-space">${panel('Хөдөлгөөний түүх', table(['Огноо', 'Бүтээгдэхүүн', 'Төрөл', 'Өөрчлөлт', 'Өмнө → Дараа', 'Тэмдэглэл'], data.inventoryMovements.map(m => `<tr><td>${esc(m.date)}</td><td>${esc(m.productName)}</td><td>${esc(movements[m.type])}</td><td>${m.qty > 0 ? '+' : ''}${m.qty}</td><td>${m.before} → ${m.after}</td><td>${esc(m.note)}</td></tr>`)), action('exportInventory', 'CSV', 'secondary small', 'down'))}</div>`;
}
function reportData() {
  const today = day(), d = new Date(today + 'T12:00:00Z'); let from = today, to = today;
  if (period === 'week') { d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); from = d.toISOString().slice(0, 10); }
  if (period === 'month') from = today.slice(0, 7) + '-01';
  if (period === 'year') from = today.slice(0, 4) + '-01-01';
  if (period === 'custom') { from = fromDate || today; to = toDate || today; }
  const sales = activeSales().filter(s => s.date >= from && s.date <= to), expenses = data.expenses.filter(e => e.date >= from && e.date <= to), groups = new Map();
  for (const s of sales) {
    const group = groups.get(s.productId) || { name: s.productName, qty: 0, total: 0, costTotal: 0, extra: 0, profit: 0 };
    for (const k of ['qty', 'total', 'costTotal', 'extra', 'profit']) group[k] += s[k];
    groups.set(s.productId, group);
  }
  return { from, to, sales, expenses, groups: [...groups.values()].sort((a, b) => b.total - a.total) };
}
function reports() {
  const r = reportData(), revenue = sum(r.sales, 'total'), cost = sum(r.sales, 'costTotal'), expenses = sum(r.sales, 'extra') + sum(r.expenses, 'amount');
  return heading('Санхүүгийн тайлан', 'Тоон дундаас бизнесийнхээ боломжийг хараарай.', action('expense', 'Зарлага')) +
    `<div class="toolbar"><select id="period" aria-label="Тайлангийн хугацаа">${[['day', 'Өнөөдөр'], ['week', 'Энэ долоо хоног'], ['month', 'Энэ сар'], ['year', 'Энэ жил'], ['custom', 'Хугацаа сонгох']].map(([v, l]) => `<option value="${v}" ${period === v ? 'selected' : ''}>${l}</option>`).join('')}</select>${period === 'custom' ? `<label>Эхлэх<input id="fromDate" type="date" value="${r.from}"></label><label>Дуусах<input id="toDate" type="date" value="${r.to}"></label>` : ''}<span class="spacer"></span>${action('exportReport', 'Тайлан CSV', 'secondary', 'down')}${action('exportExpenses', 'Зарлага CSV', 'secondary', 'down')}</div><p class="subtitle">${r.from} — ${r.to} · ${r.sales.length} баталгаажсан борлуулалт</p><br>` +
    `<div class="stats">${stat('Борлуулалтын орлого', ready() ? money(revenue) : '—', 'Цуцлагдсан гүйлгээгүй', 'wallet')}${stat('Барааны өртөг', ready() ? money(cost) : '—', 'Борлуулах үеийн нэгжийн өртөг', 'products')}${stat('Нэмэлт зардал', ready() ? money(expenses) : '—', 'Борлуулалтын зардал + бусад зарлага', 'sales')}${stat('Ашиг', ready() ? money(revenue - cost - expenses) : '—', 'Орлого − өртөг − нэмэлт зардал', 'leaf', 'profit')}</div><div class="notice">Ашиг нь касс, банкны бэлэн мөнгөний үлдэгдэл биш. Энэ тайлан авлага болон дансны үлдэгдлийг тооцохгүй.</div>` +
    panel('Бүтээгдэхүүн тус бүрийн борлуулалт', table(['Бүтээгдэхүүн', 'Тоо', 'Орлого', 'Өртөг', 'Зардал', 'Ашиг'], r.groups.map(g => `<tr><td>${esc(g.name)}</td><td>${g.qty}</td><td>${money(g.total)}</td><td>${money(g.costTotal)}</td><td>${money(g.extra)}</td><td>${money(g.profit)}</td></tr>`)), '<span class="badge">Орлогоор эрэмбэлсэн</span>') +
    `<div class="section-space">${panel('Нэмэлт зарлага', table(['Огноо', 'Зарлагын нэр', 'Дүн', 'Тэмдэглэл'], r.expenses.map(e => `<tr><td>${esc(e.date)}</td><td>${esc(e.name)}</td><td>${money(e.amount)}</td><td>${esc(e.note)}</td></tr>`)))}</div>`;
}
function facebook() {
  return heading('Холбоотой байцгаая', 'Handari Brand · Таны хүрээлэл, таны боломж.') +
    `<div class="profile-grid"><section class="panel"><div class="qr-card"><span class="eyebrow">HANDARI COMMUNITY</span><h2 class="profile-name">Найзууддаа хуваалцаарай.</h2><p class="copy">Утасныхаа камераар QR кодыг уншуулаарай.</p><img class="qr-image" src="/assets/facebook_qr.png" alt="Хуучин төслөөс ирүүлсэн Facebook QR"><p class="copy">Renchinhand Hurtsbaatar</p><a class="button" href="https://www.facebook.com/renchinhand.hurtsbaatar" target="_blank" rel="noopener noreferrer">Facebook профайл нээх ↗</a><p class="attachment-note" id="qrStatus">✓ QR холбоос шалгагдсан · Facebook профайл руу чиглүүлнэ.</p></div></section>${panel('Хандарь ХХК | Handari Brand', `<div class="panel-body copy"><img class="supplied-logo" src="/assets/handari_logo.png" alt="Хэрэглэгчийн ирүүлсэн HANDARI лого файл"><h3>Итгэлээс эхэлсэн хамтын аялал.</h3><p>Найзуудтайгаа холбогдож, бүтээгдэхүүний мэдээ болон манай үйл ажиллагааг Facebook-ээр дагаарай.</p><h3>Бидний тухай</h3><p>Хандарь ХХК нь Atomy бүтээгдэхүүний бие даасан борлуулагч. Atomy компанийн үйлдвэрлэгч, эзэмшигч биш.</p><h3>Холбоос хуваалцах</h3>${action('shareFacebook', 'Facebook холбоос хуваалцах', 'secondary', 'arrow')}<p class="attachment-note">Хуучин төслөөс ирсэн лого, QR эх файлуудыг хэвээр хадгалсан.</p></div>`)}</div>`;
}
function baseSettings() {
  return heading('Миний булан', 'Таны бүртгэл, мэдээлэл болон системийн тохиргоо.') +
    `<div class="profile-grid">${panel('Миний бүртгэл', `<div class="panel-body copy"><span class="avatar">${esc(user?.name?.slice(0, 1) || 'H')}</span><h3>${esc(user?.name || 'Та нэвтрээгүй байна')}</h3><p>${esc(user?.email || 'Мэдээлэлтэйгээ ажиллахын тулд нэвтэрнэ үү.')}</p>${user ? `<p>Эрх: ${user.role === 'admin' ? 'Компанийн удирдлага' : esc(types[user.role])}</p>${action('password', 'Нууц үг солих', 'secondary', 'settings')} ${action('logout', 'Гарах', 'secondary', 'arrow')}` : action('login', 'Нэвтрэх', '', 'arrow')}<h3>Утсанд суулгах</h3><p>Android Chrome → цэс → Нүүр дэлгэцэд нэмэх. HTTPS холболт шаардлагатай. Холболтгүй үед зөвхөн аппын бүрхүүл нээгдэнэ.</p>${action('install', 'Апп суулгах', 'secondary', 'down')}<h3>Найзуудын урилга</h3><p>Шинэ хэрэглэгч бүртгүүлэх боломжтой. Бүртгэл үүсгээд шууд нэвтэрнэ. Админ самбараас хэрэглэгчийн эрхийг удирдана. Gmail урилга, Atomy спонсорын баталгаажуулалт ороогүй.</p></div>`)}${panel('Мэдээлэл ба түүх', `<div class="panel-body copy"><h3>Хуучин мэдээллээ оруулах</h3><p>Хуучин Firestore-ийн friends / sales өгөгдлийг JSON файл болгон экспортолсны дараа импортолно. Найзын мод хадгалагдана. Огноогүй хуучин борлуулалт тусдаа архивт орно.</p>${action('importLegacy', 'JSON файл импортлох', 'secondary', 'down')}<h3>Системийн үйлдлийн түүх</h3>${ready() && data.audit.length ? `<div class="audit-list">${data.audit.slice(0, 7).map(a => `<div class="audit-item"><span>${esc(actionLabels[a.kind] || a.kind)}</span><time>${esc(a.createdAt.slice(0, 10))}</time></div>`).join('')}</div>` : '<p>Үйлдлийн түүх ачаалагдаагүй эсвэл хоосон байна.</p>'}<h3>Таны сервер, таны мэдээлэл</h3><p>SQLite санд хадгална. Бүрэн нөөцлөх, сэргээх болон Ubuntu-д суулгах заавар README.md файлд бий. CSV нь бүрэн нөөц хуулбар биш.</p><p class="attachment-note">HANDARI v1.4 · Бүртгэл, админ удирдлага</p></div>`)}</div>`;
}
function settings() { return user && (user.role!=='admin'||user.mustChangePassword) ? accountUI.memberHome() : baseSettings() + `<div class="section-space">${feature.backupStatus()}</div>`; }
function login() {
  return `<section class="login-layout"><span class="eyebrow">ТАВТАЙ МОРИЛ · HANDARI BRAND</span><h2>HANDARI</h2><p class="subtitle">Бизнесийнхээ удирдлагыг нэг дороос.</p><form id="loginForm"><label class="field"><span>Имэйл хаяг</span><input name="email" type="email" autocomplete="username" maxlength="254" required placeholder="Имэйл хаягаа оруулна уу"></label><label class="field"><span>Нууц үг</span><input name="password" type="password" autocomplete="current-password" maxlength="256" required placeholder="Нууц үгээ оруулна уу"></label><p id="loginError" class="error" role="alert"></p><button class="button">Нэвтрэх →</button></form><p class="registration-login">Бүртгэлгүй юу? <a href="#register">Шинээр бүртгүүлэх →</a></p><p><a href="#forgot">Нууц үгээ мартсан уу?</a></p><small>Шинэ бүртгэлээр шууд нэвтрэх боломжтой.</small></section>`;
}
function render() {
  if (booting) return;
  const current = page();
  $('#crumb').textContent = menus.find(m => m[0] === current)?.[1] || ({forgot:'Нууц үг сэргээх',reset:'Шинэ нууц үг',history:'Худалдан авалтын түүх',register:'Бүртгүүлэх',member:'Миний HANDARI',memberCatalog:'Каталог',memberHistory:'Миний худалдан авалт'}[current] || 'Нэвтрэх');
  const visibleMenus=user?.role==='admin'?menus:user?[['home','Миний HANDARI'],['memberCatalog','Каталог'],['memberHistory','Миний худалдан авалт'],['facebook','Facebook & QR'],['settings','Миний булан']]:[['home','Нүүр'],['login','Нэвтрэх'],['register','Бүртгүүлэх'],['facebook','Facebook & QR']];
  $('#nav').innerHTML = visibleMenus.map(([id, label]) => `<a href="#${id}" ${current === id ? 'class="active" aria-current="page"' : ''}>${icon(id)}${label}</a>`).join('');
  const bottom=user?.role==='admin'?['home','friends','products','sales','settings']:user?['home','memberCatalog','memberHistory','settings']:['home','login','register','facebook'];
  $('#bottomNav').innerHTML = bottom.map(id => `<a href="#${id}" ${current === id ? 'class="active" aria-current="page"' : ''}>${icon(id)}${{ home: 'Нүүр', friends: 'Найзууд', products: 'Бараа', sales: 'Борлуулалт', settings: 'Миний булан',memberCatalog:'Каталог',memberHistory:'Миний түүх',login:'Нэвтрэх',register:'Бүртгүүлэх',facebook:'Facebook' }[id]}</a>`).join('');
  $('#accountLabel').textContent = user?.name || 'Нэвтрэх';
  const unread = ready() ? data.notifications.filter(n => !n.readAt && !n.resolvedAt).length : 0;
  $('#notificationCount').textContent = unread; $('#notificationCount').hidden = !unread;
  let notice = !user && current !== 'login' ? `<div class="notice neutral"><span>Өгөгдлөө харах, бүртгэл хийхийн тулд нэвтэрнэ үү. Үзүүлэлтүүд хараахан ачаалагдаагүй байна.</span>${action('login', 'Нэвтрэх', 'secondary small', 'arrow')}</div>` : '';
  if (loading) notice += '<div class="notice neutral" role="status">Мэдээлэл ачаалж байна…</div>';
  if (error) notice += `<div class="notice" role="alert">${esc(error)}${action('refresh', 'Дахин ачаалах', 'secondary small', 'arrow')}</div>`;
  if (unread && current !== 'notifications') notice += `<div class="notice"><span>${unread} бүтээгдэхүүний нөөц анхааруулах хэмжээнд хүрсэн байна.</span><a class="button secondary small" href="#notifications">Мэдэгдэл харах</a></div>`;
  const pages = { forgot: recoveryUI.forgot, reset: recoveryUI.reset, home, friends, products, sales, inventory, reports, facebook, settings, login, ...feature.pages, ...accountUI.pages };
  const memberAllowed=['home','member','memberCatalog','memberHistory','settings','facebook','forgot','reset'];
  const renderPage=user?.mustChangePassword || (user && user.role!=='admin'&&!memberAllowed.includes(current)) ? accountUI.memberHome : (pages[current] || home);
  $('#content').innerHTML = notice + renderPage();
  for (const bar of document.querySelectorAll('[data-height]')) bar.style.height = bar.dataset.height + '%';
  googleUI.mount(current);
}

const field = (name, label, type = 'text', value = '', options = null, required = true, wide = false) => ({ name, label, type, value, options, required, wide });
function openForm(title, fields, onSave, help = '') {
  if (working) return;
  $('#modalTitle').textContent = title; $('#formError').textContent = ''; $('#save').disabled = false; $('#save').textContent = 'Хадгалах';
  $('#fields').innerHTML = fields.map(f => `<label class="field ${f.wide ? 'wide' : ''}"><span>${esc(f.label)}${f.required ? ' *' : ''}</span>${f.options ? `<select name="${f.name}" ${f.required ? 'required' : ''}>${f.options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(f.value) === String(v) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>` : f.type === 'textarea' ? `<textarea name="${f.name}" maxlength="2000" ${f.required ? 'required' : ''}>${esc(f.value)}</textarea>` : `<input name="${f.name}" type="${f.type}" value="${esc(f.value)}" ${f.required ? 'required' : ''} ${f.type === 'number' ? 'min="0" max="1000000000000" step="any"' : ''} ${f.type === 'password' ? 'maxlength="256" autocomplete="new-password"' : ''} ${f.type === 'text' ? 'maxlength="500"' : ''}>`}</label>`).join('') + (help ? `<p class="form-help">${esc(help)}</p>` : '');
  let operationId = '', previous = '';
  saveForm = async () => {
    const raw = Object.fromEntries(new FormData($('#form')));
    for (const f of fields) if (f.type === 'number') raw[f.name] = Number(raw[f.name]);
    const fingerprint = JSON.stringify(raw);
    if (!operationId || fingerprint !== previous) { previous = fingerprint; operationId = crypto.randomUUID(); }
    await onSave({ ...raw, operationId });
  };
  $('#modal').showModal();
}
async function saveAction(kind, input) {
  await api('action/' + kind, input);
  $('#modal').close(); toast('Амжилттай хадгаллаа.'); await refresh();
}
function friendForm(id) {
  const f = data.friends.find(r => r.id === id) || {};
  openForm(id ? 'Найзын мэдээлэл засах' : 'Шинэ найз нэмэх', [
    field('surname', 'Овог', 'text', f.surname || '', null, false), field('name', 'Нэр', 'text', f.name || ''),
    field('phone', 'Утасны дугаар', 'tel', f.phone || '', null, false), field('date', 'Бүртгэлийн огноо', 'date', f.date || day()),
    field('type', 'Найзын төрөл', 'text', f.type || 'customer', Object.entries(types)),
    field('parentId', 'Урьсан найз', 'text', f.parentId || '', [['', 'Би / Сүлжээний үндэс'], ...data.friends.filter(r => r.id !== id).map(r => [r.id, `${r.surname} ${r.name}`])], false),
    field('member', 'Гишүүний дугаар', 'text', f.member || '', null, false), field('status', 'Төлөв', 'text', f.status || 'active', [['active', 'Идэвхтэй'], ['inactive', 'Идэвхгүй']]),
    field('address', 'Хаяг', 'text', f.address || '', null, false, true), field('note', 'Тэмдэглэл', 'textarea', f.note || '', null, false, true)
  ], b => saveAction('friend', { ...b, ...(id ? { id } : {}) }), 'Урьсан найзаа сонгосноор сүлжээний модонд байрлана. Давхардсан утас болон тойрог холбоосыг сервер шалгана.');
}
function productForm(id) {
  const p = data.products.find(r => r.id === id) || {};
  openForm(id ? 'Бүтээгдэхүүн засах' : 'Бүтээгдэхүүн нэмэх', [
    field('name', 'Бүтээгдэхүүний нэр', 'text', p.name || ''), field('code', 'Барааны код', 'text', p.code || ''),
    field('category', 'Ангилал', 'text', p.category || categories[0], categories), field('price', 'Борлуулах үнэ ₮', 'number', p.price || 0),
    field('threshold', 'Нөөцийн анхааруулах хэмжээ', 'number', p.threshold ?? 5), field('status', 'Төлөв', 'text', p.status || 'active', [['active', 'Идэвхтэй'], ['inactive', 'Архивласан']]),
    field('memberVisible','Гишүүдийн каталогт харуулах','text',p.memberVisible?'yes':'no',[['no','Зөвхөн админд'],['yes','Гишүүдэд нийтлэх']],true,true),
    field('image', 'Зургийн холбоос эсвэл доороос зураг сонгох', 'text', p.image || '', null, false, true), field('description', 'Товч тайлбар', 'textarea', p.description || '', null, false, true)
  ], async b => { b.image = await feature.uploadSelectedImage(b.image); await saveAction('product', { ...b, ...(id ? { id } : {}) }); }, 'Өртөг, үлдэгдлийг «Бараа хүлээн авах» хэсэгт оруулна. Бүтээгдэхүүнийг архивлахад өмнөх түүх хадгалагдана.');
  feature.productUpload(p);
}
function saleForm() {
  const products = data.products.filter(p => p.status === 'active');
  if (!products.length) return toast('Эхлээд бүтээгдэхүүн нэмээд бараа хүлээн авна уу.');
  openForm('Борлуулалт бүртгэх', [
    field('date', 'Огноо', 'date', day()), field('productId', 'Бүтээгдэхүүн', 'text', products[0].id, products.map(p => [p.id, `${p.name} · ${p.stock} ш`])),
    field('qty', 'Тоо ширхэг', 'number', 1), field('price', 'Нэгжийн үнэ ₮', 'number', products[0].price),
    field('extra', 'Холбогдох зардал ₮', 'number', 0), field('payment', 'Төлбөрийн хэлбэр', 'text', 'transfer', Object.entries(payments)),
    field('paid', 'Бодитоор төлсөн дүн ₮', 'number', products[0].price, null, true, true),
    field('buyerId', 'Худалдан авагч', 'text', '', [['', 'Бүртгэлгүй худалдан авагч'], ...data.friends.map(f => [f.id, `${f.surname} ${f.name}`])], false, true),
    field('note', 'Тэмдэглэл', 'textarea', '', null, false, true)
  ], b => saveAction('sale', b));
  const preview = document.createElement('div'); preview.className = 'sale-preview'; $('#fields').append(preview);
  let paidEdited = false;
  $('#form').elements.paid.addEventListener('input', () => { paidEdited = true; });
  const recalc = () => {
    const form = $('#form'), p = data.products.find(p => p.id === form.elements.productId.value), qty = Number(form.elements.qty.value), price = Number(form.elements.price.value), extra = Number(form.elements.extra.value);
    if (!paidEdited) form.elements.paid.value = qty * price;
    preview.innerHTML = `<div>Нийт үнэ<strong>${money(qty * price)}</strong></div><div>Нийт өртөг<strong>${money(qty * p.cost)}</strong></div><div>Тооцоолсон ашиг<strong>${money(qty * (price - p.cost) - extra)}</strong></div>`;
  };
  $('#form').elements.productId.addEventListener('change', () => { $('#form').elements.price.value = data.products.find(p => p.id === $('#form').elements.productId.value).price; recalc(); });
  for (const name of ['qty', 'price', 'extra']) $('#form').elements[name].addEventListener('input', recalc);
  recalc();
}
function inventoryForm() {
  if (!data.products.length) return toast('Эхлээд бүтээгдэхүүн нэмнэ үү.');
  openForm('Бараа хүлээн авах / Тооллого', [
    field('productId', 'Бүтээгдэхүүн', 'text', data.products[0].id, data.products.map(p => [p.id, p.name])), field('type', 'Үйлдэл', 'text', 'receive', [['receive', 'Бараа хүлээн авах'], ['count', 'Бодит үлдэгдэл тоолох']]),
    field('qty', 'Хүлээн авах тоо / Тоолсон үлдэгдэл', 'number', 1), field('cost', 'Хүлээн авсан нэгжийн өртөг ₮', 'number', 0),
    field('date', 'Огноо', 'date', day()), field('note', 'Шалтгаан / Баримтын дугаар', 'textarea', '', null, true, true)
  ], b => saveAction('inventory', b), 'Тооллого сонговол оруулсан тоо шинэ бодит үлдэгдэл болно; өртөг хэвээр. Хүлээн авалтад жигнэсэн дундаж өртөг тооцно.');
}
function csv(name, headers, rows) {
  if (!requireAdmin()) return;
  const safe = value => { let s = String(value ?? ''); if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const blob = new Blob(['\uFEFF' + [headers, ...rows].map(row => row.map(safe).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name + '-' + day() + '.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
const actions = {
  login: () => location.hash = 'login', refresh,
  friend: () => requireAdmin() && friendForm(), product: () => requireAdmin() && productForm(), sale: () => requireAdmin() && saleForm(), inventory: () => requireAdmin() && inventoryForm(),
  expense: () => requireAdmin() && openForm('Зарлага бүртгэх', [field('name', 'Зарлагын нэр'), field('amount', 'Дүн ₮', 'number', 0), field('date', 'Огноо', 'date', day()), field('note', 'Тэмдэглэл', 'textarea', '', null, false, true)], b => saveAction('expense', b)),
  password: () => user && openForm('Нууц үг солих', [field('current', 'Одоогийн нууц үг', 'password', '', null, true, true), field('password', 'Шинэ нууц үг — 12+ тэмдэгт', 'password', '', null, true, true)], async b => { await api('password', b); $('#modal').close(); clearSession(); toast('Нууц үг солигдлоо. Дахин нэвтэрнэ үү.'); }),
  logout: async () => { await api('logout', {}); clearSession(); toast('Системээс гарлаа.'); },
  exportFriends: () => csv('найзууд', ['Овог', 'Нэр', 'Утас', 'Огноо', 'Төрөл', 'Урьсан найз', 'Гишүүн', 'Хаяг', 'Төлөв', 'Тэмдэглэл'], data.friends.map(f => [f.surname, f.name, f.phone, f.date, types[f.type], data.friends.find(r => r.id === f.parentId)?.name || 'Би', f.member, f.address, f.status, f.note])),
  exportInventory: () => csv('барааны-хөдөлгөөн', ['Огноо', 'Бүтээгдэхүүн', 'Төрөл', 'Өөрчлөлт', 'Өмнө', 'Дараа', 'Өртөг', 'Тэмдэглэл'], data.inventoryMovements.map(m => [m.date, m.productName, movements[m.type], m.qty, m.before, m.after, m.cost, m.note])),
  exportReport: () => { const r = reportData(); csv('тайлан', ['Эхлэх', 'Дуусах', 'Бүтээгдэхүүн', 'Тоо', 'Орлого', 'Өртөг', 'Нэмэлт зардал', 'Ашиг'], [...r.groups.map(g => [r.from, r.to, g.name, g.qty, g.total, g.costTotal, g.extra, g.profit]), [r.from, r.to, 'Бусад зарлага', '', '', '', sum(r.expenses, 'amount'), -sum(r.expenses, 'amount')], [r.from, r.to, 'НИЙТ', sum(r.sales, 'qty'), sum(r.sales, 'total'), sum(r.sales, 'costTotal'), sum(r.sales, 'extra') + sum(r.expenses, 'amount'), sum(r.sales, 'profit') - sum(r.expenses, 'amount')]]); },
  exportExpenses: () => csv('зарлага', ['Огноо', 'Нэр', 'Дүн', 'Тэмдэглэл'], reportData().expenses.map(e => [e.date, e.name, e.amount, e.note])),
  importLegacy: () => { if (requireAdmin()) { $('#importFile').value = ''; $('#importFile').click(); } },
  shareFacebook: async () => { const url = 'https://www.facebook.com/renchinhand.hurtsbaatar'; if (navigator.share) await navigator.share({ title: 'Handari Brand', url }); else { await navigator.clipboard.writeText(url); toast('Facebook холбоос хуулагдлаа.'); } },
  install: async () => { if (installPrompt) { await installPrompt.prompt(); installPrompt = null; } else toast('Chrome цэс → Нүүр дэлгэцэд нэмэх. HTTPS холболт шаардлагатай.'); }
};
const feature = createFeatures({ $, esc, money, count, day, sum, icon, action, heading, panel, table, empty, field, openForm, saveAction, api, toast, requireAdmin, csv, actions, stat, ready, render, refresh, getData: () => data });
const accountUI = createAccountUI({$,esc,money,day,count,sum,heading,panel,table,empty,stat,field,openForm,api,toast,actions,render,refresh,requireAdmin,ready,getData:()=>data,getUser:()=>user,setUser:value=>user=value});
const recoveryUI=createRecoveryUI({$,api,esc});
const googleUI=createGoogleUI({$,api,toast,render,openForm,field,refresh,getUser:()=>user,onUser:value=>{generation++;user=value;data=blank();accountUI.reset();loaded=false;location.hash='home';}});
function clearSession() { generation++; user = null; data = blank(); accountUI.reset(); loaded = false; loading = false; error = ''; location.hash = 'login'; render(); }
document.addEventListener('click', async event => {
  const target = event.target.closest('[data-action],[data-edit-friend],[data-delete-friend],[data-edit-product],[data-cancel-sale],[data-mode]');
  if (!target || working) return;
  try {
    if (target.dataset.mode) { friendView = target.dataset.mode; render(); return; }
    if (target.dataset.action) { if(target.dataset.action==='googleLink')await googleUI.link(); else if (actions[target.dataset.action]) await actions[target.dataset.action](); else if(!accountUI.dispatch(target.dataset.action)) await feature.dispatch(target.dataset.action); return; }
    if (!requireAdmin()) return;
    if (target.dataset.editFriend) friendForm(target.dataset.editFriend);
    if (target.dataset.editProduct) productForm(target.dataset.editProduct);
    if (target.dataset.deleteFriend) {
      const f = data.friends.find(f => f.id === target.dataset.deleteFriend);
      openForm('Найзын бүртгэл устгах', [], b => saveAction('deleteFriend', { ...b, id: f.id }), `${f.surname} ${f.name} найзын бүртгэлийг устгах уу? Энэ үйлдлийг буцаах боломжгүй.`);
      $('#save').textContent = 'Устгах';
    }
    if (target.dataset.cancelSale) openForm('Борлуулалт цуцлах', [field('note', 'Цуцлах шалтгаан', 'textarea', '', null, true, true)], b => saveAction('cancelSale', { ...b, id: target.dataset.cancelSale }), 'Бараа нөөцөд буцаж нэмэгдэнэ. Цуцлагдсан дүн тайлангаас хасагдана. Мөнгө автоматаар буцахгүй; төлсөн дүн байвал дараа нь «Төлбөр буцаах» үйлдлээр бодит буцаалтыг бүртгэнэ.');
  } catch (e) { if (e.name !== 'AbortError') toast(e.message); }
});
$('#form').addEventListener('submit', async event => {
  event.preventDefault(); if (working) return;
  working = true; $('#save').disabled = true; $('#formError').textContent = '';
  try { await saveForm(); } catch (e) { $('#formError').textContent = e.message; }
  finally { working = false; $('#save').disabled = false; }
});
$('#modal').addEventListener('cancel', e => { if (working) e.preventDefault(); });
const closeModal = () => { if (!working) $('#modal').close(); };
$('#closeModal').onclick = closeModal; $('#cancelModal').onclick = closeModal;
$('#modal').addEventListener('close', () => { if ($('#modal').open) return; $('#fields').replaceChildren(); saveForm = null; });
document.addEventListener('submit', async event => {
  if (event.target.id !== 'loginForm') return;
  event.preventDefault(); const form = event.target, button = form.querySelector('button'); if (button.disabled) return;
  button.disabled = true; button.textContent = 'Нэвтэрч байна…'; $('#loginError').textContent = '';
  try { const result = await api('login', Object.fromEntries(new FormData(form))); generation++; user = result.user; data = blank(); accountUI.reset(); loaded = false; location.hash = 'home'; await refresh(); render(); }
  catch (e) { if ($('#loginError')) $('#loginError').textContent = e.message; }
  finally { button.disabled = false; button.textContent = 'Нэвтрэх →'; }
});
document.addEventListener('input', e => {
  if (e.target.id === 'search') { const position = e.target.selectionStart; search = e.target.value; render(); $('#search').focus(); $('#search').setSelectionRange(position, position); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'category') { category = e.target.value; render(); }
  if (e.target.id === 'period') { period = e.target.value; render(); }
  if (e.target.id === 'fromDate') { fromDate = e.target.value; render(); }
  if (e.target.id === 'toDate') { toDate = e.target.value; render(); }
});
$('#importFile').addEventListener('change', async () => {
  const file = $('#importFile').files[0]; if (!file) return;
  try {
    if (file.size > 900000) throw new Error('Импортын файл 900 KB-аас бага байна.');
    const input = JSON.parse(await file.text());
    if (!Array.isArray(input.friends) || !Array.isArray(input.sales)) throw new Error('Файл {"friends": [...], "sales": [...]} бүтэцтэй байна.');
    openForm('Хуучин мэдээлэл импортлох', [], b => saveAction('importLegacy', { ...b, friends: input.friends, sales: input.sales }), `${input.friends.length} найз, ${input.sales.length} хуучин борлуулалт импортлох уу? Огноогүй борлуулалт тусдаа архивт орж, нөөц болон тайланг өөрчлөхгүй. Найзуудын бүртгэлийн огноо импортын огноо болно.`);
    $('#save').textContent = 'Импортлох';
  } catch (e) { toast(e.message); }
});
function closeNav() { $('#sidebar').classList.remove('open'); $('#overlay').hidden = true; $('#menu').setAttribute('aria-expanded', 'false'); }
window.addEventListener('hashchange', () => { search = ''; category = ''; closeNav(); if ($('#modal').open && !working) $('#modal').close(); render(); window.scrollTo(0, 0); });
$('#menu').onclick = () => { const open = $('#sidebar').classList.toggle('open'); $('#overlay').hidden = !open; $('#menu').setAttribute('aria-expanded', String(open)); };
$('#overlay').onclick = closeNav;
$('#account').onclick = () => location.hash = user ? 'settings' : 'login';
$('#notificationsButton').onclick = () => location.hash = 'notifications';
$('#reload').onclick = () => user ? refresh() : toast('Эхлээд нэвтэрнэ үү.');
$('#today').textContent = day().replace(/(\d{4})-(\d{2})-(\d{2})/, '$1 оны $2 сарын $3'); $('#year').textContent = day().slice(0, 4);
function network() {
  $('#network').hidden = navigator.onLine;
  if (!navigator.onLine) { generation++; data = blank(); accountUI.reset(); loaded = false; loading = false; render(); }
  else if (user) refresh();
}
window.addEventListener('online', network); window.addEventListener('offline', network);
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('/sw.js').then(reg => {
    const update = () => { if (reg.waiting && navigator.serviceWorker.controller) { $('#update').hidden = false; $('#updateButton').onclick = () => reg.waiting?.postMessage('ACTIVATE'); } };
    update(); reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', update));
  }).catch(() => toast('Аппын офлайн бүрхүүл бүртгэгдсэнгүй. HTTPS хаягаа шалгана уу.'));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
}
await googleUI.load();
try { accountUI.setPolicy(await api('registration')); } catch {}
try { user = (await api('me')).user; } catch (e) { if (e.message !== 'Нэвтэрнэ үү.') error = e.message; }
booting = false; await refresh(); render(); if (!navigator.onLine) network(); document.body.dataset.ready = 'true';
setInterval(() => { if (user && navigator.onLine && !document.hidden && !working && !$('#modal').open && !document.activeElement?.matches('input,select,textarea')) refresh(); }, 60000);
