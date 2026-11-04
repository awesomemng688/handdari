import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../lib/store.mjs';
test('v1.4.2 activates existing waiting members once, preserving roles, passwords, suspended users and later admin decisions',()=>{
  const dir=mkdtempSync(join(tmpdir(),'handari-open-signup-')),path=join(dir,'test.sqlite');let store;
  try{
    store=openStore(path);
    const insert=store.db.prepare('INSERT INTO users(id,email,name,password,role,status) VALUES(?,?,?,?,?,?)');
    insert.run('waiting','waiting@example.com','Waiting','unchanged-hash','customer','pending');
    insert.run('blocked','blocked@example.com','Blocked','blocked-hash','customer','suspended');
    insert.run('owner','owner@example.com','Owner','owner-hash','admin','active');
    store.db.exec('PRAGMA user_version=4');store.db.close();store=openStore(path);
    let row=store.db.prepare("SELECT * FROM users WHERE id='waiting'").get();
    assert.equal(row.status,'active');assert.equal(row.role,'customer');assert.equal(row.password,'unchanged-hash');assert.equal(row.revision,1);
    assert.equal(store.db.prepare("SELECT status FROM users WHERE id='blocked'").get().status,'suspended');
    assert.equal(store.db.prepare("SELECT role FROM users WHERE id='owner'").get().role,'admin');
    store.db.prepare("UPDATE users SET status='pending' WHERE id='waiting'").run();store.db.close();store=openStore(path);
    assert.equal(store.db.prepare("SELECT status FROM users WHERE id='waiting'").get().status,'pending');
  }finally{store?.db.close();rmSync(dir,{recursive:true,force:true});}
});
