// Run with: node scripts/build-icons.cjs
// Uses the Sharp version shipped with Next.js. Source artwork is kept in assets/brand.
const fs = require('node:fs/promises');
const { createRequire } = require('node:module');
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const source = 'assets/brand/logo-master.png';
const background = '#eee8ff';
async function appIcon(size, maskable = false) {
    const markSize = Math.round(size * (maskable ? 0.72 : 0.9));
    const mark = await sharp(source).resize(markSize, markSize).png().toBuffer();
    return sharp({ create: { width: size, height: size, channels: 3, background } })
        .composite([{ input: mark, gravity: 'centre' }]).removeAlpha().png().toBuffer();
}
async function main() {
    await fs.mkdir('public/icons', { recursive: true });
    await sharp(source).resize(512, 512).png().toFile('public/icons/logo.png');
    for (const size of [192, 512, 1024]) await fs.writeFile(`public/icons/icon-${size}.png`, await appIcon(size));
    for (const size of [192, 512]) await fs.writeFile(`public/icons/maskable-${size}.png`, await appIcon(size, true));
    await fs.writeFile('public/icons/apple-touch-icon.png', await appIcon(180));
    const frames = await Promise.all([16, 32, 48].map(size => sharp(source).resize(size, size).png().toBuffer()));
    const header = Buffer.alloc(6 + frames.length * 16);
    header.writeUInt16LE(1, 2); header.writeUInt16LE(frames.length, 4);
    let offset = header.length;
    frames.forEach((frame, index) => {
        const entry = 6 + index * 16;
        header[entry] = header[entry + 1] = [16, 32, 48][index];
        header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
        header.writeUInt32LE(frame.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
        offset += frame.length;
    });
    await fs.writeFile('src/app/favicon.ico', Buffer.concat([header, ...frames]));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
