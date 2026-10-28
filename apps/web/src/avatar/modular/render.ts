import type { AvatarConfig, AvatarCatalog } from '@creative-factory/contracts';
import { constructorChoices, appearanceKey } from '../editor';
import { DIRECTIONS, FRAME, CACHE_LIMIT, pose, type Point, type Pose } from './rig';
import { shades, mix, colorMask } from './materials';
import type { ModularPart } from './parts';
import { hairPlacement } from './hair';
import { FACE_ANCHORS, parentPoint } from './rig';
import { box, polygon, oval, limbShape } from './raster';
export interface PartImage {
  descriptor: ModularPart & { selection?: { field: string; slot?: number } };
  image: HTMLCanvasElement;
}
export interface AssemblyOptions {
  hair?: HTMLCanvasElement;
  parts?: PartImage[];
  bodyOnly?: boolean;
}
export { parentPoint } from './rig';
export function renderNeck(ctx: CanvasRenderingContext2D, p: Pose, pal: string[]) {
  box(ctx, 44, 51 + p.bob, 8, 12, pal[3]!);
  box(ctx, 44, 51 + p.bob, 1, 8, pal[0]!);
  box(ctx, 51, 51 + p.bob, 1, 8, pal[0]!);
}
function torso(ctx: CanvasRenderingContext2D, p: Pose, pal: string[], clothes = false) {
  const w = p.torsoWidth + (clothes ? 2 : 0),
    waist = (p.side ? Math.round(p.shape.waist * 0.65) : p.shape.waist) + (clothes ? 2 : 0),
    hip = p.hipWidth;
  polygon(
    ctx,
    [
      [-w / 2 + 3, 58],
      [w / 2 - 3, 58],
      [w / 2, 61],
      [waist / 2, 76],
      [hip / 2, clothes ? 83 : 88],
      [-hip / 2, clothes ? 83 : 88],
      [-waist / 2, 76],
      [-w / 2, 61],
    ].map(([x, y]) => ({ x: 48 + x!, y: y! + p.bob })),
    pal[3]!,
    pal[0]!,
  );
  if (!clothes) {
    renderNeck(ctx, p, pal);
  } else if (p.direction !== 'north') box(ctx, 48, 63 + p.bob, 1, 14, pal[1]!);
}
function head(ctx: CanvasRenderingContext2D, p: Pose, pal: string[], ears = true) {
  oval(ctx, 48, p.head.y, 20, 20, pal[3]!, pal[0]!);
  box(ctx, 38, p.head.y - 16, 14, 1, pal[4]!);
  if (ears && !p.side && p.direction !== 'north') {
    box(ctx, 26, p.head.y, 4, 9, pal[2]!);
    box(ctx, 66, p.head.y, 4, 9, pal[2]!);
  }
  if (ears && p.side) ear(ctx, p, pal);
}
function ear(ctx: CanvasRenderingContext2D, p: Pose, pal: string[]) {
  if (!p.side) return;
  const x = p.direction === 'east' ? 42 : 48,
    y = p.head.y + 2;
  polygon(
    ctx,
    [
      { x, y },
      { x: x + 5, y: y + 1 },
      { x: x + 5, y: y + 8 },
      { x: x + 1, y: y + 9 },
      { x, y: y + 7 },
    ],
    pal[3]!,
    pal[0]!,
  );
  box(ctx, x + (p.direction === 'east' ? 2 : 1), y + 3, 2, 3, pal[2]!);
}
function hand(ctx: CanvasRenderingContext2D, p: Pose, index: number, pal: string[]) {
  const a = p.arms[index]!,
    root = a.end,
    dx = a.end.x - a.root.x,
    dy = a.end.y - a.root.y,
    len = Math.hypot(dx, dy),
    ux = dy / len,
    uy = -dx / len,
    vx = dx / len,
    vy = dy / len;
  const thumb = p.side ? (p.direction === 'east' ? 1 : -1) : index === 0 ? 1 : -1;
  const points = [
    [-3, -2],
    [3, -2],
    [3, 1],
    [5, 2],
    [5, 5],
    [3, 5],
    [3, 8],
    [-3, 8],
    [-4, 5],
  ].map(([rawX, y]) => {
    const x = rawX! * thumb;
    return { x: Math.round(root.x + x * ux + y! * vx), y: Math.round(root.y + x * uy + y! * vy) };
  });
  polygon(ctx, points, pal[3]!, pal[0]!);
}
function foot(ctx: CanvasRenderingContext2D, p: Pose, index: number, pal: string[], shoe = false) {
  const pt = p.feet[index]!,
    east = p.direction === 'east',
    west = p.direction === 'west';
  let points: Point[];
  if (p.side) {
    const min = shoe ? -7 : -5,
      max = shoe ? 15 : 10;
    points = [
      [min, -2],
      [max - 3, -2],
      [max, 1],
      [max, 4],
      [min, 4],
    ].map(([x, y]) => ({ x: pt.x + x! * (west ? -1 : 1), y: pt.y + y! }));
  } else
    points = [
      [-5, -2],
      [4, -2],
      [6, 1],
      [6, 4],
      [-6, 4],
      [-6, 0],
    ].map(([x, y]) => ({ x: pt.x + x!, y: pt.y + y! }));
  polygon(ctx, points, pal[3]!, pal[0]!);
  if (shoe)
    box(ctx, pt.x + (p.side ? (east ? -6 : -14) : -5), pt.y + 2, p.side ? 20 : 10, 1, pal[1]!);
}
export function renderBaseModule(
  ctx: CanvasRenderingContext2D,
  p: Pose,
  parent: string,
  pal: string[],
) {
  if (parent === 'head') head(ctx, p, pal);
  else if (parent === 'torso') torso(ctx, p, pal);
  else {
    const i = parent.endsWith('Left') ? 0 : 1;
    if (parent.startsWith('arm')) limbShape(ctx, p.arms[i]!, pal[3]!, pal[0]!);
    else if (parent.startsWith('leg')) limbShape(ctx, p.legs[i]!, pal[3]!, pal[0]!);
    else if (parent.startsWith('hand')) hand(ctx, p, i, pal);
    else if (parent.startsWith('foot')) foot(ctx, p, i, pal);
  }
}
function sampleLimb(
  ctx: CanvasRenderingContext2D,
  p: Pose,
  part: PartImage,
  frame: number,
  off: Point,
) {
  const d = part.descriptor,
    arm = d.parent.startsWith('arm'),
    l = arm
      ? p.arms[d.parent.endsWith('Left') ? 0 : 1]!
      : p.legs[d.parent.endsWith('Left') ? 0 : 1]!,
    points = [l.root, l.joint, l.end];
  const data = part.image
    .getContext('2d')!
    .getImageData(0, frame * d.frameHeight, d.frameWidth, d.frameHeight).data;
  const lengths = points
      .slice(0, 2)
      .map((a, i) => Math.hypot(points[i + 1]!.x - a.x, points[i + 1]!.y - a.y)),
    total = lengths[0]! + lengths[1]!,
    canonical = arm ? 20 : 24;
  const reference = d.referenceWidth?.[p.side ? 'side' : 'front'] ?? l.width,
    scale = l.width / reference,
    mirror =
      (Boolean(d.mirrorX) !== (d.mirrorWest && p.direction === 'west')) !==
      (d.pairMirror && !p.side);
  const radius = d.frameWidth * scale + d.frameHeight;
  for (let y = Math.floor(l.root.y - radius); y <= l.root.y + radius; y++)
    for (let x = Math.floor(l.root.x - radius); x <= l.root.x + radius; x++) {
      const px = x + 0.5 - off.x,
        py = y + 0.5 - off.y;
      let best = { distance: Infinity, normal: 0, travel: 0 };
      for (let i = 0; i < 2; i++) {
        const a = points[i]!,
          b = points[i + 1]!,
          dx = b.x - a.x,
          dy = b.y - a.y,
          len = lengths[i]!,
          raw = ((px - a.x) * dx + (py - a.y) * dy) / (len * len),
          t = Math.max(
            i === 0 ? -d.anchor.y / canonical : 0,
            Math.min(i === 1 ? 1 + (d.frameHeight - d.anchor.y - canonical) / canonical : 1, raw),
          ),
          distance = Math.hypot(px - a.x - t * dx, py - a.y - t * dy);
        if (distance < best.distance)
          best = {
            distance,
            normal: ((px - a.x) * dy - (py - a.y) * dx) / len,
            travel: (i === 0 ? 0 : lengths[0]!) + t * len,
          };
      }
      const progress = Math.max(0, Math.min(1, best.travel / total));
      const localScale =
        l.tipWidth === undefined
          ? scale
          : (l.width + (l.tipWidth - l.width) * progress) /
            (reference + (l.tipWidth - reference) * progress);
      const sx = Math.floor(d.anchor.x + ((mirror ? -1 : 1) * best.normal) / localScale),
        sy = Math.floor(d.anchor.y + (best.travel / total) * canonical);
      if (sx < 0 || sx >= d.frameWidth || sy < 0 || sy >= d.frameHeight) continue;
      const at = (sy * d.frameWidth + sx) * 4,
        a = data[at + 3]!;
      if (!a) continue;
      ctx.fillStyle = `rgba(${data[at]},${data[at + 1]},${data[at + 2]},${a / 255})`;
      ctx.fillRect(x, y, 1, 1);
    }
}
export function attachPart(ctx: CanvasRenderingContext2D, p: Pose, part: PartImage) {
  const d = part.descriptor;
  if (d.sync === 'static') p = pose(p.build, p.direction, 0);
  const row = DIRECTIONS.indexOf(p.direction),
    override = d.overrides.find((o) => o.direction === p.direction && o.phase === p.frame),
    frame = override?.sourceFrame ?? (d.mirrorWest && row === 3 ? 1 : row),
    parent = parentPoint(p, d.parent),
    off = override?.offset ?? d.offset;
  const extra =
    d.secondary?.mode === 'keyframes'
      ? d.secondary.offsets[p.frame % d.secondary.offsets.length]
      : undefined;
  const offset = { x: off.x + (extra?.x ?? 0), y: off.y + (extra?.y ?? 0) };
  if (d.fit === 'limb') {
    sampleLimb(ctx, p, part, frame, offset);
    return;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const mirror =
    (Boolean(d.mirrorX) !== (d.mirrorWest && p.direction === 'west')) !== (d.pairMirror && !p.side);
  if (mirror) {
    ctx.translate(parent.x * 2, 0);
    ctx.scale(-1, 1);
  }
  if (d.fit === 'torso' && d.referenceWidth) {
    const neutral = pose('average', p.direction, 0);
    const localWidth = (q: Pose, y: number) => {
      const waist = q.side ? Math.round(q.shape.waist * 0.65) : q.shape.waist;
      if (y < 58) return 8;
      if (y < 76) return q.torsoWidth + ((waist - q.torsoWidth) * (y - 58)) / 18;
      return waist + (q.hipWidth - waist) * Math.min(1, (y - 76) / 12);
    };
    for (let y = 0; y < d.frameHeight; y++) {
      const canonical = (d.parent === 'pelvis' ? 84 : 70) + y - d.anchor.y,
        scale = localWidth(p, canonical) / localWidth(neutral, canonical);
      ctx.drawImage(
        part.image,
        0,
        frame * d.frameHeight + y,
        d.frameWidth,
        1,
        Math.round(parent.x - d.anchor.x * scale + offset.x),
        Math.round(parent.y - d.anchor.y + y + offset.y),
        Math.round(d.frameWidth * scale),
        1,
      );
    }
  } else if (d.parent.startsWith('hand')) {
    // Hands/gloves inherit the wrist rotation, with fixed size across body builds.
    ctx.restore();
    const i = d.parent.endsWith('Left') ? 0 : 1,
      l = p.arms[i]!,
      dx = l.end.x - l.root.x,
      dy = l.end.y - l.root.y,
      len = Math.hypot(dx, dy),
      data = part.image
        .getContext('2d')!
        .getImageData(0, frame * d.frameHeight, d.frameWidth, d.frameHeight).data,
      r = d.frameWidth + d.frameHeight;
    for (let y = parent.y - r; y <= parent.y + r; y++)
      for (let x = parent.x - r; x <= parent.x + r; x++) {
        const px = x + 0.5 - parent.x - offset.x,
          py = y + 0.5 - parent.y - offset.y,
          sx = Math.floor(d.anchor.x + ((mirror ? -1 : 1) * (px * dy - py * dx)) / len),
          sy = Math.floor(d.anchor.y + (px * dx + py * dy) / len);
        if (sx < 0 || sx >= d.frameWidth || sy < 0 || sy >= d.frameHeight) continue;
        const at = (sy * d.frameWidth + sx) * 4,
          a = data[at + 3]!;
        if (a) {
          ctx.fillStyle = `rgba(${data[at]},${data[at + 1]},${data[at + 2]},${a / 255})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    return;
  } else {
    const scale =
      d.fit === 'pelvis'
        ? p.hipWidth / (d.referenceWidth?.[p.side ? 'side' : 'front'] ?? p.hipWidth)
        : 1;
    ctx.drawImage(
      part.image,
      0,
      frame * d.frameHeight,
      d.frameWidth,
      d.frameHeight,
      Math.round(parent.x - d.anchor.x * scale + offset.x),
      Math.round(parent.y - d.anchor.y + offset.y),
      Math.round(d.frameWidth * scale),
      d.frameHeight,
    );
  }
  ctx.restore();
}
export function legacyHair(
  ctx: CanvasRenderingContext2D,
  p: Pose,
  hair: HTMLCanvasElement,
  slot: number,
  pass: 'back' | 'front',
) {
  if (slot > 4) return;
  const { row, mirror, anchor, scaleY } = hairPlacement(slot, p.direction),
    sx = (slot - 1) * 64,
    y = p.head.y - 34;
  ctx.save();
  if (mirror) {
    ctx.translate(96, 0);
    ctx.scale(-1, 1);
  }
  ctx.beginPath();
  if (p.side) {
    ctx.rect(0, 0, 96, 28 + y);
    ctx.rect(0, 28 + y, 50, 100);
  } else if (pass === 'back' || p.direction === 'north') ctx.rect(0, 0, 96, 128);
  else {
    ctx.rect(0, 0, 96, 30 + y);
    ctx.rect(0, 30 + y, 32, 98);
    ctx.rect(64, 30 + y, 32, 98);
  }
  ctx.clip();
  if (p.direction === 'north' && pass === 'front') {
    const c = hair.getContext('2d')!.getImageData(sx + 32, 32, 1, 1).data;
    oval(ctx, 48, p.head.y, 20, 20, `rgb(${c[0]},${c[1]},${c[2]})`, '#352b35');
  }
  ctx.drawImage(
    hair,
    sx + 6,
    row * 64,
    58,
    64,
    p.head.x - anchor.x * 2 + 6,
    Math.round(p.head.y - anchor.y * 2 * scaleY),
    58,
    Math.round(64 * scaleY),
  );
  ctx.restore();
}
export function face(ctx: CanvasRenderingContext2D, p: Pose, c: AvatarConfig, parts: PartImage[]) {
  if (p.direction === 'north') return;
  const y = p.head.y - 34,
    choices = constructorChoices(c),
    has = (f: string) => parts.some((x) => x.descriptor.selection?.field === f);
  if (!has('eyes'))
    for (const pt of FACE_ANCHORS[p.direction].eyes)
      box(ctx, p.head.x + pt.x, p.head.y + pt.y, 4, choices.eyes === 1 ? 8 : 6, '#352b35');
  if (!has('mouth'))
    for (const pt of FACE_ANCHORS[p.direction].mouth)
      box(ctx, p.head.x + pt.x, p.head.y + pt.y, 3, 1, mix(c.palette.skin, '#a05a54', 0.5));
  for (const id of choices.faceFeatures.filter(
    (id) =>
      !parts.some(
        (x) =>
          x.descriptor.selection?.field === 'faceFeatures' && x.descriptor.selection.slot === id,
      ),
  )) {
    ctx.globalAlpha = id === 1 ? 0.55 : 0.25;
    const color = mix(c.palette.skin, id <= 2 ? '#503628' : id === 4 ? '#5e5d73' : '#b5625a', 0.5);
    for (const x of p.side ? [p.direction === 'east' ? 57 : 34] : [34, 56])
      box(ctx, x, 42 + y, id === 1 ? 1 : 5, id === 1 ? 1 : 3, color);
    ctx.globalAlpha = 1;
  }
}
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  config: AvatarConfig,
  p: Pose,
  options: AssemblyOptions = {},
) {
  const c = constructorChoices(config),
    parts = options.parts ?? [],
    skin = shades(config.palette.skin),
    top = shades(config.palette.outfit),
    bottom = shades(options.bodyOnly ? '#292732' : c.colors.bottom),
    shoes = shades(config.palette.shoes);
  const selected = (field: string) => parts.some((x) => x.descriptor.selection?.field === field);
  const list = (parent: string, pass: 'back' | 'front' = 'front') =>
    parts.filter((x) => x.descriptor.parent === parent && x.descriptor.pass === pass);
  const paint = (parent: string, filter: (x: PartImage) => boolean = () => true) =>
    list(parent)
      .filter(filter)
      .forEach((x) => attachPart(ctx, p, x));
  const feature = (x: PartImage) =>
    ['bodyFeatures', 'base'].includes(x.descriptor.selection?.field ?? '');
  const wear = (x: PartImage) => !feature(x);
  const base = (parent: string) => {
    if (!list(parent).some((x) => x.descriptor.hideBase)) renderBaseModule(ctx, p, parent, skin);
    paint(parent, feature);
  };
  const hasHair = !options.bodyOnly && !selected('hair'),
    slot = c.hair[c.gender];
  if (hasHair && options.hair && c.gender === 'female')
    legacyHair(ctx, p, options.hair, slot, 'back');
  parts.filter((x) => x.descriptor.pass === 'back').forEach((x) => attachPart(ctx, p, x));
  const arm = (i: number) => {
    const parent = i === 0 ? 'armLeft' : 'armRight',
      hp = i === 0 ? 'handLeft' : 'handRight';
    base(parent);
    if (!options.bodyOnly && !selected('top')) {
      const l = p.arms[i]!,
        end = {
          x: Math.round(l.root.x + (l.end.x - l.root.x) * 0.75),
          y: Math.round(l.root.y + (l.end.y - l.root.y) * 0.75),
        };
      limbShape(
        ctx,
        {
          ...l,
          end,
          joint: { x: Math.round((l.root.x + end.x) / 2), y: Math.round((l.root.y + end.y) / 2) },
          width: l.width + 1,
        },
        top[3]!,
        top[0]!,
      );
    }
    paint(parent, wear);
    base(hp);
    paint(hp, wear);
  };
  if (p.side) arm(0);
  for (let i = 0; i < 2; i++) {
    const parent = i === 0 ? 'legLeft' : 'legRight',
      fp = i === 0 ? 'footLeft' : 'footRight';
    base(parent);
    if (!options.bodyOnly && !selected('bottom'))
      limbShape(ctx, { ...p.legs[i]!, width: p.legs[i]!.width + 1 }, bottom[3]!, bottom[0]!);
    paint(parent, wear);
    base(fp);
    if (!options.bodyOnly && !selected('footwear')) foot(ctx, p, i, shoes, true);
    paint(fp, wear);
  }
  base('torso');
  if (!options.bodyOnly && !selected('top')) torso(ctx, p, top, true);
  if (options.bodyOnly || !selected('bottom'))
    polygon(
      ctx,
      [
        { x: 48 - p.hipWidth / 2, y: 80 + p.bob },
        { x: 48 + p.hipWidth / 2, y: 80 + p.bob },
        { x: 48 + p.hipWidth / 2, y: 88 + p.bob },
        { x: 48 - p.hipWidth / 2, y: 88 + p.bob },
      ],
      bottom[3]!,
      bottom[0]!,
    );
  paint('pelvis');
  paint('torso', wear);
  if (!p.side) arm(0);
  arm(1);
  base('head');
  if (!options.bodyOnly) face(ctx, p, config, parts);
  if (hasHair) {
    if (options.hair && c.gender === 'female') legacyHair(ctx, p, options.hair, slot, 'front');
    else {
      const h = shades(config.palette.hair);
      box(ctx, 30, p.head.y - 20, 36, 8, h[0]!);
      box(ctx, 31, p.head.y - 19, 34, 7, h[3]!);
      if (p.direction === 'north') box(ctx, 30, p.head.y - 10, 36, 20, h[3]!);
      if (config.parts.hair === 'bob-01') {
        if (p.direction !== 'west') box(ctx, 26, p.head.y - 12, 5, 32, h[0]!);
        if (p.direction !== 'east') box(ctx, 64, p.head.y - 12, 5, 32, h[0]!);
      }
      if (config.parts.hair === 'curls-01')
        for (const x of [30, 39, 48, 57]) oval(ctx, x, p.head.y - 18, 6, 5, h[3]!, h[0]!);
    }
  }
  if (p.side) ear(ctx, p, skin);
  paint('head', wear);
  if (!options.bodyOnly && config.parts.accessory === 'headphones-01' && !selected('special')) {
    const pal = shades(c.colors.special);
    if (p.direction !== 'east') box(ctx, 24, p.head.y - 4, 5, 14, pal[0]!);
    if (p.direction !== 'west') box(ctx, 66, p.head.y - 4, 5, 14, pal[0]!);
  }
}
export function assemble(config: AvatarConfig, options: AssemblyOptions = {}) {
  const sheet = document.createElement('canvas');
  sheet.width = FRAME.width * 6;
  sheet.height = FRAME.height * 4;
  const ctx = sheet.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен');
  ctx.imageSmoothingEnabled = false;
  for (const [row, dir] of DIRECTIONS.entries())
    for (let f = 0; f < 6; f++) {
      ctx.save();
      ctx.translate(f * FRAME.width, row * FRAME.height);
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
  rgbaBytes: cache.size * FRAME.width * 6 * FRAME.height * 4 * 4,
  limit: CACHE_LIMIT,
});
export function cachedAssembly(
  config: AvatarConfig,
  hair: HTMLCanvasElement | undefined | (() => HTMLCanvasElement),
  parts: PartImage[] = [],
) {
  const key = appearanceKey(config) + parts.map((p) => p.descriptor.source).join('|'),
    found = cache.get(key);
  if (found) {
    cache.delete(key);
    cache.set(key, found);
    hits++;
    return found;
  }
  const sheet = assemble(config, { hair: typeof hair === 'function' ? hair() : hair, parts });
  cache.set(key, sheet);
  builds++;
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return sheet;
}
export function tintHair(source: HTMLCanvasElement, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  canvas
    .getContext('2d')!
    .putImageData(
      colorMask(source.getContext('2d')!.getImageData(0, 0, source.width, source.height), color),
      0,
      0,
    );
  return canvas;
}
export function proceduralSheet(_catalog: AvatarCatalog, config: AvatarConfig) {
  return assemble(config);
}
