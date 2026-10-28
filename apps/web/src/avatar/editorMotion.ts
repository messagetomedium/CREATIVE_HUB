import type { AvatarCustomization, Direction } from '@creative-factory/contracts';
import { pose, ANIMATION_FPS, type Point, type Pose } from './modular/rig';
export type EditorBuild = AvatarCustomization['build'];
export function editorDimensions(build: EditorBuild, side: boolean) {
  const factor = { 'very-slim': 0.84, slim: 1, average: 1.16, sturdy: 1.32 }[build];
  return {
    torsoWidth: 2 * Math.round(((side ? 22 : 26) * factor) / 2),
    armWidth: 2 * Math.round((8 * factor) / 2),
    legWidth: 2 * Math.round((10 * factor) / 2),
    spacing: Math.round(7 * factor),
  };
}
export const WALK_SECONDS = 4 / ANIMATION_FPS.walk;
export type Joint = Point & { rotation: 0 };
export interface EditorMotion {
  body: Joint;
  arms: Joint[];
  hands: Joint[];
  legs: { hip: Joint; knee: Joint; ankle: Joint }[];
}
/** Authoring poses only: integer translations, two idle poses, four walking poses. */
export function editorMotion(
  build: EditorBuild,
  direction: Direction,
  animation: 'static' | 'idle' | 'walk',
  seconds: number,
): EditorMotion {
  const side = direction === 'east' || direction === 'west';
  const walking = animation === 'walk';
  const phase = Math.floor(Math.max(0, seconds) * ANIMATION_FPS.walk + 1e-8) % 4;
  const bob = walking
    ? [0, -1, 0, -1][phase]!
    : animation === 'idle'
      ? Math.floor(Math.max(0, seconds) * ANIMATION_FPS.idle) % 2
      : 0;
  const dims = editorDimensions(build, side),
    width = dims.torsoWidth;
  const arms: Joint[] = [-1, 1].map((sign, i) => ({
    // Flat inner shoulder touches the torso; only one pixel overlaps the seam.
    x: side
      ? -5 + sign + (walking ? [0, 1, 0, -1][(phase + i * 2) % 4]! : 0)
      : sign * (width / 2 + dims.armWidth / 2 - 1),
    y: -20,
    rotation: 0,
  }));
  const hands: Joint[] = arms.map((_, i) => ({
    x: walking && side ? [0, 1, 0, -1][(phase + i * 2) % 4]! : 0,
    // The fist overlaps the rounded forearm, even at its lowest position.
    y: 16 + (walking && !side ? [0, -2, 0, 2][(phase + i * 2) % 4]! : 0),
    rotation: 0,
  }));
  const legs = [-1, 1].map((sign, i) => {
    const step = (phase + i * 2) % 4;
    const narrow = build === 'slim' || build === 'very-slim';
    const baseX = side ? (narrow ? -2 + sign : sign * 2) : sign * dims.spacing;
    // Include the compact boot (-5..+9), so the whole foot stays inside a narrow profile.
    const stride = narrow ? Math.max(0, width / 2 - 8) : 5;
    const x = baseX + (walking && side ? [stride, 0, -stride, 0][step]! : 0);
    const y = 84 - (walking && step === 3 ? 4 : 0);
    // The entire straight leg is translated as one image; no knee segments or bends.
    return {
      hip: { x, y, rotation: 0 as const },
      knee: { x, y: y + 12, rotation: 0 as const },
      ankle: { x, y: y + 24, rotation: 0 as const },
    };
  });
  return { body: { x: 48, y: 84 + bob, rotation: 0 }, arms, hands, legs };
}
/** These exact poses are baked into the same sheet shown by the editor player. */
export function reviewPose(build: EditorBuild, direction: Direction, frame: number): Pose {
  const p = pose(build, direction, frame),
    walking = frame >= 2;
  const m = editorMotion(
    build,
    direction,
    walking ? 'walk' : frame === 1 ? 'idle' : 'static',
    walking ? ((frame - 2) * WALK_SECONDS) / 4 : frame === 1 ? 0.5 : 0,
  );
  const mirror = (x: number) => (direction === 'west' ? 96 - x : x);
  const dims = editorDimensions(build, p.side);
  p.bob = m.body.y - 84;
  p.head = { x: 48, y: 34 + p.bob };
  p.torsoWidth = dims.torsoWidth;
  p.hipWidth = p.torsoWidth;
  p.torso = { x: 48, y: 72 + p.bob };
  p.pelvis = { x: 48, y: 84 + p.bob };
  p.arms = m.arms.map((a) => {
    const root = { x: mirror(48 + a.x), y: a.y + 84 + p.bob },
      end = { x: root.x, y: root.y + 20 };
    return {
      root,
      end,
      joint: { x: root.x, y: root.y + 10 },
      width: dims.armWidth,
    };
  });
  p.legs = m.legs.map((l) => ({
    root: { x: mirror(48 + l.hip.x), y: l.hip.y },
    joint: { x: mirror(48 + l.knee.x), y: l.knee.y },
    end: { x: mirror(48 + l.ankle.x), y: l.ankle.y },
    width: dims.legWidth,
  }));
  p.hands = p.arms.map((a, i) => ({ x: a.end.x, y: a.end.y + m.hands[i]!.y - 20 }));
  p.feet = p.legs.map((l) => l.end);
  return p;
}
export const turnPreview = (direction: Direction, turn: 'left' | 'right'): Direction => {
  // Viewer-relative: from the front, left shows a profile facing screen-left.
  const order: Direction[] = ['south', 'west', 'north', 'east'];
  return order[(order.indexOf(direction) + (turn === 'left' ? 1 : 3)) % 4]!;
};
