import { test, expect, afterEach } from 'vitest';
import { mkdtemp, readFile, writeFile, mkdir, rm, stat, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { importCharacters, parseName, readItems, expandViews, validatePixels } from './pipeline';
import { LEGACY_SOURCE_TEMPLATES as SOURCE_TEMPLATES } from '../../apps/web/src/avatar/modular/templates';
const roots: string[] = [];
async function root() {
  const r = await mkdtemp(path.join(tmpdir(), 'cf-character-'));
  roots.push(r);
  await importCharacters(r);
  return r;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});
function fixture(id = 'hair', rows = 3, color = [184, 184, 184, 255]) {
  const t = SOURCE_TEMPLATES.find((t) => t.id === id)!,
    p = new PNG({ width: t.width, height: t.height * rows });
  for (let row = 0; row < rows; row++)
    for (let y = 15; y < 22; y++)
      for (let x = 20; x < 27; x++) {
        const at = ((row * t.height + y) * t.width + x) * 4;
        p.data.set(color, at);
      }
  return p;
}
async function upload(r: string, category: string, name: string, png: PNG) {
  await mkdir(path.join(r, 'CHARACTER', category), { recursive: true });
  const bytes = PNG.sync.write(png);
  await writeFile(path.join(r, 'CHARACTER', category, name), bytes);
  return bytes;
}
async function manifest(r: string) {
  return JSON.parse(
    await readFile(path.join(r, 'content/avatars/modular/import-manifest.json'), 'utf8'),
  );
}
test('FULL and explicit symmetry modes reject ambiguity and retain authored W', () => {
  const n = parseName('hair_01__FULL.png', 'hair'),
    t = SOURCE_TEMPLATES[0]!,
    p = fixture('hair', 4);
  p.data[(3 * t.height * t.width + 20) * 4] = 80;
  const full = expandViews(p, t, n.mode);
  expect(full.data).toEqual(p.data);
  const es = fixture('eyes', 2),
    e = expandViews(es, SOURCE_TEMPLATES.find((t) => t.id === 'eyes')!, 'SYM_ES');
  expect(e.data.subarray(0, 64 * 64 * 4).some(Boolean)).toBe(false);
  expect(parseName('hair_01.png', 'hair')).toMatchObject({ compact: 'hair', slot: 1 });
  expect(() => parseName('hair_01__FULL__SYM_ES.png', 'hair')).toThrow();
  expect(() => parseName('hair_07__FULL.png', 'hair')).toThrow();
});
test('unchanged reimport is deterministic, creates thumbnails, mirrors E and never mutates originals', async () => {
  const r = await root(),
    name = 'hair_01__SYM_NES.png',
    bytes = await upload(r, 'hair', name, fixture());
  const first = await importCharacters(r);
  expect(first.errors).toEqual([]);
  expect(first.updated).toBe(1);
  const m = await manifest(r),
    entry = m.items[0],
    image = PNG.sync.read(await readFile(path.join(r, 'content/art', entry.files[0])));
  expect(image.height).toBe(256);
  const at = (y: number, x: number) => (y * 64 + x) * 4;
  expect(image.data[at(64 + 15, 20)]).toBe(image.data[at(192 + 15, 43)]);
  expect((await readFile(path.join(r, 'CHARACTER/hair', name))).equals(bytes)).toBe(true);
  const stamp = (await stat(path.join(r, 'content/art', entry.files[0]))).mtimeMs,
    manifestBytes = await readFile(path.join(r, 'content/avatars/modular/import-manifest.json'));
  const second = await importCharacters(r);
  expect(second.updated).toBe(0);
  expect(second.unchanged).toBe(1);
  expect((await stat(path.join(r, 'content/art', entry.files[0]))).mtimeMs).toBe(stamp);
  expect(await readFile(path.join(r, 'content/avatars/modular/import-manifest.json'))).toEqual(
    manifestBytes,
  );
  expect(await readFile(path.join(r, 'CHARACTER/hair/DEBUG_REPORT.md'), 'utf8')).toBe(
    '# Критические ошибки импорта\n',
  );
});
test('bad replacement retains last accepted item; correction clears only its active errors', async () => {
  const r = await root(),
    name = 'hair_01__SYM_NES.png';
  await upload(r, 'hair', name, fixture());
  await importCharacters(r);
  const old = await manifest(r);
  await upload(r, 'hair', name, fixture('hair', 3, [255, 7, 15, 255]));
  const bad = await importCharacters(r);
  expect(bad.errors.length).toBeGreaterThan(0);
  expect((await manifest(r)).items[0].hash).toBe(old.items[0].hash);
  expect(await readFile(path.join(r, 'CHARACTER/hair/DEBUG_REPORT.md'), 'utf8')).toContain(
    'Недопустимый цвет',
  );
  await upload(r, 'hair', name, fixture('hair', 3, [128, 128, 128, 255]));
  expect((await importCharacters(r)).errors).toEqual([]);
  expect((await manifest(r)).items[0].hash).not.toBe(old.items[0].hash);
  expect(await readFile(path.join(r, 'CHARACTER/hair/DEBUG_REPORT.md'), 'utf8')).not.toContain(
    'Недопустимый',
  );
});
test('ITEMS metadata is human-readable and contradictory symmetry does not publish an item', async () => {
  expect(
    readItems(
      '| Файл/ID | Название | Симметрия |\n| --- | --- | --- |\n| hair_01 | Каре | FULL |',
    )[0]!.label,
  ).toBe('Каре');
  const r = await root();
  await upload(r, 'hair', 'hair_01__SYM_NES.png', fixture());
  await writeFile(
    path.join(r, 'CHARACTER/hair/ITEMS.md'),
    '| Файл/ID | Симметрия |\n| --- | --- |\n| hair_01 | FULL |',
  );
  expect((await importCharacters(r)).errors[0]!.problem).toContain('противоречит');
  expect((await manifest(r)).items).toHaveLength(0);
});
test('rgba fixed colors and subtle skin-effect alpha are retained; ordinary semitransparent boundaries fail', async () => {
  const r = await root();
  await upload(r, 'eyes', 'eyes_01__SYM_ES.png', fixture('eyes', 2, [44, 66, 88, 255]));
  await upload(r, 'face_features', 'face_01__SYM_ES.png', fixture('face', 2, [184, 184, 184, 64]));
  const result = await importCharacters(r);
  expect(result.errors).toEqual([]);
  expect(result.items).toBe(2);
  const m = await manifest(r),
    e = m.items.find((i: { category: string }) => i.category === 'face_features'),
    png = PNG.sync.read(await readFile(path.join(r, 'content/art', e.files[0])));
  expect(png.data.some((v, i) => i % 4 === 3 && v === 64)).toBe(true);
  const t = SOURCE_TEMPLATES[0]!;
  expect(() =>
    validatePixels(
      fixture('hair', 3, [184, 184, 184, 64]),
      t,
      parseName('hair_01__SYM_NES.png', 'hair'),
      'hair',
      false,
    ),
  ).toThrow('Полупрозрачная');
});
test('wrong canvas, clipped graphics, missing views and clear two-pixel outer contours are critical', () => {
  const t = SOURCE_TEMPLATES[0]!,
    n = parseName('hair_01__SYM_NES.png', 'hair');
  expect(() => validatePixels(fixture('eyes', 2), t, n, 'hair', false)).toThrow('размер');
  const clipped = fixture();
  clipped.data.set([184, 184, 184, 255], 0);
  expect(() => validatePixels(clipped, t, n, 'hair', false)).toThrow('границы');
  const absent = fixture();
  absent.data.fill(0, 64 * 64 * 4, 2 * 64 * 64 * 4);
  expect(() => validatePixels(absent, t, n, 'hair', false)).toThrow('вид east');
  const thick = fixture();
  for (let x = 19; x < 28; x++)
    for (let y = 14; y < 16; y++) thick.data.set([32, 32, 32, 255], (y * 64 + x) * 4);
  for (let x = 19; x < 28; x++) thick.data.set([184, 184, 184, 255], (16 * 64 + x) * 4);
  expect(() => validatePixels(thick, t, n, 'hair', false)).toThrow('контур');
});
test('deleted sources remove only their own derived outputs and do not remove other items', async () => {
  const r = await root();
  await upload(r, 'hair', 'hair_01__SYM_NES.png', fixture());
  await upload(r, 'eyes', 'eyes_01__SYM_ES.png', fixture('eyes', 2));
  await importCharacters(r);
  await rm(path.join(r, 'CHARACTER/hair/hair_01__SYM_NES.png'));
  const result = await importCharacters(r);
  expect(result.items).toBe(1);
  expect((await manifest(r)).items[0].category).toBe('eyes');
});

