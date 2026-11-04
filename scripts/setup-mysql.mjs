import {existsSync,mkdirSync,writeFileSync,chmodSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),envPath='/etc/handari/database.env';
let stopped=false,activated=false;
function ctl(...args){return execFileSync('systemctl',args,{stdio:'pipe'});}
try{
  if(process.platform!=='linux'||process.getuid()!==0)throw new Error('Run as root on Ubuntu.');
  if(existsSync('/etc/systemd/system/handari.service.d/database.conf'))throw new Error('A database switch is already configured. Use check-database.mjs; do not migrate twice.');
  if(!existsSync('/var/lib/handari/handari.sqlite'))throw new Error('Original SQLite database was not found.');
  if(!existsSync(envPath)){
    const cli=existsSync('/usr/bin/mariadb')?'/usr/bin/mariadb':'/usr/bin/mysql';
    const sql=query=>execFileSync(cli,['--protocol=socket','-uroot','--batch','--skip-column-names'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
    const database='handari_business',user='handari_app',password=randomBytes(32).toString('hex');
    if(sql("SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='handari_business'")!=='0')throw new Error('handari_business already exists. No existing database was modified.');
    if(sql("SELECT COUNT(*) FROM mysql.user WHERE User='handari_app'")!=='0')throw new Error('handari_app already exists. Choose a separate account manually.');
    sql(`CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; CREATE USER '${user}'@'127.0.0.1' IDENTIFIED BY '${password}'; GRANT ALL PRIVILEGES ON ${database}.* TO '${user}'@'127.0.0.1';`);
    mkdirSync('/etc/handari',{recursive:true,mode:0o750});
    writeFileSync(envPath,`DB_DRIVER=mysql\nMYSQL_HOST=127.0.0.1\nMYSQL_PORT=3306\nMYSQL_DATABASE=${database}\nMYSQL_USER=${user}\nMYSQL_PASSWORD=${password}\n`,{mode:0o600});chmodSync(envPath,0o600);
    console.log('Created dedicated handari_business database and restricted database account. Password stored in root-only /etc/handari/database.env.');
  }
  process.loadEnvFile(envPath);
  let running=false;try{ctl('is-active','--quiet','handari');running=true;}catch{}
  if(running){ctl('stop','handari');stopped=true;}
  console.log('Backing up SQLite and migrating; app remains stopped during transfer.');
  execFileSync(process.execPath,[root+'/scripts/migrate-mysql.mjs','/var/lib/handari/handari.sqlite','/var/backups/handari/migrations'],{env:process.env,stdio:'inherit'});
  execFileSync(process.execPath,[root+'/scripts/check-database.mjs'],{env:process.env,stdio:'inherit'});
  mkdirSync('/etc/systemd/system/handari.service.d',{recursive:true,mode:0o755});
  writeFileSync('/etc/systemd/system/handari.service.d/database.conf','[Service]\nEnvironmentFile=/etc/handari/database.env\n',{mode:0o644});
  mkdirSync('/etc/systemd/system/handari-backup.service.d',{recursive:true,mode:0o755});
  writeFileSync('/etc/systemd/system/handari-backup.service.d/database.conf',`[Service]\nEnvironmentFile=/etc/handari/database.env\nExecStart=\nExecStart=${process.execPath} /var/handari/scripts/backup-daily.mjs\n`,{mode:0o644});
  activated=true;ctl('daemon-reload');ctl('restart','handari');ctl('is-active','--quiet','handari');
  console.log('HANDARI switched to MariaDB. Original SQLite and verified backup remain intact. Log in again and verify your data.');
}catch(error){
  if(stopped&&!activated)try{ctl('start','handari');}catch{}
  console.error('Database switch did not finish. '+(activated?'Check systemctl status handari and database environment.':'SQLite configuration remains active. Check local MariaDB root socket access and migration output.'));
  if(error.message&&!error.stderr)console.error(error.message);
  process.exitCode=1;
}
