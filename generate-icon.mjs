import sharp from 'sharp';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#667eea"/>
      <stop offset="100%" stop-color="#764ba2"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <polyline
    points="108,268 204,364 348,188"
    fill="none" stroke="white" stroke-width="54"
    stroke-linecap="round" stroke-linejoin="round"
    opacity="0.38"
  />
  <polyline
    points="160,268 256,364 400,188"
    fill="none" stroke="white" stroke-width="54"
    stroke-linecap="round" stroke-linejoin="round"
  />
</svg>
`;

const buf = Buffer.from(svg);

await sharp(buf).resize(512, 512).png().toFile('public/icon-512.png');
await sharp(buf).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(buf).resize(180, 180).png().toFile('public/icon-180.png');

console.log('Icons generated: icon-512.png, icon-192.png, icon-180.png');
