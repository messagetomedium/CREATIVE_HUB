import type { Direction } from '@creative-factory/contracts';
import { pose, type Build, type Point, type Pose } from './modular/rig';
export const WALK_SECONDS = 0.8;
const TAU = Math.PI * 2;
export type Joint = Point & { rotation: number };
export interface EditorMotion {
  body: Joint;
  arms: Joint[];
  hands: Joint[];
  legs: { hip: Joint; knee: Joint; ankle: Joint }[];
}
/** Two fixed 12px bones; knee bends toward the facing direction. No limb scaling. */
export function solveLeg(hip: Point, ankle: Point) {
  const dx = ankle.x - hip.x,
    dy = ankle.y - hip.y;
  const length = Math.min(23.999, Math.hypot(dx, dy));
  const axis = Math.atan2(-dx, dy),
    bend = Math.acos(length / 24);
  const upper = axis - bend,
    lower = axis + bend;
  const knee = { x: hip.x - Math.sin(upper) * 12, y: hip.y + Math.cos(upper) * 12 };
  return {
    hip: { ...hip, rotation: upper },
    knee: { ...knee, rotation: lower },
    ankle: { x: knee.x - Math.sin(lower) * 12, y: knee.y + Math.cos(lower) * 12, rotation: 0 },
  };
}
export function editorMotion(
  build: Build,
  direction: Direction,
  animation: 'static' | 'idle' | 'walk',
  seconds: number,
): EditorMotion {
  const side = direction === 'east' || direction === 'west';
  const phase = (((seconds / WALK_SECONDS) % 1) + 1) % 1,
    walking = animation === 'walk';
  const bob = walking
    ? 1.3 * Math.sin(phase * TAU * 2)
    : animation === 'idle'
      ? 0.5 - 0.5 * Math.cos((seconds * TAU) / 3)
      : 0;
  const body = {
    x: 48 + (walking ? 0.35 * Math.sin(phase * TAU) : 0),
    y: 84 + bob,
    rotation: walking ? 0.008 * Math.sin(phase * TAU) : 0,
  };
  const factor = { slim: 1, average: 1.16, sturdy: 1.32 }[build],
    width = 2 * Math.round(((side ? 22 : 26) * factor) / 2);
  const arms = [-1, 1].map((sign, i) => ({
    // A profile shoulder sits behind the chest. Coordinates are canonical east-facing.
    x: side ? -5 + sign : sign * (width / 2 - 1),
    y: -20,
    rotation: side
      ? walking
        ? 0.43 * Math.cos(TAU * phase + i * Math.PI)
        : -0.06
      : -sign * 0.18 + (walking ? 0.012 * Math.sin(TAU * phase + i * Math.PI) : 0),
  }));
  const hands = arms.map((_, i) => ({
    x: 0,
    y: 20 + (walking && !side ? 1.2 * Math.sin(TAU * phase + i * Math.PI) : 0),
    rotation: 0,
  }));
  const legs = [-1, 1].map((sign, i) => {
    const u = (phase + i * 0.5) % 1,
      x = side ? sign * 2 : sign * Math.round(7 * factor);
    if (!walking || !side) {
      const lift = walking ? 3.5 * Math.max(0, Math.sin(TAU * (u - 0.5))) : 0;
      return {
        hip: { x, y: 84 - lift, rotation: 0 },
        knee: { x, y: 96 - lift, rotation: 0 },
        ankle: { x, y: 108 - lift, rotation: 0 },
      };
    }
    // First half: planted foot travels backwards relative to the body.
    // Second half: lifted foot returns forwards, with a rounded swing arc.
    const swing = (u - 0.5) * 2;
    const stride = u < 0.5 ? 6 - 24 * u : -6 + 12 * (swing * swing * (3 - 2 * swing));
    const lift = u < 0.5 ? 0 : 7 * Math.sin(Math.PI * swing);
    const leg = solveLeg({ x, y: 84.8 + bob }, { x: x + stride, y: 108 - lift });
    // A small heel rise at toe-off, then a level foot during the forward swing.
    leg.ankle.rotation =
      u > 0.375 && u < 0.5 ? 0.13 * Math.sin(((u - 0.375) * Math.PI) / 0.125) : 0;
    return leg;
  });
  return { body, arms, hands, legs };
}
/** Compatibility snapshots for the atlas inspector. Live preview uses continuous transforms. */
export function reviewPose(build: Build, direction: Direction, frame: number): Pose {
  const p = pose(build, direction, frame),
    walking = frame >= 2;
  const motion = editorMotion(
    build,
    direction,
    walking ? 'walk' : frame === 1 ? 'idle' : 'static',
    walking ? ((frame - 2) * WALK_SECONDS) / 4 : frame === 1 ? 1.5 : 0,
  );
  const mirror = (x: number) => (direction === 'west' ? 96 - x : x);
  const factor = { slim: 1, average: 1.16, sturdy: 1.32 }[build];
  p.bob = motion.body.y - 84;
  p.head = { x: 48, y: 34 + p.bob };
  p.torsoWidth = 2 * Math.round(((p.side ? 22 : 26) * factor) / 2);
  p.hipWidth = p.torsoWidth;
  p.torso = { x: 48, y: 72 + p.bob };
  p.pelvis = { x: 48, y: 84 + p.bob };
  p.arms = motion.arms.map((a) => {
    const root = { x: mirror(48 + a.x), y: 64 + p.bob };
    const end = {
      x: mirror(48 + a.x - 20 * Math.sin(a.rotation)),
      y: 64 + p.bob + 20 * Math.cos(a.rotation),
    };
    return {
      root,
      end,
      joint: { x: (root.x + end.x) / 2, y: (root.y + end.y) / 2 },
      width: 2 * Math.round((8 * factor) / 2),
    };
  });
  p.legs = motion.legs.map((l) => ({
    root: { x: mirror(48 + l.hip.x), y: l.hip.y },
    joint: { x: mirror(48 + l.knee.x), y: l.knee.y },
    end: { x: mirror(48 + l.ankle.x), y: l.ankle.y },
    width: 2 * Math.round((10 * factor) / 2),
  }));
  p.hands = p.arms.map((a) => a.end);
  p.feet = p.legs.map((l) => l.end);
  return p;
}
export const turnPreview = (direction: Direction, turn: 'left' | 'right'): Direction => {
  // Turn around the character’s own vertical axis; reverse the previous button mapping.
  const order: Direction[] = ['south', 'east', 'north', 'west'];
  return order[(order.indexOf(direction) + (turn === 'left' ? 1 : 3)) % 4]!;
};
