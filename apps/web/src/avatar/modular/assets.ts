import { PartEntrySchema, type PartEntry } from './parts';
import partsSource from '../../../../../content/avatars/modular/parts.json';
import { constructorChoices } from '../editor';
import type { AvatarConfig } from '@creative-factory/contracts';
import { contentPath } from '../../game/contentPath';
import { colorMask, normalizeMask, mix } from './materials';
import type { PartImage } from './render';
import { fitApprovedPixels } from './approved-fit';
import { footUnderlays } from './foot-underlay';
import { skinLegwear } from '../wardrobe';
const entries = partsSource.map((entry) => PartEntrySchema.parse(entry));
const pixelsCache = new Map<string, HTMLCanvasElement>();
export async function loadParts(
  config: AvatarConfig,
  signal: AbortSignal,
  catalog: PartEntry[] = entries,
  geometry: 'approved' | 'legacy' = 'approved',
): Promise<PartImage[]> {
  const choices = constructorChoices(config);
  const selected = catalog.filter((d) => {
    const s = d.selection;
    if (s.gender && s.gender !== choices.gender) return false;
    const v =
      s.field === 'base' ? 1 : s.field === 'hair' ? choices.hair[choices.gender] : choices[s.field];
    return Array.isArray(v) ? v.includes(s.slot) : v === s.slot;
  });
  const loaded = await Promise.all(
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
          if (pixelsCache.size > 16) pixelsCache.delete(pixelsCache.keys().next().value!);
        } finally {
          image.close();
        }
      }
      const copy = document.createElement('canvas');
      copy.width = original.width;
      copy.height = original.height;
      const ctx = copy.getContext('2d')!;
      const pixels = original.getContext('2d')!.getImageData(0, 0, original.width, original.height);
      const accents = d.preserveColors ? new Uint8ClampedArray(pixels.data) : undefined;
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
          socks: choices.colors.socks ?? '#f1e9d8',
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
        if (accents)
          for (let at = 0; at < accents.length; at += 4)
            if (
              accents[at + 3] &&
              (accents[at] !== accents[at + 1] || accents[at] !== accents[at + 2])
            )
              pixels.data.set(accents.subarray(at, at + 4), at);
      }
      if (d.approved) {
        const fitted = fitApprovedPixels(
          { width: copy.width, height: copy.height, data: pixels.data },
          d,
          config,
          geometry,
        );
        copy.width = fitted.raster.width;
        copy.height = fitted.raster.height;
        const out = copy.getContext('2d')!,
          data = out.createImageData(copy.width, copy.height);
        data.data.set(fitted.raster.data);
        if (d.selection.field === 'bottom' && skinLegwear(config)) data.data.fill(0);
        out.putImageData(data, 0, 0);
        return { descriptor: fitted.descriptor, image: copy };
      }
      ctx.putImageData(pixels, 0, 0);
      return { descriptor: d, image: copy };
    }),
  );
  const priority = (p: PartImage) =>
    p.descriptor.selection?.field === 'socks'
      ? 0
      : p.descriptor.selection?.field === 'bottom'
        ? 1
        : 2;
  loaded.sort((a, b) => priority(a) - priority(b));
  return loaded.some((p) => p.descriptor.selection?.field === 'footwear')
    ? [...footUnderlays(config, geometry), ...loaded]
    : loaded;
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
        c.width = 256;
        c.height = 256;
        const ctx = c.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, 256, 256);
        // Compatibility copy only: retain the legacy design, reduce its outer
        // doubled contour to one native pixel. Artistic originals stay unchanged.
        const pixels = ctx.getImageData(0, 0, 256, 256),
          original = new Uint8ClampedArray(pixels.data);
        const opaque = (x: number, y: number) =>
          x >= 0 && x < 256 && y >= 0 && y < 256 && original[(y * 256 + x) * 4 + 3] === 255;
        for (let y = 1; y < 255; y++)
          for (let x = 1; x < 255; x++) {
            const at = (y * 256 + x) * 4;
            if (
              original[at] !== 32 ||
              !opaque(x, y) ||
              !opaque(x - 1, y) ||
              !opaque(x + 1, y) ||
              !opaque(x, y - 1) ||
              !opaque(x, y + 1)
            )
              continue;
            if (opaque(x - 2, y) && opaque(x + 2, y) && opaque(x, y - 2) && opaque(x, y + 2))
              continue;
            let value = 80;
            outer: for (let r = 1; r <= 3; r++)
              for (const [dx, dy] of [
                [r, 0],
                [-r, 0],
                [0, r],
                [0, -r],
              ]) {
                const q = ((y + dy!) * 256 + x + dx!) * 4;
                if (opaque(x + dx!, y + dy!) && original[q]! > 32) {
                  value = original[q]!;
                  break outer;
                }
              }
            pixels.data[at] = pixels.data[at + 1] = pixels.data[at + 2] = value;
          }
        ctx.putImageData(pixels, 0, 0);
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
