import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const path = process.argv[2] || fileURLToPath(new URL('../data/backup.key', import.meta.url));
writeFileSync(path, randomBytes(32), { flag: 'wx', mode: 0o600 });
console.log('Нөөцийн түлхүүр үүсгэлээ. Файлыг тусдаа аюулгүй газар хадгал: ' + path);
