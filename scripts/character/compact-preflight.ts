import type { CompiledSource } from './compile-source';
import { fitApprovedPixels } from '../../apps/web/src/avatar/modular/approved-fit';
import { avatarCatalog } from '../../apps/web/src/avatar/catalog';
import { updateConstructor } from '../../apps/web/src/avatar/editor';
import { reviewPose } from '../../apps/web/src/avatar/editorMotion';
import { parentPoint, DIRECTIONS } from '../../apps/web/src/avatar/modular/rig';
/** Reject an unusable replacement before publishing registry entries; does not alter pixels. */
export function preflightCompact(part: CompiledSource) {
  if (!part.descriptor.approved) return;
  for (const gender of ['male', 'female'] as const)
    for (const build of ['very-slim', 'slim', 'average', 'sturdy'] as const) {
      const config = updateConstructor(avatarCatalog.defaultAvatar, { gender, build });
      const fitted = fitApprovedPixels(part.image, part.descriptor, config);
      // The factory retains its legacy rig; validate its preparation as well.
      fitApprovedPixels(part.image, part.descriptor, config, 'legacy');
      const d = fitted.descriptor,
        source = fitted.raster;
      for (const [row, dir] of DIRECTIONS.entries()) {
        let minX = source.width,
          minY = d.frameHeight,
          maxX = -1,
          maxY = -1;
        for (let y = 0; y < d.frameHeight; y++)
          for (let x = 0; x < source.width; x++)
            if (source.data[((row * d.frameHeight + y) * source.width + x) * 4 + 3]) {
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
        if (maxX < minX) continue;
        for (let phase = 0; phase < 6; phase++) {
          const p = reviewPose(build, dir, phase, gender),
            pt = parentPoint(p, d.parent);
          if (
            phase >= 2 &&
            p.side &&
            /^(arm|hand)/.test(d.parent) &&
            d.parent.endsWith(dir === 'east' ? 'Left' : 'Right')
          )
            continue;
          let left = minX - d.anchor.x,
            right = maxX + 1 - d.anchor.x;
          const mirror =
            (Boolean(d.mirrorX) !== (d.mirrorWest && dir === 'west')) !== (d.pairMirror && !p.side);
          if (mirror) [left, right] = [-right, -left];
          const top = minY - d.anchor.y,
            bottom = maxY + 1 - d.anchor.y;
          if (pt.x + left < 0 || pt.x + right > 96 || pt.y + top < 0 || pt.y + bottom > 128)
            throw new Error(
              `Вещь выходит за кадр: ${gender}/${build}/${dir}, фаза ${phase}, ${d.parent}. Уточните силуэт или техническую маску.`,
            );
        }
      }
    }
}
