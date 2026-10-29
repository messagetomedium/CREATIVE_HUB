import { expect, test } from 'vitest';
import { reviewPose, EDITOR_SKIN_PALETTE } from './editorReview';
import { pose } from './modular/rig';
import { editorWalkPoseSeconds } from './editorMotion';
test('editor idle keeps entire legs and shoes fixed while head and torso breathe together', () => {
  for (const build of ['very-slim', 'slim', 'average', 'sturdy'] as const)
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
        expect(l.ankle.y - l.hip.y).toBe(26);
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

test('wider arm seams, overlapping fists and narrow profile feet stay attached in every phase', async () => {
  const { editorMotion, editorDimensions, EDITOR_ARM_LENGTH } = await import('./editorMotion');
  for (const build of ['very-slim', 'slim', 'average', 'sturdy'] as const) {
    const front = editorMotion(build, 'south', 'static', 0),
      dims = editorDimensions(build, false);
    expect(Math.abs(front.arms[0]!.x) - dims.armWidth / 2).toBe(dims.torsoWidth / 2 - 1);
    for (const dir of ['south', 'north', 'east', 'west'] as const)
      for (let i = 0; i < 4; i++) {
        const p = editorMotion(build, dir, 'walk', editorWalkPoseSeconds(i));
        for (const hand of p.hands) {
          expect(hand.y + 4 - 5).toBeLessThan(EDITOR_ARM_LENGTH); // circle overlaps the end of the arm
          expect(Math.abs(hand.x)).toBeLessThanOrEqual(1);
        }
        expect(reviewPose(build, dir, i + 2).head.y - 34).toBe(p.body.y - 84 + p.head.y + 50);
        if ((build === 'slim' || build === 'very-slim') && (dir === 'east' || dir === 'west')) {
          const half = editorDimensions(build, true).torsoWidth / 2;
          for (const l of p.legs) {
            const radius = editorDimensions(build, true).legWidth / 2;
            expect(l.ankle.x - radius).toBeGreaterThanOrEqual(-half);
            expect(l.ankle.x + radius).toBeLessThanOrEqual(half);
          }
        }
      }
  }
  const thin = reviewPose('very-slim', 'south', 0),
    slim = reviewPose('slim', 'south', 0);
  expect(thin.torsoWidth).toBeLessThan(slim.torsoWidth);
  expect(thin.arms[0]!.width).toBe(slim.arms[0]!.width);
  expect(thin.arms[0]!.width).toBe(8);
  expect(thin.legs[0]!.width).toBeLessThan(slim.legs[0]!.width);
  expect(thin.head).toEqual(slim.head);
  expect(pose('very-slim', 'south', 0)).toEqual(pose('slim', 'south', 0));
});

test('female shoulders narrow without changing the base, arms lengthen and thin steps reach forwards', async () => {
  const { editorDimensions, editorMotion, EDITOR_ARM_LENGTH } = await import('./editorMotion');
  const { editorHairRegistration } = await import('./editorHair');
  expect(EDITOR_ARM_LENGTH).toBe(26);
  for (const build of ['very-slim', 'slim', 'average', 'sturdy'] as const)
    for (const side of [false, true]) {
      const m = editorDimensions(build, side, 'male'),
        f = editorDimensions(build, side, 'female');
      expect(f.torsoWidth).toBe(m.torsoWidth);
      if (side) expect(f.shoulderWidth).toBe(m.shoulderWidth);
      else expect(f.shoulderWidth).toBeLessThan(m.shoulderWidth);
      expect(m.shoulderWidth).toBe(m.torsoWidth);
      expect(f.armWidth).toBe(m.armWidth);
      if (side && (build === 'very-slim' || build === 'slim')) {
        const stride = Math.max(0, m.torsoWidth / 2 - 7);
        const e = editorMotion(build, 'east', 'walk', 0),
          w = editorMotion(build, 'west', 'walk', 0);
        expect(e.legs[0]!.hip.x).toBe(-2 + stride + 2);
        expect(w.legs[0]!.hip.x).toBe(-e.legs[0]!.hip.x);
      }
    }
  const s = reviewPose('slim', 'south', 0),
    n = reviewPose('slim', 'north', 0);
  expect(s.arms[0]!.root.x).toBe(n.arms[1]!.root.x);
  expect(s.arms[0]!.end.y - s.arms[0]!.root.y).toBe(26);
  for (let slot = 1; slot <= 4; slot++) {
    const views = (['north', 'east', 'south', 'west'] as const).map(
      (d) => editorHairRegistration(slot, d)!,
    );
    expect(views.map((v) => v.row)).toEqual([0, 1, 2, 3]);
    expect(new Set(views.map((v) => v.scaleY)).size).toBe(1);
  }
});

test('profile arms move inward by build without changing their four walking offsets', async () => {
  const { editorMotion, editorDimensions } = await import('./editorMotion');
  for (const [build, inset] of [
    ['very-slim', 3],
    ['slim', 2],
    ['average', 1],
    ['sturdy', 0],
  ] as const)
    for (const gender of ['male', 'female'] as const)
      for (const dir of ['east', 'west'] as const) {
        const facing = dir === 'west' ? -1 : 1;
        for (let phase = 0; phase < 4; phase++) {
          const p = editorMotion(build, dir, 'walk', editorWalkPoseSeconds(phase), gender);
          for (const [i, sign] of [-1, 1].entries()) {
            const previousX = facing * (-5 + sign + [0, 1, 0, -1][(phase + i * 2) % 4]!);
            expect(p.arms[i]!.x).toBeCloseTo(previousX + facing * inset, 10);
          }
          if (build === 'very-slim') {
            const near = dir === 'west' ? 0 : 1,
              dims = editorDimensions(build, true, gender);
            expect(Math.abs(p.arms[near]!.x) + dims.armWidth / 2).toBeLessThan(dims.torsoWidth / 2);
          }
        }
      }
});

test('whole legs lift higher in the forward recovery for both facing directions and heels meet calves', async () => {
  const { editorMotion, editorDimensions, editorShoeLayout, EDITOR_LEG_LENGTH } =
    await import('./editorMotion');
  for (const build of ['very-slim', 'slim', 'average', 'sturdy'] as const) {
    for (const dir of ['east', 'west'] as const) {
      const facing = dir === 'east' ? 1 : -1;
      const frames = [0, 1, 2, 3].map((i) =>
        editorMotion(build, dir, 'walk', editorWalkPoseSeconds(i)),
      );
      for (let leg = 0; leg < 2; leg++) {
        const order = [0, 1, 2, 3].map((step) => frames[(step - leg * 2 + 4) % 4]!.legs[leg]!);
        const x = order.map((p) => facing * p.ankle.x);
        expect(x[0]).toBeGreaterThan(x[1]!);
        expect(x[1]).toBeGreaterThan(x[2]!);
        expect(x[3]).toBeGreaterThan(x[2]!);
        expect(x[0]).toBeGreaterThan(x[3]!);
        expect(order[0]!.hip.y - order[3]!.hip.y).toBe(6);
        expect(order[0]!.hip.y - order[2]!.hip.y).toBe(0);
        const heel = Math.max(5, editorDimensions(build, true).legWidth / 2),
          shoe = editorShoeLayout(build, dir, leg);
        expect(dir === 'east' ? shoe.left : shoe.left + shoe.width).toBe(
          dir === 'east' ? -heel : heel,
        );
        expect(order[0]!.ankle.y - order[0]!.hip.y).toBe(EDITOR_LEG_LENGTH);
      }
      for (const frame of frames) expect(frame.body.y + frame.head.y).toBe(34);
    }
    const m = editorDimensions(build, false, 'male', 'north'),
      f = editorDimensions(build, false, 'female', 'north');
    expect(f.shoulderWidth).toBe(m.shoulderWidth);
    for (const dir of ['south', 'north'] as const)
      for (let i = 0; i < 2; i++) {
        const shoe = editorShoeLayout(build, dir, i);
        expect(shoe.left).toBe(-shoe.width / 2);
      }
    const attached = editorMotion(build, 'south', 'static', 0, 'male', 'attached');
    const separated = editorMotion(build, 'south', 'static', 0, 'male', 'separated');
    expect(Math.abs(separated.arms[0]!.x) - Math.abs(attached.arms[0]!.x)).toBe(2);
  }
});

test('passing poses hold longer, the head stays still and support lasts through three poses', async () => {
  const { editorMotion, editorWalkPhase, EDITOR_WALK_FRAME_MS, EDITOR_ARM_PLACEMENT } =
    await import('./editorMotion');
  expect(EDITOR_ARM_PLACEMENT).toBe('attached');
  expect(EDITOR_WALK_FRAME_MS).toEqual([125, 175, 125, 175]);
  for (const [seconds, phase] of [
    [0, 0],
    [0.124, 0],
    [0.125, 1],
    [0.299, 1],
    [0.3, 2],
    [0.424, 2],
    [0.425, 3],
    [0.599, 3],
    [0.6, 0],
  ] as const)
    expect(editorWalkPhase(seconds)).toBe(phase);
  for (const direction of ['north', 'east', 'south', 'west'] as const)
    for (let i = 0; i < 4; i++) {
      const m = editorMotion('slim', direction, 'walk', editorWalkPoseSeconds(i));
      expect(m.body.y + m.head.y).toBe(34);
      expect(m.legs.filter((l) => l.hip.y === 84).length).toBeGreaterThanOrEqual(1);
      expect(reviewPose('slim', direction, i + 2).head.y).toBe(34);
    }
  for (const build of ['very-slim', 'slim'] as const) {
    const frames = [0, 1, 2, 3].map((i) =>
      editorMotion(build, 'east', 'walk', editorWalkPoseSeconds(i)),
    );
    const x = frames.map((m) => m.legs[0]!.hip.x);
    expect(Math.max(...x) - Math.min(...x)).toBe(build === 'very-slim' ? 6 : 10);
    expect(frames.filter((m) => m.legs[0]!.hip.y === 84)).toHaveLength(3);
  }
});
