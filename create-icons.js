const fs = require('fs');
const path = require('path');

// Create a simple 512x512 PNG with a green background and white car
// This is a minimal PNG file (we'll create a solid color PNG)

function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  // Rest of IHDR data for RGBA...
  
  // For simplicity, let's just copy a pre-made minimal PNG
  // Actually, let's create a solid color PNG using raw pixel data
  
  const zlib = require('zlib');
  
  // Create raw image data (RGBA)
  const rawData = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rawData[i * 4] = r;     // R
    rawData[i * 4 + 1] = g; // G
    rawData[i * 4 + 2] = b; // B
    rawData[i * 4 + 3] = 255; // A
  }
  
  // Compress
  const compressed = zlib.deflateSync(rawData);
  
  // Build PNG
  const chunks = [];
  chunks.push(signature);
  
  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  chunks.push(createChunk('IHDR', ihdrData));
    
  // IDAT
  chunks.push(createChunk('IDAT', compressed));
    
  // IEND
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
