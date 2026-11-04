import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, readFile, writeFile, appendFile, rename, unlink, stat, readdir, open } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { existsSync } from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createGzip, createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import { join, resolve, basename } from 'node:path';
import { openStore, need } from './store.mjs';
import { mysqlSnapshot } from './transfer.mjs';
const HEADER = Buffer.from('HANDARI2');
export async function loadKey(path) { const key = await readFile(path); need(key.length === 32, 'Нөөцийн шифрлэх түлхүүр 32 byte байх ёстой.'); return key; }
export async function encryptSnapshot(source, destination, key) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  await writeFile(destination, Buffer.concat([HEADER, iv]), { flag: 'wx', mode: 0o600 });
  await pipeline(createReadStream(source), createGzip(), cipher, createWriteStream(destination, { flags: 'a' }));
  await appendFile(destination, cipher.getAuthTag());
}
export async function decryptSnapshot(source, destination, key) {
  const info = await stat(source); need(info.size > 36, 'Нөөцийн файл дутуу байна.');
  const file = await open(source, 'r'); let prefix, tag;
  try { prefix = Buffer.alloc(20); tag = Buffer.alloc(16); await file.read(prefix, 0, 20, 0); await file.read(tag, 0, 16, info.size - 16); } finally { await file.close(); }
  need(prefix.subarray(0, 8).equals(HEADER), 'Нөөцийн формат буруу байна.');
  const decipher = createDecipheriv('aes-256-gcm', key, prefix.subarray(8)); decipher.setAuthTag(tag);
  const output = await open(destination, 'wx', 0o600);
  try {
    await pipeline(createReadStream(source, { start: 20, end: info.size - 17 }), decipher, createGunzip(), output.createWriteStream());
  } catch (error) { await unlink(destination).catch(() => {}); throw error; }
}
function sftpPath(value) { need(typeof value === 'string' && !/[\r\n"\\]/.test(value), 'SFTP хавтасны зам буруу байна.'); return '"' + value + '"'; }
export async function sendSftp(local, remote) {
  need(/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(remote.host) && /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(remote.user), 'SSH host/user тохиргоо буруу байна.');
  need(Number.isInteger(remote.port) && remote.port > 0 && remote.port < 65536, 'SSH порт буруу байна.');
  need(/^\/[a-zA-Z0-9_./-]+$/.test(remote.directory) && !remote.directory.split('/').includes('..'), 'Гаднын нөөцийн абсолют хавтасны зам оруулна уу.');
  need(remote.identity && remote.knownHosts, 'SSH identity болон known_hosts тохиргоо шаардлагатай.');
  const target = remote.directory.replace(/\/$/, '') + '/' + basename(local);
  const batch = `put ${sftpPath(local)} ${sftpPath(target + '.partial')}\nrename ${sftpPath(target + '.partial')} ${sftpPath(target)}\n`;
  await new Promise((resolveJob, reject) => {
    const child = spawn('sftp', ['-b', '-', '-P', String(remote.port), '-i', remote.identity, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'UserKnownHostsFile=' + remote.knownHosts, remote.user + '@' + remote.host], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
    const timer = setTimeout(() => { child.kill(); reject(new Error('SFTP хугацаа хэтэрлээ.')); }, 120000);
    let detail = ''; child.stderr.on('data', b => { if (detail.length < 4000) detail += b; });
    child.stdin.on('error', () => {}); child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('exit', code => { clearTimeout(timer); code === 0 ? resolveJob() : reject(new Error('SFTP хуулалт амжилтгүй: ' + detail.slice(-500))); });
    child.stdin.end(batch);
  });
}
export async function runDailyBackup(config, transfer = sendSftp) {
  const directory = resolve(config.directory); await mkdir(directory, { recursive: true, mode: 0o700 });
  const name = 'handari-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomBytes(3).toString('hex');
  const snapshot = join(directory, name + '.sqlite.partial'), partial = join(directory, name + '.hbk.partial'), destination = join(directory, name + '.hbk');
  let localComplete = false, remoteComplete = false;
  const status = { startedAt: new Date().toISOString(), remoteConfigured: !!config.remote?.host, localComplete, remoteComplete };
  function saveStatus(extra) {
    if (config.driver!=='mysql'&&!existsSync(config.source)) return;
    const store = openStore(config.source,{driver:config.driver||'sqlite'});
    try { store.put('settings', 'backupStatus', { ...status, localComplete, remoteComplete, ...extra }); } finally { store.db.close(); }
  }
  try {
    const key = await loadKey(config.keyFile);
    await writeFile(snapshot, Buffer.alloc(0), { flag: 'wx', mode: 0o600 });
    if(config.driver==='mysql'){
      const store=openStore(':mysql:',{driver:'mysql'});try{mysqlSnapshot(store,snapshot);}finally{store.db.close();}
    }else{
      const db = new DatabaseSync(config.source, { readOnly: true });
      try { await backup(db, snapshot); } finally { db.close(); }
    }
    await encryptSnapshot(snapshot, partial, key); await rename(partial, destination); localComplete = true;
    if (config.remote?.host) { await transfer(destination, config.remote); remoteComplete = true; }
    saveStatus({ completedAt: new Date().toISOString(), status: remoteComplete ? 'remote-success' : 'local-only' });
    // Only remove this tool's old completed encrypted backups, never another file.
    const retention = config.retentionDays ?? 30; need(Number.isInteger(retention) && retention >= 1, 'Нөөц хадгалах хоног буруу байна.');
    for (const file of await readdir(directory, { withFileTypes: true })) {
      if (!file.isFile() || !/^handari-\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f0-9]{6}\.hbk$/.test(file.name)) continue;
      const path = join(directory, file.name);
      if (path !== destination && (await stat(path)).mtimeMs < Date.now() - retention * 86400000) await unlink(path);
    }
    return { destination, localComplete, remoteComplete };
  } catch (error) {
    saveStatus({ completedAt: new Date().toISOString(), status: 'failed', error: localComplete ? 'Локал нөөц бэлэн. Гаднын хуулалт эсвэл хадгалалтын цэвэрлэгээ амжилтгүй.' : 'Нөөц үүсгэж чадсангүй. Серверийн log болон түлхүүрийн тохиргоог шалгана уу.' });
    throw error;
  } finally { await unlink(snapshot).catch(() => {}); await unlink(partial).catch(() => {}); }
}
