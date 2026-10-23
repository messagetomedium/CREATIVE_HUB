import type Phaser from 'phaser';
import type { AvatarCatalog, AvatarConfig, WorldProp } from '@creative-factory/contracts';

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  const ctx = surface.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен');
  return [surface, ctx];
}
function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  radius = 3,
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}
/** Original overhead placeholder art. This provider can be replaced without touching movement. */
export function makeAvatar(
  scene: Phaser.Scene,
  catalog: AvatarCatalog,
  config: AvatarConfig,
): void {
  const { frameWidth: w, frameHeight: h } = catalog.sprite;
  const [surface, ctx] = canvas(w * 6, h * 4);
  const palette = config.palette;
  for (let direction = 0; direction < 4; direction++)
    for (let frame = 0; frame < 6; frame++) {
      ctx.save();
      ctx.translate(frame * w + w / 2, direction * h + h / 2);
      ctx.scale(w / 48, h / 48);
      ctx.rotate((direction * Math.PI) / 2);
      const stride = frame < 2 ? 0 : Math.sin(((frame - 2) * Math.PI) / 2) * 3;
      const breathe = frame === 1 ? 0.7 : 0;
      box(ctx, -10, 4 + stride, 7, 10, '#253e37', 3);
      box(ctx, 3, 4 - stride, 7, 10, '#253e37', 3);
      box(ctx, -10, 9 + stride, 7, 5, palette.shoes, 2);
      box(ctx, 3, 9 - stride, 7, 5, palette.shoes, 2);
      box(ctx, -16, -2 - stride, 6, 13, palette.outfit, 3);
      box(ctx, 10, -2 + stride, 6, 13, palette.outfit, 3);
      box(ctx, -15, -5 - stride, 5, 5, palette.skin, 2);
      box(ctx, 10, -5 + stride, 5, 5, palette.skin, 2);
      box(ctx, -11, -8 + breathe, 22, 20, '#a74e36', 7);
      box(ctx, -10, -8 + breathe, 20, 16, palette.outfit, 6);
      box(ctx, -5, 5 + breathe, 10, 4, '#df9875', 2);
      ctx.fillStyle = palette.skin;
      ctx.beginPath();
      ctx.ellipse(0, -5 + breathe, 9, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.hair;
      ctx.beginPath();
      ctx.ellipse(0, -3 + breathe, 10, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // Face points north; each row rotates the same overhead silhouette.
      box(ctx, -6, -14 + breathe, 12, 4, palette.skin, 2);
      ctx.strokeStyle = '#dfdbc4';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -4 + breathe, 10.5, 0.15, Math.PI - 0.15);
      ctx.stroke();
      ctx.restore();
    }
  const texture = scene.textures.addCanvas('avatar', surface);
  if (!texture) throw new Error('Не удалось создать атлас персонажа');
  for (let row = 0; row < 4; row++)
    for (let frame = 0; frame < 6; frame++) {
      texture.add(row * 6 + frame, 0, frame * w, row * h, w, h);
    }
}
export function makeProp(scene: Phaser.Scene, prop: WorldProp): string {
  const key = `prop-${prop.id}`,
    w = prop.bounds.width,
    h = prop.bounds.height;
  const [surface, ctx] = canvas(w, h);
  if (prop.assetId === 'plant') {
    ctx.fillStyle = '#bcb7a2';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.38, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((i * Math.PI * 2) / 7);
      ctx.fillStyle = i % 2 ? '#638267' : '#839b76';
      ctx.beginPath();
      ctx.ellipse(0, -7, 5, 11, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#a5b78d';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.assetId === 'bench') {
    box(ctx, 0, 0, w, h, '#64765b', 5);
    for (let y = 5; y < h; y += 7) box(ctx, 4, y, w - 8, 4, '#9ca889', 1);
  } else {
    box(ctx, 0, 0, w, h, '#506059', 5);
    box(ctx, 3, 3, w - 6, h - 6, '#c1b59a', 3);
    box(ctx, 6, 6, w - 12, h - 12, '#eee6d3', 2);
    if (prop.assetId === 'console') {
      box(ctx, 9, 8, w - 18, 22, '#334940', 2);
      box(ctx, 13, 12, w - 26, 14, '#88a9a0', 1);
      for (let x = 10; x < w - 10; x += 10) {
        box(ctx, x, 35, 5, 12, '#819087', 1);
        box(ctx, x, 48, 5, 4, prop.accent, 1);
      }
    } else if (prop.assetId === 'cutting-table') {
      box(ctx, 9, 10, w * 0.55, h - 20, '#8d9d82', 1);
      ctx.strokeStyle = '#c7d1b4';
      ctx.lineWidth = 0.7;
      for (let x = 12; x < w * 0.6; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, 12);
        ctx.lineTo(x, h - 12);
        ctx.stroke();
      }
      box(ctx, w - 27, 12, 13, h - 24, prop.accent, 2);
      box(ctx, w - 23, 17, 5, h - 34, '#e4d2b6', 1);
    } else if (prop.assetId === 'model-table') {
      box(ctx, 10, 10, w - 20, h - 20, '#adc2ca', 1);
      ctx.strokeStyle = '#dbe8e6';
      ctx.lineWidth = 1;
      ctx.strokeRect(16, 17, 28, 22);
      ctx.strokeRect(48, 23, 20, 17);
      box(ctx, 24, 21, 14, 13, '#faf4df', 1);
      box(ctx, 52, 27, 12, 10, '#e4decb', 1);
    } else {
      ctx.save();
      ctx.translate(w * 0.3, h * 0.5);
      ctx.rotate(-0.15);
      box(ctx, -18, -20, 36, 40, '#fffaf0', 1);
      box(ctx, -11, -12, 22, 3, prop.accent, 0);
      box(ctx, -11, -4, 14, 2, '#a6b0a1', 0);
      box(ctx, -11, 4, 20, 9, prop.accent, 0);
      ctx.restore();
      box(ctx, w - 31, 14, 16, 25, prop.accent, 2);
      box(ctx, w - 28, 17, 10, 19, '#f7efda', 1);
    }
  }
  scene.textures.addCanvas(key, surface);
  return key;
}
