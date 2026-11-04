import { fileURLToPath } from 'node:url';
import { runDailyBackup } from '../lib/backup.mjs';
const root = new URL('../', import.meta.url);
try {
  const result = await runDailyBackup({
    source: process.env.DB_PATH || fileURLToPath(new URL('data/handari.sqlite', root)),
    directory: process.env.BACKUP_DIRECTORY || fileURLToPath(new URL('backups', root)),
    keyFile: process.env.BACKUP_ENCRYPTION_KEY_FILE || fileURLToPath(new URL('data/backup.key', root)),
    retentionDays: Number(process.env.BACKUP_RETENTION_DAYS || 30),
    remote: process.env.BACKUP_REMOTE_HOST ? { host: process.env.BACKUP_REMOTE_HOST, user: process.env.BACKUP_REMOTE_USER, port: Number(process.env.BACKUP_REMOTE_PORT || 22), directory: process.env.BACKUP_REMOTE_DIRECTORY, identity: process.env.BACKUP_SSH_IDENTITY, knownHosts: process.env.BACKUP_KNOWN_HOSTS } : null
  });
  console.log('Шифрлэсэн нөөц бэлэн: ' + result.destination);
  console.log(result.remoteComplete ? 'Гаднын серверт амжилттай хууллаа.' : 'Зөвхөн локал нөөц. Гаднын сервер тохируулаагүй.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
