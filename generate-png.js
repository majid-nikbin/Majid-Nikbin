import fs from 'fs';
import zlib from 'zlib';

function generatePNG(width, height, filename) {
  // Color values
  const bgR = 15, bgG = 23, bgB = 42; // #0F172A
  const cyanR = 34, cyanG = 211, cyanB = 238; // #22D3EE
  const redR = 239, redG = 68, redB = 68; // #EF4444

  const rowSize = 1 + width * 4; // 1 filter byte (0) + 4 bytes per pixel (RGBA)
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        if (dist >= radius - 8 && dist <= radius) {
          // Cyan Ring
          rawData[pxOffset] = cyanR;
          rawData[pxOffset + 1] = cyanG;
          rawData[pxOffset + 2] = cyanB;
          rawData[pxOffset + 3] = 255;
        } else if (dist < radius * 0.7 && y < cy && Math.abs(dx) < (cy - y) * 0.4) {
          // North Arrow (Red)
          rawData[pxOffset] = redR;
          rawData[pxOffset + 1] = redG;
          rawData[pxOffset + 2] = redB;
          rawData[pxOffset + 3] = 255;
        } else if (dist < radius * 0.7 && y >= cy && Math.abs(dx) < (y - cy) * 0.4) {
          // South Arrow (Cyan)
          rawData[pxOffset] = cyanR;
          rawData[pxOffset + 1] = cyanG;
          rawData[pxOffset + 2] = cyanB;
          rawData[pxOffset + 3] = 255;
        } else if (dist <= 16) {
          // Center cap
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = 255;
        } else {
          // Dial background (#020617)
          rawData[pxOffset] = 2;
          rawData[pxOffset + 1] = 6;
          rawData[pxOffset + 2] = 23;
          rawData[pxOffset + 3] = 255;
        }
      } else {
        // App background (#0F172A)
        rawData[pxOffset] = bgR;
        rawData[pxOffset + 1] = bgG;
        rawData[pxOffset + 2] = bgB;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  const finalPng = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
  fs.writeFileSync(filename, finalPng);
  console.log(`Saved valid PNG ${filename} (${width}x${height})`);
}

function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(12 + length);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4, 4, 'ascii');
  data.copy(buffer, 8);

  const crc = calculateCRC(buffer.subarray(4, 8 + length));
  buffer.writeUInt32BE(crc, 8 + length);
  return buffer;
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function calculateCRC(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

generatePNG(192, 192, './public/icon-192.png');
generatePNG(512, 512, './public/icon-512.png');
generatePNG(512, 512, './public/icon-maskable-512.png');
generatePNG(540, 720, './public/screenshot-mobile.png');
generatePNG(1280, 720, './public/screenshot-desktop.png');
