const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const inputPath = 'C:/Users/Systemedic/.gemini/antigravity/brain/be33aeb8-df47-49e3-b214-27624f9f1de9/.user_uploaded/media_1793217660390_34724368.png';
const publicDir = path.resolve(__dirname, '../client/public');

async function processLogo() {
  console.log('Loading input image...');
  const image = sharp(inputPath);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // 1. Flood fill to remove background outside hexagon
  const isOutside = new Uint8Array(width * height);
  const queue = [];

  // Consider pixel background if RGB components are all > 235
  function isBg(x, y) {
    const idx = (y * width + x) * channels;
    return data[idx] > 235 && data[idx + 1] > 235 && data[idx + 2] > 235;
  }

  // Seed with outer perimeter
  for (let x = 0; x < width; x++) {
    if (isBg(x, 0)) { isOutside[x] = 1; queue.push(x, 0); }
    if (isBg(x, height - 1)) { isOutside[(height - 1) * width + x] = 1; queue.push(x, height - 1); }
  }
  for (let y = 0; y < height; y++) {
    if (isBg(0, y) && !isOutside[y * width]) { isOutside[y * width] = 1; queue.push(0, y); }
    if (isBg(width - 1, y) && !isOutside[y * width + (width - 1)]) {
      isOutside[y * width + (width - 1)] = 1;
      queue.push(width - 1, y);
    }
  }

  // Breadth-First Flood Fill
  let head = 0;
  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];

    const neighbors = [
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const npos = ny * width + nx;
        if (!isOutside[npos] && isBg(nx, ny)) {
          isOutside[npos] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }

  // Create clean RGBA buffer with transparent outside
  const outputData = Buffer.from(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = y * width + x;
      const idx = pos * channels;
      if (isOutside[pos]) {
        outputData[idx + 3] = 0; // Alpha = 0
      } else {
        // Slight anti-aliasing on the 1-pixel boundary
        let isBoundary = false;
        const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (isOutside[ny * width + nx]) {
              isBoundary = true;
              break;
            }
          }
        }
        if (isBoundary) {
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          if (brightness > 200) {
            outputData[idx + 3] = Math.max(0, Math.min(255, Math.round(255 - (brightness - 200) * 4)));
          }
        }
      }
    }
  }

  // Create base transparent trimmed sharp image
  const transparentBase = sharp(outputData, {
    raw: { width, height, channels: 4 }
  });

  // Get trimmed bounding box as PNG buffer
  const trimmedBuffer = await transparentBase.trim().png().toBuffer();
  console.log('Trimmed transparent buffer created.');

  // Save master transparent logo
  await sharp(trimmedBuffer)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'logo.png'));
  console.log('Generated client/public/logo.png');

  // 1. icon-512.png (transparent background, 512x512, padded with fit: contain)
  await sharp(trimmedBuffer)
    .resize(480, 480, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 16, bottom: 16, left: 16, right: 16,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Generated client/public/icon-512.png');

  // 2. icon-192.png (transparent background, 192x192)
  await sharp(trimmedBuffer)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 6, bottom: 6, left: 6, right: 6,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('Generated client/public/icon-192.png');

  // 3. icon-512-maskable.png (Android safe zone = inner 80% circle, on sleek dark slate #0b1329)
  await sharp(trimmedBuffer)
    .resize(380, 380, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 66, bottom: 66, left: 66, right: 66,
      background: { r: 11, g: 19, b: 41, alpha: 1 } // #0b1329 matches dark hex border & theme
    })
    .png()
    .toFile(path.join(publicDir, 'icon-512-maskable.png'));
  console.log('Generated client/public/icon-512-maskable.png');

  // 4. icon-192-maskable.png
  await sharp(trimmedBuffer)
    .resize(142, 142, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 25, bottom: 25, left: 25, right: 25,
      background: { r: 11, g: 19, b: 41, alpha: 1 }
    })
    .png()
    .toFile(path.join(publicDir, 'icon-192-maskable.png'));
  console.log('Generated client/public/icon-192-maskable.png');

  // 5. apple-touch-icon.png (180x180, iOS non-transparent with dark background #0b1329)
  await sharp(trimmedBuffer)
    .resize(150, 150, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 15, bottom: 15, left: 15, right: 15,
      background: { r: 11, g: 19, b: 41, alpha: 1 }
    })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated client/public/apple-touch-icon.png');

  // 6. favicon.png (32x32)
  await sharp(trimmedBuffer)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Generated client/public/favicon.png');

  // 7. Update icon-512.svg with embedded base64 of 512 png for fallback svg viewers
  const png512Base64 = fs.readFileSync(path.join(publicDir, 'icon-512.png')).toString('base64');
  const svg512Content = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <image href="data:image/png;base64,${png512Base64}" width="512" height="512" />
</svg>`;
  fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), svg512Content, 'utf-8');
  fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), svg512Content, 'utf-8');
  console.log('Generated client/public/icon-512.svg and icon-192.svg');

  console.log('All icons generated successfully!');
}

processLogo().catch(console.error);
