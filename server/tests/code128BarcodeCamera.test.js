import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCode128Geometry, decodeCode128FromImageData, encodeCode128B, CODE128_PATTERNS, decodeCode128BRuns } from '../../client/src/utils/code128.js';

const makeImage = (code, scale = 4) => {
  const geometry = buildCode128Geometry(code);
  const width = (geometry.moduleWidth * scale) + 120;
  const height = 260;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = 248; data[offset + 1] = 248; data[offset + 2] = 248; data[offset + 3] = 255;
  }
  for (const bar of geometry.bars) {
    const startX = 60 + (bar.x * scale);
    const endX = startX + (bar.width * scale);
    for (let y = 55; y < 205; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const offset = ((y * width) + x) * 4;
        data[offset] = 8; data[offset + 1] = 8; data[offset + 2] = 8;
      }
    }
  }
  return { imageData: { data }, width, height };
};

test('Code 128-B employee barcode generator round-trips common employee codes', () => {
  for (const code of ['IT-001', 'SALES-023', 'ADMIN-9', 'A_B.C-17']) {
    const runs = [];
    for (const symbol of encodeCode128B(code)) {
      const pattern = CODE128_PATTERNS[symbol];
      for (let index = 0; index < pattern.length; index += 1) {
        runs.push({ dark: index % 2 === 0, length: Number(pattern[index]) * 3 });
      }
    }
    assert.equal(decodeCode128BRuns(runs), code);
  }
});

test('camera fallback decoder reads generated Code 128 barcodes from synthetic camera frames', () => {
  for (const code of ['IT-001', 'SALES-023', 'ADMIN-9']) {
    for (const scale of [2, 3, 4, 6]) {
      const { imageData, width, height } = makeImage(code, scale);
      assert.equal(decodeCode128FromImageData(imageData, width, height), code);
    }
  }
});
