import {createHash} from 'node:crypto';
import {openStore,need} from './store.mjs';
import {createGoogleAuth} from './google.mjs';
import {createRecovery} from './recovery.mjs';
export const dataTables=['users','records','operations','images','googleIdentities'];
export const allTables=[...dataTables,'sessions','googleNonces','passwordResets','recoveryRequests'];
export function initializeLocal(path){
  const store=openStore(path,{driver:'sqlite'});createGoogleAuth(store);createRecovery(store,{origin:'http://127.0.0.1:3100',mailer:{enabled:false}});return store;
}
function clean(row){const result={};for(const key of Object.keys(row).sort()){if(['seq','friendLink'].includes(key))continue;result[key]=row[key] instanceof Uint8Array?{binary:Buffer.from(row[key]).toString('base64')}:row[key];}return result;}
export function tableDigest(db,table){
  need(allTables.includes(table),'Unknown database table.');
  const rows=db.prepare('SELECT * FROM `'+table+'`').all().map(row=>JSON.stringify(clean(row))).sort();
  return {count:rows.length,sha256:createHash('sha256').update(rows.join('\n')).digest('hex')};
}
export function copyTables(source,target,tables=allTables){
  const report={};
  for(const table of tables){
    need(allTables.includes(table),'Unknown database table.');
    need(target.prepare('SELECT COUNT(*) AS n FROM `'+table+'`').get().n===0,'Destination is not empty. Refusing to overwrite '+table);
    const order=table==='records'?' ORDER BY '+(source.dialect==='mysql'?'seq':'rowid'):'';
    for(const row of source.prepare('SELECT * FROM `'+table+'`'+order).all()){
      const keys=Object.keys(row).filter(key=>!['seq','friendLink'].includes(key));
      target.prepare('INSERT INTO `'+table+'`('+keys.map(key=>'`'+key+'`').join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...keys.map(key=>row[key]));
    }
    const before=tableDigest(source,table),after=tableDigest(target,table);need(before.count===after.count&&before.sha256===after.sha256,'Database verification failed: '+table);report[table]=before;
  }
  return report;
}
export function mysqlSnapshot(source,destination){
  const target=initializeLocal(destination);
  try{source.atomic(()=>target.atomic(()=>copyTables(source.db,target.db)));target.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');}
  finally{target.db.close();}
}
