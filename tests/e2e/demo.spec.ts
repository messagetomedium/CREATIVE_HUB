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
  await page.getByRole('button', { name: 'Телосложение: Плотное', exact: true }).click();
  await page.getByRole('tab', { name: 'Голова', exact: true }).click();
  await page.getByRole('button', { name: 'Причёска: Мужская 3', exact: true }).click();
  await page.getByRole('tab', { name: 'Одежда', exact: true }).click();
  await page.getByRole('button', { name: 'Верх: Вариант 2', exact: true }).click();
  await page.getByRole('button', { name: 'Цвет верха: вариант 10', exact: true }).click();
  await page.getByRole('tab', { name: 'Детали', exact: true }).click();
  await page.getByRole('button', { name: 'Особый предмет: Вариант 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сбросить вид', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
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
  await page.getByRole('link', { name: 'Войти на завод', exact: true }).click();
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
  await page.getByRole('button', { name: 'Идёт', exact: true }).click();
  await expect(preview).toHaveAttribute('data-animation', 'walk');
  for (const direction of ['west', 'north', 'east', 'south']) {
    await page.getByRole('button', { name: 'Повернуть вправо', exact: true }).click();
    await expect(preview).toHaveAttribute('data-direction', direction);
    const frame = await preview.getAttribute('data-frame');
    await expect.poll(() => preview.getAttribute('data-frame')).not.toBe(frame);
  }
  await page.getByRole('button', { name: 'Повернуть влево', exact: true }).click();
  await expect(preview).toHaveAttribute('data-direction', 'east');
  await page.getByRole('tab', { name: 'Голова', exact: true }).click();
  await page.getByRole('button', { name: 'Причёска: Мужская 2', exact: true }).click();
  page.once('dialog', (d) => {
    expect(d.type()).toBe('confirm');
    void d.dismiss();
  });
  await page.getByRole('link', { name: 'Вернуться в меню', exact: true }).click();
  await expect(page).toHaveURL(/#\/avatar$/);
  await page.getByRole('button', { name: 'Сбросить вид', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Причёска: Мужская 1', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Случайный вид', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сбросить вид', exact: true })).toBeEnabled();
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
  await page.getByRole('tab', { name: 'Голова', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Причёска: Мужская 1', exact: true }),
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
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.cache/review/demo-editor-mobile.png', fullPage: true });
});

test('compact tabs, six-column slots, fixed palettes and four preview controls', async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto('/#/avatar');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Конструктор персонажа');
  await expect(page.getByText('Ваш образ. Ваш характер', { exact: false })).toHaveCount(0);
  await expect(page.locator('.avatar-layout canvas')).toHaveCount(1);
  await expect(page.locator('input[type=color]')).toHaveCount(0);
  const catalog = await page.locator('.avatar-form').boundingBox();
  const stage = await page.locator('.avatar-stage').boundingBox();
  expect(catalog!.x + catalog!.width).toBeLessThan(stage!.x);
  const controls = page.getByRole('group', { name: 'Управление предпросмотром', exact: true });
  expect(
    await controls
      .getByRole('button')
      .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label'))),
  ).toEqual(['Повернуть влево', 'Стоит', 'Идёт', 'Повернуть вправо']);
  await expect(
    page.getByRole('group', { name: 'Пол и возраст', exact: true }).getByRole('button'),
  ).toHaveCount(4);
  await expect(
    page.getByRole('group', { name: 'Телосложение', exact: true }).getByRole('button'),
  ).toHaveCount(3);
  await expect(
    page.getByRole('group', { name: 'Особенности тела', exact: true }).getByRole('button'),
  ).toHaveCount(12);
  await expect(
    page.getByRole('group', { name: 'Цвет кожи', exact: true }).getByRole('button'),
  ).toHaveCount(10);
  const bodyFeatures = await page
    .getByRole('group', { name: 'Особенности тела', exact: true })
    .getByRole('button')
    .evaluateAll((buttons) =>
      buttons.map((b) => ({ x: b.getBoundingClientRect().x, y: b.getBoundingClientRect().y })),
    );
  expect(new Set(bodyFeatures.slice(0, 6).map((b) => b.y)).size).toBe(1);
  expect(new Set(bodyFeatures.slice(6).map((b) => b.y)).size).toBe(1);
  expect(bodyFeatures[6]!.y).toBeGreaterThan(bodyFeatures[0]!.y);
  const buttonWidth = await page
    .getByRole('button', { name: 'Телосложение: Худое', exact: true })
    .evaluate((b) => b.getBoundingClientRect().width);
  const colorWidth = await page
    .getByRole('button', { name: 'Цвет кожи: вариант 1', exact: true })
    .evaluate((b) => b.getBoundingClientRect().width);
  expect(colorWidth / buttonWidth).toBeGreaterThan(0.4);
  expect(colorWidth / buttonWidth).toBeLessThan(0.55);
  const sections = [
    ['Голова', ['Рот', 'Глаза', 'Особенности лица', 'Причёска'], ['Цвет волос']],
    ['Одежда', ['Верх', 'Низ', 'Обувь'], ['Цвет верха', 'Цвет низа', 'Цвет обуви']],
    [
      'Детали',
      ['Шапка', 'Украшение', 'Особый предмет'],
      ['Цвет шапки', 'Цвет украшения', 'Цвет особого предмета'],
    ],
  ] as const;
  for (const [tab, groups, colors] of sections) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    for (const group of groups)
      await expect(
        page.getByRole('group', { name: group, exact: true }).getByRole('button'),
      ).toHaveCount(6);
    for (const color of colors)
      await expect(
        page.getByRole('group', { name: color, exact: true }).getByRole('button'),
      ).toHaveCount(12);
  }
  // Tabs have roving focus and support keyboard navigation, without changing the avatar.
  await page.getByRole('tab', { name: 'Детали', exact: true }).focus();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Тело', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Голова', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Сбросить вид', exact: true })).toBeDisabled();
});

test('new placeholder choices, independent hair sets and colors survive save, reset and factory', async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto('/#/avatar');
  await page.getByRole('button', { name: 'Пол и возраст: Девочка', exact: true }).click();
  await page.getByRole('button', { name: 'Телосложение: Худое', exact: true }).click();
  await page.getByRole('button', { name: 'Особенности тела: Вариант 12', exact: true }).click();
  await page.getByRole('tab', { name: 'Голова', exact: true }).click();
  await page.getByRole('button', { name: 'Причёска: Женская 6', exact: true }).click();
  await page.getByRole('button', { name: 'Рот: Вариант 4', exact: true }).click();
  await page.getByRole('button', { name: 'Глаза: Вариант 5', exact: true }).click();
  await page.getByRole('button', { name: 'Особенности лица: Веснушки', exact: true }).click();
  await page.getByRole('tab', { name: 'Тело', exact: true }).click();
  await page.getByRole('button', { name: 'Пол и возраст: Женщина', exact: true }).click();
  await page.getByRole('tab', { name: 'Голова', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Причёска: Женская 6', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'Одежда', exact: true }).click();
  await page.getByRole('button', { name: 'Низ: Вариант 6', exact: true }).click();
  await page.getByRole('button', { name: 'Цвет низа: вариант 11', exact: true }).click();
  await page.getByRole('tab', { name: 'Детали', exact: true }).click();
  await page.getByRole('button', { name: 'Шапка: Вариант 4', exact: true }).click();
  await page.getByRole('button', { name: 'Украшение: Вариант 3', exact: true }).click();
  await page.getByRole('button', { name: 'Особый предмет: Вариант 6', exact: true }).click();
  await page.getByRole('button', { name: 'Цвет шапки: вариант 12', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(
    page.getByText('Персонаж сохранён. Можно отправляться на завод.', { exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).avatar,
    DEMO_AVATAR_KEY,
  );
  expect(saved.customization).toMatchObject({
    version: 1,
    gender: 'female',
    age: 'adult',
    build: 'slim',
    mouth: 4,
    eyes: 5,
    faceFeatures: [1],
    bodyFeatures: [12],
    hair: { female: 6 },
    bottom: 6,
    hat: 4,
    jewelry: 3,
    special: 6,
  });
  await page.reload();
  await page.getByRole('tab', { name: 'Детали', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Шапка: Вариант 4', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Шапка: Вариант 4', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Шапка: Вариант 4', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Сбросить вид', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Шапка: Вариант 4', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('link', { name: 'Войти на завод', exact: true }).click();
  await expect(page.getByTestId('current-zone')).toBeVisible({ timeout: 20000 });
  expect((await page.evaluate(() => window.__CF_DEBUG__!.snapshot())).avatar).toEqual(saved);
});

test('reset restores the most recent save, not the initial avatar or an earlier save', async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto('/#/avatar');
  await page.getByRole('button', { name: 'Телосложение: Худое', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(
    page.getByText('Персонаж сохранён. Можно отправляться на завод.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Телосложение: Плотное', exact: true }).click();
  await page.getByRole('button', { name: 'Цвет кожи: вариант 9', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(
    page.getByText('Персонаж сохранён. Можно отправляться на завод.', { exact: true }),
  ).toBeVisible();
  const latest = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    DEMO_AVATAR_KEY,
  );
  expect(latest.avatar.revision).toBe(2);
  await page.getByRole('button', { name: 'Случайный вид', exact: true }).click();
  await page.getByRole('button', { name: 'Сбросить вид', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Телосложение: Плотное', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: 'Цвет кожи: вариант 9', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Сбросить вид', exact: true })).toBeDisabled();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), DEMO_AVATAR_KEY),
  ).toEqual(latest);
  await page.reload();
  await page.getByRole('button', { name: 'Телосложение: Худое', exact: true }).click();
  await page.getByRole('button', { name: 'Сбросить вид', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Телосложение: Плотное', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('original homepage stays available with a session, after reload and through the logo', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Здесь встречаются/ })).toBeVisible();
  await enterDemo(page);
  await page.getByRole('link', { name: 'Creative Factory — начало', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { name: /Ваше место/ })).toBeVisible();
  await expect(page.locator('.dashboard-grid > *')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Эксперты ККИ', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'События завода', exact: true })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('link', { name: 'Открыть меню', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Открыть меню', exact: true }).click();
  await expect(page.locator('.menu-grid > a')).toHaveCount(3);
  await expect(page.locator('.demo-strip')).toHaveCount(0);
});

test('editor actions have two requested rows and no explanatory blocks', async ({ page }) => {
  await enterDemo(page);
  await page.goto('/#/avatar');
  const actions = page.getByRole('group', { name: 'Действия с внешностью', exact: true });
  expect(await actions.getByRole('button').allTextContents()).toEqual([
    'Сбросить вид',
    'Случайный вид',
    'Сохранить',
  ]);
  const navigation = page.getByRole('navigation', {
    name: 'Переходы из конструктора',
    exact: true,
  });
  await expect(
    navigation.getByRole('link', { name: 'Вернуться в меню', exact: true }),
  ).toContainText('←');
  await expect(navigation.getByRole('link', { name: 'Войти на завод', exact: true })).toContainText(
    '→',
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const positions = await actions
      .getByRole('button')
      .evaluateAll((buttons) =>
        buttons.map((b) => ({ x: b.getBoundingClientRect().x, y: b.getBoundingClientRect().y })),
      );
    expect(new Set(positions.map((b) => b.y)).size).toBe(1);
    expect(positions[0]!.x).toBeLessThan(positions[1]!.x);
    expect(positions[1]!.x).toBeLessThan(positions[2]!.x);
    const actionBox = await actions.boundingBox(),
      navBox = await navigation.boundingBox();
    expect(navBox!.y).toBeGreaterThanOrEqual(actionBox!.y + actionBox!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  for (const selector of [
    '.demo-strip',
    '.editor-dirty',
    '.editor-storage-note',
    '.constructor-placeholder-note',
  ])
    await expect(page.locator(selector)).toHaveCount(0);
  await page.screenshot({ path: '.cache/review/editor-clean-mobile.png', fullPage: true });
});
