import { createHash } from 'node:crypto';
import { readFile, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import path from 'node:path';
import { tmpdir } from 'node:os';
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
  catalog.sprite.frameWidth = 48;
  catalog.sprite.frameHeight = 64;
  catalog.sprite.anchor = { x: 24, y: 56 };
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

test('2× rig shares head, keeps fixed palms/feet, differentiates actual limb pixels and bounds cache', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { loadAvatarSheet, assemblyStats } = await import(
      /* @vite-ignore */ String('/src/avatar/art.ts')
    );
    const { avatarCatalog } = await import(/* @vite-ignore */ String('/src/avatar/catalog.ts'));
    const { updateConstructor } = await import(/* @vite-ignore */ String('/src/avatar/editor.ts'));
    const { pose } = await import(/* @vite-ignore */ String('/src/avatar/modular/rig.ts'));
    const { assemble, renderBaseModule } = await import(
      /* @vite-ignore */ String('/src/avatar/modular/render.ts')
    );
    const heads = [],
      hands = [],
      feet = [],
      arms = [],
      legs = [],
      phases = [];
    const config = updateConstructor(avatarCatalog.defaultAvatar, {
      gender: 'female',
      hair: { male: 1, female: 1 },
      special: null,
    });
    for (const build of ['slim', 'average', 'sturdy'] as const) {
      const p = pose(build, 'south', 0),
        sheet = assemble(updateConstructor(config, { build }), { bodyOnly: true });
      heads.push([...sheet.getContext('2d')!.getImageData(28, 270, 40, 40).data]);
      const module = (name: string) => {
        const c = document.createElement('canvas');
        c.width = 96;
        c.height = 128;
        renderBaseModule(c.getContext('2d')!, p, name, [
          '#352b35',
          '#555555',
          '#888888',
          '#bbbbbb',
          '#eeeeee',
        ]);
        return c;
      };
      hands.push([
        ...module('handLeft')
          .getContext('2d')!
          .getImageData(p.hands[0]!.x - 8, p.hands[0]!.y - 4, 16, 20).data,
      ]);
      feet.push([
        ...module('footLeft')
          .getContext('2d')!
          .getImageData(p.feet[0]!.x - 12, p.feet[0]!.y - 8, 24, 16).data,
      ]);
      const width = (name: string, y: number) =>
        [...module(name).getContext('2d')!.getImageData(0, y, 96, 1).data]
          .filter((_, i) => i % 4 === 3)
          .filter(Boolean).length;
      arms.push(width('armLeft', 64));
      legs.push(width('legLeft', 87));
      for (let f = 0; f < 6; f++) {
        const q = pose(build, 'east', f);
        phases.push({
          build,
          frame: f,
          shoulder: q.arms[0]!.root,
          relative: q.arms[0]!.root.y - q.torso.y,
        });
      }
    }
    for (let i = 0; i < 8; i++) {
      const c = structuredClone(config);
      c.palette.outfit = '#' + (0x551100 + i).toString(16);
      await loadAvatarSheet(avatarCatalog, c, new AbortController().signal);
    }
    const a = await loadAvatarSheet(avatarCatalog, config, new AbortController().signal),
      b = await loadAvatarSheet(
        avatarCatalog,
        { ...config, revision: 90 },
        new AbortController().signal,
      );
    return {
      heads,
      hands,
      feet,
      arms,
      legs,
      phases,
      same: a === b,
      size: [a.width, a.height],
      stats: assemblyStats(),
    };
  });
  expect(result.size).toEqual([576, 512]);
  expect(result.same).toBe(true);
  expect(result.stats.entries).toBeLessThanOrEqual(4);
  for (const list of [result.heads, result.hands, result.feet]) {
    expect(list[0]).toEqual(list[1]);
    expect(list[1]).toEqual(list[2]);
  }
  for (const list of [result.arms, result.legs]) {
    expect(list[0]!).toBeLessThan(list[1]!);
    expect(list[1]!).toBeLessThan(list[2]!);
  }
  expect(new Set(result.phases.map((p) => p.relative)).size).toBe(1);
});

