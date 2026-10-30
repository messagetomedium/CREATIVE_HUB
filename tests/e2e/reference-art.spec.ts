import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { rect, lowerFixture } from '../../scripts/character/compact-fixtures';
import { enterDemo } from './demoFixture';

test('actual 25 face/hair samples render, independent profiles survive and seventh effect saves', async ({
  page,
}) => {
  const manifest = JSON.parse(
    await readFile('content/avatars/modular/import-manifest.json', 'utf8'),
  );
  expect(
    manifest.items.filter((item: { category: string }) =>
      ['hair', 'eyes', 'mouth', 'face_features'].includes(item.category),
    ),
  ).toHaveLength(25);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enterDemo(page);
  await page.goto('/#/avatar');
  await page.getByRole('tab', { name: 'Голова', exact: true }).click();
  await expect(
    page.getByRole('group', { name: 'Особенности лица', exact: true }).getByRole('button'),
  ).toHaveCount(7);
  const result = await page.evaluate(async () => {
    const { avatarCatalog } = await import(/* @vite-ignore */ String('/src/avatar/catalog.ts'));
    const { updateConstructor } = await import(/* @vite-ignore */ String('/src/avatar/editor.ts'));
    const { loadEditorReview } = await import(
      /* @vite-ignore */ String('/src/avatar/editorReview.ts')
    );
    const { loadAvatarSheet } = await import(/* @vite-ignore */ String('/src/avatar/art.ts'));
    const hashes = new Set<string>();
    let independent = true;
    for (const gender of ['male', 'female'] as const)
      for (const build of ['very-slim', 'slim', 'average', 'sturdy'] as const)
        for (let i = 1; i <= 6; i++) {
          const config = updateConstructor(avatarCatalog.defaultAvatar, {
            gender,
            build,
            hair: { male: i, female: i },
            eyes: i,
            mouth: i,
            faceFeatures: i === 6 ? [6, 7] : [i],
          });
          const sheet = await loadEditorReview(config, new AbortController().signal);
          const ctx = sheet.getContext('2d')!;
          if (build === 'average' && gender === 'female') {
            const crop = (row: number) =>
              [...ctx.getImageData(0, row * 128, 96, 64).data].join(',');
            hashes.add(crop(2));
            if (i === 1 || i === 4) independent &&= crop(1) !== crop(3);
          }
        }
    const config = updateConstructor(avatarCatalog.defaultAvatar, {
      hair: { male: 6, female: 6 },
      faceFeatures: [7],
    });
    const game = await loadAvatarSheet(avatarCatalog, config, new AbortController().signal);
    return { unique: hashes.size, independent, game: [game.width, game.height] };
  });
  expect(result).toEqual({ unique: 6, independent: true, game: [576, 512] });
  await page
    .getByRole('button', { name: 'Особенности лица: Веснушки по всему лицу', exact: true })
    .click();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.reload();
  await page.getByRole('tab', { name: 'Голова', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Особенности лица: Веснушки по всему лицу', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('different waistband heights preserve skin through alpha and long TOP covers BOTTOM through every pose', async ({
  page,
}) => {
  const root = await mkdtemp(path.join(tmpdir(), 'cf-waist-order-'));
  const repo = process.cwd();
  const run = () =>
    execFileSync(
      process.execPath,
      [
        path.join(repo, 'node_modules/tsx/dist/cli.mjs'),
        path.join(repo, 'scripts/import-character.ts'),
      ],
      { cwd: root, stdio: 'pipe' },
    );
  try {
    run();
    for (const [slot, rise] of [8, 16, 20].entries()) {
      const bottom = lowerFixture(46, false);
      for (let row = 0; row < 4; row++) {
        for (let y = 8; y < rise; y++)
          for (let x = 0; x < 80; x++)
            bottom.data.fill(0, ((row * 64 + y) * 80 + x) * 4, ((row * 64 + y) * 80 + x) * 4 + 4);
        rect(bottom, row, 64, 25, rise, 30, 2, [128, 128, 128, 255]);
      }
      await writeFile(
        path.join(root, `CHARACTER/bottoms/bottom_0${slot + 1}.png`),
        PNG.sync.write(bottom),
      );
    }
    for (const [slot, end] of [
      [1, 100],
      [2, 70],
    ] as const) {
      const top = new PNG({ width: 96, height: 448 });
      for (let row = 0; row < 4; row++)
        rect(top, row, 112, 38, 58, 20, end - 58, [44, 109, 155, 255]);
      await writeFile(path.join(root, `CHARACTER/tops/top_0${slot}.png`), PNG.sync.write(top));
    }
    await writeFile(
      path.join(root, 'CHARACTER/tops/ITEMS.md'),
      '| Файл | Материал |\n| --- | --- |\n| top_01.png | fixed |\n| top_02.png | fixed |\n',
    );
    run();
    const registry = JSON.parse(
      await readFile(path.join(root, 'content/avatars/modular/parts.json'), 'utf8'),
    );
    await page.route('**/content/avatars/modular/parts.json*', (r) =>
      r.fulfill({
        contentType: 'application/javascript',
        body: `export default ${JSON.stringify(registry)}`,
      }),
    );
    for (const d of registry) {
      const file = d.source.slice('/content/'.length);
      const bytes = await readFile(path.join(root, 'content/art', file));
      await page.route(`**/content/${file}`, (r) =>
        r.fulfill({ contentType: 'image/png', body: bytes }),
      );
    }
    await enterDemo(page);
    await page.goto('/#/avatar');
    const result = await page.evaluate(async () => {
      const { avatarCatalog } = await import(/* @vite-ignore */ String('/src/avatar/catalog.ts'));
      const { updateConstructor } = await import(
        /* @vite-ignore */ String('/src/avatar/editor.ts')
      );
      const { loadEditorReview } = await import(
        /* @vite-ignore */ String('/src/avatar/editorReview.ts')
      );
      const { reviewPose } = await import(/* @vite-ignore */ String('/src/avatar/editorMotion.ts'));
      let onTop = true,
        transparent = true;
      for (const gender of ['male', 'female'] as const)
        for (const build of ['very-slim', 'slim', 'average', 'sturdy'] as const)
          for (let bottom = 1; bottom <= 3; bottom++) {
            const c = updateConstructor(avatarCatalog.defaultAvatar, {
              gender,
              build,
              bottom,
              top: 1,
              special: null,
            });
            const sheet = await loadEditorReview(c, new AbortController().signal);
            for (const [row, dir] of [
              [0, 'north'],
              [2, 'south'],
            ] as const)
              for (let frame = 0; frame < 6; frame++) {
                const p = reviewPose(build, dir, frame, gender);
                const rgba = sheet
                  .getContext('2d')!
                  .getImageData(frame * 96 + 48, row * 128 + 87 + p.bob, 1, 1).data;
                onTop &&= [...rgba].join(',') === '44,109,155,255';
              }
            if (bottom === 3) {
              const short = await loadEditorReview(
                updateConstructor(c, { top: 2 }),
                new AbortController().signal,
              );
              const rgba = short.getContext('2d')!.getImageData(48, 2 * 128 + 76, 1, 1).data;
              const skin = [1, 3, 5].map((i) => parseInt(c.palette.skin.slice(i, i + 2), 16));
              transparent &&= skin.every((v, i) => rgba[i] === v) && rgba[3] === 255;
            }
          }
      return { onTop, transparent };
    });
    expect(result).toEqual({ onTop: true, transparent: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
