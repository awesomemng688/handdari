const fs = require('fs');
const src1 = 'C:/Users/Awesome/Desktop/HANDARI_v1.0/public/assets/handarilogo.png';
const dst1 = 'C:/Users/Awesome/Desktop/HANDARI_v1.0/public/assets/handari_logo.png';
const src2 = 'C:/Users/Awesome/Desktop/HANDARI_v1.0/public/handdariicon.jpg';
const dst2 = 'C:/Users/Awesome/Desktop/HANDARI_v1.0/public/icon.png';

const data1 = fs.readFileSync(src1);
fs.writeFileSync(dst1, data1);
console.log('Logo:', src1, data1.length, '->', dst1, fs.statSync(dst1).size);

const data2 = fs.readFileSync(src2);
fs.writeFileSync(dst2, data2);
console.log('Icon:', src2, data2.length, '->', dst2, fs.statSync(dst2).size);

console.log('DONE');