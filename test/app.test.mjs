import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, unlinkSync, rmdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.mjs';
import { openStore } from '../lib/store.mjs';
import { hashPassword } from '../lib/auth.mjs';
const owner = { id: 'owner', role: 'admin' };
const op = body => ({ ...body, operationId: randomUUID() });
const product = { id: 'product-1', name: 'Туршилтын бараа', code: 'TEST-1', category: 'Бусад', description: '', image: '', price: 150, threshold: 2, status: 'active' };
const receipt = { productId: 'product-1', type: 'receive', qty: 10, cost: 100, date: '2026-11-04', note: 'Тест хүлээн авалт' };
const sale = { productId: 'product-1', qty: 3, price: 150, extra: 10, payment: 'transfer', buyerId: '', date: '2026-11-04', note: '' };
const friend = { surname: 'Тест', name: 'Найз', phone: '99112233', date: '2026-11-04', type: 'customer', parentId: '', member: '', address: '', note: '', status: 'active' };

test('HTTP: auth, CSRF, roles, duplicate requests, overselling, cancellation, password and asset isolation', async t => {
  const { server, store: s } = createApp({ dbPath: ':memory:' });
  const password = 'test-password-long-enough', hash = await hashPassword(password);
  for (const role of ['admin', 'customer']) s.db.prepare('INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)').run(role, role + '@example.test', role, hash, role);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise(r => server.close(r)); s.db.close(); });
  const base = 'http://127.0.0.1:' + server.address().port; let cookie = '';
  async function request(path, body, headers = {}) {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3100' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    let result; try { result = await response.json(); } catch {}
    return { response, result };
  }
  assert.equal((await request('/api/data')).response.status, 401);
  assert.equal((await request('/api/login', { email: 'admin@example.test', password: 'wrong' })).response.status, 401);
  assert.equal((await request('/api/login', { email: 'admin@example.test', password }, { Origin: 'https://evil.example' })).response.status, 403);
  let r = await request('/api/login', { email: 'customer@example.test', password }); cookie = r.response.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/me')).result.user.role, 'customer');
  assert.equal((await request('/api/data')).response.status, 403);
  assert.equal((await request('/api/action/product', op(product))).response.status, 403);
  await request('/api/logout', {}); assert.equal((await request('/api/me')).response.status, 401);
  r = await request('/api/login', { email: 'admin@example.test', password }); cookie = r.response.headers.get('set-cookie').split(';')[0];
  assert.match(r.response.headers.get('set-cookie'), /HttpOnly/); assert.match(r.response.headers.get('set-cookie'), /SameSite=Strict/);
  assert.equal((await request('/api/action/product', op(product))).response.status, 200);
  const receive = op(receipt);
  const responses = await Promise.all([request('/api/action/inventory', receive), request('/api/action/inventory', receive)]);
  assert.ok(responses.every(r => r.response.status === 200)); assert.equal(s.get('products', 'product-1').stock, 10); assert.equal(s.list('inventoryMovements').length, 1);
  const first = op(sale); r = await request('/api/action/sale', first); const saleId = r.result.id;
  assert.equal(r.response.status, 200); assert.equal(s.get('sales', saleId).profit, 140); assert.equal(s.get('products', 'product-1').stock, 7);
  await request('/api/action/sale', first); assert.equal(s.get('products', 'product-1').stock, 7);
  assert.equal((await request('/api/action/sale', { ...first, qty: 2 })).response.status, 409);
  assert.equal((await request('/api/action/sale', op({ ...sale, qty: 99 }))).response.status, 409); assert.equal(s.list('sales').length, 1);
  await request('/api/action/inventory', op({ ...receipt, qty: 3, cost: 200 })); assert.equal(s.get('products', 'product-1').cost, 130);
  const cancel = op({ id: saleId, note: 'Тест буцаалт' }); await request('/api/action/cancelSale', cancel);
  assert.equal(s.get('products', 'product-1').stock, 13); assert.ok(Math.abs(s.get('products', 'product-1').cost - 1600 / 13) < 1e-9);
  await request('/api/action/cancelSale', cancel); assert.equal(s.get('products', 'product-1').stock, 13);
  assert.equal((await request('/api/action/cancelSale', op({ id: saleId, note: 'Дахин' }))).response.status, 409);
  assert.equal((await request('/api/action/friend', op(friend))).response.status, 200);
  assert.equal((await request('/api/action/friend', op({ ...friend, phone: '99 11-22 33' }))).response.status, 409);
  for (const bad of [{ amount: -1, date: '2026-11-04' }, { amount: 1, date: '2026-99-99' }]) assert.equal((await request('/api/action/expense', op({ name: 'Тээвэр', note: '', ...bad }))).response.status, 400);
  r = await request('/api/data'); assert.equal(r.response.headers.get('cache-control'), 'no-store');
  for (const path of ['/data/handari.sqlite', '/server.mjs', '/legacy/firebase.js', '/firebase.js']) assert.equal((await request(path)).response.status, 404);
  for (const path of ['/', '/assets/handari_logo.png', '/assets/facebook_qr.png', '/icon-192.png', '/manifest.webmanifest']) assert.equal((await fetch(base + path)).status, 200);
  assert.equal((await request('/api/password', { current: password, password: 'new-password-long-enough' })).response.status, 200);
  assert.equal((await request('/api/me')).response.status, 401);
});

