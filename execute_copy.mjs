import { readFileSync, writeFileSync, statSync, existsSync } from 'fs';

const base = 'C:\\Users\\Awesome\\Desktop\\HANDARI_v1.0';

const logoSrc = base + '\\public\\assets\\handarilogo.png';
const logoDst = base + '\\public\\assets\\handari_logo.png';
const iconSrc = base + '\\public\\handdariicon.jpg';
const iconDst = base + '\\public\\icon.png';

console.log('Checking source files...');
console.log('handarilogo.png exists:', existsSync(logoSrc), 'size:', existsSync(logoSrc) ? statSync(logoSrc).size : 'N/A');
console.log('handdariicon.jpg exists:', existsSync(iconSrc), 'size:', existsSync(iconSrc) ? statSync(iconSrc).size : 'N/A');

console.log('\nReading and copying...');
const logoData = readFileSync(logoSrc);
writeFileSync(logoDst, logoData);
console.log('Logo copied:', statSync(logoDst).size, 'bytes');

const iconData = readFileSync(iconSrc);
writeFileSync(iconDst, iconData);
console.log('Icon copied:', statSync(iconDst).size, 'bytes');

console.log('\nVerification:');
console.log('Logo match:', readFileSync(logoSrc).equals(readFileSync(logoDst)));
console.log('Icon match:', readFileSync(iconSrc).equals(readFileSync(iconDst)));

console.log('\nALL DONE!');