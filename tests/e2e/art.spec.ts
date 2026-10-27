import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { AvatarCatalog } from '@creative-factory/contracts';
import { enterDemo } from './demoFixture';
test('real PNG layers share frames, use palette masks and reject incorrect sheet dimensions', async ({
  page,
}) => {
  await page.goto('/');
  const catalog = JSON.parse(
    await readFile('content/avatars/catalog.json', 'utf8'),
  ) as AvatarCatalog;
  const images = await page.evaluate(() => {
    const boxes = {
      body: [20, 20, 8, 30],
      shoes: [18, 52, 12, 4],
      outfit: [16, 28, 16, 16],
      hair: [16, 8, 16, 12],
    };
    return Object.fromEntries(
      Object.entries(boxes).map(([part, [x, y, w, h]]) => {
        const c = document.createElement('canvas');
        c.width = 288;
        c.height = 256;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        for (let row = 0; row < 4; row++)
          for (let frame = 0; frame < 6; frame++)
            ctx.fillRect(frame * 48 + x!, row * 64 + y!, w!, h!);
        return [part, c.toDataURL('image/png').split(',')[1]];
      }),
    );
  });
  for (const [part, bytes] of Object.entries(images))
    await page.route(`**/content/test-${part}.png`, (r) =>
      r.fulfill({ contentType: 'image/png', body: Buffer.from(bytes!, 'base64') }),
    );
  catalog.sprite.source = {
    kind: 'layered-sheets',
    layers: [
      { part: 'body', partId: 'base-01', url: '/content/test-body.png', tint: 'skin' },
      { part: 'shoes', partId: 'base-shoes', url: '/content/test-shoes.png', tint: 'shoes' },
      {
        part: 'outfit',
        partId: 'workwear-01',
        bodyId: 'base-01',
        url: '/content/test-outfit.png',
        tint: 'outfit',
      },
      { part: 'hair', partId: 'short-01', url: '/content/test-hair.png', tint: 'hair' },
    ],
  };
  const result = await page.evaluate(async (catalog) => {
    const modulePath = '/src/avatar/art.ts';
    const { loadAvatarSheet } = (await import(
      /* @vite-ignore */ modulePath
    )) as typeof import('../../apps/web/src/avatar/art');
    const sheet = await loadAvatarSheet(
      catalog,
      catalog.defaultAvatar,
      new AbortController().signal,
    );
    const ctx = sheet.getContext('2d')!;
    const pixel = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
    return {
      body: pixel(24, 24),
      outfit: pixel(24, 34),
      hair: pixel(24, 10),
      shoes: pixel(24, 54),
      lastRow: pixel(24, 202),
      transparent: pixel(0, 0),
    };
  }, catalog);
  expect(result).toEqual({
    body: [220, 174, 134, 255],
    outfit: [207, 101, 70, 255],
    hair: [39, 58, 54, 255],
    shoes: [241, 233, 216, 255],
    lastRow: [39, 58, 54, 255],
    transparent: [0, 0, 0, 0],
  });
  await page.route('**/content/test-hair.png', (r) =>
    r.fulfill({ contentType: 'image/png', body: Buffer.from(images.hair!, 'base64') }),
  );
  // A one-frame image is not silently stretched across an animation sheet.
  const tiny = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 64;
    return c.toDataURL().split(',')[1]!;
  });
  await page.route('**/content/test-hair.png', (r) =>
    r.fulfill({ contentType: 'image/png', body: Buffer.from(tiny, 'base64') }),
  );
  const error = await page.evaluate(async (catalog) => {
    const modulePath = '/src/avatar/art.ts';
    const { loadAvatarSheet } = (await import(
      /* @vite-ignore */ modulePath
    )) as typeof import('../../apps/web/src/avatar/art');
    try {
      await loadAvatarSheet(catalog, catalog.defaultAvatar, new AbortController().signal);
      return '';
    } catch (e) {
      return (e as Error).message;
    }
  }, catalog);
  expect(error).toContain('Неверный размер');
});
test('the actual Phaser scene can replace procedural props with one PNG without touching collision data', async ({
  page,
}) => {
  await enterDemo(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 384;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#8da5a1';
    ctx.fillRect(0, 0, 640, 384);
    return c.toDataURL().split(',')[1]!;
  });
  const manifest = JSON.parse(await readFile('apps/web/public/content/manifest.json', 'utf8'));
  const art = JSON.parse(await readFile('content/art/scene-art.json', 'utf8'));
  art.props.source = { kind: 'spritesheet', url: '/content/test-props.png' };
  const body = JSON.stringify(art);
  manifest.sceneArtHash = createHash('sha256').update(body).digest('hex');
  await page.route('**/content/manifest.json', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(manifest) }),
  );
  await page.route('**/content/scene-art-*.json', (r) =>
    r.fulfill({ contentType: 'application/json', body }),
  );
  await page.route('**/content/test-props.png', (r) =>
    r.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }),
  );
  await page.goto('/#/factory');
  await expect(page.getByTestId('current-zone')).toHaveText('Центральный холл', { timeout: 20000 });
  expect((await page.evaluate(() => window.__CF_DEBUG__!.snapshot())).rendering.props).toHaveLength(
    30,
  );
  await expect(page.locator('.game-canvas canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});