test('transaction rollback and competing sales never leave partial records or negative stock', async () => {
  const s = openStore(':memory:');
  try {
    s.mutate(owner, 'product', op(product)); s.mutate(owner, 'inventory', op({ ...receipt, qty: 1 }));
    s.db.exec("CREATE TRIGGER fail_op BEFORE INSERT ON operations BEGIN SELECT RAISE(ABORT,'simulated disk failure'); END;");
    assert.throws(() => s.mutate(owner, 'sale', op({ ...sale, qty: 1 })), /simulated disk failure/);
    assert.equal(s.get('products', 'product-1').stock, 1); assert.equal(s.list('sales').length, 0); assert.equal(s.list('inventoryMovements').length, 1);
    s.db.exec('DROP TRIGGER fail_op;');
    const outcomes = await Promise.allSettled([1, 2].map(() => Promise.resolve().then(() => s.mutate(owner, 'sale', op({ ...sale, qty: 1 })))));
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1); assert.equal(s.get('products', 'product-1').stock, 0);
  } finally { s.db.close(); }
});

test('friend tree rejects cycles and deleting parents; legacy import preserves graph, archives sales and rolls back invalid input', () => {
  const s = openStore(':memory:');
  try {
    s.mutate(owner, 'friend', op({ ...friend, id: 'parent' }));
    s.mutate(owner, 'friend', op({ ...friend, id: 'child', phone: '', parentId: 'parent' }));
    assert.throws(() => s.mutate(owner, 'friend', op({ ...friend, id: 'parent', parentId: 'child' })), /тойрог/);
    assert.throws(() => s.mutate(owner, 'deleteFriend', op({ id: 'parent' })), /холбоос/);
    const imported = { friends: [{ id: 1, parent: null, name: 'Хуучин найз', type: 'Хөгжүүлэгч найз' }, { id: 2, parent: 1, name: 'Урьсан найз', type: 'Хэрэглэгч найз' }], sales: [{ name: 'Хуучин бараа', qty: 2, price: 100, cost: 50 }] };
    s.mutate(owner, 'importLegacy', op(imported));
    const rows = s.list('friends').filter(f => f.legacyId); assert.equal(rows.length, 2);
    assert.equal(rows.find(f => f.legacyId === '2').parentId, rows.find(f => f.legacyId === '1').id);
    assert.equal(s.list('legacySales')[0].profit, 100); assert.equal(s.list('sales').length, 0); assert.equal(s.list('inventoryMovements').length, 0);
    assert.throws(() => s.mutate(owner, 'importLegacy', op(imported)), /өмнө нь/);
    const before = s.list('friends').length;
    assert.throws(() => s.mutate(owner, 'importLegacy', op({ friends: [{ id: 3, parent: 4, name: 'A', type: 'customer' }, { id: 4, parent: 3, name: 'B', type: 'customer' }], sales: [] })), /тойрог/);
    assert.equal(s.list('friends').length, before);
    assert.throws(() => s.mutate(owner, 'importLegacy', op({ friends: [{ id: 5, parent: null, name: 'A', type: 'customer' }], sales: [{ name: 'Bad', qty: -1, price: 100, cost: 1 }] })), /Тоон/);
    assert.equal(s.list('friends').length, before);
  } finally { s.db.close(); }
});

test('online backup creates a consistent, restorable database', () => {
  const dir = mkdtempSync(join(tmpdir(), 'handari-test-')), source = join(dir, 'source.sqlite'), dest = join(dir, 'backup.sqlite'), s = openStore(source);
  try {
    s.mutate(owner, 'product', op(product)); s.mutate(owner, 'inventory', op(receipt));
    execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/backup.mjs', import.meta.url)), dest], { env: { ...process.env, DB_PATH: source }, stdio: 'pipe' });
    const restored = openStore(dest);
    try { assert.equal(restored.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok'); assert.equal(restored.get('products', 'product-1').stock, 10); }
    finally { restored.db.close(); }
  } finally { s.db.close(); for (const file of readdirSync(dir)) unlinkSync(join(dir, file)); rmdirSync(dir); }
});
