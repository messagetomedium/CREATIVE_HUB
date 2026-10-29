import type { AvatarCustomization, Direction } from '@creative-factory/contracts';
import { pose, ANIMATION_FPS, type Point, type Pose } from './modular/rig';
export type EditorBuild = AvatarCustomization['build'];
export const EDITOR_ARM_LENGTH = 22;
export const EDITOR_LEG_LENGTH = 26;
export type ArmPlacement = 'attached' | 'separated';
// Previous approved placement (9c6054f) is retained for a one-parameter rollback.
export const EDITOR_ARM_PLACEMENT: ArmPlacement = 'separated';
export function editorDimensions(
  build: EditorBuild,
  side: boolean,
  gender: AvatarCustomization['gender'] = 'male',
  direction?: Direction,
) {
  const factor = { 'very-slim': 0.84, slim: 1, average: 1.16, sturdy: 1.32 }[build];
  const torsoWidth = 2 * Math.round(((side ? 22 : 26) * factor) / 2);
  return {
    shoulderWidth: torsoWidth - (gender === 'female' && !side && direction !== 'north' ? 4 : 0),
    torsoWidth: 2 * Math.round(((side ? 22 : 26) * factor) / 2),
    armWidth: Math.max(8, 2 * Math.round((8 * factor) / 2)),
    legWidth: 2 * Math.round((10 * factor) / 2),
    spacing: Math.round(7 * factor),
  };
}
export const WALK_SECONDS = 4 / ANIMATION_FPS.walk;
export type Joint = Point & { rotation: 0 };
export interface EditorMotion {
  body: Joint;
  head: Joint;
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
  gender: AvatarCustomization['gender'] = 'male',
  armPlacement: ArmPlacement = EDITOR_ARM_PLACEMENT,
): EditorMotion {
  const side = direction === 'east' || direction === 'west';
  const walking = animation === 'walk';
  const phase = Math.floor(Math.max(0, seconds) * ANIMATION_FPS.walk + 1e-8) % 4;
  const bob = walking
    ? [0, -1, 0, -1][phase]!
    : animation === 'idle'
      ? Math.floor(Math.max(0, seconds) * ANIMATION_FPS.idle) % 2
      : 0;
  const dims = editorDimensions(build, side, gender, direction),
    width = dims.torsoWidth,
    facing = direction === 'west' ? -1 : 1,
    frontSign = direction === 'north' ? -1 : 1;
  const arms: Joint[] = [-1, 1].map((sign, i) => ({
    // Separated arms leave a one-pixel gap below a small shoulder connector.
    x: side
      ? facing * (-5 + sign + (walking ? [0, 1, 0, -1][(phase + i * 2) % 4]! : 0))
      : frontSign *
        sign *
        ((armPlacement === 'separated' ? width / 2 + 1 : dims.shoulderWidth / 2 - 1) +
          dims.armWidth / 2),
    y: -20,
    rotation: 0,
  }));
  const hands: Joint[] = arms.map((_, i) => ({
    x: walking && side ? facing * [0, 1, 0, -1][(phase + i * 2) % 4]! : 0,
    // The fist overlaps the rounded forearm, even at its lowest position.
    y: EDITOR_ARM_LENGTH - 4 + (walking && !side ? [0, -2, 0, 2][(phase + i * 2) % 4]! : 0),
    rotation: 0,
  }));
  const legs = [-1, 1].map((sign, i) => {
    const step = (phase + i * 2) % 4;
    const narrow = build === 'slim' || build === 'very-slim';
    const baseX = side ? (narrow ? -2 + sign : sign * 2) : frontSign * sign * dims.spacing;
    // Keep the straight leg under the narrow torso while allowing forward toe reach.
    const stride = narrow ? Math.max(0, width / 2 - 8) : 5;
    // Use spare space ahead of the leg, keeping the straight leg under the torso.
    const reach = narrow ? Math.min(stride + 2, width / 2 - dims.legWidth / 2 + 1) : stride;
    const x = side
      ? facing * (baseX + (walking ? [reach, 0, -stride, Math.ceil(reach / 2)][step]! : 0))
      : baseX;
    const y = 84 - (walking ? [0, 0, 2, 6][step]! : 0);
    // The entire straight leg is translated as one image; no knee segments or bends.
    return {
      hip: { x, y, rotation: 0 as const },
      knee: { x, y: y + EDITOR_LEG_LENGTH / 2, rotation: 0 as const },
      ankle: { x, y: y + EDITOR_LEG_LENGTH, rotation: 0 as const },
    };
  });
  return {
    body: { x: 48, y: 84 + bob, rotation: 0 },
    head: { x: 0, y: -50 + (walking ? [0, -1, 0, -1][phase]! : 0), rotation: 0 },
    arms,
    hands,
    legs,
  };
}
/** These exact poses are baked into the same sheet shown by the editor player. */
export function reviewPose(
  build: EditorBuild,
  direction: Direction,
  frame: number,
  gender: AvatarCustomization['gender'] = 'male',
  armPlacement: ArmPlacement = EDITOR_ARM_PLACEMENT,
): Pose {
  const p = pose(build, direction, frame),
    walking = frame >= 2;
  const m = editorMotion(
    build,
    direction,
    walking ? 'walk' : frame === 1 ? 'idle' : 'static',
    walking ? ((frame - 2) * WALK_SECONDS) / 4 : frame === 1 ? 0.5 : 0,
    gender,
    armPlacement,
  );
  const dims = editorDimensions(build, p.side, gender, direction);
  p.bob = m.body.y - 84;
  p.headBob = m.head.y + 50;
  p.head = { x: 48, y: 34 + p.bob + p.headBob };
  p.torsoWidth = dims.shoulderWidth;
  p.hipWidth = dims.torsoWidth;
  p.torso = { x: 48, y: 72 + p.bob };
  p.pelvis = { x: 48, y: 84 + p.bob };
  p.arms = m.arms.map((a) => {
    const root = { x: 48 + a.x, y: a.y + 84 + p.bob },
      end = { x: root.x, y: root.y + EDITOR_ARM_LENGTH };
    return {
      root,
      end,
      joint: { x: root.x, y: root.y + EDITOR_ARM_LENGTH / 2 },
      width: dims.armWidth,
    };
  });
  p.legs = m.legs.map((l) => ({
    root: { x: 48 + l.hip.x, y: l.hip.y },
    joint: { x: 48 + l.knee.x, y: l.knee.y },
    end: { x: 48 + l.ankle.x, y: l.ankle.y },
    width: dims.legWidth,
  }));
  p.hands = p.arms.map((a, i) => ({
    x: a.end.x + m.hands[i]!.x,
    y: a.end.y + m.hands[i]!.y - EDITOR_ARM_LENGTH,
  }));
  p.feet = p.legs.map((l) => l.end);
  return p;
}
export const turnPreview = (direction: Direction, turn: 'left' | 'right'): Direction => {
  // Viewer-relative: from the front, left shows a profile facing screen-left.
  const order: Direction[] = ['south', 'west', 'north', 'east'];
  return order[(order.indexOf(direction) + (turn === 'left' ? 1 : 3)) % 4]!;
};

/** Heel derives from the actual calf width, not a fixed offset for all builds. */
export function editorShoeLayout(build: EditorBuild, direction: Direction, index: number) {
  const side = direction === 'east' || direction === 'west',
    leg = editorDimensions(build, side).legWidth;
  const heel = Math.max(5, leg / 2),
    screenSign = (direction === 'north' ? -1 : 1) * (index === 0 ? -1 : 1);
  return {
    left: side
      ? direction === 'west'
        ? heel - 14
        : -heel
      : leg >= 12
        ? screenSign < 0
          ? -leg / 2
          : leg / 2 - 12
        : -6,
    width: side ? 14 : 12,
    height: 7,
    top: -2,
  };
}
