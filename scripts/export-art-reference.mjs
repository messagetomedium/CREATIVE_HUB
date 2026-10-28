import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

// Requires the local Vite dev server. Does not generate new illustrations or add
// runtime resources: exports the exact shared blockouts for an artist to inspect.
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:5173');
if (!['localhost', '127.0.0.1'].includes(base.hostname))
  throw new Error('Use the local Vite server.');
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ??
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
});
try {
  const page = await browser.newPage();
  await page.goto(base.href);
  const exported = await page.evaluate(async () => {
    const avatarPath = '/src/avatar/art.ts',
      catalogPath = '/src/avatar/catalog.ts',
      scenePath = '/src/game/sceneArt.ts';
    const [{ loadAvatarSheet }, { avatarCatalog }, { createPropSheet, createWallSheet }] =
      await Promise.all([import(avatarPath), import(catalogPath), import(scenePath)]);
    const response = await fetch('/content/manifest.json', { cache: 'no-store' });
    const manifest = await response.json();
    const art = await (await fetch(manifest.sceneArtUrl)).json();
    return {
      avatar: (
        await loadAvatarSheet(
          avatarCatalog,
          avatarCatalog.defaultAvatar,
          new AbortController().signal,
        )
      )
        .toDataURL('image/png')
        .split(',')[1],
      props: createPropSheet(art).toDataURL('image/png').split(',')[1],
      walls: createWallSheet(art).toDataURL('image/png').split(',')[1],
      layout: {
        avatar: {
          frameWidth: avatarCatalog.sprite.frameWidth,
          frameHeight: avatarCatalog.sprite.frameHeight,
          columns: 6,
          rows: 4,
          anchor: avatarCatalog.sprite.anchor,
          animations: avatarCatalog.sprite.animations,
        },
        props: art.props,
        walls: art.walls,
      },
    };
  });
  const output = fileURLToPath(new URL('../content/art/reference/', import.meta.url));
  await mkdir(output, { recursive: true });
  for (const name of ['avatar', 'props', 'walls'])
    await writeFile(
      path.join(output, `${name}-blockout.png`),
      Buffer.from(exported[name], 'base64'),
    );
  await writeFile(
    path.join(output, 'layout.json'),
    await format(JSON.stringify(exported.layout), { parser: 'json' }),
  );
  console.log('Reference sheets exported: avatar 576×512, props 640×384, walls 128×64.');
} finally {
  await browser.close();
}
