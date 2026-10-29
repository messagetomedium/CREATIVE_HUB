import type { Direction } from '@creative-factory/contracts';
import type { Pose } from './modular/rig';
import { DIRECTIONS } from './modular/rig';
import { oval } from './modular/raster';
// Legacy PNG cells have different padding. These source-pixel landmarks register
// the original four views, without changing the source or mirroring an authored W.
// Future artist masks must use the shared head pivot (48,34), not alpha-bbox centering.
const SOURCES = [
  { x: [18, 19, 18, 16], top: [7, 4, 7, 2], scaleY: 28 / 32 },
  { x: [16, 18, 18, 16], top: [3, 3, 3, 1], scaleY: 24 / 32 },
  { x: [16, 16, 16, 16], top: [8, 8, 8, 5], scaleY: 1 },
  { x: [16, 16, 16, 16], top: [9, 8, 8, 5], scaleY: 1 },
];
export function editorHairRegistration(slot: number, direction: Direction) {
  const source = SOURCES[slot - 1];
  if (!source) return undefined;
  const row = DIRECTIONS.indexOf(direction);
  return {
    row,
    x: source.x[row]! * 2,
    y: (23 + source.top[row]! - source.top[2]!) * 2,
    scaleY: source.scaleY,
  };
}
export function drawEditorHair(
  ctx: CanvasRenderingContext2D,
  p: Pose,
  hair: HTMLCanvasElement,
  slot: number,
  pass: 'back' | 'front',
) {
  const r = editorHairRegistration(slot, p.direction);
  if (!r) return;
  const sx = (slot - 1) * 64;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  if (p.side) {
    ctx.rect(0, 0, 96, 28);
    ctx.rect(p.direction === 'west' ? 46 : 0, 28, 50, 100);
  } else if (pass === 'back' || p.direction === 'north') ctx.rect(0, 0, 96, 128);
  else {
    ctx.rect(0, 0, 96, 30);
    ctx.rect(0, 30, 32, 98);
    ctx.rect(64, 30, 32, 98);
  }
  ctx.clip();
  if (p.direction === 'north' && pass === 'front') {
    const c = hair.getContext('2d')!.getImageData(sx + 32, 32, 1, 1).data;
    oval(ctx, 48, 34, 20, 20, `rgb(${c[0]},${c[1]},${c[2]})`, '#352b35');
  }
  ctx.drawImage(
    hair,
    sx + 6,
    r.row * 64,
    58,
    64,
    48 - r.x + 6,
    Math.round(34 - r.y * r.scaleY),
    58,
    Math.round(64 * r.scaleY),
  );
  ctx.restore();
}
