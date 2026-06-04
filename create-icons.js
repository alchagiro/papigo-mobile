const fs = require('fs');
const path = require('path');

// Create a simple 512x512 PNG with a green background and white car
// This is a minimal PNG file (we'll create a solid color PNG)

function createPNG(width, height, r, g, b, drawP = false) {
  const zlib = require('zlib');
  const rawData = Buffer.alloc(width * height * 4);
  
  for (let i = 0; i < width * height; i++) {
    rawData[i * 4] = r;
    rawData[i * 4 + 1] = g;
    rawData[i * 4 + 2] = b;
    rawData[i * 4 + 3] = 255;
  }
  
  if (drawP) {
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const radius = Math.floor(Math.min(width, height) * 0.35);
    const thickness = Math.floor(radius * 0.25);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= radius && dist >= radius - thickness) {
          const idx = (y * width + x) * 4;
          rawData[idx] = 255;
          rawData[idx + 1] = 255;
          rawData[idx + 2] = 255;
          rawData[idx + 3] = 255;
        }
      }
    }
  }
  
  const compressed = zlib.deflateSync(rawData);
  
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [signature];
  
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  chunks.push(createChunk('IHDR', ihdrData));
  chunks.push(createChunk('IDAT', compressed));
  chunks.push(createChunk('IEND', Buffer.alloc(0)));
  
  return Buffer.concat(chunks);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
    
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
    
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
    
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Create icons
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Green background icons (matching the app theme)
const icon512 = createPNG(512, 512, 0, 171, 103);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), icon512);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), icon512);
fs.writeFileSync(path.join(assetsDir, 'splash.png'), icon512);

// Create smaller version
const icon192 = createPNG(192, 192, 0, 171, 103);
fs.writeFileSync(path.join(assetsDir, 'icon-192x192.png'), icon192);

console.log('Icons created successfully!');
