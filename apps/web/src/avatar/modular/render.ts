import type { AvatarConfig, AvatarCatalog } from '@creative-factory/contracts';
import { constructorChoices, appearanceKey } from '../editor';
import { DIRECTIONS, pose, type Point, type Limb, type Pose } from './rig';
import { shades, mix, colorMask } from './materials';
import type { ModularPart } from './parts';
import { hairPlacement } from './hair';
export interface PartImage {
  descriptor: ModularPart & { selection?: { field: string; slot?: number } };
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
  drawSkin = true,
) {
  const col = far ? skin[2]! : skin[3]!,
    line = skin[0]!;
  if (drawSkin) segment(ctx, l.root, l.end, l.width, col, line);
  if (cloth) {
    const end =
      kind === 'arm'
        ? { x: Math.round((l.joint.x + l.end.x) / 2), y: Math.round((l.joint.y + l.end.y) / 2) }
        : l.end;
    segment(ctx, l.root, end, l.width + 1, cloth[far ? 2 : 3]!, cloth[0]!);
  }
  if (kind === 'leg' && (drawSkin || shoes)) {
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
  drawSkin = true,
) {
  const y = p.bob,
    waist = p.side ? Math.round(p.shape.waist * 0.65) : p.shape.waist;
  if (drawSkin)
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
  if (drawSkin) box(ctx, 22, 26 + y, 4, 5, skin[2]!);
}
function profileEar(ctx: CanvasRenderingContext2D, p: Pose, skin: string[]) {
  if (!p.side) return;
  const x = p.direction === 'east' ? 21 : 24,
    y = p.head.y + 1;
  box(ctx, x, y, 3, 5, skin[0]!);
  box(ctx, x + (p.direction === 'east' ? 1 : 0), y + 1, 2, 3, skin[3]!);
}
function headSkin(ctx: CanvasRenderingContext2D, p: Pose, skin: string[]) {
  const y = p.head.y - 17;
  oval(ctx, 24, p.head.y, 10, 10, skin[3]!, skin[0]!);
  if (!p.side && p.direction !== 'north') {
    box(ctx, 13, 17 + y, 2, 5, skin[2]!);
    box(ctx, 33, 17 + y, 2, 5, skin[2]!);
  }
  box(ctx, 19, 9 + y, 8, 1, skin[4]!);
}
/** Canonical source surfaces, also used by the artist-template exporter. */
export function renderBaseModule(
  ctx: CanvasRenderingContext2D,
  p: Pose,
  parent: string,
  skin: string[],
) {
  if (parent === 'head') {
    headSkin(ctx, p, skin);
    profileEar(ctx, p, skin);
  } else if (parent === 'torso') bodyTorso(ctx, p, skin, null, null);
  else if (parent.startsWith('arm'))
    limb(ctx, p.arms[parent === 'armLeft' ? 0 : 1]!, skin, null, 'arm', null);
  else if (parent.startsWith('leg'))
    limb(ctx, p.legs[parent === 'legLeft' ? 0 : 1]!, skin, null, 'leg', null);
}
function face(
  ctx: CanvasRenderingContext2D,
  p: Pose,
  config: AvatarConfig,
  skin: string[],
  eyes = true,
  mouth = true,
  skipEffects: number[] = [],
  drawSkin = true,
) {
  const y = p.head.y - 17,
    c = constructorChoices(config),
    back = p.direction === 'north',
    side = p.side;
  if (drawSkin) headSkin(ctx, p, skin);
  if (!back) {
    const eyeHeight = c.eyes === 1 ? 4 : 3;
    if (eyes && side) box(ctx, p.direction === 'west' ? 17 : 29, 16 + y, 2, eyeHeight, skin[0]!);
    else if (eyes) {
      box(ctx, 19, 16 + y, 2, eyeHeight, skin[0]!);
      box(ctx, 27, 16 + y, 2, eyeHeight, skin[0]!);
    }
    if (mouth)
      box(
        ctx,
        side ? (p.direction === 'west' ? 15 : 31) : 23,
        23 + y,
        2,
        1,
        mix(config.palette.skin, '#a05a54', 0.5),
      );
    for (const id of c.faceFeatures.filter((id) => !skipEffects.includes(id))) {
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
  const pal = shades(color),
    y = p.head.y - 17;
  box(ctx, 15, 7 + y, 18, 5, pal[0]!);
  box(ctx, 16, 8 + y, 16, 4, pal[3]!);
  if (p.direction === 'north') box(ctx, 15, 12 + y, 18, 10, pal[3]!);
  if (style === 'bob-01') {
    if (p.direction !== 'west') box(ctx, 13, 11 + y, 3, 17, pal[0]!);
    if (p.direction !== 'east') box(ctx, 32, 11 + y, 3, 17, pal[0]!);
  }
  if (style === 'curls-01') {
    for (const x of [14, 19, 24, 29]) {
      box(ctx, x, 5 + y, 5, 5, pal[0]!);
      box(ctx, x + 1, 6 + y, 3, 3, pal[3]!);
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
  const { row, mirror, anchor, scaleY } = hairPlacement(slot, p.direction);
  const sx = (slot - 1) * 32,
    y = p.head.y - 17;
  ctx.save();
  if (mirror) {
    ctx.translate(48, 0);
    ctx.scale(-1, 1);
  }
  ctx.beginPath();
  if (p.side) {
    // A true profile: rear hair mass and crown, with the forward half of the face open.
    ctx.rect(0, 0, 48, 14 + y);
    ctx.rect(0, 14 + y, 25, 50);
  } else if (pass === 'back' || p.direction === 'north') ctx.rect(0, 0, 48, 64);
  else {
    ctx.rect(0, 0, 48, 15 + y);
    ctx.rect(0, 15 + y, 16, 49);
    ctx.rect(32, 15 + y, 16, 49);
  }
  ctx.clip();
  if (p.direction === 'north' && pass === 'front') {
    const pixel = hair.getContext('2d')!.getImageData(sx + 16, 16, 1, 1).data;
    const color = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
    oval(ctx, p.head.x, p.head.y, 10, 10, color, '#352b35');
  }
  // Ignore stray pixels on the left edge of the generated source cell.
  ctx.drawImage(
    hair,
    sx + 3,
    row * 32,
    29,
    32,
    p.head.x - anchor.x + 3,
    Math.round(p.head.y - anchor.y * scaleY),
    29,
    Math.round(32 * scaleY),
  );
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
    arm = d.parent.startsWith('arm'),
    l = arm ? p.arms[d.parent === 'armLeft' ? 0 : 1]! : p.legs[d.parent === 'legLeft' ? 0 : 1]!;
  const pixels = part.image
    .getContext('2d')!
    .getImageData(0, sourceFrame * d.frameHeight, d.frameWidth, d.frameHeight).data;
  const dx = l.end.x - l.root.x,
    dy = l.end.y - l.root.y,
    length = Math.max(1, Math.hypot(dx, dy)),
    ux = dy / length,
    uy = -dx / length,
    vx = dx / length,
    vy = dy / length,
    reference = d.referenceWidth?.[p.side ? 'side' : 'front'] ?? d.frameWidth - 2,
    scaleX = (l.width + (d.referenceWidth ? 0 : 2)) / reference,
    mirror = Boolean(d.mirrorX) !== (d.mirrorWest && p.direction === 'west'),
    radius = d.frameWidth * scaleX + d.frameHeight;
  // One rigid arm including the hand; legs are translated intact. Sampling in
  // destination pixel space avoids antialiased rotations and resampling seams.
  for (let y = Math.floor(l.root.y - radius); y <= l.root.y + radius; y++)
    for (let x = Math.floor(l.root.x - radius); x <= l.root.x + radius; x++) {
      const px = x - l.root.x - off.x,
        py = y - l.root.y - off.y;
      let sx = Math.floor(d.anchor.x + ((px * ux + py * uy) / scaleX) * (mirror ? -1 : 1));
      const sy = Math.floor(d.anchor.y + px * vx + py * vy);
      if (sx < 0 || sx >= d.frameWidth || sy < 0 || sy >= d.frameHeight) continue;
      const at = (sy * d.frameWidth + sx) * 4,
        alpha = pixels[at + 3]!;
      if (!alpha) continue;
      ctx.fillStyle = `rgba(${pixels[at]},${pixels[at + 1]},${pixels[at + 2]},${alpha / 255})`;
      ctx.fillRect(x, y, 1, 1);
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
      ? (d.frameWidth * p.torsoWidth) /
        (d.referenceWidth?.[p.side ? 'side' : 'front'] ?? d.frameWidth)
      : d.fit === 'pelvis'
        ? (d.frameWidth * p.hipWidth) /
          (d.referenceWidth?.[p.side ? 'side' : 'front'] ?? d.frameWidth)
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
  if (d.fit === 'torso' && d.referenceWidth) {
    const neutral = pose('average', p.direction, 0);
    const waist = (shape: Pose) =>
      shape.side ? Math.round(shape.shape.waist * 0.65) : shape.shape.waist;
    const localWidth = (shape: Pose, y: number) => {
      if (y < 29) return 4;
      if (y < 38) return shape.torsoWidth + ((waist(shape) - shape.torsoWidth) * (y - 29)) / 9;
      return waist(shape) + (shape.hipWidth - waist(shape)) * Math.min(1, (y - 38) / 6);
    };
    ctx.save();
    if (Boolean(d.mirrorX) !== (d.mirrorWest && p.direction === 'west')) {
      ctx.translate(parent.x * 2, 0);
      ctx.scale(-1, 1);
    }
    for (let y = 0; y < d.frameHeight; y++) {
      const canonicalY = 35 + y - d.anchor.y;
      const scale = localWidth(p, canonicalY) / localWidth(neutral, canonicalY);
      ctx.drawImage(
        part.image,
        0,
        frame * d.frameHeight + y,
        d.frameWidth,
        1,
        Math.round(parent.x - d.anchor.x * scale + off.x + (extra?.x ?? 0)),
        Math.round(parent.y - d.anchor.y + y + off.y + (extra?.y ?? 0)),
        Math.round(d.frameWidth * scale),
        1,
      );
    }
    ctx.restore();
    return;
  }
  ctx.save();
  if (Boolean(d.mirrorX) !== (d.mirrorWest && p.direction === 'west')) {
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
  const imported = (field: string, parent?: string) =>
    options.parts?.some(
      (x) => x.descriptor.selection?.field === field && (!parent || x.descriptor.parent === parent),
    ) ?? false;
  const h = c.hair[c.gender],
    hasHair = !options.bodyOnly && !imported('hair');
  const jointParts = (parent: string) =>
    options.parts
      ?.filter(
        (x) =>
          x.descriptor.parent === parent &&
          x.descriptor.fit === 'limb' &&
          x.descriptor.selection?.field !== 'base',
      )
      .forEach((part) => attachPart(ctx, p, part));
  const basePart = (parent: string) => {
    const parts =
      options.parts?.filter(
        (x) => x.descriptor.selection?.field === 'base' && x.descriptor.parent === parent,
      ) ?? [];
    parts.forEach((part) => attachPart(ctx, p, part));
    return parts.length > 0;
  };
  if (hasHair && options.hair && c.gender === 'female') hairPass(ctx, p, options.hair, h, 'back');
  options.parts
    ?.filter(
      (x) =>
        x.descriptor.pass === 'back' &&
        x.descriptor.fit !== 'limb' &&
        x.descriptor.selection?.field !== 'base',
    )
    .forEach((part) => attachPart(ctx, p, part));
  if (p.side) {
    const hasBase = basePart('armLeft');
    limb(
      ctx,
      p.arms[0]!,
      skin,
      imported('top', 'armLeft') ? null : top,
      'arm',
      null,
      true,
      !hasBase,
    );
    jointParts('armLeft');
  }
  const leftLegBase = basePart('legLeft');
  limb(
    ctx,
    p.legs[0]!,
    skin,
    options.bodyOnly || imported('bottom', 'legLeft') ? null : bottom,
    'leg',
    imported('footwear', 'footLeft') ? null : shoes,
    true,
    !leftLegBase,
  );
  jointParts('legLeft');
  const rightLegBase = basePart('legRight');
  limb(
    ctx,
    p.legs[1]!,
    skin,
    options.bodyOnly || imported('bottom', 'legRight') ? null : bottom,
    'leg',
    imported('footwear', 'footRight') ? null : shoes,
    false,
    !rightLegBase,
  );
  jointParts('legRight');
  const torsoBase = basePart('torso');
  bodyTorso(
    ctx,
    p,
    skin,
    imported('top', 'torso') ? null : top,
    imported('bottom', 'pelvis') ? null : bottom,
    !torsoBase,
  );
  if (!p.side) {
    const hasBase = basePart('armLeft');
    limb(
      ctx,
      p.arms[0]!,
      skin,
      imported('top', 'armLeft') ? null : top,
      'arm',
      null,
      false,
      !hasBase,
    );
    jointParts('armLeft');
  }
  const rightArmBase = basePart('armRight');
  limb(
    ctx,
    p.arms[1]!,
    skin,
    imported('top', 'armRight') ? null : top,
    'arm',
    null,
    false,
    !rightArmBase,
  );
  jointParts('armRight');
  const headBase = basePart('head');
  face(
    ctx,
    p,
    config,
    skin,
    !options.bodyOnly && !options.parts?.some((x) => x.descriptor.selection?.field === 'eyes'),
    !options.bodyOnly && !options.parts?.some((x) => x.descriptor.selection?.field === 'mouth'),
    options.parts
      ?.filter((x) => x.descriptor.selection?.field === 'faceFeatures')
      .map((x) => x.descriptor.selection?.slot ?? 0) ?? [],
    !headBase,
  );
  if (hasHair) {
    if (options.hair && c.gender === 'female') hairPass(ctx, p, options.hair, h, 'front');
    else fallbackHair(ctx, p, config.palette.hair, config.parts.hair);
  }
  if (!headBase) profileEar(ctx, p, skin);
  options.parts
    ?.filter(
      (x) =>
        x.descriptor.pass === 'front' &&
        x.descriptor.fit !== 'limb' &&
        x.descriptor.selection?.field !== 'base',
    )
    .forEach((part) => attachPart(ctx, p, part));
  if (!options.bodyOnly && config.parts.accessory === 'headphones-01') {
    const ap = shades(c.colors.special);
    if (p.direction !== 'east') box(ctx, 12, p.head.y - 2, 3, 7, ap[0]!);
    if (p.direction !== 'west') box(ctx, 33, p.head.y - 2, 3, 7, ap[0]!);
  }
}
export function assemble(config: AvatarConfig, options: AssemblyOptions = {}) {
  const sheet = document.createElement('canvas');
  sheet.width = 288;
  sheet.height = 256;
  const ctx = sheet.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен');
  ctx.imageSmoothingEnabled = false;
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