test('native imported sleeve/glove/shoe use the same moving pivots as template geometry', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { attachPart } = await import(/* @vite-ignore */ String('/src/avatar/modular/render.ts'));
    const { pose } = await import(/* @vite-ignore */ String('/src/avatar/modular/rig.ts'));
    const { SOURCE_TEMPLATES, templateDescriptor } = await import(
      /* @vite-ignore */ String('/src/avatar/modular/templates.ts')
    );
    const out = [];
    for (const id of ['sleeve', 'glove', 'shoe']) {
      const t = SOURCE_TEMPLATES.find((t: { id: string }) => t.id === id)!,
        d = templateDescriptor(t),
        image = document.createElement('canvas');
      image.width = t.width;
      image.height = t.height * 4;
      const ctx = image.getContext('2d')!;
      ctx.fillStyle = '#ff00ff';
      for (let r = 0; r < 4; r++) ctx.fillRect(t.anchor.x - 1, r * t.height + t.anchor.y - 1, 3, 3);
      for (let frame = 0; frame < 6; frame++) {
        const p = pose('average', 'east', frame),
          canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 128;
        attachPart(canvas.getContext('2d')!, p, { descriptor: d, image });
        const parent =
          id === 'sleeve' ? p.arms[0]!.root : id === 'glove' ? p.hands[0]! : p.feet[0]!;
        out.push([...canvas.getContext('2d')!.getImageData(parent.x, parent.y, 1, 1).data]);
      }
    }
    return out;
  });
  expect(result).toHaveLength(18);
  for (const pixel of result) expect(pixel).toEqual([255, 0, 255, 255]);
});

test('canonical neck has dark side lines and no bottom border', async ({ page }) => {
  await page.goto('/');
  const pixels = await page.evaluate(async () => {
    const { renderNeck } = await import(/* @vite-ignore */ String('/src/avatar/modular/render.ts'));
    const { pose } = await import(/* @vite-ignore */ String('/src/avatar/modular/rig.ts'));
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 128;
    renderNeck(c.getContext('2d')!, pose('average', 'south', 0), [
      '#202020',
      '#505050',
      '#808080',
      '#b8b8b8',
      '#f0f0f0',
    ]);
    return [44, 51, 48].map((x, i) => [
      ...c.getContext('2d')!.getImageData(x, i === 2 ? 62 : 55, 1, 1).data,
    ]);
  });
  expect(pixels).toEqual([
    [32, 32, 32, 255],
    [32, 32, 32, 255],
    [184, 184, 184, 255],
  ]);
});

test('editor native/A24 and all four legacy hair views survive 2× body conversion', async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto('/#/avatar');
  await page.getByRole('button', { name: 'Пол и возраст: Женщина', exact: true }).click();
  await page.getByRole('tab', { name: 'Голова', exact: true }).click();
  const images = [];
  for (let slot = 1; slot <= 4; slot++) {
    await page.getByRole('button', { name: `Причёска: Женская ${slot}`, exact: true }).click();
    await page.waitForTimeout(80);
    images.push(
      await page
        .locator('.avatar-stage canvas')
        .evaluate((c) => (c as HTMLCanvasElement).toDataURL()),
    );
  }
  expect(new Set(images).size).toBe(4);
  await page.locator('summary').filter({ hasText: 'Проверка графики' }).click();
  await page.getByRole('button', { name: '1×', exact: true }).click();
  await expect(page.locator('.avatar-stage canvas')).toHaveAttribute('width', '96');
  await page.getByRole('button', { name: 'A24', exact: true }).click();
  await expect(page.locator('.avatar-stage canvas')).toHaveAttribute('width', '576');
  await page.setViewportSize({ width: 390, height: 1000 });
  const bounds = await page.locator('.avatar-stage canvas').boundingBox();
  expect(bounds!.width / bounds!.height).toBeCloseTo(576 / 512, 2);
});

