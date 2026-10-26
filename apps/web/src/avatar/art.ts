import type { AvatarCatalog, AvatarConfig, Direction } from '@creative-factory/contracts';

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
/** Original strictly overhead art. Shared by React preview and the Phaser sprite provider.
 * Caller sets origin to frame centre; all variants share animation phase and 48px coordinates.
 * Visual body width does not change the movement hitbox.
 */
export function drawAvatarFrame(
  ctx: CanvasRenderingContext2D,
  config: AvatarConfig,
  direction: Direction,
  frame: number,
): void {
  const { parts, palette: p } = config;
  const stride = frame < 2 ? 0 : Math.sin(((frame - 2) * Math.PI) / 2) * 3;
  const breathe = frame === 1 ? 0.7 : 0;
  const broad = parts.body === 'base-02' ? 3 : 0;
  ctx.save();
  ctx.rotate((DIRECTIONS.indexOf(direction) * Math.PI) / 2);
  box(ctx, -10, 4 + stride, 7, 10, '#253e37', 3);
  box(ctx, 3, 4 - stride, 7, 10, '#253e37', 3);
  box(ctx, -10, 9 + stride, 7, 5, p.shoes);
  box(ctx, 3, 9 - stride, 7, 5, p.shoes);
  box(ctx, -16 - broad, -2 - stride, 6, 13, p.outfit, 3);
  box(ctx, 10 + broad, -2 + stride, 6, 13, p.outfit, 3);
  box(ctx, -15 - broad, -5 - stride, 5, 5, p.skin);
  box(ctx, 10 + broad, -5 + stride, 5, 5, p.skin);
  box(ctx, -11 - broad, -8 + breathe, 22 + broad * 2, 20, '#253e37', 7);
  box(ctx, -10 - broad, -8 + breathe, 20 + broad * 2, 17, p.outfit, 6);
  if (parts.outfit === 'jacket-01') {
    box(ctx, -1, 1 + breathe, 2, 9, '#efebdc', 0);
    box(ctx, -9 - broad, 5 + breathe, 5, 3, '#253e37');
    box(ctx, 4 + broad, 5 + breathe, 5, 3, '#253e37');
  } else if (parts.outfit === 'dress-01') {
    ctx.fillStyle = p.outfit;
    ctx.beginPath();
    ctx.moveTo(-10 - broad, 0);
    ctx.lineTo(10 + broad, 0);
    ctx.lineTo(15 + broad, 13);
    ctx.lineTo(-15 - broad, 13);
    ctx.closePath();
    ctx.fill();
    box(ctx, -12 - broad, 11, 24 + broad * 2, 2, '#efebdc');
  } else {
    box(ctx, -7 - broad, 4 + breathe, 5, 5, '#efebdc');
    box(ctx, 2 + broad, 4 + breathe, 5, 5, '#efebdc');
  }
  oval(ctx, 0, -5 + breathe, 9, 10, p.skin);
  if (parts.hair === 'bob-01') {
    box(ctx, -12, -12 + breathe, 24, 21, p.hair, 7);
    box(ctx, -6, -14 + breathe, 12, 5, p.skin);
  } else if (parts.hair === 'curls-01') {
    oval(ctx, 0, -5 + breathe, 11, 10, p.hair);
    for (let i = 0; i < 9; i++) {
      const angle = (i * Math.PI * 2) / 9;
      oval(ctx, Math.cos(angle) * 9, -5 + breathe + Math.sin(angle) * 8, 4, 4, p.hair);
    }
    box(ctx, -5, -16 + breathe, 10, 5, p.skin);
  } else {
    oval(ctx, 0, -3 + breathe, 9, 8, p.hair);
    box(ctx, -6, -14 + breathe, 12, 4, p.skin);
  }
  if (parts.accessory === 'headphones-01') {
    ctx.strokeStyle = '#e5e1cb';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -4 + breathe, 12, 0, Math.PI);
    ctx.stroke();
    box(ctx, -14, -6, 4, 8, '#e5e1cb');
    box(ctx, 10, -6, 4, 8, '#e5e1cb');
  }
  ctx.restore();
}
export function createAvatarSheet(catalog: AvatarCatalog, config: AvatarConfig): HTMLCanvasElement {
  const { frameWidth: w, frameHeight: h } = catalog.sprite;
  const surface = document.createElement('canvas');
  surface.width = w * 6;
  surface.height = h * 4;
  const ctx = surface.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен');
  DIRECTIONS.forEach((direction, row) => {
    for (let frame = 0; frame < 6; frame++) {
      ctx.save();
      ctx.translate(frame * w + w / 2, row * h + h / 2);
      ctx.scale(w / 48, h / 48);
      drawAvatarFrame(ctx, config, direction, frame);
      ctx.restore();
    }
  });
  return surface;
}
