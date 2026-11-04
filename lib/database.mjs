import {DatabaseSync} from 'node:sqlite';
import {Worker,MessageChannel,receiveMessageOnPort} from 'node:worker_threads';
import {mysqlSchema} from './mysql-schema.mjs';
export function mysqlConfig(env=process.env){
  if(!env.MYSQL_DATABASE||!env.MYSQL_USER||!env.MYSQL_PASSWORD)throw new Error('MYSQL_DATABASE, MYSQL_USER and MYSQL_PASSWORD are required.');
  return {host:env.MYSQL_HOST||'127.0.0.1',port:Number(env.MYSQL_PORT||3306),database:env.MYSQL_DATABASE,user:env.MYSQL_USER,password:env.MYSQL_PASSWORD,...(env.MYSQL_SOCKET?{socketPath:env.MYSQL_SOCKET}:{})};
}
// Preserve the store's synchronous transaction contract. Network I/O runs on a
// dedicated worker/connection; no main-thread promises run inside transactions.
// Intended for this small business app on a local DB, not high-throughput APIs.
export function openMysql(config=mysqlConfig(),{initialize=false}={}){
  const signal=new SharedArrayBuffer(4),flag=new Int32Array(signal),{port1,port2}=new MessageChannel();
  const worker=new Worker(new URL('./mysql-worker.mjs',import.meta.url),{workerData:{config,port:port2,signal},transferList:[port2],execArgv:[]});
  worker.unref();port1.unref();let closed=false,broken=false;worker.on('error',()=>{broken=true;});
  function normalize(value){if(value instanceof Uint8Array)return Buffer.from(value);if(Array.isArray(value))return value.map(normalize);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,normalize(v)]));return value;}
  function rpc(sql,params=[],kind='query'){
    if(closed||broken)throw new Error('Database connection is closed.');
    Atomics.store(flag,0,0);port1.postMessage({sql,params,kind});
    if(Atomics.wait(flag,0,0,30000)==='timed-out'){broken=true;worker.terminate();throw new Error('Database timeout. Restart HANDARI after checking MariaDB.');}
    const message=receiveMessageOnPort(port1)?.message;if(!message){broken=true;throw new Error('Database worker did not return a result.');}
    if(message.error){const error=new Error(message.error.message);error.code=message.error.code;throw error;}
    return normalize(message.result);
  }
  function sql(source){return source.replace(/ORDER BY rowid/gi,'ORDER BY seq').replace('INSERT INTO records VALUES(?,?,?) ON CONFLICT(bucket,id) DO UPDATE SET payload=excluded.payload','INSERT INTO records(bucket,id,payload) VALUES(?,?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload)');}
  const db={dialect:'mysql',config,
    prepare(source){return {
      all(...params){
        if(source==='PRAGMA table_info(users)')return rpc('SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=\'users\'');
        if(source==='PRAGMA user_version')return [{user_version:rpc('SELECT version FROM handari_meta WHERE id=1')[0].version}];
        return rpc(sql(source),params);
      },get(...params){return this.all(...params)[0];},run(...params){const result=rpc(sql(source),params);return {changes:result.affectedRows,lastInsertRowid:result.insertId};}
    };},
    exec(source){
      if(source==='BEGIN IMMEDIATE'){rpc('START TRANSACTION');try{rpc('SELECT id FROM handari_lock WHERE id=1 FOR UPDATE');}catch(error){rpc('ROLLBACK');throw error;}return;}
      if(source.startsWith('PRAGMA user_version=')){rpc('UPDATE handari_meta SET version=? WHERE id=1',[Number(source.match(/=(\d+)/)[1])]);return;}
      rpc(source);
    },
    close(){if(closed)return;try{if(!broken)rpc('',[],'close');}finally{closed=true;port1.close();worker.terminate();}}
  };
  try{
    if(initialize)for(const statement of mysqlSchema)rpc(statement);
    else {const rows=rpc('SELECT version FROM handari_meta WHERE id=1');if(rows[0]?.version!==5)throw new Error('HANDARI MariaDB schema is not initialized. Run the migration first.');}
    return db;
  }catch(error){db.close();throw error;}
}
export function openDatabase(path,options={}){
  const driver=options.driver||(path===':memory:'?'sqlite':process.env.DB_DRIVER||'sqlite');
  if(driver==='mysql')return openMysql(options.mysql||mysqlConfig(),{initialize:options.initialize});
  if(driver!=='sqlite')throw new Error('Unsupported DB_DRIVER. Use sqlite or mysql.');
  const db=new DatabaseSync(path,{timeout:5000});db.dialect='sqlite';return db;
}