test('whole-source PNGs enter slots through the real CLI without touching repository originals', async ({
  page,
}) => {
  test.setTimeout(90000);
  const root = await mkdtemp(path.join(tmpdir(), 'cf-browser-art-')),
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
  const inputs: { name: string; category: string; bytes: Buffer }[] = [];
  const hair = new PNG({ width: 96, height: 448 });
  for (let r = 0; r < 4; r++)
    for (let y = 14; y < 27; y++)
      for (let x = 31; x < 65; x++) {
        const value = y === 14 || y === 26 || x === 31 || x === 64 ? 32 : 184;
        hair.data.set([value, value, value, 255], ((r * 112 + y) * 96 + x) * 4);
      }
  inputs.push({
    name: 'hair_long_female_full_06.png',
    category: 'hair',
    bytes: PNG.sync.write(hair),
  });
  const lower = new PNG({ width: 80, height: 256 });
  for (let r = 0; r < 4; r++)
    for (let y = 10; y < 32; y++)
      for (let x = 26; x < 54; x++) {
        if (y >= 16 && y < 18) continue;
        if (y >= 24 && (r === 0 || r === 2 ? x >= 36 && x < 44 : x < 34 || x >= 48)) continue;
        lower.data.set([184, 184, 184, 255], ((r * 64 + y) * 80 + x) * 4);
      }
  inputs.push({
    name: 'pants_high_full_06.png',
    category: 'bottoms',
    bytes: PNG.sync.write(lower),
  });
  const eyes = new PNG({ width: 64, height: 64 });
  for (let y = 30; y < 38; y++)
    for (const start of [22, 38])
      for (let x = start; x < start + 4; x++)
        eyes.data.set(start === 22 ? [88, 22, 44, 255] : [22, 99, 44, 255], (y * 64 + x) * 4);
  inputs.push({ name: 'eyes_basic_front_06.png', category: 'eyes', bytes: PNG.sync.write(eyes) });
  const mouth = new PNG({ width: 64, height: 64 });
  for (let x = 30; x < 35; x++) mouth.data.set([188, 77, 99, 255], (44 * 64 + x) * 4);
  inputs.push({
    name: 'mouth_basic_front_06.png',
    category: 'mouth',
    bytes: PNG.sync.write(mouth),
  });
  const face = new PNG({ width: 64, height: 64 });
  for (const x of [22, 40]) face.data.set([184, 184, 184, 64], (42 * 64 + x) * 4);
  inputs.push({
    name: 'face_detail_front_05.png',
    category: 'face_features',
    bytes: PNG.sync.write(face),
  });
  try {
    run();
    for (const input of inputs)
      await writeFile(path.join(root, 'CHARACTER', input.category, input.name), input.bytes);
    expect(run()).toContain('обновлено 5');
    const registry = JSON.parse(
      await readFile(path.join(root, 'content/avatars/modular/parts.json'), 'utf8'),
    );
    const manifest = JSON.parse(
      await readFile(path.join(root, 'content/avatars/modular/import-manifest.json'), 'utf8'),
    );
    await page.route(/\/content\/avatars\/modular\/parts\.json(?:\?.*)?$/, (r) =>
      r.fulfill({
        contentType: 'application/javascript',
        body: 'export default ' + JSON.stringify(registry) + ';',
      }),
    );
    await page.route(/\/content\/avatars\/modular\/import-manifest\.json(?:\?.*)?$/, (r) =>
      r.fulfill({
        contentType: 'application/javascript',
        body: 'export default ' + JSON.stringify(manifest) + ';',
      }),
    );
    await page.route(/\/content\/character-(?:thumb-)?[a-f0-9]{20}\.png$/, async (r) =>
      r.fulfill({
        contentType: 'image/png',
        body: await readFile(
          path.join(root, 'content/art', path.basename(new URL(r.request().url()).pathname)),
        ),
      }),
    );
    await enterDemo(page);
    await page.goto('/#/avatar');
    await page.getByRole('button', { name: 'Пол и возраст: Женщина', exact: true }).click();
    await page.getByRole('tab', { name: 'Голова', exact: true }).click();
    const button = page.getByRole('button', { name: 'Причёска: Женская 6', exact: true });
    await expect(button).toBeEnabled();
    await expect(button.locator('img')).toHaveCount(1);
    await button.click();
    await page.getByRole('button', { name: 'Глаза: Вариант 6', exact: true }).click();
    await page.getByRole('button', { name: 'Рот: Вариант 6', exact: true }).click();
    await page.getByRole('button', { name: 'Особенности лица: Румянец', exact: true }).click();
    await page.getByRole('tab', { name: 'Одежда', exact: true }).click();
    await page.getByRole('button', { name: 'Низ: Вариант 6', exact: true }).click();
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await page.getByRole('link', { name: /Войти на завод/ }).click();
    await expect(page.getByTestId('current-zone')).toHaveText('Центральный холл');
    const config = (await page.evaluate(() => window.__CF_DEBUG__!.snapshot())).avatar
      .customization!;
    expect(config.hair.female).toBe(6);
    expect(config.bottom).toBe(6);
    expect(config.eyes).toBe(6);
    expect(config.mouth).toBe(6);
    expect(config.faceFeatures).toContain(5);
    expect(run()).toContain('обновлено 0');
    for (const input of inputs)
      expect(await readFile(path.join(root, 'CHARACTER', input.category, input.name))).toEqual(
        input.bytes,
      );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('DPR 1 and 2 keep 48×64 world size, feet origin, crisp sampling and bounded camera after resize', async ({
  browser,
}) => {
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: dpr,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto('http://127.0.0.1:5180');
      await page.getByRole('button', { name: 'Войти в деморежим', exact: true }).click();
      await page.goto('http://127.0.0.1:5180/#/factory');
      await expect(page.getByTestId('current-zone')).toHaveText('Центральный холл');
      await page.waitForFunction(() => (window.__CF_DEBUG__?.snapshot().tick ?? 0) > 4);
      for (const viewport of [
        { width: 1440, height: 1000 },
        { width: 900, height: 820 },
      ]) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(120);
        const result = await page.evaluate(() => {
          const c = document.querySelector('canvas')!,
            s = window.__CF_DEBUG__!.snapshot();
          return {
            rendering: s.rendering,
            ratio: c.width / c.getBoundingClientRect().width,
            smoothing: c.getContext('2d')!.imageSmoothingEnabled,
          };
        });
        expect(result.rendering.worldSize).toEqual({ width: 48, height: 64 });
        expect(result.rendering.origin).toEqual({ x: 0.5, y: 0.875 });
        expect(result.rendering.pixelRatio).toBe(dpr);
        expect(result.ratio).toBeCloseTo(dpr, 1);
        expect(result.rendering.avatarFilter).toBe(1);
      }
      await page.screenshot({ path: `.cache/character-review/dpr-${dpr}.png` });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }
});

test('editor approval body has two pixel contours, rigid breathing hair and equal front trouser colors', async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto('/#/avatar');
  await expect(page.locator('.preview-direction')).toHaveCount(0);
  const result = await page.evaluate(async () => {
    const { loadEditorReview } = await import(
      /* @vite-ignore */ String('/src/avatar/editorReview.ts')
    );
    const { avatarCatalog } = await import(/* @vite-ignore */ String('/src/avatar/catalog.ts'));
    const { updateConstructor } = await import(/* @vite-ignore */ String('/src/avatar/editor.ts'));
    const s = await loadEditorReview(
      updateConstructor(avatarCatalog.defaultAvatar, {
        gender: 'female',
        hair: { male: 1, female: 1 },
        special: null,
      }),
      new AbortController().signal,
    );
    const ctx = s.getContext('2d')!;
    const pixel = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
    let headDifferences = 0,
      legDifferences = 0;
    for (let y = 0; y < 53; y++)
      for (let x = 0; x < 96; x++)
        if (String(pixel(x, 256 + y)) !== String(pixel(96 + x, 256 + y + 1))) headDifferences++;
    // The longer arms breathe with the torso through y=95; sample below the fists.
    for (let y = 96; y < 116; y++)
      for (let x = 0; x < 96; x++)
        if (String(pixel(x, 256 + y)) !== String(pixel(96 + x, 256 + y))) legDifferences++;
    const male = await loadEditorReview(
      updateConstructor(avatarCatalog.defaultAvatar, { gender: 'male', special: null }),
      new AbortController().signal,
    );
    const mc = male.getContext('2d')!;
    const edge = [28, 29, 30].map((x) => [...mc.getImageData(x, 256 + 28, 1, 1).data]);
    return {
      headDifferences,
      legDifferences,
      left: pixel(40, 356),
      right: pixel(56, 356),
      edge,
    };
  });
  expect(result.headDifferences).toBe(0);
  expect(result.legDifferences).toBe(0);
  expect(result.left).toEqual(result.right);
  expect(result.edge[0]).toEqual([53, 43, 53, 255]);
  expect(result.edge[1]).toEqual(result.edge[0]);
  expect(result.edge[2]).not.toEqual(result.edge[0]);
});

