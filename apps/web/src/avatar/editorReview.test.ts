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
  expect(a.arms[0]!.end.x).toBe(a.arms[0]!.root.x);
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

test('editor uses two held idle frames, four integer walking frames and viewer-relative arrows', async () => {
  const { editorMotion, WALK_SECONDS, turnPreview } = await import('./editorMotion');
  expect(turnPreview('south', 'left')).toBe('west');
  expect(turnPreview('south', 'right')).toBe('east');
  expect(turnPreview(turnPreview('south', 'left'), 'right')).toBe('south');
  for (const dir of ['east', 'west', 'south', 'north'] as const) {
    const poses = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const m = editorMotion('average', dir, 'walk', (i * WALK_SECONDS) / 120);
      poses.add(JSON.stringify(m));
      const joints = [
        m.body,
        ...m.arms,
        ...m.hands,
        ...m.legs.flatMap((l) => [l.hip, l.knee, l.ankle]),
      ];
      expect(
        joints.every((j) => Number.isInteger(j.x) && Number.isInteger(j.y) && j.rotation === 0),
      ).toBe(true);
      expect(m.body.x).toBe(48);
      for (const l of m.legs) {
        expect(l.hip.x).toBe(l.knee.x);
        expect(l.knee.x).toBe(l.ankle.x);
        expect(l.ankle.y - l.hip.y).toBe(24);
      }
    }
    expect(poses.size).toBeLessThanOrEqual(4);
    expect(poses.size).toBeGreaterThanOrEqual(3);
    expect(editorMotion('average', dir, 'idle', 0)).toEqual(
      editorMotion('average', dir, 'idle', 0.49),
    );
    expect(editorMotion('average', dir, 'idle', 0.5)).toEqual(
      editorMotion('average', dir, 'idle', 0.99),
    );
  }
});
