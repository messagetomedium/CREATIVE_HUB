import { test, expect } from '@playwright/test';
import { enterDemo } from './demoFixture';

test('all wardrobe items fit both genders/four builds and closed sleeves cover the approved arms', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enterDemo(page);
  await page.goto('/#/avatar');
  const result = await page.evaluate(async () => {
    const { avatarCatalog } = await import(/* @vite-ignore */ String('/src/avatar/catalog.ts'));
    const { updateWardrobe } = await import(/* @vite-ignore */ String('/src/avatar/wardrobe.ts'));
    const { loadEditorReview } = await import(
      /* @vite-ignore */ String('/src/avatar/editorReview.ts')
    );
    const { reviewPose } = await import(/* @vite-ignore */ String('/src/avatar/editorMotion.ts'));
    const bad: string[] = [];
    let count = 0;
    for (const gender of ['male', 'female'] as const)
      for (const build of ['very-slim', 'slim', 'average', 'sturdy'] as const)
        for (let top = 1; top <= 10; top++) {
          const c = updateWardrobe(avatarCatalog.defaultAvatar, {
            gender,
            build,
            top,
            bottom: ((top - 1) % 9) + 1,
            socks: top % 4,
            footwear: ((top - 1) % 5) + 1,
          });
          const sheet = await loadEditorReview(c, new AbortController().signal);
          count++;
          if (sheet.width !== 576 || sheet.height !== 512) bad.push('sheet-size');
          if ([3, 4].includes(top)) continue;
          const skin = [1, 3, 5].map((i) => parseInt(c.palette.skin.slice(i, i + 2), 16)),
            ctx = sheet.getContext('2d')!;
          for (const [row, dir] of [
            [0, 'north'],
            [2, 'south'],
          ] as const)
            for (let frame = 0; frame < 6; frame++) {
              const p = reviewPose(build, dir, frame, gender);
              for (const arm of p.arms) {
                const color = ctx.getImageData(
                  frame * 96 + Math.round(arm.root.x),
                  row * 128 + Math.round(arm.root.y + 6),
                  1,
                  1,
                ).data;
                if (skin.every((v, i) => v === color[i]))
                  bad.push(`${gender}/${build}/top${top}/${dir}/${frame}`);
              }
            }
        }
    return { count, bad };
  });
  expect(result.count).toBe(80);
  expect(result.bad).toEqual([]);
  expect(errors).toEqual([]);
});

