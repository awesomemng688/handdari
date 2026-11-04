import {workerData} from 'node:worker_threads';
import mysql from 'mysql2/promise';
const {port,signal,config}=workerData,flag=new Int32Array(signal);
let connection,failed;
try{
  connection=await mysql.createConnection({...config,charset:'utf8mb4_bin',jsonStrings:true,supportBigNumbers:true,bigNumberStrings:false,multipleStatements:false,connectTimeout:10000});
  connection.on('error',()=>{failed=true;});
  await connection.query("SET SESSION innodb_lock_wait_timeout=10");
}catch(error){failed=error;}
port.on('message',async message=>{
  try{
    if(failed)throw new Error('Database connection unavailable; restart HANDARI after checking database configuration.');
    let result;
    if(message.kind==='close'){await connection.end();result=null;}
    else{
      const params=message.params.map(value=>value instanceof Uint8Array?Buffer.from(value):value);
      [result]=params.length?await connection.execute({sql:message.sql,timeout:20000},params):await connection.query({sql:message.sql,timeout:20000});
    }
    port.postMessage({result});
  }catch(error){port.postMessage({error:{code:error.code||'DATABASE_ERROR',message:error.code==='ER_DUP_ENTRY'?'UNIQUE constraint failed':error.code==='ER_NO_REFERENCED_ROW_2'?'Foreign key constraint failed':'MariaDB query failed. Check schema, permissions and database availability.'}});}
  finally{Atomics.store(flag,0,1);Atomics.notify(flag,0);}
});
