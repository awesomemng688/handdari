import fs from 'fs';
import path from 'path';

const src = path.join('C:', 'Users', 'Awesome', 'Desktop', 'HANDARI_v1.0', 'public', 'assets', 'handarilogo.png');
const dst = path.join('C:', 'Users', 'Awesome', 'Desktop', 'HANDARI_v1.0', 'public', 'assets', 'handari_logo.png');

console.log(`Reading ${src}...`);
const data = fs.readFileSync(src);
console.log(`Read ${data.length} bytes`);

console.log(`Writing ${dst}...`);
fs.writeFileSync(dst, data);
console.log(`Written ${fs.statSync(dst).size} bytes`);

const src2 = path.join('C:', 'Users', 'Awesome', 'Desktop', 'HANDARI_v1.0', 'public', 'handdariicon.jpg');
const dst2 = path.join('C:', 'Users', 'Awesome', 'Desktop', 'HANDARI_v1.0', 'public', 'icon.png');

console.log(`Reading ${src2}...`);
const data2 = fs.readFileSync(src2);
console.log(`Read ${data2.length} bytes`);

console.log(`Writing ${dst2}...`);
fs.writeFileSync(dst2, data2);
console.log(`Written ${fs.statSync(dst2).size} bytes`);

console.log('DONE!');