test('authoring rig only shifts cached textures and keeps front/back height equal', async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto('/#/avatar');
  const result = await page.evaluate(async () => {
    const { createEditorRig, loadEditorReview } = await import(
      /* @vite-ignore */ String('/src/avatar/editorReview.ts')
    );
    const { avatarCatalog } = await import(/* @vite-ignore */ String('/src/avatar/catalog.ts'));
    const { updateConstructor } = await import(/* @vite-ignore */ String('/src/avatar/editor.ts'));
    const config = updateConstructor(avatarCatalog.defaultAvatar, {
      gender: 'female',
      hair: { female: 1, male: 1 },
      special: null,
    });
    const rig = await createEditorRig(config, new AbortController().signal);
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    let rasterCalls = 0;
    const images = new Set<CanvasImageSource>();
    const original = ctx.drawImage.bind(ctx);
    ctx.drawImage = ((...args: Parameters<CanvasRenderingContext2D['drawImage']>) => {
      images.add(args[0]);
      return original(...args);
    }) as typeof ctx.drawImage;
    ctx.fillRect = () => {
      rasterCalls++;
    };
    ctx.putImageData = () => {
      rasterCalls++;
    };
    for (let i = 0; i < 120; i++) {
      ctx.clearRect(0, 0, 96, 128);
      rig.draw(ctx, 'east', 'walk', i / 60);
    }
    const sourceCount = images.size;
    for (let i = 120; i < 240; i++) {
      ctx.clearRect(0, 0, 96, 128);
      rig.draw(ctx, 'east', 'walk', i / 60);
    }
    const sameSources = images.size === sourceCount;
    const heights = [];
    for (const slot of [1, 2, 3, 4]) {
      const sheet = await loadEditorReview(
        updateConstructor(config, { hair: { female: slot, male: 1 } }),
        new AbortController().signal,
      );
      const s = sheet.getContext('2d')!;
      heights.push(
        [0, 2].map((row) => {
          const data = s.getImageData(0, row * 128, 96, 128).data;
          let top = 128,
            bottom = 0;
          for (let y = 0; y < 128; y++)
            for (let x = 0; x < 96; x++)
              if (data[(y * 96 + x) * 4 + 3]) {
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
              }
          return bottom - top;
        }),
      );
    }
    return {
      rasterCalls,
      sameSources,
      sourceCount,
      heights,
      transform: ctx.getTransform().isIdentity,
    };
  });
  expect(result.rasterCalls).toBe(0);
  expect(result.sameSources).toBe(true);
  expect(result.sourceCount).toBeGreaterThan(8);
  expect(result.transform).toBe(true);
  for (const [back, front] of result.heights) expect(back).toBe(front);
});

