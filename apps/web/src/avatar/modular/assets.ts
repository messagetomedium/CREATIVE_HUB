import { PartEntrySchema, type PartEntry } from './parts';
import partsSource from '../../../../../content/avatars/modular/parts.json';
import { constructorChoices } from '../editor';
import type { AvatarConfig } from '@creative-factory/contracts';
import { contentPath } from '../../game/contentPath';
import { colorMask, normalizeMask, mix } from './materials';
import type { PartImage } from './render';
const entries = partsSource.map((entry) => PartEntrySchema.parse(entry));
const pixelsCache = new Map<string, HTMLCanvasElement>();
export async function loadParts(
  config: AvatarConfig,
  signal: AbortSignal,
  catalog: PartEntry[] = entries,
): Promise<PartImage[]> {
  const choices = constructorChoices(config);
  const selected = catalog.filter((d) => {
    const s = d.selection;
    if (s.gender && s.gender !== choices.gender) return false;
    const v =
      s.field === 'base' ? 1 : s.field === 'hair' ? choices.hair[choices.gender] : choices[s.field];
    return Array.isArray(v) ? v.includes(s.slot) : v === s.slot;
  });
  return Promise.all(
    selected.map(async (d: PartEntry) => {
      signal.throwIfAborted();
      if (!d.source) throw new Error('Не задан источник части');
      let original = pixelsCache.get(d.source);
      if (!original) {
        const r = await fetch(contentPath(d.source, import.meta.env.BASE_URL), { signal });
        if (!r.ok) throw new Error('Не удалось загрузить часть');
        const image = await createImageBitmap(await r.blob());
        try {
          if (
            image.width !== d.frameWidth ||
            image.height % d.frameHeight !== 0 ||
            image.height / d.frameHeight < (d.mirrorWest ? 3 : 4) ||
            d.overrides.some((o) => o.sourceFrame >= image.height / d.frameHeight) ||
            image.height / d.frameHeight > 64
          )
            throw new Error('Неверные кадры части');
          original = document.createElement('canvas');
          original.width = image.width;
          original.height = image.height;
          original.getContext('2d')!.drawImage(image, 0, 0);
          pixelsCache.set(d.source, original);
          if (pixelsCache.size > 32) pixelsCache.delete(pixelsCache.keys().next().value!);
        } finally {
          image.close();
        }
      }
      const copy = document.createElement('canvas');
      copy.width = original.width;
      copy.height = original.height;
      const ctx = copy.getContext('2d')!;
      const pixels = original.getContext('2d')!.getImageData(0, 0, original.width, original.height);
      if (d.material !== 'fixed') {
        const skinEffect =
          d.selection.field === 'faceFeatures' || d.selection.field === 'bodyFeatures';
        normalizeMask(pixels, skinEffect);
        let color = {
          skin: config.palette.skin,
          hair: config.palette.hair,
          top: config.palette.outfit,
          bottom: choices.colors.bottom,
          footwear: config.palette.shoes,
          hat: choices.colors.hat,
          jewelry: choices.colors.jewelry,
          special: choices.colors.special,
        }[d.material];
        if (skinEffect && d.material === 'skin') {
          const pigment =
            d.selection.slot <= 2 ? '#503628' : d.selection.slot === 4 ? '#5e5d73' : '#b5625a';
          color = mix(config.palette.skin, pigment, 0.5);
        }
        colorMask(pixels, color);
      }
      ctx.putImageData(pixels, 0, 0);
      return { descriptor: d, image: copy };
    }),
  );
}
import atlasUrl from '../../../../../content/avatars/modular/hair-indexed.png?url&no-inline';
let atlas: HTMLCanvasElement | undefined;
let pending: Promise<HTMLCanvasElement> | undefined;
export async function loadHairAtlas(signal: AbortSignal) {
  signal.throwIfAborted();
  if (atlas) return atlas;
  if (!pending)
    pending = (async () => {
      // Shared small immutable resource; a single preview's cancellation must not cancel other consumers.
      const response = await fetch(atlasUrl, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Не удалось загрузить причёски');
      const image = await createImageBitmap(await response.blob());
      try {
        if (image.width !== 128 || image.height !== 128)
          throw new Error('Неверный размер каталога причёсок');
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        c.getContext('2d')!.drawImage(image, 0, 0);
        atlas = c;
        return c;
      } finally {
        image.close();
      }
    })().catch((error) => {
      pending = undefined;
      throw error;
    });
  const result = await pending;
  signal.throwIfAborted();
  return result;
}
