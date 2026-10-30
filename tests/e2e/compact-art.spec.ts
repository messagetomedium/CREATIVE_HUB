import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';
import {
  topFixture,
  lowerFixture,
  hairFixture,
  shoesFixture,
  rect,
} from '../../scripts/character/compact-fixtures';
import { enterDemo } from './demoFixture';

test('compact real CLI sources fit approved editor on both genders/all builds without changing pixel walk', async ({
  page,
}) => {
  test.setTimeout(120000);
  const root = await mkdtemp(path.join(tmpdir(), 'cf-compact-browser-')),
    repo = process.cwd();
  const run = () =>
    execFileSync(
      process.execPath,
      [
        path.join(repo, 'node_modules/tsx/dist/cli.mjs'),
        path.join(repo, 'scripts/import-character.ts'),
      ],
      { cwd: root, stdio: 'pipe' },
    ).toString();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    run();
    const hair = hairFixture(),
      mask = new PNG({ width: 96, height: 448 });
    for (let at = 0; at < hair.data.length; at += 4)
      if (hair.data[at + 3]) mask.data.set([255, 0, 0, 255], at);
    const eyes = new PNG({ width: 64, height: 256 });
    rect(eyes, 0, 64, 22, 30, 4, 8, [26, 30, 39, 255]);
    rect(eyes, 0, 64, 38, 30, 4, 8, [26, 30, 39, 255]);
    const mouth = new PNG({ width: 64, height: 256 });
    rect(mouth, 0, 64, 30, 44, 4, 1, [180, 65, 75, 255]);
    const face = new PNG({ width: 64, height: 256 });
    rect(face, 0, 64, 22, 42, 5, 2, [184, 184, 184, 64]);
    rect(face, 0, 64, 40, 42, 5, 2, [184, 184, 184, 64]);
    const inputs = [
      ['hair', 'hair_f_06.png', hair],
      ['tops', 'top_06.png', topFixture(3)],
      ['bottoms', 'bottom_06.png', lowerFixture(32)],
      ['bottoms', 'bottom_05.png', lowerFixture(58, false)],
      ['bottoms', 'skirt_04.png', lowerFixture(58, true, true)],
      ['footwear', 'shoes_06.png', shoesFixture()],
      ['eyes', 'eyes_06.png', eyes],
      ['mouth', 'mouth_06.png', mouth],
      ['face_features', 'face_05.png', face],
    ] as const;
    const originals = new Map<string, Buffer>();
    for (const [category, name, image] of inputs) {
      const bytes = PNG.sync.write(image),
        file = path.join(root, 'CHARACTER', category, name);
      await writeFile(file, bytes);
      originals.set(file, bytes);
    }
    await writeFile(path.join(root, 'CHARACTER/hair/hair_mask.png'), PNG.sync.write(mask));
    await writeFile(
      path.join(root, 'CHARACTER/hair/ITEMS.md'),
      '| Файл | Маска |\n| --- | --- |\n| hair_f_06.png | hair_mask.png |\n',
    );
    expect(run()).toContain('обновлено 9');
    const registry = JSON.parse(
      await readFile(path.join(root, 'content/avatars/modular/parts.json'), 'utf8'),
    );
    const manifest = JSON.parse(
      await readFile(path.join(root, 'content/avatars/modular/import-manifest.json'), 'utf8'),
    );
    await page.route('**/content/avatars/modular/parts.json*', (r) =>
      r.fulfill({
        contentType: 'application/javascript',
        body: `export default ${JSON.stringify(registry)}`,
      }),
    );
    await page.route('**/content/avatars/modular/import-manifest.json*', (r) =>
      r.fulfill({
        contentType: 'application/javascript',
        body: `export default ${JSON.stringify(manifest)}`,
      }),
    );
    for (const item of manifest.items)
      for (const file of item.files) {
        const bytes = await readFile(path.join(root, 'content/art', file));
        await page.route(`**/content/${file}`, (r) =>
          r.fulfill({ contentType: 'image/png', body: bytes }),
        );
      }
    await enterDemo(page);
    await page.goto('/#/avatar');
    await page.getByRole('button', { name: 'Пол и возраст: Женщина', exact: true }).click();
    const result = await page.evaluate(async () => {
      const { loadEditorReview } = await import(
        /* @vite-ignore */ String('/src/avatar/editorReview.ts')
      );
      const { loadAvatarSheet } = await import(/* @vite-ignore */ String('/src/avatar/art.ts'));
      const { avatarCatalog } = await import(/* @vite-ignore */ String('/src/avatar/catalog.ts'));
      const { updateConstructor } = await import(
        /* @vite-ignore */ String('/src/avatar/editor.ts')
      );
      const { reviewPose } = await import(/* @vite-ignore */ String('/src/avatar/editorMotion.ts'));
      const contact = document.createElement('canvas');
      contact.width = 768;
      contact.height = 512;
      const ctx = contact.getContext('2d')!;
      ctx.fillStyle = '#ede4d8';
      ctx.fillRect(0, 0, 768, 512);
      let stationary = true,
        joins = true,
        calves = true;
      const builds = ['very-slim', 'slim', 'average', 'sturdy'] as const;
      let sampleHair: number[] = [];
      for (const [g, gender] of (['male', 'female'] as const).entries())
        for (const [b, build] of builds.entries()) {
          const config = updateConstructor(avatarCatalog.defaultAvatar, {
            gender,
            build,
            top: 6,
            bottom: 6,
            footwear: 6,
            hair: { male: 6, female: 6 },
            eyes: 6,
            mouth: 6,
            faceFeatures: [5],
            special: null,
            hat: null,
            jewelry: null,
          });
          const sheet = await loadEditorReview(config, new AbortController().signal),
            sc = sheet.getContext('2d')!;
          for (let row = 0; row < 4; row++)
            ctx.drawImage(sheet, 0, row * 128, 96, 128, g * 384 + row * 96, b * 128, 96, 128);
          for (const [row, dir] of (['north', 'east', 'south', 'west'] as const).entries())
            for (let frame = 2; frame < 6; frame++) {
              const ref = sc.getImageData(0, row * 128, 96, 50).data,
                head = sc.getImageData(frame * 96, row * 128, 96, 50).data;
              if (!ref.every((v: number, i: number) => v === head[i])) stationary = false;
              const p = reviewPose(build, dir, frame, gender),
                skin = [1, 3, 5].map((i) => parseInt(config.palette.skin.slice(i, i + 2), 16));
              const at = (x: number, y: number) => [
                ...sc.getImageData(frame * 96 + x, row * 128 + y, 1, 1).data,
              ];
              for (const arm of p.arms)
                for (let y = 70; y <= 85; y++) {
                  const pixel = at(arm.root.x, y + p.bob);
                  if (pixel.slice(0, 3).every((v, i) => v === skin[i]) && !p.side) joins = false;
                }
              if (!p.side)
                for (const leg of p.legs) {
                  const pixel = at(leg.root.x, 100);
                  if (!pixel.slice(0, 3).every((v, i) => v === skin[i])) calves = false;
                }
            }
          if (gender === 'female' && build === 'average')
            sampleHair = [...sc.getImageData(48, 2 * 128 + 60, 1, 1).data];
        }
      const cfg = updateConstructor(avatarCatalog.defaultAvatar, {
        gender: 'female',
        build: 'average',
        top: 6,
        bottom: 5,
        footwear: 6,
        hair: { male: 6, female: 6 },
        special: null,
      });
      const legacy = await loadAvatarSheet(avatarCatalog, cfg, new AbortController().signal);
      const skirt = await loadEditorReview(
        updateConstructor(cfg, { bottom: 4 }),
        new AbortController().signal,
      );
      const walking = await loadEditorReview(
        updateConstructor(cfg, { build: 'very-slim', bottom: 6 }),
        new AbortController().signal,
      );
      const strip = document.createElement('canvas');
      strip.width = 384;
      strip.height = 128;
      const wc = strip.getContext('2d')!;
      for (let f = 0; f < 4; f++)
        wc.drawImage(walking, (f + 2) * 96, 3 * 128, 96, 128, f * 96, 0, 96, 128);
      return {
        stationary,
        joins,
        calves,
        legacy: { width: legacy.width, height: legacy.height },
        skirt: { width: skirt.width, height: skirt.height },
        sampleHair,
        expectedHair: cfg.palette.hair,
        contact: contact.toDataURL().split(',')[1]!,
        walk: strip.toDataURL().split(',')[1]!,
      };
    });
    expect(result.stationary).toBe(true);
    expect(result.joins).toBe(true);
    expect(result.calves).toBe(true);
    expect(result.legacy).toEqual({ width: 576, height: 512 });
    expect(result.skirt).toEqual({ width: 576, height: 512 });
    expect(result.sampleHair).toEqual([
      ...[1, 3, 5].map((i) => parseInt(result.expectedHair.slice(i, i + 2), 16)),
      255,
    ]);
    await mkdir('.cache/compact-review', { recursive: true });
    await writeFile('.cache/compact-review/fit-all.png', Buffer.from(result.contact, 'base64'));
    await writeFile('.cache/compact-review/walk-west.png', Buffer.from(result.walk, 'base64'));
    await page.getByRole('tab', { name: 'Голова', exact: true }).click();
    await page.getByRole('button', { name: 'Причёска: Женская 6', exact: true }).click();
    await page.getByRole('tab', { name: 'Одежда', exact: true }).click();
    await page.getByRole('button', { name: 'Верх: Вариант 6', exact: true }).click();
    await page.getByRole('button', { name: 'Низ: Вариант 6', exact: true }).click();
    await page.getByRole('button', { name: 'Обувь: Вариант 6', exact: true }).click();
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Пол и возраст: Женщина', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('tab', { name: 'Одежда', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Верх: Вариант 6', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('link', { name: /Войти на завод/ }).click();
    await expect(page.getByTestId('current-zone')).toHaveText('Мой остров');
    expect(errors).toEqual([]);
    for (const [file, bytes] of originals) expect(await readFile(file)).toEqual(bytes);
    expect(run()).toContain('обновлено 0');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
