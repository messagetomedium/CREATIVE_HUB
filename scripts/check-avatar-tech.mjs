import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
const root = 'TECH_DOCS/ПЕРСОНАЖ/';
const rig = JSON.parse(await readFile(root + 'РИГ.json')),
  manifest = JSON.parse(await readFile(root + 'manifest.json'));
assert.equal(rig.version, 'modular-adult-v1');
assert.deepEqual(rig.frame, { width: 48, height: 64, anchor: { x: 24, y: 56 } });
assert.deepEqual(rig.head, { width: 20, height: 20, center: { x: 24, y: 17 } });
assert.deepEqual(rig.directions, ['north', 'east', 'south', 'west']);
assert.equal(rig.rigs.length, 3);
for (const r of rig.rigs) {
  assert.equal(r.poses.length, 24);
  for (const p of r.poses) {
    assert.equal(p.head.x, 24);
    assert.equal(p.head.y, 17 + p.bob);
    assert.deepEqual(p.anchor, { x: 24, y: 56 });
    for (const l of [...p.arms, ...p.legs])
      for (const q of [l.root, l.joint, l.end])
        assert(Number.isInteger(q.x) && Number.isInteger(q.y));
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
const atlas = await readFile('content/avatars/modular/hair-indexed.png');
assert(atlas.equals(await readFile(root + 'ПРИЧЕСКИ_ИНДЕКСЫ.png')));
assert.equal(atlas.readUInt32BE(16), 128);
assert.equal(atlas.readUInt32BE(20), 128);
assert((await stat('content/avatars/modular/hair-indexed.png')).size < 16000);
const part = JSON.parse(await readFile(root + 'ПРИМЕР_ДЕТАЛИ.json'));
assert.equal(part.parent, 'armRight');
assert.equal(part.fit, 'limb');
assert.equal(part.overrides.length, 1);
console.log(
  'Verified adult modular rig, 3 builds with identical head, 24 poses, shared indexed hair atlas and real-import templates.',
);
