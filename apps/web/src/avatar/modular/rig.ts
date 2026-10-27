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
  const bob = [0, -1, 0, -1, 0, -1][frame] ?? 0;
  const p = (x: number, y: number): Point => ({
    x: Math.round(direction === 'west' ? 48 - x : x),
    y: Math.round(y),
  });
  const torsoWidth = side ? Math.round(shape.shoulders * 0.6) : shape.shoulders;
  const hipWidth = side ? Math.round(shape.hips * 0.65) : shape.hips;
  const arms = [-1, 1].map((sign): Limb => {
    const swing = phase * sign;
    return {
      root: p(24 + (side ? sign * 2 : sign * (torsoWidth / 2 + 1)), 31 + bob),
      joint: p(
        24 + (side ? -swing * 3 + sign * 2 : sign * (torsoWidth / 2 + 2)),
        36 + bob - Math.abs(swing),
      ),
      end: p(24 + (side ? -swing * 5 + sign * 2 : sign * (torsoWidth / 2 + 2)), 41 + bob - swing),
      width: shape.arm,
    };
  });
  const legs = [-1, 1].map((sign): Limb => {
    const swing = phase * sign,
      lift = Math.max(0, swing) * 2;
    return {
      root: p(24 + (side ? sign * 2 : sign * (hipWidth / 2 - 2)), 42 + bob),
      joint: p(24 + (side ? swing * 2 + sign * 2 : sign * (hipWidth / 2 - 2) + swing), 48 - lift),
      end: p(24 + (side ? swing * 4 + sign * 2 : sign * (hipWidth / 2 - 2)), 54 - lift),
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
    torsoWidth,
    hipWidth,
    head: p(24, 17 + bob),
    neck: p(24, 28 + bob),
    torso: p(24, 35 + bob),
    pelvis: p(24, 42 + bob),
    arms,
    legs,
    anchor: p(24, 56),
  };
}
export type Pose = ReturnType<typeof pose>;
