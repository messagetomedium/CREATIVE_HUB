/** Editor-only proportion study. The production rig and artist contract stay unchanged. */
import type { AvatarConfig, Direction } from '@creative-factory/contracts';
import { constructorChoices } from './editor';
import { loadHairAtlas, loadParts } from './modular/assets';
import { tintHair, face, attachPart } from './modular/render';
import { DIRECTIONS, type Pose } from './modular/rig';
import { drawEditorHair } from './editorHair';
import {
  editorMotion,
  reviewPose,
  editorWalkPoseSeconds,
  EDITOR_ARM_LENGTH,
  EDITOR_LEG_LENGTH,
  editorShoeLayout,
  EDITOR_ARM_PLACEMENT,
  type ArmPlacement,
} from './editorMotion';
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
/** Flat top at the shoulder; preserve the existing rounded lower torso. */
function torsoShape(
  ctx: CanvasRenderingContext2D,
  width: number,
  color: string,
  shoulderWidth = width,
  side = false,
  connectors = false,
) {
  if (side) {
    rounded(ctx, 48 - width / 2, 58, width, 34, 5, color);
    return;
  }
  const left = 48 - width / 2,
    right = 48 + width / 2;
  shape(
    ctx,
    (x, y) => {
      if (
        connectors &&
        y >= 59 &&
        y < 65 &&
        Math.abs(x - 48) >= shoulderWidth / 2 - 2 &&
        Math.abs(x - 48) < width / 2 + 3
      )
        return true;
      const half =
        (shoulderWidth + (width - shoulderWidth) * Math.min(1, Math.max(0, (y - 58) / 26))) / 2;
      if (x < 48 - half || x >= 48 + half || y < 58 || y >= 92) return false;
      if (y <= 87) return true;
      const cx = Math.max(left + 5, Math.min(right - 5, x));
      return (x - cx) ** 2 + (y - 87) ** 2 <= 25;
    },
    color,
  );
}
/** The inner shoulder is square; the outer shoulder slopes into a straight arm. */
function armShape(
  ctx: CanvasRenderingContext2D,
  width: number,
  index: number,
  side: boolean,
  color: string,
  sleeve = false,
) {
  const left = 48 - width / 2,
    right = 48 + width / 2,
    r = width / 2,
    bottom = sleeve ? 77 : 64 + EDITOR_ARM_LENGTH;
  shape(
    ctx,
    (x, y) => {
      if (x < left || x >= right || y < 58 || y >= bottom) return false;
      if (!sleeve && y > bottom - r) return (x - 48) ** 2 + (y - (bottom - r)) ** 2 <= r * r;
      if (y >= 58 + r) return true;
      const outer = side || (index === 0 ? x < 48 : x > 48);
      return !outer || (x - 48) ** 2 + (y - (58 + r)) ** 2 <= r * r;
    },
    color,
  );
  if (!sleeve) {
    // Open the lower attachment instead of outlining an internal wrist seam.
    ctx.fillStyle = color;
    for (let y = bottom - r; y < bottom; y++)
      for (let x = left + 2; x < right - 2; x++)
        if ((x + 0.5 - 48) ** 2 + (y + 0.5 - (bottom - r)) ** 2 <= r * r) ctx.fillRect(x, y, 1, 1);
  }
}
/** Flat at the attachment, rounded only on the outside; same 7×10 mask in every view. */
function earShape(
  ctx: CanvasRenderingContext2D,
  left: number,
  outer: 'left' | 'right',
  color: string,
) {
  shape(
    ctx,
    (x, y) => {
      if (x < left || x >= left + 7 || y < 33 || y >= 43) return false;
      const roundedSide = outer === 'left' ? x < left + 3 : x > left + 4;
      if (!roundedSide || (y >= 36 && y <= 40)) return true;
      const cx = outer === 'left' ? left + 3 : left + 4,
        cy = y < 36 ? 36 : 40;
      return (x - cx) ** 2 + (y - cy) ** 2 <= 9;
    },
    color,
  );
  ctx.fillStyle = color;
  ctx.fillRect(outer === 'left' ? left + 5 : left, 33, 2, 10);
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
  options: { armPlacement?: ArmPlacement } = {},
): Promise<EditorRig> {
  const [atlas, parts] = await Promise.all([loadHairAtlas(signal), loadParts(config, signal)]);
  signal.throwIfAborted();
  const armPlacement = options.armPlacement ?? EDITOR_ARM_PLACEMENT;
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
      drawEditorHair(
        out.getContext('2d')!,
        reviewPose(c.build, dir, 0, c.gender, armPlacement),
        hair,
        c.hair.female,
        pass,
      );
    return hairContour(out);
  };
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
  for (const dir of DIRECTIONS) {
    const p = reviewPose(c.build, dir, 0, c.gender, armPlacement),
      side = p.side;
    const make = (
      pivot: { x: number; y: number },
      draw: (ctx: CanvasRenderingContext2D) => void,
    ) => {
      const out = canvas();
      draw(out.getContext('2d')!);
      return texture(out, pivot);
    };
    const hs = [hairCanvas(dir, 'back'), hairCanvas(dir, 'front')];
    const back = make(p.head, (ctx) => {
      ctx.drawImage(hs[0]!, 0, 0);
      paint(ctx, p, 'head', 'back');
    });
    const head = make(p.head, (ctx) => {
      if (!side) {
        earShape(ctx, 21, 'left', skin);
        earShape(ctx, 68, 'right', skin);
      }
      // The ear's inner edge is open; the head supplies the single shared contour.
      rounded(ctx, 28, 14, 40, 40, 10, skin);
      face(ctx, p, config, parts);
      ctx.drawImage(hs[1]!, 0, 0);
      if (c.gender === 'male' && !has('hair')) {
        rounded(ctx, 28, 13, 40, 13, 5, config.palette.hair);
        if (dir === 'north') rounded(ctx, 28, 13, 40, 37, 8, config.palette.hair);
        if (config.parts.hair === 'bob-01') {
          if (dir !== 'east') rounded(ctx, 26, 22, 6, 32, 2, config.palette.hair);
          if (dir !== 'west') rounded(ctx, 64, 22, 6, 32, 2, config.palette.hair);
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
      if (side) earShape(ctx, dir === 'west' ? 51 : 38, dir === 'west' ? 'right' : 'left', skin);
      paint(ctx, p, 'head');
      if (config.parts.accessory === 'headphones-01' && !has('special')) {
        if (!side) rounded(ctx, 22, 30, 7, 15, 3, c.colors.special);
        rounded(ctx, side ? (dir === 'west' ? 51 : 38) : 67, 30, 7, 15, 3, c.colors.special);
      }
    });
    const torso = make({ x: 48, y: 84 }, (ctx) => {
      torsoShape(ctx, p.hipWidth, skin, p.torsoWidth, side, armPlacement === 'separated');
      if (!has('top'))
        torsoShape(
          ctx,
          p.hipWidth,
          config.palette.outfit,
          p.torsoWidth,
          side,
          armPlacement === 'separated',
        );
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
          joint: { x: 48, y: 64 + EDITOR_ARM_LENGTH / 2 },
          end: { x: 48, y: 64 + EDITOR_ARM_LENGTH },
          width: p.arms[i]!.width,
        })),
        hands: [
          { x: 48, y: 64 + EDITOR_ARM_LENGTH },
          { x: 48, y: 64 + EDITOR_ARM_LENGTH },
        ],
      };
      const width = p.arms[i]!.width;
      arms.push(
        make({ x: 48, y: 64 }, (ctx) => {
          armShape(ctx, width, p.arms[i]!.root.x < 48 ? 0 : 1, side, skin);
          if (!has('top'))
            armShape(ctx, width, p.arms[i]!.root.x < 48 ? 0 : 1, side, config.palette.outfit, true);
          paint(ctx, armP, armParent, 'back');
          paint(ctx, armP, armParent);
        }),
      );
      hands.push(
        make({ x: 48, y: 64 + EDITOR_ARM_LENGTH }, (ctx) => {
          // One invariant round fist, without fingers or a thumb.
          shape(
            ctx,
            (x, y) => ((x - 48) / 5) ** 2 + ((y - (68 + EDITOR_ARM_LENGTH)) / 5) ** 2 <= 1,
            skin,
          );
          // Open the circle at the wrist too, keeping its outside outline intact.
          ctx.fillStyle = skin;
          for (let y = 63 + EDITOR_ARM_LENGTH; y < 68 + EDITOR_ARM_LENGTH; y++)
            for (let x = 48 - width / 2 + 2; x < 48 + width / 2 - 2; x++)
              if (((x + 0.5 - 48) / 5) ** 2 + ((y + 0.5 - (68 + EDITOR_ARM_LENGTH)) / 5) ** 2 <= 1)
                ctx.fillRect(x, y, 1, 1);
          paint(ctx, armP, handParent);
        }),
      );
      const x = p.legs[i]!.root.x,
        w = p.legs[i]!.width,
        far = side && i === (dir === 'west' ? 1 : 0);
      const color = far ? mix(c.colors.bottom, OUTLINE, 0.14) : c.colors.bottom;
      const leg = canvas(),
        lc = leg.getContext('2d')!;
      const legShape = (px: number, py: number) =>
        px >= x - w / 2 && px < x + w / 2 && py >= 82 && py < 84 + EDITOR_LEG_LENGTH;
      shape(lc, legShape, skin);
      if (!has('bottom')) shape(lc, legShape, color);
      paint(lc, p, i === 0 ? 'legLeft' : 'legRight', 'back');
      paint(lc, p, i === 0 ? 'legLeft' : 'legRight');
      legs.push(texture(leg, { x, y: 84 }));
      const footY = 84 + EDITOR_LEG_LENGTH,
        shoe = editorShoeLayout(c.build, dir, i);
      feet.push(
        make({ x, y: footY }, (ctx) => {
          rounded(
            ctx,
            x + shoe.left,
            footY + shoe.top,
            shoe.width,
            shoe.height,
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
    textureCount: 4 * 11,
    draw(ctx, direction, animation, seconds) {
      const assets = prepared.get(direction)!;
      const m = editorMotion(c.build, direction, animation, seconds, c.gender, armPlacement),
        side = direction === 'east' || direction === 'west';
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      const body = (draw: () => void) => {
        ctx.save();
        ctx.translate(m.body.x, m.body.y);
        draw();
        ctx.restore();
      };
      const arm = (i: number, handOnly = false) => {
        const a = m.arms[i]!,
          h = m.hands[i]!;
        ctx.save();
        ctx.translate(a.x, a.y);
        if (handOnly) drawTexture(ctx, assets.hands[i]!, h.x, h.y);
        else {
          drawTexture(ctx, assets.arms[i]!, 0, 0);
          if (direction !== 'north') drawTexture(ctx, assets.hands[i]!, h.x, h.y);
        }
        ctx.restore();
      };
      body(() => drawTexture(ctx, assets.back, m.head.x, m.head.y));
      const near = direction === 'west' ? 0 : 1,
        far = 1 - near;
      if (side && animation !== 'walk') body(() => arm(far));
      for (const i of side ? [far, near] : [0, 1]) {
        const l = m.legs[i]!;
        drawTexture(ctx, assets.legs[i]!, 48 + l.hip.x, l.hip.y);
        drawTexture(ctx, assets.feet[i]!, 48 + l.ankle.x, l.ankle.y);
      }
      body(() => {
        if (direction === 'north') {
          arm(0, true);
          arm(1, true);
        }
        drawTexture(ctx, assets.torso, 0, 0);
        if (!side) arm(0);
        arm(side ? near : 1);
        drawTexture(ctx, assets.head, m.head.x, m.head.y);
      });
      ctx.restore();
    },
  };
}
/** Bake once per appearance change. Both the player and inspector use this exact sheet. */
export async function loadEditorReview(
  config: AvatarConfig,
  signal: AbortSignal,
  options: { armPlacement?: ArmPlacement } = {},
) {
  const rig = await createEditorRig(config, signal, options),
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
        frame >= 2 ? editorWalkPoseSeconds(frame - 2) : frame === 1 ? 0.5 : 0,
      );
      ctx.restore();
    }
  return sheet;
}
