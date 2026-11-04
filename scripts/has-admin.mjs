import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const path = process.env.DB_PATH || fileURLToPath(new URL('../data/handari.sqlite', import.meta.url));
if (!existsSync(path)) process.exit(1);
const db = new DatabaseSync(path, { readOnly: true });
try { process.exitCode = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n ? 0 : 1; }
finally { db.close(); }
