import { expect, test } from '@playwright/test';

test('home: hero copy, nav search, zero /data fetches on load', async ({ page }) => {
  const dataRequests: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith('/data/')) dataRequests.push(url.pathname);
  });

  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Jumătate din punctele termice');
  await expect(page.locator('h1')).toContainText(/\d/);

  // Nav search input exists (combobox role from SearchBox).
  await expect(page.getByRole('combobox').first()).toBeVisible();

  await page.waitForLoadState('networkidle');
  expect(dataRequests).toEqual([]);
});