test('editor plays baked pixel frames with pauses and equal front/profile ears', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __sheetCalls: { width: number; height: number; x: number; y: number }[];
    };
    w.__sheetCalls = [];
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof draw>
    ) {
      if (this.canvas instanceof HTMLCanvasElement && this.canvas.matches('.avatar-stage canvas')) {
        const image = args[0];
        w.__sheetCalls.push({
          width: image instanceof HTMLCanvasElement ? image.width : 0,
          height: image instanceof HTMLCanvasElement ? image.height : 0,
          x: args[1],
          y: args[2],
        });
      }
      return draw.apply(this, args);
    } as typeof draw;
  });
  await enterDemo(page);
  await page.goto('/#/avatar');
  await expect(page.locator('.avatar-stage canvas')).toHaveAttribute(
    'data-playback',
    'spritesheet',
  );
  await expect(page.locator('.avatar-stage canvas')).toHaveAttribute('data-frame', /\d+/);
  await page.evaluate(() => {
    (window as unknown as { __sheetCalls: unknown[] }).__sheetCalls = [];
  });
  await page.waitForTimeout(600);
  const idle = await page.evaluate(
    () => (window as unknown as { __sheetCalls: unknown[] }).__sheetCalls.length,
  );
  expect(idle).toBeGreaterThanOrEqual(1);
  expect(idle).toBeLessThanOrEqual(2);
  await page.evaluate(() => {
    (window as unknown as { __sheetCalls: unknown[] }).__sheetCalls = [];
  });
  await page.getByRole('button', { name: 'Идёт', exact: true }).click();
  await page.waitForTimeout(650);
  const calls = await page.evaluate(
    () =>
      (
        window as unknown as {
          __sheetCalls: { width: number; height: number; x: number; y: number }[];
        }
      ).__sheetCalls,
  );
  expect(calls.length).toBeGreaterThanOrEqual(4);
  expect(calls.length).toBeLessThanOrEqual(7);
  expect(calls.every((c) => c.width === 576 && c.height === 512)).toBe(true);
  expect(new Set(calls.map((c) => `${c.x},${c.y}`)).size).toBe(4);
  await page.getByRole('button', { name: 'Повернуть влево', exact: true }).click();
  await expect(page.locator('.avatar-stage canvas')).toHaveAttribute('data-direction', 'west');
  await page.getByRole('button', { name: 'Повернуть вправо', exact: true }).click();
  await expect(page.locator('.avatar-stage canvas')).toHaveAttribute('data-direction', 'south');
  const ears = await page.evaluate(async () => {
    const { loadEditorReview } = await import(
      /* @vite-ignore */ String('/src/avatar/editorReview.ts')
    );
    const { avatarCatalog } = await import(/* @vite-ignore */ String('/src/avatar/catalog.ts'));
    const { updateConstructor } = await import(/* @vite-ignore */ String('/src/avatar/editor.ts'));
    const s = await loadEditorReview(
      updateConstructor(avatarCatalog.defaultAvatar, {
        gender: 'male',
        hair: { male: 1, female: 1 },
        special: null,
      }),
      new AbortController().signal,
    );
    const ctx = s.getContext('2d')!;
    return {
      front: [...ctx.getImageData(23, 256 + 33, 5, 10).data],
      side: [...ctx.getImageData(40, 128 + 33, 5, 10).data],
    };
  });
  // Profile corners contain head pixels; compare the actual ear silhouette only.
  for (let i = 0; i < ears.front.length; i += 4)
    if (ears.front[i + 3]) expect(ears.side.slice(i, i + 4)).toEqual(ears.front.slice(i, i + 4));
});

