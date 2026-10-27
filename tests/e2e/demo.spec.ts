import { expect, test } from '@playwright/test';
import { enterDemo } from './demoFixture';
import { DEMO_AVATAR_KEY, DEMO_SESSION_KEY } from '../../apps/web/src/account/demo';
let errors: string[] = [],
  remote: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  remote = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/supabase\.co|\/auth\/v1|\/rest\/v1/.test(r.url())) remote.push(r.url());
  });
});
test.afterEach(() => {
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
});
test('complete local flow, saved avatar in factory, reload, logout and repeat entry', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Войти в деморежим', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await enterDemo(page);
  await expect(page.getByRole('link', { name: 'Администратор (демо)', exact: true })).toBeVisible();
  await expect(page.locator('.menu-grid > a')).toHaveCount(3);
  await page.screenshot({ path: '.cache/review/demo-menu.png', fullPage: true });
  await page.getByRole('link', { name: /Редактировать персонажа/ }).click();
  await expect(page).toHaveURL(/#\/avatar$/);
  await page.getByRole('button', { name: 'Тело: Широкое', exact: true }).click();
  await page.getByRole('button', { name: 'Причёска: Кудри', exact: true }).click();
  await page.getByRole('button', { name: 'Одежда: Куртка', exact: true }).click();
  await page.getByRole('button', { name: 'Аксессуар: Наушники', exact: true }).click();
  await page.getByRole('button', { name: 'Цвет одежды: вариант 3', exact: true }).click();
  await expect(page.getByText('Есть несохранённые изменения', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить персонажа', exact: true }).click();
  await expect(
    page.getByText('Персонаж сохранён. Можно отправляться на завод.', { exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    DEMO_AVATAR_KEY,
  );
  expect(saved.formatVersion).toBe(1);
  expect(saved.avatar.parts.hair).toBe('curls-01');
  await page.screenshot({ path: '.cache/review/demo-editor.png', fullPage: true });
  await page.getByRole('link', { name: 'Войти на завод →', exact: true }).click();
  await expect(page.getByTestId('current-zone')).toHaveText('Центральный холл', { timeout: 20000 });
  expect((await page.evaluate(() => window.__CF_DEBUG__!.snapshot())).avatar).toEqual(saved.avatar);
  await page.locator('.game-canvas canvas').focus();
  await page.keyboard.down('KeyD');
  await expect
    .poll(() => page.evaluate(() => window.__CF_DEBUG__!.snapshot().player.moving))
    .toBe(true);
  await page.keyboard.up('KeyD');
  await page.getByRole('link', { name: 'Вернуться в меню', exact: false }).click();
  await expect(page.locator('.game-canvas canvas')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__CF_DEBUG__)).toBeUndefined();
  await page.reload();
  await expect(page).toHaveURL(/#\/menu$/);
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Войти в деморежим', exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), DEMO_SESSION_KEY)).toBeNull();
  await page.reload();
  await enterDemo(page);
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), DEMO_AVATAR_KEY),
  ).toEqual(saved);
  await page.locator('.menu-grid a[href="#/profile"]').click();
  await expect(page.getByRole('heading', { name: 'Личный кабинет скоро появится' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
});
test('four directions, idle and walk, reset, random and unsaved-navigation guard', async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto('/#/avatar');
  const preview = page.locator('.avatar-stage canvas');
  await expect(preview).toHaveAttribute('data-direction', 'south');
  const first = await preview.getAttribute('data-frame');
  await expect.poll(() => preview.getAttribute('data-frame')).not.toBe(first);
  await page.getByRole('button', { name: 'Ходьба', exact: true }).click();
  await expect(preview).toHaveAttribute('data-animation', 'walk');
  for (const direction of ['west', 'north', 'east', 'south']) {
    await page.getByRole('button', { name: 'Повернуть вправо', exact: true }).click();
    await expect(preview).toHaveAttribute('data-direction', direction);
    const frame = await preview.getAttribute('data-frame');
    await expect.poll(() => preview.getAttribute('data-frame')).not.toBe(frame);
  }
  await page.getByRole('button', { name: 'Повернуть влево', exact: true }).click();
  await expect(preview).toHaveAttribute('data-direction', 'east');
  await page.getByRole('button', { name: 'Причёска: Каре', exact: true }).click();
  page.once('dialog', (d) => {
    expect(d.type()).toBe('confirm');
    void d.dismiss();
  });
  await page.getByRole('link', { name: 'Вернуться в меню', exact: true }).click();
  await expect(page).toHaveURL(/#\/avatar$/);
  await page.getByRole('button', { name: 'Сбросить изменения', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Причёска: Короткая стрижка', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Случайный персонаж', exact: true }).click();
  await expect(page.getByText('Есть несохранённые изменения', { exact: true })).toBeVisible();
  page.once('dialog', (d) => {
    expect(d.type()).toBe('confirm');
    void d.dismiss();
  });
  await page.goBack();
  await expect(page).toHaveURL(/#\/avatar$/);
  page.once('dialog', (d) => {
    void d.accept();
  });
  await page.getByRole('link', { name: 'Вернуться в меню', exact: true }).click();
  await expect(page).toHaveURL(/#\/menu$/);
  await page.goto('/#/avatar');
  await expect(
    page.getByRole('button', { name: 'Причёска: Короткая стрижка', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
test('damaged storage recovers and nested hash routes reload with one game', async ({ page }) => {
  await enterDemo(page);
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), DEMO_AVATAR_KEY);
  await page.reload();
  await expect(page.getByText(/Локальные данные персонажа повреждены/)).toBeVisible();
  for (const route of ['avatar', 'profile', 'factory', 'factory', 'factory']) {
    await page.goto(`/#/${route}`);
    await page.reload();
    if (route === 'factory') {
      await expect(page.getByTestId('current-zone')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('.game-canvas canvas')).toHaveCount(1);
      await page.getByRole('link', { name: 'Вернуться в меню', exact: false }).click();
      await expect(page.locator('.game-canvas canvas')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => window.__CF_DEBUG__)).toBeUndefined();
    } else await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), DEMO_SESSION_KEY);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Войти в деморежим', exact: true })).toBeVisible();
});
test('narrow-screen demo and editor remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterDemo(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: /Редактировать персонажа/ }).click();
  await expect(
    page.getByRole('button', { name: 'Сохранить персонажа', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.cache/review/demo-editor-mobile.png', fullPage: true });
});
