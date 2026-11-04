import { DatabaseSync } from 'node:sqlite';
import { copyFile, unlink, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decryptSnapshot, loadKey } from '../lib/backup.mjs';
const [source, destination] = process.argv.slice(2);
if (!source || !destination) { console.error('node scripts/decrypt-backup.mjs INPUT.hbk NEW-OUTPUT.sqlite'); process.exit(1); }
try { await access(destination); throw new Error('Гаралтын файл өмнө нь байна.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const partial = destination + '.partial';
let decrypted = false;
try {
  const key = await loadKey(process.env.BACKUP_ENCRYPTION_KEY_FILE || fileURLToPath(new URL('../data/backup.key', import.meta.url)));
  await decryptSnapshot(source, partial, key);
  decrypted = true;
  const db = new DatabaseSync(partial, { readOnly: true });
  try { if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Нөөцийн integrity шалгалт амжилтгүй.'); } finally { db.close(); }
  await copyFile(partial, destination, constants.COPYFILE_EXCL); await unlink(partial); decrypted = false; console.log('Шалгаж тайлсан нөөц: ' + destination);
} catch (e) { if (decrypted) await unlink(partial).catch(() => {}); console.error(e.message); process.exitCode = 1; }
