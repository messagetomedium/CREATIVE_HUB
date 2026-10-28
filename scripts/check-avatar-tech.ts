import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import {
  SOURCE_TEMPLATES,
  VIEW_MODES,
  templateModes,
} from '../apps/web/src/avatar/modular/templates';
import { FRAME, RIG_VERSION, BODY_SHAPES } from '../apps/web/src/avatar/modular/rig';
const manifest = JSON.parse(
  await readFile('content/avatars/modular/template-manifest.json', 'utf8'),
);
assert.equal(manifest.version, RIG_VERSION);
assert.deepEqual(manifest.frame, FRAME);
assert.deepEqual(manifest.bodyShapes, BODY_SHAPES);
assert.equal(
  manifest.templates.length,
  SOURCE_TEMPLATES.reduce((sum, t) => sum + templateModes(t).length, 0),
);
for (const t of SOURCE_TEMPLATES)
  for (const mode of templateModes(t)) {
    const views = VIEW_MODES[mode];
    const record = manifest.templates.find(
      (r: { id: string; mode: string }) => r.id === t.id && r.mode === mode,
    );
    assert(record);
    assert.deepEqual(record.anchor, t.anchor);
    assert.deepEqual(record.views, views);
    for (const field of ['template', 'empty']) {
      const png = PNG.sync.read(await readFile(record[field]), { checkCRC: true });
      assert.equal(png.width, t.width);
      assert.equal(png.height, t.height * views.length);
      if (field === 'empty') assert(png.data.every((v, i) => i % 4 !== 3 || v === 0));
    }
  }
console.log(
  'Verified 2× TEMPLATE/EMPTY pairs, native dimensions, transparency, view order and shared rig anchors.',
);
