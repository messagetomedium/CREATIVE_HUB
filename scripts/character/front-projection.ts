import { PNG } from 'pngjs';
import type { SourceTemplate } from '../../apps/web/src/avatar/modular/templates';
export function projectFront(png: PNG, t: SourceTemplate, slot = 1) {
  const out = new PNG({ width: t.width, height: t.height * 4 }),
    cx = t.anchor.x;
  png.data.copy(out.data, 2 * t.width * t.height * 4);
  let minX = t.width,
    maxX = -1;
  for (let y = 0; y < t.height; y++)
    for (let x = 0; x < t.width; x++)
      if (png.data[(y * t.width + x) * 4 + 3]) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
  const mouthMid = Math.floor((minX + maxX) / 2);
  for (const [row, right] of [
    [1, true],
    [3, false],
  ] as const)
    for (let y = 0; y < t.height; y++)
      for (let x = 0; x < t.width; x++) {
        const at = (y * t.width + x) * 4;
        if (!png.data[at + 3]) continue;
        let accept = right ? x >= cx : x < cx,
          shift = right ? 4 : -4;
        if (t.field === 'mouth') {
          accept = right ? x >= mouthMid : x <= mouthMid;
          const mid = right ? Math.floor((mouthMid + maxX) / 2) : Math.floor((minX + mouthMid) / 2);
          shift = (right ? cx + 14 : cx - 16) - mid;
        } else if (t.field === 'faceFeatures') {
          if (slot === 6) {
            accept = Math.abs(x - cx) <= 4;
            shift = right ? 14 : -14;
          } else shift = right ? 2 : -2;
        }
        const dx = x + shift;
        if (!accept || dx < 1 || dx >= t.width - 1) continue;
        png.data.copy(out.data, ((row * t.height + y) * t.width + dx) * 4, at, at + 4);
      }
  return out;
}
