import type { Direction } from '@creative-factory/contracts';
export const DIRECTIONS: Direction[] = ['north', 'east', 'south', 'west'];
export const FRAME = {
  width: 96,
  height: 128,
  anchor: { x: 48, y: 112 },
  worldScale: 0.5,
} as const;
export const ANIMATION_FPS = { idle: 2, walk: 8 } as const;
export const CACHE_LIMIT = 4;
export const FACE_ANCHORS = {
  north: { eyes: [], mouth: [] },
  east: { eyes: [{ x: 10, y: -2 }], mouth: [{ x: 14, y: 12 }] },
  south: {
    eyes: [
      { x: -10, y: -2 },
      { x: 6, y: -2 },
    ],
    mouth: [{ x: -2, y: 12 }],
  },
  west: { eyes: [{ x: -14, y: -2 }], mouth: [{ x: -18, y: 12 }] },
} as const;
export const RIG_VERSION = 'adult-2x-v4';
export type Build = 'slim' | 'average' | 'sturdy';
export type Point = { x: number; y: number };
export const BUILD_FACTORS = { slim: 1, average: 1.16, sturdy: 1.32 } as const;
const base = { shoulders: 28, waist: 18, hips: 22, arm: 10, leg: 12, spacing: 8 };
const shape = (factor: number) =>
  Object.fromEntries(
    Object.entries(base).map(([k, v]) => [
      k,
      ['arm', 'leg'].includes(k) ? 2 * Math.round((v * factor) / 2) : Math.round(v * factor),
    ]),
  ) as typeof base;
export const BODY_SHAPES = {
  slim: shape(BUILD_FACTORS.slim),
  average: shape(BUILD_FACTORS.average),
  sturdy: shape(BUILD_FACTORS.sturdy),
};
export type Limb = { root: Point; joint: Point; end: Point; width: number; tipWidth?: number };
export function pose(build: Build | 'very-slim', direction: Direction, frame: number) {
  // The new proportion study is editor-only until approved; retain the game's slim rig.
  build = build === 'very-slim' ? 'slim' : build;
  const shape = BODY_SHAPES[build],
    side = direction === 'east' || direction === 'west';
  const walking = frame >= 2,
    step = Math.max(0, frame - 2) % 4;
  const bob = frame === 1 ? -1 : walking && step % 2 ? -1 : 0;
  const headBob = 0;
  const p = (x: number, y: number): Point => ({
    x: Math.round(direction === 'west' ? 96 - x : x),
    y: Math.round(y),
  });
  const torsoWidth = side ? Math.round(shape.shoulders * 0.6) : shape.shoulders;
  const hipWidth = side ? Math.round(shape.hips * 0.65) : shape.hips;
  const phase = walking ? [1, 0, -1, 0][step]! : 0;
  const arms = [-1, 1].map((sign): Limb => {
    const root = p(48 + (side ? sign * 2 : sign * Math.round(15 * BUILD_FACTORS[build])), 62 + bob);
    const end = p(
      48 +
        (side
          ? sign * 2 - phase * sign * 5
          : sign * Math.round(15 * BUILD_FACTORS[build]) + phase * sign),
      82 + bob,
    );
    return {
      root,
      joint: { x: Math.round((root.x + end.x) / 2), y: Math.round((root.y + end.y) / 2) },
      end,
      width: shape.arm,
      tipWidth: 8,
    };
  });
  const legs = [-1, 1].map((sign, i): Limb => {
    const stride = walking ? (i === 0 ? [-9, 0, 9, 0] : [9, 0, -9, 0])[step]! : 0;
    const lift = walking && step === (i === 0 ? 3 : 1) ? 4 : 0;
    const x = 48 + (side ? sign * 2 : sign * shape.spacing);
    const root = p(x, 84 + bob);
    const end = p(x + (side ? stride : 0), 108 - lift);
    const joint = p(x + (side ? stride / 2 + (lift ? 2 : 0) : 0), 96 + bob - lift / 2);
    return { root, joint, end, width: shape.leg, tipWidth: 10 };
  });
  const hands = arms.map((a) => a.end),
    feet = legs.map((l) => l.end);
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
    head: p(48, 34 + bob),
    neck: p(48, 56 + bob),
    torso: p(48, 70 + bob),
    pelvis: p(48, 84 + bob),
    arms,
    legs,
    hands,
    feet,
    anchor: p(48, 112),
  };
}
export type Pose = ReturnType<typeof pose>;

export function parentPoint(p: Pose, parent: string): Point {
  if (parent === 'head') return p.head;
  if (parent === 'torso') return p.torso;
  if (parent === 'pelvis') return p.pelvis;
  const index = parent.endsWith('Left') ? 0 : 1;
  if (parent.startsWith('arm')) return p.arms[index]!.root;
  if (parent.startsWith('leg')) return p.legs[index]!.root;
  if (parent.startsWith('hand')) return p.hands[index]!;
  return p.feet[index]!;
}
