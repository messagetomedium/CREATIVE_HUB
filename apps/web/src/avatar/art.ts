import type { AvatarCatalog, AvatarConfig, Direction } from '@creative-factory/contracts';
import { loadBodyTest } from './bodyTest';
import { contentPath } from '../game/contentPath';

export const DIRECTIONS: Direction[] = ['north', 'east', 'south', 'west'];
function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  radius = 2,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}
function oval(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
/** Original 3/4 blockout. Origin = feet, not the centre of the head.
 * All directions stay upright; west mirrors the side view only. No rotation of the body.
 * All parts share phase/anchor; appearance never changes the 20×16 movement collider.
 */
export function drawAvatarFrame(
  ctx: CanvasRenderingContext2D,
  config: AvatarConfig,
  direction: Direction,
  frame: number,
): void {
  const { parts, palette: p } = config;
  const side = direction === 'east' || direction === 'west';
  const back = direction === 'north';
  const broad = config.customization?.build === 'slim' ? -2 : parts.body === 'base-02' ? 2 : 0;
  const trousers = config.customization?.colors.bottom ?? '#46584c';
  const step = frame < 2 ? 0 : ([0, 2, 0, -2][frame - 2] ?? 0);
  const bob = frame === 1 || frame === 3 || frame === 5 ? -1 : 0;
  ctx.save();
  if (config.customization?.age === 'child') ctx.scale(0.9, 0.86);
  if (direction === 'west') ctx.scale(-1, 1);
  // Legs and shoes are separate colours; feet stay near the same baseline.
  box(ctx, side ? -5 : -8, -14 + step, side ? 8 : 6, 12, trousers);
  box(ctx, side ? 0 : 2, -14 - step, side ? 7 : 6, 12, trousers);
  box(ctx, side ? -5 : -9, -4 + Math.min(step, 0), 9, 4, p.shoes, 1);
  box(ctx, side ? 1 : 1, -4 + Math.min(-step, 0), 9, 4, p.shoes, 1);
  const torsoWidth = side ? 16 + broad : 22 + broad * 2;
  // Skin under the clothing; broader body does not enlarge the collider.
  box(ctx, -torsoWidth / 2, -31 + bob, torsoWidth, 19, p.skin, 4);
  box(ctx, -torsoWidth / 2 - 3, -29 + bob - step / 2, 5, 17, p.outfit);
  box(ctx, torsoWidth / 2 - 2, -29 + bob + step / 2, 5, 17, p.outfit);
  box(ctx, -torsoWidth / 2 - 3, -15 + bob - step / 2, 5, 5, p.skin);
  box(ctx, torsoWidth / 2 - 2, -15 + bob + step / 2, 5, 5, p.skin);
  box(ctx, -torsoWidth / 2, -31 + bob, torsoWidth, 18, p.outfit, 3);
  if (parts.outfit === 'dress-01') {
    ctx.fillStyle = p.outfit;
    ctx.beginPath();
    ctx.moveTo(-torsoWidth / 2, -25 + bob);
    ctx.lineTo(torsoWidth / 2, -25 + bob);
    ctx.lineTo(torsoWidth / 2 + 3, -9 + bob);
    ctx.lineTo(-torsoWidth / 2 - 3, -9 + bob);
    ctx.fill();
    box(ctx, -torsoWidth / 2 - 2, -11 + bob, torsoWidth + 4, 2, '#e9e3d2', 0);
  } else if (parts.outfit === 'jacket-01') {
    if (!back) box(ctx, side ? 4 : -1, -29 + bob, 2, 15, '#e9e3d2', 0);
    box(ctx, -torsoWidth / 2 + 2, -20 + bob, 5, 3, '#344c3d', 1);
  } else {
    box(ctx, -torsoWidth / 2 + 3, -28 + bob, 2, 12, '#e9e3d2', 0);
    if (!side) box(ctx, torsoWidth / 2 - 5, -28 + bob, 2, 12, '#e9e3d2', 0);
  }
  // Head, face, nape. Hair silhouettes remain simple and visibly different.
  box(ctx, -3, -34 + bob, 6, 5, p.skin);
  oval(ctx, side ? 1 : 0, -39 + bob, side ? 9 : 10, 10, p.skin);
  if (back) {
    oval(
      ctx,
      0,
      -40 + bob,
      parts.hair === 'curls-01' ? 12 : 11,
      parts.hair === 'bob-01' ? 12 : 10,
      p.hair,
    );
    if (parts.hair === 'bob-01') box(ctx, -11, -41 + bob, 22, 14, p.hair, 4);
  } else {
    if (parts.hair === 'bob-01') {
      box(ctx, -11, -47 + bob, 5, 19, p.hair, 2);
      if (!side) box(ctx, 6, -47 + bob, 5, 19, p.hair, 2);
      box(ctx, -9, -49 + bob, 18, 7, p.hair, 3);
    } else if (parts.hair === 'curls-01') {
      for (const x of [-9, -3, 3, 9])
        oval(ctx, x, -47 + bob + (Math.abs(x) > 5 ? 2 : 0), 4, 4, p.hair);
    } else box(ctx, -9, -48 + bob, 18, 7, p.hair, 3);
    if (side) {
      box(ctx, 5, -40 + bob, 2, 2, '#273c32', 0);
      box(ctx, 8, -38 + bob, 3, 3, p.skin, 1);
    } else {
      box(ctx, -5, -39 + bob, 2, 2, '#273c32', 0);
      box(ctx, 3, -39 + bob, 2, 2, '#273c32', 0);
      box(ctx, -2, -33 + bob, 4, 1, '#795846', 0);
    }
  }
  if (back && parts.hair === 'curls-01')
    for (const x of [-9, -3, 3, 9]) oval(ctx, x, -47 + bob, 4, 4, p.hair);
  if (parts.accessory === 'headphones-01') {
    const accessoryColor = config.customization?.colors.special ?? '#dddccb';
    ctx.strokeStyle = accessoryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -40 + bob, 11, Math.PI, 2 * Math.PI);
    ctx.stroke();
    box(ctx, -13, -41 + bob, 4, 8, accessoryColor, 1);
    if (!side) box(ctx, 9, -41 + bob, 4, 8, accessoryColor, 1);
  }
  ctx.restore();
}
export function createAvatarSheet(catalog: AvatarCatalog, config: AvatarConfig): HTMLCanvasElement {
  const { frameWidth: w, frameHeight: h, anchor } = catalog.sprite;
  const surface = document.createElement('canvas');
  surface.width = w * 6;
  surface.height = h * 4;
  const ctx = surface.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен');
  DIRECTIONS.forEach((direction, row) => {
    for (let frame = 0; frame < 6; frame++) {
      ctx.save();
      ctx.translate(frame * w + anchor.x, row * h + anchor.y);
      drawAvatarFrame(ctx, config, direction, frame);
      ctx.restore();
    }
  });
  return surface;
}
async function readSheet(
  url: string,
  width: number,
  height: number,
  signal: AbortSignal,
): Promise<ImageBitmap> {
  const response = await fetch(contentPath(url, import.meta.env.BASE_URL), { signal });
  if (!response.ok) throw new Error('Не удалось загрузить спрайт-лист персонажа');
  const image = await createImageBitmap(await response.blob());
  if (signal.aborted || image.width !== width || image.height !== height) {
    image.close();
    signal.throwIfAborted();
    throw new Error('Неверный размер спрайт-листа персонажа');
  }
  return image;
}
/** Optional PNG replacement. Compose selected part sheets once, never per animation tick.
 * Images are grayscale RGBA masks for tintable layers and full RGBA for accessories.
 */
