import { expect, test, type Page } from '@playwright/test';
import { enterDemo } from './demoFixture';
import { canOccupy } from '@creative-factory/world-core';
const snapshot = (page: Page) => page.evaluate(() => window.__CF_DEBUG__!.snapshot());
let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));
async function open(page: Page, location = 'island') {
  await enterDemo(page);
  await page.goto('/#/' + location);
  await expect(page.getByTestId('current-zone')).toHaveText(
    location === 'house' ? 'Дом · прихожая' : 'Мой остров',
    { timeout: 20000 },
  );
  await page.waitForFunction(() => (window.__CF_DEBUG__?.snapshot().tick ?? 0) > 3);
}
async function move(page: Page, key: string, ms: number) {
  await page.locator('.game-canvas canvas').focus();
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await expect.poll(async () => (await snapshot(page)).player.moving).toBe(false);
}
async function moveTo(
  page: Page,
  key: string,
  axis: 'x' | 'y',
  target: number,
  comparison: 'less' | 'greater',
) {
  await page.locator('.game-canvas canvas').focus();
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(
      ({ axis, target, comparison }) => {
        const p = window.__CF_DEBUG__!.snapshot().player[axis];
        return comparison === 'less' ? p < target : p > target;
      },
      { axis, target, comparison },
      { timeout: 15000 },
    );
  } finally {
    await page.keyboard.up(key);
  }
  await expect.poll(async () => (await snapshot(page)).player.moving).toBe(false);
}
async function clickHouse(page: Page) {
  const s = await snapshot(page),
    b = s.world.objects[0]!.bounds,
    c = s.camera!;
  const rect = await page.locator('.game-canvas canvas').boundingBox();
  await page.mouse.click(
    rect!.x + ((b.x + b.width / 2 - c.x) * c.zoom) / s.rendering.pixelRatio,
    rect!.y + ((b.y + b.height - 120 - c.y) * c.zoom) / s.rendering.pixelRatio,
  );
}
test('factory alias opens one animated island canvas, anchored at feet at the previous scale', async ({
  page,
}) => {
  await open(page, 'factory');
  await expect(page).toHaveURL(/#\/island$/);
  await expect(page.locator('canvas')).toHaveCount(1);
  const first = await snapshot(page);
  expect(first.animation).toBe('north-idle');
  expect(first.animationDurations).toEqual([500, 500]);
  // Sampling once per second aliases the one-second breathing loop.
  await expect
    .poll(async () => (await snapshot(page)).frame, { intervals: [50] })
    .not.toBe(first.frame);
  expect(first.rendering.origin).toEqual({ x: 0.5, y: 0.875 });
  expect(first.rendering.worldSize).toEqual({ width: 48, height: 64 });
  expect(first.rendering.textures[0]).toEqual({ key: 'avatar', width: 576, height: 512 });
  expect(first.rendering.props).toHaveLength(1);
  await page.screenshot({ path: '.cache/review/island-desktop.png', fullPage: true });
});
test('WASD/arrows select all directions and exact walk timings; blur clears held keys', async ({
  page,
}) => {
  await open(page);
  for (const [key, direction] of [
    ['KeyD', 'east'],
    ['ArrowDown', 'south'],
    ['KeyA', 'west'],
    ['ArrowUp', 'north'],
  ] as const) {
    await page.keyboard.down(key);
    await expect.poll(async () => (await snapshot(page)).animation).toBe(`${direction}-walk`);
    expect((await snapshot(page)).animationDurations).toEqual([125, 175, 125, 175]);
    await page.waitForTimeout(150);
    await page.keyboard.up(key);
    await expect.poll(async () => (await snapshot(page)).animation).toBe(`${direction}-idle`);
  }
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await snapshot(page)).player.moving).toBe(true);
  await page.getByRole('button', { name: 'Весь остров', exact: true }).focus();
  await expect.poll(async () => (await snapshot(page)).player.moving).toBe(false);
  const x = (await snapshot(page)).player.x;
  await page.waitForTimeout(250);
  expect((await snapshot(page)).player.x).toBe(x);
  await page.keyboard.up('KeyD');
  await page.locator('canvas').focus();
  await page.waitForTimeout(150);
  expect((await snapshot(page)).player.x).toBe(x);
});
test('water coast blocks actual browser movement and camera stops within the map', async ({
  page,
}) => {
  await open(page);
  await move(page, 'ArrowDown', 6000);
  const s = await snapshot(page);
  expect(s.player.moving).toBe(false);
  expect(s.player.y).toBeGreaterThan(s.world.spawn.y + 200);
  // A sloping shoreline can contact either corner of the unchanged AABB first.
  expect(canOccupy(s.world, { x: s.player.x, y: s.player.y + 6 })).toBe(false);
  expect(s.camera!.x).toBeGreaterThanOrEqual(0);
  expect(s.camera!.y).toBeGreaterThanOrEqual(0);
  expect(s.camera!.x + s.camera!.width).toBeLessThanOrEqual(s.map.width + 1);
  expect(s.camera!.y + s.camera!.height).toBeLessThanOrEqual(s.map.height + 1);
});
test('house wall blocks the player and uses correct depth in front and behind', async ({
  page,
}) => {
  await open(page);
  const s = await snapshot(page),
    house = s.world.objects[0]!;
  expect(s.rendering.playerDepth).toBeGreaterThan(s.rendering.props[0]!.depth);
  await moveTo(page, 'KeyA', 'x', house.bounds.x + 44, 'less');
  await move(page, 'KeyW', 1500);
  let current = await snapshot(page);
  expect(current.player.y).toBeGreaterThanOrEqual(house.bounds.y + house.bounds.height + 8);
  expect(current.player.moving).toBe(false);
  // Walk around the western side, then behind the same building.
  await moveTo(page, 'KeyA', 'x', house.bounds.x - 28, 'less');
  await moveTo(page, 'KeyW', 'y', house.bounds.y - 24, 'less');
  await moveTo(page, 'KeyD', 'x', s.world.door.x, 'greater');
  current = await snapshot(page);
  expect(current.rendering.playerDepth).toBeLessThan(current.rendering.props[0]!.depth);
});
test('house context opens once by proximity or click, closes with escape/outside/distance, and remains in view', async ({
  page,
}) => {
  await open(page);
  const door = (await snapshot(page)).world.door;
  await moveTo(page, 'KeyW', 'y', door.y + 50, 'less');
  const menu = page.getByRole('group', { name: 'Дом', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  const m = await menu.boundingBox(),
    panel = await page.locator('.game-panel').boundingBox();
  expect(m!.x).toBeGreaterThanOrEqual(panel!.x);
  expect(m!.y).toBeGreaterThanOrEqual(panel!.y);
  expect(m!.x + m!.width).toBeLessThanOrEqual(panel!.x + panel!.width);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await page.waitForTimeout(200);
  await expect(menu).toHaveCount(0);
  await move(page, 'KeyS', 600);
  await moveTo(page, 'KeyW', 'y', door.y + 50, 'less');
  await expect(menu).toBeVisible();
  await move(page, 'KeyS', 600);
  await expect(menu).toHaveCount(0);
  await clickHouse(page);
  await expect(menu).toBeVisible();
  const before = (await snapshot(page)).player;
  await page.waitForTimeout(150);
  expect((await snapshot(page)).player.x).toBe(before.x);
  expect((await snapshot(page)).player.y).toBe(before.y);
  await page.mouse.click(panel!.x + 10, panel!.y + panel!.height - 20);
  await expect(menu).toHaveCount(0);
});
test('island/house transitions and reload preserve world and avatar, without duplicate canvases or input', async ({
  page,
}) => {
  await open(page);
  const original = await snapshot(page);
  for (let i = 0; i < 3; i++) {
    await clickHouse(page);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL(/#\/house$/);
    await expect(page.getByTestId('current-zone')).toContainText('Дом');
    await expect(page.locator('canvas')).toHaveCount(1);
    expect((await snapshot(page)).avatar).toEqual(original.avatar);
    if (i === 0) {
      await page.reload();
      await expect(page.getByTestId('current-zone')).toContainText('Дом');
    }
    await page
      .getByRole('group', { name: 'Дом', exact: true })
      .getByRole('button', { name: 'Выйти', exact: true })
      .click();
    await expect(page).toHaveURL(/#\/island$/);
    await expect(page.getByTestId('current-zone')).toHaveText('Мой остров');
    await expect(page.locator('canvas')).toHaveCount(1);
    const s = await snapshot(page);
    expect(s.world).toEqual(original.world);
    expect(s.islandId).toBe(original.islandId);
    expect(s.player.y).toBe(s.world.door.y + 64);
  }
  await move(page, 'KeyD', 240);
  await page.waitForTimeout(1100);
  const saved = (await snapshot(page)).player;
  await page.reload();
  await expect(page.getByTestId('current-zone')).toHaveText('Мой остров');
  expect((await snapshot(page)).player).toEqual(saved);
  await page.getByRole('link', { name: 'Вернуться в меню', exact: false }).click();
  await expect(page.locator('.game-canvas canvas')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__CF_DEBUG__)).toBeUndefined();
  await page.getByRole('link', { name: /Войти на остров/ }).click();
  await expect(page.getByTestId('current-zone')).toHaveText('Мой остров');
  expect((await snapshot(page)).world).toEqual(original.world);
});
test('three interior rooms connect through doorways; outer walls, partition and stairs block movement', async ({
  page,
}) => {
  await open(page, 'house');
  await page.keyboard.press('Escape');
  await moveTo(page, 'KeyA', 'x', 12 * 32 + 16, 'less');
  await moveTo(page, 'KeyW', 'y', 10 * 32, 'less');
  await expect(page.getByTestId('current-zone')).toHaveText('Дом · левая комната');
  await moveTo(page, 'KeyD', 'x', 24 * 32 - 25, 'greater');
  await move(page, 'KeyD', 500);
  expect((await snapshot(page)).player.x).toBeLessThanOrEqual(24 * 32 - 10);
  await moveTo(page, 'KeyA', 'x', 12 * 32 + 16, 'less');
  await moveTo(page, 'KeyS', 'y', 21 * 32, 'greater');
  await moveTo(page, 'KeyD', 'x', 35 * 32 + 16, 'greater');
  await moveTo(page, 'KeyW', 'y', 10 * 32, 'less');
  await expect(page.getByTestId('current-zone')).toHaveText('Дом · правая комната');
  await moveTo(page, 'KeyD', 'x', 41 * 32, 'greater');
  await move(page, 'KeyW', 1400);
  const s = await snapshot(page);
  expect(s.player.y).toBeGreaterThanOrEqual(8 * 32 + 8);
  expect(s.player.moving).toBe(false);
  await page.getByRole('button', { name: 'Весь дом', exact: true }).click();
  await page.screenshot({ path: '.cache/review/house-overview.png', fullPage: true });
});
test('camera stays pixel-aligned and monotonic during long movement, settles, survives overview and resize', async ({
  page,
}) => {
  await open(page);
  await page.locator('canvas').focus();
  await page.keyboard.down('KeyD');
  const frames = await page.evaluate(async () => {
    const out: { x: number; player: number; zoom: number }[] = [];
    for (let i = 0; i < 90; i++) {
      await new Promise(requestAnimationFrame);
      const s = window.__CF_DEBUG__!.snapshot();
      out.push({ x: s.camera!.x, player: s.rendering.playerRenderX!, zoom: s.camera!.zoom });
    }
    return out;
  });
  await page.keyboard.up('KeyD');
  for (let i = 1; i < frames.length; i++) {
    expect(frames[i]!.x - frames[i - 1]!.x).toBeGreaterThanOrEqual(0);
    expect(frames[i]!.x - frames[i - 1]!.x).toBeLessThan(20);
    expect(
      Math.abs(frames[i]!.x * frames[i]!.zoom - Math.round(frames[i]!.x * frames[i]!.zoom)),
    ).toBeLessThan(0.001);
  }
  await page.waitForTimeout(1000);
  const settled = (await snapshot(page)).camera;
  await page.waitForTimeout(250);
  expect((await snapshot(page)).camera).toEqual(settled);
  await page.getByRole('button', { name: 'Весь остров', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).camera!.zoom).toBeLessThan(1);
  await page.screenshot({ path: '.cache/review/island-overview.png', fullPage: true });
  await page.getByRole('button', { name: 'К персонажу', exact: true }).click();
  const tick = (await snapshot(page)).tick;
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(250);
  await expect(page.locator('canvas')).toHaveCount(1);
  expect((await snapshot(page)).tick).toBeGreaterThan(tick);
  await move(page, 'ArrowLeft', 250);
  const s = await snapshot(page);
  expect(s.camera!.x).toBeGreaterThanOrEqual(0);
  expect(s.camera!.x + s.camera!.width).toBeLessThanOrEqual(s.map.width + 1);
});
test('failed content integrity check is actionable and never starts a broken game', async ({
  page,
}) => {
  await enterDemo(page);
  await page.route('**/content/world-*.json', (r) =>
    r.fulfill({ contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/#/factory');
  await expect(page.getByRole('alert')).toContainText('Версия контента изменилась');
  await expect(page.locator('canvas')).toHaveCount(0);
});
test('failed avatar catalog request tears down the game canvas and debug reference', async ({
  page,
}) => {
  await enterDemo(page);
  await page.route('**/content/avatars-*.json', (r) =>
    r.fulfill({ status: 404, body: 'not found' }),
  );
  await page.goto('/#/factory');
  await expect(page.getByRole('alert')).toContainText('Не удалось', { timeout: 20000 });
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__CF_DEBUG__)).toBeUndefined();
});

test('saved appearances in multiple builds use byte-identical editor sheets in both locations', async ({
  page,
}) => {
  await enterDemo(page);
  for (const build of ['very-slim', 'average', 'sturdy'] as const) {
    const config = await page.evaluate(async (build) => {
      const { avatarCatalog } = await import(/* @vite-ignore */ String('/src/avatar/catalog.ts'));
      const { updateWardrobe } = await import(/* @vite-ignore */ String('/src/avatar/wardrobe.ts'));
      const { DEMO_AVATAR_KEY } = await import(/* @vite-ignore */ String('/src/account/demo.ts'));
      const avatar = updateWardrobe(avatarCatalog.defaultAvatar, {
        build,
        gender: 'female',
        top: 10,
        bottom: 9,
        socks: 2,
        legwearTone: 'color',
        colors: {
          bottom: '#6e7da4',
          socks: '#aabbcc',
          hat: '#887766',
          jewelry: '#887766',
          special: '#887766',
        },
      });
      localStorage.setItem(DEMO_AVATAR_KEY, JSON.stringify({ formatVersion: 1, avatar }));
      return avatar;
    }, build);
    // This fixture writes storage directly, so remount the existing account
    // provider to read it, just as on a real subsequent login/reload.
    await page.reload();
    for (const location of ['island', 'house']) {
      await page.goto('/#/' + location);
      await expect(page.getByTestId('current-zone')).toContainText(
        location === 'island' ? 'Мой остров' : 'Дом',
      );
      const result = await page.evaluate(async () => {
        const s = window.__CF_DEBUG__!.snapshot();
        const { loadEditorReview } = await import(
          /* @vite-ignore */ String('/src/avatar/editorReview.ts')
        );
        const { loadGameAvatar } = await import(
          /* @vite-ignore */ String('/src/game/avatarSheet.ts')
        );
        const [editor, game] = await Promise.all([
          loadEditorReview(s.avatar, new AbortController().signal),
          loadGameAvatar(s.avatar, new AbortController().signal),
        ]);
        return {
          same: editor.toDataURL() === game.toDataURL(),
          config: s.avatar,
          size: s.rendering.worldSize,
        };
      });
      expect(result.same).toBe(true);
      expect(result.config).toEqual(config);
      expect(result.size).toEqual({ width: 48, height: 64 });
    }
  }
});
