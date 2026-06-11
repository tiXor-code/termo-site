import { expect, test } from '@playwright/test';
import { lcy, mapYears, straziCount } from './helpers';

const YEAR = lcy();

test(`clasament puncte termice ${YEAR}: >100 rows, sorted, resortable`, async ({ page }) => {
  await page.goto(`/clasament/puncte-termice/${YEAR}`);

  const rows = page.locator('tbody tr');
  expect(await rows.count()).toBeGreaterThan(100);

  // Days column = 4th cell (Loc | Punct termic | Sector | Zile...).
  const dayOf = async (i: number) =>
    Number(
      (await rows.nth(i).locator('td').nth(3).innerText()).replace(/[^\d]/g, ''),
    );
  expect(await dayOf(0)).toBeGreaterThanOrEqual(await dayOf(1));

  const daysHeader = page.locator('th', { hasText: 'Zile fără apă caldă' }).first();
  const avariiHeader = page.locator('th', { hasText: 'din care avarii' }).first();
  await expect(daysHeader).toHaveAttribute('aria-sort', 'descending');
  await expect(avariiHeader).toHaveAttribute('aria-sort', 'none');

  await avariiHeader.getByRole('button').click();
  await expect(avariiHeader).toHaveAttribute('aria-sort', 'descending');
  await expect(daysHeader).toHaveAttribute('aria-sort', 'none');
});

test('clasament puncte termice yearless: h1 has lcy, canonical is yearless', async ({ page }) => {
  await page.goto('/clasament/puncte-termice');
  await expect(page.locator('h1')).toContainText(String(YEAR));
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute('href', /\/clasament\/puncte-termice$/);
});

test(`clasament strazi ${YEAR}: 100 rows SSR, "Arată toate" loads the rest`, async ({ page }) => {
  await page.goto(`/clasament/strazi/${YEAR}`);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(100);

  await page.getByRole('button', { name: /Arată toate/ }).click();
  await expect(rows).toHaveCount(straziCount(), { timeout: 15_000 });
  expect(straziCount()).toBeGreaterThan(100);
});

test('sector 4: median stat and trend bars', async ({ page }) => {
  await page.goto('/sector/4');
  await expect(page.locator('h1')).toHaveText('Sector 4');
  // StatHero median value.
  await expect(page.locator('.display-num').first()).toHaveText(/\d/);
  // TrendBars renders a figure > svg.
  await expect(page.locator('figure svg').first()).toBeVisible();
});

test('harta: map container mounts, year buttons present', async ({ page }) => {
  await page.goto('/harta');
  await expect(page.getByTestId('map-container')).toBeVisible({ timeout: 20_000 });
  const years = mapYears();
  for (const y of years) {
    await expect(
      page.getByRole('button', { name: String(y), exact: true }),
    ).toBeVisible();
  }
});
