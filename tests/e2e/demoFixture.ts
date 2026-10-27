import { expect, type Page } from '@playwright/test';
export async function enterDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти в деморежим', exact: true }).click();
  await expect(page).toHaveURL(/#\/menu$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('С чего начнём');
}
