import { copyFileSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

const base = 'C:\\Users\\Awesome\\Desktop\\HANDARI_v1.0';

const logoSrc = join(base, 'public', 'assets', 'handarilogo.png');
const logoDst = join(base, 'public', 'assets', 'handari_logo.png');

const iconSrc = join(base, 'public', 'handdariicon.jpg');
const iconDst = join(base, 'public', 'icon.png');

console.log('Reading logo from:', logoSrc);
const logoData = readFileSync(logoSrc);
console.log('Logo size:', logoData.length, 'bytes, header:', Buffer.from(logoData.slice(0, 20)).toString('hex'));

console.log('Writing logo to:', logoDst);
writeFileSync(logoDst, logoData);
console.log('Logo written:', statSync(logoDst).size, 'bytes');

console.log('Reading icon from:', iconSrc);
const iconData = readFileSync(iconSrc);
console.log('Icon size:', iconData.length, 'bytes, header:', Buffer.from(iconData.slice(0, 20)).toString('hex'));

console.log('Writing icon to:', iconDst);
writeFileSync(iconDst, iconData);
console.log('Icon written:', statSync(iconDst).size, 'bytes');

console.log('DONE - Files copied successfully');