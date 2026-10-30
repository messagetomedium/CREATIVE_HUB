import { expect, test, afterEach } from 'vitest';
import { PNG } from 'pngjs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseName, importCharacters, readItems } from './pipeline';
import { compactTemplate, detectViews, expandCompact, compileCompact } from './compact';
import { templateDescriptor } from '../../apps/web/src/avatar/modular/templates';
import { reviewPose } from '../../apps/web/src/avatar/editorMotion';
import { parentPoint } from '../../apps/web/src/avatar/modular/rig';
import { fitApprovedPixels } from '../../apps/web/src/avatar/modular/approved-fit';
import { avatarCatalog } from '../../apps/web/src/avatar/catalog';
import { updateConstructor } from '../../apps/web/src/avatar/editor';
import {
  topFixture,
  lowerFixture,
  headFixture,
  hairFixture,
  shoesFixture,
  rect,
} from './compact-fixtures';
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});
function compiled(
  name: string,
  category: Parameters<typeof parseName>[1],
  image: PNG,
  metadata?: Parameters<typeof compileCompact>[4],
  mask?: PNG,
) {
  const n = parseName(name, category),
    t = compactTemplate(n),
    converted = expandCompact(image, t, n, metadata, mask);
  return {
    n,
    t,
    converted,
    pieces: compileCompact(
      t,
      templateDescriptor(t, n.slot),
      converted.image,
      n,
      metadata,
      converted.mask,
      converted.westMirrored,
    ),
  };
}
function color(image: PNG, row: number, x: number, y: number, height = 64) {
  return [
    ...image.data.subarray(
      ((row * height + y) * image.width + x) * 4,
      ((row * height + y) * image.width + x) * 4 + 4,
    ),
  ];
}
test('simple names retain shared slots and reject folder, gender and slot mistakes', () => {
  expect(parseName('hair_f_01.png', 'hair')).toMatchObject({
    compact: 'hair',
    gender: 'female',
    slot: 1,
  });
  expect(parseName('top_06.png', 'tops')).toMatchObject({ compact: 'top', slot: 6 });
  expect(parseName('bottom_01.png', 'bottoms').slot).toBe(
    parseName('skirt_01.png', 'bottoms').slot,
  );
  for (const [name, category] of [
    ['top_01.png', 'hair'],
    ['top_f_01.png', 'tops'],
    ['hair_00.png', 'hair'],
    ['hair_07.png', 'hair'],
  ] as const)
    expect(() => parseName(name, category)).toThrow();
});
test.each([[[0]], [[0, 1]], [[0, 1, 2]], [[0, 1, 3]], [[0, 1, 2, 3]]])(
  'HEAD alpha occupancy %j produces only its explicit transforms',
  (rows) => {
    const img = headFixture(rows as number[]),
      transforms = detectViews(img, 64, 'accessory');
    const out = expandCompact(
      img,
      compactTemplate(parseName('accessory_01.png', 'jewelry')),
      parseName('accessory_01.png', 'jewelry'),
    ).image;
    expect(transforms).toHaveLength(4);
    expect(color(out, 2, 14, 16)).toEqual(color(img, 0, 14, 16));
    if (rows.includes(3)) expect(color(out, 3, 17, 16)).toEqual(color(img, 3, 17, 16));
    if (rows.join() === '0,1,3') {
      expect(color(out, 0, 49, 16)).toEqual(color(img, 0, 14, 16));
      const copy = expandCompact(
        img,
        compactTemplate(parseName('accessory_01.png', 'jewelry')),
        parseName('accessory_01.png', 'jewelry'),
        {
          key: '',
          label: '',
          symmetry: '',
          parent: '',
          pass: '',
          material: '',
          notes: '',
          back: 'copy',
        },
      ).image;
      expect(color(copy, 0, 14, 16)).toEqual(color(img, 0, 14, 16));
    }
  },
);
test('absent S, unsafe volume repetitions and illegal cell combinations are clear errors', () => {
  for (const rows of [[], [1], [0, 2], [0, 3], [1, 2, 3]])
    expect(() => detectViews(headFixture(rows), 64, 'hat')).toThrow(/ячейки/);
  expect(() => detectViews(headFixture([0]), 64, 'top')).toThrow(/S\/E\/N/);
  expect(() => detectViews(headFixture([0, 1]), 64, 'eyes')).toThrow(/только S/);
});
test('face categories use projection, preserve distinct eyes and leave N empty', () => {
  for (const type of ['eyes', 'mouth', 'face'] as const) {
    const image = new PNG({ width: 64, height: 256 });
    if (type === 'eyes') {
      rect(image, 0, 64, 22, 30, 4, 8, [80, 0, 0, 255]);
      rect(image, 0, 64, 38, 30, 4, 8, [0, 80, 0, 255]);
    } else if (type === 'mouth') rect(image, 0, 64, 30, 44, 5, 2);
    else {
      rect(image, 0, 64, 22, 42, 5, 2);
      rect(image, 0, 64, 40, 42, 5, 2);
    }
    const category = type === 'face' ? 'face_features' : type,
      n = parseName(`${type}_01.png`, category),
      t = compactTemplate(n),
      out = expandCompact(image, t, n).image;
    expect(out.data.subarray(0, 64 * 64 * 4).some(Boolean)).toBe(false);
    for (const row of [1, 2, 3])
      expect(out.data.subarray(row * 64 * 64 * 4, (row + 1) * 64 * 64 * 4).some(Boolean)).toBe(
        true,
      );
    if (type === 'eyes') {
      expect(color(out, 1, 42, 30)).toEqual([0, 80, 0, 255]);
      expect(color(out, 3, 18, 30)).toEqual([80, 0, 0, 255]);
    }
  }
});
test('whole TOP modules conserve every source RGBA pixel, include both sleeves and overlap at joins', () => {
  const image = topFixture();
  rect(image, 3, 112, 53, 72, 2, 3, [80, 80, 80, 255]);
  const { pieces, converted, t } = compiled('top_01.png', 'tops', image);
  expect(pieces.map((p) => p.descriptor.parent)).toEqual(
    expect.arrayContaining(['torso', 'armLeft', 'armRight', 'handLeft', 'handRight']),
  );
  for (const [row, dir] of (['north', 'east', 'south', 'west'] as const).entries()) {
    const p = reviewPose('average', dir, 0, 'male'),
      out = new PNG({ width: 96, height: 128 });
    for (const part of pieces) {
      const d = part.descriptor,
        pt = parentPoint(p, d.parent);
      for (let y = 0; y < d.frameHeight; y++)
        for (let x = 0; x < d.frameWidth; x++) {
          const at = ((row * d.frameHeight + y) * d.frameWidth + x) * 4;
          if (!part.image.data[at + 3]) continue;
          const dx = pt.x - d.anchor.x + x,
            dy = pt.y - d.anchor.y + y;
          if (dx >= 0 && dx < 96 && dy >= 0 && dy < 128)
            part.image.data.copy(out.data, (dy * 96 + dx) * 4, at, at + 4);
        }
    }
    for (let y = 0; y < t.height; y++)
      for (let x = 0; x < t.width; x++) {
        const at = ((row * t.height + y) * t.width + x) * 4;
        if (converted.image.data[at + 3])
          expect([...out.data.subarray((y * 96 + x) * 4, (y * 96 + x) * 4 + 4)]).toEqual([
            ...converted.image.data.subarray(at, at + 4),
          ]);
      }
  }
  const body = pieces.find((p) => p.descriptor.parent === 'torso')!,
    sleeve = pieces.find((p) => p.descriptor.parent === 'armLeft')!;
  expect(body.image.data.some(Boolean)).toBe(true);
  expect(sleeve.image.data.some(Boolean)).toBe(true);
});
test('all four builds and both genders fit full clothes once, with stable lengths and fixed footwear', () => {
  const top = compiled('top_01.png', 'tops', topFixture()).pieces,
    lower = compiled('bottom_01.png', 'bottoms', lowerFixture()).pieces,
    shoes = compiled('shoes_01.png', 'footwear', shoesFixture()).pieces;
  for (const gender of ['male', 'female'] as const)
    for (const build of ['very-slim', 'slim', 'average', 'sturdy'] as const) {
      const config = updateConstructor(avatarCatalog.defaultAvatar, { gender, build });
      for (const part of [...top, ...lower, ...shoes]) {
        const f = fitApprovedPixels(part.image, part.descriptor, config);
        expect(f.raster.width).toBeLessThanOrEqual(96);
        expect(f.raster.height / 4).toBeLessThanOrEqual(128);
        expect(f.descriptor.fit).toBe('fixed');
        if (part.descriptor.approved?.kind === 'foot')
          expect(f.raster.width).toBeLessThanOrEqual(18);
      }
    }
});
test('bottom supports short, capri and long legs with automatic/no belt; skirt remains one lower module', () => {
  for (const length of [31, 40, 58])
    for (const belt of [false, true]) {
      const parts = compiled('bottom_01.png', 'bottoms', lowerFixture(length, belt)).pieces;
      expect(parts.some((p) => p.key === 'belt')).toBe(belt);
      expect(parts.some((p) => p.descriptor.parent === 'legLeft')).toBe(true);
      const leg = parts.find((p) => p.descriptor.parent === 'legLeft')!;
      expect(leg.descriptor.frameHeight).toBe(length - 24);
    }
  const skirt = compiled('skirt_01.png', 'bottoms', lowerFixture(58, true, true)).pieces;
  expect(skirt.filter((p) => p.descriptor.approved?.kind === 'pelvis')).toHaveLength(1);
  expect(skirt.some((p) => p.descriptor.parent.startsWith('leg'))).toBe(false);
});
test('hair mask overrides fixed front/back zones exactly and rejects unlabeled artwork', () => {
  const hair = hairFixture(),
    mask = new PNG({ width: 96, height: 448 });
  for (let at = 0; at < hair.data.length; at += 4)
    if (hair.data[at + 3]) mask.data.set([255, 0, 0, 255], at);
  // A central chest strand normally belongs behind the torso; explicitly put it in front.
  const parts = compiled('hair_01.png', 'hair', hair, undefined, mask).pieces;
  expect(parts.map((p) => p.descriptor.pass)).toEqual(['front']);
  mask.data.fill(0);
  expect(() => compiled('hair_01.png', 'hair', hair, undefined, mask)).toThrow(/каждый видимый/);
});
test('real importer preserves originals, updates one asset, preserves last good on error and hashes masks', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'cf-compact-'));
  roots.push(root);
  await importCharacters(root);
  const file = path.join(root, 'CHARACTER/tops/top_01.png'),
    bytes = PNG.sync.write(topFixture());
  await writeFile(file, bytes);
  let run = await importCharacters(root);
  expect(run.errors).toEqual([]);
  expect(run.updated).toBe(1);
  const m = () =>
    readFile(path.join(root, 'content/avatars/modular/import-manifest.json'), 'utf8').then(
      JSON.parse,
    );
  const first = await m();
  expect(first.items[0].parts.every((p: { approved?: unknown }) => p.approved)).toBe(true);
  expect((await readFile(file)).equals(bytes)).toBe(true);
  expect((await importCharacters(root)).unchanged).toBe(1);
  await writeFile(file, Buffer.from('bad'));
  run = await importCharacters(root);
  expect(run.errors.length).toBeGreaterThan(0);
  expect((await m()).items[0].hash).toBe(first.items[0].hash);
  await writeFile(file, bytes);
  expect((await importCharacters(root)).errors).toEqual([]);
  const top = topFixture(),
    mask = new PNG({ width: 96, height: 448 });
  for (let at = 0; at < top.data.length; at += 4)
    if (top.data[at + 3]) mask.data.set([255, 0, 0, 255], at);
  await writeFile(path.join(root, 'CHARACTER/tops/top_mask.png'), PNG.sync.write(mask));
  await writeFile(
    path.join(root, 'CHARACTER/tops/ITEMS.md'),
    '| Файл | Маска |\n| --- | --- |\n| top_01.png | top_mask.png |\n',
  );
  expect((await importCharacters(root)).errors).toEqual([]);
  const masked = await m();
  expect(masked.items[0].hash).not.toBe(first.items[0].hash);
  expect(
    readItems(
      '| Файл | N | Пояс | Посадка |\n| --- | --- | --- | --- |\n| hat_01.png | copy | no | female |',
    )[0],
  ).toMatchObject({ back: 'copy', belt: 'no', reference: 'female' });
});
test('belt overrides are explicit while empty optional cells keep automatic defaults', () => {
  const fields = readItems(
    '| Файл | Название | N | Пояс | Маска | Посадка | Материал |\n| --- | --- | --- | --- | --- | --- | --- |\n| bottom_01.png | Брюки | | | | | |',
  )[0]!;
  expect(
    compiled('bottom_01.png', 'bottoms', lowerFixture(46, true), fields).pieces.some(
      (p) => p.key === 'belt',
    ),
  ).toBe(true);
  expect(
    compiled('bottom_01.png', 'bottoms', lowerFixture(46, true), {
      ...fields,
      belt: 'no',
    }).pieces.some((p) => p.key === 'belt'),
  ).toBe(false);
  expect(() =>
    compiled('bottom_01.png', 'bottoms', lowerFixture(46, false), { ...fields, belt: 'yes' }),
  ).toThrow(/пуста/);
});
test('TOP technical mask creates exact anatomical sleeves without editing source artwork', () => {
  const source = topFixture(),
    before = Buffer.from(source.data),
    mask = new PNG({ width: 96, height: 448 });
  for (let row = 0; row < 4; row++)
    for (let y = 0; y < 112; y++)
      for (let x = 0; x < 96; x++) {
        const at = ((row * 112 + y) * 96 + x) * 4;
        if (!source.data[at + 3]) continue;
        const dir = (['south', 'east', 'north', 'west'] as const)[row]!,
          p = reviewPose('average', dir, 0, 'male');
        const arm = p.arms.findIndex((a) => Math.abs(x + 0.5 - a.root.x) <= 5);
        const col = arm < 0 ? [255, 0, 0, 255] : arm === 0 ? [0, 255, 0, 255] : [0, 0, 255, 255];
        mask.data.set(col, at);
      }
  const out = compiled('top_01.png', 'tops', source, undefined, mask).pieces;
  expect(out.some((p) => p.descriptor.parent === 'armLeft')).toBe(true);
  expect(out.some((p) => p.descriptor.parent === 'armRight')).toBe(true);
  expect(Buffer.from(source.data)).toEqual(before);
  mask.data.fill(0);
  expect(() => compiled('top_01.png', 'tops', source, undefined, mask)).toThrow(/каждый видимый/);
});
test('footwear keeps actual 12/14 pixel widths in each view across every build', () => {
  const pieces = compiled('shoes_01.png', 'footwear', shoesFixture()).pieces;
  for (const build of ['very-slim', 'slim', 'average', 'sturdy'] as const)
    for (const p of pieces) {
      const fit = fitApprovedPixels(
          p.image,
          p.descriptor,
          updateConstructor(avatarCatalog.defaultAvatar, { build }),
        ),
        h = fit.descriptor.frameHeight;
      const widths = [0, 1, 2, 3].map((row) => {
        let lo = fit.raster.width,
          hi = -1;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < fit.raster.width; x++)
            if (fit.raster.data[((row * h + y) * fit.raster.width + x) * 4 + 3]) {
              lo = Math.min(lo, x);
              hi = Math.max(hi, x);
            }
        return hi - lo + 1;
      });
      expect(widths).toEqual([12, 14, 12, 14]);
    }
});
test('changing only a layer mask changes runtime URLs even if component PNG pixels are identical', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'cf-compact-depth-'));
  roots.push(root);
  await importCharacters(root);
  const hair = hairFixture(),
    mask = new PNG({ width: 96, height: 448 });
  const fill = (color: number[]) => {
    mask.data.fill(0);
    for (let at = 0; at < hair.data.length; at += 4)
      if (hair.data[at + 3]) mask.data.set(color, at);
  };
  await writeFile(path.join(root, 'CHARACTER/hair/hair_01.png'), PNG.sync.write(hair));
  await writeFile(
    path.join(root, 'CHARACTER/hair/ITEMS.md'),
    '| Файл | Маска |\n| --- | --- |\n| hair_01.png | hair_mask.png |\n',
  );
  fill([255, 0, 0, 255]);
  await writeFile(path.join(root, 'CHARACTER/hair/hair_mask.png'), PNG.sync.write(mask));
  expect((await importCharacters(root)).errors).toEqual([]);
  const first = JSON.parse(
    await readFile(path.join(root, 'content/avatars/modular/import-manifest.json'), 'utf8'),
  ).items[0];
  fill([0, 0, 255, 255]);
  await writeFile(path.join(root, 'CHARACTER/hair/hair_mask.png'), PNG.sync.write(mask));
  expect((await importCharacters(root)).errors).toEqual([]);
  const second = JSON.parse(
    await readFile(path.join(root, 'content/avatars/modular/import-manifest.json'), 'utf8'),
  ).items[0];
  expect(first.parts[0].pass).toBe('front');
  expect(second.parts[0].pass).toBe('back');
  expect(second.parts[0].source).not.toBe(first.parts[0].source);
});
test('an inferred W swaps anatomical mask labels while preserving authored W labels', () => {
  const top = topFixture(3),
    mask = new PNG({ width: 96, height: 448 });
  for (let at = 0; at < top.data.length; at += 4)
    if (top.data[at + 3]) mask.data.set([255, 0, 0, 255], at);
  rect(mask, 1, 112, 42, 65, 6, 8, [0, 0, 255, 255]);
  const n = parseName('top_01.png', 'tops'),
    t = compactTemplate(n),
    out = expandCompact(top, t, n, undefined, mask);
  expect(color(out.mask!, 3, 95 - 44, 68, 112)).toEqual([0, 255, 0, 255]);
  const authored = topFixture(4);
  rect(mask, 3, 112, 49, 65, 6, 8, [0, 0, 255, 255]);
  const own = expandCompact(authored, t, n, undefined, mask);
  expect(color(own.mask!, 3, 50, 68, 112)).toEqual([0, 0, 255, 255]);
});
test('a sleeveless top does not invent sleeves or cuffs from torso overlap pixels', () => {
  const vest = new PNG({ width: 96, height: 448 });
  for (let row = 0; row < 4; row++)
    rect(
      vest,
      row,
      112,
      row === 0 || row === 2 ? 33 : 35,
      58,
      row === 0 || row === 2 ? 30 : 26,
      34,
    );
  const out = compiled('top_01.png', 'tops', vest).pieces;
  expect(out.map((p) => p.descriptor.parent)).toEqual(['torso']);
  const short = topFixture();
  for (let row = 0; row < 4; row++)
    for (let y = 78; y < 96; y++)
      for (let x = 0; x < 96; x++) {
        const lo = row === 0 || row === 2 ? 33 : 35,
          hi = row === 0 || row === 2 ? 63 : 61;
        if (x < lo || x >= hi)
          short.data.fill(0, ((row * 112 + y) * 96 + x) * 4, ((row * 112 + y) * 96 + x) * 4 + 4);
      }
  const tee = compiled('top_01.png', 'tops', short).pieces;
  expect(tee.some((p) => p.descriptor.parent.startsWith('arm'))).toBe(true);
  expect(tee.some((p) => p.descriptor.parent.startsWith('hand'))).toBe(false);
});
test('preflight rejects oversized fitted art before replacing the last working item', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'cf-compact-bounds-'));
  roots.push(root);
  await importCharacters(root);
  const folder = path.join(root, 'CHARACTER/tops'),
    file = path.join(folder, 'top_01.png');
  await writeFile(file, PNG.sync.write(topFixture()));
  expect((await importCharacters(root)).errors).toEqual([]);
  const read = () =>
      readFile(path.join(root, 'content/avatars/modular/import-manifest.json'), 'utf8').then(
        JSON.parse,
      ),
    before = await read();
  const wide = new PNG({ width: 96, height: 448 }),
    mask = new PNG({ width: 96, height: 448 });
  for (let row = 0; row < 4; row++) {
    rect(wide, row, 112, 1, 58, 94, 34);
    rect(mask, row, 112, 1, 58, 94, 34, [255, 0, 0, 255]);
  }
  await writeFile(file, PNG.sync.write(wide));
  await writeFile(path.join(folder, 'top_mask.png'), PNG.sync.write(mask));
  await writeFile(
    path.join(folder, 'ITEMS.md'),
    '| Файл | Маска |\n| --- | --- |\n| top_01.png | top_mask.png |\n',
  );
  const result = await importCharacters(root);
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.errors[0]!.problem).toMatch(/кадр/);
  expect((await read()).items[0].hash).toBe(before.items[0].hash);
});
test('the approved far boot tint is profile-only and does not change frontal/rear colours', () => {
  const pieces = compiled('shoes_01.png', 'footwear', shoesFixture()).pieces;
  for (const piece of pieces) {
    const out = fitApprovedPixels(piece.image, piece.descriptor, avatarCatalog.defaultAvatar),
      h = out.descriptor.frameHeight,
      index = piece.descriptor.parent === 'footLeft' ? 0 : 1;
    for (let row = 0; row < 4; row++) {
      let pixel: number[] = [];
      for (let y = 0; y < h && !pixel.length; y++)
        for (let x = 0; x < out.raster.width; x++) {
          const at = ((row * h + y) * out.raster.width + x) * 4;
          if (out.raster.data[at + 3]) {
            pixel = [...out.raster.data.subarray(at, at + 4)];
            break;
          }
        }
      expect(pixel).toEqual(
        (index === 0 && row === 1) || (index === 1 && row === 3)
          ? [166, 164, 166, 255]
          : [184, 184, 184, 255],
      );
    }
  }
});
