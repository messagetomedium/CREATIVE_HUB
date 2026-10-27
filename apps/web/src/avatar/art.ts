import type { AvatarCatalog, AvatarConfig } from '@creative-factory/contracts';
import { contentPath } from '../game/contentPath';
import { cachedAssembly, proceduralSheet, tintHair } from './modular/render';
import { loadHairAtlas, loadParts } from './modular/assets';
export { assemblyStats } from './modular/render';
export { DIRECTIONS } from './modular/rig';
export const createAvatarSheet = proceduralSheet;
async function readSheet(
  url: string,
  width: number,
  height: number,
  signal: AbortSignal,
): Promise<ImageBitmap> {
  const response = await fetch(contentPath(url, import.meta.env.BASE_URL), { signal });
  if (!response.ok) throw new Error('Не удалось загрузить спрайт-лист персонажа');
  const image = await createImageBitmap(await response.blob());
  if (signal.aborted || image.width !== width || image.height !== height) {
    image.close();
    signal.throwIfAborted();
    throw new Error('Неверный размер спрайт-листа персонажа');
  }
  return image;
}
/** Optional PNG replacement. Compose selected part sheets once, never per animation tick.
 * Images are grayscale RGBA masks for tintable layers and full RGBA for accessories.
 */
export async function loadAvatarSheet(
  catalog: AvatarCatalog,
  config: AvatarConfig,
  signal: AbortSignal,
): Promise<HTMLCanvasElement> {
  const source = catalog.sprite.source;
  if (source.kind === 'procedural') {
    const [atlas, parts] = await Promise.all([loadHairAtlas(signal), loadParts(config, signal)]);
    signal.throwIfAborted();
    return cachedAssembly(config, () => tintHair(atlas, config.palette.hair), parts);
  }
  const width = catalog.sprite.frameWidth * 6,
    height = catalog.sprite.frameHeight * 4;
  const sheet = document.createElement('canvas');
  sheet.width = width;
  sheet.height = height;
  const ctx = sheet.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен');
  const selected =
    source.kind === 'spritesheet'
      ? [{ url: source.url, tint: null }]
      : (['body', 'shoes', 'outfit', 'hair', 'accessory'] as const).flatMap((part) => {
          const id = part === 'shoes' ? 'base-shoes' : config.parts[part];
          if (id === null) return [];
          const layer = source.layers.find(
            (l) =>
              l.part === part && l.partId === id && (!l.bodyId || l.bodyId === config.parts.body),
          );
          if (!layer) throw new Error(`Нет спрайт-листа части ${part}`);
          return [layer];
        });
  for (const layer of selected) {
    const image = await readSheet(layer.url, width, height, signal);
    try {
      if (!layer.tint) {
        ctx.drawImage(image, 0, 0);
        continue;
      }
      const mask = document.createElement('canvas');
      mask.width = width;
      mask.height = height;
      const paint = mask.getContext('2d')!;
      paint.drawImage(image, 0, 0);
      paint.globalCompositeOperation = 'multiply';
      paint.fillStyle = config.palette[layer.tint];
      paint.fillRect(0, 0, width, height);
      paint.globalCompositeOperation = 'destination-in';
      paint.drawImage(image, 0, 0);
      ctx.drawImage(mask, 0, 0);
    } finally {
      image.close();
    }
  }
  signal.throwIfAborted();
  return sheet;
}