export async function loadAvatarSheet(
  catalog: AvatarCatalog,
  config: AvatarConfig,
  signal: AbortSignal,
): Promise<HTMLCanvasElement> {
  const bodyTest = await loadBodyTest(config, signal);
  if (bodyTest) return bodyTest;
  const source = catalog.sprite.source;
  if (source.kind === 'procedural') return createAvatarSheet(catalog, config);
  const width = catalog.sprite.frameWidth * 6,
    height = catalog.sprite.frameHeight * 4;
  const sheet = document.createElement('canvas');
  sheet.width = width;
  sheet.height = height;
  const ctx = sheet.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен');
  const selected =
    source.kind === 'spritesheet'
      ? [{ url: source.url, tint: null }]
      : (['body', 'shoes', 'outfit', 'hair', 'accessory'] as const).flatMap((part) => {
          const id = part === 'shoes' ? 'base-shoes' : config.parts[part];
          if (id === null) return [];
          const layer = source.layers.find(
            (l) =>
              l.part === part && l.partId === id && (!l.bodyId || l.bodyId === config.parts.body),
          );
          if (!layer) throw new Error(`Нет спрайт-листа части ${part}`);
          return [layer];
        });
  for (const layer of selected) {
    const image = await readSheet(layer.url, width, height, signal);
    try {
      if (!layer.tint) {
        ctx.drawImage(image, 0, 0);
        continue;
      }
      const mask = document.createElement('canvas');
      mask.width = width;
      mask.height = height;
      const paint = mask.getContext('2d')!;
      paint.drawImage(image, 0, 0);
      paint.globalCompositeOperation = 'multiply';
      paint.fillStyle = config.palette[layer.tint];
      paint.fillRect(0, 0, width, height);
      paint.globalCompositeOperation = 'destination-in';
      paint.drawImage(image, 0, 0);
      ctx.drawImage(mask, 0, 0);
    } finally {
      image.close();
    }
  }
  signal.throwIfAborted();
  return sheet;
}
