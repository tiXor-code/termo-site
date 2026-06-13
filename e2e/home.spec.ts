import { expect, test } from '@playwright/test';

test('home: search-first hero, hero search box, dashboard below, zero /data fetches on load', async ({
  page,
}) => {
  const dataRequests: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith('/data/')) dataRequests.push(url.pathname);
  });

  await page.goto('/');

  // Search-first hero: eyebrow + the new plain-language headline.
  await expect(page.locator('.hero .eyebrow')).toContainText('Înainte să semnezi chiria');
  await expect(page.locator('h1')).toContainText('Câte zile pe an stă strada ta fără apă caldă?');

  // The hero search box (SearchBox variant="hero") is present as a combobox.
  await expect(page.locator('.hero').getByRole('combobox')).toBeVisible();

  // Example chips link to real street pages.
  const chip = page.locator('.hero .chip').first();
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute('href', /^\/strada\//);

  // The dashboard moved below the fold under "Cum stă Bucureștiul" — still intact.
  await expect(page.getByRole('heading', { name: 'Cum stă Bucureștiul' })).toBeVisible();
  await expect(page.locator('.teaser li').first()).toBeVisible();

  await page.waitForLoadState('networkidle');
  expect(dataRequests).toEqual([]);
});
