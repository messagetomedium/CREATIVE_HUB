import type { AvatarConfig, AvatarCatalog } from '@creative-factory/contracts';
import { constructorChoices, appearanceKey } from '../editor';
import { DIRECTIONS, pose, type Point, type Limb, type Pose } from './rig';
import { shades, mix, colorMask } from './materials';
import type { ModularPart } from './parts';
export interface PartImage {
  descriptor: ModularPart;
  image: HTMLCanvasElement;
}
export interface AssemblyOptions {
  hair?: HTMLCanvasElement;
  parts?: PartImage[];
  bodyOnly?: boolean;
}
// Native-pixel raster operations: no floating-point Canvas rotations or antialiased outlines.
function polygon(ctx: CanvasRenderingContext2D, points: Point[], color: string, outline: string) {
  const inside = (x: number, y: number) => {
    let yes = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i]!,
        b = points[j]!;
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) yes = !yes;
    }
    return yes;
  };
  const minX = Math.min(...points.map((p) => p.x)) - 1,
    maxX = Math.max(...points.map((p) => p.x)) + 1,
    minY = Math.min(...points.map((p) => p.y)) - 1,
    maxY = Math.max(...points.map((p) => p.y)) + 1;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++)
      if (inside(x + 0.5, y + 0.5)) {
        ctx.fillStyle =
          inside(x - 0.5, y + 0.5) &&
          inside(x + 1.5, y + 0.5) &&
          inside(x + 0.5, y - 0.5) &&
          inside(x + 0.5, y + 1.5)
            ? color
            : outline;
        ctx.fillRect(x, y, 1, 1);
      }
}
function segment(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  width: number,
  color: string,
  outline: string,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.max(1, Math.hypot(dx, dy)),
    nx = Math.round(((dy / length) * (width + 2)) / 2),
    ny = Math.round(((-dx / length) * (width + 2)) / 2);
  polygon(
    ctx,
    [
      { x: a.x + nx, y: a.y + ny },
      { x: b.x + nx, y: b.y + ny + 1 },
      { x: b.x - nx, y: b.y - ny + 1 },
      { x: a.x - nx, y: a.y - ny },
    ],
    color,
    outline,
  );
}
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function oval(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  outline: string,
) {
  const pts = [
    [-rx + 3, -ry],
    [rx - 3, -ry],
    [rx, -ry + 4],
    [rx, ry - 4],
    [rx - 4, ry],
    [-rx + 4, ry],
    [-rx, ry - 4],
    [-rx, -ry + 4],
  ].map(([dx, dy]) => ({ x: x + dx!, y: y + dy! }));
  polygon(ctx, pts, color, outline);
}
function limb(
  ctx: CanvasRenderingContext2D,
  l: Limb,
  skin: string[],
  cloth: string[] | null,
  kind: 'arm' | 'leg',
  shoes: string[] | null,
  far = false,
) {
  const col = far ? skin[2]! : skin[3]!,
    line = skin[0]!;
  segment(ctx, l.root, l.joint, l.width, col, line);
  segment(ctx, l.joint, l.end, l.width, col, line);
  box(
    ctx,
    l.joint.x - Math.floor(l.width / 2),
    l.joint.y - Math.floor(l.width / 2),
    l.width,
    l.width,
    col,
  );
  if (cloth) {
    segment(ctx, l.root, l.joint, l.width + 1, cloth[far ? 2 : 3]!, cloth[0]!);
    const end =
      kind === 'arm'
        ? { x: Math.round((l.joint.x + l.end.x) / 2), y: Math.round((l.joint.y + l.end.y) / 2) }
        : l.end;
    segment(ctx, l.joint, end, l.width + 1, cloth[far ? 2 : 3]!, cloth[0]!);
  }
  if (cloth)
    box(
      ctx,
      l.joint.x - Math.floor(l.width / 2),
      l.joint.y - Math.floor(l.width / 2),
      l.width,
      l.width,
      cloth[far ? 2 : 3]!,
    );
  if (kind === 'arm') {
    box(ctx, l.end.x - 2, l.end.y - 1, 4, 4, line);
    box(ctx, l.end.x - 1, l.end.y, 2, 2, col);
  } else {
    box(ctx, l.end.x - 3, l.end.y - 1, 6, 3, line);
    box(ctx, l.end.x - 2, l.end.y, 4, 1, shoes?.[3] ?? col);
  }
}
function bodyTorso(
  ctx: CanvasRenderingContext2D,
  p: Pose,
  skin: string[],
  top: string[] | null,
  bottom: string[] | null,
) {
  const y = p.bob,
    waist = p.side ? Math.round(p.shape.waist * 0.65) : p.shape.waist;
  polygon(
    ctx,
    [
      { x: 24 - p.torsoWidth / 2, y: 29 + y },
      { x: 24 + p.torsoWidth / 2, y: 29 + y },
      { x: 24 + waist / 2, y: 38 + y },
      { x: 24 + p.hipWidth / 2, y: 44 + y },
      { x: 24 - p.hipWidth / 2, y: 44 + y },
      { x: 24 - waist / 2, y: 38 + y },
    ].map((a) => ({ x: Math.round(a.x), y: a.y })),
    skin[3]!,
    skin[0]!,
  );
  if (bottom)
    polygon(
      ctx,
      [
        { x: 24 - p.hipWidth / 2, y: 40 + y },
        { x: 24 + p.hipWidth / 2, y: 40 + y },
        { x: 24 + p.hipWidth / 2, y: 44 + y },
        { x: 24 - p.hipWidth / 2, y: 44 + y },
      ],
      bottom[3]!,
      bottom[0]!,
    );
  if (top) {
    polygon(
      ctx,
      [
        { x: 24 - p.torsoWidth / 2 - 1, y: 29 + y },
        { x: 24 + p.torsoWidth / 2 + 1, y: 29 + y },
        { x: 24 + waist / 2 + 1, y: 41 + y },
        { x: 24 - waist / 2 - 1, y: 41 + y },
      ].map((a) => ({ x: Math.round(a.x), y: a.y })),
      top[3]!,
      top[0]!,
    );
    if (p.direction !== 'north') box(ctx, 24, 31 + y, 1, 8, top[1]!);
  }
  box(ctx, 22, 26 + y, 4, 5, skin[2]!);
}
function face(ctx: CanvasRenderingContext2D, p: Pose, config: AvatarConfig, skin: string[]) {
  const y = p.bob,
    c = constructorChoices(config),
    back = p.direction === 'north',
    side = p.side;
  oval(ctx, 24, 17 + y, 10, 10, skin[3]!, skin[0]!);
  if (side) {
    const x = p.direction === 'west' ? 14 : 33;
    box(ctx, x, 18 + y, 2, 3, skin[3]!);
  } else if (!back) {
    box(ctx, 13, 17 + y, 2, 5, skin[2]!);
    box(ctx, 33, 17 + y, 2, 5, skin[2]!);
  }
  box(ctx, 19, 9 + y, 8, 1, skin[4]!);
  if (!back) {
    const eyeHeight = c.eyes === 1 ? 4 : 3;
    if (side) box(ctx, p.direction === 'west' ? 17 : 29, 16 + y, 2, eyeHeight, skin[0]!);
    else {
      box(ctx, 19, 16 + y, 2, eyeHeight, skin[0]!);
      box(ctx, 27, 16 + y, 2, eyeHeight, skin[0]!);
    }
    box(
      ctx,
      side ? (p.direction === 'west' ? 16 : 31) : 23,
      23 + y,
      2,
      1,
      mix(config.palette.skin, '#a05a54', 0.5),
    );
    for (const id of c.faceFeatures) {
      const pigment = id === 1 || id === 2 ? '#503628' : id === 4 ? '#5e5d73' : '#b5625a';
      ctx.globalAlpha = id === 1 ? 0.55 : 0.25;
      ctx.fillStyle = mix(config.palette.skin, pigment, 0.5);
      if (id === 1) {
        for (const x of [17, 20, 27, 30]) ctx.fillRect(x, 21 + y, 1, 1);
      } else if (id === 2) ctx.fillRect(side ? 29 : 29, 22 + y, 1, 1);
      else {
        ctx.fillRect(side ? (p.direction === 'west' ? 16 : 28) : 16, 21 + y, 4, 2);
        if (!side) ctx.fillRect(28, 21 + y, 4, 2);
      }
      ctx.globalAlpha = 1;
    }
  }
}
function fallbackHair(ctx: CanvasRenderingContext2D, p: Pose, color: string, style: string) {
  const pal = shades(color);
  box(ctx, 15, 7 + p.bob, 18, 5, pal[0]!);
  box(ctx, 16, 8 + p.bob, 16, 4, pal[3]!);
  if (p.direction === 'north') box(ctx, 15, 12 + p.bob, 18, 10, pal[3]!);
  if (style === 'bob-01') {
    box(ctx, 13, 11 + p.bob, 3, 17, pal[0]!);
    box(ctx, 32, 11 + p.bob, 3, 17, pal[0]!);
  }
  if (style === 'curls-01') {
    for (const x of [14, 19, 24, 29]) {
      box(ctx, x, 5 + p.bob, 5, 5, pal[0]!);
      box(ctx, x + 1, 6 + p.bob, 3, 3, pal[3]!);
    }
  }
}
function hairPass(
  ctx: CanvasRenderingContext2D,
  p: Pose,
  hair: HTMLCanvasElement,
  slot: number,
  pass: 'back' | 'front',
) {
  if (slot > 4) return;
  if (slot > 4) return;
  const row = DIRECTIONS.indexOf(p.direction),
    sx = ((slot - 1) % 4) * 32,
    sy = row * 32;
  ctx.save();
  ctx.beginPath();
  if (pass === 'back') ctx.rect(0, 0, 48, 64);
  else {
    // Bangs above the forehead and strands outside the face; the head itself is never baked into hair.
    ctx.rect(0, 0, 48, 14 + p.bob);
    ctx.rect(0, 14 + p.bob, 16, 50);
    ctx.rect(32, 14 + p.bob, 16, 50);
    if (p.direction === 'north') ctx.rect(0, 0, 48, 64);
  }
  ctx.clip();
  ctx.drawImage(hair, sx, sy, 32, 32, 8, -2 + p.bob, 32, 32);
  ctx.restore();
}
function attachedLimb(
  ctx: CanvasRenderingContext2D,
  p: Pose,
  part: PartImage,
  sourceFrame: number,
  off: Point,
) {
  const d = part.descriptor,
    l =
      d.parent === 'armLeft'
        ? p.arms[0]!
        : d.parent === 'armRight'
          ? p.arms[1]!
          : d.parent === 'legLeft'
            ? p.legs[0]!
            : p.legs[1]!;
  const pixels = part.image
    .getContext('2d')!
    .getImageData(0, sourceFrame * d.frameHeight, d.frameWidth, d.frameHeight).data;
  const points = [l.root, l.joint, l.end],
    width = l.width + 2;
  const minX = Math.min(...points.map((a) => a.x)) - width,
    maxX = Math.max(...points.map((a) => a.x)) + width,
    minY = Math.min(...points.map((a) => a.y)) - 2,
    maxY = Math.max(...points.map((a) => a.y)) + 2;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      let best = { distance: Infinity, t: 0, normal: 0, segment: 0 };
      for (let i = 0; i < 2; i++) {
        const a = points[i]!,
          b = points[i + 1]!,
          dx = b.x - a.x,
          dy = b.y - a.y,
          len = Math.max(1, Math.hypot(dx, dy)),
          t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (len * len))),
          distance = Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
        if (distance < best.distance)
          best = { distance, t, normal: ((x - a.x) * dy - (y - a.y) * dx) / len, segment: i };
      }
      if (best.distance > width / 2) continue;
      let sx = Math.floor(d.frameWidth / 2 + (best.normal * d.frameWidth) / width),
        sy = Math.min(d.frameHeight - 1, Math.floor(((best.segment + best.t) / 2) * d.frameHeight));
      if (d.mirrorWest && p.direction === 'west') sx = d.frameWidth - 1 - sx;
      if (sx < 0 || sx >= d.frameWidth) continue;
      const at = (sy * d.frameWidth + sx) * 4,
        a = pixels[at + 3]!;
      if (!a) continue;
      ctx.fillStyle = `rgba(${pixels[at]},${pixels[at + 1]},${pixels[at + 2]},${a / 255})`;
      ctx.fillRect(x + off.x, y + off.y, 1, 1);
    }
}
export function attachPart(ctx: CanvasRenderingContext2D, p: Pose, part: PartImage) {
  const d = part.descriptor;
  if (d.sync === 'static') p = pose(p.build, p.direction, 0);
  const row = DIRECTIONS.indexOf(p.direction),
    override = d.overrides.find((o) => o.direction === p.direction && o.phase === p.frame);
  const parent: Point =
    d.parent === 'head'
      ? p.head
      : d.parent === 'torso'
        ? p.torso
        : d.parent === 'pelvis'
          ? p.pelvis
          : d.parent === 'armLeft'
            ? p.arms[0]!.root
            : d.parent === 'armRight'
              ? p.arms[1]!.root
              : d.parent === 'legLeft'
                ? p.legs[0]!.root
                : d.parent === 'legRight'
                  ? p.legs[1]!.root
                  : d.parent === 'handLeft'
                    ? p.arms[0]!.end
                    : d.parent === 'handRight'
                      ? p.arms[1]!.end
                      : d.parent === 'footLeft'
                        ? p.legs[0]!.end
                        : p.legs[1]!.end;
  const width =
    d.fit === 'torso'
      ? p.torsoWidth
      : d.fit === 'pelvis'
        ? p.hipWidth
        : d.fit === 'limb'
          ? p.shape.arm + 2
          : d.frameWidth;
  const extra =
    d.secondary?.mode === 'keyframes'
      ? d.secondary.offsets[
          Math.floor(
            ((p.frame % d.secondary.period) / d.secondary.period) * d.secondary.offsets.length,
          )
        ]
      : undefined;
  const off = override?.offset ?? d.offset,
    frame = override?.sourceFrame ?? (d.mirrorWest && row === 3 ? 1 : row);
  if (d.fit === 'limb' && ['armLeft', 'armRight', 'legLeft', 'legRight'].includes(d.parent)) {
    attachedLimb(ctx, p, part, frame, { x: off.x + (extra?.x ?? 0), y: off.y + (extra?.y ?? 0) });
    return;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  if (d.mirrorWest && p.direction === 'west') {
    ctx.translate(parent.x * 2, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    part.image,
    0,
    frame * d.frameHeight,
    d.frameWidth,
    d.frameHeight,
    Math.round(parent.x - (d.anchor.x * width) / d.frameWidth + off.x + (extra?.x ?? 0)),
    Math.round(parent.y - d.anchor.y + off.y + (extra?.y ?? 0)),
    width,
    d.frameHeight,
  );
  ctx.restore();
}
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  config: AvatarConfig,
  p: Pose,
  options: AssemblyOptions = {},
) {
  const c = constructorChoices(config),
    skin = shades(config.palette.skin),
    top = options.bodyOnly ? null : shades(config.palette.outfit),
    bottom = shades(options.bodyOnly ? '#292732' : c.colors.bottom),
    shoes = options.bodyOnly ? null : shades(config.palette.shoes);
  const h = c.hair[c.gender],
    hasHair = !options.bodyOnly;
  const jointParts = (parent: string) =>
    options.parts
      ?.filter((x) => x.descriptor.parent === parent && x.descriptor.fit === 'limb')
      .forEach((part) => attachPart(ctx, p, part));
  if (hasHair && options.hair && c.gender === 'female') hairPass(ctx, p, options.hair, h, 'back');
  options.parts
    ?.filter((x) => x.descriptor.pass === 'back' && x.descriptor.fit !== 'limb')
    .forEach((part) => attachPart(ctx, p, part));
  if (p.side) {
    limb(ctx, p.arms[0]!, skin, top, 'arm', null, true);
    jointParts('armLeft');
  }
  limb(ctx, p.legs[0]!, skin, options.bodyOnly ? null : bottom, 'leg', shoes, true);
  jointParts('legLeft');
  limb(ctx, p.legs[1]!, skin, options.bodyOnly ? null : bottom, 'leg', shoes);
  jointParts('legRight');
  bodyTorso(ctx, p, skin, top, bottom);
  if (!p.side) {
    limb(ctx, p.arms[0]!, skin, top, 'arm', null);
    jointParts('armLeft');
  }
  limb(ctx, p.arms[1]!, skin, top, 'arm', null);
  jointParts('armRight');
  face(ctx, p, config, skin);
  if (hasHair) {
    if (options.hair && c.gender === 'female') hairPass(ctx, p, options.hair, h, 'front');
    else fallbackHair(ctx, p, config.palette.hair, config.parts.hair);
  }
  options.parts
    ?.filter((x) => x.descriptor.pass === 'front' && x.descriptor.fit !== 'limb')
    .forEach((part) => attachPart(ctx, p, part));
  if (!options.bodyOnly && config.parts.accessory === 'headphones-01') {
    const ap = shades(c.colors.special);
    box(ctx, 12, 15 + p.bob, 3, 7, ap[0]!);
    box(ctx, 33, 15 + p.bob, 3, 7, ap[0]!);
  }
}
export function assemble(config: AvatarConfig, options: AssemblyOptions = {}) {
  const sheet = document.createElement('canvas');
  sheet.width = 288;
  sheet.height = 256;
  const ctx = sheet.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен');
  for (const [row, dir] of DIRECTIONS.entries())
    for (let f = 0; f < 6; f++) {
      ctx.save();
      ctx.translate(f * 48, row * 64);
      renderFrame(ctx, config, pose(constructorChoices(config).build, dir, f), options);
      ctx.restore();
    }
  return sheet;
}
const cache = new Map<string, HTMLCanvasElement>();
let builds = 0,
  hits = 0;
export const assemblyStats = () => ({
  builds,
  hits,
  entries: cache.size,
  rgbaBytes: cache.size * 288 * 256 * 4,
});
export function cachedAssembly(
  config: AvatarConfig,
  hair: HTMLCanvasElement | undefined | (() => HTMLCanvasElement),
  parts: PartImage[] = [],
) {
  const key = appearanceKey(config);
  const found = cache.get(key);
  if (found) {
    cache.delete(key);
    cache.set(key, found);
    hits++;
    return found;
  }
  const sheet = assemble(config, { hair: typeof hair === 'function' ? hair() : hair, parts });
  cache.set(key, sheet);
  builds++;
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  return sheet;
}
export function tintHair(source: HTMLCanvasElement, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(
    colorMask(source.getContext('2d')!.getImageData(0, 0, source.width, source.height), color),
    0,
    0,
  );
  return canvas;
}
// Legacy tool compatibility: still produces one A24, never changes Phaser rendering.
export function proceduralSheet(_catalog: AvatarCatalog, config: AvatarConfig) {
  return assemble(config);
}