test('tights expose skin, socks have independent lengths/colors and flats reveal the correct foot surface', async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto('/#/avatar');
  const result = await page.evaluate(async () => {
    const { avatarCatalog } = await import(/* @vite-ignore */ String('/src/avatar/catalog.ts'));
    const { updateWardrobe } = await import(/* @vite-ignore */ String('/src/avatar/wardrobe.ts'));
    const { loadParts } = await import(/* @vite-ignore */ String('/src/avatar/modular/assets.ts'));
    const { loadEditorReview } = await import(
      /* @vite-ignore */ String('/src/avatar/editorReview.ts')
    );
    const config = updateWardrobe(avatarCatalog.defaultAvatar, {
      bottom: 9,
      legwearTone: 'skin',
      top: 1,
      footwear: 4,
      socks: 0,
    });
    const skin = [1, 3, 5].map((i) => parseInt(config.palette.skin.slice(i, i + 2), 16));
    const series = [];
    for (let socks = 0; socks <= 3; socks++) {
      const c = updateWardrobe(config, {
        socks,
        colors: { ...config.customization!.colors, socks: '#a294bd' },
      });
      const sheet = await loadEditorReview(c, new AbortController().signal),
        ctx = sheet.getContext('2d')!;
      series.push([96, 102, 106].map((y) => [...ctx.getImageData(40, 256 + y, 1, 1).data]));
    }
    const parts = await loadParts(config, new AbortController().signal);
    const shoe = parts.find(
      (p: any) =>
        p.descriptor.parent === 'footLeft' &&
        p.descriptor.source &&
        p.descriptor.selection.field === 'footwear',
    )!;
    const base = parts.find((p: any) => p.descriptor.id === 'wardrobe-foot-underlay-0')!;
    const sd = shoe.descriptor,
      sc = shoe.image.getContext('2d')!,
      bc = base.image.getContext('2d')!,
      sheet = await loadEditorReview(config, new AbortController().signal);
    const holes: number[][] = [];
    for (let y = -2; y < 5; y++)
      for (let x = -6; x < 6; x++) {
        const b = bc.getImageData(20 + x, 2 * 24 + 12 + y, 1, 1).data;
        const sx = sd.anchor.x + x,
          sy = sd.anchor.y + y;
        const opaque =
          sx >= 0 &&
          sy >= 0 &&
          sx < sd.frameWidth &&
          sy < sd.frameHeight &&
          sc.getImageData(sx, 2 * sd.frameHeight + sy, 1, 1).data[3];
        if (skin.every((v, i) => v === b[i]) && !opaque)
          holes.push([...sheet.getContext('2d')!.getImageData(40 + x, 256 + 110 + y, 1, 1).data]);
      }
    const colored = await loadParts(
      updateWardrobe(config, {
        legwearTone: 'color',
        colors: { ...config.customization!.colors, bottom: '#7495a9' },
      }),
      new AbortController().signal,
    );
    const skinPixels = parts
      .filter((p: any) => p.descriptor.selection.field === 'bottom')
      .reduce(
        (n: number, p: any) =>
          n +
          [
            ...p.image.getContext('2d')!.getImageData(0, 0, p.image.width, p.image.height).data,
          ].filter((v: number, i: number) => i % 4 === 3 && v > 0).length,
        0,
      );
    const tint = colored
      .find((p: any) => p.descriptor.id === 'wardrobe-foot-underlay-0')!
      .image.getContext('2d')!
      .getImageData(20, 2 * 24 + 13, 1, 1).data;
    const combo = await loadParts(updateWardrobe(config, { top: 5 }), new AbortController().signal);
    const ivory = combo
      .filter((p: any) => p.descriptor.selection.field === 'top')
      .some((p: any) => {
        const d = p.image.getContext('2d')!.getImageData(0, 0, p.image.width, p.image.height).data;
        for (let at = 0; at < d.length; at += 4)
          if (d[at] === 241 && d[at + 1] === 233 && d[at + 2] === 216 && d[at + 3]) return true;
        return false;
      });
    return { series, holes, skin, skinPixels, tint: [...tint], ivory };
  });
  const isSkin = (p: number[]) => result.skin.every((v: number, i: number) => v === p[i]);
  expect(result.skinPixels).toBe(0);
  expect(result.holes.length).toBeGreaterThan(0);
  expect(result.holes.every(isSkin)).toBe(true);
  expect(result.series[0]!.every(isSkin)).toBe(true);
  expect(isSkin(result.series[1]![0]!)).toBe(true);
  expect(isSkin(result.series[1]![1]!)).toBe(true);
  expect(isSkin(result.series[2]![1]!)).toBe(false);
  expect(isSkin(result.series[3]![0]!)).toBe(false);
  expect(result.tint).toEqual([116, 149, 169, 255]);
  expect(result.ivory).toBe(true);
});

test('extended wardrobe choices survive further edits, save/reload and entering the factory', async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto('/#/avatar');
  await page.getByRole('tab', { name: 'Одежда', exact: true }).click();
  await expect(
    page.getByRole('group', { name: 'Верх', exact: true }).getByRole('button'),
  ).toHaveCount(10);
  await expect(
    page.getByRole('group', { name: 'Низ', exact: true }).getByRole('button'),
  ).toHaveCount(9);
  await expect(
    page.getByRole('group', { name: 'Обувь', exact: true }).getByRole('button'),
  ).toHaveCount(5);
  await page.getByRole('button', { name: 'Верх: Вариант 10', exact: true }).click();
  await page.getByRole('button', { name: 'Низ: Вариант 9', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Низ: Цвет тела', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Носки: Гольфы', exact: true }).click();
  await page.getByRole('button', { name: 'Цвет носков: вариант 11', exact: true }).click();
  await page.getByRole('button', { name: 'Обувь: Вариант 4', exact: true }).click();
  await page.getByRole('tab', { name: 'Тело', exact: true }).click();
  await page.getByRole('button', { name: 'Телосложение: Плотное', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page
    .getByText('Персонаж сохранён. Можно отправляться на завод.', { exact: true })
    .waitFor();
  await page.reload();
  await page.getByRole('tab', { name: 'Одежда', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Верх: Вариант 10', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Носки: Гольфы', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('link', { name: 'Войти на завод', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('canvas')).toBeVisible();
});
