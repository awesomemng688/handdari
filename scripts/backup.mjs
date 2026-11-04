import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, chmodSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = process.env.DB_PATH || fileURLToPath(new URL('../data/handari.sqlite', import.meta.url));
const destination = resolve(process.argv[2] || fileURLToPath(new URL('../backups/handari-' + new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite', import.meta.url)));
if (existsSync(destination)) throw new Error('Ижил нэртэй файл байна. Шинэ нөөцийн нэр сонгоно уу.');
mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(source, { readOnly: true });
try { await backup(db, destination); chmodSync(destination, 0o600); console.log('Нөөц хуулбар: ' + destination); }
finally { db.close(); }
