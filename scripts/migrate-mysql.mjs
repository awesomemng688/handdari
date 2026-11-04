import {DatabaseSync,backup} from 'node:sqlite';
import {existsSync,mkdirSync,chmodSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {openStore,need} from '../lib/store.mjs';
import {initializeLocal,copyTables,dataTables,allTables} from '../lib/transfer.mjs';
import {mysqlConfig} from '../lib/database.mjs';
const source=resolve(process.argv[2]||'/var/lib/handari/handari.sqlite');
const folder=resolve(process.argv[3]||'/var/backups/handari/migrations');
let local,target;
try{
  need(existsSync(source),'Source SQLite database was not found.');mkdirSync(folder,{recursive:true,mode:0o700});
  const name='before-mysql-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomBytes(3).toString('hex'),snapshot=join(folder,name+'.sqlite');
  const db=new DatabaseSync(source,{readOnly:true});try{await backup(db,snapshot);chmodSync(snapshot,0o600);}finally{db.close();}
  console.log('SQLite backup preserved: '+snapshot);
  local=initializeLocal(snapshot);
  need(local.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND status='active'").get().n>0,'An active admin is required before switching databases.');
  target=openStore(':mysql:',{driver:'mysql',mysql:mysqlConfig(),initialize:true});
  let report;
  target.atomic(()=>{
    for(const table of allTables)need(target.db.prepare('SELECT COUNT(*) AS n FROM `'+table+'`').get().n===0,'Target database is not empty. No records were overwritten.');
    report=copyTables(local.db,target.db,dataTables);
  });
  const path=join(folder,name+'-verified.json');writeFileSync(path,JSON.stringify({source,snapshot,completedAt:new Date().toISOString(),tables:report,sessions:'revoked; users must log in again'},null,2),{mode:0o600});
  console.log('Migration COMMITTED and verified (counts + SHA-256 including photos/password hashes). Report: '+path);
  console.log('SQLite source is unchanged. Configure the handari systemd database environment only after this success.');
}catch(error){console.error('Migration failed: '+error.message);process.exitCode=1;}
finally{target?.db.close();local?.db.close();}
