import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, inflateSync } from 'node:zlib';
const root = fileURLToPath(new URL('../TECH_DOCS/', import.meta.url));
const entries = await readdir(root, { withFileTypes: true });
assert(
  entries.every((entry) => entry.isFile()),
  'TECH_DOCS must remain flat.',
);
const read = (name) => readFile(path.join(root, name));
const spec = JSON.parse(await read('CF_ART_SPEC.json'));
assert.equal(spec.version, 'cf-avatar-art-1');
assert.deepEqual(spec.frame, {
  width: 48,
  height: 64,
  anchor: { x: 24, y: 56 },
  padding: 0,
  spacing: 0,
});
assert.deepEqual(spec.directions, ['north', 'east', 'south', 'west']);
assert.deepEqual(
  spec.phases.map((p) => p.adultHeadOffsetY),
  [0, -1, 0, -1, 0, -1],
);
assert.deepEqual(
  spec.phases.map((p) => p.childHeadOffsetY),
  [0, -1, 0, -1, 0, -1],
);
assert.equal(spec.rigs.length, 12);
assert.equal(new Set(spec.rigs.map((r) => r.id)).size, 12);
assert.equal(spec.palettes.skin.length, 10);
assert.equal(spec.palettes.hair.length, 12);
assert.equal(spec.palettes.fabric.length, 12);

// Decode PNG with built-in zlib only; the validator needs no image-processing package.
function decode(data) {
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let offset = 8,
    w,
    h;
  const idat = [];
  while (offset < data.length) {
    const size = data.readUInt32BE(offset),
      type = data.toString('ascii', offset + 4, offset + 8),
      bytes = data.subarray(offset + 8, offset + 8 + size);
    assert.equal(
      crc32(data.subarray(offset + 4, offset + 8 + size)),
      data.readUInt32BE(offset + 8 + size),
      `PNG CRC ${type}`,
    );
    if (type === 'IHDR') {
      w = bytes.readUInt32BE(0);
      h = bytes.readUInt32BE(4);
      assert.equal(bytes[8], 8);
      assert.equal(bytes[9], 6, 'PNG must be RGBA');
      assert.equal(bytes[12], 0, 'No interlacing');
    }
    if (type === 'IDAT') idat.push(bytes);
    offset += size + 12;
    if (type === 'IEND') break;
  }
  assert(w && h && w <= 2048 && h <= 2048);
  const stride = w * 4,
    raw = inflateSync(Buffer.concat(idat), { maxOutputLength: (stride + 1) * h }),
    rgba = Buffer.alloc(stride * h);
  assert.equal(raw.length, (stride + 1) * h);
  const paeth = (a, b, c) => {
    const p = a + b - c,
      pa = Math.abs(p - a),
      pb = Math.abs(p - b),
      pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    assert(filter <= 4);
    for (let i = 0; i < stride; i++) {
      const p = y * stride + i,
        a = i >= 4 ? rgba[p - 4] : 0,
        b = y ? rgba[p - stride] : 0,
        c = y && i >= 4 ? rgba[p - stride - 4] : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? a
            : filter === 2
              ? b
              : filter === 3
                ? Math.floor((a + b) / 2)
                : paeth(a, b, c);
      rgba[p] = (raw[y * (stride + 1) + i + 1] + predictor) & 255;
    }
  }
  return { w, h, rgba };
}
const pngs = new Map();
for (const entry of entries.filter((e) => e.name.endsWith('.png'))) {
  const image = decode(await read(entry.name));
  pngs.set(entry.name, image);
  const { w, h, rgba } = image;
  if (entry.name.endsWith('_A24.png')) assert.deepEqual([w, h], [288, 256], entry.name);
  if (entry.name.endsWith('_V4.png')) assert.deepEqual([w, h], [48, 256], entry.name);
  if (entry.name.startsWith('REF_') || entry.name.startsWith('RIG_')) {
    if (!entry.name.includes('HAIR_KEEP') && !entry.name.includes('GRID'))
      for (const p of [0, w - 1, (h - 1) * w, h * w - 1])
        assert.equal(rgba[p * 4 + 3], 0, `${entry.name}: transparent corner`);
    const alphas = rgba.filter((_, i) => i % 4 === 3);
    if (entry.name.includes('EMPTY')) assert(alphas.every((a) => a === 0));
    else
      assert(
        alphas.some((a) => a > 0),
        `${entry.name}: unexpectedly empty`,
      );
  }
}
assert.equal(pngs.size, 47);
for (const rig of spec.rigs) {
  const name = `RIG_${rig.id}_A24.png`,
    img = pngs.get(name);
  assert(img, name);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 6; col++) {
      let count = 0;
      for (let y = 1; y < 63; y++)
        for (let x = 1; x < 47; x++)
          if (img.rgba[((row * 64 + y) * img.w + col * 48 + x) * 4 + 3]) count++;
      assert(count > 100, `${name} missing frame ${row * 6 + col}`);
    }
}
assert(
  (await read('REF_BODY_MASTER_A24.png')).equals(await read('RIG_male-adult-average_A24.png')),
);
for (const part of ['EYES', 'MOUTH', 'FRECKLES', 'BLUSH']) {
  for (const format of ['A24', 'V4']) {
    const img = pngs.get(`REF_${part}_${format}.png`);
    assert(
      img.rgba.subarray(0, img.w * 64 * 4).every((v, i) => i % 4 !== 3 || v === 0),
      `${part} should not be on the back of the head`,
    );
  }
}
// Head layers must match pixel-for-pixel after V4 expansion: no double bob or row bleed.
for (const name of [
  'EYES',
  'MOUTH',
  'FRECKLES',
  'BLUSH',
  'HAIR_BACK',
  'HAIR_FRONT',
  'HAT_BACK',
  'HAT_FRONT',
]) {
  const source = pngs.get(`REF_${name}_V4.png`),
    target = pngs.get(`REF_${name}_A24.png`);
  for (let row = 0; row < 4; row++)
    for (let phase = 0; phase < 6; phase++)
      for (let y = 0; y < 64; y++)
        for (let x = 0; x < 48; x++) {
          const sy = y - spec.phases[phase].adultHeadOffsetY,
            dst = ((row * 64 + y) * 288 + phase * 48 + x) * 4;
          const src = ((row * 64 + sy) * 48 + x) * 4,
            valid = sy >= 0 && sy < 64,
            alpha = valid ? source.rgba[src + 3] : 0;
          assert.equal(target.rgba[dst + 3], alpha, `${name}: V4 phase alignment`);
          if (alpha)
            for (let channel = 0; channel < 3; channel++)
              assert.equal(target.rgba[dst + channel], source.rgba[src + channel]);
        }
}
const contacts = JSON.parse(await read('CF_BODY_CONTACTS.json'));
assert.equal(contacts.rigs.length, 12);
for (const rig of contacts.rigs) {
  assert(spec.rigs.some((r) => r.id === rig.id));
  assert.equal(rig.frames.length, 24);
  for (const [i, frame] of rig.frames.entries()) {
    assert.equal(frame.index, i);
    assert.equal(frame.direction, spec.directions[Math.floor(i / 6)]);
    assert.equal(frame.phase, spec.phases[i % 6].name);
    assert.deepEqual(frame.anchor, { x: 24, y: 56 });
    for (const [key, p] of Object.entries(frame))
      if (typeof p === 'object')
        assert(
          Number.isInteger(p.x) &&
            p.x >= 0 &&
            p.x < 48 &&
            Number.isInteger(p.y) &&
            p.y >= 0 &&
            p.y < 64,
          `${rig.id} ${key}`,
        );
  }
}
const csv = (await read('CF_PRODUCTION_LIST.csv'))
  .toString('utf8')
  .replace(/^\uFEFF/, '')
  .trim()
  .split('\n')
  .map((line) => line.split(','));
