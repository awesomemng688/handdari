import { openDatabase } from './database.mjs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export class Problem extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function need(ok, message, status = 400) { if (!ok) throw new Problem(message, status); }
function text(value, max = 500, required = false) {
  need(typeof value === 'string' && value.length <= max && (!required || value.trim()), 'Текстийн мэдээллээ шалгана уу.');
  return value.trim();
}
function number(value, max = 1e12, integer = false) {
  need(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max && (!integer || Number.isInteger(value)), 'Тоон утга буруу байна.');
  return value;
}
function date(value) {
  const parsed = typeof value === 'string' ? new Date(value + 'T00:00:00Z') : null;
  need(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed?.getTime()) && parsed.toISOString().slice(0, 10) === value, 'Огноо буруу байна.');
  return value;
}
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ulaanbaatar' }).format(new Date());
const idValue = value => { need(typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value), 'Бүртгэлийн дугаар буруу байна.'); return value; };

export function openStore(path, options = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = openDatabase(path, options);
  if(db.dialect!=='mysql')db.exec(`PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','customer','developer'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS records (
      bucket TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(bucket,id)
    );
    CREATE TABLE IF NOT EXISTS operations (
      id TEXT PRIMARY KEY, actor TEXT NOT NULL, kind TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, createdAt TEXT NOT NULL);`);
  const list = bucket => db.prepare('SELECT id,payload FROM records WHERE bucket=? ORDER BY rowid DESC').all(bucket).map(r => ({ ...JSON.parse(r.payload), id: r.id }));
  const get = (bucket, id) => {
    const r = db.prepare('SELECT payload FROM records WHERE bucket=? AND id=?').get(bucket, id);
    return r ? { ...JSON.parse(r.payload), id } : null;
  };
  const put = (bucket, id, value) => db.prepare('INSERT INTO records VALUES(?,?,?) ON CONFLICT(bucket,id) DO UPDATE SET payload=excluded.payload').run(bucket, id, JSON.stringify(value));
  function atomic(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function checkParent(id, parentId) {
    const seen = new Set([id]);
    while (parentId) {
      need(!seen.has(parentId), 'Найзын модонд тойрог холбоос үүсгэж болохгүй.');
      seen.add(parentId);
      need(seen.size <= 100, 'Модны гүн хэтэрсэн байна.');
      const parent = get('friends', parentId);
      need(parent, 'Урьсан найз олдсонгүй.');
      parentId = parent.parentId;
    }
  }
  // Previous sales did not record amounts received. Require explicit reconciliation.
  if (db.prepare('PRAGMA user_version').get().user_version < 2) atomic(() => {
    for (const sale of list('sales')) if (sale.paymentTracking === undefined) put('sales', sale.id, { ...sale, paid: 0, paymentTracking: 'unverified' });
    db.exec('PRAGMA user_version=2;');
  });
  const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(c => c.name));
  atomic(() => {
    for (const [name, definition] of Object.entries({
      status: "TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending','active','suspended'))",
      phone: "TEXT NOT NULL DEFAULT ''", friendId: "TEXT NOT NULL DEFAULT ''",
      requestedRole: "TEXT NOT NULL DEFAULT 'customer'", createdAt: "TEXT NOT NULL DEFAULT ''",
      lastLoginAt: "TEXT NOT NULL DEFAULT ''", mustChangePassword: 'INTEGER NOT NULL DEFAULT 0',
      revision: 'INTEGER NOT NULL DEFAULT 0', passwordEnabled: 'INTEGER NOT NULL DEFAULT 1'
    })) if (!userColumns.has(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
    if(db.dialect!=='mysql')db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_friend_unique ON users(friendId) WHERE friendId<>'';");
    if (db.prepare('PRAGMA user_version').get().user_version < 5) {
      db.prepare("UPDATE users SET status='active',revision=revision+1 WHERE status='pending' AND role IN ('customer','developer')").run();
      db.exec('PRAGMA user_version=5;');
    }
  });
  const cash = value => Math.round(number(value) * 100) / 100;
  function stockAlert(p) {
    const id = 'stock-' + p.id, old = get('notifications', id), low = p.status === 'active' && p.stock <= p.threshold;
    if (low && (!old || old.resolvedAt || old.stock !== p.stock || old.threshold !== p.threshold)) {
      put('notifications', id, { productId: p.id, productName: p.name, stock: p.stock, threshold: p.threshold, type: 'lowStock', createdAt: new Date().toISOString(), readAt: null, resolvedAt: null });
    } else if (!low && old && !old.resolvedAt) put('notifications', id, { ...old, resolvedAt: new Date().toISOString() });
  }
  function mutate(actor, kind, input) {
    need(actor?.role === 'admin', 'Энэ үйлдлийг зөвхөн админ хийнэ.', 403);
    need(input && /^[a-zA-Z0-9-]{16,80}$/.test(input.operationId || ''), 'Үйлдлийн дугаар шаардлагатай.');
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return atomic(() => {
      const old = db.prepare('SELECT * FROM operations WHERE id=?').get(input.operationId);
      if (old) {
        need(old.actor === actor.id && old.kind === kind && old.fingerprint === fingerprint, 'Үйлдлийн дугаар давхардлаа.', 409);
        return JSON.parse(old.result);
      }
      const now = new Date().toISOString();
      const id = input.id ? idValue(input.id) : randomUUID();
      const createBuckets = { sale: 'sales', order: 'orders', payment: 'payments', refundPayment: 'payments', reconcilePayment: 'payments', inventory: 'inventoryMovements', expense: 'expenses' };
      if (createBuckets[kind]) need(!get(createBuckets[kind], id), 'Энэ дугаартай бүртгэл өмнө нь үүссэн байна.', 409);
      let result = { id };
      if (kind === 'friend') {
        const f = {
          surname: text(input.surname, 100), name: text(input.name, 100, true),
          phone: text(input.phone, 30).replace(/[\s()-]/g, ''), date: date(input.date),
          type: input.type, parentId: text(input.parentId, 80), member: text(input.member, 100),
          address: text(input.address, 500), note: text(input.note, 2000), status: input.status, updatedAt: now
        };
        need(['customer', 'developer'].includes(f.type) && ['active', 'inactive'].includes(f.status), 'Төрөл эсвэл төлөв буруу байна.');
        need(!f.phone || !list('friends').some(r => r.id !== id && r.phone === f.phone), 'Энэ утасны дугаар бүртгэлтэй байна.', 409);
        checkParent(id, f.parentId);
        put('friends', id, f);
      } else if (kind === 'deleteFriend') {
        need(get('friends', id), 'Бүртгэл олдсонгүй.', 404);
        need(!list('friends').some(f => f.parentId === id), 'Эхлээд энэ найзын урьсан найзуудын холбоосыг өөрчилнө үү.', 409);
        need(!list('sales').some(s => s.buyerId === id) && !list('orders').some(o => o.buyerId === id), 'Худалдан авалт эсвэл захиалгын түүхтэй найзыг устгахгүй. Идэвхгүй төлөвт оруулна уу.', 409);
        db.prepare('DELETE FROM records WHERE bucket=? AND id=?').run('friends', id);
      } else if (kind === 'deleteProduct') {
        need(get('products', id), 'Бүтээгдэхүүн олдсонгүй.', 404);
        need(!list('sales').some(s => s.productId === id) && !list('orders').some(o => o.productId === id) && !list('inventoryMovements').some(m => m.productId === id), 'Борлуулалт, захиалга эсвэл барааны хөдөлгөөний түүхтэй бүтээгдэхүүнийг устгах боломжгүй. Архивлана уу.', 409);
        db.prepare('DELETE FROM records WHERE bucket=? AND id=?').run('products', id);
        db.prepare('DELETE FROM records WHERE bucket=? AND id=?').run('notifications', 'stock-' + id);
      } else if (kind === 'product') {
        const oldProduct = get('products', id);
        const p = {
          name: text(input.name, 200, true), code: text(input.code, 100, true), category: text(input.category, 100, true),
          description: text(input.description, 2000), image: text(input.image, 1000), price: number(input.price),
          stock: oldProduct?.stock || 0, cost: oldProduct?.cost || 0, threshold: number(input.threshold, 1e6, true),
          status: input.status, createdAt: oldProduct?.createdAt || now, updatedAt: now
        };
        p.memberVisible = input.memberVisible === undefined ? !!oldProduct?.memberVisible : input.memberVisible === true || input.memberVisible === 'yes';
        need(!p.image || /^https:\/\//.test(p.image) || (/^\/media\/[a-f0-9-]{36}$/.test(p.image) && db.prepare('SELECT id FROM images WHERE id=?').get(p.image.slice(7))), 'Зургийн HTTPS холбоос эсвэл байршуулсан зураг сонгоно уу.');
        need(['active', 'inactive'].includes(p.status), 'Төлөв буруу байна.');
        need(!list('products').some(r => r.id !== id && r.code === p.code), 'Барааны код давхардлаа.', 409);
        put('products', id, p);
      } else if (kind === 'sale') {
        const p = get('products', input.productId);
        need(p && p.status === 'active', 'Идэвхтэй бүтээгдэхүүн сонгоно уу.');
        const qty = number(input.qty, 1e6, true), price = cash(input.price), extra = cash(input.extra);
        need(qty > 0 && p.stock >= qty, 'Барааны үлдэгдэл хүрэлцэхгүй байна.', 409);
        number(qty * price); number(qty * p.cost);
        const buyerId = text(input.buyerId, 80), buyer = buyerId ? get('friends', buyerId) : null;
        need(!buyerId || buyer, 'Худалдан авагч олдсонгүй.');
        need(['cash', 'transfer', 'card'].includes(input.payment), 'Төлбөрийн хэлбэр буруу байна.');
        const sale = {
          productId: p.id, productName: p.name, qty, price, cost: p.cost, total: qty * price,
          costTotal: qty * p.cost, extra, profit: qty * (price - p.cost) - extra, buyerId,
          buyerName: buyer ? `${buyer.surname} ${buyer.name}`.trim() : 'Бүртгэлгүй худалдан авагч',
          date: date(input.date), payment: input.payment, note: text(input.note, 2000), status: 'confirmed', createdAt: now, actor: actor.id
        };
        sale.paid = cash(input.paid === undefined ? sale.total : input.paid);
        sale.paymentTracking = 'verified';
        need(sale.paid <= sale.total, 'Төлсөн дүн нийт үнээс их байна.');
        need(sale.paid >= sale.total || buyer, 'Авлагатай борлуулалтад бүртгэлтэй найз сонгоно уу.');
        put('sales', id, sale);
        if (sale.paid > 0) put('payments', randomUUID(), { saleId: id, buyerId, buyerName: sale.buyerName, amount: sale.paid, type: 'payment', method: sale.payment, date: sale.date, note: 'Борлуулалтын эхний төлбөр', createdAt: now, actor: actor.id });
        put('products', p.id, { ...p, stock: p.stock - qty, updatedAt: now });
        put('inventoryMovements', randomUUID(), { productId: p.id, productName: p.name, qty: -qty, before: p.stock, after: p.stock - qty, cost: p.cost, type: 'sale', saleId: id, date: sale.date, note: sale.note, createdAt: now, actor: actor.id });
      } else if (kind === 'cancelSale') {
        const s = get('sales', id);
        need(s, 'Борлуулалт олдсонгүй.', 404);
        need(s.status === 'confirmed', 'Борлуулалт аль хэдийн цуцлагдсан.', 409);
        const p = get('products', s.productId); need(p, 'Бүтээгдэхүүн олдсонгүй.');
        const stock = p.stock + s.qty, cost = (p.stock * p.cost + s.qty * s.cost) / stock;
        const reason = text(input.note, 2000, true);
        put('products', p.id, { ...p, stock, cost, updatedAt: now });
        put('sales', id, { ...s, status: 'cancelled', cancelledAt: now, cancelReason: reason });
        put('inventoryMovements', randomUUID(), { productId: p.id, productName: p.name, qty: s.qty, before: p.stock, after: stock, cost: s.cost, type: 'cancel', saleId: id, date: today(), note: reason, createdAt: now, actor: actor.id });
      } else if (kind === 'inventory') {
        const p = get('products', input.productId); need(p, 'Бүтээгдэхүүн олдсонгүй.');
        need(['receive', 'count'].includes(input.type), 'Хөдөлгөөний төрөл буруу байна.');
        const qty = number(input.qty, 1e6, true), unitCost = number(input.cost);
        need(input.type === 'count' || qty > 0, 'Тоо ширхэг оруулна уу.');
        const after = input.type === 'count' ? qty : p.stock + qty;
        number(after, 1e9, true);
        const cost = input.type === 'receive' ? (p.stock * p.cost + qty * unitCost) / after : p.cost;
        put('products', p.id, { ...p, stock: after, cost, updatedAt: now });
        put('inventoryMovements', id, { productId: p.id, productName: p.name, qty: after - p.stock, before: p.stock, after, cost: input.type === 'receive' ? unitCost : p.cost, type: input.type, date: date(input.date), note: text(input.note, 2000, true), createdAt: now, actor: actor.id });
      } else if (kind === 'expense') {
        put('expenses', id, { name: text(input.name, 200, true), amount: number(input.amount), date: date(input.date), note: text(input.note, 2000), createdAt: now, actor: actor.id });
      } else if (['payment', 'refundPayment', 'reconcilePayment'].includes(kind)) {
        const s = get('sales', input.saleId); need(s, 'Борлуулалт олдсонгүй.', 404);
        need(['cash', 'transfer', 'card'].includes(input.method), 'Төлбөрийн хэлбэр буруу байна.');
        const amount = cash(input.amount), paymentDate = date(input.date), note = text(input.note, 2000);
        if (kind === 'reconcilePayment') {
          need(s.paymentTracking === 'unverified', 'Энэ борлуулалтын төлбөр өмнө нь баталгаажсан.', 409);
          need(amount <= s.total && (s.status === 'cancelled' || amount === s.total || s.buyerId), 'Дүн эсвэл худалдан авагчийн мэдээллээ шалгана уу.');
          put('sales', s.id, { ...s, paid: amount, paymentTracking: 'verified' });
        } else {
          need(s.paymentTracking === 'verified', 'Эхлээд хуучин төлбөрийн дүнг баталгаажуулна уу.', 409);
          need(amount > 0, 'Төлбөрийн дүн 0-ээс их байна.');
          if (kind === 'payment') {
            need(s.status === 'confirmed' && amount <= cash(s.total - s.paid), 'Авлагын үлдэгдлээс их эсвэл цуцлагдсан борлуулалт байна.', 409);
            put('sales', s.id, { ...s, paid: cash(s.paid + amount) });
          } else {
            need(s.status === 'cancelled' && amount <= s.paid, 'Буцаах төлбөрийн үлдэгдлээс их байна.', 409);
            put('sales', s.id, { ...s, paid: cash(s.paid - amount) });
          }
        }
        put('payments', id, { saleId: s.id, buyerId: s.buyerId, buyerName: s.buyerName, amount, type: kind === 'refundPayment' ? 'refund' : kind === 'reconcilePayment' ? 'opening' : 'payment', method: input.method, date: paymentDate, note, createdAt: now, actor: actor.id });
      } else if (kind === 'order') {
        const buyer = get('friends', input.buyerId), p = get('products', input.productId);
        need(buyer && p && p.status === 'active', 'Найз болон идэвхтэй бүтээгдэхүүн сонгоно уу.');
        const qty = number(input.qty, 1e6, true), price = cash(input.price); need(qty > 0, 'Тоо ширхэг оруулна уу.'); number(qty * price);
        put('orders', id, { buyerId: buyer.id, buyerName: `${buyer.surname} ${buyer.name}`.trim(), phone: text(input.phone, 30), address: text(input.address, 1000, true), productId: p.id, productName: p.name, qty, price, total: qty * price, date: date(input.date), deliveryDate: input.deliveryDate ? date(input.deliveryDate) : '', note: text(input.note, 2000), status: 'new', saleId: '', createdAt: now, actor: actor.id });
      } else if (kind === 'orderStatus') {
        const o = get('orders', id); need(o, 'Захиалга олдсонгүй.', 404);
        need(o.status === input.expectedStatus, 'Захиалгын төлөв өөрчлөгдсөн байна. Дахин ачаална уу.', 409);
        need((o.status === 'new' && ['prepared', 'cancelled'].includes(input.status)) || (o.status === 'prepared' && ['delivered', 'cancelled'].includes(input.status)), 'Төлөвийн шилжилт зөвшөөрөгдөөгүй.', 409);
        if (input.status === 'delivered') {
          const p = get('products', o.productId); need(p && p.stock >= o.qty, 'Хүргэлт баталгаажуулахад барааны үлдэгдэл хүрэлцэхгүй.', 409);
          const saleId = randomUUID(), paid = cash(input.paid), extra = cash(input.extra);
          need(paid <= o.total && ['cash', 'transfer', 'card'].includes(input.payment), 'Төлбөрийн мэдээллээ шалгана уу.');
          const s = { productId: p.id, productName: o.productName, qty: o.qty, price: o.price, cost: p.cost, total: o.total, costTotal: o.qty * p.cost, extra, profit: o.total - o.qty * p.cost - extra, buyerId: o.buyerId, buyerName: o.buyerName, date: date(input.date), payment: input.payment, note: o.note, status: 'confirmed', paid, paymentTracking: 'verified', orderId: id, createdAt: now, actor: actor.id };
          put('sales', saleId, s);
          if (paid > 0) put('payments', randomUUID(), { saleId, buyerId: s.buyerId, buyerName: s.buyerName, amount: paid, type: 'payment', method: s.payment, date: s.date, note: 'Хүргэлтийн төлбөр', createdAt: now, actor: actor.id });
          put('products', p.id, { ...p, stock: p.stock - o.qty, updatedAt: now });
          put('inventoryMovements', randomUUID(), { productId: p.id, productName: p.name, qty: -o.qty, before: p.stock, after: p.stock - o.qty, cost: p.cost, type: 'sale', saleId, date: s.date, note: 'Захиалга хүргэсэн', createdAt: now, actor: actor.id });
          put('orders', id, { ...o, status: 'delivered', saleId, deliveredAt: now });
          result.saleId = saleId;
        } else put('orders', id, { ...o, status: input.status, updatedAt: now });
      } else if (kind === 'ackNotification') {
        const n = get('notifications', id); need(n, 'Мэдэгдэл олдсонгүй.', 404); put('notifications', id, { ...n, readAt: now });
      } else if (kind === 'importLegacy') {
        need(Array.isArray(input.friends) && Array.isArray(input.sales) && input.friends.length + input.sales.length <= 1000, 'Импортын бүтэц буруу эсвэл 1000 бүртгэлээс их байна.');
        const importHash = createHash('sha256').update(JSON.stringify({ friends: input.friends, sales: input.sales })).digest('hex');
        need(!get('imports', importHash), 'Энэ файлыг өмнө нь импортолсон байна.', 409);
        const mapping = new Map();
        for (const f of input.friends) {
          need((Number.isInteger(f.id) && f.id > 0) || (typeof f.id === 'string' && f.id.length < 81), 'Хуучин найзын дугаар буруу байна.');
          need(!mapping.has(String(f.id)), 'Хуучин найзын дугаар давхардлаа.'); mapping.set(String(f.id), randomUUID());
        }
        for (const f of input.friends) {
          const parentId = f.parent === null || f.parent === undefined || f.parent === 'root' ? '' : mapping.get(String(f.parent));
          need(parentId !== undefined, 'Хуучин модонд байхгүй эцэг холбоос байна.');
          need(['Хэрэглэгч найз', 'Хөгжүүлэгч найз', 'customer', 'developer'].includes(f.type), 'Хуучин найзын төрөл буруу байна.');
          put('friends', mapping.get(String(f.id)), { surname: '', name: text(f.name, 100, true), phone: '', date: today(), type: ['Хөгжүүлэгч найз', 'developer'].includes(f.type) ? 'developer' : 'customer', parentId, member: '', address: '', note: 'Хуучин хувилбараас импортолсон. Огноо нь импортын огноо.', status: 'active', legacyId: String(f.id), importedAt: now });
        }
        for (const id of mapping.values()) checkParent(id, get('friends', id).parentId);
        for (const s of input.sales) {
          const qty = number(s.qty, 1e6, true), price = number(s.price), cost = number(s.cost);
          need(qty > 0, 'Хуучин борлуулалтын тоо буруу байна.'); number(qty * price); number(qty * cost);
          put('legacySales', randomUUID(), { name: text(s.name, 200, true), qty, price, cost, total: qty * price, profit: qty * (price - cost), importedAt: now, importHash });
        }
        put('imports', importHash, { friends: input.friends.length, sales: input.sales.length, importedAt: now, actor: actor.id });
        result = { friends: input.friends.length, sales: input.sales.length };
      } else throw new Problem('Үйлдэл олдсонгүй.', 404);
      if (['product', 'sale', 'cancelSale', 'inventory', 'orderStatus'].includes(kind)) {
        const productId = kind === 'product' ? id : kind === 'cancelSale' ? get('sales', id).productId : kind === 'orderStatus' ? get('orders', id).productId : input.productId;
        const p = get('products', productId); if (p) stockAlert(p);
      }
      put('audit', randomUUID(), { actor: actor.id, kind, recordId: result.id || '', createdAt: now });
      db.prepare('INSERT INTO operations VALUES(?,?,?,?,?)').run(input.operationId, actor.id, kind, fingerprint, JSON.stringify(result));
      return result;
    });
  }
  atomic(() => { for (const p of list('products')) stockAlert(p); });
  return { db, list, get, put, atomic, mutate };
}
