import { readFileSync, writeFileSync, statSync } from 'fs';

const base = 'C:\\Users\\Awesome\\Desktop\\HANDARI_v1.0';

const logoSrc = base + '\\public\\assets\\handarilogo.png';
const logoDst = base + '\\public\\assets\\handari_logo.png';

const iconSrc = base + '\\public\\handdariicon.jpg';
const iconDst = base + '\\public\\icon.png';

console.log('Reading logo...');
const logoData = readFileSync(logoSrc);
console.log('Logo bytes:', logoData.length, 'header:', Buffer.from(logoData.slice(0, 8)).toString('hex'));

writeFileSync(logoDst, logoData);
console.log('Logo written:', statSync(logoDst).size);

console.log('Reading icon...');
const iconData = readFileSync(iconSrc);
console.log('Icon bytes:', iconData.length, 'header:', Buffer.from(iconData.slice(0, 8)).toString('hex'));

writeFileSync(iconDst, iconData);
console.log('Icon written:', statSync(iconDst).size);

console.log('SUCCESS');