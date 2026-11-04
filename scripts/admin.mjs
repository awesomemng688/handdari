import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openStore, need } from '../lib/store.mjs';
import { hashPassword } from '../lib/auth.mjs';
let muted = false;
const output = new Writable({ write(chunk, encoding, done) { if (!muted) stdout.write(chunk); done(); } });
const terminal = createInterface({ input: stdin, output, terminal: !!stdin.isTTY });
try {
  const email = (await terminal.question('Email: ')).trim().toLowerCase();
  need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length < 255, 'Имэйл хаяг буруу байна.');
  const name = (await terminal.question('Name: ')).trim(); need(name.length > 0 && name.length <= 100, 'Нэр 1–100 тэмдэгт байна.');
  stdout.write('Password (12+ characters, hidden): '); muted = true;
  const password = await terminal.question(''); muted = false; stdout.write('\n');
  stdout.write('Repeat password (hidden): '); muted = true;
  const again = await terminal.question(''); muted = false; stdout.write('\n');
  need(password === again, 'Нууц үг таарахгүй байна.');
  const encoded = await hashPassword(password);
  const { db, atomic } = openStore(process.env.DB_PATH || fileURLToPath(new URL('../data/handari.sqlite', import.meta.url)));
  const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (existing) need(await terminal.question('Reset this user, revoke sessions, grant admin? Type RESET: ') === 'RESET', 'Үйлдэл цуцлагдлаа.');
  atomic(() => {
    if (existing) { db.prepare("UPDATE users SET name=?,password=?,role=?,status='active',mustChangePassword=0,revision=revision+1 WHERE id=?").run(name, encoded, 'admin', existing.id); db.prepare('DELETE FROM sessions WHERE userId=?').run(existing.id); }
    else db.prepare('INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)').run(randomUUID(), email, name, encoded, 'admin');
  });
  db.close(); console.log('Админ бүртгэл бэлэн.');
} catch (e) { muted = false; console.error(e.message); process.exitCode = 1; }
finally { terminal.close(); }
