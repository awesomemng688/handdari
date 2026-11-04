import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {openMysql,mysqlConfig} from '../lib/database.mjs';
import {allTables,tableDigest} from '../lib/transfer.mjs';
let db;
try{
  if(process.env.DB_DRIVER==='mysql'){
    db=openMysql(mysqlConfig());
    for(const table of allTables){const result=db.prepare('CHECK TABLE `'+table+'` QUICK').all();if(result.some(row=>row.Msg_type==='error'))throw new Error('CHECK TABLE failed: '+table);}
  }else{
    const path=resolve(process.env.DB_PATH||'data/handari.sqlite');if(!existsSync(path))throw new Error('SQLite file does not exist.');db=new DatabaseSync(path,{readOnly:true});
    if(db.prepare('PRAGMA quick_check').all().some(row=>row.quick_check!=='ok'))throw new Error('SQLite integrity check failed.');
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Foreign key check failed.');
  }
  const tables={};for(const name of allTables){try{tables[name]=tableDigest(db,name).count;}catch(error){if(db.dialect==='mysql')throw error;}}
  console.log(JSON.stringify({engine:db.dialect||'sqlite',integrity:'ok',tables},null,2));
}catch(error){console.error(error.message);process.exitCode=1;}finally{db?.close();}
