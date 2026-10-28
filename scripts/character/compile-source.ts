import { PNG } from 'pngjs';
import type { PartEntry } from '../../apps/web/src/avatar/modular/parts';
import { BODY_SHAPES, DIRECTIONS } from '../../apps/web/src/avatar/modular/rig';
import { hairLayer, LOWER_LAYOUT, lowerLegSourceX } from '../../apps/web/src/avatar/modular/layout';
import type { SourceTemplate } from '../../apps/web/src/avatar/modular/templates';
export interface CompiledSource {
  descriptor: PartEntry;
  image: PNG;
  key: string;
}
function masked(
  source: PNG,
  width: number,
  height: number,
  keep: (x: number, y: number, row: number) => boolean,
) {
  const out = new PNG({ width, height: height * 4 });
  for (let row = 0; row < 4; row++)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (keep(x, y, row)) {
          const at = ((row * height + y) * width + x) * 4;
          source.data.copy(out.data, at, at, at + 4);
        }
  return out;
}
function occupied(png: PNG) {
  return png.data.some((value, index) => index % 4 === 3 && value > 0);
}
export function compileSource(
  t: SourceTemplate,
  descriptor: PartEntry,
  source: PNG,
  simple: boolean,
  allowMissingBand = false,
): CompiledSource[] {
  if (!simple) return [{ descriptor, image: source, key: 'source' }];
  if (t.id === 'hair-short' || t.id === 'hair-long') {
    return (['back', 'front'] as const)
      .map((pass) => ({
        descriptor: { ...descriptor, pass },
        image: masked(
          source,
          t.width,
          t.height,
          (x, y, row) => hairLayer(x, y, DIRECTIONS[row]!) === pass,
        ),
        key: 'hair-' + pass,
      }))
      .filter((v) => occupied(v.image));
  }
  const match = t.id.match(/^(pants|skirt|shorts)-(high|low)$/);
  if (!match) return [{ descriptor, image: source, key: 'source' }];
  const kind = match[1]!,
    high = match[2] === 'high',
    parts: CompiledSource[] = [];
  let band = false;
  for (let row = 0; row < 4; row++)
    for (let y = 0; y < t.height; y++)
      for (let x = 0; x < t.width; x++)
        if (source.data[((row * t.height + y) * t.width + x) * 4 + 3]) {
          if (y < (high ? LOWER_LAYOUT.bandTop : LOWER_LAYOUT.bandBottom))
            throw new Error(
              'Рисунок низа выше зоны посадки ' + (high ? 'high' : 'low') + ' на шаблоне.',
            );
          if (y >= (kind === 'shorts' ? LOWER_LAYOUT.shortHem : LOWER_LAYOUT.maxHem))
            throw new Error('Рисунок низа выходит ниже допустимого подола шаблона.');
          if (y < LOWER_LAYOUT.bandBottom) band = true;
          if (kind !== 'skirt' && y >= LOWER_LAYOUT.legSplit) {
            const dir = DIRECTIONS[row]!,
              side = dir === 'east' || dir === 'west',
              centres = side ? [lowerLegSourceX(dir, 0)] : [31, 49];
            if (!centres.some((c) => x >= c - 16 && x < c + 16))
              throw new Error(
                'Рисунок брюк/шорт выходит за размеченную зону штанин; безопасный разбор невозможен.',
              );
          }
        }
  if (high && !band && !allowMissingBand)
    throw new Error(
      'Тип high требует нарисованной верхней поясной части. Для вещи без неё используйте low.',
    );
  if (high) {
    const image = masked(source, t.width, t.height, (_x, y) => y < LOWER_LAYOUT.bandBottom);
    parts.push({
      descriptor: { ...descriptor, parent: 'pelvis', fit: 'torso' },
      image,
      key: 'waist',
    });
  }
  const main = masked(
    source,
    t.width,
    t.height,
    (_x, y) =>
      y >= (high ? LOWER_LAYOUT.bandBottom : 0) && (kind === 'skirt' || y < LOWER_LAYOUT.legSplit),
  );
  parts.push({
    descriptor: { ...descriptor, parent: 'pelvis', fit: 'pelvis' },
    image: main,
    key: kind === 'skirt' ? 'skirt-main' : 'lower-main',
  });
  if (kind !== 'skirt')
    for (let index = 0; index < 2; index++) {
      const frame = LOWER_LAYOUT.legFrame,
        image = new PNG({ width: frame.width, height: frame.height * 4 });
      for (let row = 0; row < 4; row++) {
        const direction = DIRECTIONS[row]!,
          side = direction === 'east' || direction === 'west',
          centre = lowerLegSourceX(direction, index);
        for (let y = 0; y < frame.height; y++)
          for (let x = 0; x < frame.width; x++) {
            const sx = centre + x - frame.anchor.x,
              sy = 20 + y - frame.anchor.y;
            if (
              sx < 0 ||
              sx >= t.width ||
              sy < LOWER_LAYOUT.legSplit ||
              sy >= t.height ||
              (!side && ((index === 0 && sx >= 40) || (index === 1 && sx < 40)))
            )
              continue;
            const from = ((row * t.height + sy) * t.width + sx) * 4,
              to = ((row * frame.height + y) * frame.width + x) * 4;
            source.data.copy(image.data, to, from, from + 4);
          }
      }
      parts.push({
        descriptor: {
          ...descriptor,
          parent: index === 0 ? 'legLeft' : 'legRight',
          frameWidth: frame.width,
          frameHeight: frame.height,
          anchor: frame.anchor,
          fit: 'limb',
          sync: 'limb',
          referenceWidth: { front: BODY_SHAPES.average.leg, side: BODY_SHAPES.average.leg },
          pairMirror: false,
        },
        image,
        key: index === 0 ? 'left-leg' : 'right-leg',
      });
    }
  return parts.filter((v) => occupied(v.image));
}
