import { expect, test, type Page } from '@playwright/test';
import { installSupabaseFixture, signIn } from './supabaseFixture';
const preview = (page: Page) =>
  page
    .locator('.avatar-stage canvas')
    .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
let browserErrors: string[] = [];
test.beforeEach(({ page }) => {
  browserErrors = [];
  page.on('pageerror', (e) => browserErrors.push(e.message));
  test.info().annotations.push({
    type: 'Auth dependency',
    description: 'Controlled HTTP fixture; no real email delivery.',
  });
});
test.afterEach(() => expect(browserErrors).toEqual([]));
test('registration, required public profile, avatar persistence, session restoration and repeat login', async ({
  page,
}) => {
  const state = await installSupabaseFixture(page);
  await signIn(page);
  await expect(page).toHaveURL(/#\/profile$/);
  await expect(page.getByRole('heading', { name: 'Расскажите о себе.' })).toBeVisible();
  await page.locator('[name=firstName]').fill('Анна');
  await page.locator('[name=lastName]').fill('Иванова');
  await page.getByLabel('Профессиональная роль').selectOption('educator');
  await page.getByLabel('Специализация').fill('Графический дизайн');
  await page.getByLabel('Организация').fill('Школа искусств');
  await page.getByLabel('Компетенции').fill('Иллюстрация, Типографика');
  await page.getByLabel('О себе', { exact: true }).fill('Делюсь опытом и создаю новые проекты.');
  await page.getByLabel('Ссылки на портфолио').fill('https://example.com/my-work');
  await page.getByRole('button', { name: 'Сохранить профиль' }).click();
  await expect(page.getByRole('status')).toHaveText('Профиль сохранён.');
  expect(state.profile?.professional_role).toBe('educator');
  expect(state.profile).not.toHaveProperty('email');
  await page.screenshot({ path: '.cache/review/account-profile.png', fullPage: true });
  await page.reload();
  await expect(page.locator('[name=firstName]')).toHaveValue('Анна');
  await expect(page.getByLabel('Ссылки на портфолио')).toHaveValue('https://example.com/my-work');
  await page.getByRole('link', { name: 'Перейти к персонажу' }).click();
  await expect(page).toHaveURL(/#\/avatar$/);
  const initial = await preview(page);
  for (const [name, option] of [
    ['body', 'base-02'],
    ['hair', 'curls-01'],
    ['outfit', 'jacket-01'],
    ['accessory', 'headphones-01'],
  ]) {
    const before = await preview(page);
    await page.locator(`[name=${name}]`).selectOption(option!);
    await expect.poll(() => preview(page)).not.toBe(before);
  }
  for (const name of ['Цвет кожи', 'Цвет волос', 'Цвет одежды', 'Цвет обуви'])
    await page.getByRole('button', { name: `${name}: вариант 3`, exact: true }).click();
  expect(await preview(page)).not.toBe(initial);
  for (const name of ['Север', 'Восток', 'Запад', 'Юг']) {
    const before = await preview(page);
    await page.getByRole('button', { name: `Повернуть: ${name}` }).click();
    await expect.poll(() => preview(page)).not.toBe(before);
  }
  const savedImage = await preview(page);
  await page.screenshot({ path: '.cache/review/account-avatar.png', fullPage: true });
  await page.getByRole('button', { name: 'Сохранить персонажа' }).click();
  await expect(page.getByRole('status')).toContainText('Персонаж сохранён');
  expect(state.avatarSaves).toBe(1);
  await page.reload();
  await expect(page.locator('[name=hair]')).toHaveValue('curls-01');
  expect(await preview(page)).toBe(savedImage);
  await page.getByRole('link', { name: 'На завод →', exact: true }).click();
  await expect(page.getByTestId('current-zone')).toHaveText('Центральный холл', { timeout: 20000 });
  expect((await page.evaluate(() => window.__CF_DEBUG__!.snapshot())).avatar.parts.hair).toBe(
    'curls-01',
  );
  expect((await page.evaluate(() => window.__CF_DEBUG__!.snapshot())).avatar.palette.outfit).toBe(
    '#6e7da4',
  );
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.locator('.game-canvas canvas')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Вход / регистрация' })).toBeVisible();
  expect(state.revoked).toBe(true);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Вход / регистрация' })).toBeVisible();
  await signIn(page);
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('link', { name: 'Мой персонаж' })).toBeVisible();
  expect(state.requests).toBe(2);
  await page.screenshot({ path: '.cache/review/account-home.png', fullPage: true });
});
test('OTP invalid code, cooldown, expiry, reload and resend states', async ({ page }) => {
  const state = await installSupabaseFixture(page, { existing: true });
  await page.clock.install();
  await page.goto('/#/login');
  await page.getByLabel('Электронная почта').fill('maker@example.test');
  await page.getByRole('button', { name: 'Получить код' }).click();
  await expect(page.getByRole('button', { name: /Новый код через/ })).toBeDisabled();
  await page.getByLabel('Код из письма').fill('000000');
  await page.getByRole('button', { name: 'Подтвердить и войти' }).click();
  await expect(page.getByRole('alert')).toContainText('Код неверен');
  await page.clock.fastForward(601000);
  await expect(page.getByTestId('otp-expiry')).toContainText('Срок действия кода истёк');
  await expect(page.getByRole('button', { name: 'Подтвердить и войти' })).toBeDisabled();
  await page.getByRole('button', { name: 'Отправить код ещё раз' }).click();
  await expect(page.getByTestId('otp-expiry')).toContainText('Действует ещё');
  expect(state.requests).toBe(2);
  await page.reload();
  await expect(page.getByLabel('Код из письма')).toBeVisible();
  await page.getByLabel('Код из письма').fill('123456');
  await page.getByRole('button', { name: 'Подтвердить и войти' }).click();
  await expect(page).toHaveURL(/#\/$/);
});
test('validation, safe conflict recovery and loading errors preserve stored data', async ({
  page,
}) => {
  const state = await installSupabaseFixture(page, { existing: true });
  await signIn(page);
  await page.goto('/#/profile');
  await page.getByLabel('Ссылки на портфолио').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Сохранить профиль' }).click();
  await expect(page.getByRole('alert')).toContainText('HTTPS');
  expect(state.profileSaves).toBe(0);
  await page.getByLabel('Ссылки на портфолио').fill('https://example.com');
  state.conflict = true;
  await page.getByRole('button', { name: 'Сохранить профиль' }).click();
  await expect(page.getByRole('alert')).toContainText('другой вкладке');
  expect(state.profileSaves).toBe(0);
  state.conflict = false;
  await page.getByRole('button', { name: 'Загрузить сохранённую версию' }).click();
  await expect(page.getByLabel('Ссылки на портфолио')).toHaveValue('');
  state.loadError = true;
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Сервис недоступен');
  state.loadError = false;
  await page.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect(page.locator('[name=firstName]')).toHaveValue('Анна');
});
test('hash routes reload, browser back, protected screens and repeated Phaser mount/unmount', async ({
  page,
}) => {
  await installSupabaseFixture(page, { existing: true });
  await page.goto('/#/avatar');
  await expect(page).toHaveURL(/#\/login$/);
  await signIn(page);
  for (const route of ['avatar', 'profile', 'factory', 'factory', 'factory']) {
    await page.goto(`/#/${route}`);
    await page.reload();
    if (route === 'factory') {
      await expect(page.getByTestId('current-zone')).toHaveText('Центральный холл', {
        timeout: 20000,
      });
      await expect(page.locator('.game-canvas canvas')).toHaveCount(1);
      await page.keyboard.down('KeyD');
      await expect
        .poll(async () => page.evaluate(() => window.__CF_DEBUG__!.snapshot().player.moving))
        .toBe(true);
      await page.getByRole('link', { name: 'На главную', exact: false }).first().click();
      await page.keyboard.up('KeyD');
      await expect(page.locator('.game-canvas canvas')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => window.__CF_DEBUG__)).toBeUndefined();
      await page.goBack();
      await expect(page.locator('.game-canvas canvas')).toHaveCount(1);
      await expect(page.getByTestId('current-zone')).toBeVisible();
      await expect
        .poll(async () => page.evaluate(() => window.__CF_DEBUG__!.snapshot().player.moving))
        .toBe(false);
      await page.getByRole('link', { name: 'На главную', exact: false }).first().click();
    } else await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await page.goto('/#/unknown');
  await expect(page.getByRole('heading', { name: 'Такого пространства пока нет' })).toBeVisible();
});
test('Auth rate limit is actionable and does not claim a code was sent', async ({ page }) => {
  const state = await installSupabaseFixture(page);
  state.rateLimit = true;
  await page.goto('/#/login');
  await page.getByLabel('Электронная почта').fill('maker@example.test');
  await page.getByRole('button', { name: 'Получить код' }).click();
  await expect(page.getByRole('alert')).toContainText('Слишком много попыток');
  await expect(page.getByLabel('Код из письма')).toHaveCount(0);
});
test('logout in another tab closes its factory; a failed network logout cannot restore a local session', async ({
  page,
  context,
}) => {
  const state = await installSupabaseFixture(page, { existing: true });
  await signIn(page);
  const other = await context.newPage();
  await installSupabaseFixture(other, { existing: true });
  await other.goto('/#/factory');
  await expect(other.getByTestId('current-zone')).toHaveText('Центральный холл', {
    timeout: 20000,
  });
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(other).toHaveURL(/#\/$/);
  await expect(other.locator('.game-canvas canvas')).toHaveCount(0);
  await other.close();
  await signIn(page);
  state.logoutFailure = true;
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Вход / регистрация' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Вход / регистрация' })).toBeVisible();
  await expect(page.locator('.game-canvas canvas')).toHaveCount(0);
});
test('landing, login and editor fit a narrow screen without horizontal scrolling', async ({
  page,
}) => {
  await installSupabaseFixture(page, { existing: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Войти по email' })).toBeVisible();
  expect(await fits()).toBe(true);
  await page.screenshot({ path: '.cache/review/home-mobile.png', fullPage: true });
  await signIn(page);
  await page.goto('/#/avatar');
  await expect(page.getByRole('combobox', { name: 'Тело', exact: true })).toBeVisible();
  expect(await fits()).toBe(true);
  await page.screenshot({ path: '.cache/review/avatar-mobile.png', fullPage: true });
});
