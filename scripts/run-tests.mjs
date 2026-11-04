import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const files=readdirSync(new URL('../test/',import.meta.url)).filter(name=>name.endsWith('.test.mjs')).map(name=>'test/'+name);
// Routine checks must never inherit production database credentials as a target.
const result=spawnSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit',env:{...process.env,DB_DRIVER:'sqlite',RUN_MYSQL_TESTS:'0'}});
process.exitCode=result.status??1;
