import { test, expect, afterEach } from 'vitest';
import { PNG } from 'pngjs';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  SOURCE_TEMPLATES,
  VIEW_MODES,
  templateDescriptor,
} from '../../apps/web/src/avatar/modular/templates';
import { parseName, expandViews, validatePixels, importCharacters } from './pipeline';
import { compileSource } from './compile-source';
import { PartEntrySchema } from '../../apps/web/src/avatar/modular/parts';
const t = (id: string) => SOURCE_TEMPLATES.find((t) => t.id === id)!;
function pixel(p: PNG, x: number, y: number, c: number[]) {
  p.data.set(c, (y * p.width + x) * 4);
}
function box(p: PNG, x: number, y: number, w: number, h: number, c = [184, 184, 184, 255]) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) pixel(p, x + dx, y + dy, c);
}
function cell(p: PNG, height: number, row: number) {
  return p.data.subarray(row * height * p.width * 4, (row + 1) * height * p.width * 4);
}
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
test('simple filenames select all six whole lower garments and preserve common slot numbering', () => {
  for (const kind of ['pants', 'skirt', 'shorts'])
    for (const fit of ['high', 'low']) {
      const n = parseName(`${kind}_${fit}_full_01.png`, 'bottoms');
      expect(n.template).toBe(`${kind}-${fit}`);
      expect(n.slot).toBe(1);
    }
  expect(parseName('hair_long_full_01.png', 'hair').template).toBe('hair-long');
  expect(parseName('accessory_detail_sym1_01.png', 'jewelry').mode).toBe('sym1');
  expect(parseName('shoes_basic_pair_01.png', 'footwear').mode).toBe('pair');
  expect(() => parseName('pants_medium_full_01.png', 'bottoms')).toThrow();
  expect(() => parseName('pants_high_full_01.png', 'hair')).toThrow();
});
test('details sym1 reuses one view; sym2 derives back and opposite profile; full never mirrors authored W', () => {
  const d = t('details'),
    single = new PNG({ width: 64, height: 64 });
  pixel(single, 18, 20, [99, 22, 66, 255]);
  const a = expandViews(single, d, 'sym1');
  for (let r = 0; r < 4; r++) expect(cell(a, 64, r)).toEqual(single.data);
  const two = new PNG({ width: 64, height: 128 });
  pixel(two, 18, 20, [99, 22, 66, 255]);
  pixel(two, 42, 84, [11, 44, 77, 255]);
  const b = expandViews(two, d, 'sym2');
  expect(cell(b, 64, 0)).toEqual(cell(two, 64, 0));
  expect(cell(b, 64, 2)).toEqual(cell(two, 64, 0));
  expect(b.data[((3 * 64 + 20) * 64 + 21) * 4]).toBe(11);
  const four = new PNG({ width: 64, height: 256 });
  [12, 34, 56, 78].forEach((r, i) => pixel(four, 18, i * 64 + 20, [r, 0, 0, 255]));
  const c = expandViews(four, d, 'full');
  expect(c.data[(20 * 64 + 18) * 4]).toBe(56);
  expect(c.data[((3 * 64 + 20) * 64 + 18) * 4]).toBe(78);
  expect(VIEW_MODES.full).toEqual(['south', 'east', 'north', 'west']);
  expect(VIEW_MODES.pair).toEqual(['south', 'east', 'north']);
});
test('front eyes retain two different eyes, derive only the corresponding profile eye and leave N empty', () => {
  const source = new PNG({ width: 64, height: 64 });
  box(source, 22, 30, 4, 8, [88, 22, 44, 255]);
  box(source, 38, 30, 4, 8, [22, 99, 44, 255]);
  const before = Buffer.from(source.data),
    result = expandViews(source, t('eyes'), 'front');
  expect(cell(result, 64, 2)).toEqual(source.data);
  expect(cell(result, 64, 0).every((v) => v === 0)).toBe(true);
  expect(result.data[((64 + 30) * 64 + 42) * 4]).toBe(22);
  expect(result.data[((192 + 30) * 64 + 18) * 4]).toBe(88);
  for (const row of [1, 3])
    expect([...cell(result, 64, row)].filter((_, i) => i % 4 === 3).filter(Boolean)).toHaveLength(
      32,
    );
  expect(source.data).toEqual(before);
  const missing = new PNG({ width: 64, height: 64 });
  pixel(missing, 22, 30, [44, 22, 11, 255]);
  expect(() =>
    validatePixels(
      missing,
      t('eyes'),
      parseName('eyes_basic_front_01.png', 'eyes'),
      'fixed',
      false,
    ),
  ).toThrow('оба глаза');
});
test('one front mouth derives smaller nonempty profiles including a one-pixel mouth', () => {
  for (const width of [1, 7]) {
    const source = new PNG({ width: 64, height: 64 });
    box(source, 31, 44, width, 1, [199, 55, 88, 255]);
    const out = expandViews(source, t('mouth'), 'front');
    expect(cell(out, 64, 2)).toEqual(source.data);
    for (const row of [1, 3]) {
      const count = [...cell(out, 64, row)].filter((_, i) => i % 4 === 3).filter(Boolean).length;
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(Math.ceil(width / 2));
    }
  }
});
test('front face overlays retain alpha and side identity, nose overlay uses its central profile projection', () => {
  const d = {
      ...t('details'),
      category: 'face_features' as const,
      field: 'faceFeatures',
      material: 'skin',
    },
    source = new PNG({ width: 64, height: 64 });
  pixel(source, 22, 42, [128, 128, 128, 64]);
  pixel(source, 40, 42, [184, 184, 184, 96]);
  const out = expandViews(source, d, 'front', 1);
  expect(out.data[((64 + 42) * 64 + 42) * 4 + 3]).toBe(96);
  expect(out.data[((192 + 42) * 64 + 20) * 4 + 3]).toBe(64);
  expect(cell(out, 64, 0).every((v) => v === 0)).toBe(true);
  const nose = new PNG({ width: 64, height: 64 });
  pixel(nose, 32, 39, [184, 184, 184, 64]);
  const n = expandViews(nose, d, 'front', 6);
  expect(n.data[((64 + 39) * 64 + 46) * 4 + 3]).toBe(64);
  expect(n.data[((192 + 39) * 64 + 18) * 4 + 3]).toBe(64);
});
test('one whole hair source splits into complementary front/back zones without losing or repainting any pixel', () => {
  const spec = t('hair-long'),
    source = new PNG({ width: 96, height: 112 * 4 });
  for (let row = 0; row < 4; row++) {
    box(source, 30, row * 112 + 18, 36, 20);
    box(source, 28, row * 112 + 58, 40, 30, [128, 128, 128, 255]);
  }
  const original = Buffer.from(source.data),
    pieces = compileSource(spec, templateDescriptor(spec), source, true);
  expect(pieces.map((p) => p.key).sort()).toEqual(['hair-back', 'hair-front']);
  const front = pieces.find((p) => p.descriptor.pass === 'front')!.image,
    back = pieces.find((p) => p.descriptor.pass === 'back')!.image;
  for (let i = 0; i < source.data.length; i += 4) {
    expect(Boolean(front.data[i + 3]) && Boolean(back.data[i + 3])).toBe(false);
    const selected = front.data[i + 3] ? front : back;
    expect(selected.data.subarray(i, i + 4)).toEqual(source.data.subarray(i, i + 4));
  }
  expect(back.data[((2 * 112 + 70) * 96 + 48) * 4 + 3]).toBe(255);
  expect(front.data[((2 * 112 + 70) * 96 + 32) * 4 + 3]).toBe(255);
  expect(front.data[(70 * 96 + 48) * 4 + 3]).toBe(255);
  expect(source.data).toEqual(original);
});
function lower(kind: string, high: boolean) {
  const source = new PNG({ width: 80, height: 64 * 4 });
  for (let row = 0; row < 4; row++) {
    if (high) box(source, 30, row * 64 + 10, 20, 6);
    box(source, 30, row * 64 + 18, 20, 6);
    if (kind === 'skirt') box(source, 20, row * 64 + 24, 40, 18);
    else {
      const side = row === 1 || row === 3;
      for (const x of side ? [34] : [26, 44]) box(source, x, row * 64 + 24, 10, 8);
    }
  }
  return source;
}
test('whole pants/skirt/shorts high/low choose the correct internal waist and lower modules', () => {
  for (const kind of ['pants', 'skirt', 'shorts'])
    for (const high of [true, false]) {
      const spec = t(`${kind}-${high ? 'high' : 'low'}`),
        source = lower(kind, high),
        original = Buffer.from(source.data),
        parts = compileSource(spec, templateDescriptor(spec), source, true);
      expect(parts.some((p) => p.key === 'waist')).toBe(high);
      expect(parts.some((p) => p.descriptor.parent === 'legLeft')).toBe(kind !== 'skirt');
      expect(parts.some((p) => p.descriptor.parent === 'legRight')).toBe(kind !== 'skirt');
      const waist = parts.find((p) => p.key === 'waist');
      if (waist) {
        expect(waist.image.data[(10 * 80 + 35) * 4 + 3]).toBe(255);
        expect(waist.image.data[(20 * 80 + 35) * 4 + 3]).toBe(0);
      }
      for (const p of parts) expect(PartEntrySchema.safeParse(p.descriptor).success).toBe(true);
      expect(source.data).toEqual(original);
    }
});
test('incorrect low band, missing high band and oversized trouser leg produce errors instead of destructive cuts', () => {
  const low = t('pants-low'),
    high = t('pants-high');
  expect(() => compileSource(low, templateDescriptor(low), lower('pants', true), true)).toThrow(
    'выше зоны',
  );
  expect(() => compileSource(high, templateDescriptor(high), lower('pants', false), true)).toThrow(
    'поясной',
  );
  const bad = lower('pants', false);
  pixel(bad, 3, 28, [184, 184, 184, 255]);
  expect(() => compileSource(low, templateDescriptor(low), bad, true)).toThrow('штанин');
});
test('simple whole-source imports generate valid rig entries and respect the shared lower slot', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'cf-addendum-'));
  roots.push(root);
  await importCharacters(root);
  await writeFile(
    path.join(root, 'CHARACTER/bottoms/pants_high_full_01.png'),
    PNG.sync.write(lower('pants', true)),
  );
  const face = new PNG({ width: 64, height: 64 });
  pixel(face, 40, 42, [184, 184, 184, 64]);
  await writeFile(
    path.join(root, 'CHARACTER/face_features/face_detail_front_01.png'),
    PNG.sync.write(face),
  );
  const result = await importCharacters(root);
  expect(result.errors).toEqual([]);
  const registry = JSON.parse(
    await readFile(path.join(root, 'content/avatars/modular/parts.json'), 'utf8'),
  );
  for (const p of registry) expect(PartEntrySchema.safeParse(p).success).toBe(true);
  expect(
    registry.filter((p: { selection: { field: string } }) => p.selection.field === 'bottom'),
  ).toHaveLength(4);
  await writeFile(
    path.join(root, 'CHARACTER/bottoms/skirt_low_full_01.png'),
    PNG.sync.write(lower('skirt', false)),
  );
  expect(
    (await importCharacters(root)).errors.some((e) => e.problem.includes('Несколько цельных')),
  ).toBe(true);
});

test('fixed lower decoration can omit the upper band when its carrier supplies it', () => {
  const spec = t('pants-high'),
    decoration = new PNG({ width: 80, height: 256 });
  for (let r = 0; r < 4; r++) pixel(decoration, 32, r * 64 + 28, [220, 44, 88, 255]);
  const d = { ...templateDescriptor(spec), material: 'fixed' as const };
  expect(() => compileSource(spec, d, decoration, true)).toThrow('поясной');
  const pieces = compileSource(spec, d, decoration, true, true);
  expect(pieces.some((p) => p.key === 'waist')).toBe(false);
  expect(pieces.some((p) => p.descriptor.parent === 'legLeft')).toBe(true);
});
