import type { Direction } from '@creative-factory/contracts';
export const DIRECTIONS: Direction[] = ['north', 'east', 'south', 'west'];
export type Build = 'slim' | 'average' | 'sturdy';
export type Point = { x: number; y: number };
export const BODY_SHAPES = {
  slim: { shoulders: 14, waist: 9, hips: 11, arm: 3, leg: 3 },
  average: { shoulders: 18, waist: 13, hips: 15, arm: 3, leg: 4 },
  sturdy: { shoulders: 22, waist: 18, hips: 20, arm: 4, leg: 5 },
} as const;
export type Limb = { root: Point; joint: Point; end: Point; width: number };
export function pose(build: Build, direction: Direction, frame: number) {
  const shape = BODY_SHAPES[build],
    side = direction === 'east' || direction === 'west';
  const phase = [0, 0, 0, 1, 0, -1][frame] ?? 0;
  const bob = [0, 0, 0, -1, 0, -1][frame] ?? 0;
  // Only the head breathes in idle. The neck belongs to the stationary torso.
  const headBob = frame === 1 ? -1 : 0;
  const p = (x: number, y: number): Point => ({
    x: Math.round(direction === 'west' ? 48 - x : x),
    y: Math.round(y),
  });
  const torsoWidth = side ? Math.round(shape.shoulders * 0.6) : shape.shoulders;
  const hipWidth = side ? Math.round(shape.hips * 0.65) : shape.hips;
  const arms = [-1, 1].map((sign): Limb => {
    const swing = phase * sign;
    const root = p(24 + (side ? sign : sign * (torsoWidth / 2 + 1)), 31 + bob - (side ? 0 : swing));
    const end = p(
      24 + (side ? sign - swing * 3 : sign * (torsoWidth / 2 + 1)),
      43 + bob - (side ? 0 : swing),
    );
    return {
      root,
      joint: { x: Math.round((root.x + end.x) / 2), y: Math.round((root.y + end.y) / 2) },
      end,
      width: shape.arm,
    };
  });
  // A whole straight leg translates vertically; no knee bend, splay or horizontal stride.
  const spacing = build === 'sturdy' ? 5 : 4;
  const legs = [-1, 1].map((sign): Limb => {
    const lift = Math.max(0, phase * sign) * 2;
    const x = 24 + (side ? sign : sign * spacing);
    return {
      root: p(x, 42 + bob - lift),
      joint: p(x, 48 + bob - lift),
      end: p(x, 54 + bob - lift),
      width: shape.leg,
    };
  });
  return {
    build,
    direction,
    frame,
    shape,
    side,
    bob,
    headBob,
    torsoWidth,
    hipWidth,
    head: p(24, 17 + bob + headBob),
    neck: p(24, 28 + bob),
    torso: p(24, 35 + bob),
    pelvis: p(24, 42 + bob),
    arms,
    legs,
    anchor: p(24, 56),
  };
}
export type Pose = ReturnType<typeof pose>;