assert.equal(csv.length - 1, 865);
assert.equal(new Set(csv.slice(1).map((r) => r[0])).size, 865);
const counts = {};
for (const row of csv.slice(1)) {
  assert.equal(row.length, 8);
  assert(spec.formats[row[4]]);
  assert(/^[a-z0-9_-]+\.png$/.test(row[0]));
  counts[row[1]] = (counts[row[1]] ?? 0) + 1;
}
assert.deepEqual(counts, {
  body: 12,
  'body-feature': 144,
  top: 72,
  bottom: 72,
  shoes: 72,
  jewelry: 144,
  special: 144,
  mouth: 12,
  eyes: 12,
  'face-feature': 12,
  'hair-male': 24,
  'hair-female': 24,
  hat: 24,
  'hat-hair-mask': 12,
  icon: 85,
});
// OpenRaster archive is stored ZIP; validate CRC, actual layer dimensions and merged preview.
const ora = await read('CF_REFERENCE_STACK.ora'),
  zip = new Map();
let offset = 0;
while (ora.readUInt32LE(offset) === 0x04034b50) {
  assert.equal(ora.readUInt16LE(offset + 8), 0);
  const length = ora.readUInt32LE(offset + 18),
    nl = ora.readUInt16LE(offset + 26),
    el = ora.readUInt16LE(offset + 28),
    name = ora.toString('utf8', offset + 30, offset + 30 + nl),
    start = offset + 30 + nl + el,
    data = ora.subarray(start, start + length);
  assert.equal(crc32(data), ora.readUInt32LE(offset + 14));
  zip.set(name, data);
  offset = start + length;
}
assert.equal(zip.get('mimetype').toString(), 'image/openraster');
assert(zip.get('mergedimage.png').equals(await read('REF_COMPOSITE_A24.png')));
const xml = zip.get('stack.xml').toString(),
  layers = [...xml.matchAll(/<layer name="([^"]+)" src="([^"]+)"/g)];
assert.equal(layers.length, 17);
for (const [, name, src] of layers) {
  assert(zip.has(src), name);
  const img = decode(zip.get(src));
  assert.deepEqual([img.w, img.h], [288, 256]);
}
console.log(
  'TECH_DOCS verified: 47 PNGs, 12 bodies × 24 frames, transparent layers, V4 back-face masks, 17 ORA layers, 865 inventory entries; no subfolders.',
);
