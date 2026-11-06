import fs from 'fs';

const base = 'C:/Users/Awesome/Desktop/HANDARI_v1.0';

const src1 = base + '/public/assets/handarilogo.png';
const dst1 = base + '/public/assets/handari_logo.png';
const src2 = base + '/public/handdariicon.jpg';
const dst2 = base + '/public/icon.png';

console.log('=== COPYING ===');

// Copy logo
const data1 = fs.readFileSync(src1);
fs.writeFileSync(dst1, data1);
console.log(`Logo: ${src1} (${data1.length} bytes) -> ${dst1} (${fs.statSync(dst1).size} bytes)`);

// Copy icon
const data2 = fs.readFileSync(src2);
fs.writeFileSync(dst2, data2);
console.log(`Icon: ${src2} (${data2.length} bytes) -> ${dst2} (${fs.statSync(dst2).size} bytes)`);

// Verify
console.log('\n=== VERIFICATION ===');
console.log(`Logo match: ${fs.readFileSync(src1).equals(fs.readFileSync(dst1))}`);
console.log(`Icon match: ${fs.readFileSync(src2).equals(fs.readFileSync(dst2))}`);
console.log('\nDone!');