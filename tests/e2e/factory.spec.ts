import { expect, test, type Page } from '@playwright/test';
const snapshot = (page: Page) => page.evaluate(() => window.__CF_DEBUG__!.snapshot());
let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
});
test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});
async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('current-zone')).toHaveText('Центральный холл', { timeout: 20000 });
  await page.waitForFunction(() => (window.__CF_DEBUG__?.snapshot().tick ?? 0) > 3);
}
async function moveTo(
  page: Page,
  key: string,
  axis: 'x' | 'y',
  target: number,
  comparison: 'less' | 'greater',
) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(
      ({ axis, target, comparison }) => {
        const position = window.__CF_DEBUG__!.snapshot().player[axis];
        return comparison === 'less' ? position < target : position > target;
      },
      { axis, target, comparison },
      { timeout: 15000 },
    );
  } finally {
    await page.keyboard.up(key);
  }
  await expect.poll(async () => (await snapshot(page)).player.moving).toBe(false);
}
test('renders one live canvas in StrictMode with animated overhead avatar', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await expect(page.locator('canvas')).toHaveCount(1);
  const first = await snapshot(page);
  expect(first.animation).toBe('north-idle');
  await expect.poll(async () => (await snapshot(page)).frame).not.toBe(first.frame);
  expect(first.camera!.x).toBeGreaterThan(0);
  await page.screenshot({ path: '.cache/review/factory-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('WASD and arrow keys control all directions; blur clears held input', async ({ page }) => {
  await open(page);
  for (const [key, direction, axis, target, comparison] of [
    ['KeyD', 'east', 'x', 1090, 'greater'],
    ['ArrowDown', 'south', 'y', 900, 'greater'],
    ['KeyA', 'west', 'x', 1040, 'less'],
    ['ArrowUp', 'north', 'y', 848, 'less'],
  ] as const) {
    await moveTo(page, key, axis, target, comparison);
    const state = await snapshot(page);
    expect(state.player.direction).toBe(direction);
    expect(state.animation).toBe(`${direction}-idle`);
  }
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await snapshot(page)).player.moving).toBe(true);
  await page.getByRole('button', { name: 'Весь завод', exact: true }).focus();
  await expect.poll(async () => (await snapshot(page)).player.moving).toBe(false);
  const stopped = (await snapshot(page)).player.x;
  await page.waitForTimeout(300);
  expect((await snapshot(page)).player.x).toBe(stopped);
  await page.keyboard.up('KeyD');
  await page.locator('canvas').focus();
  await page.waitForTimeout(200);
  expect((await snapshot(page)).player.x).toBe(stopped);
});
test('walks through a real doorway into a workshop, respects walls and camera bounds', async ({
  page,
}) => {
  await open(page);
  await moveTo(page, 'ArrowLeft', 'x', 460, 'less');
  await moveTo(page, 'KeyW', 'y', 550, 'less');
  await expect(page.getByTestId('current-zone')).toHaveText('Дизайн и форма');
  await moveTo(page, 'ArrowUp', 'y', 110, 'less');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowUp');
  const state = await snapshot(page);
  expect(state.player.y).toBeGreaterThanOrEqual(104);
  expect(state.player.y).toBeLessThan(107);
  expect(state.camera!.x).toBeGreaterThanOrEqual(0);
  expect(state.camera!.y).toBeGreaterThanOrEqual(0);
  expect(state.camera!.x + state.camera!.width).toBeLessThanOrEqual(state.map.width + 1);
  expect(state.camera!.y + state.camera!.height).toBeLessThanOrEqual(state.map.height + 1);
  expect(state.camera!.y).toBe(0);
  await page.screenshot({ path: '.cache/review/factory-workshop.png', fullPage: true });
});
test('a solid bench blocks actual browser movement', async ({ page }) => {
  await open(page);
  await moveTo(page, 'KeyA', 'x', 900, 'less');
  await moveTo(page, 'KeyW', 'y', 690, 'less');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  const state = await snapshot(page);
  expect(state.player.y).toBeGreaterThanOrEqual(680);
  expect(state.player.y).toBeLessThan(684);
  expect(state.player.moving).toBe(false);
  await page.keyboard.up('KeyW');
});
test('overview, workshop markers and resize keep a single working game', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Выбрать ориентир: Медиа и звук' }).click();
  await expect(
    page.getByRole('button', { name: 'Выбрать ориентир: Медиа и звук' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Ориентир: цех 02. Вход отмечен на карте.')).toBeVisible();
  await page.getByRole('button', { name: 'Весь завод', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).camera!.zoom).toBeLessThan(1);
  await expect
    .poll(async () => {
      const { camera, map } = await snapshot(page);
      return (
        camera!.x <= 0 &&
        camera!.y <= 0 &&
        camera!.x + camera!.width >= map.width &&
        camera!.y + camera!.height >= map.height
      );
    })
    .toBe(true);
  await page.screenshot({ path: '.cache/review/factory-overview.png', fullPage: true });
  await page.getByRole('button', { name: 'К персонажу', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).camera!.zoom).toBe(1);
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.locator('canvas').focus();
  await moveTo(page, 'ArrowRight', 'x', 1080, 'greater');
  const state = await snapshot(page);
  expect(state.camera!.x).toBeGreaterThanOrEqual(0);
});
test('a failed content integrity check shows an actionable error instead of a broken game', async ({
  page,
}) => {
  await page.route('**/content/world-*.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Версия контента изменилась');
  await expect(page.locator('canvas')).toHaveCount(0);
});
test('failed tileset loading tears down the game canvas and its debug reference', async ({
  page,
}) => {
  await page.route('**/content/tiles-*.svg', (route) =>
    route.fulfill({ status: 404, body: 'not found' }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Не удалось', { timeout: 20000 });
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__CF_DEBUG__)).toBeUndefined();
});