test('four authored asymmetrical views survive editor turns and profile walking skips the far arm', async ({
  page,
}) => {
  const hairColors = [
    [211, 11, 11, 255],
    [11, 211, 11, 255],
    [11, 11, 211, 255],
    [211, 11, 211, 255],
  ];
  const topColors = [
    [240, 100, 10, 255],
    [10, 170, 200, 255],
    [100, 80, 220, 255],
    [240, 140, 200, 255],
  ];
  const hair = new PNG({ width: 96, height: 512 }),
    top = new PNG({ width: 32, height: 160 });
  for (let row = 0; row < 4; row++) {
    for (let y = 16; y < 23; y++)
      for (let x = 34 + row * 6; x < 40 + row * 6; x++)
        hair.data.set(hairColors[row]!, ((row * 128 + y) * 96 + x) * 4);
    for (let y = 22; y < 29; y++)
      for (let x = [14, 22, 14, 8][row]!; x < [14, 22, 14, 8][row]! + 7; x++)
        top.data.set(topColors[row]!, ((row * 40 + y) * 32 + x) * 4);
  }
  const registry = [
    {
      id: 'asym-head-test',
      parent: 'head',
      pass: 'front',
      material: 'fixed',
      source: '/content/asym-hair-test.png',
      frameWidth: 96,
      frameHeight: 128,
      anchor: { x: 48, y: 34 },
      offset: { x: 0, y: 0 },
      fit: 'head',
      sync: 'head',
      selection: { field: 'hair', slot: 1, gender: 'female' },
    },
    {
      id: 'asym-top-test',
      parent: 'torso',
      pass: 'front',
      material: 'fixed',
      source: '/content/asym-top-test.png',
      frameWidth: 32,
      frameHeight: 40,
      anchor: { x: 16, y: 14 },
      offset: { x: 0, y: 0 },
      fit: 'fixed',
      sync: 'body',
      selection: { field: 'top', slot: 1 },
    },
  ];
  await page.route(/\/content\/avatars\/modular\/parts\.json(?:\?.*)?$/, (r) =>
    r.fulfill({
      contentType: 'application/javascript',
      body: 'export default ' + JSON.stringify(registry) + ';',
    }),
  );
  await page.route('**/content/asym-hair-test.png', (r) =>
    r.fulfill({ contentType: 'image/png', body: PNG.sync.write(hair) }),
  );
  await page.route('**/content/asym-top-test.png', (r) =>
    r.fulfill({ contentType: 'image/png', body: PNG.sync.write(top) }),
  );
  await enterDemo(page);
  await page.goto('/#/avatar');
  await page.getByRole('button', { name: 'Пол и возраст: Женщина', exact: true }).click();
  await page.getByRole('tab', { name: 'Голова', exact: true }).click();
  await page.getByRole('button', { name: 'Причёска: Женская 1', exact: true }).click();
  await page.getByText('Проверка графики', { exact: true }).click();
  await page.getByRole('button', { name: '1×', exact: true }).click();
  const view = page.locator('.avatar-stage canvas');
  for (const [direction, row] of [
    ['south', 2],
    ['west', 3],
    ['north', 0],
    ['east', 1],
  ] as const) {
    await expect(view).toHaveAttribute('data-direction', direction);
    await expect
      .poll(() =>
        view.evaluate(
          (c, row) => [
            ...(c as HTMLCanvasElement).getContext('2d')!.getImageData(37 + row * 6, 19, 1, 1).data,
          ],
          row,
        ),
      )
      .toEqual(hairColors[row]);
    await expect
      .poll(() =>
        view.evaluate(
          (c, sampleX) => [
            ...(c as HTMLCanvasElement).getContext('2d')!.getImageData(sampleX, 82, 1, 1).data,
          ],
          [49, 57, 49, 43][row]!,
        ),
      )
      .toEqual(topColors[row]);
    await page.getByRole('button', { name: 'Повернуть влево', exact: true }).click();
  }
  const counts = await page.evaluate(async () => {
    const { createEditorRig } = await import(
      /* @vite-ignore */ String('/src/avatar/editorReview.ts')
    );
    const { avatarCatalog } = await import(/* @vite-ignore */ String('/src/avatar/catalog.ts'));
    const { updateConstructor } = await import(/* @vite-ignore */ String('/src/avatar/editor.ts'));
    const rig = await createEditorRig(
      updateConstructor(avatarCatalog.defaultAvatar, {
        gender: 'female',
        hair: { female: 1, male: 1 },
        special: null,
      }),
      new AbortController().signal,
    );
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    let count = 0;
    const original = ctx.drawImage.bind(ctx);
    ctx.drawImage = ((...args: Parameters<typeof ctx.drawImage>) => {
      count++;
      return original(...args);
    }) as typeof ctx.drawImage;
    const values = [];
    for (const dir of ['east', 'west'] as const)
      for (const mode of ['idle', 'walk'] as const) {
        count = 0;
        rig.draw(ctx, dir, mode, 0);
        values.push(count);
      }
    return values;
  });
  expect(counts).toEqual([11, 9, 11, 9]);
});