test('paired clothing uses shared sources, mirrors symmetric pairs, composes an icon and respects an explicit side', async () => {
  const r = await root();
  await upload(r, 'tops', 'top_01__BODY__SYM_NES.png', fixture('top'));
  const t = SOURCE_TEMPLATES.find((t) => t.id === 'sleeve')!,
    sleeve = new PNG({ width: t.width, height: t.height * 3 });
  for (let row = 0; row < 3; row++)
    for (let y = 6; y < 20; y++)
      for (let x = 7; x < 16; x++)
        sleeve.data.set([184, 184, 184, 255], ((row * t.height + y) * t.width + x) * 4);
  await upload(r, 'tops', 'top_01__SLEEVE__SYM_NES.png', sleeve);
  expect((await importCharacters(r)).errors).toEqual([]);
  let item = (await manifest(r)).items[0];
  expect(item.parts).toHaveLength(3);
  expect(item.parts.find((p: { parent: string }) => p.parent === 'armRight').pairMirror).toBe(true);
  const thumb = PNG.sync.read(
    await readFile(path.join(r, 'content/art', item.thumbnail.slice('/content/'.length))),
  );
  expect(thumb.width).toBeGreaterThan(20);
  await writeFile(
    path.join(r, 'CHARACTER/tops/ITEMS.md'),
    '| Файл/ID | Крепление |\n| --- | --- |\n| top_01__SLEEVE__SYM_NES.png | правая рука |',
  );
  expect((await importCharacters(r)).errors).toEqual([]);
  item = (await manifest(r)).items[0];
  expect(item.parts).toHaveLength(2);
  expect(item.parts.filter((p: { parent: string }) => p.parent === 'armRight')).toHaveLength(1);
});

test('conflicting item identities publish neither candidate and leave no orphan derived PNGs', async () => {
  const r = await root();
  await upload(r, 'hair', 'hair_01__SYM_NES.png', fixture());
  await upload(r, 'hair', 'hair_01__FEMALE__SYM_NES.png', fixture());
  const result = await importCharacters(r);
  expect(result.errors.length).toBeGreaterThan(0);
  expect((await manifest(r)).items).toHaveLength(0);
  expect(
    (await readdir(path.join(r, 'content/art'))).filter((name) => name.endsWith('.png')),
  ).toEqual([]);
  await rm(path.join(r, 'CHARACTER/hair/hair_01__SYM_NES.png'));
  expect((await importCharacters(r)).errors).toEqual([]);
  expect((await manifest(r)).items).toHaveLength(1);
});
