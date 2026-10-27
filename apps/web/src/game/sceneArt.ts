import type Phaser from 'phaser';
import { findPropArt, type SceneArt, type WorldProp } from '@creative-factory/contracts';
function surface(width: number, height: number) {
  const image = document.createElement('canvas');
  image.width = width;
  image.height = height;
  const ctx = image.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен');
  return { image, ctx };
}
/** Ten reusable flat blockout shapes, not thirty per-instance textures. */
export function createPropSheet(art: SceneArt): HTMLCanvasElement {
  const spec = art.props,
    { image, ctx } = surface(spec.frameWidth * spec.columns, spec.frameHeight * spec.rows);
  for (const entry of spec.entries) {
    const { width: w, depth: d, elevation: h, assetId } = entry;
    ctx.save();
    ctx.translate(
      (entry.frame % spec.columns) * spec.frameWidth + spec.anchor.x,
      Math.floor(entry.frame / spec.columns) * spec.frameHeight + spec.anchor.y,
    );
    ctx.fillStyle = '#9b9d89';
    ctx.fillRect(-w / 2, -h, w, h); // Plain south facade.
    ctx.fillStyle = assetId === 'bench' ? '#adbb91' : '#e4ddc7';
    ctx.fillRect(-w / 2, -h - d, w, d);
    ctx.strokeStyle = '#6b7a66';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 + 1, -h - d + 1, w - 2, d + h - 2);
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h);
    ctx.lineTo(w / 2, -h);
    ctx.stroke();
    // One identifier per workshop prop. No small decor, gradients, or particle effects.
    if (assetId === 'plant') {
      ctx.fillStyle = '#b59f7e';
      ctx.fillRect(-10, -18, 20, 18);
      ctx.fillStyle = '#7e9a72';
      ctx.beginPath();
      ctx.ellipse(0, -36, 15, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (assetId === 'console') {
      ctx.fillStyle = '#637f7b';
      ctx.fillRect(-w / 2 + 12, -h - d + 12, w - 24, 25);
    } else if (assetId === 'cutting-table') {
      ctx.fillStyle = '#8ca48b';
      ctx.fillRect(-w / 2 + 12, -h - d + 12, w - 24, d - 24);
    } else if (assetId === 'model-table') {
      ctx.fillStyle = '#a5b7bd';
      ctx.fillRect(-w / 2 + 12, -h - d + 12, w - 24, d - 24);
      ctx.fillStyle = '#f6f0dc';
      ctx.fillRect(-12, -h - d / 2 - 8, 24, 16);
    } else if (assetId === 'worktable') {
      ctx.fillStyle = '#f8f3e7';
      ctx.fillRect(-20, -h - d / 2 - 14, 40, 28);
    }
    ctx.restore();
  }
  return image;
}
export function createWallSheet(art: SceneArt): HTMLCanvasElement {
  const spec = art.walls,
    { image, ctx } = surface(spec.frameWidth * spec.columns, spec.frameHeight);
  for (let frame = 0; frame < 4; frame++) {
    const x = frame * 32;
    ctx.fillStyle = '#9bab94';
    ctx.fillRect(x, 0, 32, 32); // Upper cap, 32px above floor footprint.
    ctx.fillStyle = '#b9c5ac';
    ctx.fillRect(x, 32, 32, 32); // South face.
    ctx.fillStyle = '#73876f';
    ctx.fillRect(x, 30, 32, 2);
    ctx.fillRect(x, 62, 32, 2);
    if (frame & 1) {
      ctx.fillStyle = '#7f9278';
      ctx.fillRect(x, 0, 2, 64);
    }
    if (frame & 2) {
      ctx.fillStyle = '#7f9278';
      ctx.fillRect(x + 30, 0, 2, 64);
    }
  }
  return image;
}
export function installSceneArt(scene: Phaser.Scene, art: SceneArt): void {
  for (const [key, spec, generate] of [
    ['props', art.props, createPropSheet],
    ['walls', art.walls, createWallSheet],
  ] as const) {
    if (spec.source.kind !== 'procedural') {
      const image = scene.textures.get(key).getSourceImage() as HTMLImageElement;
      if (
        image.width !== spec.frameWidth * spec.columns ||
        image.height !== spec.frameHeight * spec.rows
      )
        throw new Error('Неверный размер спрайт-листа объектов');
      continue;
    }
    const texture = scene.textures.addCanvas(key, generate(art));
    if (!texture) throw new Error('Не удалось создать болванки объектов');
    for (let frame = 0; frame < spec.columns * spec.rows; frame++)
      texture.add(
        frame,
        0,
        (frame % spec.columns) * spec.frameWidth,
        Math.floor(frame / spec.columns) * spec.frameHeight,
        spec.frameWidth,
        spec.frameHeight,
      );
  }
}
export function propAppearance(art: SceneArt, prop: WorldProp) {
  return findPropArt(art, prop.assetId, prop.bounds.width, prop.bounds.height);
}
