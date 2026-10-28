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
