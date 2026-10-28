import { expect, test } from 'vitest';
import { reviewPose, EDITOR_SKIN_PALETTE } from './editorReview';
import { pose } from './modular/rig';
test('editor idle keeps entire legs and shoes fixed while head and torso breathe together', () => {
  for (const build of ['slim', 'average', 'sturdy'] as const)
    for (const dir of ['north', 'east', 'south', 'west'] as const) {
      const a = reviewPose(build, dir, 0),
        b = reviewPose(build, dir, 1);
      expect(b.legs).toEqual(a.legs);
      expect(b.feet).toEqual(a.feet);
      expect(b.head.y - a.head.y).toBe(1);
      expect(b.torso.y - a.torso.y).toBe(1);
      expect(a.arms.every((arm) => arm.tipWidth === undefined)).toBe(true);
      expect(a.legs.every((leg) => leg.tipWidth === undefined)).toBe(true);
    }
});
test('editor stance is symmetric with a fuller profile and a forward plant/backward stance swing', () => {
  const a = reviewPose('average', 'south', 0);
  expect(a.arms[0]!.root.x + a.arms[1]!.root.x).toBe(96);
  expect(a.arms[0]!.end.x + a.arms[1]!.end.x).toBe(96);
  expect(a.arms[0]!.end.x).toBeLessThan(a.arms[0]!.root.x);
  expect(a.legs[0]!.root.x + a.legs[1]!.root.x).toBe(96);
  expect(reviewPose('average', 'east', 0).torsoWidth).toBeGreaterThan(
    pose('average', 'east', 0).torsoWidth,
  );
  const frames = [2, 3, 4, 5].map((f) => reviewPose('average', 'east', f).feet[0]!);
  expect(frames[0]!.x).toBeGreaterThan(frames[1]!.x);
  expect(frames[0]!.y).toBe(frames[1]!.y);
  expect(frames[3]!.y).toBeLessThan(frames[2]!.y);
  expect(EDITOR_SKIN_PALETTE).toHaveLength(12);
});

test('continuous editor rig rotates fixed length arms and legs and follows a smooth weight arc', async () => {
  const { editorMotion, WALK_SECONDS, turnPreview } = await import('./editorMotion');
  expect(turnPreview('south', 'left')).toBe('east');
  expect(turnPreview('south', 'right')).toBe('west');
  for (const dir of ['east', 'west', 'south', 'north'] as const)
    for (let i = 0; i <= 120; i++) {
      const m = editorMotion('average', dir, 'walk', (i * WALK_SECONDS) / 120);
      for (const l of m.legs) {
        expect(Math.hypot(l.knee.x - l.hip.x, l.knee.y - l.hip.y)).toBeCloseTo(12, 6);
        expect(Math.hypot(l.ankle.x - l.knee.x, l.ankle.y - l.knee.y)).toBeCloseTo(12, 6);
      }
      if (dir === 'east') expect(m.arms[1]!.x).toBeLessThan(0);
    }
  const down = editorMotion('average', 'east', 'walk', WALK_SECONDS / 8),
    up = editorMotion('average', 'east', 'walk', (3 * WALK_SECONDS) / 8);
  expect(down.body.y).toBeGreaterThan(84);
  expect(up.body.y).toBeLessThan(84);
  const contact = editorMotion('average', 'east', 'walk', 0).legs[0]!.ankle;
  const passing = editorMotion('average', 'east', 'walk', WALK_SECONDS / 4).legs[0]!.ankle;
  expect(contact.y).toBeCloseTo(108);
  expect(passing.y).toBeCloseTo(108);
  expect(passing.x).toBeLessThan(contact.x);
});
