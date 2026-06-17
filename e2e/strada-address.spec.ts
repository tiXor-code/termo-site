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

test('address page: number pre-selects the serving PT, one section (no duplicate)', async ({
  page,
}) => {
  await page.goto(`/strada/${ADDR.slug}?nr=${encodeURIComponent(ADDR.number)}`);
  const main = page.locator('main');

  // the estimate note (rendered inside the finder) names the address + estimate
  await expect(main).toContainText(`${ADDR.name} ${ADDR.number}`);
  await expect(main).toContainText('estimare după proximitate');

  // exactly ONE visible verdict panel — proves the section is not duplicated
  await expect(page.locator('.verdict:visible .v-num')).toHaveCount(1);
  // the finder <select> is pre-set to the resolved serving PT
  await expect(page.locator('.finder select')).toHaveValue(ADDR.ptSlug);
  // the old separate-band prompt is gone
  await expect(main).not.toContainText('Nu e adresa ta');
});

test('no ?nr -> no address note, finder at default, single section', async ({ page }) => {
  await page.goto(`/strada/${ADDR.slug}`);
  // give the client a beat; the note must never appear without ?nr
  await page.waitForLoadState('networkidle');
  await expect(page.locator('main')).not.toContainText('estimare după proximitate');
  await expect(page.locator('.verdict:visible .v-num')).toHaveCount(1);
  await expect(page.locator('.finder')).toHaveCount(1);
});
