import { expect, test } from '@playwright/test';
import { addressedStreet } from './helpers';

const ADDR = addressedStreet();

test('search with a house number routes to the street with ?nr', async ({ page }) => {
  await page.goto('/cauta');
  const box = page.getByRole('combobox').first();
  await box.fill(`${ADDR.name} ${ADDR.number}`);

  // the result echoes the typed number ("…, nr. N") and links with ?nr=
  const option = page
    .getByRole('option')
    .filter({ hasText: `nr. ${ADDR.number}` })
    .first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page).toHaveURL(new RegExp(`/strada/${ADDR.slug}\\?nr=`));
});

test('address page shows the proximity-estimate band, a serving PT, finder still below', async ({
  page,
}) => {
  await page.goto(`/strada/${ADDR.slug}?nr=${encodeURIComponent(ADDR.number)}`);
  const main = page.locator('main');

  // the address band (client-rendered from ?nr) names the address + estimate
  await expect(main).toContainText(`${ADDR.name} ${ADDR.number}`);
  await expect(main).toContainText('probabil');
  await expect(main).toContainText('estimare după proximitate');

  // the resolved PT's verdict is shown, and the block finder is still present
  await expect(page.locator('.verdict .v-num').first()).toBeVisible();
  await expect(page.locator('.finder')).toHaveCount(1);
});

test('no ?nr -> no address band (street page byte-identical to today)', async ({ page }) => {
  await page.goto(`/strada/${ADDR.slug}`);
  // give the client a beat; the band must never appear without ?nr
  await page.waitForLoadState('networkidle');
  await expect(page.locator('main')).not.toContainText('estimare după proximitate');
  // the block finder still renders the normal page
  await expect(page.locator('.finder')).toHaveCount(1);
});
