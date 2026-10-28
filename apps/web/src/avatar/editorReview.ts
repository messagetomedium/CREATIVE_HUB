/** Editor-only proportion study. The production rig and artist contract stay unchanged. */
import type { AvatarConfig, Direction } from '@creative-factory/contracts';
import { constructorChoices } from './editor';
import { loadHairAtlas, loadParts } from './modular/assets';
import { tintHair, legacyHair, face, attachPart } from './modular/render';
import { DIRECTIONS, type Pose } from './modular/rig';
import { editorMotion, reviewPose, WALK_SECONDS } from './editorMotion';
export { reviewPose } from './editorMotion';
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
interface Texture {
  image: HTMLCanvasElement;
  x: number;
  y: number;
}
export interface EditorRig {
  draw(
    ctx: CanvasRenderingContext2D,
    direction: Direction,
    animation: 'static' | 'idle' | 'walk',
    seconds: number,
  ): void;
  readonly textureCount: number;
}
function texture(source: HTMLCanvasElement, pivot: { x: number; y: number }): Texture {
  const ctx = source.getContext('2d')!,
    data = ctx.getImageData(0, 0, 96, 128).data;
  let x0 = 96,
    y0 = 128,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 96; x++)
      if (data[(y * 96 + x) * 4 + 3]) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  const c = document.createElement('canvas');
  c.width = Math.max(1, x1 - x0 + 1);
  c.height = Math.max(1, y1 - y0 + 1);
  if (x1 >= 0)
    c.getContext('2d')!.drawImage(source, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return { image: c, x: pivot.x - x0, y: pivot.y - y0 };
}
function drawTexture(ctx: CanvasRenderingContext2D, t: Texture, x: number, y: number) {
  ctx.drawImage(t.image, Math.round(x) - t.x, Math.round(y) - t.y);
}
/** Prepare immutable local textures once. The authoring rig only translates these images into integer-pixel poses. */
export async function createEditorRig(
  config: AvatarConfig,
  signal: AbortSignal,
): Promise<EditorRig> {
  const [atlas, parts] = await Promise.all([loadHairAtlas(signal), loadParts(config, signal)]);
  signal.throwIfAborted();
  const c = constructorChoices(config),
    hair = tintHair(atlas, config.palette.hair),
    skin = config.palette.skin;
  const has = (f: string) => parts.some((p) => p.descriptor.selection?.field === f);
  const paint = (ctx: CanvasRenderingContext2D, p: Pose, parent: string, pass = 'front') =>
    parts
      .filter((x) => x.descriptor.parent === parent && x.descriptor.pass === pass)
      .forEach((x) => attachPart(ctx, p, x));
  const hairCanvas = (dir: Direction, pass: 'back' | 'front') => {
    const out = canvas();
    if (c.gender === 'female' && !has('hair'))
      legacyHair(out.getContext('2d')!, reviewPose(c.build, dir, 0), hair, c.hair.female, pass);
    return hairContour(out);
  };
  const hairTop = (images: HTMLCanvasElement[]) =>
    Math.min(
      14,
      ...images.map((img) => {
        const d = img.getContext('2d')!.getImageData(0, 0, 96, 128).data;
        for (let y = 0; y < 128; y++)
          for (let x = 0; x < 96; x++) if (d[(y * 96 + x) * 4 + 3]) return y;
        return 14;
      }),
    );
  const frontTop = hairTop([hairCanvas('south', 'back'), hairCanvas('south', 'front')]);
  const prepared = new Map<
    Direction,
    {
      torso: Texture;
      head: Texture;
      back: Texture;
      arms: Texture[];
      hands: Texture[];
      legs: Texture[];
      feet: Texture[];
    }
  >();
  for (const dir of ['north', 'east', 'south'] as const) {
    const p = reviewPose(c.build, dir, 0),
      side = p.side;
    const make = (
      pivot: { x: number; y: number },
      draw: (ctx: CanvasRenderingContext2D) => void,
    ) => {
      const out = canvas();
      draw(out.getContext('2d')!);
      return texture(out, pivot);
    };
    const hs = [hairCanvas(dir, 'back'), hairCanvas(dir, 'front')],
      hairY = dir === 'north' ? frontTop - hairTop(hs) : 0;
    const back = make(p.head, (ctx) => {
      ctx.drawImage(hs[0]!, 0, hairY);
      paint(ctx, p, 'head', 'back');
    });
    const head = make(p.head, (ctx) => {
      if (!side)
        for (const x of [24.5, 71.5])
          shape(ctx, (px, py) => ((px - x) / 3.5) ** 2 + ((py - 38) / 5) ** 2 <= 1, skin);
      rounded(ctx, 28, 14, 40, 40, 10, skin);
      face(ctx, p, config, parts);
      ctx.drawImage(hs[1]!, 0, hairY);
      if (c.gender === 'male' && !has('hair')) {
        rounded(ctx, 28, 13, 40, 13, 5, config.palette.hair);
        if (dir === 'north') rounded(ctx, 28, 13, 40, 37, 8, config.palette.hair);
        if (config.parts.hair === 'bob-01') {
          if (dir !== 'east') rounded(ctx, 26, 22, 6, 32, 2, config.palette.hair);
          rounded(ctx, 64, 22, 6, 32, 2, config.palette.hair);
        }
        if (config.parts.hair === 'curls-01')
          for (const x of [33, 43, 53, 63])
            shape(
              ctx,
              (px, py) => ((px - x) / 7) ** 2 + ((py - 15) / 6) ** 2 <= 1,
              config.palette.hair,
            );
      }
      // One small near ear, on the side plane; never a second ear on the rear silhouette.
      if (side) shape(ctx, (x, y) => ((x - 41.5) / 3.5) ** 2 + ((y - 38) / 5) ** 2 <= 1, skin);
      paint(ctx, p, 'head');
      if (config.parts.accessory === 'headphones-01' && !has('special')) {
        if (!side) rounded(ctx, 22, 30, 7, 15, 3, c.colors.special);
        rounded(ctx, side ? 38 : 67, 30, 7, 15, 3, c.colors.special);
      }
    });
    const torso = make({ x: 48, y: 84 }, (ctx) => {
      rounded(ctx, 48 - p.torsoWidth / 2, 58, p.torsoWidth, 34, 5, skin);
      if (!has('top'))
        rounded(ctx, 48 - p.torsoWidth / 2, 58, p.torsoWidth, 34, 5, config.palette.outfit);
      ctx.fillStyle = skin;
      ctx.fillRect(44, 50, 8, 12);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(44, 50, 2, 8);
      ctx.fillRect(50, 50, 2, 8);
      paint(ctx, p, 'pelvis');
      paint(ctx, p, 'torso', 'back');
      paint(ctx, p, 'torso');
    });
    const arms: Texture[] = [],
      hands: Texture[] = [],
      legs: Texture[] = [],
      feet: Texture[] = [];
    for (let i = 0; i < 2; i++) {
      const armParent = i === 0 ? 'armLeft' : 'armRight',
        handParent = i === 0 ? 'handLeft' : 'handRight';
      const armP = {
        ...p,
        arms: p.arms.map(() => ({
          root: { x: 48, y: 64 },
          joint: { x: 48, y: 74 },
          end: { x: 48, y: 84 },
          width: p.arms[i]!.width,
        })),
        hands: [
          { x: 48, y: 84 },
          { x: 48, y: 84 },
        ],
      };
      const width = p.arms[i]!.width,
        left = 48 - width / 2;
      arms.push(
        make({ x: 48, y: 64 }, (ctx) => {
          // Parallel sides, a circular shoulder cap, and a straight 20px bone.
          shape(
            ctx,
            (x, y) =>
              (x >= left && x < left + width && y >= 64 && y <= 84) ||
              Math.hypot(x - 48, y - 64) < width / 2,
            skin,
          );
          if (!has('top'))
            shape(
              ctx,
              (x, y) =>
                (x >= left && x < left + width && y >= 64 && y <= 77) ||
                Math.hypot(x - 48, y - 64) < width / 2,
              config.palette.outfit,
            );
          paint(ctx, armP, armParent, 'back');
          paint(ctx, armP, armParent);
        }),
      );
      hands.push(
        make({ x: 48, y: 84 }, (ctx) => {
          // One invariant round fist, without fingers or a thumb.
          shape(ctx, (x, y) => ((x - 48) / 5) ** 2 + ((y - 88) / 5) ** 2 <= 1, skin);
          paint(ctx, armP, handParent);
        }),
      );
      const x = p.legs[i]!.root.x,
        w = p.legs[i]!.width,
        far = side && i === 0;
      const color = far ? mix(c.colors.bottom, OUTLINE, 0.14) : c.colors.bottom;
      const leg = canvas(),
        lc = leg.getContext('2d')!;
      rounded(lc, x - w / 2, 82, w, 28, Math.min(4, w / 2), skin);
      if (!has('bottom')) rounded(lc, x - w / 2, 82, w, 28, Math.min(4, w / 2), color);
      paint(lc, p, i === 0 ? 'legLeft' : 'legRight', 'back');
      paint(lc, p, i === 0 ? 'legLeft' : 'legRight');
      legs.push(texture(leg, { x, y: 84 }));
      feet.push(
        make({ x, y: 108 }, (ctx) => {
          rounded(
            ctx,
            x - (side ? 5 : 6),
            106,
            side ? 14 : 12,
            7,
            2,
            far ? mix(config.palette.shoes, OUTLINE, 0.14) : config.palette.shoes,
          );
          paint(ctx, p, i === 0 ? 'footLeft' : 'footRight');
        }),
      );
    }
    prepared.set(dir, { torso, head, back, arms, hands, legs, feet });
  }
  return {
    textureCount: 3 * 11,
    draw(ctx, direction, animation, seconds) {
      const assets = prepared.get(direction === 'west' ? 'east' : direction)!;
      const m = editorMotion(c.build, direction, animation, seconds),
        side = direction === 'east' || direction === 'west';
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (direction === 'west') {
        ctx.translate(96, 0);
        ctx.scale(-1, 1);
      }
      const body = (draw: () => void) => {
        ctx.save();
        ctx.translate(m.body.x, m.body.y);
        draw();
        ctx.restore();
      };
      const arm = (i: number) => {
        const a = m.arms[i]!,
          h = m.hands[i]!;
        ctx.save();
        ctx.translate(a.x, a.y);
        drawTexture(ctx, assets.arms[i]!, 0, 0);
        drawTexture(ctx, assets.hands[i]!, h.x, h.y);
        ctx.restore();
      };
      body(() => drawTexture(ctx, assets.back, 0, -50));
      if (side) body(() => arm(0));
      for (let i = 0; i < 2; i++) {
        const l = m.legs[i]!;
        drawTexture(ctx, assets.legs[i]!, 48 + l.hip.x, l.hip.y);
        drawTexture(ctx, assets.feet[i]!, 48 + l.ankle.x, l.ankle.y);
      }
      body(() => {
        drawTexture(ctx, assets.torso, 0, 0);
        if (!side) arm(0);
        arm(1);
        drawTexture(ctx, assets.head, 0, -50);
      });
      ctx.restore();
    },
  };
}
/** Bake once per appearance change. Both the player and inspector use this exact sheet. */
export async function loadEditorReview(config: AvatarConfig, signal: AbortSignal) {
  const rig = await createEditorRig(config, signal),
    sheet = document.createElement('canvas');
  sheet.width = 576;
  sheet.height = 512;
  const ctx = sheet.getContext('2d')!;
  for (const [row, direction] of DIRECTIONS.entries())
    for (let frame = 0; frame < 6; frame++) {
      ctx.save();
      ctx.translate(frame * 96, row * 128);
      rig.draw(
        ctx,
        direction,
        frame >= 2 ? 'walk' : frame === 1 ? 'idle' : 'static',
        frame >= 2 ? ((frame - 2) * WALK_SECONDS) / 4 : frame === 1 ? 0.5 : 0,
      );
      ctx.restore();
    }
  return sheet;
}