test('rear palms render behind sleeves and attached arm placement is restored by default', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { createEditorRig } = await import(
      /* @vite-ignore */ String('/src/avatar/editorReview.ts')
    );
    const { avatarCatalog } = await import(/* @vite-ignore */ String('/src/avatar/catalog.ts'));
    const { updateConstructor } = await import(/* @vite-ignore */ String('/src/avatar/editor.ts'));
    const config = updateConstructor(avatarCatalog.defaultAvatar, {
      build: 'average',
      gender: 'male',
      special: null,
    });
    const rig = await createEditorRig(config, new AbortController().signal);
    const separated = await createEditorRig(config, new AbortController().signal, {
      armPlacement: 'separated',
    });
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    const draws: { w: number; h: number }[] = [];
    const original = ctx.drawImage.bind(ctx);
    ctx.drawImage = ((...args: Parameters<typeof ctx.drawImage>) => {
      const image = args[0] as HTMLCanvasElement;
      draws.push({ w: image.width, h: image.height });
      return original(...args);
    }) as typeof ctx.drawImage;
    const orders = [];
    for (const dir of ['south', 'north'] as const) {
      draws.length = 0;
      ctx.clearRect(0, 0, 96, 128);
      rig.draw(ctx, dir, 'static', 0);
      orders.push({
        hands: draws.flatMap((d, i) => (d.w === 10 && d.h === 10 ? [i] : [])),
        arms: draws.flatMap((d, i) => (d.w === 10 && d.h === 32 ? [i] : [])),
      });
    }
    ctx.clearRect(0, 0, 96, 128);
    rig.draw(ctx, 'south', 'static', 0);
    const gap = ctx.getImageData(63, 72, 1, 1).data[3],
      shoulder = ctx.getImageData(63, 61, 1, 1).data[3];
    ctx.clearRect(0, 0, 96, 128);
    separated.draw(ctx, 'south', 'static', 0);
    const oldGap = ctx.getImageData(63, 72, 1, 1).data[3];
    return { orders, gap, shoulder, oldGap };
  });
  expect(result.orders[0]!.hands).toHaveLength(2);
  expect(result.orders[1]!.hands).toHaveLength(2);
  expect(Math.max(...result.orders[1]!.hands)).toBeLessThan(Math.min(...result.orders[1]!.arms));
  expect(Math.min(...result.orders[0]!.hands)).toBeGreaterThan(Math.min(...result.orders[0]!.arms));
  expect(result.gap).toBe(255);
  expect(result.shoulder).toBe(255);
  expect(result.oldGap).toBe(0);
});

