const fs = require('fs');
const path = require('path');

// Copy handarilogo.png to handari_logo.png
const srcLogo = path.join(__dirname, 'public', 'assets', 'handarilogo.png');
const dstLogo = path.join(__dirname, 'public', 'assets', 'handari_logo.png');

const srcIcon = path.join(__dirname, 'public', 'handdariicon.jpg');
const dstIcon = path.join(__dirname, 'public', 'icon.png');

try {
    fs.copyFileSync(srcLogo, dstLogo);
    console.log(`Copied logo: ${dstLogo}`);
} catch (e) {
    console.error(`Error copying logo: ${e.message}`);
}

try {
    fs.copyFileSync(srcIcon, dstIcon);
    console.log(`Copied icon: ${dstIcon}`);
} catch (e) {
    console.error(`Error copying icon: ${e.message}`);
}

// Verify
for (const f of [dstLogo, dstIcon]) {
    const stats = fs.statSync(f);
    console.log(`${f}: ${stats.size} bytes`);
}