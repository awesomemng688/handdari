import fs from 'fs';

const files = [
  'C:/Users/Awesome/Desktop/HANDARI_v1.0/public/assets/handarilogo.png',
  'C:/Users/Awesome/Desktop/HANDARI_v1.0/public/assets/handari_logo.png',
  'C:/Users/Awesome/Desktop/HANDARI_v1.0/public/handdariicon.jpg',
  'C:/Users/Awesome/Desktop/HANDARI_v1.0/public/icon.png',
  'C:/Users/Awesome/Desktop/HANDARI_v1.0/public/icon-192.png',
];

console.log('=== FILE SIZES ===');
for (const f of files) {
  if (fs.existsSync(f)) {
    const stats = fs.statSync(f);
    console.log(`${f}: ${stats.size} bytes`);
  } else {
    console.log(`${f}: NOT FOUND`);
  }
}

console.log('\n=== COPYING ===');
const src1 = files[0];
const dst1 = files[1];
const data1 = fs.readFileSync(src1);
fs.writeFileSync(dst1, data1);
console.log(`Copied logo: ${data1.length} -> ${fs.statSync(dst1).size} bytes`);

const src2 = files[2];
const dst2 = files[3];
const data2 = fs.readFileSync(src2);
fs.writeFileSync(dst2, data2);
console.log(`Copied icon: ${data2.length} -> ${fs.statSync(dst2).size} bytes`);

console.log('\n=== AFTER COPY ===');
for (const f of [dst1, dst2]) {
  const stats = fs.statSync(f);
  console.log(`${f}: ${stats.size} bytes`);
}