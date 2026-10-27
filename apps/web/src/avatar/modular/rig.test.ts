import { test, expect } from 'vitest';
import { BODY_SHAPES, DIRECTIONS, pose } from './rig';
import { normalizeMask, colorMask, shades, INDEX_LEVELS } from './materials';
import { SavedAvatarSchema } from '@creative-factory/contracts';
import { avatarCatalog } from '../catalog';
import { updateConstructor } from '../editor';
import { PartEntrySchema } from './parts';
test('all 72 poses keep the same head geometry, grounded anchor and integer joint coordinates', () => {
  for (const build of Object.keys(BODY_SHAPES) as (keyof typeof BODY_SHAPES)[])
    for (const dir of DIRECTIONS)
      for (let f = 0; f < 6; f++) {
        const p = pose(build, dir, f);
        expect(p.head).toEqual(pose('average', dir, f).head);
        expect(p.anchor).toEqual({ x: 24, y: 56 });
        for (const l of [...p.arms, ...p.legs])
          for (const q of [l.root, l.joint, l.end])
            expect([Number.isInteger(q.x), Number.isInteger(q.y)]).toEqual([true, true]);
      }
  expect(pose('slim', 'south', 0).torsoWidth).toBeLessThan(pose('sturdy', 'south', 0).torsoWidth);
  expect(pose('average', 'east', 3).legs.map((l) => l.end.y)).not.toEqual(
    pose('average', 'east', 5).legs.map((l) => l.end.y),
  );
});
test('legacy child saves become adults without losing identity-independent appearance or revision', () => {
  const a = updateConstructor(avatarCatalog.defaultAvatar, {
    gender: 'female',
    hair: { male: 2, female: 4 },
  });
  const migrated = SavedAvatarSchema.parse({
    ...a,
    revision: 7,
    customization: { ...a.customization, age: 'child' },
  });
  expect(migrated.customization!.age).toBe('adult');
  expect(migrated.revision).toBe(7);
  expect(migrated.parts).toEqual(a.parts);
  expect(migrated.palette).toEqual(a.palette);
  expect(migrated.customization!.hair).toEqual({ male: 2, female: 4 });
});
test('indexed palette swap preserves alpha, distinct shading and a fixed thin outline', () => {
  const data = {
    width: 6,
    height: 1,
    data: new Uint8ClampedArray(
      INDEX_LEVELS.flatMap((v) => [v, v, v, 255]).concat([11, 99, 11, 0]),
    ),
  } as ImageData;
  normalizeMask(data);
  colorMask(data, '#cf6546');
  expect([...data.data.slice(12, 15)]).toEqual([207, 101, 70]);
  expect(data.data[23]).toBe(0);
  expect(new Set(shades('#cf6546')).size).toBe(5);
  expect(shades('#cf6546')[0]).toBe(shades('#f4e3d4')[0]);
});
test('part descriptions reject arbitrary remote URLs and support per-pose corrections', () => {
  const d = {
    id: 'shirt',
    parent: 'armRight',
    pass: 'front',
    material: 'top',
    frameWidth: 6,
    frameHeight: 12,
    anchor: { x: 3, y: 0 },
    offset: { x: 0, y: 0 },
    fit: 'limb',
    sync: 'limb',
    source: '/content/shirt.png',
    selection: { field: 'top', slot: 1 },
    overrides: [{ direction: 'south', phase: 3, sourceFrame: 1, offset: { x: 1, y: 0 } }],
  };
  expect(PartEntrySchema.safeParse(d).success).toBe(true);
  expect(
    PartEntrySchema.safeParse({ ...d, source: 'https://external.example/art.png' }).success,
  ).toBe(false);
});

test('skin overlay normalization retains subtle alpha instead of dropping blush', () => {
  const d = { width: 1, height: 1, data: new Uint8ClampedArray([184, 184, 184, 64]) } as ImageData;
  normalizeMask(d, true);
  colorMask(d, '#c08070');
  expect(d.data[3]).toBe(64);
  expect([...d.data.slice(0, 3)]).toEqual([192, 128, 112]);
});

test('whole arms swing, legs only translate and sturdy feet remain close under the hips', () => {
  for (const dir of DIRECTIONS)
    for (let frame = 0; frame < 6; frame++) {
      const p = pose('sturdy', dir, frame),
        neutral = pose('sturdy', dir, 0);
      p.legs.forEach((l, i) => {
        expect(l.root.x).toBe(l.end.x);
        expect(l.joint.x).toBe(l.end.x);
        expect(l.end.x).toBe(neutral.legs[i]!.end.x);
        expect(l.end.y - l.root.y).toBe(12);
      });
      for (const arm of p.arms) {
        expect(Math.abs(arm.joint.x - (arm.root.x + arm.end.x) / 2)).toBeLessThanOrEqual(0.5);
        expect(arm.end.y - arm.root.y).toBe(12);
      }
    }
  const sturdy = pose('sturdy', 'south', 0);
  expect(sturdy.legs[1]!.end.x - sturdy.legs[0]!.end.x).toBe(10);
  const a = pose('average', 'south', 0),
    b = pose('average', 'south', 1);
  expect(b.torso).toEqual(a.torso);
  expect(b.neck).toEqual(a.neck);
  expect(b.head.y).toBe(a.head.y - 1);
});

test('artist kit has four static V3 modules, shared pivots and no separate hand or neck', async () => {
  const { SOURCE_TEMPLATES, templateDescriptor } = await import('./templates');
  const base = SOURCE_TEMPLATES.filter((t) => t.field === 'base');
  expect(base.map((t) => t.id)).toEqual(['head', 'torso', 'arm', 'leg']);
  for (const t of SOURCE_TEMPLATES) {
    const d = templateDescriptor(t);
    expect(d.mirrorWest).toBe(true);
    expect(d.anchor).toEqual(t.anchor);
    expect(d.selection.slot).toBe(1);
  }
  const { hairPlacement } = await import('./hair');
  for (let slot = 1; slot <= 4; slot++) {
    const east = hairPlacement(slot, 'east'),
      west = hairPlacement(slot, 'west');
    expect(west.anchor).toEqual(east.anchor);
    expect(west.row).toBe(east.row);
    expect(west.mirror).toBe(true);
  }
});
