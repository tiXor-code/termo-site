import { expect, test } from '@playwright/test';

import { ptWithOngoing, ptWithoutOngoing } from './helpers';

// "Cand revine apa calda la blocul meu" was the most common written feedback on
// the live site, and the answer (CMTEB's estimated restore time) was already in
// the bundle but only rendered on /sector/N. These pin it onto the pages people
// actually land on.
//
// Both fixtures are data-dependent: in summer there may be no ongoing outage in
// the whole city, so the specs skip rather than fail out of season.
const ONGOING = ptWithOngoing();
const QUIET = ptWithoutOngoing();

test('PT page surfaces the estimated restore time for an ongoing outage', async ({ page }) => {
  test.skip(ONGOING === null, 'no ongoing interruption in the current bundle');
  const pt = ONGOING!;
  await page.goto(`/punct-termic/${pt.slug}`);

  const band = page.getByRole('region', { name: 'Întreruperi în curs' });
  await expect(band).toBeVisible();
  await expect(band).toContainText('Restabilire estimată');

  // The date must be the bundle's, rendered - not a placeholder or an em dash.
  const day = Number(pt.remediere.slice(8, 10));
  await expect(band).toContainText(String(day));
  await expect(band).not.toContainText('neanunțată');

  // It is an estimate from the supplier, and the page must say so.
  await expect(band).toContainText('nu o garanție');
  await expect(band.getByRole('link', { name: /Sectorul \d/ })).toBeVisible();
});

test('a PT with nothing ongoing says so, and points at the supplier', async ({ page }) => {
  test.skip(QUIET === null, 'every PT in the bundle has an ongoing interruption');
  await page.goto(`/punct-termic/${QUIET!.slug}`);

  await expect(page.getByRole('region', { name: 'Întreruperi în curs' })).toHaveCount(0);
  // Silence would read as a denial to someone whose water is off right now.
  await expect(page.getByText(/Nicio întrerupere anunțată în curs/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'cmteb.ro' })).toBeVisible();
});

test('the band rides the block finder: it sits inside the selected PT panel', async ({ page }) => {
  test.skip(ONGOING === null, 'no ongoing interruption in the current bundle');
  await page.goto(`/punct-termic/${ONGOING!.slug}`);
  // Pure SSG must hold: the band is server-rendered, so it is in the raw HTML
  // rather than painted in by client JS.
  const html = await page.content();
  expect(html).toContain('Restabilire estimată');
});

// The ordering rule is the whole point of hoisting: when the water is off right
// now, the restore time must beat last year's total to the top of the page.
// Measured before the change: the restore time rendered at y=904 against a
// 900px fold, i.e. off screen, on the page most people reach from a search.
test('an ongoing outage puts the band ABOVE the verdict card', async ({ page }) => {
  test.skip(ONGOING === null, 'no ongoing interruption in the current bundle');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/punct-termic/${ONGOING!.slug}`);

  const band = page.getByRole('region', { name: 'Întreruperi în curs' });
  const verdict = page.locator('.verdict').first();
  const bandY = (await band.boundingBox())!.y;
  const verdictY = (await verdict.boundingBox())!.y;
  expect(bandY).toBeLessThan(verdictY);

  // And the restore time itself must clear the fold, not merely the card.
  const restore = band.locator('strong').first();
  expect((await restore.boundingBox())!.y).toBeLessThan(900);
});

test('with nothing ongoing the verdict card still leads', async ({ page }) => {
  test.skip(QUIET === null, 'every PT in the bundle has an ongoing interruption');
  await page.goto(`/punct-termic/${QUIET!.slug}`);
  const note = page.getByText(/Nicio întrerupere anunțată în curs/);
  const verdict = page.locator('.verdict').first();
  expect((await verdict.boundingBox())!.y).toBeLessThan((await note.boundingBox())!.y);
});