test('open wrists and ears keep one head contour and baked walking frames keep the head stationary', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { loadEditorReview } = await import(
      /* @vite-ignore */ String('/src/avatar/editorReview.ts')
    );
    const { avatarCatalog } = await import(/* @vite-ignore */ String('/src/avatar/catalog.ts'));
    const { updateConstructor } = await import(/* @vite-ignore */ String('/src/avatar/editor.ts'));
    const config = updateConstructor(avatarCatalog.defaultAvatar, {
      gender: 'male',
      build: 'average',
      hair: { male: 1, female: 1 },
      special: null,
    });
    const sheet = await loadEditorReview(config, new AbortController().signal),
      ctx = sheet.getContext('2d')!;
    const pixel = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
    const skin = [1, 3, 5].map((i) => parseInt(config.palette.skin.slice(i, i + 2), 16));
    skin.push(255);
    const head = [...ctx.getImageData(0, 256, 96, 50).data];
    const heads = [2, 3, 4, 5].map((frame) => [...ctx.getImageData(frame * 96, 256, 96, 50).data]);
    return {
      skin,
      joins: [
        pixel(27, 256 + 38),
        pixel(30, 256 + 38),
        pixel(65, 256 + 38),
        pixel(68, 256 + 38),
        pixel(43, 128 + 38),
        pixel(44, 128 + 38),
        pixel(67, 256 + 86),
        pixel(67, 89),
      ],
      headContour: [28, 29, 66, 67].map((x) => pixel(x, 256 + 38)),
      // No vertical skin strip may cut through the ear's top/bottom at its open edge.
      earAttachmentContours: [
        { row: 0, xs: [26, 27, 68, 69] },
        { row: 1, xs: [43, 44] },
        { row: 2, xs: [26, 27, 68, 69] },
        { row: 3, xs: [51, 52] },
      ].flatMap(({ row, xs }) =>
        xs.flatMap((x) => [33, 34, 41, 42].map((y) => pixel(x, row * 128 + y))),
      ),
      outside: pixel(23, 256 + 38),
      // Each ear loses exactly its inner column and moves one pixel towards the head.
      removedEarColumns: [22, 73].map((x) => pixel(x, 256 + 38)[3]),
      head,
      heads,
    };
  });
  for (const join of result.joins) expect(join).toEqual(result.skin);
  for (const edge of result.headContour) expect(edge).toEqual([53, 43, 53, 255]);
  for (const edge of result.earAttachmentContours) expect(edge).toEqual([53, 43, 53, 255]);
  expect(result.outside).toEqual([53, 43, 53, 255]);
  expect(result.removedEarColumns).toEqual([0, 0]);
  for (const head of result.heads) expect(head).toEqual(result.head);
});
