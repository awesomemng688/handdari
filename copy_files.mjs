import fs from 'fs';
import path from 'path';

const srcLogo = path.join('C:', 'Users', 'Awesome', 'Desktop', 'HANDARI_v1.0', 'public', 'assets', 'handarilogo.png');
const dstLogo = path.join('C:', 'Users', 'Awesome', 'Desktop', 'HANDARI_v1.0', 'public', 'assets', 'handari_logo.png');

const srcIcon = path.join('C:', 'Users', 'Awesome', 'Desktop', 'HANDARI_v1.0', 'public', 'handdariicon.jpg');
const dstIcon = path.join('C:', 'Users', 'Awesome', 'Desktop', 'HANDARI_v1.0', 'public', 'icon.png');

console.log('Source logo:', srcLogo, fs.existsSync(srcLogo), fs.statSync(srcLogo).size);
console.log('Source icon:', srcIcon, fs.existsSync(srcIcon), fs.statSync(srcIcon).size);

fs.copyFileSync(srcLogo, dstLogo);
console.log('Copied logo:', dstLogo, fs.statSync(dstLogo).size);

fs.copyFileSync(srcIcon, dstIcon);
console.log('Copied icon:', dstIcon, fs.statSync(dstIcon).size);

console.log('Done!');