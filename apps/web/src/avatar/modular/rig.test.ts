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
        expect(p.anchor).toEqual({ x: 48, y: 112 });
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

test('body factors increase every limb width and attachment spacing without shoulder animation', () => {
  const builds = ['slim', 'average', 'sturdy'] as const;
  for (const field of ['arm', 'leg', 'shoulders', 'waist', 'hips', 'spacing'] as const) {
    expect(BODY_SHAPES.slim[field]).toBeLessThan(BODY_SHAPES.average[field]);
    expect(BODY_SHAPES.average[field]).toBeLessThan(BODY_SHAPES.sturdy[field]);
  }
  for (const build of builds)
    for (const dir of DIRECTIONS)
      for (let frame = 0; frame < 6; frame++) {
        const p = pose(build, dir, frame),
          neutral = pose(build, dir, 0);
        p.arms.forEach((arm, i) => {
          expect(arm.root.x).toBe(neutral.arms[i]!.root.x);
          expect(arm.root.y - p.torso.y).toBe(neutral.arms[i]!.root.y - neutral.torso.y);
          expect(p.hands[i]).toEqual(arm.end);
        });
        p.legs.forEach((leg, i) => expect(p.feet[i]).toEqual(leg.end));
      }
  expect(pose('average', 'east', 2).feet[0]!.x).not.toBe(pose('average', 'east', 4).feet[0]!.x);
  const a = pose('average', 'south', 0),
    b = pose('average', 'south', 1);
  expect(b.neck.y - a.neck.y).toBe(b.head.y - a.head.y);
});

test('artist templates use native 2× pivots, explicit modes, separate gloves and fixed footwear', async () => {
  const { SOURCE_TEMPLATES, templateDescriptor, VIEW_MODES } = await import('./templates');
  expect(SOURCE_TEMPLATES.some((t) => t.field === 'base')).toBe(false);
  expect(SOURCE_TEMPLATES.find((t) => t.id === 'glove')!.parent).toBe('handLeft');
  expect(SOURCE_TEMPLATES.find((t) => t.id === 'shoe')!.width).toBe(40);
  expect(VIEW_MODES.front).toEqual(['south']);
  for (const t of SOURCE_TEMPLATES) {
    const d = templateDescriptor(t);
    expect(d.anchor).toEqual(t.anchor);
    expect(d.frameWidth).toBe(t.width);
    expect(d.selection.slot).toBe(1);
  }
});
