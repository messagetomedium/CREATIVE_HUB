import type { AvatarConfig } from '@creative-factory/contracts';
import bodyUrl from '../../../../content/art/female-adult-test.png?url';

/** Temporary full-color body test, shared by preview and Phaser. Original PNG is unchanged.
 * This supplied sheet has uneven row spacing; align each row's floor to the existing feet anchor.
 */
export async function loadBodyTest(
  config: AvatarConfig,
  signal: AbortSignal,
): Promise<HTMLCanvasElement | null> {
  if (config.customization?.gender !== 'female' || config.customization.age !== 'adult')
    return null;
  const response = await fetch(bodyUrl, { signal });
  if (!response.ok) throw new Error('Не удалось загрузить тестовый спрайт женщины');
  const image = await createImageBitmap(await response.blob());
  try {
    signal.throwIfAborted();
    if (image.width !== 1330 || image.height !== 1182)
      throw new Error('Размер тестового спрайта изменился: нужна новая нарезка');
    const sheet = document.createElement('canvas');
    sheet.width = 288;
    sheet.height = 256;
    const ctx = sheet.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D недоступен');
    ctx.imageSmoothingEnabled = false;
    const rows = [
      { top: 0, bottom: 305, floor: 290 },
      { top: 305, bottom: 600, floor: 583 },
      { top: 600, bottom: 875, floor: 859 },
      { top: 875, bottom: 1182, floor: 1148 },
    ];
    const scale = 0.19;
    for (const [r, row] of rows.entries())
      for (let col = 0; col < 6; col++) {
        const left = Math.round((col * image.width) / 6),
          right = Math.round(((col + 1) * image.width) / 6);
        const width = (right - left) * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(col * 48, r * 64, 48, 64);
        ctx.clip();
        ctx.drawImage(
          image,
          left,
          row.top,
          right - left,
          row.bottom - row.top,
          col * 48 + (48 - width) / 2,
          r * 64 + 56 - (row.floor - row.top) * scale,
          width,
          (row.bottom - row.top) * scale,
        );
        ctx.restore();
      }
    return sheet;
  } finally {
    image.close();
  }
}
