import type { AvatarConfig } from '@creative-factory/contracts';
import { constructorChoices } from '../editor';
import { skinLegwear } from '../wardrobe';
import { DIRECTIONS, pose } from './rig';
import { editorShoeLayout } from '../editorMotion';
import { OUTLINE, mix, shades } from './materials';
import { renderBaseModule, type PartImage } from './render';
import { PartEntrySchema } from './parts';
/** Once-per-appearance foot surface under open shoes: skin → tights → socks → shoe. */
export function footUnderlays(config: AvatarConfig, geometry: 'approved' | 'legacy'): PartImage[] {
  const c = constructorChoices(config);
  const color = c.socks
    ? (c.colors.socks ?? '#f1e9d8')
    : c.bottom === 9 && !skinLegwear(config)
      ? c.colors.bottom
      : config.palette.skin;
  return [0, 1].map((index) => {
    const image = document.createElement('canvas');
    image.width = 40;
    image.height = 96;
    const ctx = image.getContext('2d')!;
    for (const [row, direction] of DIRECTIONS.entries()) {
      if (geometry === 'legacy') {
        const p = pose(c.build, direction, 0),
          f = p.feet[index]!;
        ctx.save();
        ctx.translate(20 - f.x, row * 24 + 12 - f.y);
        renderBaseModule(ctx, p, index === 0 ? 'footLeft' : 'footRight', shades(color));
        ctx.restore();
        continue;
      }
      const s = editorShoeLayout(c.build, direction, index);
      const fill =
        direction === (index === 0 ? 'east' : 'west') ? mix(color, OUTLINE, 0.14) : color;
      const inside = (x: number, y: number) => {
        if (x < s.left || x >= s.left + s.width || y < s.top || y >= s.top + s.height) return false;
        const cx = Math.max(s.left + 2, Math.min(s.left + s.width - 2, x)),
          cy = Math.max(s.top + 2, Math.min(s.top + s.height - 2, y));
        return (x - cx) ** 2 + (y - cy) ** 2 <= 4;
      };
      for (let y = -12; y < 12; y++)
        for (let x = -20; x < 20; x++)
          if (inside(x + 0.5, y + 0.5)) {
            ctx.fillStyle = [
              [-2, 0],
              [2, 0],
              [0, -2],
              [0, 2],
              [-1, -1],
              [1, -1],
              [-1, 1],
              [1, 1],
            ].every(([dx, dy]) => inside(x + 0.5 + dx!, y + 0.5 + dy!))
              ? fill
              : OUTLINE;
            ctx.fillRect(x + 20, row * 24 + y + 12, 1, 1);
          }
    }
    return {
      image,
      descriptor: PartEntrySchema.parse({
        id: `wardrobe-foot-underlay-${index}`,
        parent: index === 0 ? 'footLeft' : 'footRight',
        pass: 'front',
        material: 'skin',
        frameWidth: 40,
        frameHeight: 24,
        anchor: { x: 20, y: 12 },
        offset: { x: 0, y: 0 },
        fit: 'fixed',
        sync: 'limb',
        selection: { field: 'footwear', slot: c.footwear },
      }),
    };
  });
}
