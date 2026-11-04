import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {Writable} from 'node:stream';
import {mkdirSync,writeFileSync,chmodSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createMailer} from '../lib/mailer.mjs';
let muted=false;
const output=new Writable({write(chunk,encoding,done){if(!muted)stdout.write(chunk);done();}});
const prompt=createInterface({input:stdin,output,terminal:!!stdin.isTTY});
try{
  if(process.platform!=='linux'||process.getuid()!==0||!stdin.isTTY)throw new Error('Run interactively as root on Ubuntu.');
  const env={};
  env.SMTP_HOST=(await prompt.question('SMTP hostname: ')).trim();
  env.SMTP_PORT=(await prompt.question('SMTP port (587 STARTTLS / 465 TLS): ')).trim();
  if(!['465','587'].includes(env.SMTP_PORT))throw new Error('Use the provider TLS port: 465 or 587.');
  env.SMTP_SECURE=env.SMTP_PORT==='465'?'true':'false';
  env.SMTP_USER=(await prompt.question('SMTP username: ')).trim();
  stdout.write('SMTP password / SMTP API key (hidden): ');muted=true;env.SMTP_PASSWORD=await prompt.question('');muted=false;stdout.write('\n');
  env.SMTP_FROM=(await prompt.question('Verified sender email: ')).trim();
  if(Object.values(env).some(value=>/[\r\n\0]/.test(value)))throw new Error('Values must be single lines.');
  const mailer=createMailer(env);if(!mailer.enabled)throw new Error('Incomplete SMTP configuration.');
  console.log('Checking SMTP TLS/authentication (no email is sent)...');
  await mailer.verify();
  mkdirSync('/etc/handari',{recursive:true,mode:0o750});
  const quote=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';
  writeFileSync('/etc/handari/smtp.env',Object.entries(env).map(([key,value])=>key+'='+quote(value)).join('\n')+'\n',{mode:0o600});chmodSync('/etc/handari/smtp.env',0o600);
  mkdirSync('/etc/systemd/system/handari.service.d',{recursive:true,mode:0o755});
  writeFileSync('/etc/systemd/system/handari.service.d/smtp.conf','[Service]\nEnvironmentFile=/etc/handari/smtp.env\n',{mode:0o644});
  execFileSync('systemctl',['daemon-reload']);execFileSync('systemctl',['restart','handari']);
  console.log('SMTP authentication passed. Test delivery with HANDARI → Forgot password. Configuration: /etc/handari/smtp.env');
}catch(error){muted=false;console.error('SMTP setup failed; check the hostname, port, sender and credentials.',error.code||'');process.exitCode=1;}
finally{prompt.close();}
