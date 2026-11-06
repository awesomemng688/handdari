const fs = require('fs');
const path = require('path');

const src = path.join('C:', 'Users', 'Awesome', 'Desktop', 'HANDARI_v1.0', 'public', 'assets', 'handarilogo.png');
const dst = path.join('C:', 'Users', 'Awesome', 'Desktop', 'HANDARI_v1.0', 'public', 'assets', 'handari_logo.png');

console.log('Reading:', src);
const data = fs.readFileSync(src);
console.log('Size:', data.length);

console.log('Writing:', dst);
fs.writeFileSync(dst, data);
console.log('Written:', fs.statSync(dst).size);

const src2 = path.join('C:', 'Users', 'Awesome', 'Desktop', 'HANDARI_v1.0', 'public', 'handdariicon.jpg');
const dst2 = path.join('C:', 'Users', 'Awesome', 'Desktop', 'HANDARI_v1.0', 'public', 'icon.png');

console.log('Reading:', src2);
const data2 = fs.readFileSync(src2);
console.log('Size:', data2.length);

console.log('Writing:', dst2);
fs.writeFileSync(dst2, data2);
console.log('Written:', fs.statSync(dst2).size);

console.log('DONE');