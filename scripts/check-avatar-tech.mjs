import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
const root = 'TECH_DOCS/ПЕРСОНАЖ/';
const rig = JSON.parse(await readFile(root + 'РИГ.json'));
const manifest = JSON.parse(await readFile(root + 'manifest.json'));
const templates = JSON.parse(await readFile(root + 'ШАБЛОНЫ.json'));
const kit = JSON.parse(await readFile(root + 'КОМПЛЕКТ_ТЕЛА.json'));
assert.equal(rig.version, 'modular-adult-v2');
assert.deepEqual(rig.frame, { width: 48, height: 64, anchor: { x: 24, y: 56 } });
assert.deepEqual(rig.head, { width: 20, height: 20, center: { x: 24, y: 17 } });
assert.deepEqual(rig.directions, ['north', 'east', 'south', 'west']);
assert.equal(rig.rigs.length, 3);
for (const r of rig.rigs) {
  assert.equal(r.poses.length, 24);
  for (const p of r.poses) {
    assert.equal(p.head.x, 24);
    assert.equal(p.head.y, 17 + p.bob + p.headBob);
    assert.deepEqual(p.anchor, { x: 24, y: 56 });
    for (const l of [...p.arms, ...p.legs])
      for (const q of [l.root, l.joint, l.end])
        assert(Number.isInteger(q.x) && Number.isInteger(q.y));
    for (const l of p.legs) {
      assert.equal(l.root.x, l.end.x);
      assert.equal(l.end.y - l.root.y, 12);
    }
  }
}
for (const name of [...manifest.outputs, 'ПРИЧЕСКИ_ИНДЕКСЫ.png']) {
  const png = await readFile(root + name);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png[25], 6);
  if (name.endsWith('_A24.png')) {
    assert.equal(png.readUInt32BE(16), 288);
    assert.equal(png.readUInt32BE(20), 256);
  }
}
assert.equal(templates.length, 14);
for (const t of templates) {
  assert.deepEqual(t.rows, ['north', 'east', 'south']);
  assert(t.descriptor.mirrorWest);
  assert.deepEqual(t.descriptor.anchor, t.anchor);
  for (const name of [t.blank, t.underlay]) {
    const png = await readFile(root + name);
    assert.equal(png.readUInt32BE(16), t.width);
    assert.equal(png.readUInt32BE(20), t.height * 3);
  }
}
assert.equal(kit.length, 6);
assert.equal(new Set(kit.map((d) => d.source)).size, 4);
assert(kit.every((d) => d.selection.field === 'base'));
assert.deepEqual(
  kit.map((d) => d.parent),
  ['head', 'torso', 'armLeft', 'armRight', 'legLeft', 'legRight'],
);
const atlas = await readFile('content/avatars/modular/hair-indexed.png');
assert(atlas.equals(await readFile(root + 'ПРИЧЕСКИ_ИНДЕКСЫ.png')));
assert((await stat('content/avatars/modular/hair-indexed.png')).size < 16000);
console.log(
  'Verified v2 straight-limb rig, head-only breathing, 14 V3 artist templates and four-source body import kit.',
);
