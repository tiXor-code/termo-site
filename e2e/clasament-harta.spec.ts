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
  await expect(page.locator('h1')).toHaveText('Apă caldă în Sectorul 4, București');
  // StatHero median value.
  await expect(page.locator('.display-num').first()).toHaveText(/\d/);
  // TrendBars renders a figure > svg.
  await expect(page.locator('figure svg').first()).toBeVisible();
});

test('sector 4: answer-first status band, comparison table and FAQ', async ({ page }) => {
  await page.goto('/sector/4');

  // Answer-first block: the data stamp is always there, and the state is either
  // "nothing out" or a list of thermal points with an announced restore hour.
  await expect(page.getByText(/Ultima stare cunoscută · date până la/)).toBeVisible();
  await expect(page.getByText(/Cât se așteaptă, de obicei:/)).toBeVisible();

  // Sector vs city table: the ratio column must be filled in, not "—".
  const compare = page.locator('table', {
    has: page.getByRole('columnheader', { name: 'Sector / oraș' }),
  });
  await expect(compare).toBeVisible();
  await expect(compare.locator('tbody tr')).toHaveCount(6);
  await expect(compare.locator('tbody tr').first().locator('td').last()).toHaveText(/\d+,\d+×/);

  // Internal links out to the sector's worst streets.
  const streetLinks = page.locator('a[href^="/strada/"]');
  expect(await streetLinks.count()).toBeGreaterThan(0);

  // FAQ: visible answers plus a FAQPage block whose answers match them.
  const faq = page.locator('#intrebari');
  await expect(faq.getByText('Când se dă drumul la apa caldă în Sectorul 4?')).toBeVisible();
  const visible = (await faq.innerText()).replace(/\s+/g, ' ');
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const faqLd = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'FAQPage');
  expect(faqLd).toBeTruthy();
  expect(faqLd.mainEntity.length).toBeGreaterThan(3);
  for (const entry of faqLd.mainEntity) {
    expect(visible).toContain(entry.acceptedAnswer.text.replace(/\s+/g, ' '));
  }
});

test('sector 4: no horizontal page overflow on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sector/4');
  // The body must never scroll sideways; wide tables scroll inside their own box.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  const compare = page.locator('table', {
    has: page.getByRole('columnheader', { name: 'Sector / oraș' }),
  });
  const wrapperOverflowX = await compare
    .locator('xpath=..')
    .evaluate((el) => getComputedStyle(el).overflowX);
  expect(wrapperOverflowX).toBe('auto');
});

test('strada: sector line links back to the sector hub', async ({ page }) => {
  await page.goto('/strada/cal-vacaresti');
  await expect(page.locator('a[href="/sector/4"]').first()).toBeVisible();
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
