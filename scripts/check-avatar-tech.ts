import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import {
  ARTIST_TEMPLATES,
  ARTIST_VIEWS,
  ARTIST_VERSION,
  ARTIST_BUILDS,
} from './character/artist-contract';
import snapshot from './character/approved-snapshot.json';
import {
  editorDimensions,
  EDITOR_ARM_LENGTH,
  EDITOR_LEG_LENGTH,
  EDITOR_WALK_FRAME_MS,
} from '../apps/web/src/avatar/editorMotion';
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(
  await readFile('content/avatars/modular/template-manifest.json', 'utf8'),
);
assert.equal(manifest.version, ARTIST_VERSION);
assert.deepEqual(manifest.approval, snapshot);
for (const [file, hash] of Object.entries(snapshot.sha256))
  assert.equal(sha(await readFile(file)), hash, `Approved editor changed: ${file}`);
assert.deepEqual(manifest.builds, ARTIST_BUILDS);
assert.equal(manifest.outlinePixels, 2);
assert.equal(manifest.armLength, EDITOR_ARM_LENGTH);
assert.equal(manifest.legLength, EDITOR_LEG_LENGTH);
assert.deepEqual(manifest.walkFrameMs, EDITOR_WALK_FRAME_MS);
assert.deepEqual(manifest.idleFrameMs, [500, 500]);
for (const row of manifest.geometry) {
  assert.deepEqual(row.front, editorDimensions(row.build, false, 'male', 'south'));
  assert.deepEqual(row.femaleFront, editorDimensions(row.build, false, 'female', 'south'));
  assert.deepEqual(row.side, editorDimensions(row.build, true));
}
assert.equal(
  manifest.templates.length,
  ARTIST_TEMPLATES.reduce((sum, t) => sum + t.modes.length, 0),
);
for (const t of ARTIST_TEMPLATES)
  for (const mode of t.modes) {
    const views = ARTIST_VIEWS[mode],
      record = manifest.templates.find(
        (r: { id: string; mode: string }) => r.id === t.id && r.mode === mode,
      );
    assert(record, `${t.id}/${mode}`);
    assert.deepEqual(record.anchor, t.anchor);
    assert.deepEqual(record.views, views);
    assert.equal(record.parent, t.parent);
    for (const field of ['template', 'empty']) {
      const png = PNG.sync.read(await readFile(record[field]), { checkCRC: true });
      assert.equal(png.width, t.width);
      assert.equal(png.height, t.height * views.length);
      if (field === 'empty')
        assert(
          png.data.every((v, i) => i % 4 !== 3 || v === 0),
          record[field],
        );
      else
        assert(
          png.data.some((v, i) => i % 4 === 3 && v > 0),
          record[field],
        );
    }
  }
for (const reference of manifest.references) {
  const png = PNG.sync.read(await readFile(reference.name), { checkCRC: true });
  assert.equal(png.width, reference.width);
  assert.equal(png.height, reference.height);
}
const generated = new Set(Object.keys(manifest.outputHashes));
const actual = (await readdir('TECH_DOCS/CHARACTER', { recursive: true }))
  .filter((name) => name.endsWith('.png'))
  .map((name) => 'TECH_DOCS/CHARACTER/' + name.replaceAll('\\', '/'));
assert.deepEqual([...generated].sort(), actual.sort(), 'Unexpected or missing artist PNG');
for (const [file, hash] of Object.entries(manifest.outputHashes))
  assert.equal(sha(await readFile(file)), hash, `Generated reference differs: ${file}`);
// Check actual visible approved dimensions and the last approved ear trim in both models.
for (const gender of ['MALE', 'FEMALE']) {
  const body = PNG.sync.read(await readFile(`TECH_DOCS/CHARACTER/BODY_${gender}.png`));
  const alpha = (x: number, y: number) => body.data[(y * body.width + x) * 4 + 3];
  for (let row = 0; row < 4; row++) {
    assert.equal(alpha(22, row * 128 + 38), 0);
    assert.equal(alpha(23, row * 128 + 38), 255);
    assert.equal(alpha(72, row * 128 + 38), 255);
    assert.equal(alpha(73, row * 128 + 38), 0);
  }
}
const docs = [
  ...(await readdir('TECH_DOCS', { recursive: true }))
    .filter((name) => name.endsWith('.md'))
    .map((name) => 'TECH_DOCS/' + name),
  'CHARACTER/README.md',
  ...(await readdir('CHARACTER', { recursive: true }))
    .filter((name) => name.endsWith('ITEMS.md'))
    .map((name) => 'CHARACTER/' + name),
];
for (const file of docs) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1]!.split('#')[0]!;
    if (!target || /^https?:/.test(target)) continue;
    await stat(path.resolve(path.dirname(file), decodeURIComponent(target)));
  }
}
execFileSync('python3', [
  '-c',
  `from pathlib import Path
from zipfile import ZipFile
with ZipFile('TECH_DOCS/CHARACTER/CREATIVE_FACTORY_ARTIST_KIT.zip') as z:
 assert z.testzip() is None
 assert 'START_HERE.md' in z.namelist()
 assert not any(n.startswith(('apps/', 'site/', 'node_modules/')) for n in z.namelist())
 for n in z.namelist():
  if n != 'START_HERE.md': assert z.read(n) == Path(n).read_bytes(), n
 expected={p.as_posix() for p in Path('TECH_DOCS').rglob('*') if p.is_file() and p.suffix in ('.md','.png')}
 expected.add('CHARACTER/README.md')
 expected.update(p.as_posix() for p in Path('CHARACTER').glob('*/ITEMS.md'))
 assert set(z.namelist()) == expected | {'START_HERE.md'}
`,
]);
console.log(
  `Verified approved source hashes, ${manifest.templates.length} TEMPLATE/EMPTY pairs, four builds, body references, anchors, transparency, links and artist ZIP.`,
);
