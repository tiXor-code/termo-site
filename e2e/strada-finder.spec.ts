import { expect, test } from '@playwright/test';
import { finderFixture, singlePtStreet } from './helpers';

const FINDER = finderFixture();
const SINGLE = singlePtStreet();

test('multi-PT street: block finder present, selecting two blocks yields different verdicts', async ({
  page,
}) => {
  await page.goto(`/strada/${FINDER.slug}`);

  // The finder (block <select>) is the headline interaction, not a street-wide number.
  const finder = page.locator('.finder');
  await expect(finder).toBeVisible();
  await expect(finder.getByText('Care e blocul tău?')).toBeVisible();
  const select = finder.locator('select');
  await expect(select).toBeVisible();

  // Exactly one verdict panel is visible at a time (the rest carry `hidden`).
  const visibleNum = page.locator('.verdict:visible .v-num');
  await expect(visibleNum).toHaveCount(1);

  // Pick block A -> its serving PT's verdict number shows.
  await select.selectOption({ label: FINDER.optionA.optionText });
  await expect(page.locator('.verdict:visible .v-num')).toHaveText(String(FINDER.optionA.days));

  // Pick block B (different serving PT) -> a DIFFERENT verdict number shows.
  await select.selectOption({ label: FINDER.optionB.optionText });
  await expect(page.locator('.verdict:visible .v-num')).toHaveText(String(FINDER.optionB.days));

  // Sanity: the two blocks really do differ (fixture guarantees it).
  expect(FINDER.optionA.days).not.toBe(FINDER.optionB.days);
});

test('single-PT street: direct verdict, no finder', async ({ page }) => {
  await page.goto(`/strada/${SINGLE.slug}`);

  // No block finder — the street is one zone, the verdict is rendered directly.
  await expect(page.locator('.finder')).toHaveCount(0);
  await expect(page.locator('.verdict')).toHaveCount(1);
  await expect(page.locator('.verdict .v-num')).toBeVisible();
});

test('verdict band contrast: grade color never paints label/value/note text', async ({ page }) => {
  await page.goto(`/strada/${FINDER.slug}`);

  // Pick the higher-days block so the verdict carries a non-green grade color.
  const worse = FINDER.optionA.days >= FINDER.optionB.days ? FINDER.optionA : FINDER.optionB;
  await page.locator('.finder select').selectOption({ label: worse.optionText });

  const band = page.locator('.verdict:visible');
  await expect(band).toHaveCount(1);

  // CRITICAL CONTRAST RULE: only the big number, the pill, the left border, and
  // the YOU bar fill carry the grade color. The comparison labels/values/note
  // sit on a white sub-panel with ink text and a transparent background.
  const transparent = ['rgba(0, 0, 0, 0)', 'transparent'];
  for (const sel of ['.cmp .key', '.cmp .val', '.cmp .note']) {
    const els = band.locator(sel);
    const n = await els.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const bg = await els.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(transparent).toContain(bg);
    }
  }

  // The median bar fill is a fixed neutral grey, not the grade color.
  const medBg = await band
    .locator('.cmp .med .track > span')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(medBg).toBe('rgb(110, 102, 91)'); // #6E665B

  // The verdict pill text is white on its dark grade background (legible).
  const pill = band.locator('.v-pill');
  const pillColor = await pill.evaluate((el) => getComputedStyle(el).color);
  expect(pillColor).toBe('rgb(255, 255, 255)');
});
