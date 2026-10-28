/** Editor-only proportion study. The production rig and artist contract stay unchanged. */
import type { AvatarConfig, Direction } from '@creative-factory/contracts';
import { constructorChoices } from './editor';
import { loadHairAtlas, loadParts } from './modular/assets';
import { tintHair, legacyHair, face, attachPart } from './modular/render';
import { pose, DIRECTIONS, type Pose, type Limb } from './modular/rig';
import { OUTLINE, mix } from './modular/materials';

export const EDITOR_SKIN_PALETTE = [
  '#f5e8dd',
  '#f0dfcf',
  '#f2d9cb',
  '#e8d5cf',
  '#e7cebf',
  '#e6c7ba',
  '#dec6b4',
  '#d6b6a0',
  '#cda58d',
  '#b98d70',
  '#a87c60',
  '#765445',
];
export function reviewPose(build: Pose['build'], direction: Direction, frame: number): Pose {
  const p = pose(build, direction, frame);
  const factor = { slim: 1, average: 1.16, sturdy: 1.32 }[build];
  const side = p.side,
    walking = frame >= 2,
    phase = Math.max(0, frame - 2) % 4;
  p.bob = frame === 1 ? 1 : 0;
  p.head = { x: 48, y: 34 + p.bob };
  p.torsoWidth = 2 * Math.round(((side ? 22 : 26) * factor) / 2);
  p.hipWidth = p.torsoWidth;
  p.torso = { x: 48, y: 72 + p.bob };
  p.pelvis = { x: 48, y: 86 + p.bob };
  const mirror = (x: number) => (direction === 'west' ? 96 - x : x);
  p.arms = [-1, 1].map((sign, i): Limb => {
    const swing = walking ? [5, 0, -5, 0][(phase + i * 2) % 4]! : 0;
    const x = 48 + (side ? sign * 2 : sign * (p.torsoWidth / 2 - 1));
    const root = { x: mirror(x), y: 64 + p.bob };
    const end = {
      x: mirror(x + (side ? -swing : sign * 4)),
      y: 84 + p.bob + (side ? 0 : swing / 3),
    };
    return {
      root,
      joint: { x: (root.x + end.x) / 2, y: (root.y + end.y) / 2 },
      end,
      width: 2 * Math.round((8 * factor) / 2),
    };
  });
  p.legs = [-1, 1].map((sign, i): Limb => {
    const phaseIndex = (phase + i * 2) % 4;
    const stride = walking && side ? [8, -2, -8, 5][phaseIndex]! : 0;
    const lift = walking ? [0, 0, 2, 7][phaseIndex]! : 0;
    const x = 48 + (side ? sign * 2 : sign * Math.round(7 * factor));
    // Idle hip/legs never move. The extended torso covers the breathing seam.
    const root = { x: mirror(x), y: 86 };
    const end = { x: mirror(x + stride), y: 108 - lift };
    const knee = { x: mirror(x + stride / 2 + (lift ? 2 : 0)), y: 97 - lift / 2 };
    return { root, joint: knee, end, width: 2 * Math.round((10 * factor) / 2) };
  });
  p.hands = p.arms.map((a) => a.end);
  p.feet = p.legs.map((l) => l.end);
  return p;
}
// Exact two-pixel inward contour; all geometry is sampled on the native grid.
function shape(
  ctx: CanvasRenderingContext2D,
  inside: (x: number, y: number) => boolean,
  color: string,
) {
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 96; x++)
      if (inside(x + 0.5, y + 0.5)) {
        const inner = [
          [-2, 0],
          [2, 0],
          [0, -2],
          [0, 2],
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].every(([dx, dy]) => inside(x + 0.5 + dx!, y + 0.5 + dy!));
        ctx.fillStyle = inner ? color : OUTLINE;
        ctx.fillRect(x, y, 1, 1);
      }
}
function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
) {
  shape(
    ctx,
    (px, py) => {
      if (px < x || px >= x + w || py < y || py >= y + h) return false;
      const cx = Math.max(x + r, Math.min(x + w - r, px)),
        cy = Math.max(y + r, Math.min(y + h - r, py));
      return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
    },
    color,
  );
}
function limb(ctx: CanvasRenderingContext2D, l: Limb, color: string, roundRoot = false) {
  const points = [l.root, l.joint, l.end],
    radius = l.width / 2;
  shape(
    ctx,
    (x, y) => {
      if (roundRoot && Math.hypot(x - l.root.x, y - l.root.y) <= radius) return true;
      for (let i = 0; i < 2; i++) {
        const a = points[i]!,
          b = points[i + 1]!,
          dx = b.x - a.x,
          dy = b.y - a.y,
          len = Math.hypot(dx, dy);
        const t = ((x - a.x) * dx + (y - a.y) * dy) / (len * len);
        if (t >= 0 && t <= 1 && Math.abs(((x - a.x) * dy - (y - a.y) * dx) / len) < radius)
          return true;
      }
      return Math.hypot(x - l.joint.x, y - l.joint.y) < radius;
    },
    color,
  );
}
function hairContour(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d')!,
    d = ctx.getImageData(0, 0, 96, 128),
    copy = new Uint8ClampedArray(d.data);
  const solid = (x: number, y: number) =>
    x >= 0 && x < 96 && y >= 0 && y < 128 && copy[(y * 96 + x) * 4 + 3]! > 0;
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 96; x++)
      if (
        solid(x, y) &&
        [
          [-2, 0],
          [2, 0],
          [0, -2],
          [0, 2],
        ].some(([dx, dy]) => !solid(x + dx!, y + dy!))
      )
        d.data.set([53, 43, 53, 255], (y * 96 + x) * 4);
  ctx.putImageData(d, 0, 0);
  return c;
}
function canvas() {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 128;
  return c;
}
export async function loadEditorReview(config: AvatarConfig, signal: AbortSignal) {
  const [atlas, parts] = await Promise.all([loadHairAtlas(signal), loadParts(config, signal)]);
  signal.throwIfAborted();
  const choices = constructorChoices(config),
    hair = tintHair(atlas, config.palette.hair);
  const sheet = document.createElement('canvas');
  sheet.width = 576;
  sheet.height = 512;
  const ctx = sheet.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (const [row, dir] of DIRECTIONS.entries()) {
    const neutral = reviewPose(choices.build, dir, 0);
    const hairLayers = (['back', 'front'] as const).map((pass) => {
      const c = canvas(),
        cx = c.getContext('2d')!;
      if (
        choices.gender === 'female' &&
        !parts.some((p) => p.descriptor.selection?.field === 'hair')
      )
        legacyHair(cx, neutral, hair, choices.hair.female, pass);
      return hairContour(c);
    });
    for (let frame = 0; frame < 6; frame++) {
      ctx.save();
      ctx.translate(frame * 96, row * 128);
      const p = reviewPose(choices.build, dir, frame),
        skin = config.palette.skin;
      const has = (f: string) => parts.some((p) => p.descriptor.selection?.field === f);
      const paint = (parent: string) =>
        parts
          .filter((x) => x.descriptor.parent === parent && x.descriptor.pass === 'front')
          .forEach((x) => attachPart(ctx, p, x));
      ctx.drawImage(hairLayers[0]!, 0, p.bob);
      parts.filter((x) => x.descriptor.pass === 'back').forEach((x) => attachPart(ctx, p, x));
      const drawArm = (i: number) => {
        const a = p.arms[i]!,
          end = a.end;
        limb(ctx, a, skin, true);
        if (!has('top'))
          limb(
            ctx,
            {
              ...a,
              end: {
                x: a.root.x + (end.x - a.root.x) * 0.65,
                y: a.root.y + (end.y - a.root.y) * 0.65,
              },
              joint: {
                x: a.root.x + (end.x - a.root.x) * 0.325,
                y: a.root.y + (end.y - a.root.y) * 0.325,
              },
            },
            config.palette.outfit,
            true,
          );
        paint(i === 0 ? 'armLeft' : 'armRight');
        // Palm and thumb form one silhouette, without an internal joint outline.
        const thumb = p.side ? (dir === 'east' ? 1 : -1) : i === 0 ? 1 : -1;
        shape(
          ctx,
          (x, y) => {
            const dx = (x - end.x) * thumb,
              dy = y - end.y;
            const palm =
              dx >= -4 &&
              dx <= 4 &&
              dy >= -2 &&
              dy <= 9 &&
              Math.hypot(Math.max(0, Math.abs(dx) - 2), Math.max(0, Math.abs(dy - 3.5) - 3.5)) <= 2;
            return palm || ((dx - 3) / 3) ** 2 + ((dy - 2) / 3) ** 2 <= 1;
          },
          skin,
        );
        paint(i === 0 ? 'handLeft' : 'handRight');
      };
      if (p.side) drawArm(0);
      for (let i = 0; i < 2; i++) {
        const far = p.side && i === 0;
        const legColor = far ? mix(choices.colors.bottom, '#352b35', 0.14) : choices.colors.bottom;
        limb(ctx, p.legs[i]!, legColor);
        paint(i === 0 ? 'legLeft' : 'legRight');
        const foot = p.feet[i]!;
        // Compact boots: 14 native pixels in profile, 12 from front/back.
        rounded(
          ctx,
          foot.x - (p.side ? (dir === 'west' ? 9 : 5) : 6),
          foot.y - 2,
          p.side ? 14 : 12,
          7,
          2,
          far ? mix(config.palette.shoes, '#352b35', 0.14) : config.palette.shoes,
        );
        paint(i === 0 ? 'footLeft' : 'footRight');
      }
      const left = 48 - p.torsoWidth / 2;
      rounded(ctx, left, 58 + p.bob, p.torsoWidth, 34, 5, skin);
      if (!has('top')) rounded(ctx, left, 58 + p.bob, p.torsoWidth, 34, 5, config.palette.outfit);
      // Neck merges with the torso, without a separate pelvis/waist stripe.
      ctx.fillStyle = skin;
      ctx.fillRect(44, 50 + p.bob, 8, 12);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(44, 50 + p.bob, 2, 8);
      ctx.fillRect(50, 50 + p.bob, 2, 8);
      paint('pelvis');
      paint('torso');
      if (!p.side) drawArm(0);
      drawArm(1);
      const hy = p.head.y;
      // Ears touch the head silhouette from outside; no overlay over the face.
      if (!p.side) {
        shape(ctx, (x, y) => ((x - 25) / 5) ** 2 + ((y - hy - 4) / 7) ** 2 <= 1, skin);
        shape(ctx, (x, y) => ((x - 71) / 5) ** 2 + ((y - hy - 4) / 7) ** 2 <= 1, skin);
      }
      rounded(ctx, 28, hy - 20, 40, 40, 10, skin);
      face(ctx, p, config, parts);
      ctx.drawImage(hairLayers[1]!, 0, p.bob);
      if (choices.gender === 'male' && !has('hair')) {
        rounded(ctx, 28, hy - 21, 40, 13, 5, config.palette.hair);
        if (dir === 'north') rounded(ctx, 28, hy - 21, 40, 37, 8, config.palette.hair);
        if (config.parts.hair === 'bob-01') {
          if (dir !== 'west') rounded(ctx, 26, hy - 12, 6, 32, 2, config.palette.hair);
          if (dir !== 'east') rounded(ctx, 64, hy - 12, 6, 32, 2, config.palette.hair);
        }
        if (config.parts.hair === 'curls-01')
          for (const x of [33, 43, 53, 63])
            shape(
              ctx,
              (px, py) => ((px - x) / 7) ** 2 + ((py - hy + 19) / 6) ** 2 <= 1,
              config.palette.hair,
            );
      }
      if (p.side) {
        const ex = dir === 'east' ? 25 : 71;
        shape(ctx, (x, y) => ((x - ex) / 5) ** 2 + ((y - hy - 4) / 7) ** 2 <= 1, skin);
      }
      paint('head');
      if (config.parts.accessory === 'headphones-01' && !has('special')) {
        if (dir !== 'east') rounded(ctx, 22, hy - 4, 7, 15, 3, choices.colors.special);
        if (dir !== 'west') rounded(ctx, 67, hy - 4, 7, 15, 3, choices.colors.special);
      }
      ctx.restore();
    }
  }
  return sheet;
}
